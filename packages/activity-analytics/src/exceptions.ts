import {parseScheduleInstant} from '../../schedule-cpm/src/calendar';

type ActivityDates = {
  status:string; currentStartIso:string|null; currentFinishIso:string|null;
  forecastStartIso:string|null; forecastFinishIso:string|null;
  actualStartIso:string|null; actualFinishIso:string|null;
};

/** Snapshot lateness, not delay causation. No working-week or baseline is assumed. */
export function activityDateExceptions(row:ActivityDates,dataDateIso:string|null){
  return calculate(row,parseScheduleInstant(dataDateIso),parseScheduleInstant);
}

/** One reader per projection: shared dates are parsed once, never cached across projects/revisions. */
export function activityDateExceptionReader(dataDateIso:string|null){
  const cutoff=parseScheduleInstant(dataDateIso),dates=new Map<string,number|null>();
  const parse=(value:string|null)=>{if(value===null)return null;if(dates.has(value))return dates.get(value)!;const result=parseScheduleInstant(value);dates.set(value,result);return result;};
  return (row:ActivityDates)=>calculate(row,cutoff,parse);
}
function calculate(row:ActivityDates,cutoff:number|null,parse:(value:string|null)=>number|null){
  const start=parse(row.currentStartIso??row.forecastStartIso);
  const finish=parse(row.forecastFinishIso??row.currentFinishIso);
  const actualStart=parse(row.actualStartIso),actualFinish=parse(row.actualFinishIso);
  const conflict=cutoff!==null&&(actualStart!==null&&actualStart>cutoff||actualFinish!==null&&actualFinish>cutoff);
  const completed=row.status==='completed'||actualFinish!==null&&cutoff!==null&&actualFinish<=cutoff;
  const unknown=cutoff===null||conflict||row.status==='unknown';
  const missedPlannedStart=unknown?null:completed||row.status==='in_progress'||actualStart!==null?false:start===null?null:start<cutoff!;
  const finishOverdue=unknown?null:completed?false:finish===null?null:finish<cutoff!;
  const elapsed=(value:number|null,flag:boolean|null)=>flag&&value!==null&&cutoff!==null?Number(((cutoff-value)/86400000).toFixed(6)):flag===false?0:null;
  return {missedPlannedStart,finishOverdue,startOverdueCalendarDays:elapsed(start,missedPlannedStart),finishOverdueCalendarDays:elapsed(finish,finishOverdue)};
}

export function activityDelayStatus(row:{status:string;finishVarianceDays:number|null;missedPlannedStart:boolean|null;finishOverdue:boolean|null}){
  const baselineLate=row.status!=='completed'&&row.finishVarianceDays!==null&&row.finishVarianceDays>0;
  const scheduleDelayed=row.missedPlannedStart===true||row.finishOverdue===true||baselineLate?true:row.missedPlannedStart===null||row.finishOverdue===null?null:false;
  return {scheduleDelayed,delayStatus:[row.missedPlannedStart?'Should have started':'',row.finishOverdue?'Finish overdue':'',baselineLate?'Finishing after baseline':''].filter(Boolean).join('; ')||(scheduleDelayed===null?'Dates or status need review':'No established lateness')};
}
