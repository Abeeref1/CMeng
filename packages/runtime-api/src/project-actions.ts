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
  target:{type:'schedule'|'document'|'delivery'|'module'|'upload'|'inline';label:string;documentId?:string;revisionId?:string;phaseId?:string;canConfirm?:boolean;moduleKey?:string;kind?:string;population?:boolean};
  issue?:ControlIssue;requestCount?:number;findingIds?:string[];findings?:ControlIssue[];affectedPages?:string[];completionPosition?:unknown;
}
const identity=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);
export function programmeActions(state:ProjectRuntimeState):ProjectAction[]{
  const items:ProjectAction[]=[];
  for(const [phaseId,scope]of [[null,state],...(state.phaseProgrammes??[]).map(p=>[p.phaseId,phaseProgrammeState(state,p.phaseId)])] as Array<[string|null,ProjectRuntimeState]>){
    const review=scheduleAuthorityReview(scope),prefix=phaseId?'Phase '+phaseId+': ':'';
    const add=(revisionId:string,documentId:string,filename:string,canConfirm:boolean,reason:string,current=false)=>items.push({id:'schedule:'+identity([phaseId,revisionId]),category:'confirmation',title:prefix+(current?'Confirm the schedule used for reporting':'Review the uploaded schedule'),reason:filename+'. '+reason+' '+(()=>{const m=scope.schedules.find(r=>r.revision.revisionId===revisionId)?.revision.model;return m?m.activities.length+' activities recognised; Data Date '+(m.dataDateIso??'not supplied')+'.':'';})(),recordCount:1,target:{type:'schedule',label:canConfirm?'Use this schedule for reporting':'Review schedule details',revisionId,documentId,canConfirm,...phaseId?{phaseId}:{}}});
    if(review.state==='pending_review'&&review.currentRevisionId&&review.documentId){const revision=scope.schedules.find(r=>r.revision.revisionId===review.currentRevisionId)!;const canConfirm=!!review.dataDateIso&&!(revision.roleConfirmed&&['baseline','revised_baseline'].includes(revision.role)&&!revision.approvalReference?.trim());add(review.currentRevisionId,review.documentId,revision.sourceFilename??revision.revision.label??'Selected schedule',canConfirm,canConfirm?'CMeng is already using this schedule. Confirm that this is your reporting selection.':'Review its reporting date and programme purpose before confirming.',true);}
    for(const p of review.pendingSchedules)add(p.revisionId,p.documentId,p.filename,p.canAdopt,p.adoptionBlocker??(review.currentRevisionId?'This upload has not replaced the current reporting schedule. Review its purpose and date before selecting it.':'Choose the schedule to use for project reporting.'));
    if(review.state==='missing'&&!review.pendingSchedules.length)items.push({id:'schedule-missing:'+identity(phaseId),category:'information',title:prefix+'Add a reporting schedule',reason:'A schedule is needed to establish the reporting date and programme results.',recordCount:0,target:{type:'upload',label:'Add schedule',...phaseId?{phaseId}:{}}});
  }
  return items;
}
export function projectActions(state:ProjectRuntimeState,assessment:ControlIssueAssessment,context:{completionPosition?:unknown}={}){
  const actions=programmeActions(state);
  for(const d of state.evidenceDocuments){
    if(d.category==='schedule'||!['candidate','active','additive'].includes(d.basisState))continue;
    if(d.basisState==='candidate'){
      actions.push({id:'document:'+d.documentId,category:'confirmation',title:'Confirm how this document updates the project',reason:d.sourceFilename+'. Select whether it is a new record, a replacement or a contract amendment.',recordCount:1,target:{type:'document',documentId:d.documentId,label:'Review this document'}});
    }
  }
  const delivery=deliveryPosition(state);
  for(const kind of deliveryKinds){const records=delivery.records.filter(r=>r.kind===kind&&!['superseded','scenario'].includes(r.state));if(!records.length)continue;
    const pending=records.filter(r=>['extracted_candidate','working','conflicted','stale','source_evidence','not_established'].includes(r.state)),moduleKey=deliveryPages.find(p=>p[3]===kind)?.[0]??'delivery-control';
    if(pending.length)actions.push({id:'delivery-review:'+kind,category:'review',title:'Review '+deliveryLabels[kind].toLowerCase(),reason:pending.length+' records need a decision or have changed since their previous review. Open the register to review each record and its source.',recordCount:pending.length,target:{type:'delivery',kind,moduleKey,label:'Review records'}});
    else if(delivery.populations[kind]?.state!=='established')actions.push({id:'delivery-population:'+kind,category:'confirmation',title:'Confirm the complete '+deliveryLabels[kind].toLowerCase()+' list',reason:'The records have been reviewed. Confirm whether they cover the complete required scope before percentages are reported.',recordCount:records.length,target:{type:'delivery',kind,moduleKey,population:true,label:'Review and confirm complete list'}});
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
    const item:ProjectAction={id:'matter:'+group.key,category:group.available?'review':'information',title:group.title,reason:group.note,
      recordCount:refs.length,requestCount:issues.length,findings:issues,findingIds:issues.map(i=>identity([i.kind,i.code,i.summary,i.detail,i.sourceRefs])),affectedPages:pages,
      ...(group.key==='schedule-calculation'?{completionPosition:context.completionPosition}:{}),target:{type:'inline',label:group.key==='schedule-calculation'?'Review difference':'Review details here'}};
    (group.available?actions:information).push(item);
  }

  const unique=[...new Map(actions.map(a=>[a.id,a])).values()];
  const programme=projectControlSchedule(state),model=programme?.revision.model;
  return {projectId:state.projectId,projectVersion:state.version,checkedAt:new Date().toISOString(),actionCount:unique.length,actions:unique,information,
    analysis:{state:model?'analysed':state.schedules.length?'programme_selection_needed':'no_programme',activityCount:model?.activities.length??null,dataDateIso:model?.dataDateIso??null,sourceFilename:programme?.sourceFilename??null},
    systemCheckCount:systemItems.length,scope:'One matter per underlying information or decision group. Affected pages and all original findings are retained inside each matter. Missing optional domains are shown separately as coverage information. Decisions refresh from the current project records.'};
}
