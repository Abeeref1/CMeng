import {createHash} from 'node:crypto';
import {projectControlSchedule} from './canonical-time-claims';
import type {ProjectRuntimeState} from './project-state-types';

export const programmeTaskPatterns={testing:/testing|commissioning|\btest\b/i,handover:/handover|taking[- ]over|section(?:al)? completion|practical completion/i};
export type ProgrammeTaskKind=keyof typeof programmeTaskPatterns;
const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof buildBasis>}>();
function buildBasis(state:ProjectRuntimeState){
 const schedule=projectControlSchedule(state);if(!schedule)return null;
 const model=schedule.revision.model,execution=model.activities.filter(a=>!['wbs_summary','level_of_effort'].includes(a.activityType));
 return (['testing','handover'] as const).map(kind=>{
  const sourceFingerprint=createHash('sha256').update(JSON.stringify(['programme-task-review-v1',kind,state.projectId,schedule.sourceHashSha256,schedule.revision.revisionId,model.sourceRevisionId,model.dataDateIso])).digest('hex');
  const saved=state.controls?.reviewDecisions?.['programme-tasks-'+kind];
  const decision=saved?.sourceFingerprint===sourceFingerprint&&saved.reference?.trim()?saved:null;
  // DMCC-UPD2 #13: names alone caught "Appointment of third party for Testing and Commissioning works",
  // "Laying of drainage pipe & testing" and trade-to-trade "Handover of Shaft to Elevator Subcontractor".
  // The programme's own WBS section for the stage is read first; names are the fallback, without
  // procurement/appointment tasks and handovers between trades.
  // A stage section is named for the stage itself ("Testing and Commissioning Works"), not a phase that
  // also holds other stages ("Testing, Commissioning, Authorities Approval, Handing over and Close-out"),
  // an appointment ("Appointment of Third Party for MEP Testing and Commissioning works") or a trade's
  // sub-step ("Cabin works/Testing").
  const wbsSection=kind==='testing'?/^(?:testing|commissioning|pre-?commissioning|t\s*&\s*c)\b|testing (?:and|&) commissioning/i:/^(?:hand(?:ing)?[- ]?over|taking[- ]over)\b/i;
  const otherStage=kind==='testing'?/authorit|hand(?:ing)?[- ]?over|close-?out|appointment|third part|3rd part|sub-?contract|procure|tender/i:/testing|commissioning|authorit|appointment|sub-?contract/i;
  const sectionRoots=model.wbs.filter(w=>wbsSection.test(w.name??'')&&!otherStage.test(w.name??''));
  const sectionIds=new Set<string>(sectionRoots.map(w=>w.wbsId));
  for(let changed=sectionIds.size>0;changed;){changed=false;for(const w of model.wbs)if(w.parentWbsId&&sectionIds.has(w.parentWbsId)&&!sectionIds.has(w.wbsId)){sectionIds.add(w.wbsId);changed=true;}}
  const inSection=execution.filter(a=>a.wbsId&&sectionIds.has(a.wbsId));
  const notStageWork=kind==='testing'
    ?/appointment|sub-?contract|agreement|procure|tender|award|submittal|approval of|pre-?qualification/i
    :/\bto\b.*(?:sub-?contractor|works|trade|joinery|elevator|finishes|installation)|clearance hand ?over|hand ?over of (?:shaft|area|slab|room|floor|zone)/i;
  const byName=execution.filter(a=>programmeTaskPatterns[kind].test(a.name??'')&&!notStageWork.test(a.name??''));
  const fromWbs=inSection.length>0;
  const nameMatches=fromWbs?inSection:byName;
  const sectionNames=[...new Set(sectionRoots.filter(w=>!w.parentWbsId||!sectionIds.has(w.parentWbsId)).map(w=>w.name).filter(Boolean))].slice(0,3);
  const selected=new Set(decision?.activityIds??[]);
  const rows=decision?execution.filter(a=>selected.has(a.activityId)):nameMatches;
  const included=new Set(rows);
  const additionalCandidates=kind==='testing'?execution.filter(a=>/validation/i.test(a.name??'')&&!included.has(a)):[];
  const rule=fromWbs?'Activities in the programme\'s '+sectionNames.map(n=>'"'+n+'"').join(', ')+' WBS section'+(sectionNames.length===1?'':'s')
    :kind==='testing'?'Names containing testing, commissioning or the word test (appointments, subcontracts and approvals excluded)':'Names containing handover, taking over, sectional completion or practical completion (handovers between trades excluded)';
  return {kind,sourceFingerprint,sourceRefs:['schedule:'+schedule.revision.revisionId],sourceFilename:schedule.sourceFilename,model,rows,nameMatches,additionalCandidates,decision,
   basis:decision?'Reviewed programme task IDs; reference: '+decision.reference:rule+(fromWbs?'. This WBS-based selection has not been confirmed.':'. This name-based selection has not been confirmed.'),
   qualification:'Programme task status describes this selected scope; it does not establish test results, commissioning or formal acceptance.'};
 });
}
export function programmeTaskReviewBasis(state:ProjectRuntimeState,kind:ProgrammeTaskKind){
 let old=cache.get(state);if(!old||old.version!==state.version){old={version:state.version,value:buildBasis(state)};cache.set(state,old);}
 return old.value?.find(b=>b.kind===kind)??null;
}
export function programmeTaskReviewInput(state:ProjectRuntimeState,kind:ProgrammeTaskKind,input:{choice:string;activityIds?:unknown;reference?:unknown}){
 const basis=programmeTaskReviewBasis(state,kind);if(!basis)throw new Error('No current programme is available for task review.');
 const reference=String(input.reference??'').trim();if(!reference)throw new Error('Enter the programme task review reference.');
 if(!['selected_tasks','no_tasks'].includes(input.choice))throw new Error('Select an available task scope decision.');
 const activityIds=Array.isArray(input.activityIds)?input.activityIds.map(id=>String(id).trim()).filter(Boolean):[];
 if(new Set(activityIds).size!==activityIds.length)throw new Error('Each programme task ID must appear only once.');
 if(input.choice==='no_tasks'&&activityIds.length)throw new Error('Clear the task IDs before confirming no tasks.');
 if(input.choice==='selected_tasks'&&!activityIds.length)throw new Error('Enter at least one current programme task ID.');
 const counts=new Map<string,number>();for(const a of basis.model.activities)counts.set(a.activityId,(counts.get(a.activityId)??0)+1);
 const eligible=new Set(basis.model.activities.filter(a=>!['wbs_summary','level_of_effort'].includes(a.activityType)).map(a=>a.activityId));
 if(activityIds.some(id=>counts.get(id)!==1||!eligible.has(id)))throw new Error('Each ID must identify exactly one current programme activity; WBS summaries and level-of-effort rows are not task scope.');
 return {activityIds,reference};
}
export function programmeTaskScope(state:ProjectRuntimeState,kind:ProgrammeTaskKind){
 const b=programmeTaskReviewBasis(state,kind);if(!b)return null;
 return {kind,sourceFingerprint:b.sourceFingerprint,sourceRefs:b.sourceRefs,sourceFilename:b.sourceFilename,selectedCount:b.rows.length,reviewed:!!b.decision,reference:b.decision?.reference??null,basis:b.basis,qualification:b.qualification,
  additionalCandidates:b.additionalCandidates.map(a=>({activityId:a.activityId,name:a.name,status:a.status,basis:'Validation name candidate; excluded until task scope is reviewed.'}))};
}
