export const systemReviewStyles=String.raw`
.page-review-summary{font-size:12px;color:#526479;margin:8px 0 14px}.page-review-summary summary{cursor:pointer}.page-review-summary p{line-height:1.6}.position-verdict>p{font-size:16px;line-height:1.5}.source-request{padding:12px;border-bottom:1px solid #dce5ef}.source-request summary{cursor:pointer;line-height:1.6}.request-meta{display:block;color:#607188;font-size:12px}.module-basis{font-size:12px}

.nav-review-totals{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;font-size:10px}.nav-review-totals div{padding:9px;background:#f1f5fa;border-radius:7px}.nav-review-totals b{display:block;font-size:18px;color:#284967}.position-verdict{border:1px solid #cfdae7;border-left:5px solid #b57922;border-radius:8px;padding:12px 16px;margin:0 0 12px;background:#fff}.position-verdict.red{border-left-color:#b4483e}.position-verdict.green{border-left-color:#2c7a57}.position-verdict.unknown{border-left-color:#7c8998}.position-verdict h4{margin:0 0 8px;font-size:14px}.position-verdict p{margin:6px 0}.position-verdict small{color:#566c81}.position-verdict details{margin-top:9px;font-size:12px}.nav-counts{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.nav-counts .nav-count{font-size:9px;padding:2px 4px}.source-scope-summary{font-size:12px;margin-bottom:18px;padding:8px 12px;background:#f7f9fc;border-radius:7px}.source-scope-summary summary{cursor:pointer;font-weight:650}.source-quality-counts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.source-quality-counts div{padding:16px;background:#f4f7fb;border:1px solid #dce5ef;border-radius:8px}.source-quality-counts b{display:block;font-size:25px}.decision-list{display:grid;gap:10px}.decision-list article{padding:15px;border:1px solid #dce5ef;border-radius:8px}.decision-list p{margin:5px 0}.decision-list small{display:block;margin-top:6px;color:#536c85}.future-register-note{margin:8px 0}.single-axis-caption{font-size:14px;font-weight:650;margin:18px 0 0}
`;
export const systemReviewScript=String.raw`
function renderPositionVerdict(data){
  const v=data?.positionVerdict;if(!v)return '';
  const next='<p><b>Next step:</b> '+escapeHtml(v.nextAction)+' <b>Owner:</b> '+escapeHtml(v.owner)+'</p><p>'+escapeHtml(v.basis)+'</p>';
  if(v.specific===false)return '<details class="page-review-summary"><summary>About this view</summary><p>'+escapeHtml(v.text)+'</p>'+next+'</details>';
  return '<section class="position-verdict '+escapeHtml(v.rag)+'" aria-label="Position verdict"><h4>'+escapeHtml(v.label)+'</h4><p>'+escapeHtml(v.text)+'</p><details><summary>Next step and status</summary>'+next+'</details></section>';
}
function renderRegisterScope(data){
  const contract=data?.reportingContract;if(!contract)return '';
  const populations=Object.values(contract.populations||{}).filter(p=>!['activity','execution_activity','series_point','currency_position','resource','assignment','programme_window'].includes(p.entity)&&!p.dateBasis?.startsWith('Full retained source register')&&!p.dateBasis?.startsWith('Source records after')&&!p.dateBasis?.startsWith('Source records without'));
  if(!populations.length)return '';
  const unique=[...new Map(populations.map(p=>[p.populationId,p])).values()];
  const row=p=>{const exclusions=p.exclusions||[],future=exclusions.filter(e=>e.reason==='after_data_date'),undated=exclusions.filter(e=>/date_missing|date_invalid/.test(e.reason));return '<tr><td>'+escapeHtml(p.name)+'</td><td>'+fmt(p.denominator)+' / '+fmt(p.sourceCount)+'</td><td>'+fmt(future.length)+'</td><td>'+fmt(undated.length)+'</td><td>'+escapeHtml(p.dateBasis)+'</td></tr>'};
  const exclusions=unique.map(p=>({p,future:(p.exclusions||[]).filter(e=>e.reason==='after_data_date').length,undated:(p.exclusions||[]).filter(e=>/date_missing|date_invalid/.test(e.reason)).length})).filter(r=>r.future||r.undated);
  const disclosure=exclusions.length?fmt(exclusions.length)+' record groups include later or missing dates. Open counts.':'Records included through '+planningShortDate(contract.dataDateIso);
  return '<details class="source-scope-summary"><summary>'+disclosure+'</summary><p>Reporting date: '+planningShortDate(contract.dataDateIso)+'. Counts are per group and may overlap. Future work remains in the plan. Later actual events are excluded from current totals. A zero means no records were excluded on this date rule; other dates may still be missing.</p><div class="table-wrap"><table><thead><tr><th>Register</th><th>Included / all records</th><th>Future excluded</th><th>Date missing / invalid</th><th>Date used</th></tr></thead><tbody>'+unique.map(row).join('')+'</tbody></table></div></details>';
}
function readerIssue(i){
  // Translate CMeng-authored issue descriptions only. The original check text,
  // document names, values and references remain untouched in the disclosure.
  const known={
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
  };
  const words=s=>String(s||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_]/g,' ').replace(/\bsource\b/gi,'record').replace(/\bgoverned\b/gi,'confirmed').replace(/\bauthority review\b/gi,'approval needed').replace(/\bnot established\b/gi,'not confirmed').replace(/\bdata quality\b/gi,'record needs correction').replace(/\bpopulation\b/gi,'record group');
  const title=known[i.code]?.[0]||words(i.summary);
  const path=(i.evidencePaths||[]).join(' ').toLowerCase();
  let action=known[i.code]?.[1];
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
  action=action||words(i.action);
  return {title,action,owner:i.owner==='Project evidence owner'?'Document owner (assign a person)':i.owner};
}
function renderSourceQuality(data){
  const rows=items=>items.length?'<div class="source-request-list">'+items.map(i=>{const r=readerIssue(i);return '<details class="source-request"><summary><b>'+escapeHtml(r.title)+'</b><span class="request-meta">'+fmt((i.sourceRefs||[]).length)+' references · '+fmt(i.moduleKeys.length)+' affected pages</span></summary><p><b>Next step:</b> '+escapeHtml(r.action)+'</p><p><b>Owner:</b> '+escapeHtml(r.owner)+'</p><p>'+i.moduleKeys.map(k=>managementModuleLink(k,names[k]||k)).join(' ')+'</p><details><summary>Original finding and document references</summary><p>'+escapeHtml(i.summary)+'</p><p>'+escapeHtml(i.detail)+'</p><p>'+escapeHtml(i.action)+'</p>'+((i.sourceRefs||[]).length?'<ul>'+i.sourceRefs.map(r=>'<li>'+escapeHtml(r)+'</li>').join('')+'</ul>':'')+'</details></details>';}).join('')+'</div>':'<p>None identified in the listed checks.</p>';
  const groups=[['Records that disagree','source_conflict'],['Records to correct','data_quality'],['Information to provide','missing_information']];
  const failures=managementPanel('System failures','CMeng is responsible for correcting these calculation failures.',rows(data.systemFailures||[]));
  return '<section class="source-quality-page"><p>Confirm conflicting records, provide missing information and assign the follow-up. Identical requests are counted once; all record references remain available.</p><div class="source-quality-counts">'+[['Information items',data.sourceIssues],['System failures',data.systemFailures],['Reviews / approvals',data.reviewActions],['Checks pending',data.pendingChecks]].map(([label,items])=>'<div>'+label+'<b>'+fmt(items?.length||0)+'</b></div>').join('')+'</div>'+(data.systemFailures?.length?failures:experienceDisclosure('System checks',failures,'No failures in the listed checks'))+managementPanel('Information and actions','Open an item to see what to provide, who should act and which pages it affects.',groups.map(([label,kind])=>{const items=(data.sourceIssues||[]).filter(i=>i.kind===kind);return experienceDisclosure(label,rows(items),fmt(items.length)+' items');}).join(''))+experienceDisclosure('Reviews and approvals',rows(data.reviewActions||[]),fmt(data.reviewActions?.length||0)+' items')+experienceDisclosure('Figures compared across pages',basisTable(['Measure','Result','Page values'],(data.pageValueChecks||[]).map(c=>[c.metric,humanizeKey(c.state),c.values.map(v=>(names[v.page]||v.page)+': '+(typeof v.value==='object'?JSON.stringify(v.value).slice(0,200)+' (full value in data download)':v.value)).join(' · ')])),'Results and value previews; full records in data download')+experienceDisclosure('Calculation checks',rows(data.pendingChecks||[])+(data.coverage||[]).map(r=>'<details><summary>'+escapeHtml(names[r.key]||r.key)+' · '+escapeHtml(humanizeKey(r.state))+' · '+fmt(r.checks.length)+' checks</summary>'+basisTable(['Measure','Expected','Actual','Result'],r.checks.map(c=>[c.metric,JSON.stringify(c.expected),JSON.stringify(c.actual),c.passed?'Passed':'Failed']))+'</details>').join(''),'Checks completed and work still pending')+experienceDisclosure('Project documents',basisTable(['Document','Type','Status','Uploaded'],(data.documents||[]).map(d=>[d.name,humanizeKey(d.type),humanizeKey(d.state),formatDocumentTime(d.uploadedAt)])),fmt(data.documents?.length||0)+' documents')+'</section>';
}
function renderDashboardDecisions(data){
  const recordIds=new Set((data.operationalReporting?.actions||[]).map(r=>r.recordId));
  const decisions=(data.decisions||[]).filter(d=>!recordIds.has(d.recordId)&&![...recordIds].some(id=>id&&String(d.title||d.label||d.action||d.description).includes(id)));
  const body=decisions.length?'<div class="decision-list">'+decisions.slice(0,6).map(d=>'<article><b>'+escapeHtml(d.title||d.label||d.action||d.description)+'</b><small>Owner: '+escapeHtml(d.accountableOwner||d.owner||'Assignment needed')+' · Due: '+escapeHtml((d.dueDate||d.dueIso)?planningShortDate(d.dueDate||d.dueIso):'Date needed')+'</small><div>'+managementModuleLink(d.owningModule||'command-center','Review decision')+'</div></article>').join('')+'</div>':'<p>No decision has been recorded. Assign the outstanding document requests and delivery actions below.</p>';
  return managementPanel('Decisions required','Confirm the decision, assign an owner and set a due date.',body+(decisions.length>6?managementModuleLink('command-center','All '+decisions.length+' decisions'):''),true);
}
function renderDashboardExceptions(data){
  const actions=data.operationalReporting?.actions||[];
  const table=rows=>basisTable(['Record','Priority','Age at reporting date','Overdue','Owner','Due','Action'],rows.map(r=>[r.recordId,r.priority,r.ageDays==null?'Raised date needed':r.ageDays+' d',r.overdueDays==null?'Due date needed':r.overdueDays+' d',r.owner||'Assign owner',r.dueIso?planningShortDate(r.dueIso):'Set due date',r.action]));
  return managementPanel('Delivery exceptions requiring action','Critical items appear first, then the most overdue and oldest. Assign any missing owner or due date.',actions.length?table(actions.slice(0,5))+experienceDisclosure('All '+fmt(actions.length)+' action records',table(actions),'Complete NCR and RFI exceptions'):'<p>No confirmed open NCR or overdue RFI exceptions are present in the dated source subset.</p>',true);
}
function renderDashboardTrend(data){
  const rows=data.trend?.points||data.trend?.rows||data.trend?.revisions||[];
  if(!rows.length)return managementPanel('Completion trend','Dated revision history','<p>At least two dated revisions are needed to establish a trend.</p>');
  return managementPanel('How submitted completion changed','Revision dates and submitted finish dates; calendar recalculation is a separate comparison.',planningDateTrend(rows.map(r=>({...r,dateIso:r.dataDateIso||r.dateIso})),[{key:'sourceForecastCompletionIso',label:'Submitted completion',color:'#4276aa'}]));
}
`;
