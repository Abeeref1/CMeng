import {createHash} from 'node:crypto';
import {projectControlSchedule} from './canonical-time-claims';
import {deliveryRecords,deliveryCurrentRecord} from './delivery-records';
import {scheduleScopeClassification,type ScheduleScopeClassification} from './schedule-scope-classification';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ProjectRuntimeState} from './project-state-types';

type Assignment={wbsId:string;location:string};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const basisCache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof readLocationBasis>}>();
function readLocationBasis(state:ProjectRuntimeState){
 const programme=projectControlSchedule(state),model=programme?.revision.model;if(!programme||!model)return null;
 const nodes=new Map(model.wbs.map(n=>[n.wbsId,n])),nodeCounts=new Map<string,number>(),counts=new Map<string,number>();
 for(const n of model.wbs)nodeCounts.set(n.wbsId,(nodeCounts.get(n.wbsId)??0)+1);
 const paths=new Map<string,string[]>();
 const ancestors=(id:string)=>{const cached=paths.get(id);if(cached)return cached;const ids:string[]=[],seen=new Set<string>();let n=nodes.get(id);while(n&&!seen.has(n.wbsId)){seen.add(n.wbsId);ids.push(n.wbsId);n=n.parentWbsId?nodes.get(n.parentWbsId):undefined;}paths.set(id,ids);return ids;};
 for(const a of model.activities)if(a.wbsId&&!['wbs_summary','level_of_effort'].includes(a.activityType))for(const id of ancestors(a.wbsId))counts.set(id,(counts.get(id)??0)+1);
 const wbsCandidates=model.wbs.filter(n=>n.name?.trim()&&counts.has(n.wbsId)&&nodeCounts.get(n.wbsId)===1).map(n=>({wbsId:n.wbsId,location:n.name!.trim(),activityCount:counts.get(n.wbsId)!,path:[...ancestors(n.wbsId)].reverse().map(id=>nodes.get(id)?.name??id).join(' / '),basis:'Source WBS name; location use requires review'}));
 const assets=deliveryRecords(state).records.filter(r=>r.kind==='asset'&&r.sourceActive&&deliveryCurrentRecord(r));
 const assetGroups=new Map<string,{location:string;assetCount:number;sourceRefs:string[]}>();
 for(const r of assets){const location=String(r.fields['location']??'').trim();if(!location)continue;const group=assetGroups.get(location)??{location,assetCount:0,sourceRefs:[]};group.assetCount++;group.sourceRefs.push(...r.receipts.map(x=>'evidence-document:'+x.documentId));assetGroups.set(location,group);}
 const assetCandidates=[...assetGroups.values()].map(g=>({...g,sourceRefs:[...new Set(g.sourceRefs)],basis:'Reported asset location; no programme mapping inferred'}));
 const sourceFingerprint=hash(['location-review-v1',state.projectId,programme.sourceHashSha256,programme.revision.revisionId,model.dataDateIso,assets.map(r=>[r.recordId,r.revision,r.fields['location'],r.receipts.map(x=>[x.documentId,x.sourceHash])])]);
 const saved=state.controls.reviewDecisions?.['location-grouping'];
 const decision=saved?.sourceFingerprint===sourceFingerprint&&saved.reference?.trim()?saved:null;
 const sourceRefs=[...new Set(['schedule:'+programme.revision.revisionId,...assetCandidates.flatMap(c=>c.sourceRefs)])];
 return {sourceFingerprint,sourceRevisionId:model.sourceRevisionId,sourceFilename:programme.sourceFilename,wbsCandidates,assetCandidates,decision,sourceRefs};
}
export function locationReviewBasis(state:ProjectRuntimeState){
 const cached=basisCache.get(state);if(cached?.version===state.version)return cached.value;
 const value=readLocationBasis(state);basisCache.set(state,{version:state.version,value});return value;
}
export function locationReviewInput(state:ProjectRuntimeState,input:{choice:string;locationAssignmentsText?:unknown;reference?:unknown}){
 const basis=locationReviewBasis(state);if(!basis)throw new Error('No programme location candidates are available.');
 const reference=String(input.reference??'').trim();if(!reference)throw new Error('Enter the location review reference.');
 if(input.choice==='keep_source_locations')return {locationAssignments:[] as Assignment[],reference};
 if(input.choice!=='confirm_wbs_locations')throw new Error('Choose an available location treatment.');
 const allowedWbs=new Map(basis.wbsCandidates.map(c=>[c.wbsId,c.location]));
 const allowedLocations=new Set([...basis.wbsCandidates,...basis.assetCandidates].map(c=>c.location));
 const assignments:Assignment[]=[],seen=new Set<string>();
 for(const raw of String(input.locationAssignmentsText??'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)){
  const split=raw.indexOf('|'),wbsId=(split<0?raw:raw.slice(0,split)).trim(),location=(split<0?allowedWbs.get(wbsId):raw.slice(split+1).trim());
  if(!allowedWbs.has(wbsId)||!location||!allowedLocations.has(location))throw new Error('Use a current candidate WBS ID and an exact WBS or asset location shown in the source candidates.');
  if(seen.has(wbsId))throw new Error('Each WBS node must have one location assignment.');
  seen.add(wbsId);assignments.push({wbsId,location});
 }
 if(!assignments.length)throw new Error('Enter at least one candidate WBS ID.');
 return {locationAssignments:assignments,reference};
}
const projectionCache=new WeakMap<ScheduleScopeClassification,{key:string;value:ScheduleScopeClassification}>();
/** Explicit source classifications win. Reviewed WBS mappings fill otherwise-unclassified locations only. */
export function projectScopeClassification(state:ProjectRuntimeState,model:CanonicalScheduleModel):ScheduleScopeClassification{
 const base=scheduleScopeClassification(model);
 if(!state.controls.reviewDecisions?.['location-grouping'])return base;
 const basis=locationReviewBasis(state),decision=basis?.decision;
 if(!basis||basis.sourceRevisionId!==model.sourceRevisionId||decision?.choice!=='confirm_wbs_locations')return base;
 const assignments=decision.locationAssignments??[],key=hash([basis.sourceFingerprint,assignments]);
 const cached=projectionCache.get(base);if(cached?.key===key)return cached.value;
 const locations=new Map(assignments.map(a=>[a.wbsId,a.location])),nodes=new Map(model.wbs.map(n=>[n.wbsId,n]));
 const resolved=new Map<string,string|null>();
 const locationFor=(id:string)=>{if(resolved.has(id))return resolved.get(id)!;let current:string|null=id;const seen=new Set<string>();let location:string|null=null;while(current&&!seen.has(current)){seen.add(current);if(locations.has(current)){location=locations.get(current)!;break;}current=nodes.get(current)?.parentWbsId??null;}resolved.set(id,location);return location;};
 const rows=base.rows.map(row=>{const location=!row.location&&row.wbsId?locationFor(row.wbsId):null;return location?{...row,location,classificationBasis:{...row.classificationBasis,location:'user_reviewed' as const}}:row;});
 const classified=rows.filter(r=>r.location!==null).length;
 const result={...base,rows,coverage:base.coverage.map(c=>c.key==='location'?{...c,classified,coveragePercent:rows.length?Number((classified/rows.length*100).toFixed(4)):null,basis:'Explicit source locations; otherwise user-reviewed WBS mappings. Original WBS and activity fields retained.'}:c)};
 projectionCache.set(base,{key,value:result});return result;
}
export function locationReviewSummary(state:ProjectRuntimeState){
 const basis=locationReviewBasis(state);if(!basis)return null;
 return {...basis,decision:basis.decision?{choice:basis.decision.choice,reference:basis.decision.reference,confirmedAt:basis.decision.confirmedAt,locationAssignments:basis.decision.locationAssignments??[]}:null};
}
