/** One applicability rule for readiness and issue assessment. The advisory
 * module-position placeholder is not a requested independent comparison. */
const sourceRegisterViews=new Set(['activity-analytics','schedule-change-report','revision-trend','variance-trends','forecast-history','milestones']);
export function comparisonRequirement(data: any,moduleKey?:string) {
  const challenge = data?.challenge;
  const items = Array.isArray(challenge?.items) ? challenge.items : [];
  const advisory = sourceRegisterViews.has(moduleKey??'') || items.length === 1 && items[0]?.metric === 'module_position';
  const state = challenge?.reconciliationState ?? 'not_checked';
  return {required: Boolean(challenge) && !advisory && (items.length > 0 || state !== 'not_checked'), advisory, state, items};
}
