import {createHash} from 'node:crypto';
import {projectControlSchedule} from './canonical-time-claims';
import {deliveryRecords,deliveryCurrentRecord} from './delivery-records';
import {registerDate,dateValue} from '../../truth-kernel/src';
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
 const validDay=(value:string|null|undefined)=>typeof value==='string'?dateValue(value):null;
 const asOfDay=validDay(cutoff);
 const futureCompletionDates=rows.filter(r=>{const day=validDay(r.actualFinishIso);return r.status==='completed'&&asOfDay!==null&&day!==null&&day>asOfDay;}).length;
 const missingCompletionDates=rows.filter(r=>r.status==='completed'&&!validDay(r.actualFinishIso)).length;
 const knownAsOfCount=asOfDay?rows.filter(r=>r.status==='completed'&&validDay(r.actualFinishIso)!==null&&validDay(r.actualFinishIso)!<=asOfDay).length:null;
 const percentage=asOfDay&&unknown===0&&futureCompletionDates===0&&missingCompletionDates===0&&knownAsOfCount!==null&&rows.length
  ?percent(knownAsOfCount,rows.length):null;
 return {sourceCompletedCount,knownAsOfCount,unknown,futureCompletionDates,missingCompletionDates,percentage};
}
/** Distinguish original reported asset status flags from date-qualified handover
 * evidence. An undated, future-dated or undecidable flag cannot establish the
 * position at the reporting Data Date; original reported flags remain visible. */
export function assetFlagCompletionAsOf(rows:readonly {value:boolean|null;statusDate:string|null}[],cutoff:string|null){
 const asOf=cutoff===null?null:dateValue(cutoff);
 if(asOf===null)return {confirmedYes:null,knownCount:null,unknownCount:rows.length,percentage:null};
 let confirmedYes=0,knownCount=0;
 for(const row of rows){
  const statusDay=row.statusDate===null?null:dateValue(row.statusDate);
  if(row.value===null||statusDay===null||statusDay>asOf)continue;
  knownCount++;
  if(row.value===true)confirmedYes++;
 }
 const unknownCount=rows.length-knownCount;
 return {confirmedYes,knownCount,unknownCount,
  percentage:rows.length>0&&unknownCount===0?percent(confirmedYes,rows.length):null};
}
const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof buildComparison>}>();
function buildComparison(state:ProjectRuntimeState){
 const source=deliveryRecords(state).records.filter(r=>r.kind==='asset'&&r.sourceActive&&deliveryCurrentRecord(r));
 if(!source.length)return null;
 const schedule=projectControlSchedule(state),model=schedule?.revision.model,cutoff=model?.dataDateIso?dateValue(model.dataDateIso):null;
 const taskIds=new Set<string>();
 const programme=Object.keys(programmeTaskPatterns).map(key=>{
  const scope=programmeTaskReviewBasis(state,key as ProgrammeTaskKind),rows=scope?.rows??[];rows.forEach(a=>taskIds.add(a.activityId));
  const completion=programmeCompletionAsOf(rows,cutoff);
  const {sourceCompletedCount,futureCompletionDates,missingCompletionDates}=completion;
  return {key,source:'programme',label:key==='testing'?'Programme testing tasks':'Programme handover tasks',
   sourceCompletedCount,numerator:model?sourceCompletedCount:null,
   asOfConfirmedCompletedCount:model?completion.knownAsOfCount:null,denominator:model?rows.length:null,
   unknownCount:model?completion.unknown:null,percent:model?completion.percentage:null,
   statusDate:cutoff,futureCompletionDates,missingCompletionDates,basis:(scope?.basis??'Current programme is unavailable.')+' The completed-task count is the reported source status, not the date-qualified completed count; the latter needs an actual finish date on or before the Data Date. Task completion is not asset commissioning or formal acceptance. '+futureCompletionDates+' completed task dates fall after the Data Date; '+missingCompletionDates+' have no actual finish date.'};
 });
 const assetDates=source.map(r=>registerDate(String(r.fields['status as of']??'')));
 const undatedCount=assetDates.filter(d=>!d).length,futureCount=assetDates.filter(d=>d&&cutoff&&d>cutoff).length;
 const flagReviewRefs=[...new Set(source.map(r=>r.sourceValueReview?.reference).filter(Boolean))];
 const assetRows=[['installed','tag installed','Asset register installed flags'],['commissioned','commissioned','Asset register commissioned flags']].map(([key,field,label])=>{
  const flags=source.map(r=>sourceFlag(r.fields[field!])),yes=flags.filter(v=>v===true).length,unknown=flags.filter(v=>v===null).length;
  const asOf=assetFlagCompletionAsOf(flags.map((value,index)=>({value,statusDate:assetDates[index]??null})),cutoff);
  return {key:key!,source:'asset_register',label:label!,numerator:yes,denominator:source.length,unknownCount:unknown,percent:unknown?null:percent(yes,source.length),
   asOfConfirmedYes:asOf.confirmedYes,asOfKnownCount:asOf.knownCount,asOfUnknownCount:asOf.unknownCount,asOfPercent:asOf.percentage,
   statusDate:[...new Set(assetDates.filter((d):d is string=>!!d))].sort().join(', ')||null,undatedCount,futureCount,
   basis:(flagReviewRefs.length?'Reviewed source flag interpretations: '+flagReviewRefs.join('; ')+'. Original source values remain available. ':'')+'Reported source flag counts and percentages are retained separately from the reporting-date position. The as-of percentage is not established while any source flag is undated, future-dated or unknown; neither measure proves formal handover acceptance or a complete asset population.'};
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
