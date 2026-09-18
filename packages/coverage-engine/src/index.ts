import type { SourceInventory } from "../../parser-contracts/src";

export type CoverageStatus =
  | "not_started"
  | "in_progress"
  | "incomplete"
  | "verified";

export interface CoverageInput {
  expectedUnits: number;
  inventoriedUnits: number;
  processedUnits: number;
  failedUnits: number;
  unresolvedUnits: number;
  duplicateOrdinals: number;
  missingOrdinals: number[];
}

export interface CoverageCertificate extends CoverageInput {
  status: CoverageStatus;
  coveragePercent: number;
  reasons: string[];
}

function pct(processed: number, expected: number): number {
  if (expected <= 0) return 0;
  return Number(((processed / expected) * 100).toFixed(4));
}

export function certifyCoverage(input: CoverageInput): CoverageCertificate {
  const reasons: string[] = [];

  if (!Number.isSafeInteger(input.expectedUnits) || input.expectedUnits < 0) {
    throw new Error("expectedUnits must be a non-negative safe integer");
  }

  const counters = [
    input.inventoriedUnits,
    input.processedUnits,
    input.failedUnits,
    input.unresolvedUnits,
    input.duplicateOrdinals,
  ];

  if (counters.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("coverage counters must be non-negative safe integers");
  }

  if (input.expectedUnits === 0) {
    reasons.push("Source inventory has zero expected units");
  }
  if (input.inventoriedUnits !== input.expectedUnits) {
    reasons.push(
      `Inventory count ${input.inventoriedUnits} does not match expected count ${input.expectedUnits}`,
    );
  }
  if (input.processedUnits !== input.expectedUnits) {
    reasons.push(
      `Processed count ${input.processedUnits} does not match expected count ${input.expectedUnits}`,
    );
  }
  if (input.failedUnits > 0) {
    reasons.push(`${input.failedUnits} unit(s) failed processing`);
  }
  if (input.unresolvedUnits > 0) {
    reasons.push(`${input.unresolvedUnits} unit(s) remain unresolved`);
  }
  if (input.duplicateOrdinals > 0) {
    reasons.push(`${input.duplicateOrdinals} duplicate unit ordinal(s) detected`);
  }
  if (input.missingOrdinals.length > 0) {
    reasons.push(
      `Missing unit ordinals: ${input.missingOrdinals.slice(0, 25).join(", ")}`,
    );
  }

  let status: CoverageStatus;
  if (
    input.processedUnits === 0 &&
    input.inventoriedUnits === 0 &&
    input.expectedUnits > 0
  ) {
    status = "not_started";
  } else if (
    input.processedUnits > 0 &&
    input.processedUnits < input.expectedUnits &&
    input.failedUnits === 0
  ) {
    status = "in_progress";
  } else {
    status = reasons.length === 0 ? "verified" : "incomplete";
  }

  return {
    ...input,
    status,
    coveragePercent: pct(input.processedUnits, input.expectedUnits),
    reasons,
  };
}

export function coverageFromInventory(
  inventory: SourceInventory,
): CoverageCertificate {
  const ordinals = inventory.units.map((unit) => unit.ordinal);
  const ordinalSet = new Set(ordinals);
  const duplicateOrdinals = ordinals.length - ordinalSet.size;

  const missingOrdinals: number[] = [];
  for (let ordinal = 1; ordinal <= inventory.expectedUnitCount; ordinal += 1) {
    if (!ordinalSet.has(ordinal)) missingOrdinals.push(ordinal);
  }

  const failedUnits = inventory.units.filter((unit) => !unit.readable).length;
  const processedUnits = inventory.units.filter(
    (unit) => unit.readable && unit.method !== "not_read",
  ).length;

  return certifyCoverage({
    expectedUnits: inventory.expectedUnitCount,
    inventoriedUnits: inventory.units.length,
    processedUnits,
    failedUnits,
    unresolvedUnits: inventory.units.filter(
      (unit) => unit.readable && unit.method === "not_read",
    ).length,
    duplicateOrdinals,
    missingOrdinals,
  });
}
