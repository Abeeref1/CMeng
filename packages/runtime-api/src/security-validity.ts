import type {ProjectRuntimeState} from './project-state-types';
import type {BondRecord} from '../../project-director/src';
import {analyticalOperationalDocuments,sourceAnalyticalCandidateIds,SOURCE_ANALYTICAL_USE} from './operational-reporting';

/** Compare security expiry with the supplied contract obligation. A programme
 * finish is a planning anchor, never evidence of taking-over or defect release. */
export function securityValidityReview(state:ProjectRuntimeState,bonds:BondRecord[],finishIso:string|null){
 // T04: the shared source-analytical rule; a unique fully read contract
 // candidate is used for this review and labelled, never treated as adopted.
 const eligible=new Set(analyticalOperationalDocuments(state.evidenceDocuments).map(e=>e.documentId)),unadopted=sourceAnalyticalCandidateIds(state.evidenceDocuments);
 const current=state.contractDocuments.filter(d=>eligible.has(d.documentId));
 const sections=current.flatMap(d=>d.result.sections.map(s=>({text:[s.heading,s.text].filter(Boolean).join(' '),sourceRef:'evidence-document:'+d.documentId+':page:'+(s.startPage??1)})));
 // An unadopted source never replaces or erases an adopted one: adopted text
 // wins, and a differing unadopted value is shown as a source conflict.
 const fromUnadopted=(ref:string)=>[...unadopted].some(id=>ref.startsWith('evidence-document:'+id+':'));
 const preferAdopted=<T extends {sourceRef:string}>(rows:T[])=>{const adopted=rows.filter(r=>!fromUnadopted(r.sourceRef));return {adopted,used:adopted.length?adopted:rows};};
 const requirements=preferAdopted(sections.filter(s=>/performance\s+security/i.test(s.text)&&/valid\s+until|remain\s+valid|remedied.*defects|performance\s+certificate/i.test(s.text))).used;
 const allPeriods=sections.flatMap(s=>[...s.text.matchAll(/defects\s+(?:notification|liability)\s+period\s*(?:is|of|:|=)?\s*(\d+)\s*(days?|months?|years?)/gi)].map(m=>({count:Number(m[1]),unit:m[2]!.toLowerCase().replace(/s$/,''),sourceRef:s.sourceRef})));
 const {adopted:adoptedPeriods,used:periods}=preferAdopted(allPeriods);
 const distinct=new Map(periods.map(p=>[p.count+':'+p.unit,p]));const period=distinct.size===1?[...distinct.values()][0]!:null;
 const sourceConflicts=adoptedPeriods.length?[...new Set(allPeriods.filter(p=>fromUnadopted(p.sourceRef)&&!distinct.has(p.count+':'+p.unit))
   .map(p=>'UNADOPTED_SOURCE_DEFECTS_PERIOD_DIFFERS:'+p.count+' '+p.unit+':'+p.sourceRef))]:[];
 let assumedEnd:string|null=null;
 if(period&&finishIso&&Number.isFinite(Date.parse(finishIso))){const end=new Date(finishIso.slice(0,10)+'T00:00:00.000Z');if(period.unit==='day')end.setUTCDate(end.getUTCDate()+period.count);else {const day=end.getUTCDate();end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+period.count*(period.unit==='year'?12:1));const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();end.setUTCDate(Math.min(day,last));}assumedEnd=end.toISOString().slice(0,10);}
 const unadoptedRefs=[...requirements.map(r=>r.sourceRef),...(period?[period.sourceRef]:[])].filter(fromUnadopted);
 return bonds.filter(b=>b.kind==='performance'&&b.status!=='released').map(b=>{
  const expiry=b.expiryIso?.slice(0,10)??null,finish=finishIso?.slice(0,10)??null;
  const daysAfterFinish=expiry&&finish?(Date.parse(expiry)-Date.parse(finish))/86400000:null;
  return {bondId:b.bondId,expiryIso:expiry,programmeFinishIso:finish,daysAfterProgrammeFinish:daysAfterFinish,assumedDefectsEndIso:assumedEnd,
   state:requirements.length?'review_required':'requirement_not_established',
   requirement:requirements.length?'Keep performance security valid through completion and the recorded defects-release obligation.':'The supplied contract does not establish the performance-security release condition.',
   finding:requirements.length?(assumedEnd&&expiry&&expiry<assumedEnd?'Security expires before the defects-period planning end.':daysAfterFinish!==null&&daysAfterFinish<0?'Security expires before programme completion.':'Validity through completion and remedy of defects is not demonstrated by the expiry date alone.'):'Check the security release condition against the applicable contract.',
   action:'Confirm the taking-over and defects-release dates; obtain an extension where the instrument expires before the contractual release condition.',
   basis:assumedEnd?'Planning assumption: taking-over on programme completion, followed by the recorded defects period. Actual certificates and later extensions remain separate.':'Programme completion is not a performance certificate; the final release date is not supplied.',
   sourceRefs:[...b.sourceRefs,...requirements.map(r=>r.sourceRef),...(period?[period.sourceRef]:[])],
   ...(unadoptedRefs.length?{sourceAnalyticalUse:SOURCE_ANALYTICAL_USE,sourceAnalyticalNote:'Contract requirement read from a source that is not formally adopted.'}:{}),
   ...(sourceConflicts.length?{sourceConflicts,sourceConflictNote:'An unadopted contract source states a different defects period; the adopted value is used until the source decision is made.'}:{})};
 });
}
