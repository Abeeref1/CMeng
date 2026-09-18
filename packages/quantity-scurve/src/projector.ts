import type {
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import {
  assessQuantityMapping,
  type CanonicalQuantityItem,
  type CanonicalQuantityProgressModel,
  type InstalledQuantitySnapshot,
  type QuantityScheduleAllocation,
} from "../../quantity-progress-core/src";
import type {
  QuantityActualHistoryMode,
  QuantityScurvePoint,
  QuantityScurveProjection,
  QuantityScurveSeries,
} from "./types";

interface PhasedQuantity {
  allocationId: string;
  quantityItemId: string;
  quantity: number;
  startMs: number;
  finishMs: number;
}

function ms(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function dateIso(value: number): string {
  return new Date(value)
    .toISOString()
    .slice(0, 10);
}

function coverage(
  known: number,
  total: number,
): number | null {
  if (total <= 0) return null;
  return Number(
    ((known / total) * 100).toFixed(4),
  );
}

function unitKey(
  unit: string | null,
): string {
  return unit === null
    ? "__UNKNOWN_UNIT__"
    : unit
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function effectiveCurrentDates(
  activity: CanonicalScheduleActivity,
): {
  startIso: string | null;
  finishIso: string | null;
} {
  return {
    startIso:
      activity.actualStartIso ??
      activity.forecastStartIso ??
      activity.currentStartIso,
    finishIso:
      activity.status === "completed"
        ? activity.actualFinishIso ??
          activity.forecastFinishIso ??
          activity.currentFinishIso
        : activity.forecastFinishIso ??
          activity.currentFinishIso,
  };
}

function phasedAllocation(
  allocation: QuantityScheduleAllocation,
  activity: CanonicalScheduleActivity | undefined,
  mode: "baseline" | "current",
): PhasedQuantity | null {
  if (
    !activity ||
    !Number.isFinite(
      allocation.allocatedQuantity,
    ) ||
    allocation.allocatedQuantity < 0
  ) {
    return null;
  }

  const dates =
    mode === "baseline"
      ? {
          startIso:
            activity.baselineStartIso,
          finishIso:
            activity.baselineFinishIso,
        }
      : effectiveCurrentDates(activity);

  const startMs = ms(dates.startIso);
  const finishMs = ms(dates.finishIso);

  if (
    startMs === null ||
    finishMs === null ||
    finishMs < startMs
  ) {
    return null;
  }

  return {
    allocationId:
      allocation.allocationId,
    quantityItemId:
      allocation.quantityItemId,
    quantity:
      allocation.allocatedQuantity,
    startMs,
    finishMs,
  };
}

function cumulativePhased(
  phased: readonly PhasedQuantity[],
  pointMs: number,
): number | null {
  if (phased.length === 0) return null;

  let total = 0;

  for (const allocation of phased) {
    if (pointMs < allocation.startMs) {
      continue;
    }

    if (
      pointMs >= allocation.finishMs ||
      allocation.startMs ===
        allocation.finishMs
    ) {
      total += allocation.quantity;
      continue;
    }

    const fraction =
      (pointMs - allocation.startMs) /
      (allocation.finishMs -
        allocation.startMs);

    total +=
      allocation.quantity *
      Math.max(0, Math.min(1, fraction));
  }

  return Number(total.toFixed(6));
}

function actualSnapshotAt(
  snapshots: readonly InstalledQuantitySnapshot[],
  itemIds: ReadonlySet<string>,
  pointMs: number,
): number | null {
  const latestByItem = new Map<
    string,
    {
      ms: number;
      quantity: number;
    }
  >();

  for (const snapshot of snapshots) {
    if (!itemIds.has(snapshot.quantityItemId)) {
      continue;
    }

    const snapshotMs = ms(
      snapshot.asOfIso,
    );
    if (
      snapshotMs === null ||
      snapshotMs > pointMs
    ) {
      continue;
    }

    const current =
      latestByItem.get(
        snapshot.quantityItemId,
      );

    if (
      !current ||
      snapshotMs > current.ms
    ) {
      latestByItem.set(
        snapshot.quantityItemId,
        {
          ms: snapshotMs,
          quantity:
            snapshot.installedQuantity,
        },
      );
    }
  }

  if (latestByItem.size === 0) {
    return null;
  }

  return Number(
    [...latestByItem.values()]
      .reduce(
        (sum, item) =>
          sum + item.quantity,
        0,
      )
      .toFixed(6),
  );
}

function actualHistoryMode(
  snapshots: readonly InstalledQuantitySnapshot[],
  itemIds: ReadonlySet<string>,
): QuantityActualHistoryMode {
  const dates = new Set(
    snapshots
      .filter((snapshot) =>
        itemIds.has(
          snapshot.quantityItemId,
        ),
      )
      .map(
        (snapshot) =>
          snapshot.asOfIso,
      ),
  );

  if (dates.size === 0) return "missing";
  return dates.size === 1
    ? "current_snapshot_only"
    : "snapshot_history";
}

function timeline(
  baseline: readonly PhasedQuantity[],
  current: readonly PhasedQuantity[],
  snapshots: readonly InstalledQuantitySnapshot[],
  itemIds: ReadonlySet<string>,
  intervalDays: number,
): number[] {
  const anchors = [
    ...baseline.flatMap(
      (allocation) => [
        allocation.startMs,
        allocation.finishMs,
      ],
    ),
    ...current.flatMap(
      (allocation) => [
        allocation.startMs,
        allocation.finishMs,
      ],
    ),
    ...snapshots
      .filter((snapshot) =>
        itemIds.has(
          snapshot.quantityItemId,
        ),
      )
      .map((snapshot) =>
        ms(snapshot.asOfIso),
      )
      .filter(
        (value): value is number =>
          value !== null,
      ),
  ];

  if (anchors.length === 0) return [];

  const start = Math.min(...anchors);
  const finish = Math.max(...anchors);
  const step =
    intervalDays * 86_400_000;
  const points: number[] = [];

  for (
    let point = start;
    point <= finish;
    point += step
  ) {
    points.push(point);
  }

  points.push(...anchors);

  return [...new Set(points)].sort(
    (a, b) => a - b,
  );
}

function latestSnapshotPerItem(
  snapshots: readonly InstalledQuantitySnapshot[],
  itemIds: ReadonlySet<string>,
): Map<string, InstalledQuantitySnapshot> {
  const latest = new Map<
    string,
    InstalledQuantitySnapshot
  >();

  for (const snapshot of snapshots) {
    if (!itemIds.has(snapshot.quantityItemId)) {
      continue;
    }

    const current =
      latest.get(
        snapshot.quantityItemId,
      );
    if (
      !current ||
      (ms(snapshot.asOfIso) ?? Number.NEGATIVE_INFINITY) >
        (ms(current.asOfIso) ?? Number.NEGATIVE_INFINITY)
    ) {
      latest.set(
        snapshot.quantityItemId,
        snapshot,
      );
    }
  }

  return latest;
}

function seriesForUnit(
  unit: string | null,
  items: readonly CanonicalQuantityItem[],
  allocations: readonly QuantityScheduleAllocation[],
  snapshots: readonly InstalledQuantitySnapshot[],
  activities: ReadonlyMap<string, CanonicalScheduleActivity>,
  intervalDays: number,
): QuantityScurveSeries {
  const itemIds = new Set(
    items.map(
      (item) =>
        item.quantityItemId,
    ),
  );

  const knownContract = items.filter(
    (item) =>
      item.contractQuantity !== null &&
      item.contractQuantity >= 0,
  );

  const contractQuantity =
    knownContract.reduce(
      (sum, item) =>
        sum + item.contractQuantity!,
      0,
    );

  const relevantAllocations =
    allocations.filter(
      (allocation) =>
        itemIds.has(
          allocation.quantityItemId,
        ),
    );

  const mappedQuantity =
    relevantAllocations.reduce(
      (sum, allocation) =>
        sum +
        allocation.allocatedQuantity,
      0,
    );

  const baseline = relevantAllocations
    .map((allocation) =>
      phasedAllocation(
        allocation,
        activities.get(
          allocation.activityId,
        ),
        "baseline",
      ),
    )
    .filter(
      (
        item,
      ): item is PhasedQuantity =>
        item !== null,
    );

  const current = relevantAllocations
    .map((allocation) =>
      phasedAllocation(
        allocation,
        activities.get(
          allocation.activityId,
        ),
        "current",
      ),
    )
    .filter(
      (
        item,
      ): item is PhasedQuantity =>
        item !== null,
    );

  const itemSnapshots =
    snapshots.filter(
      (snapshot) =>
        itemIds.has(
          snapshot.quantityItemId,
        ),
    );

  const latest =
    latestSnapshotPerItem(
      itemSnapshots,
      itemIds,
    );

  const overInstalledItemIds =
    knownContract
      .filter((item) => {
        const snapshot =
          latest.get(
            item.quantityItemId,
          );
        return (
          snapshot !== undefined &&
          snapshot.installedQuantity >
            item.contractQuantity! +
              Math.max(
                0.000001,
                Math.abs(
                  item.contractQuantity!,
                ) * 0.000001,
              )
        );
      })
      .map(
        (item) =>
          item.quantityItemId,
      )
      .sort();

  const timelineMs = timeline(
    baseline,
    current,
    itemSnapshots,
    itemIds,
    intervalDays,
  );

  const points: QuantityScurvePoint[] =
    timelineMs.map((pointMs) => ({
      dateIso: dateIso(pointMs),
      baselinePlannedQuantity:
        cumulativePhased(
          baseline,
          pointMs,
        ),
      currentForecastQuantity:
        cumulativePhased(
          current,
          pointMs,
        ),
      actualInstalledQuantity:
        actualSnapshotAt(
          itemSnapshots,
          itemIds,
          pointMs,
        ),
    }));

  return {
    unit,
    itemCount: items.length,
    knownContractQuantity:
      Number(
        contractQuantity.toFixed(6),
      ),
    mappingCoveragePercent:
      coverage(
        Math.min(
          mappedQuantity,
          contractQuantity,
        ),
        contractQuantity,
      ),
    baselineTimePhasingCoveragePercent:
      coverage(
        baseline.reduce(
          (sum, item) =>
            sum + item.quantity,
          0,
        ),
        mappedQuantity,
      ),
    currentTimePhasingCoveragePercent:
      coverage(
        current.reduce(
          (sum, item) =>
            sum + item.quantity,
          0,
        ),
        mappedQuantity,
      ),
    actualSnapshotItemCoveragePercent:
      coverage(
        latest.size,
        knownContract.length,
      ),
    actualHistoryMode:
      actualHistoryMode(
        itemSnapshots,
        itemIds,
      ),
    overInstalledItemIds,
    points,
  };
}

export function buildQuantityScurveProjection(
  quantities: CanonicalQuantityProgressModel,
  schedule: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    intervalDays?: number;
  },
): QuantityScurveProjection {
  if (
    quantities.scheduleRevisionId !==
    schedule.sourceRevisionId
  ) {
    throw new Error(
      "Quantity S-Curve requires governed quantity mappings and schedule from the same schedule revision",
    );
  }

  const intervalDays =
    input.intervalDays ?? 7;
  if (
    !Number.isSafeInteger(intervalDays) ||
    intervalDays <= 0
  ) {
    throw new Error(
      "Quantity S-Curve intervalDays must be a positive integer",
    );
  }

  const mapping =
    assessQuantityMapping(
      quantities,
    );

  const activities = new Map(
    schedule.activities.map(
      (activity) => [
        activity.activityId,
        activity,
      ],
    ),
  );

  const byUnit = new Map<
    string,
    CanonicalQuantityItem[]
  >();

  for (const item of quantities.items) {
    const key = unitKey(item.unit);
    const list =
      byUnit.get(key) ?? [];
    list.push(item);
    byUnit.set(key, list);
  }

  const series = [
    ...byUnit.values(),
  ]
    .map((items) =>
      seriesForUnit(
        items[0]!.unit,
        items,
        quantities.allocations,
        quantities.installedSnapshots,
        activities,
        intervalDays,
      ),
    )
    .sort((a, b) =>
      (a.unit ?? "")
        .localeCompare(b.unit ?? ""),
    );

  const allocationState:
    QuantityScurveProjection["allocationState"] =
    mapping.overAllocatedItemIds.length > 0
      ? "conflicted"
      : mapping.knownQuantityItemCount === 0 ||
          mapping.mappedItemCount === 0
        ? "missing"
        : mapping.complete
          ? "complete"
          : "partial";

  const diagnostics = [
    ...quantities.diagnostics,
    ...mapping.diagnostics,
  ];

  for (const allocation of quantities.allocations) {
    if (!activities.has(allocation.activityId)) {
      diagnostics.push(
        "QUANTITY_ALLOCATION_ACTIVITY_UNRESOLVED:" +
          allocation.allocationId +
          ":" +
          allocation.activityId,
      );
    }
  }

  return {
    schemaVersion: "1.0",
    projectionKey: "quantity_scurve",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId:
      quantities.projectId ??
      schedule.projectId,
    boqRevisionId:
      quantities.boqRevisionId,
    scheduleRevisionId:
      quantities.scheduleRevisionId,
    dataDateIso:
      schedule.dataDateIso,
    allocationState,
    series,
    unmappedItemIds:
      mapping.unmappedItemIds,
    partiallyAllocatedItemIds:
      mapping.partiallyAllocatedItemIds,
    overAllocatedItemIds:
      mapping.overAllocatedItemIds,
    diagnostics: [
      ...new Set(diagnostics),
    ],
  };
}
