import type {ProjectFactsSnapshot} from './project-facts';

export interface ProjectFactBinding { fact: string; path: string; value: unknown }
type ObjectValue = Record<string, any>;

/** Explicit equivalences only. Historic revisions, sectional dates, filtered
 * populations and currency amounts must never be treated as project totals. */
export function bindProjectFacts<T extends ObjectValue>(key:string, source:T, facts:ProjectFactsSnapshot):T & {projectFacts:ProjectFactsSnapshot;projectFactBindings:ProjectFactBinding[]} {
  let data={...source};
  const bindings:ProjectFactBinding[]=[];
  const at=(object:any,path:string)=>path.split('.').reduce((value,k)=>value?.[k],object);
  const write=(object:any,parts:string[],value:unknown):any=>{
    const [head,...tail]=parts;
    if(!head)return value;
    const next=Array.isArray(object)?[...object]:{...object};
    next[head as any]=tail.length?write(object[head],tail,value):value;return next;
  };
  const bind=(factPath:string,paths:string[])=>{
    const fact=at(facts,factPath);
    for(const path of paths){
      // Absent structures have a separate missing-source meaning.
      if(at(data,path)===undefined)continue;
      data=write(data,path.split('.'),fact.value);
      bindings.push({fact:factPath,path,value:fact.value});
    }
  };
  const schedulePaths:Record<string,Record<string,string[]>>={
    'pmo-analysis':{
      criticalActivityCount:['schedule.criticalCount'],nearCriticalActivityCount:['schedule.nearCriticalCount'],
      negativeFloatActivityCount:['schedule.negativeFloatCount'],submittedProgrammeCompletionIso:['forecast.sourceCompletionIso'],
    },
    'activity-analytics':{criticalActivityCount:['counts.critical.value'],nearCriticalActivityCount:['counts.nearCritical.value'],delayedExecutionActivityCount:['counts.late.value']},
    'schedule-analytics':{
      criticalActivityCount:['result.float.criticalCount'],nearCriticalActivityCount:['result.float.nearCriticalCount'],
      negativeFloatActivityCount:['result.float.negativeFloatCount'],
    },
    'progress-report':{criticalActivityCount:['schedule.criticalCount'],nearCriticalActivityCount:['schedule.nearCriticalCount'],negativeFloatActivityCount:['schedule.negativeFloatCount']},
    'project-director':{criticalActivityCount:['schedule.criticalCount'],nearCriticalActivityCount:['schedule.nearCriticalCount'],submittedProgrammeCompletionIso:['schedule.submittedProgrammeCompletionIso']},
    'near-critical':{nearCriticalActivityCount:['nearCriticalCount'],negativeFloatActivityCount:['negativeFloatCount']},
  };
  for(const [fact,paths] of Object.entries(schedulePaths[key]??{}))bind('schedule.'+fact,paths);
  bind('schedule.criticalActivityCount',['scheduleExceptions.counts.critical.value']);
  bind('schedule.nearCriticalActivityCount',['scheduleExceptions.counts.nearCritical.value']);
  bind('schedule.delayedExecutionActivityCount',['scheduleExceptions.counts.late.value']);
  for(const [fact,field] of Object.entries({criticalActivityCount:'criticalCount',nearCriticalActivityCount:'nearCriticalCount',negativeFloatActivityCount:'negativeFloatCount',delayedOpenActivityCount:'delayedActivityCount'})){
    bind('schedule.'+fact,['visualControl.schedule.'+field,'managementContext.crossModule.programme.'+field]);
  }
  for(const name of ['openRfiCount','overdueRfiCount','openCriticalMajorNcrCount','openRiskCount']){
    bind('controls.'+name,['controls.'+name,'controls.reporting.counts.'+name,'operationalReporting.counts.'+name]);
  }
  bind('commercial.expiredBondCount',['controls.expiredBondCount']);
  bind('time.contractualCompletionIso',['claims.contractualCompletionIso','schedule.contractualCompletionIso']);
  bind('time.extendedContractCompletionIso',['claims.officialAdjustedCompletionIso','schedule.officialAdjustedCompletionIso']);
  for(const base of ['position.contractControls.variations','focus.variationControl']){
    for(const [fact,field] of Object.entries({variationRecordCount:'recordCount',approvedVariationCount:'approvedCount',pendingVariationCount:'pendingCount',rejectedVariationCount:'rejectedCount'}))bind('commercial.'+fact,[base+'.'+field]);
  }
  for(const base of ['position.contractControls.bondsInsurance','focus.bondsInsurance']){
    for(const field of ['activeBondCount','expiredBondCount','activeInsuranceCount','expiredInsuranceCount'])bind('commercial.'+field,[base+'.'+field]);
  }
  for(const base of ['position.claimsNotices.dimensionalEvidenceGaps','focus.dimensionalEvidenceGaps']){
    for(const [fact,field] of Object.entries({eventDateMissingCount:'eventDateMissing',noticeDateMissingCount:'noticeDateMissing',noticeRequirementMissingCount:'requirementMissing'}))bind('claims.'+fact,[base+'.'+field]);
  }
  for(const base of ['position.timeExposure','focus.timeExposure','timeExposure']){
    bind('time.contractualCompletionIso',[base+'.contractualCompletion.value']);
    bind('time.extendedContractCompletionIso',[base+'.officialAdjustedCompletion.value']);
    bind('time.awardedEotDays',[base+'.officialEotDays.value']);
  }
  for(const base of ['position.currencies','focus.currencies','currencies','commercialByCurrency']){
    const rows=at(data,base);if(!Array.isArray(rows))continue;
    rows.forEach((row:any,index:number)=>{
      const factIndex=facts.commercial.currencies.findIndex(f=>f.currency===row.currency);if(factIndex<0)return;
      const group=facts.commercial.currencies[factIndex]!;
      for(const field of Object.keys(group).filter(k=>k!=='currency'))bind('commercial.currencies.'+factIndex+'.'+field,[base+'.'+index+'.'+field+'.value']);
    });
  }
  return {...data,projectFacts:facts,projectFactBindings:bindings} as T & {projectFacts:ProjectFactsSnapshot;projectFactBindings:ProjectFactBinding[]};
}

/** Checks the fields consumed by renderers, not just an attached snapshot. */
export function projectFactConsumerMismatches(data:any):ProjectFactBinding[] {
  const at=(v:any,path:string)=>path.split('.').reduce((x,k)=>x?.[k],v);
  return (data?.projectFactBindings??[]).filter((b:ProjectFactBinding)=>
    !Object.is(at(data,b.path),at(data.projectFacts,b.fact)?.value));
}
