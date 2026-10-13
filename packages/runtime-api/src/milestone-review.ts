import {createHash} from 'node:crypto';
import {projectControlSchedule} from './canonical-time-claims';
import type {ProjectRuntimeState} from './project-state-types';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';

const milestoneTypes=new Set(['milestone','start_milestone','finish_milestone']);
/** A reporting watchlist decision does not edit activity types, dates, logic or contract authority. */
export function milestoneReviewBasis(state:ProjectRuntimeState){
 const schedule=projectControlSchedule(state),model=schedule?.revision.model;
 if(!schedule||!model)return null;
 const sourceFingerprint=createHash('sha256').update(JSON.stringify(['milestone-review-v1',state.projectId,schedule.sourceHashSha256,schedule.revision.revisionId,model.sourceRevisionId,model.dataDateIso])).digest('hex');
 const saved=state.controls.reviewDecisions?.['milestone-selection'];
 const decision=saved?.sourceFingerprint===sourceFingerprint&&saved.reference?.trim()?saved:null;
 const sourceMilestoneCount=model.activities.filter(a=>milestoneTypes.has(a.activityType)).length;
 const unknownActivityTypeCount=model.activities.filter(a=>a.activityType==='unknown').length;
 return {schedule,sourceFingerprint,sourceMilestoneCount,unknownActivityTypeCount,decision,
  sourceRefs:['schedule:'+schedule.revision.revisionId]};
}
export function milestoneReviewInput(state:ProjectRuntimeState,input:{choice:string;activityIds?:unknown;reference?:unknown}){
 const basis=milestoneReviewBasis(state);if(!basis)throw new Error('No current programme is available for review.');
 const reference=String(input.reference??'').trim();if(!reference)throw new Error('Enter the programme review reference.');
 if(!['track_key_dates','no_programme_milestones'].includes(input.choice))throw new Error('Select an available milestone review choice.');
 const activityIds=Array.isArray(input.activityIds)?[...new Set(input.activityIds.map(id=>String(id).trim()).filter(Boolean))]:[];
 if(input.choice==='no_programme_milestones'){
  if(basis.sourceMilestoneCount)throw new Error('The source identifies milestones. Keep those source records in the review.');
  if(activityIds.length)throw new Error('Clear the key-date selection before confirming there are no programme milestones.');
 }else{
  if(!activityIds.length)throw new Error('Enter at least one current programme activity ID.');
  const counts=new Map<string,number>();for(const a of basis.schedule.revision.model.activities)counts.set(a.activityId,(counts.get(a.activityId)??0)+1);
  if(activityIds.some(id=>counts.get(id)!==1))throw new Error('Each selected activity ID must identify exactly one activity in the current programme.');
 }
 return {activityIds,reference};
}
export function milestoneReviewForProjection(state:ProjectRuntimeState,model:CanonicalScheduleModel){
 const basis=milestoneReviewBasis(state);if(!basis||basis.schedule.revision.model.sourceRevisionId!==model.sourceRevisionId)return undefined;
 const d=basis.decision;
 return {sourceFingerprint:basis.sourceFingerprint,sourceRevisionId:model.sourceRevisionId,reference:d?.reference??null,
  choice:d?.choice==='track_key_dates'||d?.choice==='no_programme_milestones'?d.choice:null,
  activityIds:d?.choice==='track_key_dates'?d.activityIds??[]:[],confirmedAt:d?.confirmedAt??null};
}
