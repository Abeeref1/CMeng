import {extractContractLdTerms} from '../../contract-commercial/src';
import type {ProjectRuntimeState} from './project-state-types';
import {projectControlSchedule} from './canonical-time-claims';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import {contractSourceAnalysis,CONTRACT_SOURCE_ANALYTICAL_NOTE,SOURCE_ANALYTICAL_USE} from './contract-source-analysis';

export function sectionCompletionMilestone(activities:CanonicalScheduleModel['activities'],label:string){
 const whole=/(?:whole|entire)\s+(?:of\s+(?:the\s+)?)?works|overall\s+(?:works|project)/i.test(label);
 const tokens=label.toLowerCase().split(/\W+/).filter(word=>!['section','the','of','and','works','work'].includes(word)&&word.length>2);
 const candidates=activities.filter(activity=>activity.activityType==='finish_milestone'&&(whole
  ?/practical completion|project completion|contractual completion|whole.*works/i.test(activity.name??'')
  :tokens.length>0&&tokens.every(token=>(activity.name??'').toLowerCase().includes(token))));
 const exactScope=candidates.filter(activity=>(activity.name??'').toLowerCase().startsWith(label.toLowerCase()));
 return exactScope.length===1?exactScope[0]!:candidates.length===1?candidates[0]!:null;
}

export function contractCompletionDependencies(state:ProjectRuntimeState){
 const rows:Array<{fromSection:string;toSection:string;sourceRefs:string[];sourceAnalyticalUse?:typeof SOURCE_ANALYTICAL_USE}>=[];
 // T04: the shared source-analytical rule; a dependency read only from an
 // unadopted contract is used and labelled, never as adopted.
 const sources=contractSourceAnalysis(state);
 for(const document of state.contractDocuments??[]){
  if(!['main','replacement','amendment'].includes(document.role))continue;
  if(!sources.eligible(document.documentId,true))continue;
  const unadopted=sources.unadopted(document.documentId);
  const fragments=document.result.pdf?.pages.map(page=>({text:page.text,locator:'page:'+page.pageNumber}))??document.result.sections.map(section=>({text:section.text,locator:section.sectionKey}));
  for(const fragment of fragments){
   const text=fragment.text.replace(/\s+/g,' ');
   for(const match of text.matchAll(/\bSection\s+(\d+)(?:\s*\([^)]*\))?[^.;]{0,100}?(?:shall\s+not|must\s+not|cannot)[^.;]{0,100}?\buntil\s+Section\s+(\d+)/gi)){
    if(match[1]===match[2])continue;
    const fromSection=match[2]!,toSection=match[1]!;
    const prior=rows.find(row=>row.fromSection===fromSection&&row.toSection===toSection);
    // An adopted statement of the same dependency keeps the adopted label.
    if(prior){if(prior.sourceAnalyticalUse&&!unadopted){prior.sourceRefs=['evidence-document:'+document.documentId+':'+fragment.locator];delete prior.sourceAnalyticalUse;}continue;}
    rows.push({fromSection,toSection,sourceRefs:['evidence-document:'+document.documentId+':'+fragment.locator],...(unadopted?{sourceAnalyticalUse:SOURCE_ANALYTICAL_USE}:{})});
   }
  }
 }
 return rows;
}

export function projectContractSections(state:ProjectRuntimeState,originalFinish:string|null,extendedFinish:string|null){
  // T04: with no adopted contract, the unique fully read unadopted main
  // contract (shared rule) is read and every section is labelled.
  const sources=contractSourceAnalysis(state);
  const unadoptedMain=state.contract?[]:(state.contractDocuments??[]).filter(d=>['main','replacement'].includes(d.role)&&sources.unadopted(d.documentId));
  const contract=state.contract??(unadoptedMain.length===1?unadoptedMain[0]!.result:null);
  if(!contract)return [];
  const fromUnadoptedContract=!state.contract;
  const terms=extractContractLdTerms(contract),model=projectControlSchedule(state)?.revision.model,dependencies=contractCompletionDependencies(state);
  return terms.rateCandidates.filter(rate=>rate.sectionKey?.startsWith('contract-section:')).map(rate=>{
    const label=rate.sectionHeading??'Section '+rate.sectionIdentifier;
    const whole=/(?:whole|entire)\s+(?:of\s+(?:the\s+)?)?works|overall\s+(?:works|project)/i.test(label);
    const activity=sectionCompletionMilestone(model?.activities??[],label);
    const cap=terms.cap?.sectionKey===rate.sectionKey?terms.cap:null;
    const section={sectionId:rate.sectionIdentifier,label,rate:rate.amount,rateBasis:rate.basis,currency:rate.currency,
      capAmount:cap?.basis==='fixed_amount'?cap.amount:null,
      capPercent:cap?.percent??(Number(/cap(?:ped)?\s+(?:at|to)\s*(\d+(?:\.\d+)?)\s*%/i.exec(rate.textSnippet)?.[1]??NaN)||null),
      capBasis:cap?.basis==='fixed_amount'?'Explicit monetary cap from contract':/section.*estimated value/i.test(rate.textSnippet)?'Percentage of the section estimated value; section value required':'Percentage of the accepted contract amount',
      contractCompletionIso:whole?originalFinish:null,extendedCompletionIso:whole?extendedFinish:null,
      milestoneId:activity?.activityId??null,programmeCompletionIso:activity?(activity.actualFinishIso??activity.forecastFinishIso??activity.currentFinishIso):null,
      completionDependsOnSectionIds:dependencies.filter(row=>row.toSection===rate.sectionIdentifier).map(row=>row.fromSection),
      authority:fromUnadoptedContract?CONTRACT_SOURCE_ANALYTICAL_NOTE:'From contract, not yet confirmed',sourceRefs:rate.sourceRefs,
      ...(fromUnadoptedContract||dependencies.some(row=>row.toSection===rate.sectionIdentifier&&row.sourceAnalyticalUse)
        ?{sourceAnalyticalUse:SOURCE_ANALYTICAL_USE,sourceAnalyticalNote:fromUnadoptedContract?CONTRACT_SOURCE_ANALYTICAL_NOTE:'Section dependency read from a source that is not formally adopted.'}:{})};
    return {...section,scenario:sectionDelayDamagesScenario(section)};
  });
}

/** Exact same section scenario is supplied to page and report. No determination. */
export function sectionDelayDamagesScenario(section:{extendedCompletionIso:string|null;contractCompletionIso:string|null;programmeCompletionIso:string|null;rate:number|null;rateBasis:string;capAmount:number|null}){
 const due=section.extendedCompletionIso??section.contractCompletionIso,finish=section.programmeCompletionIso;
 const a=due?Date.parse(due.slice(0,10)+'T00:00:00Z'):NaN,b=finish?Date.parse(finish.slice(0,10)+'T00:00:00Z'):NaN;
 const lateDays=Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,Math.round((b-a)/86400000)):null;
 const perDay=typeof section.rate==='number'&&Number.isFinite(section.rate)?section.rateBasis==='fixed_amount_per_day'?section.rate:section.rateBasis==='fixed_amount_per_week'?section.rate/7:null:null;
 const uncapped=lateDays!==null&&perDay!==null?Math.round(lateDays*perDay*100)/100:null;
 const capped=uncapped!==null&&section.capAmount!==null?Math.min(uncapped,section.capAmount):null;
 const missingInputs=[!Number.isFinite(a)?'Section contractual completion date':null,!Number.isFinite(b)?'Linked section forecast milestone':null,perDay===null?'Section daily or weekly damages rate':null,section.capAmount===null?'Section monetary cap basis':null].filter((s):s is string=>s!==null);
 return {state:'scenario' as const,dueIso:due,finishIso:finish,lateDays,uncapped,capped,missingInputs,basis:'Section-specific source scenario; not a determination, certified deduction or agreed entitlement'};
}
