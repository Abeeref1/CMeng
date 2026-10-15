import {createHash} from 'node:crypto';
import {projectControlSchedule} from './canonical-time-claims';
import {deliveryRecords,deliveryCurrentRecord} from './delivery-records';
import {registerDate} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';

import {programmeTaskPatterns,programmeTaskReviewBasis,type ProgrammeTaskKind} from './programme-task-review';
export {programmeTaskPatterns} from './programme-task-review';
const sourceFlag=(value:unknown)=>{
 const text=String(value??'').trim().toLowerCase();
 return /^(yes|y|true|1|installed|commissioned|complete|completed)$/.test(text)?true:/^(no|n|false|0|not installed|not commissioned|incomplete)$/.test(text)?false:null;
};
const percent=(n:number,d:number)=>d>0?Math.round(n/d*10000)/100:null;
/** Count completion at the reporting Data Date, independently of a task's
 * later current-status label. Raw completed source flags remain traceable. */
export function programmeCompletionAsOf(rows:readonly {status:string;actualFinishIso?:string|null}[],cutoff:string|null){
 const sourceCompletedCount=rows.filter(r=>r.status==='completed').length;
 const unknown=rows.filter(r=>r.status==='unknown').length;
 const validDay=(value:string|null|undefined)=>{
  if(typeof value!=='string')return null;
  const day=/^\\d{4}-\\d{2}-\\d{2}(?=$|[T\\s])/.exec(value)?.[0];
  if(!day)return null;
  const ms=Date.parse(day+'T00:00:00Z');
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===day?day:null;
 };
 const futureCompletionDates=rows.filter(r=>{const day=validDay(r.actualFinishIso);return r.status==='completed'&&cutoff!==null&&day!==null&&day>cutoff;}).length;
 const missingCompletionDates=rows.filter(r=>r.status==='completed'&&!validDay(r.actualFinishIso)).length;
 const knownAsOfCount=cutoff?rows.filter(r=>r.status==='completed'&&validDay(r.actualFinishIso)!==null&&validDay(r.actualFinishIso)!<=cutoff).length:null;
 const percentage=cutoff&&unknown===0&&futureCompletionDates===0&&missingCompletionDates===0&&knownAsOfCount!==null&&rows.length
  ?percent(knownAsOfCount,rows.length):null;
 return {sourceCompletedCount,knownAsOfCount,unknown,futureCompletionDates,missingCompletionDates,percentage};
}
const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof buildComparison>}>();
function buildComparison(state:ProjectRuntimeState){
 const source=deliveryRecords(state).records.filter(r=>r.kind==='asset'&&r.sourceActive&&deliveryCurrentRecord(r));
 if(!source.length)return null;
 const schedule=projectControlSchedule(state),model=schedule?.revision.model,cutoff=model?.dataDateIso?.slice(0,10)??null;
 const taskIds=new Set<string>();
 const programme=Object.keys(programmeTaskPatterns).map(key=>{
  const scope=programmeTaskReviewBasis(state,key as ProgrammeTaskKind),rows=scope?.rows??[];rows.forEach(a=>taskIds.add(a.activityId));
  const completion=programmeCompletionAsOf(rows,cutoff);
  const {sourceCompletedCount,futureCompletionDates,missingCompletionDates}=completion;
  return {key,source:'programme',label:key==='testing'?'Programme testing tasks':'Programme handover tasks',
   sourceCompletedCount,numerator:model?completion.knownAsOfCount:null,denominator:model?rows.length:null,
   unknownCount:model?completion.unknown:null,percent:model?completion.percentage:null,
   statusDate:cutoff,futureCompletionDates,missingCompletionDates,basis:(scope?.basis??'Current programme is unavailable.')+' Task completion is not asset commissioning or formal acceptance. '+futureCompletionDates+' completed task dates fall after the Data Date; '+missingCompletionDates+' have no actual finish date.'};
 });
 const assetDates=source.map(r=>registerDate(String(r.fields['status as of']??'')));
 const undatedCount=assetDates.filter(d=>!d).length,futureCount=assetDates.filter(d=>d&&cutoff&&d>cutoff).length;
 const flagReviewRefs=[...new Set(source.map(r=>r.sourceValueReview?.reference).filter(Boolean))];
 const assetRows=[['installed','tag installed','Asset register installed flags'],['commissioned','commissioned','Asset register commissioned flags']].map(([key,field,label])=>{
  const flags=source.map(r=>sourceFlag(r.fields[field!])),yes=flags.filter(v=>v===true).length,unknown=flags.filter(v=>v===null).length;
  return {key:key!,source:'asset_register',label:label!,numerator:yes,denominator:source.length,unknownCount:unknown,percent:unknown?null:percent(yes,source.length),
   statusDate:[...new Set(assetDates.filter((d):d is string=>!!d))].sort().join(', ')||null,undatedCount,futureCount,
   basis:(flagReviewRefs.length?'Reviewed source flag interpretations: '+flagReviewRefs.join('; ')+'. Original source values remain available. ':'')+'Reported flags in the retained asset register. Unknown flags remain unknown; this is not a complete project asset population or dated acceptance position.'};
 });
 const linkedAssetCount=source.filter(r=>r.links.activityIds.some(id=>taskIds.has(id))).length;
 const sourceRefs=[...new Set([...(schedule?['schedule:'+schedule.revision.revisionId]:[]),...source.flatMap(r=>r.receipts.map(receipt=>'evidence-document:'+receipt.documentId))])];
 const sourceFingerprint=createHash('sha256').update(JSON.stringify(['handover-source-review-v1',state.projectId,schedule?.sourceHashSha256,model?.sourceRevisionId,cutoff,Object.keys(programmeTaskPatterns).map(key=>[key,programmeTaskReviewBasis(state,key as ProgrammeTaskKind)?.rows.map(a=>a.activityId)]),source.map(r=>[r.recordId,r.revision,r.fields,r.links.activityIds,r.receipts.map(x=>[x.documentId,x.sourceHash])])])).digest('hex');
 const saved=state.controls?.reviewDecisions?.['handover-source-basis'];
 const decision=saved?.sourceFingerprint===sourceFingerprint&&saved.reference?.trim()?saved:null;
 const programmeAvailable=programme.some(row=>(row.denominator??0)>0),reviewAvailable=programmeAvailable&&source.length>0;
 const rows=decision?.choice==='asset_focus'?[...assetRows,...programme]:[...programme,...assetRows];
 return {sourceFingerprint,sourceRefs,dataDateIso:cutoff,programmeAvailable,reviewAvailable,assetRecordCount:source.length,linkedAssetCount,unlinkedAssetCount:source.length-linkedAssetCount,rows,
  comparability:'different_populations' as const,basis:'Programme task counts and asset-register flags describe different populations. Reconcile the scope, asset-to-activity links and status dates before treating their percentages as a disagreement. Neither source alone proves formal handover acceptance.',
  dateQualification:cutoff?undatedCount+' asset records have no status date; '+futureCount+' are dated after the programme Data Date. Source flags remain visible and are not promoted to current acceptance.':'Programme Data Date is unavailable. '+undatedCount+' asset records have no status date. Source flags do not establish current acceptance.',
  decision:decision?{choice:decision.choice,reference:decision.reference,confirmedAt:decision.confirmedAt}:null};
}
export function handoverSourceComparison(state:ProjectRuntimeState){
 const old=cache.get(state);if(old?.version===state.version)return old.value;
 const value=buildComparison(state);cache.set(state,{version:state.version,value});return value;
}
export function handoverSourceReviewInput(input:{reference?:unknown}){
 const reference=String(input.reference??'').trim();if(!reference)throw new Error('Enter the asset/programme basis review reference.');
 return {reference};
}
