import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import {classifyScheduleActivity} from './schedule-scope-classification';
import {resolveWorkingCalendar,addWorkingHours} from '../../schedule-cpm/src/calendar';
import type {RecoveryScenario} from './recovery-acceleration';

/** Conditional crew sensitivity: retain source logic and identify exactly which
 * cross-plot FS links are assumed to represent one shared crew. It is a local
 * option for review, not an amendment of the programme or proven project gain. */
export function plotCrewScenarios(model:CanonicalScheduleModel):RecoveryScenario[]{
 if(!model.dataDateIso)return [];
 const activities=new Map(model.activities.map(a=>[a.activityId,a]));
 const members=new Map(model.activities.filter(a=>a.status!=='completed'&&a.activityType==='task').map(a=>[a.activityId,{a,plot:classifyScheduleActivity(model,a).plot,work:(a.name??'').replace(/\bplot\s*[-:#]?\s*[a-z]?\s*\d+[a-z]?\b/gi,' ').replace(/\s+/g,' ').replace(/[-–:]\s*$/,'').trim().toLowerCase()}]));
 const links=model.relationships.filter(r=>{const p=members.get(r.predecessorActivityId),s=members.get(r.successorActivityId);return !r.external&&r.type==='FS'&&r.lagHours===0&&p?.plot&&s?.plot&&p.plot!==s.plot&&p.work&&p.work===s.work;});
 const incoming=new Map<string,typeof links>(),outgoing=new Map<string,typeof links>();
 for(const r of links){incoming.set(r.successorActivityId,[...(incoming.get(r.successorActivityId)??[]),r]);outgoing.set(r.predecessorActivityId,[...(outgoing.get(r.predecessorActivityId)??[]),r]);}
 const scenarios:RecoveryScenario[]=[];
 for(const start of members.values()){
  if(incoming.has(start.a.activityId)||!outgoing.has(start.a.activityId))continue;
  const chain=[start.a],removed:string[]=[];let current=start.a.activityId;
  while(outgoing.get(current)?.length===1){const link=outgoing.get(current)![0]!;if(incoming.get(link.successorActivityId)?.length!==1||chain.some(a=>a.activityId===link.successorActivityId))break;chain.push(members.get(link.successorActivityId)!.a);removed.push(link.relationshipId);current=link.successorActivityId;}
  if(chain.length<2)continue;
  const ids=new Set(chain.map(a=>a.activityId));
  const release=new Map<string,number>();let valid=true;
  for(const a of chain){
   let ready=Date.parse(model.dataDateIso);
   if(!resolveWorkingCalendar(a.calendarId,model.calendars,false)||a.remainingDurationHours===null||a.remainingDurationHours<0||(a.sourceConstraints?.length??0)>0){valid=false;break;}
   for(const r of model.relationships.filter(r=>r.successorActivityId===a.activityId&&!removed.includes(r.relationshipId))){
    const predecessor=activities.get(r.predecessorActivityId),finish=predecessor?.actualFinishIso??predecessor?.forecastFinishIso??predecessor?.currentFinishIso;
    if(r.external||ids.has(r.predecessorActivityId)||r.type!=='FS'||r.lagHours!==0||!finish){valid=false;break;}
    ready=Math.max(ready,Date.parse(finish));
   }
   release.set(a.activityId,ready);
  }
  let baseFinish:number|null=null,parallelFinish:number|null=null;
  if(valid){try{
   let one=Date.parse(model.dataDateIso);const two=[one,one];
   for(const a of chain){const calendar=resolveWorkingCalendar(a.calendarId,model.calendars,false)!.calendar;
    one=addWorkingHours(calendar,Math.max(one,release.get(a.activityId)!),a.remainingDurationHours!);
    const crew=two[0]!<=two[1]!?0:1;two[crew]=addWorkingHours(calendar,Math.max(two[crew]!,release.get(a.activityId)!),a.remainingDurationHours!);
   }baseFinish=one;parallelFinish=Math.max(...two);
  }catch{valid=false;}}
  const days=valid&&baseFinish!==null&&parallelFinish!==null?Math.max(0,Number(((baseFinish-parallelFinish)/86400000).toFixed(2))):null;
  scenarios.push({scenarioId:'plot-crews:'+start.a.activityId,type:'additional_crew',state:days===null?'option_requires_assumption':'calculated',subject:start.work+' · '+chain.length+' plots',affectedActivities:[...ids],affectedPackages:[],
   assumption:'Assume these cross-plot FS links represent one shared crew, and add a second equivalent crew: '+removed.join(', ')+'. Preserve each task duration and source calendar; external predecessor finish dates remain release limits.',
   remainingWorkHours:chain.every(row=>row.remainingDurationHours!==null)?chain.reduce((sum,row)=>sum+row.remainingDurationHours!,0):null,
   sourceWorkingDays:chain.every(row=>row.remainingDurationHours!==null&&resolveWorkingCalendar(row.calendarId,model.calendars,false)?.calendar.standardDayHours)?chain.reduce((sum,row)=>sum+row.remainingDurationHours!/resolveWorkingCalendar(row.calendarId,model.calendars,false)!.calendar.standardDayHours!,0):null,
   currentPosition:baseFinish===null?'The source contains a sequential same-work chain across plots.':'One-crew local finish '+new Date(baseFinish).toISOString().slice(0,10)+'.',
   targetPosition:parallelFinish===null?'Review unresolved constraints, calendars or external relationships before quantifying the option.':'Two-crew local finish '+new Date(parallelFinish).toISOString().slice(0,10)+'.',possibleDaysRecovered:days,
   effectBasis:'Conditional local chain sensitivity. Confirm that the listed links are crew dependencies, not physical prerequisites. Project completion gain requires a full approved network scenario.',
   additionalResources:'One additional equivalent crew with matching plant, supervision and access.',estimatedCost:null,currency:null,costBasis:'No crew rate or acceleration premium has been assumed.',implementationDate:model.dataDateIso,
   constraints:['Both plots must have usable workfronts and materials.','All listed cross-plot links require engineering review before changing programme logic.'],risks:['Shared access, supply or specialist resources can prevent parallel work.'],diminishingReturn:'The result applies to two equivalent crews only; further crews are not extrapolated.',authority:'scenario'});
 }
 return scenarios;
}
