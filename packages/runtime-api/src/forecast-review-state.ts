// P0-B: the one review state every surface shows for the management forecast. It is
// read from the gate's management forecast, so no page can hold or relabel the
// finish by a rule of its own. No imports: any module can use it without a cycle.
export function managementReviewStateOf(gate: {usable?: boolean; managementForecast?: {state?: string} | null} | null | undefined) {
  const state = gate?.managementForecast?.state;
  if (gate?.usable !== true || state === "not_calculable" || !state) return "review_required" as const;
  return state === "calculated" ? "accepted_for_analysis" as const : "calculated_with_qualifications" as const;
}
