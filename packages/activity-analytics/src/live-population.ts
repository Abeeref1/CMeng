/** T05/N12 (SW-26): one population rule for each Activity Review label.
 * The KPI tiles (activityAnalyticsCounts), the register filters
 * (activityRegisterPage) and the filtered report (module-report) all read
 * these rules, so a filter can never count a different set of activities
 * than the tile with the same label. Completed work is outside every live
 * measure. It stays in the full register: unfiltered, through the Status
 * filter and in the export. */

export const NON_EXECUTION_ACTIVITY_TYPES:readonly string[]=['level_of_effort','wbs_summary'];

export function isExecutionActivity(row:{activityType?:unknown}):boolean{
  return !NON_EXECUTION_ACTIVITY_TYPES.includes(row.activityType as string);
}

/** Remaining work: anything not recorded as completed. Unknown status stays in. */
export function isRemainingWork(row:{status?:unknown}):boolean{
  return row.status!=='completed';
}

type LiveRow={totalFloatHours?:number|null;criticality?:unknown;floatRiskWatchlist?:boolean|null;finishVarianceDays?:number|null};

/** Live measures. Each is counted over remaining execution work only. */
export const LIVE_ACTIVITY_MEASURES={
  critical:(row:LiveRow)=>row.totalFloatHours===null?null:row.criticality==='critical',
  nearCritical:(row:LiveRow)=>row.criticality==='unknown'||row.floatRiskWatchlist===null?null:row.criticality==='near_critical',
  floatRisk:(row:LiveRow)=>row.floatRiskWatchlist,
  // The "Delayed execution activities" tile: remaining work finishing after the controlled baseline.
  late:(row:LiveRow)=>row.finishVarianceDays===null?null:(row.finishVarianceDays as number)>0,
} as const;

/** Schedule-condition filters and the population each one counts.
 * 'remaining' = the KPI population (completed work excluded).
 * 'execution' = every execution activity; used only where the flag cannot be
 * true for completed work, or where the label is not a live measure. */
export const ACTIVITY_CONDITION_POPULATION={
  delayed:'remaining',
  schedule_pressure:'execution',
  missed_start:'execution',
  overdue_finish:'execution',
  negative_float:'remaining',
  zero_float:'remaining',
  float_risk:'remaining',
  open_logic:'execution',
} as const;

/** True when the selected filters count the live (KPI) population, so completed work is left out. */
export function activityFilterCountsRemainingWork(filters:{criticality?:string|null|undefined;condition?:string|null|undefined}):boolean{
  if(filters.criticality)return true;
  const condition=filters.condition??'';
  return Object.hasOwn(ACTIVITY_CONDITION_POPULATION,condition)
    &&ACTIVITY_CONDITION_POPULATION[condition as keyof typeof ACTIVITY_CONDITION_POPULATION]==='remaining';
}
