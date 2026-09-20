export type CanonicalValueState =
  | "official"
  | "approved"
  | "certified"
  | "assessed"
  | "submitted"
  | "provisional"
  | "candidate"
  | "conflicted"
  | "missing"
  | "not_applicable";

export type CanonicalAuthority =
  | "contractual"
  | "approved_amendment"
  | "engineer_determination"
  | "employer_certified"
  | "certified"
  | "paid"
  | "actual_incurred"
  | "source_register"
  | "source_schedule"
  | "source_progress"
  | "deterministic_calculation"
  | "probabilistic_scenario"
  | "management_approved"
  | "candidate"
  | "missing";

export interface CanonicalSourceRef {
  sourceId: string;
  locator: string | null;
  revisionId?: string | null;
  page?: number | null;
  row?: number | null;
}

export interface CanonicalFact<T> {
  factKey: string;
  semanticType: string;
  value: T | null;
  unit: string | null;
  state: CanonicalValueState;
  authority: CanonicalAuthority;
  effectiveAt: string | null;
  reportingCutoffIso: string | null;
  sourceRevisionId: string | null;
  sourceRefs: CanonicalSourceRef[];
  supersedesFactKeys: string[];
  coveragePercent: number | null;
  confidence: number | null;
  method: string;
  diagnostics: string[];
}

export type TaxBasis =
  | "exclusive"
  | "inclusive"
  | "not_applicable"
  | "unknown";

export interface GovernedMoneyValue {
  amount: number | null;
  currency: string | null;
  taxBasis: TaxBasis;
  taxRatePercent: number | null;
  grossAmount: number | null;
  netAmount: number | null;
  state: CanonicalValueState;
  authority: CanonicalAuthority;
  effectiveAt: string | null;
  reportingCutoffIso: string | null;
  sourceRefs: CanonicalSourceRef[];
  diagnostics: string[];
}

export function establishedFact<T>(
  fact: CanonicalFact<T>,
): boolean {
  return (
    fact.value !== null &&
    fact.state !== "missing" &&
    fact.state !== "not_applicable" &&
    fact.authority !== "missing" &&
    fact.sourceRefs.length > 0
  );
}

export function requireSameUnit(
  values: Array<{
    unit: string | null;
    value: number | null;
  }>,
): {
  unit: string | null;
  comparable: boolean;
} {
  const established = values.filter(
    (item) =>
      item.value !== null &&
      item.unit !== null,
  );
  const units = new Set(
    established.map(
      (item) => item.unit!,
    ),
  );
  return {
    unit:
      units.size === 1
        ? [...units][0]!
        : null,
    comparable:
      established.length > 0 &&
      units.size === 1,
  };
}
