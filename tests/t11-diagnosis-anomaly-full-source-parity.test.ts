import test from 'node:test';
import assert from 'node:assert/strict';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import type {ActivityAnalyticsRow} from '../packages/activity-analytics/src/types';
import {diagnosisSourceAnomalies} from '../packages/runtime-api/src/project-diagnosis';

type Input=Pick<CanonicalScheduleModel,'activities'|'calendars'>;
// Independent scalar oracle is the exact former eight complete-population
// filters and first-source-calendar rule; no new producer is consulted.
function original(model:Input,rows:readonly ActivityAnalyticsRow[],diagnostics:readonly string[]){
 const calendarsById=new Map<string,CanonicalScheduleModel['calendars'][number]>();
 for(const calendar of model.calendars)if(!calendarsById.has(calendar.calendarId))calendarsById.set(calendar.calendarId,calendar);
 const numeric=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
 return {constraints:model.activities.filter(a=>a.sourceConstraints?.length).length,
  openStarts:rows.filter(r=>r.openStart).length,openFinishes:rows.filter(r=>r.openFinish).length,
  isolated:rows.filter(r=>r.isolated).length,
  unresolvedCalendars:rows.filter(r=>!calendarsById.get(r.calendarId??'')?.semanticComplete).length,
  remainingDuration:rows.filter(r=>numeric(r.remainingDurationHours)&&(r.remainingDurationHours<0||r.status==='completed'&&r.remainingDurationHours>0)).length,
  progress:rows.filter(r=>numeric(r.percentComplete)&&(r.percentComplete<0||r.percentComplete>100||r.status==='not_started'&&r.percentComplete>0||r.status==='completed'&&r.percentComplete<100)).length,
  unknownStatus:rows.filter(r=>r.status==='unknown').length,networkDiagnostics:diagnostics};
}
const source=(site:string,size:number,firstComplete:boolean)=>{
 const model={
  activities:Array.from({length:size+7},(_,i)=>({
    activityId:site+'-'+i,sourceConstraints:i%13===0?[{type:'finish_no_later_than',dateIso:null}]:[],
  })),
  calendars:[
   {calendarId:'DUPLICATE',semanticComplete:firstComplete},
   {calendarId:'DUPLICATE',semanticComplete:!firstComplete},
   {calendarId:'COMPLETE',semanticComplete:true},
   {calendarId:'UNRESOLVED',semanticComplete:false},
  ],
 } as unknown as Input;
 const rows=Array.from({length:size},(_,i)=>({
   activityId:site+'-'+i,
   calendarId:i%7===0?'MISSING':i%5===0?'UNRESOLVED':i%3===0?'COMPLETE':'DUPLICATE',
   status:i%31===0?'unknown':i%17===0?'completed':i%11===0?'not_started':'in_progress',
   openStart:i%3===0,openFinish:i%5===0,isolated:i%7===0,
   remainingDurationHours:i%19===0?null:i%23===0?Number.NaN:i%37===0?-3:i%17===0?8:0,
   percentComplete:i%29===0?null:i%41===0?Number.NaN:i%17===0?75:i%11===0?15:0,
 })) as unknown as ActivityAnalyticsRow[];
 return {model,rows};
};

test('T11 complete certified diagnosis anomaly predicates retain full source and first calendar precedence',()=>{
 for(const [site,size,first] of [['A',13007,true],['B',8107,false],['EMPTY',0,true],['ONE',1,false]] as const){
  const {model,rows}=source(site,size,first),diagnostics=['CALENDAR_INPUT_REVIEW','SOURCE_MISSING'];
  const before=JSON.stringify(model)+'|'+JSON.stringify(rows);
  const actual=diagnosisSourceAnomalies(model,rows,diagnostics);
  assert.deepEqual(actual,original(model,rows,diagnostics),site+' independent eight original predicates');
  assert.equal(actual.networkDiagnostics,diagnostics,'retained original diagnostic evidence and identity');
  assert.equal(JSON.stringify(model)+'|'+JSON.stringify(rows),before,'no source activity or calendar mutation');
  assert.deepEqual(diagnosisSourceAnomalies(model,rows,diagnostics),actual,'cold and repeated same-source reads');
  assert.equal(actual.constraints,model.activities.filter(a=>a.sourceConstraints?.length).length,
    'all source constraints including rows excluded from execution analyses');
 }
 const one=source('DUP',4,true),two=source('DUP',4,false);
 assert.notEqual(diagnosisSourceAnomalies(one.model,one.rows).unresolvedCalendars,
   diagnosisSourceAnomalies(two.model,two.rows).unresolvedCalendars,
   'first duplicate calendar is authoritative for analysis; neither duplicate definition is erased');
});
