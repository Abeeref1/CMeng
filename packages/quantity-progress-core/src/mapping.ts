import type {
  CanonicalQuantityProgressModel,
  QuantityMappingAssessment,
} from "./types";

function pct(
  value: number,
  total: number,
): number | null {
  if (total <= 0) return null;
  return Number(
    ((value / total) * 100).toFixed(4),
  );
}

export function assessQuantityMapping(
  model: CanonicalQuantityProgressModel,
): QuantityMappingAssessment {
  const allocations = new Map<
    string,
    number
  >();

  for (const allocation of model.allocations) {
    allocations.set(
      allocation.quantityItemId,
      (allocations.get(
        allocation.quantityItemId,
      ) ?? 0) +
        allocation.allocatedQuantity,
    );
  }

  let totalKnown = 0;
  let mappedQuantity = 0;
  let mappedItemCount = 0;
  let knownQuantityItemCount = 0;

  const overAllocatedItemIds: string[] = [];
  const partiallyAllocatedItemIds: string[] = [];
  const unmappedItemIds: string[] = [];
  const populationIncomplete=model.diagnostics.includes('BOQ_SOURCE_POPULATION_INCOMPLETE');
  const diagnostics: string[] = populationIncomplete?['BOQ_SOURCE_POPULATION_INCOMPLETE']:[];

  for (const item of model.items) {
    if (
      item.contractQuantity === null ||
      item.contractQuantity < 0
    ) {
      continue;
    }

    knownQuantityItemCount += 1;
    totalKnown += item.contractQuantity;

    const allocated =
      allocations.get(
        item.quantityItemId,
      ) ?? 0;

    if (allocated === 0) {
      unmappedItemIds.push(
        item.quantityItemId,
      );
      continue;
    }

    mappedItemCount += 1;
    mappedQuantity += Math.min(
      allocated,
      item.contractQuantity,
    );

    const tolerance = Math.max(
      0.000001,
      Math.abs(item.contractQuantity) *
        0.000001,
    );

    if (
      allocated >
      item.contractQuantity + tolerance
    ) {
      overAllocatedItemIds.push(
        item.quantityItemId,
      );
      diagnostics.push(
        "QUANTITY_ITEM_OVER_ALLOCATED:" +
          item.quantityItemId,
      );
    } else if (
      allocated <
      item.contractQuantity - tolerance
    ) {
      partiallyAllocatedItemIds.push(
        item.quantityItemId,
      );
    }
  }

  // F45: quantities are summed only within one unit. Over different (or
  // unknown) units the totals and their ratio are not established; the item
  // counts and item lists remain.
  const units = new Set(
    model.items
      .filter((item) => item.contractQuantity !== null && item.contractQuantity >= 0)
      .map((item) => item.unit === null ? null : item.unit.toLowerCase().replace(/\s+/g, " ").trim()),
  );
  const singleUnit = units.size <= 1 && !units.has(null);
  return {
    totalKnownContractQuantity:
      singleUnit ? Number(totalKnown.toFixed(6)) : null,
    mappedQuantity:
      singleUnit ? Number(mappedQuantity.toFixed(6)) : null,
    mappedItemCount,
    knownQuantityItemCount,
    mappingCoveragePercent: singleUnit ? pct(
      mappedQuantity,
      totalKnown,
    ) : null,
    overAllocatedItemIds:
      overAllocatedItemIds.sort(),
    partiallyAllocatedItemIds:
      partiallyAllocatedItemIds.sort(),
    unmappedItemIds:
      unmappedItemIds.sort(),
    complete:
      !populationIncomplete &&
      overAllocatedItemIds.length === 0 &&
      partiallyAllocatedItemIds.length === 0 &&
      unmappedItemIds.length === 0 &&
      knownQuantityItemCount === model.items.length &&
      knownQuantityItemCount > 0,
    diagnostics,
  };
}
