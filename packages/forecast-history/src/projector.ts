import type {
  IndependentForecastProjection,
} from "../../independent-forecast/src";
import type {
  ForecastHistoryPoint,
  ForecastHistoryProjection,
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
    independentForecastCompletionIso:
      projection.independentForecastCompletionIso,
    sourceForecastCompletionIso:
      projection.sourceForecastCompletionIso,
    assumptions: [
      ...projection.assumptions,
    ],
  };
}

export function buildForecastHistoryProjection(
  snapshots: readonly ForecastHistorySnapshot[],
  input: {
    generatedAt: string;
    producerVersion: string;
  },
): ForecastHistoryProjection {
  const ordered = [...snapshots].sort(
    (a, b) =>
      Date.parse(a.generatedAt) -
        Date.parse(b.generatedAt) ||
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

  const diagnostics: string[] = [];
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
    establishedForecastCount:
      points.filter(
        (point) =>
          point.independentForecastCompletionIso !== null,
      ).length,
    points,
    diagnostics,
  };
}
