import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import {resolveWorkingCalendar,workingHoursBetween} from '../../schedule-cpm/src/calendar';

/** PMC screening rules, not contractual compliance thresholds. BEI follows
 * GAO-16-89G pp.144/188; technical checks follow its Appendix VII categories.
 * https://www.gao.gov/assets/gao-16-89g.pdf */
export function pmcScheduleRules(model:CanonicalScheduleModel|null,revisions:CanonicalScheduleModel[]=[],requiredFinishIso:string|null=null){
 const execution=model?.activities.filter(a=>!['level_of_effort','wbs_summary'].includes(a.activityType))??[];
 const remaining=execution.filter(a=>a.status!=='completed'),ids=new Set(execution.map(a=>a.activityId));
 const calendars=new Map(model?.calendars.map(c=>[c.calendarId,c])??[]);
 const relations=model?.relationships.filter(r=>!r.external&&ids.has(r.predecessorActivityId)&&ids.has(r.successorActivityId))??[];
 const dayHours=(a:typeof execution[number])=>{const c=calendars.get(a.calendarId??'');return c?.standardDayHours&&c.standardDayHours>0?c.standardDayHours:null;};
 const report=(key:string,label:string,rows:typeof execution,population:number,basis:string)=>({key,label,count:model?rows.length:null,population:model?population:null,percent:model&&population?rows.length/population*100:null,activityIds:rows.map(a=>a.activityId),basis});
 const checks=[
  report('constraints','Source constraints',remaining.filter(a=>a.sourceConstraints?.length),remaining.length,'All retained source constraint types and dates; review justification.'),
  report('hard_constraints','Mandatory constraints',remaining.filter(a=>a.sourceConstraints?.some(c=>/mandatory|must|^(CS_MSO|CS_MEO|CS_MFO)$/.test(c.type))),remaining.length,'Mandatory start/finish constraints can override normal schedule logic.'),
  report('high_float','High float',remaining.filter(a=>dayHours(a)!==null&&a.totalFloatHours!==null&&a.totalFloatHours/dayHours(a)!>44),remaining.length,'Source total float exceeds 44 activity-calendar working days; CMeng screening threshold.'),
  report('negative_float','Negative float',remaining.filter(a=>a.totalFloatHours!==null&&a.totalFloatHours<0),remaining.length,'Remaining execution activities with total float below zero.'),
  report('high_duration','Long remaining duration',remaining.filter(a=>dayHours(a)!==null&&a.remainingDurationHours!==null&&a.remainingDurationHours/dayHours(a)!>44),remaining.length,'Remaining duration exceeds 44 activity-calendar working days; CMeng screening threshold.'),
  report('calendar','Unreadable or missing calendar',remaining.filter(a=>!model||!resolveWorkingCalendar(a.calendarId,model.calendars,false)),remaining.length,'Each remaining execution activity requires an explicit readable working calendar.'),
  report('float_missing','Missing float on remaining work',remaining.filter(a=>a.totalFloatHours===null),remaining.length,'Completed work is excluded from the missing-float population.'),
  report('duration_day_basis_missing','Unresolved working-day conversion',remaining.filter(a=>dayHours(a)===null),remaining.length,'High-float and duration checks cannot convert hours to days for these rows.'),
  report('invalid_dates','Invalid activity dates',execution.filter(a=>
   a.baselineStartIso&&a.baselineFinishIso&&a.baselineStartIso>a.baselineFinishIso||
   a.actualStartIso&&a.actualFinishIso&&a.actualStartIso>a.actualFinishIso||
   model?.dataDateIso&&((a.actualStartIso&&a.actualStartIso.slice(0,10)>model.dataDateIso.slice(0,10))||(a.actualFinishIso&&a.actualFinishIso.slice(0,10)>model.dataDateIso.slice(0,10)))),execution.length,'Start after finish, or an actual date later than the programme Data Date.'),
 ];
 const relationships=['FS','SS','FF','SF','unknown'].map(type=>({type,count:relations.filter(r=>r.type===type).length,relationshipIds:relations.filter(r=>r.type===type).map(r=>r.relationshipId)}));
 const lagRows=(predicate:(hours:number)=>boolean)=>relations.filter(r=>r.lagHours!==null&&predicate(r.lagHours)).map(r=>({relationshipId:r.relationshipId,predecessor:r.predecessorActivityId,successor:r.successorActivityId,type:r.type,lagHours:r.lagHours}));
 const detail=execution.filter(a=>a.activityType==='task'),cutoff=model?.dataDateIso?.slice(0,10)??null;
 const baselineKnown=detail.filter(a=>a.baselineFinishIso&&a.baselineDateBasis!=='xer_target_dates');
 const planned=baselineKnown.filter(a=>cutoff&&a.baselineFinishIso!.slice(0,10)<=cutoff);
 const completed=baselineKnown.filter(a=>cutoff&&a.actualFinishIso&&a.actualFinishIso.slice(0,10)<=cutoff);
 const baselineComplete=detail.length>0&&baselineKnown.length===detail.length;
 const unknownActual=detail.filter(a=>a.status==='completed'&&!a.actualFinishIso).map(a=>a.activityId);
 const bei={value:cutoff&&baselineComplete&&!unknownActual.length&&planned.length?completed.length/planned.length:null,completed:completed.length,planned:planned.length,
  missingBaselineActivityIds:detail.filter(a=>!baselineKnown.includes(a)).map(a=>a.activityId),missingActualFinishActivityIds:unknownActual,
  basis:'Actual completed detail activities divided by detail activities due to finish under the adopted baseline at the Data Date; milestone and summary records excluded.'};
 const dated=[...new Set(revisions.map(r=>r.dataDateIso?.slice(0,10)).filter((v):v is string=>!!v))].sort();
 const updateGaps=dated.slice(1).map((to,i)=>({from:dated[i]!,to,calendarDays:Math.round((Date.parse(to)-Date.parse(dated[i]!))/86400000)})).filter(g=>g.calendarDays>45);
 // CPLI is kept on the terminal activity's working calendar. Do not mix elapsed
 // days with source working float or select an arbitrary calendar for tied ends.
 const finishes=remaining.flatMap(a=>{const finish=a.forecastFinishIso??a.currentFinishIso;return finish?[{activity:a,finish}]:[];}).sort((a,b)=>b.finish.localeCompare(a.finish));
 const latest=finishes[0],terminals=finishes.filter(a=>a.finish===latest?.finish),calendarIds=new Set(terminals.map(a=>a.activity.calendarId));
 let length:number|null=null,float:number|null=null;
 const calendar=model&&latest&&calendarIds.size===1?resolveWorkingCalendar(latest.activity.calendarId,model.calendars,false)?.calendar:null;
 if(calendar&&cutoff&&latest&&requiredFinishIso){try{length=workingHoursBetween(calendar,Date.parse(cutoff),Date.parse(latest.finish));float=workingHoursBetween(calendar,Date.parse(latest.finish),Date.parse(requiredFinishIso.slice(0,10)+'T23:59:59Z'));}catch{length=null;float=null;}}
 const cpli={value:length!==null&&length>0&&float!==null?(length+float)/length:null,remainingWorkingHours:length,totalFloatWorkingHours:float,finishActivityIds:terminals.map(t=>t.activity.activityId),requiredFinishIso,
  basis:'Submitted finish CPLI = (remaining working time to the terminal finish + working time from that finish to the required date) / remaining working time. Uses one explicit terminal calendar; this source-programme indicator does not certify the independent driving path.'};
 return {state:model?'calculated':'missing',dataDateIso:cutoff,remainingActivityCount:model?remaining.length:null,checks,relationships,relationshipCount:model?relations.length:null,
  positiveLags:lagRows(h=>h>0),negativeLags:lagRows(h=>h<0),unknownLagRelationshipIds:relations.filter(r=>r.lagHours===null).map(r=>r.relationshipId),bei,cpli,updateGaps,
  basis:'Screening results identify records to review. They are not contractual acceptance rules. Thresholds: 44 working days for high float/duration; 45 calendar days between updates.'};
}
