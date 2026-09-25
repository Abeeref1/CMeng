/** One applicability rule for readiness and issue assessment. The advisory
 * module-position placeholder is not a requested independent comparison. */
export function comparisonRequirement(data: any) {
  const challenge = data?.challenge;
  const items = Array.isArray(challenge?.items) ? challenge.items : [];
  const advisory = items.length === 1 && items[0]?.metric === 'module_position';
  const state = challenge?.reconciliationState ?? 'not_checked';
  return {required: Boolean(challenge) && !advisory && (items.length > 0 || state !== 'not_checked'), advisory, state, items};
}
