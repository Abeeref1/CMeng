import type {CanonicalScheduleModel,CanonicalCalendar} from '../../schedule-analysis-core/src';
import {activityNearCriticalThresholdHours,DEFAULT_SCHEDULE_ANALYSIS_CONFIG} from '../../schedule-analysis-core/src';
import {calculateCpm} from '../../schedule-cpm/src/engine';
import {workingHoursBetween,resolveWorkingCalendar} from '../../schedule-cpm/src/calendar';
import type {RecoveryScenario} from './recovery-acceleration';

/** The programme change a scenario makes, expressed so CMeng's CPM can run it. */
export interface RecoveryCpmChange {
  removeRelationshipIds:string[];
  addRelationships:Array<{predecessorActivityId:string;successorActivityId:string}>;
  /** Remaining duration of each listed activity multiplied by the stated factor (crew or shift ratio). */
  durationScale?:Array<{activityId:string;factor:number}>;
}
type ForecastView={complete:boolean;drivingNetwork?:{activityIds:string[];finishActivityIds?:string[]}|undefined;activities:Array<{activityId:string;independentTotalFloatHours:number|null}>};

// Each extra full-network CPM run costs as much as the forecast itself. Runs
// beyond this bound are reported as not established, never estimated.
export const RECOVERY_CPM_RUN_LIMIT=12;
const runCache=new WeakMap<CanonicalScheduleModel,Map<string,string|null>>();
function cpmFinish(model:CanonicalScheduleModel,change:RecoveryCpmChange|null):string|null{
  const key=JSON.stringify(change);let cache=runCache.get(model);if(!cache){cache=new Map();runCache.set(model,cache);}
  if(cache.has(key))return cache.get(key)!;
  let finish:string|null=null;
  try{
    let run=model;
    if(change){
      const scale=new Map((change.durationScale??[]).map(row=>[row.activityId,row.factor]));
      for(const [id,factor] of scale){const activity=model.activities.find(a=>a.activityId===id);
        if(!activity||typeof activity.remainingDurationHours!=='number'||!Number.isFinite(factor)||factor<=0||factor>1)throw new Error('duration scale not applicable');}
      const removed=new Set(change.removeRelationshipIds);
      const template=model.relationships.find(r=>removed.has(r.relationshipId))??null;
      if(change.addRelationships.length&&!template)throw new Error('no relationship template');
      run={...model,activities:scale.size?model.activities.map(a=>scale.has(a.activityId)?{...a,remainingDurationHours:Number((a.remainingDurationHours!*scale.get(a.activityId)!).toFixed(6))}:a):model.activities,relationships:[...model.relationships.filter(r=>!removed.has(r.relationshipId)),
        ...change.addRelationships.map((link,index)=>({...template!,relationshipId:'recovery-scenario:'+index+':'+link.predecessorActivityId+'>'+link.successorActivityId,
          predecessorActivityId:link.predecessorActivityId,successorActivityId:link.successorActivityId,type:'FS' as const,lagHours:0,external:false,diagnostics:[]}))]};
    }
    const result=calculateCpm(run,{durationBasis:'remaining'});
    finish=result.complete?result.projectFinishIso:null;
  }catch{finish=null;}
  cache.set(key,finish);return finish;
}

/**
 * SW-24: a recovery option is an action on the completion-driving path
 * (driving network or near-critical CPM float) whose completion effect is a
 * CMeng CPM run of the changed programme against the unchanged one. Late items
 * off that path are late work, not recovery; path membership that cannot be
 * shown stays "not established". Local days are kept separately and never
 * relabelled as a completion gain.
 */
export function classifyRecoveryAgainstCompletion(
  scenarios:RecoveryScenario[],
  programme:CanonicalScheduleModel|null,
  forecast:ForecastView|null,
  completionCalendar:CanonicalCalendar|null,
){
  const complete=!!programme&&!!forecast?.complete&&!!forecast.drivingNetwork;
  const driving=new Set(complete?forecast!.drivingNetwork!.activityIds:[]);
  const floatById=new Map((complete?forecast!.activities:[]).map(row=>[row.activityId,row.independentTotalFloatHours]));
  const activityById=new Map((programme?.activities??[]).map(a=>[a.activityId,a]));
  const calendarById=new Map((programme?.calendars??[]).map(c=>[c.calendarId,c]));
  const nearCritical=(id:string):boolean|null=>{
    const activity=activityById.get(id),float=floatById.get(id);
    if(!activity||float===null||float===undefined)return null;
    const threshold=activityNearCriticalThresholdHours(programme!,activity,DEFAULT_SCHEDULE_ANALYSIS_CONFIG,calendarById);
    return threshold===null?null:float<=threshold;
  };
  // The gain is counted on the completion milestone calendar. Where the
  // programme has no single completion milestone, the project finish is the
  // CPM finish activity's, so its source calendar is the completion calendar
  // when every CPM finish activity shares it. Day hours come from that source
  // calendar only; none are assumed.
  const finishIds=complete?forecast!.drivingNetwork!.finishActivityIds??[]:[];
  const finishCalendarIds=[...new Set(finishIds.map(id=>activityById.get(id)?.calendarId??null))];
  const finishCalendar=!completionCalendar&&finishIds.length&&finishCalendarIds.length===1&&finishCalendarIds[0]!==null
    ?resolveWorkingCalendar(finishCalendarIds[0],programme!.calendars,false)?.calendar??null:null;
  const gainCalendar=completionCalendar??finishCalendar;
  const gainCalendarLabel=completionCalendar?'completion milestone calendar':'calendar '+(finishCalendar?.calendarId??'')+' of the CPM finish activity';
  let runs=0;const baseline=()=>programme?cpmFinish(programme,null):null;
  for(const scenario of scenarios){
    const ids=scenario.affectedActivities;
    const onDriving=ids.filter(id=>driving.has(id)),near=ids.map(id=>[id,complete?nearCritical(id):null] as const);
    const onPath=onDriving.length>0||near.some(([,value])=>value===true);
    const offPath=complete&&ids.length>0&&!onPath&&near.every(([,value])=>value===false);
    scenario.pathRole=onPath?'recovery_option':offPath?'late_work':'path_not_established';
    scenario.pathBasis=onPath
      ?(onDriving.length?'On the CMeng CPM completion-driving network: '+onDriving.slice(0,5).join(', ')+'.':'Near-critical in the CMeng CPM run (total float within the near-critical threshold): '+near.filter(([,v])=>v===true).map(([id])=>id).slice(0,5).join(', ')+'.')
      :offPath?'Not on the CMeng CPM completion-driving network and every linked activity has CPM total float above the near-critical threshold. This is late work, not completion recovery.'
        :!complete?'The CMeng CPM run is not complete, so the path to completion cannot be shown for this item.'
          :!ids.length?'No programme activity is linked, so the path to completion cannot be shown for this item.'
            :'CPM float or the near-critical threshold is not established for a linked activity, so the path to completion cannot be shown.';
    scenario.completionGainWorkingDays=null;
    if(scenario.pathRole!=='recovery_option'){scenario.completionGainBasis='Not a recovery option on the path to completion; no completion gain is claimed.';continue;}
    const change=scenario.cpmChange??null;
    if(!change){scenario.completionGainBasis='Not established: this option is not expressed as a programme change that CMeng\'s CPM can run.';continue;}
    if(!gainCalendar?.standardDayHours){scenario.completionGainBasis='Not established: neither the completion milestone calendar nor one shared CPM finish-activity calendar with stated working-day hours is established.';continue;}
    if(runs>=RECOVERY_CPM_RUN_LIMIT){scenario.completionGainBasis='Not established: CPM scenario run limit ('+RECOVERY_CPM_RUN_LIMIT+') reached for this view.';continue;}
    runs++;
    const before=baseline(),after=cpmFinish(programme!,change);
    if(!before||!after){scenario.completionGainBasis='Not established: the CMeng CPM run did not produce a complete project finish.';continue;}
    try{
      const a=Date.parse(after),b=Date.parse(before);
      const hours=a<=b?workingHoursBetween(gainCalendar,a,b):-workingHoursBetween(gainCalendar,b,a);
      scenario.completionGainWorkingDays=Number((hours/gainCalendar.standardDayHours).toFixed(2));
      scenario.completionGainBasis='CMeng CPM run with the scenario change ('+change.removeRelationshipIds.length+' link(s) removed, '+change.addRelationships.length+' added'+(change.durationScale?.length?', remaining duration of '+change.durationScale.map(row=>row.activityId+' × '+Number(row.factor.toFixed(6))).slice(0,5).join(', '):'')+'): project finish '+after.slice(0,10)+' against '+before.slice(0,10)+' unchanged, in working days of the '+gainCalendarLabel+'.';
    }catch{scenario.completionGainBasis='Not established: working time between the two CPM finishes could not be measured on the completion calendar.';}
  }
  return {recoveryOptionCount:scenarios.filter(s=>s.pathRole==='recovery_option').length,
    lateWorkCount:scenarios.filter(s=>s.pathRole==='late_work').length,
    pathNotEstablishedCount:scenarios.filter(s=>s.pathRole==='path_not_established').length,
    cpmScenarioRuns:runs};
}
