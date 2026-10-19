import {extractContractLdTerms} from '../../contract-commercial/src';
import {dateValue} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';
import {canonicalTimeClaims,projectControlSchedule} from './canonical-time-claims';
import {commencementDatePosition,completionFromStatedPeriod,contractDayDefinition,contractDocumentTexts,contractSourceName,governingCompletionFrom,sectionTimeForCompletion} from './contract-time-reader';
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

/** F34: the completion date and monetary cap a contract states for one section.
 * Only an explicit calendar date ("Section 1 Completion Date / Time for
 * Completion / Taking-Over <date>") is read; a duration or competing dates stay
 * unknown. A cap is read only as an explicit amount in the section's own LD
 * wording and its currency; a percentage of an unstated value stays unknown. */
export function sectionStatedTerms(contract:{sections:Array<{text:string}>;pdf?:{pages:Array<{method?:string;text:string}>}|undefined|null},sectionId:string,ldText:string,currency:string|null){
 const texts=[...(contract.pdf?.pages??[]).filter(page=>page.method==='native').map(page=>page.text),...contract.sections.map(section=>section.text)];
 const id=sectionId.replace(/[^0-9A-Za-z]/g,'');
 const datePattern=new RegExp('\\bSection\\s+'+id+'\\b\\s*[:\\-\u2013]?\\s*(?:Completion\\s+Date|Date\\s+for\\s+Completion|Time\\s+for\\s+Completion|Taking[- ]Over(?:\\s+Date)?)\\s*[:\\-\u2013]?\\s*([^\\n;]+)','gi');
 const dates=new Set<string>();let unreadable=false;
 if(id)for(const text of texts)for(const match of text.matchAll(datePattern)){const raw=match[1]!.trim().replace(/[.,]+$/,'');const iso=dateValue(raw)??dateValue((/^(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/.exec(raw)??[''])[0]!);if(iso)dates.add(iso);else unreadable=true;}
 const flat=ldText.replace(/\s+/g,' ');
 const cap=/cap(?:ped)?\s+(?:at|to)\b[^.;]*?\(\s*([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s*\)/.exec(flat)??/cap(?:ped)?\s+(?:at|to)\s+([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\b/.exec(flat);
 const capAmount=cap&&(!currency||cap[1]!.toUpperCase()===currency.toUpperCase())?Number(cap[2]!.replace(/,/g,'')):null;
 return {completionIso:dates.size===1&&!unreadable?[...dates][0]!:null,completionDateConflict:dates.size>1,capAmount:capAmount!==null&&Number.isFinite(capAmount)?capAmount:null};
}

/** F34: a section's own contract date, its basis or the reason it is unknown,
 * the EOT awarded for that section, and its governing date by the same rule as
 * the Works (contract date + awarded EOT; unknown while an award exists but the
 * extended date is not established). worksGoverningIso is the Works governing
 * date (time.governingContractCompletionIso), used for the whole-of-Works section. */
export function projectContractSections(state:ProjectRuntimeState,originalFinish:string|null,extendedFinish:string|null,worksGoverningIso?:string|null){
  // T04: with no adopted contract, the unique fully read unadopted main
  // contract (shared rule) is read and every section is labelled.
  const sources=contractSourceAnalysis(state);
  const unadoptedMain=state.contract?[]:(state.contractDocuments??[]).filter(d=>['main','replacement'].includes(d.role)&&sources.unadopted(d.documentId));
  const contract=state.contract??(unadoptedMain.length===1?unadoptedMain[0]!.result:null);
  if(!contract)return [];
  const fromUnadoptedContract=!state.contract;
  const terms=extractContractLdTerms(contract),model=projectControlSchedule(state)?.revision.model,dependencies=contractCompletionDependencies(state);
  const contractDocumentId=(fromUnadoptedContract?unadoptedMain[0]!.documentId:(state.contractDocuments??[]).find(document=>document.result===contract)?.documentId)??'contract';
  const timeClaims=canonicalTimeClaims(state),worksPeriod=timeClaims.contractTimeBasis?.contractualCompletionPeriod??null,sectionalAwards=timeClaims.sectionalDeterminations??[];
  // The contract's day definition is read only when a period or a section award needs it.
  let dayDefinitionRead:ReturnType<typeof contractDayDefinition>|undefined;
  const dayDefinition=()=>dayDefinitionRead===undefined?(dayDefinitionRead=contractDayDefinition(contractDocumentTexts(contract))):dayDefinitionRead;
  return terms.rateCandidates.filter(rate=>rate.sectionKey?.startsWith('contract-section:')).map(rate=>{
    const label=rate.sectionHeading??'Section '+rate.sectionIdentifier;
    const whole=/(?:whole|entire)\s+(?:of\s+(?:the\s+)?)?works|overall\s+(?:works|project)/i.test(label);
    const activity=sectionCompletionMilestone(model?.activities??[],label);
    const cap=terms.cap?.sectionKey===rate.sectionKey?terms.cap:null;
    const stated=sectionStatedTerms(contract,rate.sectionIdentifier??'',rate.textSnippet,rate.currency);
    // F34: a section Time for Completion stated as a period counted from the
    // Commencement Date gives Commencement Date + the period (shared reader).
    const periods=whole||stated.completionIso||stated.completionDateConflict?[]:sectionTimeForCompletion(contract,rate.sectionIdentifier??'',contractDocumentId,fromUnadoptedContract,contractSourceName(state,contractDocumentId));
    const fromPeriod=periods.length?completionFromStatedPeriod('Section '+rate.sectionIdentifier,periods,commencementDatePosition(state),dayDefinition()):null;
    const contractCompletionIso=whole?(originalFinish??stated.completionIso):(stated.completionIso??fromPeriod?.dateIso??null);
    const completionBasis=contractCompletionIso===null?null:whole&&originalFinish?(worksPeriod?.label??'Contract completion of the Works'):stated.completionIso?'Completion date stated in the contract for this section':fromPeriod?.basis??null;
    const completionReason=contractCompletionIso!==null?null:whole?(worksPeriod?.reason??'The Works completion date is not established.')
      :stated.completionDateConflict?'Different completion dates are stated for this section; the date stays unknown.':fromPeriod?.reason??'No completion date or Time for Completion is stated for this section.';
    // An EOT stated for this section extends this section only.
    const award=whole?null:sectionalAwards.find(row=>row.sectionId===rate.sectionIdentifier||row.sectionId.toLowerCase()===label.toLowerCase())??null;
    const awardedEotDays=award?award.awardedDays:null;
    const sectionExtended=!whole&&award&&awardedEotDays!==null&&awardedEotDays>0&&contractCompletionIso&&dayDefinition()!=='working'
      ?new Date(Date.parse(contractCompletionIso.slice(0,10)+'T00:00:00Z')+awardedEotDays*86400000).toISOString().slice(0,10):null;
    // The whole-of-Works section uses the Works governing date when the Works date
    // is established; otherwise its own stated date, as before.
    const governingCompletionIso=whole?(originalFinish!==null&&worksGoverningIso!==undefined?worksGoverningIso:(extendedFinish??contractCompletionIso))
      :award&&awardedEotDays===null?null:governingCompletionFrom(contractCompletionIso,awardedEotDays,sectionExtended);
    const governingBasis=whole?(governingCompletionIso?(originalFinish!==null&&worksGoverningIso!==undefined?'The Works governing date (contract completion including any awarded EOT for the Works).':extendedFinish?'Section contract date including the awarded EOT for the Works.':'Section contract date; no awarded EOT is applied.'):'The Works governing date is not established.')
      :governingCompletionIso===null?(contractCompletionIso===null?completionReason:award&&awardedEotDays===null?'The awarded EOT for this section is not established; the section date stays unknown.':'An EOT of '+awardedEotDays+' days is awarded for this section'+(dayDefinition()==='working'?' and the contract defines a day as a working day; the extended date stays unknown.':', but the extended date is not established.'))
      :sectionExtended?'Section contract date '+contractCompletionIso+' + '+awardedEotDays+' days EOT awarded for this section ('+award!.determinationIds.join(', ')+'), '+(dayDefinition()==='calendar'?'calendar days.':'calendar days assumed; the contract does not define a day.')
      :'Section contract date; no EOT is awarded for this section.';
    const section={sectionId:rate.sectionIdentifier,label,rate:rate.amount,rateBasis:rate.basis,currency:rate.currency,
      capAmount:cap?.basis==='fixed_amount'?cap.amount:stated.capAmount,
      capPercent:cap?.percent??(Number(/cap(?:ped)?\s+(?:at|to)\s*(\d+(?:\.\d+)?)\s*%/i.exec(rate.textSnippet)?.[1]??NaN)||null),
      capBasis:cap?.basis==='fixed_amount'?'Explicit monetary cap from contract':/section.*estimated value/i.test(rate.textSnippet)?'Percentage of the section estimated value; section value required':'Percentage of the accepted contract amount',
      // The whole-of-Works section keeps the contract completion; every other
      // section uses only the date the contract states for that section.
      contractCompletionIso,extendedCompletionIso:whole?extendedFinish:sectionExtended,
      completionBasis,completionReason,awardedEotDays,governingCompletionIso,governingBasis,
      milestoneId:activity?.activityId??null,programmeCompletionIso:activity?(activity.actualFinishIso??activity.forecastFinishIso??activity.currentFinishIso):null,
      completionDependsOnSectionIds:dependencies.filter(row=>row.toSection===rate.sectionIdentifier).map(row=>row.fromSection),
      authority:fromUnadoptedContract?CONTRACT_SOURCE_ANALYTICAL_NOTE:'From contract, not yet confirmed',sourceRefs:[...rate.sourceRefs,...(fromPeriod?.dateIso?fromPeriod.sourceRefs:[]),...(award?.sourceRefs??[])],
      ...(fromUnadoptedContract||dependencies.some(row=>row.toSection===rate.sectionIdentifier&&row.sourceAnalyticalUse)||(fromPeriod?.dateIso&&fromPeriod.sourceAnalytical)
        ?{sourceAnalyticalUse:SOURCE_ANALYTICAL_USE,sourceAnalyticalNote:fromUnadoptedContract?CONTRACT_SOURCE_ANALYTICAL_NOTE:fromPeriod?.dateIso&&fromPeriod.sourceAnalytical?'Section completion computed from a Commencement Date read from a source that is not formally adopted.':'Section dependency read from a source that is not formally adopted.'}:{})};
    return {...section,scenario:sectionDelayDamagesScenario(section)};
  });
}

/** Exact same section scenario is supplied to page and report. No determination.
 * F34: a section's governing date (shared rule), when given, is the due date. */
export function sectionDelayDamagesScenario(section:{extendedCompletionIso:string|null;contractCompletionIso:string|null;governingCompletionIso?:string|null;programmeCompletionIso:string|null;rate:number|null;rateBasis:string;capAmount:number|null}){
 const due=section.governingCompletionIso!==undefined?section.governingCompletionIso:section.extendedCompletionIso??section.contractCompletionIso,finish=section.programmeCompletionIso;
 const a=due?Date.parse(due.slice(0,10)+'T00:00:00Z'):NaN,b=finish?Date.parse(finish.slice(0,10)+'T00:00:00Z'):NaN;
 const lateDays=Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,Math.round((b-a)/86400000)):null;
 const perDay=typeof section.rate==='number'&&Number.isFinite(section.rate)?section.rateBasis==='fixed_amount_per_day'?section.rate:section.rateBasis==='fixed_amount_per_week'?section.rate/7:null:null;
 const uncapped=lateDays!==null&&perDay!==null?Math.round(lateDays*perDay*100)/100:null;
 const capped=uncapped!==null&&section.capAmount!==null?Math.min(uncapped,section.capAmount):null;
 const missingInputs=[!Number.isFinite(a)?'Section contractual completion date':null,!Number.isFinite(b)?'Linked section forecast milestone':null,perDay===null?'Section daily or weekly damages rate':null,section.capAmount===null?'Section monetary cap basis':null].filter((s):s is string=>s!==null);
 return {state:'scenario' as const,dueIso:due,finishIso:finish,lateDays,uncapped,capped,missingInputs,basis:'Section-specific source scenario; not a determination, certified deduction or agreed entitlement'};
}
