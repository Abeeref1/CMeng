export const systemReviewStyles=String.raw`
.planning-kpi.unavailable strong,.management-metric-value.missing{font-size:16px!important;font-weight:500!important;color:#5b6e80!important}
.page-review-summary{font-size:12px;color:#526479;margin:8px 0 14px}.page-review-summary summary{cursor:pointer}.page-review-summary p{line-height:1.6}.position-verdict>p{font-size:16px;line-height:1.5}.source-request{padding:12px;border-bottom:1px solid #dce5ef}.source-request summary{cursor:pointer;line-height:1.6}.request-meta{display:block;color:#607188;font-size:12px}.module-basis{font-size:12px}

.nav-review-totals{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;font-size:10px}.nav-review-totals div{padding:9px;background:#f1f5fa;border-radius:7px}.nav-review-totals b{display:block;font-size:18px;color:#284967}.position-verdict{border:1px solid #cfdae7;border-left:5px solid #b57922;border-radius:8px;padding:12px 16px;margin:0 0 12px;background:#fff}.position-verdict.red{border-left-color:#b4483e}.position-verdict.green{border-left-color:#2c7a57}.position-verdict.unknown{border-left-color:#7c8998}.position-verdict h4{margin:0 0 8px;font-size:14px}.position-verdict p{margin:6px 0}.position-verdict small{color:#566c81}.position-verdict details{margin-top:9px;font-size:12px}.nav-counts{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.nav-counts .nav-count{font-size:9px;padding:2px 4px}.source-scope-summary{font-size:12px;margin-bottom:18px;padding:8px 12px;background:#f7f9fc;border-radius:7px}.source-scope-summary summary{cursor:pointer;font-weight:650}.source-quality-counts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.source-quality-counts div{padding:16px;background:#f4f7fb;border:1px solid #dce5ef;border-radius:8px}.source-quality-counts b{display:block;font-size:25px}.decision-list{display:grid;gap:10px}.decision-list article{padding:15px;border:1px solid #dce5ef;border-radius:8px}.decision-list p{margin:5px 0}.decision-list small{display:block;margin-top:6px;color:#536c85}.future-register-note{margin:8px 0}.single-axis-caption{font-size:14px;font-weight:650;margin:18px 0 0}
`;
export const systemReviewScript=String.raw`
function renderPositionVerdict(data,includeGeneral=false){
  const v=data?.positionVerdict;if(!v)return '';
  const issue=(data.issueAssessment?.issues||[]).find(i=>i.action===v.nextAction);
  const request=issue?readerIssue(issue):null;
  const next='<p><b>Assign to:</b> '+escapeHtml(request?.assignTo||v.assignTo||'Project Controls')+'</p><p><b>Next:</b> '+escapeHtml(request?.action||readerText(v.nextAction))+'</p>';
  if(v.specific===false)return includeGeneral?'<details class="page-review-summary"><summary>About this view</summary><p>'+escapeHtml(readerText(v.text))+'</p>'+next+'</details>':'';
  return '<section class="position-verdict '+escapeHtml(v.rag)+'" aria-label="Position verdict"><h4>'+escapeHtml(v.label)+'</h4><p>'+escapeHtml(request?.title||readerText(v.text))+'</p>'+next+'<details><summary>How this status was assessed</summary><p>'+escapeHtml(v.basis)+'</p><p>Assigned owner: '+escapeHtml(v.owner||'Not assigned')+'</p></details></section>';
}
function readerText(value){
  // Presentation-only normalization. Never alter source records, code identifiers or stored values.
  const readable=readerReference(value)
    .replace(/\b([a-z][a-z0-9_]*)_register\s+status\s*=\s*([a-z][a-z0-9_-]*)\b/gi,(_,name,status)=>name.replaceAll('_',' ')+' register status: '+status.replaceAll('_',' '))
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,'Source record (reference in details)')
    .replace(/\b(?:[0-9a-f]{28,64})\b/gi,'Source record (reference in details)')
    .replace(/\b(?:null|undefined)\b/gi,'Not established')
    .replace(/\bUnresolved\b/gi,'Needs confirmation');
  return humanizeIsoText(readable).replace(/\b[A-Z]{3,}(?::[A-Z0-9_-]+)+\b/g,code=>code.toLowerCase().replaceAll(':',' · ').replaceAll('_',' '))
    .replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+(?::[^;\n]*)?/g,code=>code.split(':').map(part=>part.replaceAll('_',' ').toLowerCase()).join(' · '));
}
function readerReference(value){
  let text=String(value??'');
  const labels=typeof currentModuleResult==='undefined'?{}:currentModuleResult?.data?.sourceLabels||{};
  for(const [id,label] of Object.entries(labels).sort((a,b)=>b[0].length-a[0].length))text=text.split(id).join(label);
  return text.replace(/(?:evidence-document:)?(?:doc|evidence)_[a-f0-9-]{8,}/gi,'Source document')
    .replace(/schedrev_[a-f0-9-]{8,}/gi,'Programme revision')
    .replace(/(?:audit-request|source-manifest|rerun-receipt):[^\s;,]+/g,'Retained project history')
    .replace(/:clause:[^\s;,]+/g,' · source section').replace(/:row:(\d+)/g,' · row $1').replace(/:page:(\d+)/g,' · page $1')
    .replace(/\bdata\.(?:[\w]+(?:\[\*?\d*\])?\.?)+/g,path=>path.split('.').at(-1).replace(/\[.*\]/g,'').replace(/([a-z])([A-Z])/g,'$1 $2'));
}
function readerAuditAction(value){
  const text=String(value??'');
  if(/^(GET|POST|PUT|PATCH|DELETE)\s+\//.test(text)){
    const verb=text.startsWith('GET ')?'Viewed':text.startsWith('DELETE ')?'Removed':'Updated';
    const subject=/evidence|upload/.test(text)?'project documents':/schedule|programme/.test(text)?'programme records':/review|confirm|adopt/.test(text)?'review decision':'project records';
    return verb+' '+subject;
  }
  return readerText(text);
}
function renderProgrammeCashScenario(scenario){
 if(!scenario?.groups?.length)return '';
 return '<section class="planning-panel"><h4>Future receipts · programme planning scenario</h4>'+
 scenario.groups.map(group=>planningKpis([
  ['Remaining gross work',group.remainingGross,group.currency],
  ['Future retention',group.retention,group.currency],
  ['Advance recovery',group.advanceRecovery,group.currency],
  ['Indicative net receipts',group.netReceipts,group.currency]
 ])+(group.rows?.length?
  experienceDisclosure('Monthly assumed receipts · '+group.currency,
    basisTable(['Statement date','Gross valuation','Net receipt','Assumed receipt date'],group.rows.map(row=>
      [planningShortDate(row.periodEndIso),fmt(row.grossValuation),fmt(row.netReceipt),
       row.assumedReceiptIso?planningShortDate(row.assumedReceiptIso):'Payment period not in source'])),
    'Straight-line scenario through '+planningShortDate(scenario.programmeFinishIso)):
  '<p><b>Receipts scenario cannot yet be priced.</b> '+escapeHtml(group.certificateCount??'Recorded')+
  ' payment certificates retained. Source inputs required: '+escapeHtml((group.missingInputs||[]).join('; ')||'Confirm comparable contract, certification and submitted programme dates')+
  '. Existing payments and unpaid certificates remain separately visible; no unsupported amount is converted into zero.</p>'
 )).join('')+'<p>'+escapeHtml(scenario.basis)+'</p><small>'+escapeHtml(scenario.exclusions)+'</small></section>';
}
function renderContractSections(data){
 const facts=data?.projectFacts;
 const sections=facts?.contractSections||[];
 if(!sections.length)return '';
 const controls=data?.position?.contractControls?.liquidatedDamages??data?.focus?.liquidatedDamages??null;
 const reported=controls?.sectionScenarios||[];
 const bySection=new Map(reported.map(row=>[String(row.sectionId),row]));
 const dateDiff=(due,finish)=>{
   if(!due||!finish)return null;
   const a=Date.parse(String(due).slice(0,10)+'T00:00:00Z'),b=Date.parse(String(finish).slice(0,10)+'T00:00:00Z');
   return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,Math.round((b-a)/86400000)):null;
 };
 const result=sections.map(section=>{
   const matching=bySection.get(String(section.sectionId));
   const due=matching?.contractualDueDateIso??section.extendedCompletionIso??section.contractCompletionIso??null;
   const finish=matching?.forecastCompletionIso??section.programmeCompletionIso??null;
   const basis=section.rateBasis;
   const days=dateDiff(due,finish);
   const perDay=typeof section.rate==='number'&&Number.isFinite(section.rate)
     ?basis==='fixed_amount_per_day'?section.rate:basis==='fixed_amount_per_week'?section.rate/7:null:null;
   const uncapped=days!==null&&perDay!==null?Math.round(days*perDay*100)/100:null;
   const capped=uncapped!==null&&typeof section.capAmount==='number'
     ?Math.min(uncapped,section.capAmount):null;
   const reason=!due?'Section contractual completion date not in source':
     !finish?'Submitted sectional programme milestone not linked':
     perDay===null?'Section damages rate or day basis is not established':
     uncapped!==null&&capped===null?'Uncapped scenario only; valid monetary cap basis not established':
     'Section-only scenario, not assessed entitlement or deducted damages';
   return {section,due,finish,days,uncapped,capped,reason};
 });
 const body=result.map(({section,due,finish,days,uncapped,capped,reason})=>
  '<tr><td><b>'+escapeHtml(section.label||('Section '+section.sectionId))+'</b>'+
   ((section.completionDependsOnSectionIds||[]).length?'<br><small>Completion depends on section '+escapeHtml(section.completionDependsOnSectionIds.join(', '))+'</small>':'')+'</td>'+
  '<td>'+escapeHtml(section.milestoneId||'No matching source completion milestone')+'</td>'+
  '<td>'+escapeHtml(due?planningShortDate(due):'Not in source')+'</td>'+
  '<td>'+escapeHtml(finish?planningShortDate(finish):'Not in source')+'</td>'+
  '<td>'+escapeHtml(section.rate===null?'Not in source':fmt(section.rate)+' '+(section.currency||'')+' / '+(section.rateBasis==='fixed_amount_per_week'?'week':'day'))+'</td>'+
  '<td>'+escapeHtml(days===null?'Not calculated':fmt(days)+' calendar days')+'</td>'+
  '<td>'+escapeHtml(uncapped===null?'Not calculated':fmt(uncapped)+' '+(section.currency||''))+'</td>'+
  '<td>'+escapeHtml(capped===null?'Not calculated · cap basis missing':fmt(capped)+' '+(section.currency||''))+'</td>'+
  '<td>'+escapeHtml(reason)+'</td></tr>').join('');
 return '<section class="planning-panel"><h4>Delay damages by contract section — one source-based position</h4>'+
   '<p>Every section retains its own rate, completion date, programme milestone, cap and source qualifications. No whole-project LD figure replaces these sectional positions. Calculations are scenarios, never certified deductions.</p>'+
   '<div class="table-wrap"><table><thead><tr><th>Section</th><th>Programme milestone</th><th>Contract date with applicable award</th><th>Submitted finish</th><th>Section rate</th><th>Late days</th><th>Uncapped scenario</th><th>Capped scenario</th><th>Control</th></tr></thead><tbody>'+body+'</tbody></table></div></section>';
}
function renderClaimPipeline(data){
  const facts=data?.projectFacts,p=facts?.claims?.pipeline;if(!p)return '';
  return '<section class="planning-panel"><h4>Claim register and pending EOT</h4>'+planningKpis([
    ['Claims',p.recordCount,'Identities evidenced by the Data Date'],['Claimed days',p.claimedDays,'From register'],
    ['Assessed days',p.assessedDays,'Register assessments; includes unconfirmed decisions'],['Awarded EOT',facts.time.awardedEotDays.value,'Dated awards'],
    ['Pending claims',p.pendingCount,'Submitted or under review'],['Pending assessed days',p.pendingAssessedDays,'Scenario input; not awarded']
  ])+(p.pendingScenarioCompletionIso?'<p>If all pending assessed days are awarded without overlap, completion moves to <b>'+escapeHtml(planningShortDate(p.pendingScenarioCompletionIso))+'</b>.</p>':'')+'<small>'+escapeHtml(p.basis)+'</small>'+((p.rows||[]).length?'<details><summary>Claimed days, assessed days and register status by claim</summary><div class="table-wrap"><table><thead><tr><th>Claim</th><th>Register status</th><th>Claimed days</th><th>Assessed days</th></tr></thead><tbody>'+p.rows.map(row=>'<tr><td>'+escapeHtml(row.claimId)+'</td><td>'+escapeHtml(humanizeKey(row.state))+'</td><td>'+fmt(row.claimedDays)+'</td><td>'+fmt(row.assessedDays)+'</td></tr>').join('')+'</tbody></table></div></details>':'')+'</section>';
}
function uniqueReportingPopulations(populations){
  const groups=new Map();
  for(const p of populations){
    const label=String(p.name||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
    const old=groups.get(label);
    if(!old)groups.set(label,{...p});
    else if(old.denominator!==p.denominator||old.sourceCount!==p.sourceCount||old.dateBasis!==p.dateBasis){
      groups.set(label,{...old,denominator:null,sourceCount:null,dateBasis:'Not established: reporting groups disagree; review the full calculation data.'});
    }
  }
  return [...groups.values()];
}
function renderRegisterScope(data,includeComplete=false){
  const contract=data?.reportingContract;if(!contract)return '';
  const populations=Object.values(contract.populations||{}).filter(p=>!['activity','execution_activity','series_point','currency_position','resource','assignment','programme_window'].includes(p.entity)&&!p.dateBasis?.startsWith('Full retained source register')&&!p.dateBasis?.startsWith('Source records after')&&!p.dateBasis?.startsWith('Source records without'));
  if(!populations.length)return '';
  const unique=uniqueReportingPopulations(populations);
  const row=p=>{const exclusions=p.exclusions||[],future=exclusions.filter(e=>e.reason==='after_data_date'),undated=exclusions.filter(e=>/date_missing|date_invalid/.test(e.reason));return '<tr><td>'+escapeHtml(p.name)+'</td><td>'+fmt(p.denominator)+' / '+fmt(p.sourceCount)+'</td><td>'+fmt(future.length)+'</td><td>'+fmt(undated.length)+'</td><td>'+escapeHtml(p.dateBasis)+'</td></tr>'};
  const exclusions=unique.map(p=>({p,future:(p.exclusions||[]).filter(e=>e.reason==='after_data_date').length,undated:(p.exclusions||[]).filter(e=>/date_missing|date_invalid/.test(e.reason)).length})).filter(r=>r.future||r.undated);
  if(!exclusions.length&&!includeComplete)return '';
  if(!includeComplete&&['master_dashboard','command_center','master_control_programme'].includes(data.projectionKey))return '<p class="source-scope-summary">'+(data.registerDateReview?.message||fmt(exclusions.length)+' record groups need date review.')+' '+managementModuleLink('source-quality','Review register dates')+'</p>';
  const disclosure=exclusions.length?fmt(exclusions.length)+' record groups include later or missing dates. Open counts.':'Records included through '+planningShortDate(contract.dataDateIso);
  return '<details class="source-scope-summary"><summary>'+disclosure+'</summary><p>Reporting date: '+planningShortDate(contract.dataDateIso)+'. Counts are per group and may overlap. Future work remains in the plan. Later actual events are excluded from current totals. A zero means no records were excluded on this date rule; other dates may still be missing.</p><div class="table-wrap"><table><thead><tr><th>Register</th><th>Included / all records</th><th>Future excluded</th><th>Date missing / invalid</th><th>Date used</th></tr></thead><tbody>'+unique.map(row).join('')+'</tbody></table></div></details>';
}
function readerModuleSummary(reason){
  const text=String(reason||'').split('Shared readiness gate:')[0].trim();
  return text?text.replace(/\bgoverned\b/gi,'confirmed').replace(/\bnot established\b/gi,'not confirmed'):'Open this page for its figures and follow-up actions.';
}
function readerIssue(i){
  // Translate CMeng-authored issue descriptions only. The original check text,
  // document names, values and references remain untouched in the disclosure.
  const known={
    CONTRACT_DUPLICATE_SECTION_INSTANCE:['Contract section numbers repeat','Check the repeated contract section numbers and confirm which text applies.'],
    SUBMITTED_INDEPENDENT_DIFFERENCE:['Submitted and independent positions differ','Compare the submitted and independent dates, work covered, calendars and assumptions.'],
    CALCULATION_CHECK_FAILED:['Calculation failed','CMeng must correct the calculation before these figures are used.'],
    CROSS_MODULE_CONTRADICTION:['Figures disagree between pages','CMeng must correct the affected pages and repeat the comparison.'],
    CALCULATION_NOT_VERIFIED:['Calculation checks are incomplete','CMeng must complete the checks listed below.'],
    COMPARABLE_ASSERTION_MISSING:['A reported comparison figure is missing','Confirm the figure to compare, its reporting date and the work it covers.'],
    COMPARABLE_SOURCE_CONFLICT:['Documents report different values','Confirm which document applies and explain the difference.'],
    NOTICE_TRIGGER_DATES_MISSING:['Event dates needed to assess notices','Provide the event or awareness date for each notice, then check the applicable contract period.'],
    EVENT_ACTIVITY_LINKAGE_INCOMPLETE:['Delay events need affected activities','Identify the programme activities affected by each event and provide the supporting records.'],
    CAUSAL_ENTITLEMENT_EVIDENCE_MISSING:['Delay responsibility needs supporting records','Identify the responsible party, affected activities, applicable notice and time impact for each event.'],
    SUBMITTED_NOT_INTERPRETED:['A document has not yet been read','CMeng must check the document and extract the information it contains.'],
    DATED_VARIATION_LEDGER_VS_SOURCE_AGGREGATE_CONFLICT:['Reported variations differ from dated approvals','Compare the amendment and cost report with the dated variation approvals in Variations & Change.'],
    RISK_RATING_SCORE_CONFLICT:['Risk ratings do not match their scores','Confirm the rating matrix or documented overrides, then check the affected risk ratings and status dates.'],
    DESIGN_STATUS_DATE_CONFLICT:['Design status and dates disagree','Confirm the approval status and dates for the listed design records.'],
    MATERIAL_LINK_TIMING_MISMATCH:['Material delivery dates need checking','Check the required delivery dates against the linked activities and correct the dates or activity links.'],
    CLOSURE_BEFORE_RAISED_DATE:['Closure dates precede raised dates','Confirm when each listed record was raised and closed, then correct the inconsistent dates.'],
    HSE_TRIR_RECONCILIATION_REQUIRED:['HSE rate and exposure hours need reconciliation','Confirm the incident count, exposure hours and calculation method used for the reported HSE rate.'],
  };
  const words=s=>readerText(s).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_]/g,' ').replace(/\bsource\b/gi,'record').replace(/\bgoverned\b/gi,'confirmed').replace(/\bauthority review\b/gi,'approval needed').replace(/\bnot established\b/gi,'not confirmed').replace(/\bdata quality\b/gi,'record needs correction').replace(/\bpopulation\b/gi,'record group');
  const fields={hse:'HSE hours and incident figures',physical:'Measured physical progress',contractorReported:'Contractor-reported progress',certified:'Certified progress',finishMovementAnalysis:'Activity finish dates',mapping:'Programme activity links',manpower:'Staffing plan',productivity:'Productivity assumptions',pendingVariationAmount:'Pending variation amount',interimCertificateCount:'Interim certificates',grossCertifiedAmount:'Gross certified amount',paidAmount:'Paid amount and date',certifiedUnpaidAmount:'Certified amount still unpaid',retentionHeldAmount:'Retention still held',advanceBalance:'Advance payment balance',activeBondAmount:'Active bond amount',claimedAmount:'Claimed amount',assessedClaimAmount:'Assessed claim amount',netCertifiedAmount:'Net certified amount',ldRate:'Delay damages rate',ldCap:'Delay damages cap',retentionPercent:'Contract retention rate',retentionCapPercent:'Contract retention cap',certificationPeriodDays:'Certificate assessment period',paymentPeriodDays:'Contract payment period',performanceBondRequirement:'Performance bond requirement',advancePaymentBondRequirement:'Advance payment bond requirement',cbsBreakdownSummary:'Cost breakdown',cashFlowSummary:'Cash flow',cbsBreakdown:'Cost breakdown',price:'Price variance',quantity:'Quantity variance',claimed:'Claimed cost',assessed:'Assessed cost',agreed:'Agreed cost',scheduleImpactDays:'Time impact of variations',siteInstructions:'Site instructions',pending:'Pending variations',certificationDueDate:'Certificate due date',paymentDueDate:'Payment due date',applicationAmount:'Payment application amount',engineerAssessedAmount:'Engineer-assessed amount',employerCertifiedAmount:'Employer-certified amount',otherDeduction:'Other certificate deductions',taxAmount:'Tax amount',outstandingAmount:'Outstanding amount',calculatedOutstandingAmount:'Outstanding balance calculation',cashFlowRegister:'Cash movement register',certifiedIncome:'Certified income',paidIncome:'Cash received',expenditureBudget:'Expenditure budget',expenditureForecast:'Expenditure forecast',actualExpenditure:'Actual cash expenditure',netCashPosition:'Net cash position',peakFundingNeed:'Peak funding requirement',certifiedUnpaid:'Unpaid certificates',certification:'Certificate amounts and dates',expenditure:'Cash expenditure records',forwardPlan:'Future cash plan',bondsInsurance:'Bonds and insurance',retention:'Retention',noticeRequirements:'Notice requirements',obligations:'Contract obligations'};
  const parts=String(i.summary||'').split(' · '),field=parts.length>1?parts[parts.length-2]:'';
  const clean=s=>String(s).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_]/g,' ').replace(/\b(?:focus|data|currencies|amounts|rows|lifecycle|sourceReadiness)\b/g,'').replace(/\s+/g,' ').trim();
  const fieldKey=Object.keys(fields).find(k=>k.toLowerCase()===field.replace(/\s+/g,'').toLowerCase());
  const subject=fields[fieldKey]||clean(field);
  const diagnostic=['SOURCE_CONFLICT','SOURCE_QUALITY','MISSING_SOURCE_VALUE'].includes(i.code)?String(i.detail||'').split(';').map(s=>s.trim().split(':')[0]).find(s=>known[s]):null;
  const description=known[i.code]||known[diagnostic];
  const suffix={missing_information:'information needed',source_conflict:'records disagree',data_quality:'record needs correction',governance_review:'approval needed',verification_pending:'check pending'}[i.kind]||'review needed';
  const title=description?.[0]||(subject?subject.charAt(0).toUpperCase()+subject.slice(1)+' · '+suffix:words(i.summary));
  const path=(i.evidencePaths||[]).join(' ').toLowerCase();
  let action=description?.[1];
  if(!action&&i.kind==='missing_information'){
    if(/advance/.test(path))action='Provide the advance payment record, receipt date and recovery deductions.';
    else if(/retention/.test(path))action='Confirm the retention deducted, released and still held, with the release dates or contract conditions.';
    else if(/bond|insurance/.test(path))action='Provide the bond or insurance register with amounts, expiry dates and current status.';
    else if(/notice|event/.test(path))action='Confirm the event dates, applicable clause and notice dates in the records listed below.';
    else if(/cash|paid|payment|receipt/.test(path))action='Provide the certificate, receipt or payment amount and its actual event date for the listed records.';
    else if(/capacity|resource/.test(path))action='Confirm each resource limit, its unit and the dates it applies.';
    else if(/quantity|installed/.test(path))action='Provide dated installed quantities by unit and link each item to its programme activity.';
    else if(/liquidated|ldrate|ldcap/.test(path))action='Provide the contract clause stating the delay damages rate and cap.';
  }
  if(!action&&i.action==='Reconcile the retained source records; do not replace them with a silent default.')action='Compare the conflicting records, confirm the applicable value and document the reason for the decision.';
  if(!action&&i.action==='Correct or govern the specific source record, then rerun the same validation.')action='Check the records listed below, correct the inconsistent details and repeat the check.';
  if(!action&&i.action==='Supply or identify the specific missing input; an existing register does not establish every field or calculation. Do not substitute zero.')action='Provide '+(subject?subject.toLowerCase():'the missing information')+' with the applicable date and supporting record. Leave the value unconfirmed until it is available.';
  action=action||words(i.action);
  const moduleKeys=(i.moduleKeys??[]).map(value=>String(value).toLowerCase()).join(' ');
  const accountableRole=/procure|long-lead|material/.test(moduleKeys)?'Procurement Manager':
    /design|rfi|interface/.test(moduleKeys)?'Design Manager':
    /quality|ncr|hse/.test(moduleKeys)?'QA/QC Manager':
    /schedule|programme|planning|forecast|critical|delay/.test(moduleKeys)?'Planning Manager':
    /commercial|payment|contract|claim|bond|cash|cost|retention|advance|certificate|security/.test(moduleKeys)?'Commercial Manager':
    'Project Controls Manager';
  const owner=String(i.owner&&i.owner!=='Project evidence owner'?i.owner:accountableRole).replace(/\s*\(assign a person\)/gi,'');
  return {title:readerText(title),action:readerText(action),owner,assignTo:owner};
}
function renderSourceQuality(data){
  const rows=items=>items.length?'<div class="source-request-list">'+items.map(i=>{const r=readerIssue(i);return '<details class="source-request"><summary><b>'+escapeHtml(r.title)+'</b><span class="request-meta">'+fmt((i.sourceRefs||[]).length)+' references · '+fmt(i.moduleKeys.length)+' affected pages</span></summary><p><b>Next step:</b> '+escapeHtml(r.action)+'</p><p><b>Owner:</b> '+escapeHtml(r.owner)+'</p><p><b>Assign to:</b> '+escapeHtml(r.assignTo)+'</p><p>'+i.moduleKeys.map(k=>managementModuleLink(k,names[k]||k)).join(' ')+'</p><details><summary>Original finding and document references</summary><p>'+escapeHtml(i.summary)+'</p><p>'+escapeHtml(i.detail)+'</p><p>'+escapeHtml(i.action)+'</p>'+((i.sourceRefs||[]).length?'<ul>'+i.sourceRefs.map(r=>'<li>'+escapeHtml(r)+'</li>').join('')+'</ul>':'')+'</details></details>';}).join('')+'</div>':'<p>None identified in the listed checks.</p>';
  const dateReview=data.registerDateReview;
  const dateDetail=dateReview?managementPanel('Register dates',dateReview.message,basisTable(['Register','Date columns','Result'],dateReview.rows.map(r=>[r.filename,r.columns.join(', ')||r.fields.join(' or '),r.message]))):'';
  const groups=[['Records that disagree','source_conflict'],['Records to correct','data_quality'],['Information to provide','missing_information']];
  const failures=managementPanel('System failures','CMeng is responsible for correcting these calculation failures.',rows(data.systemFailures||[]));
  return '<section class="source-quality-page"><div id="projectActionPanel">'+(typeof renderProjectActionList==='function'?renderProjectActionList():'')+'</div><details class="management-detail"><summary>Supporting findings, source references and system checks</summary><p>The action list above is the place to complete your decisions. Identical requests are counted once; all record references remain available. These details retain the original checks and source references.</p><div class="source-quality-counts">'+[['Information items',data.sourceIssues],['System failures',data.systemFailures],['Reviews / approvals',data.reviewActions],['Checks pending',data.pendingChecks]].map(([label,items])=>'<div>'+label+'<b>'+fmt(items?.length||0)+'</b></div>').join('')+'</div>'+(data.systemFailures?.length?failures:experienceDisclosure('System checks',failures,'No failures in the listed checks'))+managementPanel('Information and actions','Open an item to see what to provide, who should act and which pages it affects.',groups.map(([label,kind])=>{const items=(data.sourceIssues||[]).filter(i=>i.kind===kind);return experienceDisclosure(label,rows(items),fmt(items.length)+' items');}).join(''))+dateDetail+experienceDisclosure('Reviews and approvals',rows(data.reviewActions||[]),fmt(data.reviewActions?.length||0)+' items')+experienceDisclosure('Figures compared across pages',basisTable(['Measure','Result','Page values'],(data.pageValueChecks||[]).map(c=>[c.metric,humanizeKey(c.state),c.values.map(v=>(names[v.page]||v.page)+': '+(typeof v.value==='object'?JSON.stringify(v.value).slice(0,200)+' (full value in data download)':v.value)).join(' · ')])),'Results and value previews; full records in data download')+experienceDisclosure('Calculation checks',rows(data.pendingChecks||[])+(data.coverage||[]).map(r=>'<details><summary>'+escapeHtml(names[r.key]||r.key)+' · '+escapeHtml(humanizeKey(r.state))+' · '+fmt(r.checks.length)+' checks</summary>'+basisTable(['Measure','Expected','Actual','Result'],r.checks.map(c=>[c.metric,JSON.stringify(c.expected),JSON.stringify(c.actual),c.passed?'Passed':'Failed']))+'</details>').join(''),'Checks completed and work still pending')+experienceDisclosure('Project documents',basisTable(['Document','Type','Status','Uploaded'],(data.documents||[]).map(d=>[d.name,humanizeKey(d.type),humanizeKey(d.state),formatDocumentTime(d.uploadedAt)])),fmt(data.documents?.length||0)+' documents')+'</details></section>';
}
function renderDashboardDecisions(data){
  const decisions=(data.actions||[]).filter(row=>row.recordKey?.startsWith('review|'));
  const body=decisions.length?'<div class="decision-list">'+decisions.slice(0,5).map(row=>'<article><b>'+escapeHtml(readerText(row.issue))+'</b><p>'+escapeHtml(readerText(row.requiredAction))+'</p>'+managementModuleLink('source-quality','Open the pre-filled review action')+'</article>').join('')+'</div>':'<p>No source confirmation is awaiting action.</p>';
  return managementPanel('Source decisions',fmt(decisions.length)+' source reviews within the shared project action list.',body);
}
function renderDashboardExceptions(data){
  const actions=data.actions||[];
  const table=rows=>basisTable(['Action','Effect','Owner','Due','Next step'],rows.map(row=>[readerText(row.issue),row.priorityBasis?.drivingPath?'Driving network':row.priorityBasis?.linkedFloatHours!=null?fmt(row.priorityBasis.linkedFloatHours)+' h float':(row.moneyAtRisk||[]).map(m=>fmt(m.amount)+' '+m.currency).join(', ')||readerText(row.consequence),row.owner||(typeof pmcDisplayOwner==='function'?pmcDisplayOwner(row.owningModule||'project controls'):'PMC Project Controls Manager'),row.dueIso?planningShortDate(row.dueIso):'Not set',readerText(row.requiredAction)]));
  return managementPanel('Priority project actions',fmt(actions.length)+' actions in the shared register, ranked by programme and monetary effect.',actions.length?table(actions.slice(0,5))+managementModuleLink('command-center','Open all '+fmt(actions.length)+' project actions'):'<p>No current project actions are identified.</p>',true);
}
function renderDashboardScheduleExceptions(data){
  const p=data.scheduleExceptions;if(!p)return managementPanel('Activities needing attention','Schedule status','<p>Adopt a programme in Documents to see missed starts, overdue finishes and critical activities.</p>',true);
  const count=key=>{const c=p.counts?.[key];return c?.value??(c?.knownCount!=null?c.knownCount+' known; total unconfirmed':'Not established');};
  const rows=p.rows||[];
  const kpis=planningKpis([['Should have started',count('missedStart'),'not started before the Data Date','warning'],['Finish overdue',count('overdueFinish'),'unfinished after the forecast finish','danger'],['Programme critical activities',count('critical'),'source float; see the separate calculated path','warning']]);
  const table=rows.length?basisTable(['Activity','Work','What needs attention','Planned start','Forecast finish','Progress','Float (hours)'],rows.slice(0,50).map(r=>[r.activityId,r.name,r.delayStatus,planningShortDate(r.currentStartIso),planningShortDate(r.currentFinishIso),r.percentComplete==null?'Not established':fmt(r.percentComplete)+'%',r.totalFloatHours==null?'Not established':fmt(r.totalFloatHours)])):'<p>No confirmed missed starts or overdue finishes were found. Review any missing dates or status before treating the programme as clear.</p>';
  return managementPanel('Activities needing attention','As of '+planningShortDate(p.dataDate)+'. These are schedule warning signs; they do not by themselves prove the cause of project delay.',kpis+table+'<p>'+(rows.length?'Showing '+Math.min(50,rows.length)+' of '+rows.length+' activities. ':'')+'Ask CMeng “Show delayed activities” for the activity lists and schedule pressure.</p>'+managementModuleLink('activity-analytics','Open Activity Review'),true);
}
function renderDashboardTrend(data){
  const rows=data.trend?.points||data.trend?.rows||data.trend?.revisions||[];
  if(!rows.length)return managementPanel('Completion trend','Dated revision history','<p>At least two dated revisions are needed to establish a trend.</p>');
  return managementPanel('How submitted completion changed','Revision dates and submitted finish dates; calendar recalculation is a separate comparison.',planningDateTrend(rows.map(r=>({...r,dateIso:r.dataDateIso||r.dateIso})),[{key:'sourceForecastCompletionIso',label:'Submitted completion',color:'#4276aa'}]));
}
`;
