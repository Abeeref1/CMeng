// SW-25: a float-pressure count only means something against the population it
// was counted from. As work completes, the unfinished execution population
// shrinks, so a falling raw count can be completion alone. Every revision point
// carries that population and the share; the trend direction uses the share.
// Raw counts are kept unchanged. Unknown count or empty population stays null.

export type FloatTrendMeasure = "critical" | "near_critical" | "negative_float";

export interface FloatPopulationShares {
  floatShareBasis: "unfinished_execution_activities";
  criticalSharePercent: number | null;
  nearCriticalSharePercent: number | null;
  negativeFloatSharePercent: number | null;
}

export interface FloatTrendMeasureMovement {
  measure: FloatTrendMeasure;
  fromCount: number | null;
  toCount: number | null;
  fromPopulation: number | null;
  toPopulation: number | null;
  fromSharePercent: number | null;
  toSharePercent: number | null;
  countChange: number | null;
  shareChangePercentagePoints: number | null;
  /** Direction of the share of unfinished execution activities, never of the raw count. */
  direction: "share_higher" | "share_lower" | "share_unchanged" | "not_established";
  /** True when the raw count fell but the share of remaining work did not fall. */
  countFellWithoutShareFalling: boolean;
}

export interface FloatTrendSummary {
  basis: "share_of_unfinished_execution_activities";
  fromRevisionId: string | null;
  toRevisionId: string | null;
  measures: FloatTrendMeasureMovement[];
}

export function floatSharePercent(count: number | null | undefined, population: number | null | undefined): number | null {
  if (typeof count !== "number" || !Number.isFinite(count)) return null;
  if (typeof population !== "number" || !Number.isFinite(population) || population <= 0) return null;
  return Number(((count / population) * 100).toFixed(4));
}

export function floatPopulationShares(float: {
  criticalCount: number | null;
  nearCriticalCount: number | null;
  negativeFloatCount: number | null;
  totalActivities: number;
}): FloatPopulationShares {
  return {
    floatShareBasis: "unfinished_execution_activities",
    criticalSharePercent: floatSharePercent(float.criticalCount, float.totalActivities),
    nearCriticalSharePercent: floatSharePercent(float.nearCriticalCount, float.totalActivities),
    negativeFloatSharePercent: floatSharePercent(float.negativeFloatCount, float.totalActivities),
  };
}

interface FloatTrendPointInput {
  revisionId: string;
  unfinishedExecutionActivityCount?: number;
  criticalCount: number | null;
  nearCriticalCount: number | null;
  negativeFloatCount: number | null;
  criticalSharePercent?: number | null;
  nearCriticalSharePercent?: number | null;
  negativeFloatSharePercent?: number | null;
}

const measureFields: Array<[FloatTrendMeasure, "criticalCount" | "nearCriticalCount" | "negativeFloatCount", "criticalSharePercent" | "nearCriticalSharePercent" | "negativeFloatSharePercent"]> = [
  ["critical", "criticalCount", "criticalSharePercent"],
  ["near_critical", "nearCriticalCount", "nearCriticalSharePercent"],
  ["negative_float", "negativeFloatCount", "negativeFloatSharePercent"],
];

/** First-to-latest movement, the same span the trend charts title. */
export function summarizeFloatTrend(points: readonly FloatTrendPointInput[]): FloatTrendSummary {
  const first = points[0] ?? null, last = points.length > 1 ? points[points.length - 1]! : null;
  return {
    basis: "share_of_unfinished_execution_activities",
    fromRevisionId: first?.revisionId ?? null,
    toRevisionId: last?.revisionId ?? null,
    measures: measureFields.map(([measure, countKey, shareKey]) => {
      const fromCount = first?.[countKey] ?? null, toCount = last?.[countKey] ?? null;
      const fromShare = first?.[shareKey] ?? null, toShare = last?.[shareKey] ?? null;
      const countChange = fromCount !== null && toCount !== null ? toCount - fromCount : null;
      const shareChange = fromShare !== null && toShare !== null ? Number((toShare - fromShare).toFixed(4)) : null;
      const direction = shareChange === null ? "not_established" : shareChange > 0 ? "share_higher" : shareChange < 0 ? "share_lower" : "share_unchanged";
      return {
        measure,
        fromCount,
        toCount,
        fromPopulation: first?.unfinishedExecutionActivityCount ?? null,
        toPopulation: last?.unfinishedExecutionActivityCount ?? null,
        fromSharePercent: fromShare,
        toSharePercent: toShare,
        countChange,
        shareChangePercentagePoints: shareChange,
        direction,
        countFellWithoutShareFalling: countChange !== null && countChange < 0 && shareChange !== null && shareChange >= 0,
      };
    }),
  };
}
