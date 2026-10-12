import type {CanonicalScheduleActivity} from '../../schedule-analysis-core/src';
import {parseScheduleInstant} from './calendar';

// P6 constraint names and XER codes, per Oracle's P6 constraint and data-map
// documentation. Date bounds are applied in the activity's working calendar.
export type ConstraintKind='start_on'|'start_before'|'start_after'|'finish_on'|'finish_before'|'finish_after'|'mandatory_start'|'mandatory_finish'|'alap'|'asap';
const kinds:Record<string,ConstraintKind>={
 CS_MSO:'start_on',CS_MSOB:'start_before',CS_MSOA:'start_after',
 CS_MEO:'finish_on',CS_MEOB:'finish_before',CS_MEOA:'finish_after',
 CS_MANDSTART:'mandatory_start',CS_MANDFIN:'mandatory_finish',CS_ALAP:'alap',CS_ASAP:'asap',
 START_ON:'start_on',START_ON_OR_BEFORE:'start_before',START_ON_OR_AFTER:'start_after',
 FINISH_ON:'finish_on',FINISH_ON_OR_BEFORE:'finish_before',FINISH_ON_OR_AFTER:'finish_after',
 MANDATORY_START:'mandatory_start',MANDATORY_FINISH:'mandatory_finish',AS_LATE_AS_POSSIBLE:'alap',AS_SOON_AS_POSSIBLE:'asap',
};
export function activityConstraints(activity:CanonicalScheduleActivity){
 const diagnostics:string[]=[];
 const constraints=(activity.sourceConstraints??[]).flatMap(source=>{
  const kind=kinds[source.type.trim().toUpperCase().replace(/[ -]+/g,'_')];
  if(!kind){diagnostics.push('CPM_CONSTRAINT_TYPE_UNSUPPORTED:'+source.type);return [];}
  const date=parseScheduleInstant(source.dateIso);
  if(date===null&&!['alap','asap'].includes(kind)){diagnostics.push('CPM_CONSTRAINT_DATE_MISSING:'+source.type);return [];}
  return [{kind,date}];
 });
 return {constraints,diagnostics};
}
