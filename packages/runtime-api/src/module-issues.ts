import { conditionalNotice, summarizeControlIssues, type ControlIssue, type ControlIssueKind } from '../../truth-kernel/src';
import {readableFieldLabel,readablePathLabel} from './field-labels';
import {managementNumber} from './management-values';
import type { ModuleRuntimeResult } from './project-state-types';
import type { CrossModuleCertification } from './certification';
import {consistencyForModule} from './certification';
import {comparisonRequirement} from './comparison-requirement';
import {scopeRegisterDateReview} from './register-date-review';

type Consistency = Pick<CrossModuleCertification,'state'|'failedCheckIds'|'checkCount'> & Partial<Pick<CrossModuleCertification,'checks'>>;

// T11: an issue heading's reader label for one path segment depends only on
// the segment text (readablePathLabel and readableFieldLabel are pure). Large
// registers repeat the same few segments on thousands of rows, so each segment
// is labelled once instead of re-running the label rules for every finding.
const segmentLabels=new Map<string,string>();
function segmentReaderLabel(segment:string):string{
  let label=segmentLabels.get(segment);
  if(label===undefined){
    label=readablePathLabel(segment)||readableFieldLabel(segment.replace(/\[[^\]]*\]/g,''));
    if(segmentLabels.size>=8192)segmentLabels.clear();
    segmentLabels.set(segment,label);
  }
  return label;
}

/** Classification uses evidence states and failed checks, never a project name,
 * desired result, record count or traffic-light colour. */
export type IssueScanContext={eligibility:WeakMap<object,boolean>};
export function assessModuleIssues(result: ModuleRuntimeResult, consistency: Consistency,scanContext?:IssueScanContext) {
  const scopedConsistency=consistencyForModule(consistency,result.key);
  const d=result.data as any, issues:ControlIssue[]=[];
  const variationGroups=d?.position?.variationBasisReview?.groups??[];
  const variationConflictCode='DATED_VARIATION_LEDGER_VS_SOURCE_AGGREGATE_CONFLICT';
  const ownsVariationReview=['cost-forecast','commercial-overview','variations-change','contract-particulars-bonds'].includes(result.key);
  const add=(kind:ControlIssueKind,code:string,summary:string,detail:string,action:string,path:string,
    owner:ControlIssue['owner']='Project evidence owner',sourceRefs:string[]=[],checkIds:string[]=[])=>{
    issues.push({kind,code,summary,detail,action,owner,moduleKeys:[result.key],evidencePaths:[path],sourceRefs,checkIds});
  };
  const dateReview=d?.registerDateReview ? scopeRegisterDateReview(d.registerDateReview, result.key) : null;
  if(result.key==='forecast-history'){
    const checks=new Map<string,Array<{point:any;check:any;index:number}>>();
    for(const [index,point] of (d?.points??[]).entries())for(const check of point.calculationChecks??[]){
      if(check.state==='passed')continue;
      const group=checks.get(check.key)??[];group.push({point,check,index});checks.set(check.key,group);
    }
    for(const [key,rows] of checks)add('verification_pending','HISTORY_CALCULATION_'+key.toUpperCase(),
      rows[0]!.check.label+' needs review in '+rows.length+' revision(s)',
      rows.map(({point,check})=>(d.revisionLabels?.[point.sourceRevisionId]??point.sourceRevisionId)+': '+check.detail).join('; '),
      'Review Calculation checks by revision and the retained source evidence before adopting a recalculated finish.',
      'points['+rows[0]!.index+'].calculationChecks','CMeng',rows.map(({point})=>'schedule-revision:'+point.sourceRevisionId));
  }
  if(dateReview?.likelyMappingFault)add('verification_pending','REGISTER_DATE_READING_REVIEW','Register dates need a system reading check',dateReview.message,
    'CMeng must compare the supplied date columns with the reader before requesting replacement files.','registerDateReview','CMeng');
  const integrity=d?.systemEvidenceContract;
  if(result.engineState==='failed'||integrity?.state==='failed') {
    const failed=(integrity?.checks??[]).filter((c:any)=>c.passed===false);
    add('system_defect','CALCULATION_CHECK_FAILED','CMeng calculation check failed',
      failed.length?failed.map((c:any)=>c.metric+': expected '+JSON.stringify(c.expected)+', actual '+JSON.stringify(c.actual)).join('; '):result.reason??'The calculation engine reported failure.',
      'Correct the implementation and run the failed checks again before using the affected result.','systemEvidenceContract','CMeng',[],failed.map((c:any)=>c.metric));
  } else if(integrity?.state!=='verified_for_checked_metrics') {
    add('verification_pending','CALCULATION_NOT_VERIFIED','CMeng calculation verification incomplete',
      'No completed calculation certification is established for this module. This is a verification gap, not proof that the answer is wrong.',
      'CMeng must complete the relevant calculation checks; do not relabel this as missing contractor data.','systemEvidenceContract','CMeng');
  }
  if(scopedConsistency.state==='fail') {
    const failures=scopedConsistency.checks?.filter(c=>c.state==='fail');
    add('system_defect','CROSS_MODULE_CONTRADICTION','CMeng consistency check failed',
      failures?.map(c=>c.checkId+': '+c.detail).join('; ')||scopedConsistency.failedCheckIds.join(', '),
      'Reconcile the failed same-basis values or reporting contracts in the shared producers.','crossModuleConsistency','CMeng',[],scopedConsistency.failedCheckIds);
  }
  const comparison=comparisonRequirement(d,result.key);
  const challengeItems=comparison.items;
  const advisoryDefaultChallenge=comparison.advisory;
  const reconciliation=d?.challenge?.reconciliationState;
  if(reconciliation==='material_difference') add('comparison_difference','SUBMITTED_INDEPENDENT_DIFFERENCE','Submitted and independent positions differ',
    'The two authorities produce different positions. A difference alone is not a system contradiction or proven source error.',
    'Compare the submitted and independent dates, work covered, calendars and assumptions; record the explanation before adoption.','challenge','Project controls reviewer');
  if(reconciliation==='conflicting_evidence') add('source_conflict','COMPARABLE_SOURCE_CONFLICT','Comparable source assertions conflict',
    'The challenge resolver identified incompatible source assertions for the comparison.',
    'Reconcile the conflicting assertions and retain the selected authority and source references.','challenge');
  if(comparison.required&&reconciliation==='submitted_missing') add('missing_information','COMPARABLE_ASSERTION_MISSING','Comparable submitted assertion not established',
    'The required comparison value is absent or not established. This does not mean the contractor submitted no documents.',
    'Identify the comparable submitted value and its date, records covered and authority, or explicitly mark this comparison not applicable.','challenge');
  const noticeInputsMissing=result.key==='notices-claims'&&integrity?.state==='verified_for_checked_metrics'&&d.noticeEventDateMissingCount>0;
  if(noticeInputsMissing)add('missing_information','NOTICE_TRIGGER_DATES_MISSING','Event dates are needed for notice assessment',
    // SW-46: "passed the listed checks" only when this module's listed checks actually ran.
    d.noticeEventDateMissingCount+' events have no event/awareness date. '+conditionalNotice(Array.isArray(integrity?.checks)?integrity.checks.length>0:null,
      'Record counts, claimed-day retention and assessable timing arithmetic have passed the listed checks.',
      'No listed calculation check is recorded for this module, so record counts, claimed-day retention and timing arithmetic are not verified.',
      'The listed calculation checks for this module are not established, so record counts, claimed-day retention and timing arithmetic are not verified.'),
    'Supply the dated event/awareness evidence and dated claim assessments, then assess each applicable contract rule.','events.eventStartIso');
  const unavailableItems=advisoryDefaultChallenge?[]:challengeItems.filter((i:any)=>i.reconciliationState==='independent_unavailable');
  const classifiedUnavailable=unavailableItems.filter((i:any)=>i.independent?.diagnostics?.some((s:string)=>s.startsWith('COMPARISON_INPUT_REQUIRED:')||s==='SOURCE_AUTHORITY_ONLY'));
  for(const item of classifiedUnavailable){
    const sourceOnly=item.independent.diagnostics.includes('SOURCE_AUTHORITY_ONLY');
    // A certified financial progress percentage is already a governed source
    // fact when the Progress Report carries the same numeric value. An
    // additional *independent* quantity-based comparator is CMeng's technical
    // verification gap, never another request for the held certificates.
    // Preserve the original challenge, independent-missing diagnostics, and
    // comparison evidence in issueAssessment for the engineer's audit.
    const heldCertified=d?.progressBases?.certified?.valuePercent;
    const certifiedSourcePresent=result.key==='progress-report'
      &&item.metric==='certified_progress_percent'
      &&typeof heldCertified==='number'&&Number.isFinite(heldCertified)
      &&typeof item.submitted?.value==='number'&&Number.isFinite(item.submitted.value)
      &&Math.abs(heldCertified-item.submitted.value)<1e-6;
    if(certifiedSourcePresent){
      add('verification_pending','CERTIFIED_PROGRESS_INDEPENDENT_VERIFICATION',
        'Certified financial progress established; independent quantity comparator not verified',
        'The Progress Report already holds '+managementNumber(heldCertified)+'% certified financial progress. The separate independent quantity/valuation comparison remains unavailable and must not be represented as missing source certification.',
        'CMeng must establish a genuinely comparable independent verification if source evidence permits; retain the certified financial amount and percentage without asking for them again.',
        'challenge.items.'+item.metric,'CMeng',item.submitted.sourceRefs??[]);
      continue;
    }
    add(sourceOnly?'governance_review':'missing_information',sourceOnly?'SOURCE_AUTHORITY_COMPARISON':'INDEPENDENT_COMPARISON_INPUT',item.label+' · '+(sourceOnly?'source authority review':'specific evidence needed'),item.consequence,item.action,'challenge.items.'+item.metric,sourceOnly?'Project controls reviewer':'Project evidence owner',item.independent.sourceRefs??[]);
  }
  const dependenciesExplained=unavailableItems.length>0&&classifiedUnavailable.length===unavailableItems.length;
  if(comparison.required&&!noticeInputsMissing&&!dependenciesExplained&&(reconciliation==='independent_unavailable'||reconciliation==='not_checked'||!reconciliation)) add('verification_pending','INDEPENDENT_COMPARISON_NOT_ESTABLISHED','Independent comparison not established',
    'CMeng has not established an independent value for this comparison.',
    'CMeng must complete the independent calculation and name any specific input it needs. A missing contractor submission is not the cause.','challenge','CMeng');
  if(result.evidenceState==='missing'||!d) add('missing_information','REQUIRED_EVIDENCE_MISSING','Required information not established',
    result.reason??result.dependencies.join(', '),'Provide the identified source evidence; missing values remain unavailable.','evidenceState');
  if(result.evidenceState==='conflicted') add('source_conflict','EVIDENCE_STATE_CONFLICTED','Source evidence conflicts',
    result.reason??'The evidence resolver reported a conflict.','Review the source assertions and govern the applicable evidence.','evidenceState');
  if(result.key==='schedule-change-report'&&Array.isArray(d?.diagnostics)&&d.diagnostics.includes('SECOND_SCHEDULE_REVISION_REQUIRED_FOR_CHANGE_COMPARISON')) add(
    'missing_information',
    'SECOND_PROGRAMME_REVISION_NEEDED',
    'Previous programme needed for change comparison',
    'Only one controlled programme revision is available. CMeng can analyse the current programme, but it cannot state what changed since a previous revision.',
    'Upload or identify the previous controlled programme revision only if a change comparison is required.',
    'diagnostics'
  );

  // ABB G3_CHANGES_FORECAST-28: an actual finish before its own actual start makes
  // that finish movement unreliable; it is raised, never passed silently.
  const invalidActuals=d?.finishMovementAnalysis?.invalidActualDateRows;
  if(Array.isArray(invalidActuals)&&invalidActuals.length>0)add('data_quality','ACTUAL_FINISH_BEFORE_START','Actual finish before actual start',
    invalidActuals.length+' '+(invalidActuals.length===1?'activity has':'activities have')+' an actual finish before '+(invalidActuals.length===1?'its':'their')+' own actual start: '+
    invalidActuals.slice(0,10).map((r:any)=>r.activityId+' (actual start '+String(r.actualStartIso).slice(0,10)+', actual finish '+String(r.actualFinishIso).slice(0,10)+')').join('; ')+
    (invalidActuals.length>10?'; and '+(invalidActuals.length-10)+' more':'')+'. Their finish movement between the revisions is not reliable until the dates are corrected.',
    'Correct the actual start or actual finish in the programme, then compare the revisions again.','finishMovementAnalysis.invalidActualDateRows');
  // ABB G3_CHANGES_FORECAST-06: a page that shows near-critical work says when that
  // measure is not established, with the cause, instead of an all-clear.
  const screening=d?.nearCriticalScreening;
  if(screening&&screening.nearCriticalCount===null&&typeof screening.unresolvedActivityCount==='number'&&screening.unresolvedActivityCount>0){
    const unreadableCalendars=typeof screening.unreadableCalendarActivityCount==='number'?screening.unreadableCalendarActivityCount:0;
    const calendarCause=unreadableCalendars>0;
    add('missing_information','NEAR_CRITICAL_NOT_ESTABLISHED','Near-critical activities not established',
      screening.unresolvedActivityCount+' of '+screening.populationCount+' unfinished activities cannot be classified as near-critical or not. '+
      (calendarCause?unreadableCalendars+' of them '+(unreadableCalendars===1?'has':'have')+' no readable working calendar, so '+(unreadableCalendars===1?'its':'their')+' float cannot be counted in working days; no default working pattern is assumed.'
        :'Their float or working calendar is not established.'),
      calendarCause?'Supply the working-time definition (work days, hours and holidays) of each programme calendar, then the near-critical count is calculated.'
        :'Supply the missing float or working calendar of these activities, then the near-critical count is calculated.',
      'nearCriticalScreening','Project evidence owner');
  }

  // Walk the owning projection. Commercial modules share an entire position but
  // expose their owned evidence in focus; unrelated missing registers must not
  // turn every commercial page into the same warning.
  const visited=new WeakSet<object>();
  // A productivity-based independent forecast is an optional analytical
  // source, not an unconditional requirement for the current programme,
  // management dashboard or CPM. Genuine conflicts and parser faults are
  // still inspected and remain actionable.
  const optionalForecastAbsent=(path:string,value:any)=>path.endsWith('.sourceProductivityForecast')&&
    value?.state==='missing'&&!(Array.isArray(value?.diagnostics)&&value.diagnostics.length);
  const noDiagnostics:readonly string[]=[];
  const issueStates=new Set(['conflicted','invalid','stale','missing','not_submitted','missing_evidence','missing_information','submitted_unparsed','candidate','provisional','pending_review']);
  // Comparison envelopes retain their own input/reconciliation states. The
  // separate headcount review does not govern readiness of an hours/capacity
  // source position; the primary challenge is classified above on its basis.
  const excludedKeys=new Set(['source','sourceLedger','futureRows','undatedRows','futureInsurances','undatedInsurances','claimsReporting','challenge','manpowerRequirementComparison','reportingContract','moduleReadiness','issueAssessment','systemEvidenceContract','controlBasis','sourceRefs','diagnostics','receipts','population','populations','model']);
  // Scan each immutable subtree once per resolution batch. Eligibility depends
  // on actual issue signals, not the page name or a whitelist of row fields.
  // Most large register trees are neutral; the owning walker can then skip
  // them without rebuilding paths for tens of thousands of repeated rows.
  // Findings themselves are never cached: each module retains its own paths.
  const eligibility=scanContext?.eligibility??new WeakMap<object,boolean>();
  // T11: an object's own signal check is O(1) and a leaf (no object-valued
  // child) cannot contain a descendant finding, so neither is stored in the
  // shared lookup. Only subtrees that can be reached again through another
  // module are cached; this removes hundreds of thousands of weak-map inserts
  // for repeated scalar rows. The answer for every object is unchanged.
  const arrayItemCanContainIssue=(item:any,depth=0):boolean=>{
    if(!item||typeof item!=='object')return false;
    const hit=eligibility.get(item);if(hit!==undefined)return hit;
    // Keep eligibility conservative for unusually deep source structures.
    // The owning walker still applies its established inspection depth.
    if(depth>=64)return true;
    if((Array.isArray(item.diagnostics)&&item.diagnostics.length>0)||issueStates.has(item.state)||item.population?.exclusions?.length)return true;
    // A provisional positive contains cycles in the same shared lookup. It is
    // set before the first descent; only a completed inspection may replace
    // it with a negative result, so re-entry never hides a later finding.
    let answer=false,open=false;
    if(Array.isArray(item)){
      // T11: an indexed read visits the same elements in the same order as
      // for-of on an array (a hole reads as undefined either way) without
      // creating an iterator for each of the many scanned arrays.
      for(let i=0;i<item.length;i++){
        const child=item[i];
        if(!child||typeof child!=='object')continue;
        if(!open){open=true;eligibility.set(item,true);}
        if(arrayItemCanContainIssue(child,depth+1)){answer=true;break;}
      }
    }else{
      // for-in reads each value through the enumeration cache instead of a
      // megamorphic keyed load. It visits every own enumerable key (and could
      // only add inherited ones, which can make the answer more conservative,
      // never hide a finding; the walker itself still uses Object.keys).
      for(const key in item){
        const child=item[key];
        // Scalar cells cannot hold nested issue evidence. Most source-row
        // fields are scalar; avoid recursive calls and key-set lookups for
        // them while retaining inspection of every own object-valued field.
        if(child&&typeof child==='object'&&!excludedKeys.has(key)){
          if(!open){open=true;eligibility.set(item,true);}
          if(arrayItemCanContainIssue(child,depth+1)){answer=true;break;}
        }
      }
    }
    if(open)eligibility.set(item,answer);
    return answer;
  };
  const walk=(value:any,path:string,depth:number)=>{
    if(!value||typeof value!=='object'||depth>9||visited.has(value)||!arrayItemCanContainIssue(value))return;
    if(optionalForecastAbsent(path,value))return;
    if(path.endsWith('.advancePaymentBondRequirement')&&value.state==='missing'){
      const held=d?.position?.heldEvidence?.advancePaymentBonds??d?.heldEvidence?.advancePaymentBonds;
      if(held?.count>0){
        add('governance_review','HELD_INSTRUMENT_REQUIREMENT_REVIEW','Review contractual security cover',
          held.count+' advance-payment instrument(s) are already held. Their existence is established; the required contractual cover is not stated in the extracted clause.',
          'Compare the held instruments with the original advance-security clause; do not request the register again.',path,'Project controls reviewer',
          (held.rows??[]).flatMap((r:any)=>r.sourceRefs??[r.bondId]).filter((v:any)=>typeof v==='string'));
        return;
      }
    }
    // An explicitly supplied outstanding advance does not depend on deriving
    // the original advance from a contract percentage.
    if(path.endsWith('.advancePaymentPercent')&&d?.position?.currencies?.some((row:any)=>typeof row.advanceBalance?.value==='number'))return;
    visited.add(value);
    if(Array.isArray(value)){
      for(const item of value)if(item&&typeof item==='object'&&!visited.has(item)&&arrayItemCanContainIssue(item))
        walk(item,path+'['+(typeof item.topic==='string'?'topic='+item.topic:typeof item.basis==='string'?'basis='+item.basis:'*')+']',depth+1);
      return;
    }
    const diagnostics=Array.isArray(value.diagnostics)&&value.diagnostics.length?value.diagnostics.filter((s:unknown)=>typeof s==='string') as string[]:noDiagnostics;
    // Plain rows still receive full recursive inspection. Construct issue labels
    // and references only for objects that can actually produce a finding.
    if(diagnostics.length||issueStates.has(value.state)||value.population?.exclusions?.length){
    const rawRefs=value.sourceRefs??value.basis?.sourceRefs??value.evidenceRefs;
    // T11: references, raw field and heading are built only when this object
    // actually produces a finding (most register rows with diagnostics do not).
    let refsValue:string[]|undefined,fieldValue:string|undefined;
    const refs=()=>refsValue??=(Array.isArray(rawRefs)?rawRefs:[]).filter((s:unknown)=>typeof s==='string') as string[];
    // Identity is the raw field name; the reader heading below is display only.
    const rawField=()=>path.replace(/\[\*\]/g,'').split('.').slice(-2).join('.')+(typeof value.topic==='string'?'|'+value.topic:'');
    const firstFinding=issues.length;
    // T10: issue headings use the shared reader label for each path segment.
    const field=()=>fieldValue??=path.replace(/\[\*\]/g,'').split('.').slice(-2).map(segmentReaderLabel).join(' · ')+(typeof value.topic==='string'?' · '+value.topic:'');
    const conflict=diagnostics.filter(s=>/(?:^|_)(CONFLICT|CONFLICTING|CONFLICTED)(?:_|:|$)/.test(s)&&!(variationGroups.length&&s===variationConflictCode));
    const invalid=diagnostics.filter(s=>/(?:^|_)(INVALID|MALFORMED|DUPLICATE|AMBIGUOUS|BROKEN|MISMATCH)(?:_|:|$)|CLOSURE_BEFORE_RAISED_DATE/.test(s));
    const missingInput=diagnostics.filter(s=>s!=='SECOND_SCHEDULE_REVISION_REQUIRED_FOR_CHANGE_COMPARISON'&&/REQUIRED|NOT_A_RECONCILED|IS_NOT_GROSS|UNKNOWN_PAID_AMOUNT|NOT_DERIVED_FROM|SOURCE_AMOUNT_EVENT_DATE_NOT_ESTABLISHED/.test(s));
    if(value.state==='conflicted'||conflict.length) {
      add('source_conflict','SOURCE_CONFLICT',field()+' · source conflict',conflict.join('; ')||'The source resolver found conflicting assertions.',
        'Reconcile the retained source records; do not replace them with a silent default.',path,'Project evidence owner',refs());
      if(typeof value.sourceFactKey==='string')issues.at(-1)!.sourceFactKey=value.sourceFactKey;
    }
    else if(['invalid','stale'].includes(value.state)||invalid.length) add('data_quality','SOURCE_QUALITY',field()+' · data quality',invalid.join('; ')||'The supplied record is invalid or stale for this position.',
      'Correct or confirm the specific source record, then run the same check again.',path,'Project evidence owner',refs());
    else if(value.state!=='submitted_unparsed'&&value.applicability!=='stage_not_reached'&&(['missing','not_submitted','missing_evidence','missing_information'].includes(value.state)||missingInput.length)) add('missing_information','MISSING_SOURCE_VALUE',field()+' · information missing',
      value.consequence||missingInput.join('; ')||'The required source value is not established.',value.action||'Supply or identify the specific missing input; an existing register does not establish every field or calculation. Do not substitute zero.',path,'Project evidence owner',refs());
    else if(value.state==='submitted_unparsed') add('verification_pending','SUBMITTED_NOT_INTERPRETED',field()+' · submitted evidence not interpreted',
      'A source exists, but CMeng has not established its structured meaning. Its presence is not proof of absence or bad data.',
      'CMeng must inspect the supported source format and parsing result; identify a concrete source error only if validation proves one.',path,'CMeng',refs());
    else if(['candidate','provisional','pending_review'].includes(value.state)&&!diagnostics.includes('EXPLICIT_SOURCE_SNAPSHOT_NOT_RECALCULATED_FROM_VARIATIONS')) {
      // An identified contract/register candidate can be used as *reported source*
      // without inventing a new management approval task. This does not promote
      // its authority to governed or establish a contractual determination.
      const explicitDecision=value.approvalRequired===true||
        value.requiresUserApproval===true||value.decisionRequired===true||
        diagnostics.some(s=>/(?:APPROVAL_REQUIRED|ADOPTION_REQUIRED|OVERRIDE_PENDING|UNTIL_MAPPED|REQUIRES_MAPPING|UNRESOLVED_AUTHORITY)/.test(s));
      // A source candidate, a missing provenance field, or generic "pending"
      // state is not an approval request. Only a concrete selection, override
      // or required determination can enter the decision queue.
      // Missing or conflicted source evidence remains separately classified.
      if(explicitDecision)
        add('governance_review','AUTHORITY_REVIEW',field()+' · authority review',
          value.consequence??'A management decision, selection or approval remains outstanding; the candidate is not an official approval.',
          value.action||'Review the source basis and record the decision through the governed workflow.',path,'Project controls reviewer',refs());
    }
    if(value.population?.exclusions) {
      const missing=value.population.exclusions.filter((e:any)=>/date_missing/.test(e.reason));
      const invalidDates=value.population.exclusions.filter((e:any)=>/^(record_)?date_invalid$|^invalid_date$/.test(e.reason));
      if(missing.length)add('missing_information','EVENT_DATES_NOT_ESTABLISHED',field()+' · event dates not established',
        missing.length+' retained record(s) lack an established '+value.population.dateBasis+' date and are excluded from current actuals.',
        'Identify the actual event dates; a planned period cannot replace an actual event. Validate any supplied date before calling it invalid.',path+'.population','Project evidence owner',refs());
      if(invalidDates.length)add('data_quality','INVALID_EVENT_DATES',field()+' · invalid event dates',
        invalidDates.length+' retained record(s) contain a date that failed date validation.',
        'Correct the invalid event-date values and run the check again.',path+'.population','Project evidence owner',refs());
    }
    if(issues.length>firstFinding){const raw=rawField();for(let i=firstFinding;i<issues.length;i++)issues[i]!.field=raw;}
    }
    for(const key of Object.keys(value)) {
      const child=value[key];
      if(!child||typeof child!=='object'||excludedKeys.has(key))continue;
      // T11: the same entry test walk() applies first, in the same order,
      // read before the child path text is built. A rejected child returns
      // at once in walk() too; an accepted child repeats the test with the
      // same answer (nothing is visited in between), so findings, paths and
      // their order are unchanged.
      if(depth+1>9||visited.has(child)||!arrayItemCanContainIssue(child))continue;
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
  const explicitBasisReview=integrity?.state==='verified_for_checked_metrics'&&((d?.classificationBasis==='source_total_float'&&d?.independentCpmState==='established')||d?.managementReviewState==='review_required');
  if(explicitBasisReview)add('governance_review','CALCULATION_BASIS_REVIEW','Calculated basis requires review',d.managementReviewReason??'Submitted float and independently recalculated criticality are both available on their stated bases.',
    'Review the calendar, constraints and comparison basis before adopting a management conclusion.','calculationBasis','Project controls reviewer');
  const floatReview=d?.activityFloatReconciliation;
  if((floatReview?.differenceActivityCount??floatReview?.disputedActivityCount??0)>0&&['established','qualified_scenario'].includes(floatReview.independentCpmState))add('comparison_difference','SUBMITTED_INDEPENDENT_DIFFERENCE','Submitted and calculated activity float differ',
    (floatReview.differenceActivityCount??floatReview.disputedActivityCount)+' open activities differ in submitted versus calculated float; '+
    (floatReview.criticalityDifferenceCount??floatReview.disputedActivityCount)+' change criticality classification and '+(floatReview.numericDifferenceActivityCount??0)+' keep the same classification.'+
    (floatReview.commonOffsetHours!==null&&floatReview.commonOffsetHours!==undefined?' A common '+floatReview.commonOffsetHours+'-hour offset is present across comparable activities; its calendar/definition cause is unverified.':''),
    'Reconcile the exact working-calendar and float conventions and retain both answers. A numerical difference is not a contractual dispute or automatic approval.','activityFloatReconciliation','CMeng');
  if(result.evidenceState==='partial'&&!issues.some(i=>['missing_information','data_quality','source_conflict','governance_review','comparison_difference'].includes(i.kind)))
    add('verification_pending','EVIDENCE_ASSESSMENT_INCOMPLETE','Evidence assessment incomplete',result.reason??'The evidence producer has not established a complete position.',
      'Identify and classify the specific evidence dependency before treating the result as complete.','evidenceState','CMeng');
  // SW-46: the module's listed calculation checks that ran (null when the check list is not established).
  return summarizeControlIssues(issues,Array.isArray(integrity?.checks)?integrity.checks.length:null);
}
