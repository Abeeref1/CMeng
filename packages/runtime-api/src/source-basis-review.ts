import {dateValue} from '../../truth-kernel/src';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {sourceProductivityForecastEvidence} from './source-productivity-forecast';
import {resolveBoqSource} from './boq-source';
import type {ProjectRuntimeState} from './project-state-types';

const normalize=(s:string)=>s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const phrase=(whole:string,part:string)=>(' '+normalize(whole)+' ').includes(' '+normalize(part)+' ');
const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof calculateQuantityReview>}>();
/** Name matches are review suggestions only; they never create allocations. */
export function quantityBasisReview(state:ProjectRuntimeState){const old=cache.get(state);if(old?.version===state.version)return old.value;const value=calculateQuantityReview(state);cache.set(state,{version:state.version,value});return value;}
function calculateQuantityReview(state:ProjectRuntimeState){
  const model=projectControlSchedule(state)?.revision.model;
  const items=resolveBoqSource(state,model?.sourceRevisionId??'').quantities?.items??[];
  const parents=new Set(model?.wbs.map(w=>w.parentWbsId).filter(Boolean)??[]);
  const wbs=model?.wbs.filter(w=>parents.has(w.wbsId))??[];
  const sections=[...new Set(items.map(i=>i.section).filter((s):s is string=>!!s))].map(section=>({section,
    itemCount:items.filter(i=>i.section===section).length,
    suggestions:wbs.filter(w=>w.name&&phrase(w.name,section)).map(w=>({wbsId:w.wbsId,name:w.name,sourceRefs:w.sourceRefs}))}));
  const units=[...new Set(items.map(i=>i.unit??'Unit not stated'))].map(unit=>{const rows=items.filter(i=>(i.unit??'Unit not stated')===unit),known=rows.filter(r=>r.contractQuantity!==null);return {unit,itemCount:rows.length,knownQuantityCount:known.length,quantity:known.length?known.reduce((s,r)=>s+r.contractQuantity!,0):null};});
  const forecast=sourceProductivityForecastEvidence(state);
  const forecastUnits=[...new Set(forecast.rows.map(r=>r.unit??'Unit not stated'))].map(unit=>{const rows=forecast.rows.filter(r=>(r.unit??'Unit not stated')===unit),known=rows.filter(r=>r.remainingQuantity!==null);return {unit,rowCount:rows.length,remainingQuantity:known.length?known.reduce((s,r)=>s+r.remainingQuantity!,0):null};});
  const drivers=forecast.rows.filter(r=>forecast.driverWorkPackageIds.includes(r.workPackageId)).map(r=>{
    const values=forecast.rows.filter(v=>v.unit===r.unit&&v.remainingQuantity!==null).map(v=>v.remainingQuantity!).sort((a,b)=>a-b);
    const n=values.length,median=n?(values[Math.floor((n-1)/2)]!+values[Math.floor(n/2)]!)/2:null;
    return {...r,unitMedianRemaining:median,remainingToUnitMedian:r.remainingQuantity!==null&&median&&median>0?r.remainingQuantity/median:null};
  });
  // Number resemblance is only a diagnostic: derive the schedule package token
  // from source activity names. Do not join IF rows to a WBS by ordinal position.
  const schedulePackages=(model?.wbs??[]).filter(w=>!parents.has(w.wbsId)).map(w=>{
    const tokens=[...new Set((model?.activities??[]).filter(a=>a.wbsId===w.wbsId).flatMap(a=>[...(a.name??'').matchAll(/\bpackage\s+0*(\d+)\b/gi)].map(m=>Number(m[1]))))];
    return {wbsId:w.wbsId,name:w.name,number:tokens.length===1?tokens[0]:null};
  });
  const numberReview=forecast.rows.map(r=>{const digits=/^(?:[A-Za-z]+[-_ ]*)?0*(\d+)$/.exec(r.workPackageId),number=digits?Number(digits[1]):null;
    const candidates=number!==null?schedulePackages.filter(w=>w.number===number):[];
    return {workPackageId:r.workPackageId,sourceDiscipline:r.discipline,schedulePackages:candidates,disciplineMatches:candidates.length===1&&!!r.discipline&&phrase(candidates[0]!.name??'',r.discipline)};});
  return {itemCount:items.length,sections,unitTotals:units,uniqueSectionSuggestionCount:sections.filter(s=>s.suggestions.length===1).length,
    forecast:{completionIso:forecast.completionIso,state:forecast.state,workPackageCount:forecast.workPackageCount,driverCount:drivers.length,drivers,units:forecastUnits,
      explicitActivityLinkCount:forecast.rows.filter(r=>r.linkedActivityId&&model?.activities.some(a=>a.activityId===r.linkedActivityId)).length,
      sameNumberReviewedCount:numberReview.filter(r=>r.schedulePackages.length===1).length,sameNumberDisciplineMatches:numberReview.filter(r=>r.disciplineMatches).length,numberReview},
    interpretation:'Section-name suggestions require source-owner review and do not map any BOQ item. Different units are never summed or equated. Matching package numbers do not establish schedule identity. Request the productivity-to-schedule and BOQ crosswalk, quantities by unit, and an explanation of outlying driver quantities.'};
}

/** Explicit contract-version amounts, independent of cost budget or variation
 * ledger totals. Future, undated amendment and conflicting amounts stay visible. */
export function contractValueBasisReview(state:ProjectRuntimeState){
  const cutoff=projectDataDate(state)?.slice(0,10)??null;
  const rows=state.contractDocuments.filter(d=>['main','amendment','replacement'].includes(d.role)).flatMap(d=>{
    const evidence=state.evidenceDocuments.find(e=>e.documentId===d.documentId);
    if(!evidence||!['active','additive'].includes(evidence.basisState))return [];
    const pages=[...(d.result.pdf?.pages??[]).map(p=>({text:p.text,pageNumber:p.pageNumber})),
      ...(d.result.sections??[]).map(s=>({text:s.text,pageNumber:s.startPage??null}))],text=pages.map(p=>p.text).join('\n');
    const effective=/Effective Date\s*[:\n]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})/i.exec(text);
    const effectiveFromIso=effective?dateValue(effective[1]!):null;
    const matches=pages.flatMap(p=>[...p.text.matchAll(/(Revised Contract Value|Accepted Contract Amount|Original Contract Value)\s*[:\n]?\s*([A-Z]{3})\s+([\d,]+(?:\.\d+)?)([^\n]*)/gi)].map(m=>({label:({'revised contract value':'Revised Contract Value','accepted contract amount':'Accepted Contract Amount','original contract value':'Original Contract Value'} as Record<string,string>)[m[1]!.toLowerCase()]!,currency:m[2]!.toUpperCase(),amount:Number(m[3]!.replaceAll(',','')),taxBasis:/exclud/i.test(m[4]!)?'exclusive':/includ/i.test(m[4]!)?'inclusive':'unknown',page:p.pageNumber})));
    const unique=[...new Map(matches.map(m=>[[m.label,m.amount,m.currency,m.taxBasis].join('|'),m])).values()];
    return unique.map(m=>({...m,documentId:d.documentId,sourceFilename:d.sourceFilename,role:d.role,effectiveFromIso,
      scope:!cutoff?'cutoff_missing':d.role!=='main'&&!effectiveFromIso?'undated':effectiveFromIso&&effectiveFromIso>cutoff?'future':'as_of',
      sourceRefs:['evidence-document:'+d.documentId+(m.page?':page:'+m.page:':contract-text')]}));
  });
  const current=rows.filter(r=>r.scope==='as_of'&&(r.label==='Revised Contract Value'||(r.role==='main'&&r.label==='Accepted Contract Amount'))).sort((a,b)=>(b.effectiveFromIso??'').localeCompare(a.effectiveFromIso??''));
  const latest=current[0],peers=latest?current.filter(r=>r.effectiveFromIso===latest.effectiveFromIso):[];
  const conflict=new Set(peers.map(r=>[r.amount,r.currency,r.taxBasis].join('|'))).size>1;
  return {dataDateIso:cutoff,rows,current:conflict?null:latest??null,state:conflict?'conflicted':latest?'source':'missing',
    interpretation:'The current explicit contract-version value is separate from the cost budget and the dated variation ledger. Confirm any conflict or undated amendment; do not add an amendment twice.'};
}
