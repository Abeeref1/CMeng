import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ScheduleActivityChange} from './types';

/** A field named baseline does not prove a controlled baseline changed. XER
 * target dates are current planning fields; missing provenance requires review. */
export function classifyScheduleChanges(changes:readonly Pick<ScheduleActivityChange,'fromActivityId'|'toActivityId'|'fieldChanges'>[],from:CanonicalScheduleModel,to:CanonicalScheduleModel){
  const fields:Record<string,string[]>={
    structural:['activityType','wbsId','calendarId','originalDurationHours'],
    forecast:['currentStartIso','currentFinishIso','forecastStartIso','forecastFinishIso','totalFloatHours','freeFloatHours'],
    progress:['status','actualStartIso','actualFinishIso','remainingDurationHours','percentComplete'],metadata:['name'],
  };
  // One pass over the changes gives the same per-category activity counts as
  // one filter per category: an activity counts once in each category that
  // any of its changed fields belongs to.
  const categories=Object.entries(fields);
  const counts=categories.map(()=>0);
  const dates:typeof changes[number][]=[];
  for(const r of changes){
    if(r.fieldChanges.length===0)continue;
    for(let i=0;i<categories.length;i++){const names=categories[i]![1];if(r.fieldChanges.some(c=>names.includes(c.field)))counts[i]!+=1;}
    if(r.fieldChanges.some(c=>c.field==='baselineStartIso'||c.field==='baselineFinishIso'))dates.push(r);
  }
  const rows=categories.map(([category],i)=>({category,activityCount:counts[i]!}));
  // Source date bases are only read for rows whose baseline-named dates changed.
  const before=dates.length?new Map(from.activities.map(a=>[a.activityId,a])):null,after=dates.length?new Map(to.activities.map(a=>[a.activityId,a])):null;
  const basis=(r:typeof dates[number])=>{
    const a=before!.get(r.fromActivityId??'')?.baselineDateBasis,b=after!.get(r.toActivityId??'')?.baselineDateBasis;
    return a==='xer_target_dates'||b==='xer_target_dates'?'source_target':a&&b?'baseline':'date_basis_review';
  };
  const dateCounts:Record<string,number>={baseline:0,source_target:0,date_basis_review:0};
  for(const r of dates)dateCounts[basis(r)]!+=1;
  for(const category of ['baseline','source_target','date_basis_review'])rows.push({category,activityCount:dateCounts[category]!});
  return rows;
}
