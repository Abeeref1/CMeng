export const projectDiagnosisStyles=String.raw`
.project-diagnosis{margin-bottom:24px}.diagnosis-heading h3{margin:0;font-size:22px}.diagnosis-heading p{color:var(--muted);margin:5px 0 16px}.diagnosis-summary{font-size:17px;line-height:1.65;margin:18px 0}.diagnosis-section{background:white;border:1px solid var(--line);border-radius:10px;padding:18px;margin:18px 0}.diagnosis-section h4{font-size:18px;margin:0 0 8px}.diagnosis-section p{line-height:1.6}.diagnosis-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0}.diagnosis-table{overflow-x:auto}.diagnosis-table table{font-size:12px;min-width:720px}.diagnosis-table td{max-width:340px;white-space:normal;overflow-wrap:anywhere}.diagnosis-note{font-size:13px;color:var(--muted)}.diagnosis-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:12px}.diagnosis-action{padding:14px;background:#f8fbfe;border:1px solid var(--line);border-radius:8px}.diagnosis-action h5{margin:0 0 7px;font-size:15px}.diagnosis-action p{font-size:13px;margin:6px 0}.brief-management-conclusion{border-left:3px solid #75899c}.management-brief-support{margin-top:20px}.management-brief .planning-kpi-grid{margin:10px 0 18px}.management-brief .diagnosis-section p{margin:9px 0}
`;
import {countTextSource} from './count-text';
export const projectDiagnosisScript=String.raw`${countTextSource()}
let diagnosisTableSeq=0;const diagnosisTables=new Map();
function diagnosisCell(value){return fmtForField('diagnosis',value);}
function diagnosisTableHtml(t){
 const rows=t.rows.slice(0,t.limit),start=t.offset||0;
 return '<div class="diagnosis-table">'+basisTable(t.columns.map(c=>c[1]),rows.map(r=>t.columns.map(c=>/^(?:totalFloat|worstFloat)Hours$/.test(c[0])&&r[c[0]]!=null?sourceWorkingFloatField(r,c[0]):diagnosisCell(r[c[0]]))))+'</div><div class="diagnosis-toolbar"><span>'+(!rows.length?'No established matching rows.':(start+1)+'–'+(start+rows.length)+' of '+fmt(t.total))+'</span>'+
 (start?'<button class="btn small" onclick="diagnosisPage(\''+t.id+'\','+Math.max(0,start-t.limit)+')">Previous</button>':'')+
 (start+rows.length<t.total?'<button class="btn small" onclick="diagnosisPage(\''+t.id+'\','+(start+t.limit)+')">Next '+t.limit+'</button>':'')+
 (t.total?'<a class="btn small" href="'+t.url+'&format=xlsx" download>Download full Excel</a><a class="btn small" href="'+t.url+'&format=csv" download>CSV</a>':'')+'</div>';
}
function diagnosisTable(d,section,rows,columns,limit=8){
 const id='diagnosisTable'+(++diagnosisTableSeq),url='/api/projects/'+encodeURIComponent(d.projectId)+'/diagnosis?section='+section+'&version='+d.projectVersion;
 const t={id,projectId:d.projectId,version:d.projectVersion,section,rows,columns,limit,total:d.tableTotals?.[section]??rows.length,offset:0,url};
 diagnosisTables.set(id,t);while(diagnosisTables.size>64)diagnosisTables.delete(diagnosisTables.keys().next().value);
 return '<div id="'+id+'">'+diagnosisTableHtml(t)+'</div>';
}
async function diagnosisPage(id,offset){
 const t=diagnosisTables.get(id),target=el(id);if(!t||!target||project()!==t.projectId)return;
 target.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{const page=await api(t.url+'&offset='+offset+'&limit='+t.limit);if(project()!==t.projectId||!el(id))return;
  if(page.projectId!==t.projectId||page.projectVersion!==t.version)throw new Error('The project changed. Refresh the analysis.');
  t.rows=page.rows;t.total=page.total;t.offset=page.offset;el(id).innerHTML=diagnosisTableHtml(t);
 }catch(e){if(project()===t.projectId&&el(id))el(id).innerHTML=diagnosisTableHtml(t)+'<p role="alert">'+escapeHtml(e.message)+'</p>';}
}
function diagnosisAsk(question){setAppView('ai');el('aiQuestion').value=question;askCmeng();}
function milestoneExposureNote(exposure){
 if(exposure?.absenceConfirmed)return 'The source-bound review confirms no programme milestones. Contractual commitments remain separate.';
 if(exposure?.value==null)return 'Milestone exposure cannot be cleared or ranked for the complete population. '+(!exposure?.identifiedCount?'No milestone population has been identified or confirmed; review source types or select key dates.':(exposure.knownCount==null?'Priority count not established':fmt(exposure.knownCount)+' identified priorities')+'; population or assessment fields remain unresolved.');
 return exposure.value===0?'No identified milestone or reviewed key date is ranked for attention by the available programme checks. This is not a contractual clearance.':fmt(exposure.value)+' identified milestones or reviewed key dates are ranked for attention by the available programme checks.';
}
function renderProjectPrioritySummary(register){
 const actions=register?.actions||[];
 const decisions=actions.filter(row=>String(row.recordKey||'').startsWith('review|'));
 const decisionTotal=typeof listTotal==='function'?listTotal(decisions):decisions.length;
 const team=actions.filter(row=>!String(row.recordKey||'').startsWith('review|'));
 const teamTotal=typeof listTotal==='function'?listTotal(team):team.length;
 const text=value=>typeof readerText==='function'?readerText(value):String(value??'');
 const grouped=team.slice(0,3).map(row=>'<li><b>'+escapeHtml(text(row.issue))+'</b>'+
   '<p>'+escapeHtml(text(row.consequence||row.requiredAction||''))+'</p>'+
   '<small>Responsible: '+escapeHtml((typeof apiOwnerText==='function'?apiOwnerText(row):row.owner)||row.organisation||'Not assigned')+' · '+escapeHtml(actionDeadlineText(row))+'</small></li>').join('');
 return '<p>Contract interpretations and other confirmations are managed in Project Review. Operational work is assigned through Accountability.</p>'+
  '<p><button class="btn small" onclick="openProjectActions()">Open Project Review</button> '+managementModuleLink('cross-domain-accountability','Open Accountability')+'</p>'+
  // T05/N1: register.actions can be a 25-row preview; a subset of it is counted only when the list is whole.
  (decisions.length?'<p><b>'+(decisionTotal===null?fmt(decisions.length)+' source decision'+(decisions.length===1?'':'s')+' among the '+fmt(actions.length)+' of '+screenCountText(listTotal(actions))+' ranked actions received here.':fmt(decisionTotal)+' source decision'+(decisionTotal===1?'':'s')+' included in the ranked register.')+'</b> Confirm only after reviewing the original evidence.</p>':'')+
  '<h5>Highest-ranked delegated follow-ups</h5>'+
  (grouped?'<ol>'+grouped+'</ol>':'<p>No team follow-up is currently ranked from the available source records.</p>')+
  (team.length>3?'<p>'+(teamTotal===null?'More ranked groups remain':countText(teamTotal-3,'other ranked group',undefined,fmt)+(teamTotal-3===1?' remains':' remain'))+' in Accountability, with the full individual records.</p>':'');
}
function renderProjectDashboardSummary(d){
 if(!d)return '';
 const c=d.counts||{},value=x=>x?.value??('Not established'+(x?.knownCount!=null?' · '+fmt(x.knownCount)+' known':''));
 const networkEstablished=d.network?.state==='calculated'||d.network?.state==='scenario';
 const drivers=(d.wbsRows||[]).filter(r=>r.pressureCount||r.drivingCount).slice(0,3);
 const rawActions=d.actions||[],groupedActions=[];
 const groups=new Map();
 for(const action of rawActions){
  const wbs=String(action.wbs||'').split(' / ').slice(-3).join(' / ');
  const key=String(action.reason||'')+'|'+wbs;
  let group=groups.get(key);
  if(!group){group={reason:action.reason||'Programme action',action:action.action||'',wbs,items:[],rank:action.rank||999,groupedCount:0,wbsGroupCount:0};groups.set(key,group);groupedActions.push(group);}else if(!group.action&&action.action){group.action=action.action;}
  group.rank=Math.min(group.rank,action.rank||999);
  if(Number(action.groupedCount||1)>1){
    group.groupedCount+=Number(action.groupedCount||1);
    group.wbsGroupCount=Math.max(group.wbsGroupCount,Number(action.wbsGroupCount||1));
    for(const id of action.activityIds||[])group.items.push({activityId:id,name:''});
  }else{
    group.groupedCount+=1;
    group.items.push({activityId:action.activityId||'',name:action.name||''});
  }
 }
 groupedActions.sort((a,b)=>a.rank-b.rank);
 const actions=groupedActions.slice(0,5);
 const driverRows=drivers.length?'<ul>'+drivers.map(r=>'<li><b>'+escapeHtml(String(r.wbs||'').split(' / ').slice(-3).join(' / '))+'</b> · '+fmt(r.pressureCount)+' pressure · '+(networkEstablished&&r.drivingCount!=null?fmt(r.drivingCount)+' driving':'Driving count not established')+'</li>').join('')+'</ul>':'<p>No concentrated schedule pressure is established.</p>';
 // W5: a next step that repeats the one above it is not written out again.
 let lastAction=null;
 const nextStep=action=>{const same=action===lastAction;lastAction=action;return same?'Next: as above':'Next: '+action;};
 const actionRows=actions.length?'<ol>'+actions.map(group=>{
   const unique=[...new Map(group.items.filter(item=>item.activityId||item.name).map(item=>[(item.activityId||item.name),item])).values()];
   const identities=unique.slice(0,3).map(item=>[item.activityId,item.name].filter(Boolean).join(' · ')).filter(Boolean);
   const more=Math.max(0,group.groupedCount-identities.length);
   const identityText=identities.length?'<span class="muted">'+escapeHtml(identities.join('; '))+(more?' · '+escapeHtml(fmt(more))+' more':'')+(group.wbs?' · WBS '+escapeHtml(group.wbs):'')+'</span>':'<span class="muted">'+escapeHtml(fmt(group.groupedCount))+' related activities'+(group.wbs?' · WBS '+escapeHtml(group.wbs):'')+'</span>';
   return '<li><b>'+escapeHtml(group.reason)+'</b><br>'+identityText+(group.action?'<br><span class="muted">'+escapeHtml(nextStep(group.action))+'</span>':'')+'</li>';
 }).join('')+'</ol>':'<p>No immediate programme action is ranked from the available fields.</p>';
 return '<section class="project-diagnosis dashboard-summary"><header class="diagnosis-heading"><h3>Current project position</h3><p>Data Date '+planningShortDate(d.dataDateIso)+'</p></header>'+renderCompletionPosition(d.completion)+'<p class="diagnosis-summary">'+escapeHtml(d.summary)+'</p>'+planningKpis([['Critical',value(c.critical),d.criticalityBasisLabel||'Programme float basis'],['Negative float',value(c.negativeFloat),d.criticalityBasisLabel||'Programme float basis'],['Near-critical',value(c.nearCritical),d.criticalityBasisLabel||'Programme float basis'],['Driving network',networkEstablished?(d.tableTotals?.network??d.network?.rows?.length??'Not established'):'Not established','activities']])+'<div class="planning-primary-grid"><section class="diagnosis-section"><h4>Main schedule pressure</h4>'+driverRows+'</section><section class="diagnosis-section"><h4>Management priorities</h4>'+(d.actionRegister?renderProjectPrioritySummary(d.actionRegister):actionRows)+'</section></div><details><summary>Detailed programme analysis</summary>'+renderProjectDiagnosis(d)+'</details></section>';
}
function renderProjectBrief(d,data=null){
 if(!d)return '';
 const time=data?.projectFacts?.time||{},scheduleFacts=data?.projectFacts?.schedule||{};
 const original=time.contractualCompletionIso?.value??d.completion?.contractualFinishIso??null;
 const submitted=scheduleFacts.submittedProgrammeCompletionIso?.value??d.completion?.submittedFinishIso??null;
 const extended=time.extendedContractCompletionIso?.value??null;
 const verifiedExtended=time.extendedContractCompletionIso?.complete===true&&Boolean(extended);
 const independent=d.completion?.independentFinishIso??null;
 const verifiedNetwork=d.network?.state==='calculated'&&Boolean(independent);
 const originalDifference=time.submittedDaysAfterOriginalCompletion?.value??null;
 const extendedDifference=verifiedExtended?(time.submittedDaysAfterExtendedCompletion?.value??null):null;
 const amendmentStatements=Array.isArray(time.amendmentEotStatements)?time.amendmentEotStatements:[];
 const awarded=time.awardedEotDays?.value??null;
 const calculatedCount=x=>x?.value??x?.knownCount??null;
 const critical=calculatedCount(d.counts?.critical),negative=calculatedCount(d.counts?.negativeFloat),nearCritical=calculatedCount(d.counts?.nearCritical);
 const floatOrigin=d.criticalityBasis==='independent_cpm'?'Independent CPM':'Submitted programme float';
 const sourceQualified=d.criticalityBasis!=='independent_cpm';
 const fmtCount=(n)=>typeof n==='number'?fmt(n)+(sourceQualified?' reported':''):'Not established';
 const progress=typeof data?.progress?.durationWeightedProgressPercent==='number'?data.progress.durationWeightedProgressPercent:null;
 const tension=typeof originalDifference==='number'&&originalDifference<0&&typeof negative==='number'&&negative>0
   ?'<p><b>Important schedule inconsistency to investigate:</b> The submitted finish precedes the original contract date, yet '+fmt(negative)+' activities carry negative float. Review interim constraints, calendars and programme logic before inferring the governing completion risk.</p>':'';
 const originalComparison=typeof originalDifference==='number'
  ?'The submitted completion is '+(originalDifference<0?fmt(Math.abs(originalDifference))+' calendar days before':originalDifference>0?fmt(originalDifference)+' calendar days after':'on')+' the original contractual completion'+(originalDifference===0?' date.':'.'):'The submitted finish cannot yet be compared with the original contractual date.';
 const verifiedComparison=typeof extendedDifference==='number'
  ?'Against the independently established adjusted contract date, the submitted programme is '+(extendedDifference<0?fmt(Math.abs(extendedDifference))+' calendar days early':extendedDifference>0?fmt(extendedDifference)+' calendar days late':'on the adjusted completion date')+'.'
  :'The governing completion date after extension is not established. No contractual lateness figure can be concluded.';
 const networkMessage=verifiedNetwork
  ?'CMeng has a reconciled independent finish calculation. Confirm the critical path and activity impacts in the programme detail.'
  :'CMeng cannot currently establish an independent finish-driving path or recalculated completion. Submitted float is a warning, not proof of project delay.';
 const amendmentText=amendmentStatements.length
  ?amendmentStatements.map(row=>'<p><b>Recorded amendment:</b> '+escapeHtml(row.statement)+' <small>('+escapeHtml(readerReference(row.documentId))+')</small></p>').join('')
  :'<p>No explicit extension wording was identified in the available amendment records.</p>';
 const determined=typeof awarded==='number'?fmt(awarded)+' days in the dated determination basis':'Not independently established from the determination evidence';
 const contractPosition='<section class="diagnosis-section"><h4>Contract dates and extension authority</h4>'+
  planningKpis([
   ['Original contractual completion',original?planningShortDate(original):'Not established','Recorded original agreement'],
   ['EOT from determinations',determined,'Separate from amendment wording'],
   ['Adjusted contractual completion',verifiedExtended?planningShortDate(extended):'Not established','A qualified candidate is not an approved deadline'],
   ['Submitted programme finish',submitted?planningShortDate(submitted):'Not established','Current submitted programme']
  ])+
  amendmentText+
  '<p><b>Time comparison:</b> '+escapeHtml(originalComparison)+'</p>'+
  '<p><b>Current contractual position:</b> '+escapeHtml(verifiedComparison)+'</p>'+
  (extended&&!verifiedExtended?'<details><summary>Qualified date requiring confirmation</summary><p>CMeng holds '+escapeHtml(planningShortDate(extended))+' as an unconfirmed comparison candidate. Its amendment or determination overlap must be reviewed before it becomes a governing date.</p></details>':'')+
  '</section>';
 const keyFigures=planningKpis([
   ['Schedule progress',progress===null?'Not established':fmt(progress)+'%','Duration-weighted source programme; not certified physical progress'],
   ['Critical activities',fmtCount(critical),floatOrigin],
   ['Negative-float activities',fmtCount(negative),floatOrigin],
   ['Near-critical activities',fmtCount(nearCritical),floatOrigin],
   ['Independent CPM finish',independent?planningShortDate(independent):'Not established','Calculated finish, not an EOT decision']
 ]);
 const summary='<section class="diagnosis-section brief-management-conclusion"><h4>Management conclusion</h4>'+
  '<p><b>Completion:</b> '+escapeHtml(originalComparison)+' '+escapeHtml(verifiedComparison)+'</p>'+
  '<p><b>Schedule confidence:</b> '+escapeHtml(networkMessage)+'</p>'+tension+
  '<p><b>Required management response:</b> Establish the governing contract date, correct or reconcile the programme logic and calendars, and require dated recovery plans from the affected workfront owners.</p>'+
  '<p><small>All figures use the stated reporting date. No source-float warning or date comparison independently establishes contractual delay responsibility.</small></p></section>';
 const drivers=(d.wbsRows||[]).filter(r=>r.pressureCount||r.drivingCount).slice(0,4);
 const driversHtml=drivers.length
  ?'<div class="table-wrap"><table><thead><tr><th>Workfront</th><th>Activities under pressure</th><th>Critical</th><th>Negative float</th><th>Lowest reported float</th><th>Confirmed driving activities</th></tr></thead><tbody>'+
    drivers.map(row=>'<tr><td><b>'+escapeHtml(String(row.wbs||'').split(' / ').slice(-3).join(' / ')||'Project workfront')+'</b></td>'+
      '<td>'+fmt(row.pressureCount)+'</td><td>'+fmt(row.criticalCount)+'</td><td>'+fmt(row.negativeFloatCount)+'</td>'+
      '<td>'+escapeHtml(row.worstFloatHours==null?'Not established':sourceWorkingFloatField(row,'worstFloatHours'))+'</td>'+
      '<td>'+escapeHtml(verifiedNetwork?fmt(row.drivingCount):'Not established')+'</td></tr>').join('')+
    '</tbody></table></div>'
  :'<p>No concentration ranking is established from the available programme data.</p>';
 const milestones=(d.milestoneRows||[]).slice(0,5);
 const milestoneHtml=milestones.length
  ?'<div class="table-wrap"><table><thead><tr><th>Milestone</th><th>Submitted date</th><th>Float</th><th>Required review</th></tr></thead><tbody>'+
    milestones.map(row=>'<tr><td>'+escapeHtml((row.name||row.activityId)+' ('+row.activityId+')')+'</td>'+
      '<td>'+escapeHtml(row.currentFinishIso?planningShortDate(row.currentFinishIso):'Not established')+'</td>'+
      '<td>'+escapeHtml(row.totalFloatHours==null?'Not established':sourceWorkingFloat(row))+'</td>'+
      '<td>'+escapeHtml(row.action||'Check the required milestone date and its dependent work.')+'</td></tr>').join('')+
    '</tbody></table></div>'
  :'<p>'+escapeHtml(milestoneExposureNote(d.milestoneExposure))+'</p>';
 const revision=d.revision||{};
 const revisionText=revision.state==='available'
  ?fmt(revision.modified)+' activities changed, '+fmt(revision.added)+' were added and '+fmt(revision.removed)+' removed since the previous revision. The submitted completion moved '+(typeof revision.finishMovementCalendarDays==='number'?(revision.finishMovementCalendarDays>0?'+':'')+fmt(revision.finishMovementCalendarDays)+' elapsed days':'by an amount not established from the files')+'.'
  :revision.basis||'No comparable earlier adopted programme is available.';
 const changeNext=revision.state==='available'?'<p><b>Decision needed from Project Controls:</b> Validate material changes and their authority before accepting the update as a recovery commitment.</p>':'';
 const controls=data?.projectFacts?.controls||{};
 const financial=Array.isArray(data?.projectFacts?.commercial?.currencies)?data.projectFacts.commercial.currencies:[];
 const displayFact=f=>f?.value===null||f?.value===undefined?'Not established':fmt(f.value)+(f.complete===false?' known; full total not confirmed':'');
 const deliveryRows=[
  ['Overdue RFIs',controls.overdueRfiCount,'Dated overdue design responses'],
  ['Major / critical NCRs',controls.openCriticalMajorNcrCount,'Open source records, qualified if incomplete'],
  ['Open risks',controls.openRiskCount,'Register count only when established']
 ];
 // F20: the cost line reads the one shared dated cash series (projectFacts commercial cashSeries).
 const cashAmount=(v,currency)=>v===null||v===undefined?'Not established':fmt(v)+' '+currency;
 const briefCashSeries=c=>{
  const s=c.cashSeries;
  if(!s||!s.periodCount)return '<p><b>'+escapeHtml(c.currency)+' dated cash series:</b> Not established. No dated certificates, receipts or forecast periods are recorded in this currency.</p>';
  const latest=s.latestPeriod;
  const next=s.nextForecastPeriod&&s.nextForecast?' Next forecast period '+escapeHtml(s.nextForecastPeriod)+': '+escapeHtml(s.nextForecast.forecastIncome!==null?cashAmount(s.nextForecast.forecastIncome,c.currency)+' income/work value':'')+escapeHtml(s.nextForecast.forecastExpenditure!==null?(s.nextForecast.forecastIncome!==null?', ':'')+cashAmount(s.nextForecast.forecastExpenditure,c.currency)+' expenditure':'')+'.':'';
  return '<p><b>'+escapeHtml(c.currency)+' dated cash series:</b> '+(latest?'latest period '+escapeHtml(latest.period)+' certified '+escapeHtml(cashAmount(latest.certified,c.currency))+', paid '+escapeHtml(cashAmount(latest.paid,c.currency))+'; ':'')+
   'to the Data Date certified '+escapeHtml(cashAmount(s.certifiedToDate,c.currency))+', paid '+escapeHtml(cashAmount(s.paidToDate,c.currency))+' over '+escapeHtml(fmt(s.periodCount))+' monthly period(s). '+
   'Forecast basis: '+escapeHtml(s.forecastBasisLabel)+'.'+next+(s.forecastBasis==='not_established'&&s.forecastReason?' '+escapeHtml(s.forecastReason):'')+'</p>';
 };
 const deliveryAndCommercial='<section class="diagnosis-section"><h4>Delivery controls and commercial exposure</h4>'+
  planningKpis(deliveryRows.map(row=>[row[0],displayFact(row[1]),row[2]]))+
  (financial.length?financial.slice(0,2).map(c=>'<p><b>'+escapeHtml(c.currency)+' commercial position:</b> Current contract value '+escapeHtml(displayFact(c.currentContractValue))+
    '; approved variation amount '+escapeHtml(displayFact(c.approvedVariationAmount))+
    '; CPI '+escapeHtml(displayFact(c.cpi))+
    '; forecast cost at completion '+escapeHtml(displayFact(c.forecastEac))+
    '; certified unpaid '+escapeHtml(displayFact(c.certifiedUnpaidAmount))+'.</p>'+briefCashSeries(c)).join(''):'<p>No reconciled currency-specific commercial position is available.</p>')+
  '<p>These are independent source measures. Do not add variations to the current contract value or infer cost performance without a consistent stated basis.</p>'+
  '<p>'+managementModuleLink('commercial-overview','Open Commercial Overview')+' '+managementModuleLink('cross-domain-accountability','Open accountable team work')+'</p></section>';
 const sourceDetails='<details class="management-brief-support"><summary>Full completion calculations and evidence qualifications</summary>'+
   renderCompletionPosition(d.completion)+
   '<p>'+escapeHtml(d.summary||'')+'</p>'+
   '<p><b>Calculation basis:</b> '+escapeHtml(d.criticalityBasisLabel||'Available programme information only')+'.</p>'+
   (data?.completionMilestoneConstraints?.length?'<p>'+screenCountText(listTotal(data.completionMilestoneConstraints))+' dated completion milestone constraints are retained in source details.</p>':'<p>No explicit dated constraint was identified on the selected completion milestone. This does not prove that milestones are free of schedule exposure.</p>')+
   '</details>';
 return '<section class="project-diagnosis management-brief">'+
  '<header class="diagnosis-heading"><h3>Management brief</h3><p>Data Date '+escapeHtml(planningShortDate(d.dataDateIso))+' · '+fmt(d.executionActivityCount)+' execution '+countNoun(d.executionActivityCount,'activity','activities')+'</p></header>'+
  summary+keyFigures+contractPosition+
  '<section class="diagnosis-section"><h4>Schedule pressure and affected workfronts</h4><p>'+escapeHtml(networkMessage)+'</p>'+driversHtml+'</section>'+
  '<section class="diagnosis-section"><h4>Milestones requiring protection</h4>'+milestoneHtml+'</section>'+
  '<section class="diagnosis-section"><h4>What changed since the previous programme</h4><p>'+escapeHtml(revisionText)+'</p>'+changeNext+'</section>'+deliveryAndCommercial+
  '<section class="diagnosis-section"><h4>Management decisions and delegated actions</h4>'+renderProjectPrioritySummary(d.actionRegister)+'</section>'+
  sourceDetails+'</section>';
}
function renderProjectDiagnosis(d){
 if(!d)return '';
 const c=d.counts,countText=x=>x.value??(x.knownCount===null?'Not available':fmt(x.knownCount)+' known');
 const basis=d.criticalityBasisLabel||(d.criticalityBasis==='independent_cpm'?'Independent CPM, reconciled':'Submitted programme float, not reconciled');
 const metrics=planningKpis([['Negative float',countText(c.negativeFloat),basis],['Critical',countText(c.critical),basis],['Near-critical',countText(c.nearCritical),basis],['Missed starts',countText(c.missedStarts),'against Data Date'],['Overdue finishes',countText(c.overdueFinishes),'unfinished work'],['Slipped since previous',countText(c.previousUpdateSlippage),'adopted revision comparison']]);
 const net=d.network,network=net.state==='unavailable'?'<p>The independent finish-driving network is not calculable from the current programme fields. Known critical and negative-float activities remain available below.</p>':
 '<p>'+escapeHtml(net.state==='scenario'?'Calculated with the completion assumptions shown above.':'Calculated from the programme calendars and logic.')+' '+screenCountText(d.tableTotals?.network??listTotal(net.rows))+' activities · '+screenCountText(d.tableTotals?.relationships??listTotal(net.relationships))+' driving links. Parallel branches are retained; use the predecessor and successor columns to follow the actual sequence.</p>'+diagnosisTable(d,'network',net.rows,[['sequence','Order'],['activityId','Activity ID'],['name','Activity'],['wbs','WBS'],['calculatedStartIso','Calculated start'],['calculatedFinishIso','Calculated finish'],['remainingDurationHours','Remaining hours'],['totalFloatHours','Source float'],['previousFinishMovementCalendarDays','Movement · elapsed days'],['drivingPredecessors','Driving predecessors / link / lag'],['drivingSuccessors','Driving successors / link / lag']]);
 let previousAction=null;
 const actions=d.actions.map(r=>{const sameAction=r.action===previousAction;previousAction=r.action;const grouped=Number(r.groupedCount||1)>1,title=grouped?(r.rank+'. '+fmt(r.groupedCount)+' related activities'):(r.rank+'. '+r.activityId+' · '+r.name),detail=grouped?'<details><summary>View activity IDs</summary><p>'+escapeHtml((r.activityIds||[]).slice(0,40).join('; '))+((listTotal(r.activityIds)??0)>40?' · '+fmt(listTotal(r.activityIds)-40)+' more':'')+'</p></details>':'';return '<article class="diagnosis-action"><h5>'+escapeHtml(title)+'</h5><p>'+escapeHtml(grouped?(fmt(r.wbsGroupCount||1)+' WBS group'+((r.wbsGroupCount||1)===1?'':'s')):r.wbs)+'</p><p><b>'+escapeHtml(r.reason)+'</b></p>'+(r.previousPredecessorSlippage&&!grouped?'<p>'+escapeHtml(r.previousPredecessorSlippage)+'</p>':'')+(r.linkedEvidence?'<p>'+escapeHtml(r.linkedEvidence)+'</p>':'')+'<p>'+escapeHtml(sameAction?'Next step: as above.':r.action)+'</p>'+detail+'</article>';}).join('');
 const revision=d.revision;
 return '<section class="project-diagnosis"><header class="diagnosis-heading"><h3>Programme analysed</h3><p>'+fmt(d.executionActivityCount)+' execution '+countNoun(d.executionActivityCount,'activity','activities')+' · '+fmt(d.relationshipCount)+' '+countNoun(d.relationshipCount,'relationship')+' · '+fmt(d.calendarCount)+' '+countNoun(d.calendarCount,'calendar')+' · Data Date '+planningShortDate(d.dataDateIso)+'</p></header>'+renderCompletionPosition(d.completion)+
 '<p class="diagnosis-summary">'+escapeHtml(d.summary)+'</p>'+metrics+
 '<section class="diagnosis-section"><h4>Driving path to completion</h4>'+network+'<details><summary>Path calculation basis</summary><p>'+escapeHtml(net.basis)+'</p></details></section>'+
 '<section class="diagnosis-section"><h4>Where schedule pressure is concentrated</h4><p>WBS groups are ranked by unfinished driving activities, then pressure count. These counts do not allocate delay days or responsibility.</p>'+diagnosisTable(d,'wbs',d.wbsRows,[['wbs','WBS'],['pressureCount','Pressure activities'],['drivingCount','Unfinished driving'],['criticalCount','Critical'],['negativeFloatCount','Negative float'],['missedStartCount','Missed starts'],['overdueFinishCount','Overdue finishes'],['worstFloatHours','Lowest float']],5)+'</section>'+
 '<section class="diagnosis-section"><h4>Immediate management actions</h4><p class="diagnosis-note">'+escapeHtml(d.rankingBasis)+'</p><div class="diagnosis-actions">'+(actions||'<p>No confirmed activity action can be ranked from the available fields.</p>')+'</div></section>'+
 '<section class="diagnosis-section"><h4>What the linked records show</h4><p>'+fmt(d.evidenceCoverage.activitiesWithLinkedPressure)+' pressure activities have a linked blocker or late supporting record. A missing link is unknown; it is not proof of readiness.</p>'+diagnosisTable(d,'evidence',d.evidenceChecks,[['activityId','Activity'],['domain','Area'],['recordId','Source record'],['explanation','Finding']],5)+'<details><summary>Cross-check coverage</summary><p>'+escapeHtml(d.evidenceCoverage.basis)+'</p></details></section>'+
 '<section class="diagnosis-section"><h4>Milestones exposed</h4><p>'+escapeHtml(milestoneExposureNote(d.milestoneExposure))+'</p>'+diagnosisTable(d,'milestones',d.milestoneRows,[['activityId','Milestone ID'],['name','Milestone'],['currentFinishIso','Current date'],['totalFloatHours','Float'],['reason','Exposure'],['action','Action']],5)+'</section>'+
 '<section class="diagnosis-section"><h4>What changed since the previous programme</h4><p>'+escapeHtml(revision.state==='available'?(revision.modified+' changed, '+revision.added+' added and '+revision.removed+' removed activities. Completion movement: '+diagnosisCell(revision.finishMovementCalendarDays)+' elapsed days.'):revision.basis)+'</p>'+(revision.state==='available'?diagnosisTable(d,'changes',revision.largestChanges,[['activityId','Activity ID'],['name','Activity'],['finishMovementCalendarDays','Finish movement · elapsed days'],['floatMovementHours','Float movement · original h (days need both revisions\' calendars)'],['progressMovementPercent','Progress movement · points']],5):'')+'</section>'+
 '<section class="diagnosis-section"><h4>If nothing changes</h4><p>'+escapeHtml(d.noChangeOutlook)+'</p></section>'+
 '<div class="diagnosis-toolbar"><button class="btn" onclick="diagnosisAsk(\'List all delayed activities\')">All delayed activities</button><button class="btn" onclick="diagnosisAsk(\'Show all negative-float activities\')">All negative float</button><button class="btn" onclick="diagnosisAsk(\'Which activities should have started already?\')">Missed starts</button></div>'+
 '<details><summary>Programme checks and limits</summary>'+basisTable(['Check','Known count'],Object.entries(d.anomalies).filter(([k,v])=>typeof v==='number').map(([k,v])=>[humanizeKey(k),fmt(v)]))+'<p>'+escapeHtml(d.limitation)+'</p></details></section>';
}
`;
