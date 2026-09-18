export interface ActivityPopulationInput {
  baselineStableIds: readonly string[];
  currentStableIds: readonly string[];
}

export interface ActivityPopulationCoverage {
  baselineCount: number;
  currentCount: number;
  matchedCount: number;
  baselineOnlyCount: number;
  currentOnlyCount: number;
  baselineOnlyIds: string[];
  currentOnlyIds: string[];
  duplicateBaselineIds: string[];
  duplicateCurrentIds: string[];
  coveragePercentOfCurrent: number | null;
  authoritative: boolean;
  reasons: string[];
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    if (seen.has(value)) dup.add(value);
    else seen.add(value);
  }
  return [...dup].sort();
}

function validSet(values: readonly string[]): Set<string> {
  return new Set(values.map((value) => value.trim()).filter(Boolean));
}

export function reconcileActivityPopulation(
  input: ActivityPopulationInput,
): ActivityPopulationCoverage {
  const duplicateBaselineIds = duplicates(input.baselineStableIds);
  const duplicateCurrentIds = duplicates(input.currentStableIds);
  const reasons: string[] = [];

  const baseline = validSet(input.baselineStableIds);
  const current = validSet(input.currentStableIds);

  const baselineOnlyIds = [...baseline]
    .filter((id) => !current.has(id))
    .sort();
  const currentOnlyIds = [...current]
    .filter((id) => !baseline.has(id))
    .sort();
  const matchedCount = [...current].filter((id) => baseline.has(id)).length;

  if (duplicateBaselineIds.length > 0) {
    reasons.push(
      `Baseline contains ${duplicateBaselineIds.length} duplicate stable ID(s).`,
    );
  }
  if (duplicateCurrentIds.length > 0) {
    reasons.push(
      `Current schedule contains ${duplicateCurrentIds.length} duplicate stable ID(s).`,
    );
  }
  if (input.baselineStableIds.some((id) => !id.trim())) {
    reasons.push("Baseline contains blank stable ID values.");
  }
  if (input.currentStableIds.some((id) => !id.trim())) {
    reasons.push("Current schedule contains blank stable ID values.");
  }

  const authoritative = reasons.length === 0;
  const coveragePercentOfCurrent =
    current.size === 0
      ? null
      : Number(((matchedCount / current.size) * 100).toFixed(4));

  return {
    baselineCount: baseline.size,
    currentCount: current.size,
    matchedCount,
    baselineOnlyCount: baselineOnlyIds.length,
    currentOnlyCount: currentOnlyIds.length,
    baselineOnlyIds,
    currentOnlyIds,
    duplicateBaselineIds,
    duplicateCurrentIds,
    coveragePercentOfCurrent,
    authoritative,
    reasons,
  };
}
