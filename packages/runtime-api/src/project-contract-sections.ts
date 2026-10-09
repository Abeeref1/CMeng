import {extractContractLdTerms} from '../../contract-commercial/src';
import type {ProjectRuntimeState} from './project-state-types';
import {projectControlSchedule} from './canonical-time-claims';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';

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
 const rows:Array<{fromSection:string;toSection:string;sourceRefs:string[]}>=[];
 for(const document of state.contractDocuments??[]){
  if(!['main','replacement','amendment'].includes(document.role))continue;
  const evidence=state.evidenceDocuments.find(row=>row.documentId===document.documentId);
  if(evidence&&!['active','additive'].includes(evidence.basisState))continue;
  const fragments=document.result.pdf?.pages.map(page=>({text:page.text,locator:'page:'+page.pageNumber}))??document.result.sections.map(section=>({text:section.text,locator:section.sectionKey}));
  for(const fragment of fragments){
   const text=fragment.text.replace(/\s+/g,' ');
   for(const match of text.matchAll(/\bSection\s+(\d+)(?:\s*\([^)]*\))?[^.;]{0,100}?(?:shall\s+not|must\s+not|cannot)[^.;]{0,100}?\buntil\s+Section\s+(\d+)/gi)){
    if(match[1]===match[2])continue;
    const fromSection=match[2]!,toSection=match[1]!;
    if(!rows.some(row=>row.fromSection===fromSection&&row.toSection===toSection))rows.push({fromSection,toSection,sourceRefs:['evidence-document:'+document.documentId+':'+fragment.locator]});
   }
  }
 }
 return rows;
}

export function projectContractSections(state:ProjectRuntimeState,originalFinish:string|null,extendedFinish:string|null){
  if(!state.contract)return [];
  const terms=extractContractLdTerms(state.contract),model=projectControlSchedule(state)?.revision.model,dependencies=contractCompletionDependencies(state);
  return terms.rateCandidates.filter(rate=>rate.sectionKey?.startsWith('contract-section:')).map(rate=>{
    const label=rate.sectionHeading??'Section '+rate.sectionIdentifier;
    const whole=/(?:whole|entire)\s+(?:of\s+(?:the\s+)?)?works|overall\s+(?:works|project)/i.test(label);
    const activity=sectionCompletionMilestone(model?.activities??[],label);
    const cap=terms.cap?.sectionKey===rate.sectionKey?terms.cap:null;
    return {sectionId:rate.sectionIdentifier,label,rate:rate.amount,rateBasis:rate.basis,currency:rate.currency,
      capAmount:cap?.basis==='fixed_amount'?cap.amount:null,
      capPercent:cap?.percent??(Number(/cap(?:ped)?\s+(?:at|to)\s*(\d+(?:\.\d+)?)\s*%/i.exec(rate.textSnippet)?.[1]??NaN)||null),
      capBasis:cap?.basis==='fixed_amount'?'Explicit monetary cap from contract':/section.*estimated value/i.test(rate.textSnippet)?'Percentage of the section estimated value; section value required':'Percentage of the accepted contract amount',
      contractCompletionIso:whole?originalFinish:null,extendedCompletionIso:whole?extendedFinish:null,
      milestoneId:activity?.activityId??null,programmeCompletionIso:activity?(activity.actualFinishIso??activity.forecastFinishIso??activity.currentFinishIso):null,
      completionDependsOnSectionIds:dependencies.filter(row=>row.toSection===rate.sectionIdentifier).map(row=>row.fromSection),
      authority:'From contract, not yet confirmed',sourceRefs:rate.sourceRefs};
  });
}
