import type {
  ComputedValue,
  ValueOrigin,
} from "./types";

export function sourceValue<T>(
  value: T,
  sourceRefs: string[],
): ComputedValue<T> {
  return {
    value,
    origin: "source",
    formula: null,
    sourceRefs: [...sourceRefs],
    confidence: 1,
    assumptions: [],
  };
}

export function deterministicValue<T>(
  value: T,
  formula: string,
  sourceRefs: string[],
): ComputedValue<T> {
  return {
    value,
    origin: "deterministic_derived",
    formula,
    sourceRefs: [...sourceRefs],
    confidence: 1,
    assumptions: [],
  };
}

export function modelDerivedValue<T>(
  value: T,
  formula: string | null,
  sourceRefs: string[],
  confidence: number,
  assumptions: string[] = [],
): ComputedValue<T> {
  return {
    value,
    origin: "model_derived",
    formula,
    sourceRefs: [...sourceRefs],
    confidence,
    assumptions: [...assumptions],
  };
}

export function scenarioValue<T>(
  value: T,
  assumptions: string[],
  sourceRefs: string[] = [],
): ComputedValue<T> {
  return {
    value,
    origin: "scenario_assumption",
    formula: null,
    sourceRefs: [...sourceRefs],
    confidence: null,
    assumptions: [...assumptions],
  };
}

export function shouldBlockForApproval(
  _origin: ValueOrigin,
): false {
  // CMeng never blocks a calculable result merely because an
  // upstream value has not been manually "approved". Provenance
  // and origin are shown instead. Missing indispensable inputs are
  // a computability issue, not an approval issue.
  return false;
}
