import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {projectControlSchedule} from './canonical-time-claims';
import {resolveBoqSource} from './boq-source';
import type {ProjectRuntimeState} from './project-state-types';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {CanonicalQuantityProgressModel} from '../../quantity-progress-core/src';

export interface BoqSectionDecision {section:string;decision:'confirm'|'reject';wbsId:string|null;reference:string;reviewedAt:string;}
export interface BoqSectionReview {sourceFingerprint:string;sourceRefs:string[];decisions:BoqSectionDecision[];lastChange:{section:string;decision:'confirm'|'reject'|'remove_review';reference:string;reviewedAt:string};}
const normalize=(s:string)=>s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
/** Shared suggestions retain exact source section identities; a name resemblance is never approval. */
export function boqSectionSuggestions(items:CanonicalQuantityProgressModel['items'],model:CanonicalScheduleModel|undefined){
 const parents=new Set(model?.wbs.map(w=>w.parentWbsId).filter(Boolean)??[]),wbs=model?.wbs.filter(w=>parents.has(w.wbsId))??[];
 const sections=new Map<string,number>();for(const item of items)if(item.section)sections.set(item.section,(sections.get(item.section)??0)+1);
 return [...sections].map(([section,itemCount])=>({section,itemCount,suggestions:wbs.filter(w=>w.name&&normalize(section)&&(' '+normalize(w.name)+' ').includes(' '+normalize(section)+' ')).map(w=>({wbsId:w.wbsId,name:w.name,sourceRefs:w.sourceRefs}))}));
}
const contexts=new WeakMap<ProjectRuntimeState,{version:number;model:CanonicalScheduleModel;quantities:CanonicalQuantityProgressModel;value:ReturnType<typeof createContext>}>();
function createContext(state:ProjectRuntimeState,model:CanonicalScheduleModel,quantities:CanonicalQuantityProgressModel){
 const programme=projectControlSchedule(state),boq=resolveBoqSource(state,model.sourceRevisionId),counts=new Map<string,number>();
 for(const w of model.wbs)counts.set(w.wbsId,(counts.get(w.wbsId)??0)+1);
 const nodes=new Map(model.wbs.map(w=>[w.wbsId,w])),activityCounts=new Map<string,number>();
 for(const a of model.activities){if(['wbs_summary','level_of_effort'].includes(a.activityType))continue;let id=a.wbsId;const chain:string[]=[],seen=new Set<string>();while(id&&nodes.has(id)&&counts.get(id)===1&&!seen.has(id)){seen.add(id);chain.push(id);id=nodes.get(id)!.parentWbsId??null;}if(id)continue;for(const node of chain)activityCounts.set(node,(activityCounts.get(node)??0)+1);}
 const wbsOptions=model.wbs.filter(w=>counts.get(w.wbsId)===1&&activityCounts.has(w.wbsId)).map(w=>({wbsId:w.wbsId,name:w.name,code:w.code??null,activityCount:activityCounts.get(w.wbsId)!}));
 const sourceFingerprint=createHash('sha256').update(JSON.stringify(['boq-section-review-v1',state.projectId,programme?.sourceHashSha256,model.sourceRevisionId,model.dataDateIso,boq.boq?.sourceHashSha256,quantities.boqRevisionId,
  quantities.items.map(i=>[i.quantityItemId,i.section]),model.wbs.map(w=>[w.wbsId,w.parentWbsId,w.name,w.code]),model.activities.map(a=>[a.activityId,a.wbsId,a.activityType])])).digest('hex');
 const saved=state.controls.boqSectionReview,review=saved?.sourceFingerprint===sourceFingerprint?saved:null;
 const sourceRefs=['schedule:'+model.sourceRevisionId,'boq:'+quantities.boqRevisionId];
 const eligible=new Set(wbsOptions.map(w=>w.wbsId)),choices=new Map((review?.decisions??[]).map(d=>[d.section,d]));
 const rows=boqSectionSuggestions(quantities.items,model).map(row=>({...row,suggestions:row.suggestions.filter(w=>eligible.has(w.wbsId)),review:choices.get(row.section)??null}));
 return {sourceFingerprint,sourceRefs,rows,wbsOptions,review,sourceDocumentId:boq.selection.sourceDocumentId,
  programmeFilename:programme?.sourceFilename??null,boqFilename:boq.selection.sourceFilename,itemCount:quantities.items.length,unsectionedItemCount:quantities.items.filter(i=>!i.section).length,
  previousReviewNeedsRefresh:!!saved&&!review};
}
export function boqSectionContext(state:ProjectRuntimeState,model=projectControlSchedule(state)?.revision.model,quantities=model?resolveBoqSource(state,model.sourceRevisionId).quantities:null){
 if(!model||!quantities)return null;
 const old=contexts.get(state);if(old?.version===state.version&&old.model===model&&old.quantities===quantities)return old.value;
 const value=createContext(state,model,quantities);contexts.set(state,{version:state.version,model,quantities,value});return value;
}
export function reviewedBoqSections(state:ProjectRuntimeState,model:CanonicalScheduleModel,quantities:CanonicalQuantityProgressModel){
 if(!state.controls?.boqSectionReview)return new Map<string,BoqSectionDecision>();
 return new Map((boqSectionContext(state,model,quantities)?.review?.decisions??[]).map(d=>[d.section,d]));
}
export function boqSectionDecisionInput(state:ProjectRuntimeState,input:any):BoqSectionReview{
 const context=boqSectionContext(state);if(!context)throw new Error('Current BOQ items and programme are required.');
 if(input.sourceFingerprint!==context.sourceFingerprint)throw new Error('The BOQ or programme changed. Reopen the section review.');
 if(typeof input.section!=='string'||!context.rows.some(r=>r.section===input.section))throw new Error('Choose an exact source BOQ section.');
 if(!['confirm','reject','remove_review'].includes(input.decision))throw new Error('Choose confirm, reject or remove review.');
 const reference=typeof input.reference==='string'?input.reference.trim():'';if(!reference)throw new Error('Enter the section review reference.');
 const wbsId=input.decision==='confirm'&&typeof input.wbsId==='string'?input.wbsId.trim():null;
 if(input.decision==='confirm'&&!context.wbsOptions.some(w=>w.wbsId===wbsId))throw new Error('Select a unique current WBS with programme tasks; ambiguous or cyclic groups cannot be confirmed.');
 if(input.decision!=='confirm'&&input.wbsId!==null&&input.wbsId!==undefined&&input.wbsId!=='')throw new Error('A rejected or removed section review cannot confirm a WBS.');
 const document=state.evidenceDocuments.find(d=>d.documentId===context.sourceDocumentId);
 if(document?.storedPath&&createHash('sha256').update(readFileSync(document.storedPath)).digest('hex')!==document.sourceHashSha256)throw new Error('Retained BOQ bytes changed. Re-read the source before confirming scope.');
 const decisions=(context.review?.decisions??[]).filter(d=>d.section!==input.section);
 if(input.decision!=='remove_review')decisions.push({section:input.section,decision:input.decision,wbsId,reference,reviewedAt:new Date().toISOString()});
 return {sourceFingerprint:context.sourceFingerprint,sourceRefs:context.sourceRefs,decisions,lastChange:{section:input.section,decision:input.decision,reference,reviewedAt:new Date().toISOString()}};
}
