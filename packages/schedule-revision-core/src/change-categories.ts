import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ScheduleActivityChange} from './types';

/** A field named baseline does not prove a controlled baseline changed. XER
 * target dates are current planning fields; missing provenance requires review. */
export function classifyScheduleChanges(changes:readonly Pick<ScheduleActivityChange,'fromActivityId'|'toActivityId'|'fieldChanges'>[],from:CanonicalScheduleModel,to:CanonicalScheduleModel){
  const before=new Map(from.activities.map(a=>[a.activityId,a])),after=new Map(to.activities.map(a=>[a.activityId,a]));
  const fields:Record<string,string[]>={
    structural:['activityType','wbsId','calendarId','originalDurationHours'],
    forecast:['currentStartIso','currentFinishIso','forecastStartIso','forecastFinishIso','totalFloatHours','freeFloatHours'],
    progress:['status','actualStartIso','actualFinishIso','remainingDurationHours','percentComplete'],metadata:['name'],
  };
  const rows=Object.entries(fields).map(([category,names])=>({category,activityCount:changes.filter(r=>r.fieldChanges.some(c=>names.includes(c.field))).length}));
  const dates=changes.filter(r=>r.fieldChanges.some(c=>['baselineStartIso','baselineFinishIso'].includes(c.field)));
  const basis=(r:typeof dates[number])=>{
    const a=before.get(r.fromActivityId??'')?.baselineDateBasis,b=after.get(r.toActivityId??'')?.baselineDateBasis;
    return a==='xer_target_dates'||b==='xer_target_dates'?'source_target':a&&b?'baseline':'date_basis_review';
  };
  for(const category of ['baseline','source_target','date_basis_review'])rows.push({category,activityCount:dates.filter(r=>basis(r)===category).length});
  return rows;
}
