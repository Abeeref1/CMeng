import {projectReviewGroup} from './project-review-groups';
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
    kind:'confirm'|'choose'|'upload'|'correct'|'open_register'|'compare'|'information';
    requiresUserAction:boolean;
    instruction:string;
    completionRule:string;
  };
  target:{type:'schedule'|'document'|'delivery'|'module'|'upload'|'inline';label:string;documentId?:string;revisionId?:string;phaseId?:string;canConfirm?:boolean;moduleKey?:string;kind?:string;population?:boolean;uploadHint?:string};
  issue?:ControlIssue;requestCount?:number;findingIds?:string[];findings?:ControlIssue[];affectedPages?:string[];completionPosition?:unknown;
}
const identity=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);
type ReviewGroup=ReturnType<typeof projectReviewGroup>;
function actionResolution(group:ReviewGroup,issues:ControlIssue[]):Pick<ProjectAction,'category'|'resolution'|'target'>{
  const conflict=issues.some(i=>['source_conflict','data_quality'].includes(i.kind));
  const comparison=issues.some(i=>i.kind==='comparison_difference');
  const upload=(label:string,hint:string,instruction:string,required=false):Pick<ProjectAction,'category'|'resolution'|'target'>=>({
    category:required?'review':'information',
    resolution:{kind:'upload',requiresUserAction:required,instruction,completionRule:'CMeng will recalculate this matter automatically after the required project information is supplied and governed.'},
    target:{type:'upload',label,uploadHint:hint}
  });
  const open=(moduleKey:string,label:string,instruction:string,kind:ProjectAction['resolution']['kind']='open_register',required=true):Pick<ProjectAction,'category'|'resolution'|'target'>=>({
    category:required?'review':'information',
    resolution:{kind,requiresUserAction:required,instruction,completionRule:required?'Resolve or confirm the underlying record/basis in the connected page. CMeng will then refresh this matter automatically.':'No confirmation is required. This item will update automatically when the underlying project evidence changes.'},
    target:{type:'module',moduleKey,label}
  });
  switch(group.key){
    case 'schedule-calculation':
      return open('independent-forecast','Open calculation comparison',
        'No approval is required from you. CMeng continues to use the submitted programme as the reporting basis. Open the comparison only if you want to inspect the calendar/date differences; source constraints not applied by CMeng remain a CMeng calculation limitation, not a user confirmation.',
        'compare',false);
    case 'contract-completion':
      return group.available
        ? open('contract-particulars-bonds','Open contract particulars','Confirm which dated contract/amendment establishes the contractual completion date. If the applicable date is not in the supplied documents, upload the missing contract or amendment.','choose',true)
        : upload('Upload contract / amendment','Contract or amendment containing the applicable contractual completion date','Upload or identify the dated contract source only if you need contractual/EOT comparisons. Programme forecasting remains usable without it.',true);
    case 'programme-comparison':
      return group.available
        ? open('schedule-change-report','Open programme comparison','Select/confirm the baseline or earlier reporting revision used for comparison. Do not treat embedded target dates as a confirmed baseline.','choose',true)
        : upload('Upload baseline / prior programme','Confirmed baseline or prior adopted programme','Supply a comparable baseline/prior programme only if baseline or revision slippage is required.',false);
    case 'resources':
      return group.available
        ? open('resource-utilization','Open Resources','Review the specific resource rows with missing/conflicting capacity, usage or period basis. Correct the source record if it is wrong; otherwise leave the unavailable measure unresolved.','correct',conflict)
        : upload('Add resource / manpower evidence','Periodised manpower/resource plan, dated usage and capacity where available','This information is only required for manpower/capacity calculations. You may leave it unresolved and continue using schedule analysis.',false);
    case 'quantities':
      return group.available
        ? open('quantity-scurve','Open Installed Quantities','Review the BOQ/measurement/activity links that are missing or conflicting. Confirm/correct the mapping only where the source supports it.','correct',conflict)
        : upload('Add BOQ / measured quantities','BOQ plus dated installed/measurement evidence and activity links where available','Upload quantity evidence only if you need quantity-based progress. Schedule progress remains separate.',false);
    case 'productivity':
      return group.available
        ? open('challenge-contract','Open productivity analysis','Review the quantities, production rates and work-package dates used by the productivity forecast. Correct only unsupported or conflicting source inputs.','correct',conflict)
        : upload('Add productivity evidence','Dated quantities, production rates and relevant work-package dates','Upload productivity evidence only if you need an independent productivity forecast.',false);
    case 'risks':
      return open('delivery-risks','Open Risk Register','Review the exact dated risk records and rating inputs highlighted by CMeng. Correct conflicting probability/impact/rating evidence or leave an unavailable field unresolved.','correct',conflict);
    case 'hse':
      return open('delivery-hse','Open Construction HSE','Review the exact incident/exposure records. Correct missing dates or mismatched exposure only when source evidence exists.','correct',conflict);
    case 'quality':
      return open('delivery-quality','Open Quality & Inspections','Review the highlighted NCR/inspection record and its dated status. Correct the source lifecycle only when supported.','correct',conflict);
    case 'design-permits':
      return open(/permit/.test(issues.map(i=>i.summary+' '+i.detail).join(' ').toLowerCase())?'delivery-permits':'delivery-design',
        /permit/.test(issues.map(i=>i.summary+' '+i.detail).join(' ').toLowerCase())?'Open Permits & Authorities':'Open RFI & Design',
        'Review the exact readiness record and its date/status. Add or correct the linked record only where evidence exists.','correct',conflict);
    case 'claims':
      return open('notices-claims','Open Notice / Claim evidence','Review the dated event, notice, determination and activity links. Confirm/correct only source-backed relationships; CMeng must not infer entitlement from a missing link.','correct',conflict||comparison);
    case 'payments':
      return open('payments','Open Payments','Review the exact certificate/payment/retention record and its dated lifecycle. Correct the source series basis, dates or amounts only where the evidence supports it.','correct',conflict);
    case 'commercial':
      return open('contract-particulars-bonds','Open Commercial / Contract controls','Review the exact contract, variation, bond, insurance or currency record identified below. Correct/confirm the source basis rather than entering a substitute value.','correct',conflict);
    case 'programme-information':
      return open('activity-analytics','Open Activity Review','Review the exact programme fields highlighted below. If the source genuinely does not contain the field, leave it unresolved; do not create a value just to clear the item.','correct',conflict);
    default:
      if(group.available)return {category:'review',resolution:{kind:'correct',requiresUserAction:true,instruction:'Open the supporting details below and correct or confirm the specific source record identified by CMeng.',completionRule:'The matter closes automatically when the underlying evidence is corrected or confirmed.'},target:{type:'inline',label:'Show exact record and required correction'}};
      return {category:'information',resolution:{kind:'information',requiresUserAction:false,instruction:'No action is required unless you need this unavailable measure. CMeng will continue using the evidence that is established.',completionRule:'This information item disappears automatically if the missing evidence is later supplied.'},target:{type:'inline',label:'Show why this is unavailable'}};
  }
}

export function programmeActions(state:ProjectRuntimeState):ProjectAction[]{
  const items:ProjectAction[]=[];
  for(const [phaseId,scope]of [[null,state],...(state.phaseProgrammes??[]).map(p=>[p.phaseId,phaseProgrammeState(state,p.phaseId)])] as Array<[string|null,ProjectRuntimeState]>){
    const review=scheduleAuthorityReview(scope),prefix=phaseId?'Phase '+phaseId+': ':'';
    const add=(revisionId:string,documentId:string,filename:string,canConfirm:boolean,reason:string,current=false)=>items.push({id:'schedule:'+identity([phaseId,revisionId]),category:'confirmation',title:prefix+(current?'Confirm the schedule used for reporting':'Review the uploaded schedule'),reason:filename+'. '+reason+' '+(()=>{const m=scope.schedules.find(r=>r.revision.revisionId===revisionId)?.revision.model;return m?m.activities.length+' activities recognised; Data Date '+(m.dataDateIso??'not supplied')+'.':'';})(),recordCount:1,
      resolution:{kind:canConfirm?'confirm':'choose',requiresUserAction:true,instruction:canConfirm?'Confirm that this is the programme CMeng should use for the current reporting position.':'Open the programme details and resolve its purpose/date before CMeng can use it for reporting.',completionRule:'The action closes when a valid reporting programme is explicitly selected.'},
      target:{type:'schedule',label:canConfirm?'Use this schedule for reporting':'Review schedule details',revisionId,documentId,canConfirm,...phaseId?{phaseId}:{}}});
    if(review.state==='pending_review'&&review.currentRevisionId&&review.documentId){const revision=scope.schedules.find(r=>r.revision.revisionId===review.currentRevisionId)!;const canConfirm=!!review.dataDateIso&&!(revision.roleConfirmed&&['baseline','revised_baseline'].includes(revision.role)&&!revision.approvalReference?.trim());add(review.currentRevisionId,review.documentId,revision.sourceFilename??revision.revision.label??'Selected schedule',canConfirm,canConfirm?'CMeng is already using this schedule. Confirm that this is your reporting selection.':'Review its reporting date and programme purpose before confirming.',true);}
    for(const p of review.pendingSchedules)add(p.revisionId,p.documentId,p.filename,p.canAdopt,p.adoptionBlocker??(review.currentRevisionId?'This upload has not replaced the current reporting schedule. Review its purpose and date before selecting it.':'Choose the schedule to use for project reporting.'));
    if(review.state==='missing'&&!review.pendingSchedules.length)items.push({id:'schedule-missing:'+identity(phaseId),category:'review',title:prefix+'Add a reporting schedule',reason:'A schedule is needed to establish the reporting date and programme results.',recordCount:0,
      resolution:{kind:'upload',requiresUserAction:true,instruction:'Upload the current reporting programme. CMeng needs this to establish the Data Date and schedule position.',completionRule:'The action closes when a valid reporting programme is uploaded and selected.'},
      target:{type:'upload',label:'Upload reporting schedule',uploadHint:'Current reporting programme',...phaseId?{phaseId}:{}}});
  }
  return items;
}
export function projectActions(state:ProjectRuntimeState,assessment:ControlIssueAssessment,context:{completionPosition?:unknown}={}){
  const actions=programmeActions(state);
  for(const d of state.evidenceDocuments){
    if(d.category==='schedule'||!['candidate','active','additive'].includes(d.basisState))continue;
    if(d.basisState==='candidate'){
      actions.push({id:'document:'+d.documentId,category:'confirmation',title:'Confirm how this document updates the project',reason:d.sourceFilename+'. Select whether it is a new record, a replacement or a contract amendment.',recordCount:1,
        resolution:{kind:'choose',requiresUserAction:true,instruction:'Choose New record, Replacement or Amendment in the connected document review. CMeng will not guess this relationship.',completionRule:'The action closes when the document relationship is explicitly confirmed.'},
        target:{type:'document',documentId:d.documentId,label:'Choose document relationship'}});
    }
  }
  const delivery=deliveryPosition(state);
  for(const kind of deliveryKinds){const records=delivery.records.filter(r=>r.kind===kind&&!['superseded','scenario'].includes(r.state));if(!records.length)continue;
    const pending=records.filter(r=>['extracted_candidate','working','conflicted','stale','source_evidence','not_established'].includes(r.state)),moduleKey=deliveryPages.find(p=>p[3]===kind)?.[0]??'delivery-control';
    if(pending.length)actions.push({id:'delivery-review:'+kind,category:'review',title:'Review '+deliveryLabels[kind].toLowerCase(),reason:pending.length+' records need a decision or have changed since their previous review. Open the register to review each record and its source.',recordCount:pending.length,
      resolution:{kind:'correct',requiresUserAction:true,instruction:'Open the connected register. For each highlighted record, confirm/correct its state from the source or leave it unresolved if evidence is insufficient.',completionRule:'The action closes when no applicable record remains candidate, conflicted, stale or awaiting review.'},
      target:{type:'delivery',kind,moduleKey,label:'Open '+deliveryLabels[kind]+' register'}});
    else if(delivery.populations[kind]?.state!=='established')actions.push({id:'delivery-population:'+kind,category:'confirmation',title:'Confirm the complete '+deliveryLabels[kind].toLowerCase()+' list',reason:'The records have been reviewed. Confirm whether they cover the complete required scope before percentages are reported.',recordCount:records.length,
      resolution:{kind:'confirm',requiresUserAction:true,instruction:'Review the connected register, then confirm Complete population only if all applicable records are represented. Otherwise keep it unconfirmed.',completionRule:'The action closes only after the complete population is explicitly confirmed.'},
      target:{type:'delivery',kind,moduleKey,population:true,label:'Review list and confirm completeness'}});
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
    const refs=[...new Set(issues.flatMap(i=>i.sourceRefs))],pages=[...new Set(issues.flatMap(i=>i.moduleKeys))];
    const resolution=actionResolution(group,issues);
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
