import type { ModuleRuntimeResult } from './project-state-types';
import type { ControlIssueAssessment, ControlIssue } from '../../truth-kernel/src';

/** One reader-facing vocabulary; source authority and project performance stay separate. */
export const STATUS_LABELS: Record<string,string> = {
  system_defect:'System failure',source_conflict:'Records disagree',data_quality:'Record needs correction',
  missing_information:'Information needed',comparison_difference:'Positions differ',governance_review:'Approval needed',
  verification_pending:'Check pending',checked:'Checked',established:'Confirmed',not_established:'Not confirmed',
  candidate:'Needs review',governed:'Confirmed',governed_source:'Reported forecast',source:'Reported',source_current:'Current record',source_report:'Reported',unknown:'Not known',partial:'Partly confirmed',
  unavailable:'Not available',not_checked:'Not checked',review_required:'Review needed',conflicted:'Records disagree',
  verified_for_checked_metrics:'Listed checks passed',submitted_unparsed:'Document not yet read',
};
export function issueCounters(a?:ControlIssueAssessment) {
  const c=a?.counts;
  return {system:c?.system_defect??0,source:(c?.source_conflict??0)+(c?.data_quality??0)+(c?.missing_information??0),
    review:(c?.comparison_difference??0)+(c?.governance_review??0),pending:c?.verification_pending??0};
}
const number=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function positionVerdict(result:ModuleRuntimeResult) {
  const d:any=result.data??{},p=d.result??d,a=result.issueAssessment??d.issueAssessment,counts=issueCounters(a);
  const facts:{noticeEventDateMissingCount?:number}={};
  let text='The results, records and follow-up actions for this view are shown below.',rag:'red'|'amber'|'green'|'unknown'='amber';
  let specific=false;
  if(result.status==='blocked'){text='This position cannot yet be calculated. The missing inputs are listed below.';rag='unknown';}
  else if(result.key==='master-dashboard'){
    const metrics=d.metrics??[],get=(k:string)=>metrics.find((m:any)=>m.key===k)?.value;
    const finish=get('submitted-programme-finish'),contract=get('contract-finish');
    const days=typeof finish==='string'&&typeof contract==='string'?(Date.parse(finish.slice(0,10))-Date.parse(contract.slice(0,10)))/86400000:null;
    if(number(days)){rag=days>0?'red':'green';text=days>0?'Submitted completion is '+Math.round(days)+' calendar days after the contract date.':'Submitted completion is within the contract date.';}
    else {rag='unknown';text='Completion against the contract date cannot yet be compared.';}
  } else if(['notices-claims','commercial-claims-notices'].includes(result.key)) {
    // Use the assessed event population. Correspondence also includes determinations
    // and can contain several letters for one event; it is not an event counter.
    const missing=p.noticeEventDateMissingCount??p.position?.claimsNotices?.noticeTimelinessCounts?.event_date_missing;
    if(number(missing))facts.noticeEventDateMissingCount=missing;
    text=number(missing)&&missing>0?missing+' events lack the event dates needed to assess notice timing. Reported claim values remain visible.':'Notice timing, reported claim values and dated determinations have separate evidence bases.';
  } else if(result.key==='windows-analysis') {
    const days=p.projectCompletionMovementDays;
    if(number(days)){rag=days>0?'red':'green';text='Submitted completion '+(days>0?'moved later by '+days:days<0?'improved by '+Math.abs(days):'did not move')+(days===0?'':' calendar days')+'. Window movement does not allocate responsibility to events.';}
  } else if(result.key==='quantity-scurve'){
    const series=p.series??[],hasQuantities=series.length>0||(p.unmappedItemIds?.length??0)>0;
    const installed=series.some((s:any)=>s.points?.some((r:any)=>number(r.actualInstalledQuantity)));
    text=!hasQuantities?'BOQ quantities are not available. Provide the quantity register.':installed?'Installed quantities are available by unit. Check the linked activities and dated installation records.':'BOQ quantities are available. Link them to programme activities and provide dated installation records to measure installed progress.';
  } else if(result.key==='cash-flow'){
    const currencies=p.position?.performance?.cashFlow?.currencies??[];
    const ready=currencies.length>0&&currencies.every((r:any)=>r.sourceReadiness?.netCashReady);
    text=ready?'Actual cash is supported by the dated receipt and expenditure records, separated by currency.':'Certificate amounts are available. Provide the advance payment record and dated receipts and payments to establish actual cash.';
  }
  else if(result.key==='resource-utilization'||result.key==='manhour-scurve')text='Compare demand with capacity for each resource. Hours cover the dates in the register; they may not cover the full programme.';
  const metrics=p.scopeComparison??p.sourceInterpretation?.progressMeasures?.scopeComparison;
  if(['progress-scurve','progress-report','master-dashboard','command-center','pmo-analysis'].includes(result.key)&&metrics&&number(metrics.gapPercentagePoints)){const v=metrics.gapPercentagePoints;rag=rag==='red'||v<0?'red':'green';const progressText=v===0?'Schedule progress on the same activities matches baseline plan.':'Schedule progress on the same activities is '+Math.abs(v).toFixed(2)+' percentage points '+(v<0?'behind':'ahead of')+' baseline plan.';text=result.key==='master-dashboard'?text+' '+progressText:progressText;}
  specific=text!=='The results, records and follow-up actions for this view are shown below.';
  if(counts.system){rag='red';specific=true;text='A CMeng calculation check failed. The affected values need correction before use.';}
  else if(rag==='green'&&(counts.source||counts.pending||counts.review))rag='amber';
  const first=(a?.issues??[]).find((i:ControlIssue)=>i.kind==='system_defect')??(a?.issues??[]).find((i:ControlIssue)=>['source_conflict','data_quality','missing_information'].includes(i.kind))??(a?.issues??[])[0];
  return {schemaVersion:'1.0',facts,specific,rag,label:rag==='red'?'Action required':rag==='green'?'Within the checked target':rag==='unknown'?'Not assessable':'Review needed',text,
    nextAction:result.key==='master-dashboard'&&rag==='red'&&!counts.system?'Agree the recovery plan and assign the delivery actions below.':first?.action??'Review the figures and supporting documents.',owner:result.key==='master-dashboard'&&rag==='red'&&!counts.system?'Project director (assign a person)':first?.owner??'Project controls reviewer',
    basis:'Red: a reported target is exceeded or a calculation check failed. Amber: information or review is incomplete. Green: the stated target and listed checks pass. These colours do not represent an overall project risk score.'};
}
export function withPositionVerdict(result:ModuleRuntimeResult):ModuleRuntimeResult {
  return {...result,data:{...(result.data as object??{}),positionVerdict:positionVerdict(result)}};
}
export function sourceQualityPosition(modules:Map<string,ModuleRuntimeResult>,assessment:ControlIssueAssessment,documents:any[],dataDateIso:string|null) {
  const issues=assessment.issues;
  return {projectionKey:'source_quality',dataDateIso,issueAssessment:assessment,
    sourceIssues:issues.filter(i=>['source_conflict','data_quality','missing_information'].includes(i.kind)),
    systemFailures:issues.filter(i=>i.kind==='system_defect'),reviewActions:issues.filter(i=>['comparison_difference','governance_review'].includes(i.kind)),
    pendingChecks:issues.filter(i=>i.kind==='verification_pending'),
    coverage:[...modules].map(([key,r])=>({key,state:(r.data as any)?.systemEvidenceContract?.state??'not_checked',checks:(r.data as any)?.systemEvidenceContract?.checks??[]})),
    documents:documents.map(d=>({id:d.documentId,name:d.sourceFilename,type:d.documentType,state:d.basisState,uploadedAt:d.uploadedAt})),
    scope:'Confirm conflicting records, provide missing information and assign the follow-up. Calculation checks are listed separately below.'};
}
