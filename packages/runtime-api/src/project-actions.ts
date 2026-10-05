import {projectReviewGroup} from './project-review-groups';
import {boqNumericReview} from './boq-numeric-review';
import {projectControlSchedule} from './canonical-time-claims';
import {createHash} from 'node:crypto';
import type {ControlIssueAssessment,ControlIssue} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';
import {scheduleAuthorityReview} from './schedule-authority';
import {phaseProgrammeState} from './phase-programmes';
import {deliveryPosition} from './delivery-projections';
import {deliveryLabels,deliveryKinds} from '../../delivery-core/src/types';
import {titleForModule} from './registry';
import {deliveryPages} from '../../delivery-core/src/registry';

export interface ProjectAction {
  id:string;category:'confirmation'|'review'|'information';title:string;reason:string;recordCount:number;
  resolution?:{
    kind:'confirm'|'choose'|'upload'|'information';
    requiresUserAction:boolean;
    instruction:string;
    completionRule:string;
  };
  target:{type:'schedule'|'document'|'delivery'|'module'|'upload'|'inline';label:string;documentId?:string;revisionId?:string;phaseId?:string;canConfirm?:boolean;moduleKey?:string;kind?:string;population?:boolean;uploadHint?:string;uploadMode?:'schedule'|'evidence';sourceHash?:string;scheduleRole?:string;needsPurpose?:boolean;approvalRequired?:boolean;suggestedDateIso?:string|null;relationshipOptions?:Array<{value:'new_record'|'replacement'|'amendment';label:string}>;relationshipTargets?:Array<{documentId:string;filename:string;familyKey:string;basisState:string}>};
  issue?:ControlIssue;requestCount?:number;findingIds?:string[];findings?:ControlIssue[];affectedPages?:string[];completionPosition?:unknown;
}
const identity=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);
type ReviewGroup=ReturnType<typeof projectReviewGroup>;
function informationResolution(instruction:string):Pick<ProjectAction,'category'|'resolution'|'target'>{
  return {category:'information',resolution:{kind:'information',requiresUserAction:false,instruction,completionRule:'No user action is required. CMeng will refresh this information automatically when the underlying project evidence or calculation changes.'},target:{type:'inline',label:'Why this is not an action'}};
}
function uploadResolution(label:string,hint:string,instruction:string,uploadMode:'schedule'|'evidence'='evidence'):Pick<ProjectAction,'category'|'resolution'|'target'>{
  return {category:'review',resolution:{kind:'upload',requiresUserAction:true,instruction,completionRule:'This action closes automatically after the uploaded evidence establishes or corrects the required basis.'},target:{type:'upload',label,uploadHint:hint,uploadMode}};
}
function actionResolution(group:ReviewGroup,issues:ControlIssue[],context:{completionPosition?:unknown}={}):Pick<ProjectAction,'category'|'resolution'|'target'>{
  const conflict=issues.some(i=>['source_conflict','data_quality'].includes(i.kind));
  switch(group.key){
    case 'schedule-calculation':
      return informationResolution('CMeng found a difference between submitted dates and its independent calculation. This is a calculation qualification, not something you must confirm. The submitted programme remains the reporting authority unless you explicitly replace it.');
    case 'programme-comparison':
      return informationResolution('A baseline or earlier adopted revision is needed only for baseline/revision comparison. Current programme analysis remains usable. Any uploaded programme that actually needs selection appears separately as a direct programme confirmation action.');
    case 'contract-completion': {
      const completion=context.completionPosition as {submittedFinishIso?:string|null}|undefined;
      const suggestedDateIso=typeof completion?.submittedFinishIso==='string'?completion.submittedFinishIso:null;
      return {
        category:'confirmation',
        resolution:{
          kind:'confirm',
          requiresUserAction:true,
          instruction:suggestedDateIso
            ? 'Confirm the contractual completion date here. The current programme finish is shown only as a suggested candidate; change it if the contract date is different.'
            : 'Enter and confirm the contractual completion date here. Programme and forecast analysis remain available while this date is unconfirmed.',
          completionRule:'This action closes when a contractual completion date is explicitly confirmed.'
        },
        target:{type:'inline',kind:'contract-completion',label:'Confirm contractual completion date',suggestedDateIso}
      };
    }
    case 'resources':
      return group.available&&conflict
        ? uploadResolution('Upload corrected resource evidence','Corrected manpower/resource plan, usage or capacity record','Upload the corrected resource/manpower source that resolves the conflicting or invalid record.')
        : informationResolution('Resource capacity/manpower evidence is optional for schedule analysis. Add it only when you need manpower or capacity calculations.');
    case 'quantities':
      return group.available&&conflict
        ? uploadResolution('Upload corrected quantity evidence','Corrected BOQ / measured quantity source','Upload the corrected BOQ or measurement source that resolves the conflicting quantity basis.')
        : informationResolution('Quantity evidence is optional for schedule analysis. Add BOQ/measurements only when you need quantity-based progress.');
    case 'productivity':
      return group.available&&conflict
        ? uploadResolution('Upload corrected productivity evidence','Corrected quantity / production-rate evidence','Upload the corrected dated quantity or production-rate source.')
        : informationResolution('Productivity evidence is optional. Add it only when you need an independent productivity forecast.');
    case 'risks':
      return conflict
        ? uploadResolution('Upload corrected risk register','Corrected dated risk register','Upload the corrected risk register that resolves the highlighted rating/date conflict.')
        : informationResolution('No user action is required for an unavailable optional risk field. CMeng will use the risk information that is actually established.');
    case 'hse':
      return conflict
        ? uploadResolution('Upload corrected HSE evidence','Corrected dated HSE / exposure record','Upload the corrected HSE source that resolves the highlighted date, status or exposure conflict.')
        : informationResolution('No user action is required for unavailable optional HSE information.');
    case 'quality':
      return conflict
        ? uploadResolution('Upload corrected quality evidence','Corrected NCR / inspection register','Upload the corrected quality register that resolves the highlighted lifecycle/date conflict.')
        : informationResolution('No user action is required for unavailable optional quality information.');
    case 'design-permits':
      return conflict
        ? uploadResolution('Upload corrected design / permit evidence','Corrected RFI, design or permit register','Upload the corrected source that resolves the highlighted design/permit record conflict.')
        : informationResolution('No user action is required for unavailable optional design or permit information.');
    case 'claims':
      return conflict
        ? uploadResolution('Upload corrected claim / notice evidence','Corrected claim, notice, delay-event or determination evidence','Upload the corrected dated source that resolves the highlighted claim/notice/event conflict.')
        : informationResolution('Missing claim/notice evidence limits entitlement analysis but does not block the established programme position.');
    case 'payments':
      return conflict
        ? uploadResolution('Upload corrected payment evidence','Corrected IPC / payment / retention register','Upload the corrected payment source that resolves the highlighted amount, date or series-basis conflict.')
        : informationResolution('Missing optional payment fields remain unavailable; no user action is required unless you need that commercial measure.');
    case 'commercial':
      return conflict
        ? uploadResolution('Upload corrected commercial evidence','Corrected contract / variation / bond / insurance / cost source','Upload the corrected commercial source that resolves the highlighted conflict.')
        : informationResolution('Missing optional commercial information remains unavailable; it does not require a user confirmation.');
    case 'programme-information':
      return conflict
        ? uploadResolution('Upload corrected programme','Corrected current programme','Upload a corrected programme if the source itself is wrong. CMeng will not ask you to manually repair source schedule fields in another page.','schedule')
        : informationResolution('The programme does not establish this optional field. CMeng will keep the measure unavailable rather than ask you to invent it.');
    default:
      return conflict
        ? uploadResolution('Upload corrected evidence','Corrected source evidence','Upload the corrected source that resolves this conflict. CMeng will recalculate automatically.')
        : informationResolution('No direct user decision is required for this item.');
  }
}

export function programmeActions(state:ProjectRuntimeState):ProjectAction[]{
  const items:ProjectAction[]=[];
  for(const [phaseId,scope]of [[null,state],...(state.phaseProgrammes??[]).map(p=>[p.phaseId,phaseProgrammeState(state,p.phaseId)])] as Array<[string|null,ProjectRuntimeState]>){
    const review=scheduleAuthorityReview(scope),prefix=phaseId?'Phase '+phaseId+': ':'';
    const add=(revisionId:string,documentId:string,filename:string,canConfirm:boolean,reason:string,current=false)=>{
      const stored=scope.schedules.find(r=>r.revision.revisionId===revisionId),model=stored?.revision.model;
      const source=scope.evidenceDocuments.find(d=>d.documentId===documentId);
      const missingDate=!model?.dataDateIso;
      const hashMismatch=!!stored&&!!source&&stored.sourceHashSha256!==source.sourceHashSha256;
      if(!canConfirm&&(missingDate||hashMismatch)){
        items.push({id:'schedule:'+identity([phaseId,revisionId]),category:'review',title:prefix+'Replace unreadable reporting programme',
          reason:filename+'. '+reason+' '+(model?model.activities.length+' activities recognised; Data Date '+(model.dataDateIso??'not supplied')+'.':''),
          recordCount:1,resolution:{kind:'upload',requiresUserAction:true,instruction:'Upload a corrected current programme here. CMeng will process it and use it only after the source is valid.',completionRule:'The action closes when a valid reporting programme is established.'},
          target:{type:'upload',label:'Upload corrected programme',uploadHint:'Corrected current programme',uploadMode:'schedule',...phaseId?{phaseId}:{}}});
        return;
      }
      const needsPurpose=!canConfirm;
      items.push({id:'schedule:'+identity([phaseId,revisionId]),category:'confirmation',title:prefix+(current?'Confirm the schedule used for reporting':'Confirm the uploaded schedule'),reason:filename+'. '+reason+' '+(model?model.activities.length+' activities recognised; Data Date '+(model.dataDateIso??'not supplied')+'.':''),
        recordCount:1,
        resolution:{kind:needsPurpose?'choose':'confirm',requiresUserAction:true,instruction:needsPurpose?'Choose the programme purpose here and provide an approval reference only if you select a baseline. Then CMeng will make the programme current in the same action.':'Confirm here that CMeng should use this programme for the current reporting position.',completionRule:'The action closes when the programme is explicitly selected as the reporting basis.'},
        target:{type:'schedule',label:needsPurpose?'Confirm purpose and use programme':'Use this programme for reporting',revisionId,documentId,canConfirm,
          ...((source?.sourceHashSha256??stored?.sourceHashSha256)?{sourceHash:(source?.sourceHashSha256??stored?.sourceHashSha256)!}:{}),
          scheduleRole:stored?.role??'update',needsPurpose,
          approvalRequired:needsPurpose&&['baseline','revised_baseline'].includes(stored?.role??''),...phaseId?{phaseId}:{}}});
    };
    if(review.state==='pending_review'&&review.currentRevisionId&&review.documentId){
      const revision=scope.schedules.find(r=>r.revision.revisionId===review.currentRevisionId)!;
      const canConfirm=!!review.dataDateIso&&!(revision.roleConfirmed&&['baseline','revised_baseline'].includes(revision.role)&&!revision.approvalReference?.trim());
      add(review.currentRevisionId,review.documentId,revision.sourceFilename??revision.revision.label??'Selected schedule',canConfirm,canConfirm?'CMeng is already using this schedule. Confirm that this is your reporting selection.':'Confirm its programme purpose and approval basis here before CMeng makes it current.',true);
    }
    for(const p of review.pendingSchedules)add(p.revisionId,p.documentId,p.filename,p.canAdopt,p.adoptionBlocker??(review.currentRevisionId?'This upload has not replaced the current reporting schedule.':'Choose the schedule to use for project reporting.'));
    if(review.state==='missing'&&!review.pendingSchedules.length)items.push({id:'schedule-missing:'+identity(phaseId),category:'review',title:prefix+'Add a reporting schedule',reason:'A schedule is needed to establish the reporting date and programme results.',recordCount:0,
      resolution:{kind:'upload',requiresUserAction:true,instruction:'Upload the current reporting programme here. CMeng will process it and establish the schedule position.',completionRule:'The action closes when a valid reporting programme is uploaded and selected.'},
      target:{type:'upload',label:'Upload reporting programme',uploadHint:'Current reporting programme',uploadMode:'schedule',...phaseId?{phaseId}:{}}});
  }
  return items;
}
export function projectActions(state:ProjectRuntimeState,assessment:ControlIssueAssessment,context:{completionPosition?:unknown}={}){
  const actions=programmeActions(state);
  const numericReview=boqNumericReview(state);
  if(numericReview.pendingCount)actions.push({id:'boq-numeric-review',category:'review',title:'Review BOQ readings together',
    reason:numericReview.pendingCount+' item readings remain to check across '+numericReview.sources.filter(s=>s.pendingCount).length+' source(s). '+numericReview.automaticCount+' native rows need no numeric confirmation; '+numericReview.confirmedCount+' reviewed rows are already saved.',
    recordCount:numericReview.pendingCount,resolution:{kind:'choose',requiresUserAction:true,
      instruction:'Open one review, check the source and save the reviewed rows together. Each decision is reused in quantities, reports and Ask.',
      completionRule:'Only unresolved readings remain in this action; accepted readings are not requested again.'},
    target:{type:'inline',kind:'boq-numeric-review',label:'Review BOQ readings'}});
  for(const d of state.evidenceDocuments){
    if(d.category==='schedule'||!['candidate','active','additive'].includes(d.basisState))continue;
    if(d.basisState==='candidate'){
      {
        const targets=state.evidenceDocuments.filter(t=>t.documentId!==d.documentId&&['active','additive'].includes(t.basisState));
        const sameFamily=targets.filter(t=>t.familyKey===d.familyKey);
        const baseContracts=targets.filter(t=>t.familyKey==='contract:base');
        const options:Array<{value:'new_record'|'replacement'|'amendment';label:string}>=[{value:'new_record',label:'New record'},...(sameFamily.length?[{value:'replacement' as const,label:'Replacement'}]:[]),...(d.documentType==='contract_amendment'&&baseContracts.length?[{value:'amendment' as const,label:'Contract amendment'}]:[])];
        actions.push({id:'document:'+d.documentId,category:'confirmation',title:'Confirm how this document updates the project',reason:d.sourceFilename+'. Choose once; CMeng will apply the relationship and refresh the project.',recordCount:1,
          resolution:{kind:'choose',requiresUserAction:true,instruction:'Choose how this uploaded document relates to the current project evidence.',completionRule:'The action closes immediately after the relationship is saved.'},
          target:{type:'document',documentId:d.documentId,label:'Confirm relationship',sourceHash:d.sourceHashSha256,relationshipOptions:options,
            relationshipTargets:targets.map(t=>({documentId:t.documentId,filename:t.sourceFilename,familyKey:t.familyKey,basisState:t.basisState}))}});
      }
    }
  }
  const delivery=deliveryPosition(state);
  for(const kind of deliveryKinds){const records=delivery.records.filter(r=>r.kind===kind&&!['superseded','scenario'].includes(r.state));if(!records.length)continue;
    const pending=records.filter(r=>['extracted_candidate','working','conflicted','stale','source_evidence','not_established'].includes(r.state)),moduleKey=deliveryPages.find(p=>p[3]===kind)?.[0]??'delivery-control';
    if(pending.length){/* Candidate/stale Delivery rows remain supporting information; no page-loop action is created. */}
    else if(delivery.populations[kind]?.state!=='established')actions.push({id:'delivery-population:'+kind,category:'confirmation',title:'Confirm complete '+deliveryLabels[kind].toLowerCase()+' population',reason:records.length+' governed record(s) are available. Confirm only if this is the complete applicable population for reporting percentages.',recordCount:records.length,
      resolution:{kind:'confirm',requiresUserAction:true,instruction:'Confirm complete population here. If it is not complete, do nothing; CMeng will keep percentages unconfirmed.',completionRule:'The action closes immediately after population completeness is confirmed.'},
      target:{type:'delivery',kind,moduleKey,population:true,label:'Confirm complete population'}});
  }
  const groups=new Map<string,{group:ReturnType<typeof projectReviewGroup>;issues:ControlIssue[]}>();
  const systemItems=assessment.issues.filter(i=>i.owner==='CMeng'||['system_defect','verification_pending'].includes(i.kind));
  for(const issue of assessment.issues){
    if(systemItems.includes(issue))continue;
    if(/PROGRAMME_ADOPTION|CURRENT_PROGRAMME_ADOPTION|SCHEDULE_ADOPTION/.test(issue.code)&&actions.some(a=>a.target.type==='schedule'))continue;
    const group=projectReviewGroup(issue,state),existing=groups.get(group.key);
    if(existing){existing.issues.push(issue);existing.group.available ||= group.available;}else groups.set(group.key,{group,issues:[issue]});
  }
  const information:ProjectAction[]=[];
  for(const {group,issues} of groups.values()){
    // Once a contractual completion date has been explicitly governed, stale
    // missing-only findings must not recreate the same confirmation action.
    // A later genuine source conflict/review remains visible and actionable.
    const confirmedContractDate=state.controls.contractTimeBasis?.contractualCompletionIso&&state.controls.contractTimeBasis.contractualCompletionState==='official';
    if(group.key==='contract-completion'&&confirmedContractDate&&issues.every(issue=>issue.kind==='missing_information'))continue;
    const refs=[...new Set(issues.flatMap(i=>i.sourceRefs))],pages=[...new Set(issues.flatMap(i=>i.moduleKeys))];
    const resolution=actionResolution(group,issues,context);
    const item:ProjectAction={id:'matter:'+group.key,...resolution,title:group.title,reason:group.note,
      recordCount:refs.length,requestCount:issues.length,findings:issues,findingIds:issues.map(i=>identity([i.kind,i.code,i.summary,i.detail,i.sourceRefs])),affectedPages:pages,
      ...(group.key==='schedule-calculation'?{completionPosition:context.completionPosition}:{})};
    (item.category==='information'?information:actions).push(item);
  }

  const unique=[...new Map(actions.map(a=>[a.id,a])).values()];
  const programme=projectControlSchedule(state),model=programme?.revision.model;
  return {projectId:state.projectId,projectVersion:state.version,checkedAt:new Date().toISOString(),actionCount:unique.length,actions:unique,information,
    analysis:{state:model?'analysed':state.schedules.length?'programme_selection_needed':'no_programme',activityCount:model?.activities.length??null,dataDateIso:model?.dataDateIso??null,sourceFilename:programme?.sourceFilename??null},
    systemCheckCount:systemItems.length,scope:'One matter per underlying information or decision group. Affected pages and all original findings are retained inside each matter. Missing optional domains are shown separately as coverage information. Decisions refresh from the current project records.'};
}
