import {createHash} from 'node:crypto';
import {contractTermVersions,type ContractTermVersion} from './contract-term-versions';
import type {ProjectRuntimeState} from './project-state-types';
import {applyContractFactDecisions,contractFactDecisionItems,CONTRACT_FACT_DECISION_PREFIX} from './contract-fact-decisions';
import {projectDataDate} from './canonical-time-claims';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof readBasis>}>();
function readBasis(state:ProjectRuntimeState){
 const allSourceTerms=contractTermVersions(state);
 const candidates=allSourceTerms.filter(term=>term.term==='noticePeriodDays').map(term=>{
  const document=state.evidenceDocuments.find(d=>d.documentId===term.documentId);
  return {...term,sourceKey:hash(term).slice(0,24),sourceFilename:document?.sourceFilename??term.documentId,sourceHash:document?.sourceHashSha256??null};
 });
 // Saved decisions are matched on formally adopted terms only: a term read from an unadopted
 // source (T04) is offered as a candidate but never detaches a decision the user already made.
 const sourceFingerprint=hash(['notice-review-v1',state.projectId,candidates.filter(c=>!c.sourceAnalyticalUse)]);
 const saved=state.controls?.reviewDecisions?.['notice-term-versions'];
 const decision=saved?.sourceFingerprint===sourceFingerprint&&saved.reference?.trim()?saved:null;
 return {allSourceTerms,candidates,sourceFingerprint,decision,sourceRefs:[...new Set(candidates.flatMap(c=>c.sourceRefs))]};
}
export function noticeReviewBasis(state:ProjectRuntimeState){
 const prior=cache.get(state);if(prior&&prior.version===state.version)return prior.value;
 const value=readBasis(state);cache.set(state,{version:state.version,value});return value;
}
function validateTerms(terms:readonly ContractTermVersion[]){
 if(!terms.length)throw new Error('Select at least one retained notice provision.');
 if(terms.some(term=>term.applicability!=='prospective'))throw new Error('The source does not establish prospective amendment applicability. Retain the unresolved interpretation for Contracts review.');
 for(let i=0;i<terms.length;i++)for(let j=i+1;j<terms.length;j++){
  const a=terms[i]!,b=terms[j]!;
  const overlap=(!a.effectiveToIso||!b.effectiveFromIso||a.effectiveToIso>b.effectiveFromIso)&&(!b.effectiveToIso||!a.effectiveFromIso||b.effectiveToIso>a.effectiveFromIso);
  if(overlap&&(a.value!==b.value||a.unit!==b.unit))throw new Error('Different selected periods overlap. Select the applicable source provision for that interval or retain the unresolved interpretation.');
 }
}
export function noticeReviewInput(state:ProjectRuntimeState,input:{choice:string;noticeSourceKeys?:unknown;reference?:unknown}){
 const basis=noticeReviewBasis(state),reference=String(input.reference??'').trim();
 if(!reference)throw new Error('Enter the notice provision review reference.');
 if(input.choice==='refer_contracts')return {reference,noticeSourceKeys:[] as string[]};
 if(!['confirm_versions','choose_provisions'].includes(input.choice))throw new Error('Choose an available notice provision treatment.');
 const keys=input.choice==='confirm_versions'?basis.candidates.map(c=>c.sourceKey):input.noticeSourceKeys;
 if(!Array.isArray(keys)||keys.some(key=>typeof key!=='string')||new Set(keys).size!==keys.length)throw new Error('Select distinct retained notice provisions.');
 const selected=keys.map(key=>basis.candidates.find(c=>c.sourceKey===key));
 if(selected.some(c=>!c))throw new Error('A selected notice source changed. Refresh Project Review.');
 validateTerms(selected as ContractTermVersion[]);
 return {reference,noticeSourceKeys:keys as string[]};
}
/** A reporting selection never edits the extracted terms or extends a source
 * interval. Unselected time intervals remain unknown, including any gap. */
export function reportingContractTermVersions(state:ProjectRuntimeState):ContractTermVersion[]{
 const versions=noticeReviewedTermVersions(state);
 // Only a saved contract-fact decision needs the Data Date; without one the reviewed versions are
 // returned unchanged, so states that hold no programme basis read exactly as before.
 const saved=state.controls?.reviewDecisions;
 if(!saved||!Object.keys(saved).some(key=>key.startsWith(CONTRACT_FACT_DECISION_PREFIX)))return versions;
 return applyContractFactDecisions(state,versions,projectDataDate(state));
}
/** T04: the conflicts and unsure readings offered in the decision place (before any saved decision). */
export function contractFactDecisionItemsForState(state:ProjectRuntimeState){
 return contractFactDecisionItems(state,noticeReviewedTermVersions(state),projectDataDate(state));
}
function noticeReviewedTermVersions(state:ProjectRuntimeState):ContractTermVersion[]{
 const basis=noticeReviewBasis(state),decision=basis.decision;
 if(!decision)return basis.allSourceTerms;
 if(decision.choice==='refer_contracts')return basis.allSourceTerms.map(term=>term.term==='noticePeriodDays'?{...term,applicability:'unresolved' as const,reviewReference:decision.reference!}:term);
 let reviewed:ReturnType<typeof noticeReviewInput>;
 try{reviewed=noticeReviewInput(state,{...decision,noticeSourceKeys:decision.noticeSourceKeys});}catch{return basis.allSourceTerms;}
 const selected=new Set(reviewed.noticeSourceKeys);
 return [...basis.allSourceTerms.filter(t=>t.term!=='noticePeriodDays'),...basis.candidates.filter(t=>selected.has(t.sourceKey)).map(({sourceKey,sourceFilename,sourceHash,...term})=>({...term,reviewReference:reviewed.reference}))];
}
