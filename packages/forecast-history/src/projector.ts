import type {
  IndependentForecastProjection,
} from "../../independent-forecast/src";
import type {
  ForecastHistoryPoint,
  ForecastHistoryProjection,
  ForecastHistoryRevisionRole,
  ForecastHistorySnapshot,
} from "./types";

function ms(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function movementDays(
  from: string | null,
  to: string | null,
): number | null {
  const fromMs = ms(from);
  const toMs = ms(to);
  if (
    fromMs === null ||
    toMs === null
  ) {
    return null;
  }

  return Number(
    ((toMs - fromMs) / 86_400_000).toFixed(6),
  );
}

export function forecastSnapshotFromProjection(
  projection: IndependentForecastProjection,
  snapshotId: string,
  role: ForecastHistoryRevisionRole =
    "regular_update",
): ForecastHistorySnapshot {
  return {
    snapshotId,
    generatedAt: projection.generatedAt,
    sourceRevisionId:
      projection.sourceRevisionId,
    dataDateIso:
      projection.dataDateIso,
    producerVersion:
      projection.producerVersion,
    origin: projection.origin,
    role,
    independentForecastCompletionIso:
      projection.independentForecastCompletionIso,
    sourceForecastCompletionIso:
      projection.sourceForecastCompletionIso,
    assumptions: [
      ...projection.assumptions,
    ],
  };
}

function latestForDataDate(
  snapshots:
    readonly ForecastHistorySnapshot[],
): {
  selected: ForecastHistorySnapshot[];
  duplicateIds: string[];
} {
  const byDate = new Map<
    string,
    ForecastHistorySnapshot[]
  >();

  for (const snapshot of snapshots) {
    const date = snapshot.dataDateIso!;
    const list = byDate.get(date) ?? [];
    list.push(snapshot);
    byDate.set(date, list);
  }

  const selected:
    ForecastHistorySnapshot[] = [];
  const duplicateIds: string[] = [];

  for (const group of byDate.values()) {
    group.sort(
      (a, b) =>
        Date.parse(a.generatedAt) -
          Date.parse(b.generatedAt) ||
        a.snapshotId.localeCompare(
          b.snapshotId,
        ),
    );

    const winner =
      group[group.length - 1]!;
    selected.push(winner);

    for (
      let index = 0;
      index < group.length - 1;
      index += 1
    ) {
      duplicateIds.push(
        group[index]!.snapshotId,
      );
    }
  }

  return {
    selected,
    duplicateIds:
      duplicateIds.sort(),
  };
}

export function buildForecastHistoryProjection(
  snapshots: readonly ForecastHistorySnapshot[],
  input: {
    generatedAt: string;
    producerVersion: string;
  },
): ForecastHistoryProjection {
  const diagnostics: string[] = [];
  const excludedSnapshotIds: string[] = [];

  const regularWithDate =
    snapshots.filter((snapshot) => {
      const role =
        snapshot.role ?? "unknown";

      if (role !== "regular_update") {
        excludedSnapshotIds.push(
          snapshot.snapshotId,
        );
        diagnostics.push(
          "FORECAST_HISTORY_EXCLUDED_" +
            role.toUpperCase() +
            "_SNAPSHOT:" +
            snapshot.snapshotId,
        );
        return false;
      }

      if (
        snapshot.dataDateIso === null ||
        ms(snapshot.dataDateIso) === null
      ) {
        excludedSnapshotIds.push(
          snapshot.snapshotId,
        );
        diagnostics.push(
          "FORECAST_HISTORY_EXCLUDED_MISSING_DATA_DATE:" +
            snapshot.snapshotId,
        );
        return false;
      }

      return true;
    });

  const deduplicated =
    latestForDataDate(
      regularWithDate,
    );

  for (
    const duplicateId of
    deduplicated.duplicateIds
  ) {
    excludedSnapshotIds.push(
      duplicateId,
    );
    diagnostics.push(
      "FORECAST_HISTORY_DUPLICATE_DATA_DATE_EXCLUDED:" +
        duplicateId,
    );
  }

  const ordered =
    deduplicated.selected.sort(
      (a, b) =>
        ms(a.dataDateIso)! -
          ms(b.dataDateIso)! ||
        a.sourceRevisionId.localeCompare(
          b.sourceRevisionId,
        ) ||
        a.snapshotId.localeCompare(
          b.snapshotId,
        ),
    );

  const firstEstablished =
    ordered.find(
      (snapshot) =>
        ms(
          snapshot.independentForecastCompletionIso,
        ) !== null,
    ) ?? null;

  const points: ForecastHistoryPoint[] =
    ordered.map((snapshot, index) => {
      const previous =
        index > 0
          ? ordered[index - 1]!
          : null;

      return {
        ...snapshot,
        role: "regular_update",
        dataDateIso:
          snapshot.dataDateIso!,
        assumptions: [
          ...snapshot.assumptions,
        ],
        movementDaysVsPrevious:
          previous
            ? movementDays(
                previous.independentForecastCompletionIso,
                snapshot.independentForecastCompletionIso,
              )
            : null,
        movementDaysVsFirst:
          firstEstablished
            ? movementDays(
                firstEstablished.independentForecastCompletionIso,
                snapshot.independentForecastCompletionIso,
              )
            : null,
      };
    });

  if (
    ordered.some(
      (snapshot) =>
        snapshot.independentForecastCompletionIso === null,
    )
  ) {
    diagnostics.push(
      "FORECAST_HISTORY_CONTAINS_UNESTABLISHED_SNAPSHOTS",
    );
  }

  return {
    schemaVersion: "1.0",
    projectionKey: "forecast_history",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    snapshotCount: points.length,
    inputSnapshotCount:
      snapshots.length,
    establishedForecastCount:
      points.filter(
        (point) =>
          point.independentForecastCompletionIso !== null,
      ).length,
    excludedSnapshotCount:
      excludedSnapshotIds.length,
    excludedSnapshotIds: [
      ...new Set(
        excludedSnapshotIds,
      ),
    ].sort(),
    duplicateDataDateSnapshotIds:
      deduplicated.duplicateIds,
    points,
    diagnostics: [
      ...new Set(diagnostics),
    ],
  };
}
