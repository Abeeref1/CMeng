import { summarizeControlIssues, type ControlIssue, type ControlIssueKind } from '../../truth-kernel/src';
import type { ModuleRuntimeResult } from './project-state-types';
import type { CrossModuleCertification } from './certification';

type Consistency = Pick<CrossModuleCertification,'state'|'failedCheckIds'|'checkCount'> & Partial<Pick<CrossModuleCertification,'checks'>>;

/** Classification uses evidence states and failed checks, never a project name,
 * desired result, record count or traffic-light colour. */
export function assessModuleIssues(result: ModuleRuntimeResult, consistency: Consistency) {
  const d=result.data as any, issues:ControlIssue[]=[];
  const variationGroups=d?.position?.variationBasisReview?.groups??[];
  const variationConflictCode='DATED_VARIATION_LEDGER_VS_SOURCE_AGGREGATE_CONFLICT';
  const ownsVariationReview=['cost-forecast','commercial-overview','variations-change','contract-particulars-bonds'].includes(result.key);
  const add=(kind:ControlIssueKind,code:string,summary:string,detail:string,action:string,path:string,
    owner:ControlIssue['owner']='Project evidence owner',sourceRefs:string[]=[],checkIds:string[]=[])=>{
    issues.push({kind,code,summary,detail,action,owner,moduleKeys:[result.key],evidencePaths:[path],sourceRefs,checkIds});
  };
  const integrity=d?.systemEvidenceContract;
  if(result.engineState==='failed'||integrity?.state==='failed') {
    const failed=(integrity?.checks??[]).filter((c:any)=>c.passed===false);
    add('system_defect','CALCULATION_CHECK_FAILED','CMeng calculation check failed',
      failed.length?failed.map((c:any)=>c.metric+': expected '+JSON.stringify(c.expected)+', actual '+JSON.stringify(c.actual)).join('; '):result.reason??'The calculation engine reported failure.',
      'Correct the implementation and rerun the failed checks before using the affected result.','systemEvidenceContract','CMeng',[],failed.map((c:any)=>c.metric));
  } else if(integrity?.state!=='verified_for_checked_metrics') {
    add('verification_pending','CALCULATION_NOT_VERIFIED','CMeng calculation verification incomplete',
      'No completed calculation certification is established for this module. This is a verification gap, not proof that the answer is wrong.',
      'CMeng must complete the relevant calculation checks; do not relabel this as missing contractor data.','systemEvidenceContract','CMeng');
  }
  if(consistency.state==='fail') {
    const failures=consistency.checks?.filter(c=>c.state==='fail');
    add('system_defect','CROSS_MODULE_CONTRADICTION','CMeng consistency check failed',
      failures?.map(c=>c.checkId+': '+c.detail).join('; ')||consistency.failedCheckIds.join(', '),
      'Reconcile the failed same-basis values or reporting contracts in the shared producers.','crossModuleConsistency','CMeng',[],consistency.failedCheckIds);
  }
  const reconciliation=d?.challenge?.reconciliationState;
  if(reconciliation==='material_difference') add('comparison_difference','SUBMITTED_INDEPENDENT_DIFFERENCE','Submitted and independent positions differ',
    'The two authorities produce different positions. A difference alone is not a system contradiction or proven source error.',
    'Compare dates, populations, calendars, assumptions and authority; record the explanation before adoption.','challenge','Project controls reviewer');
  if(reconciliation==='conflicting_evidence') add('source_conflict','COMPARABLE_SOURCE_CONFLICT','Comparable source assertions conflict',
    'The challenge resolver identified incompatible source assertions for the comparison.',
    'Reconcile the conflicting assertions and retain the selected authority and source references.','challenge');
  if(reconciliation==='submitted_missing') add('missing_information','COMPARABLE_ASSERTION_MISSING','Comparable submitted assertion not established',
    'The required comparison value is absent or not established. This does not mean the contractor submitted no documents.',
    'Identify the comparable submitted value and its date, population and authority, or explicitly mark this comparison not applicable.','challenge');
  const noticeInputsMissing=result.key==='notices-claims'&&integrity?.state==='verified_for_checked_metrics'&&d.noticeEventDateMissingCount>0;
  if(noticeInputsMissing)add('missing_information','NOTICE_TRIGGER_DATES_MISSING','Event dates are needed for notice assessment',
    d.noticeEventDateMissingCount+' events have no event/awareness date. Population, claimed-day retention and assessable timing arithmetic have passed the listed checks.',
    'Supply the dated event/awareness evidence and dated claim assessments, then assess each applicable contract rule.','events.eventStartIso');
  if(!noticeInputsMissing&&(reconciliation==='independent_unavailable'||reconciliation==='not_checked'||!reconciliation)) add('verification_pending','INDEPENDENT_COMPARISON_NOT_ESTABLISHED','Independent comparison not established',
    'CMeng has not established an independent value for this comparison.',
    'Establish the independent calculation and identify any specific input dependency. Do not blame a missing contractor submission.','challenge','CMeng');
  if(result.evidenceState==='missing'||!d) add('missing_information','REQUIRED_EVIDENCE_MISSING','Required information not established',
    result.reason??result.dependencies.join(', '),'Provide the identified source evidence; missing values remain unavailable.','evidenceState');
  if(result.evidenceState==='conflicted') add('source_conflict','EVIDENCE_STATE_CONFLICTED','Source evidence conflicts',
    result.reason??'The evidence resolver reported a conflict.','Review the source assertions and govern the applicable evidence.','evidenceState');

  // Walk the owning projection. Commercial modules share an entire position but
  // expose their owned evidence in focus; unrelated missing registers must not
  // turn every commercial page into the same warning.
  const visited=new WeakSet<object>();
  const walk=(value:any,path:string,depth:number)=>{
    if(!value||typeof value!=='object'||depth>9||visited.has(value))return;
    visited.add(value);
    if(Array.isArray(value)){for(const item of value)walk(item,path+'['+(typeof item?.topic==='string'?'topic='+item.topic:'*')+']',depth+1);return;}
    const diagnostics=(Array.isArray(value.diagnostics)?value.diagnostics:[]).filter((s:unknown)=>typeof s==='string') as string[];
    const rawRefs=value.sourceRefs??value.basis?.sourceRefs??value.evidenceRefs;
    const refs=(Array.isArray(rawRefs)?rawRefs:[]).filter((s:unknown)=>typeof s==='string') as string[];
    const field=path.replace(/\[\*\]/g,'').split('.').slice(-2).join(' · ').replace(/([a-z])([A-Z])/g,'$1 $2')+(typeof value.topic==='string'?' · '+value.topic:'');
    const conflict=diagnostics.filter(s=>/(?:^|_)(CONFLICT|CONFLICTING|CONFLICTED)(?:_|:|$)/.test(s)&&!(variationGroups.length&&s===variationConflictCode));
    const invalid=diagnostics.filter(s=>/(?:^|_)(INVALID|MALFORMED|DUPLICATE|AMBIGUOUS|BROKEN|MISMATCH)(?:_|:|$)|CLOSURE_BEFORE_RAISED_DATE/.test(s));
    const missingInput=diagnostics.filter(s=>/REQUIRED|NOT_A_RECONCILED|IS_NOT_GROSS|UNKNOWN_PAID_AMOUNT|NOT_DERIVED_FROM|SOURCE_AMOUNT_EVENT_DATE_NOT_ESTABLISHED/.test(s));
    if(value.state==='conflicted'||conflict.length) add('source_conflict','SOURCE_CONFLICT',field+' · source conflict',conflict.join('; ')||'The source resolver found conflicting assertions.',
      'Reconcile the retained source records; do not replace them with a silent default.',path,'Project evidence owner',refs);
    else if(['invalid','stale'].includes(value.state)||invalid.length) add('data_quality','SOURCE_QUALITY',field+' · data quality',invalid.join('; ')||'The supplied record is invalid or stale for this position.',
      'Correct or govern the specific source record, then rerun the same validation.',path,'Project evidence owner',refs);
    else if(value.state!=='submitted_unparsed'&&(['missing','not_submitted','missing_evidence','missing_information'].includes(value.state)||missingInput.length)) add('missing_information','MISSING_SOURCE_VALUE',field+' · information missing',
      value.consequence||missingInput.join('; ')||'The required source value is not established.',value.action||'Supply or identify the specific missing input; an existing register does not establish every field or calculation. Do not substitute zero.',path,'Project evidence owner',refs);
    else if(value.state==='submitted_unparsed') add('verification_pending','SUBMITTED_NOT_INTERPRETED',field+' · submitted evidence not interpreted',
      'A source exists, but CMeng has not established its structured meaning. Its presence is not proof of absence or bad data.',
      'CMeng must inspect the supported source format and parsing result; identify a concrete source error only if validation proves one.',path,'CMeng',refs);
    else if(['candidate','provisional','pending_review'].includes(value.state)&&!diagnostics.includes('EXPLICIT_SOURCE_SNAPSHOT_NOT_RECALCULATED_FROM_VARIATIONS')) add('governance_review','AUTHORITY_REVIEW',field+' · authority review',
      value.consequence??'The value is provisional or awaiting governance; it is not an official approval.',
      value.action||'Review the source and approve or reject the proposed authority through the governed workflow.',path,'Project controls reviewer',refs);
    if(value.population?.exclusions) {
      const missing=value.population.exclusions.filter((e:any)=>/date_missing/.test(e.reason));
      const invalidDates=value.population.exclusions.filter((e:any)=>/^(record_)?date_invalid$|^invalid_date$/.test(e.reason));
      if(missing.length)add('missing_information','EVENT_DATES_NOT_ESTABLISHED',field+' · event dates not established',
        missing.length+' retained record(s) lack an established '+value.population.dateBasis+' date and are excluded from current actuals.',
        'Identify the actual event dates; a planned period cannot replace an actual event. Validate any supplied date before calling it invalid.',path+'.population','Project evidence owner',refs);
      if(invalidDates.length)add('data_quality','INVALID_EVENT_DATES',field+' · invalid event dates',
        invalidDates.length+' retained record(s) contain a date that failed date validation.',
        'Correct the invalid event-date values and rerun validation.',path+'.population','Project evidence owner',refs);
    }
    for(const [key,child] of Object.entries(value)) {
      if(['source','sourceLedger','futureRows','undatedRows','futureInsurances','undatedInsurances','claimsReporting','challenge','reportingContract','moduleReadiness','issueAssessment','systemEvidenceContract','controlBasis','sourceRefs','diagnostics','receipts','population','populations','model'].includes(key))continue;
      walk(child,path?path+'.'+key:key,depth+1);
    }
  };
  walk(d?.focus??d,'data'+(d?.focus?'.focus':''),0);
  // A source discrepancy propagated into many metrics is one discrepancy.
  // Build it from its dated money population; keep every affected metric path.
  if(ownsVariationReview)for(const [i,g] of variationGroups.entries())for(const [j,a] of (g.aggregates??[]).entries()){
    if(a.difference===null||Math.abs(a.difference)<=.01)continue;
    add('source_conflict',variationConflictCode,'Reported changes and dated approvals differ',
      g.currency+' / '+g.taxBasis+' at '+a.asOf+': source aggregate '+a.amount+'; '+a.datedApprovals.count+' dated approvals total '+a.datedApprovals.amount+'; difference '+a.difference+'. '+g.future.count+' future approvals total '+g.future.amount+'.',
      'Reconcile the amendment and cost total to dated variation IDs, amounts and authority in Variations & Change.',
      'position.variationBasisReview.groups['+i+'].aggregates['+j+']','Project evidence owner',
      (a.sourceRefs??[]).map((r:any)=>'evidence-document:'+r.documentId+':'+r.locator));
    issues.at(-1)!.evidencePaths.push('position.currencies.approvedVariationAmount','position.currencies.currentContractValue','position.performance.costControl','position.performance.evmPerformance','position.performance.costScurve');
  }
  // Absence of a link is missing information. A broken supplied ID is separately
  // classified by its validation diagnostic; absence alone is not bad data.
  if(typeof d?.activityEvidenceInsufficientEventCount==='number'&&d.activityEvidenceInsufficientEventCount>0)
    add('missing_information','EVENT_ACTIVITY_LINKAGE_INCOMPLETE','Event-to-activity links incomplete',d.activityEvidenceInsufficientEventCount+' current event(s) lack established affected-activity links.',
      'Reconcile source identities and record evidenced activity links; do not infer causation from date movement.','activityEvidenceInsufficientEventCount');
  if(typeof d?.noticeRequirementMissingCount==='number'&&d.noticeRequirementMissingCount>0)
    add('missing_information','NOTICE_APPLICABILITY_MISSING','Applicable notice requirements not established',d.noticeRequirementMissingCount+' event(s) lack an established applicable notice trigger and requirement.',
      'Link each event to its applicable contract clause, trigger, day basis and notice evidence before assessing timeliness.','noticeRequirementMissingCount');
  if(d?.eligibleCausalEventEvidenceEstablished===false)
    add('missing_information','CAUSAL_ENTITLEMENT_EVIDENCE_MISSING','Causal entitlement evidence not established','The current events do not establish eligible causal time impact.',
      'Establish event responsibility, affected activities, notice applicability and causal time impact before assessing entitlement.','eligibleCausalEventEvidenceEstablished','Project controls reviewer');
  if(result.evidenceState==='partial'&&!issues.some(i=>['missing_information','data_quality','source_conflict','governance_review'].includes(i.kind)))
    add('verification_pending','EVIDENCE_ASSESSMENT_INCOMPLETE','Evidence assessment incomplete',result.reason??'The evidence producer has not established a complete position.',
      'Identify and classify the specific evidence dependency before treating the result as complete.','evidenceState','CMeng');
  return summarizeControlIssues(issues);
}
