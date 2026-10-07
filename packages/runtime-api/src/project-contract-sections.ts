import {extractContractLdTerms} from '../../contract-commercial/src';
import type {ProjectRuntimeState} from './project-state-types';
import {projectControlSchedule} from './canonical-time-claims';

export function projectContractSections(state:ProjectRuntimeState,originalFinish:string|null,extendedFinish:string|null){
  if(!state.contract)return [];
  const terms=extractContractLdTerms(state.contract),model=projectControlSchedule(state)?.revision.model;
  return terms.rateCandidates.filter(rate=>rate.sectionKey?.startsWith('contract-section:')).map(rate=>{
    const label=rate.sectionHeading??'Section '+rate.sectionIdentifier;
    const whole=/(?:whole|entire)\s+(?:of\s+(?:the\s+)?)?works|overall\s+(?:works|project)/i.test(label);
    const tokens=label.toLowerCase().split(/\W+/).filter(word=>!['section','the','of','and','works','work'].includes(word)&&word.length>2);
    const candidates=(model?.activities??[]).filter(activity=>activity.activityType==='finish_milestone'&&(whole
      ?/practical completion|project completion|whole.*works/i.test(activity.name??'')
      :tokens.length>0&&tokens.every(token=>(activity.name??'').toLowerCase().includes(token))));
    const activity=candidates.length===1?candidates[0]:null;
    const cap=terms.cap?.sectionKey===rate.sectionKey?terms.cap:null;
    return {sectionId:rate.sectionIdentifier,label,rate:rate.amount,rateBasis:rate.basis,currency:rate.currency,
      capAmount:cap?.basis==='fixed_amount'?cap.amount:null,
      capPercent:cap?.percent??(Number(/cap(?:ped)?\s+(?:at|to)\s*(\d+(?:\.\d+)?)\s*%/i.exec(rate.textSnippet)?.[1]??NaN)||null),
      capBasis:cap?.basis==='fixed_amount'?'Explicit monetary cap from contract':/section.*estimated value/i.test(rate.textSnippet)?'Percentage of the section estimated value; section value required':'Percentage of the accepted contract amount',
      contractCompletionIso:whole?originalFinish:null,extendedCompletionIso:whole?extendedFinish:null,
      milestoneId:activity?.activityId??null,programmeCompletionIso:activity?(activity.actualFinishIso??activity.forecastFinishIso??activity.currentFinishIso):null,
      authority:'From contract, not yet confirmed',sourceRefs:rate.sourceRefs};
  });
}
