export const basisReviewScript=String.raw`
function basisTable(heads,rows){return '<div class="table-wrap"><table><thead><tr>'+heads.map(h=>'<th>'+escapeHtml(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+escapeHtml(v??'Not in the data')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function basisPanel(title,note,body,id){return '<section class="planning-panel"'+(id?' id="'+escapeHtml(id)+'"':'')+'><div class="planning-panel-head"><div><h4>'+escapeHtml(title)+'</h4><p>'+escapeHtml(note)+'</p></div></div><div class="planning-panel-body">'+body+'</div></section>';}
function commercialSourceState(metric){
  if(metric?.consequence)return metric.consequence;
  const diagnostics=metric?.diagnostics||[];
  if(diagnostics.includes('EXPLICIT_SOURCE_SNAPSHOT_NOT_RECALCULATED_FROM_VARIATIONS'))return diagnostics.some(d=>/CONFLICT|UNRESOLVED/.test(d))?'Reported amount · confirm against the register':'Reported amount';
  return humanizeKey(metric?.state||'missing');
}
function renderCommercialExceptions(position,key,data){
  let html='';const money=(n,c)=>n==null?'Not in the data':fmt(n)+' '+(c||'currency unknown');
  const groups=position.variationBasisReview?.groups||[];
  if(['commercial-overview','variations-change'].includes(key))for(const g of groups){
    const a=g.aggregates||[],exceptions=g.exceptions||[];
    const summary='<p>Approved source rows through Data Date: <b>'+escapeHtml(money(g.current.amount,g.currency))+'</b> from '+fmt(g.current.count)+' records. '+fmt(g.future.count)+' future approvals total '+escapeHtml(money(g.future.amount,g.currency))+'. Full register: '+escapeHtml(money(g.fullAmount,g.currency))+'. '+fmt(g.undatedCount)+' undated approvals; '+fmt(g.unknownAmountCount)+' amounts missing.</p>'+
      a.map(r=>'<p>Reported change total at '+escapeHtml(planningShortDate(r.asOf))+': '+escapeHtml(money(r.amount,g.currency))+'. Difference from approvals dated by that date: <b>'+escapeHtml(money(r.difference,g.currency))+'</b>.</p>').join('');
    const detail=(g.amendments||[]).map(r=>'<p>Amendment '+escapeHtml(r.sourceFilename||r.documentId)+' effective '+escapeHtml(planningShortDate(r.effectiveDate))+' states '+escapeHtml(money(r.amount,g.currency))+'. At that date, '+fmt(r.atEffectiveDate.count)+' approvals total '+escapeHtml(money(r.atEffectiveDate.amount,g.currency))+'. A further '+fmt(r.afterEffectiveThroughDataDate.count)+' approvals total '+escapeHtml(money(r.afterEffectiveThroughDataDate.amount,g.currency))+' through Data Date.</p>').join('')+
      basisTable(['Amount exception','Approval date','Source amount','Other approved rows total','Other amounts range','Reporting scope'],exceptions.map(r=>[r.id,planningShortDate(r.approvalDate),money(r.amount,g.currency),money(r.otherRecordsAmount,g.currency),money(r.otherMin,g.currency)+' to '+money(r.otherMax,g.currency),humanizeKey(r.scope)]))+
      '<p>'+escapeHtml(g.interpretation)+'</p><p><b>Next step:</b> provide the amendment-to-variation reconciliation and supporting approval for the listed amount exceptions.</p>';
    html+=basisPanel('Compare variation approvals and reported totals · '+(g.currency||'?'),humanizeKey(g.taxBasis)+' tax basis',summary+(key==='variations-change'?detail:managementModuleLink('variations-change','Review amendment dates and amount exceptions')),'variationBasisReview');
  }
  if(['commercial-overview','cost-forecast'].includes(key))for(const r of position.costBasisReview||[]){
    if(position.sourceLedger?.dataDateIso&&r.asOf>position.sourceLedger.dataDateIso)continue;
    const m=data.sourceInterpretation?.progressMeasures,s=m?.scopeComparison;
    html+=basisPanel('Cost ratios are available; confirm the amounts behind them',r.currency+' · '+planningShortDate(r.asOf)+' · '+r.taxBasis,
      basisTable(['Measure','Value','Comparison basis'],[
        ['PV / BAC',fmt(r.plannedPercentOfBudget)+'%',money(r.pv,r.currency)+' / '+money(r.bac,r.currency)],
        ['EV / BAC',fmt(r.earnedPercentOfBudget)+'%',money(r.ev,r.currency)+' / '+money(r.bac,r.currency)],
        ...(m?[['Baseline schedule plan',fmt(m.baselinePlannedPercent)+'%','Baseline activities, weighted by duration'],['Current schedule snapshot',fmt(m.scheduleSnapshotPercent)+'%','Current activities, weighted by duration'],['Matched schedule snapshot',fmt(s?.snapshotCurrentWeightsPercent)+'%','Matched tasks using current weights; indicative ratio '+fmt(s?.currentWeightRatio)]]:[]),
        ['Actual cost / source certificate-period net',r.actualCostToCertificateRatio==null?'Comparison not assessable':fmt(r.actualCostToCertificateRatio)+' times',money(r.ac,r.currency)+' / '+money(r.certificatePeriodNet,r.currency)+(r.certificateDateMatches?' · same reporting cutoff':' · reporting dates differ')],
        ['SPI / CPI',fmt(r.spi)+' / '+fmt(r.cpi),'Arithmetic within cost source; cross-source amounts unreconciled']])+ '<p>'+escapeHtml(r.interpretation)+'</p>'+managementModuleLink('progress-report','Compare the activities included')+managementModuleLink('payments','Review certificate components'));
  }
  if(key==='commercial-overview')for(const g of position.certificateProfile?.groups||[]){
    const t=g.totals||{};
    html+=basisPanel('Certificate-period net through Data Date: '+money(t.netCertifiedAmount,g.currency),g.totalLabel,
      '<p>Gross work '+escapeHtml(money(t.grossWork,g.currency))+' + variations '+escapeHtml(money(t.variations,g.currency))+' − retention '+escapeHtml(money(t.retentionDeduction,g.currency))+' − advance recovery '+escapeHtml(money(t.advanceRecovery,g.currency))+'.</p><p>Certification dates unconfirmed for '+fmt(g.certificationUnconfirmedIds?.length)+' of '+fmt(g.as_of?.length)+' current-period records. These source sums do not establish cash or a dated certification balance.</p>'+managementModuleLink('payments','Review certificate exceptions and future plan'));
  }
  if(['contract-particulars-bonds','commercial-claims-notices'].includes(key)){
    const rules=position.contractNoticeRules||[];
    if(rules.length)html+=basisPanel('Contract notice periods by version','The original and amended rules are separate. Notice dates alone cannot establish the applicable trigger date.',
      basisTable(['Requirement','Days','Effective from','Replaced from','Trigger','Source'],rules.map(r=>[r.noticeKind==='detailed_claim'?'Fully detailed claim':'Initial claim notice',r.noticePeriodDays,r.effectiveFromIso?planningShortDate(r.effectiveFromIso):'Original / date not stated',r.effectiveToIso?planningShortDate(r.effectiveToIso):'No later version supplied',humanizeKey(r.triggerBasis||'not_stated'),(r.sourceFilename||'Contract source')+' · '+(r.evidenceRefs||[]).map(e=>e.locator).slice(0,2).join('; ')]))+
      '<p>Obtain event/awareness dates and confirm amendment applicability before a compliance decision. A detailed-claim deadline has its own trigger; it is not substituted for an initial notice.</p>');
  }
  return html;
}
function renderBasisReviews(data,key){
  let html=''; const s=data.scheduleBasisReview,q=data.quantityBasisReview,d=data.durationEditReview,v=data.contractValueBasisReview;
  if(s){
    html+=basisPanel(s.contractFinishIso?fmt(s.deadline.lateCount)+' of '+fmt(s.packageCount)+' package finishes fall after the contract date':'Package deadlines need a confirmed contract date',s.interpretation,
      (s.contractFinishIso?'<p>Contract finish '+escapeHtml(planningShortDate(s.contractFinishIso))+'. '+fmt(s.deadline.positiveFloatButLateCount)+' late package finishes still have positive submitted float. Dated lateness ranges from '+fmt(s.deadline.latenessDays.min)+' to '+fmt(s.deadline.latenessDays.max)+' calendar days. Submitted criticality is not a contract-compliance test.</p>':'<p>No confirmed contract date is available for this comparison. Submitted float does not establish contractual timeliness.</p>')+
      '<p>'+escapeHtml(s.packageDefinition)+' '+fmt(s.excludedLeafCount)+' leaf WBS excluded.</p>'+
      (key==='independent-forecast'?'':'<details><summary>Calendars and date restrictions</summary>')+
      basisTable(['Assigned calendar','Work days / week','Packages','Calendar movement range (days)','Earliest recalculated finish','Latest recalculated finish'],s.groups.map(g=>[g.calendarName,g.workingDaysPerWeek,g.packageCount,fmt(g.movementDays.min)+' to '+fmt(g.movementDays.max),planningShortDate(g.earliestCalendarFinishIso),planningShortDate(g.latestCalendarFinishIso)]))+
      (s.sensitivity?'<div class="notice info"><b>Calendar sensitivity only: '+escapeHtml(planningShortDate(s.sensitivity.completionIso))+'</b><p>Replacing the assigned five-day calendars with '+escapeHtml(s.sensitivity.toCalendarName||s.sensitivity.toCalendarId)+' changes the calculated finish by '+fmt(s.sensitivity.movementDays)+' calendar days. '+escapeHtml(s.sensitivity.assumptions.join(' '))+'</p></div>':'')+
      '<details><summary>Review package finishes from every calendar group</summary>'+basisTable(['Package','Calendar','Finish milestone','Submitted finish','Calendar-calculated finish','After contract (days)','Submitted float (hours)'],s.rows.map(r=>[r.name,r.calendarName||'Mixed / unresolved',r.activityId,planningShortDate(r.submittedFinishIso),planningShortDate(r.calendarFinishIso),fmt(r.contractLatenessDays),fmt(r.submittedFloatHours)]))+'</details>'+
      '<details><summary>'+fmt(s.constraints.length)+' source date constraints</summary><p>The unconstrained calendar calculation does not apply these source constraints. A mandatory finish can explain the submitted float reference date; it does not amend the contract.</p>'+basisTable(['Constraint','Records','WBS nodes'],s.constraintGroups.map(r=>[({CS_MSO:'Must start on',CS_MFO:'Must finish on',CS_MEO:'Mandatory finish'})[r.type]||r.type,r.count,r.wbsCount]))+basisTable(['Activity','Constraint','Date'],s.constraints.map(r=>[r.activityId,({CS_MSO:'Must start on',CS_MFO:'Must finish on',CS_MEO:'Mandatory finish'})[r.type]||r.type,planningShortDate(r.dateIso)]))+'</details>'+(key==='independent-forecast'?'':'</details>'),'calendarBasisReview');
  }
  if(d){html+=basisPanel('Where original-duration changes occur',d.interpretation,
    '<p>Compared programme data dates: '+escapeHtml(planningShortDate(d.fromDataDateIso))+' to '+escapeHtml(planningShortDate(d.toDataDateIso))+'. This duration review retains its own comparison period.</p>'+
    '<p>'+fmt(d.comparableCount)+' comparable duration records / '+fmt(d.matchedCount)+' matched tasks; '+fmt(d.addedCount)+' added tasks; '+fmt(d.ambiguousCount)+' ambiguous identities excluded.</p>'+
    basisTable(['Edit on an existing task','Tasks'],d.distribution.map(r=>[(r.deltaHours>0?'+':'')+fmt(r.deltaHours)+' hours',fmt(r.count)]))+
    '<details><summary>Inspect the duration arithmetic for each WBS package</summary>'+basisTable(['Package','Baseline days','Current days','Existing-task edit days','Added-task days','Edited tasks','Added tasks','Hours / day'],d.packages.map(r=>[r.name,fmt(r.baselineDurationDays),fmt(r.currentDurationDays),fmt(r.existingChangeDays),fmt(r.addedDays),r.changedExistingCount,r.addedCount,fmt(r.standardDayHours)]))+'</details>');}
  if(q){
    const f=q.forecast;
    html+=basisPanel('Link quantities and productivity work packages to programme activities',q.interpretation,
      (key==='quantity-scurve'?basisTable(['BOQ unit','Items','Known quantities','Quantity in this unit'],q.unitTotals.map(r=>[r.unit,r.itemCount,r.knownQuantityCount,fmt(r.quantity)])):'')+
      '<p>'+fmt(q.uniqueSectionSuggestionCount)+' of '+fmt(q.sections.length)+' BOQ sections have one WBS-parent name match. These suggestions do not allocate any item.</p>'+
      '<details><summary>Review section-to-WBS suggestions</summary>'+basisTable(['BOQ section','Items','WBS suggestions'],q.sections.map(r=>[r.section,r.itemCount,r.suggestions.map(w=>w.wbsId+' · '+w.name).join('; ')||'No name match']))+'</details>'+
      '<p>Productivity source finish: '+escapeHtml(planningShortDate(f.completionIso))+'. '+fmt(f.explicitActivityLinkCount)+' of '+fmt(f.workPackageCount)+' rows explicitly link to a schedule activity. Same-number review: '+fmt(f.sameNumberDisciplineMatches)+' of '+fmt(f.sameNumberReviewedCount)+' have a matching discipline name. Number resemblance is not a link.</p>'+
      basisTable(['Productivity source unit','Rows','Remaining quantity in that unit'],f.units.map(r=>[r.unit,r.rowCount,fmt(r.remainingQuantity)]))+
      basisTable(['Latest-finish input','Discipline','Start','Remaining quantity','Unit','Multiple of same-unit median'],f.drivers.map(r=>[r.workPackageId,r.discipline,planningShortDate(r.startIso),fmt(r.remainingQuantity),r.unit,percent2(r.remainingToUnitMedian)]))+
      '<details><summary>Inspect same-number package differences</summary>'+basisTable(['Source package','Source discipline','Schedule package with same number','Name match'],f.numberReview.map(r=>[r.workPackageId,r.sourceDiscipline,r.schedulePackages.map(w=>w.name).join('; ')||'No unique match',r.disciplineMatches?'Yes — review still required':'No']))+'</details>','quantityBasisReview');
  }
  if(v){html+=basisPanel('Contract amounts by version',v.interpretation,
    (v.current?'<p><b>Current contract amount: '+escapeHtml(fmt(v.current.amount)+' '+v.current.currency)+'</b> · '+escapeHtml(v.current.taxBasis)+' tax basis · from '+escapeHtml(v.current.sourceFilename)+'.</p>':'<p>No single current contract value can be selected: '+escapeHtml(humanizeKey(v.state))+'.</p>')+
    basisTable(['Source','Contract amount','Currency / tax','Effective date','Reporting scope'],v.rows.map(r=>[r.sourceFilename+' · '+r.label,fmt(r.amount),r.currency+' / '+r.taxBasis,planningShortDate(r.effectiveFromIso),humanizeKey(r.scope)])));}
  const b=data.basisComparison;
  if(b&&['cost-forecast','challenge-contract','progress-report'].includes(key)){
    const cost=b.costReports||[];
    html+=basisPanel('Schedule-loaded cost and cost-report totals use different bases','Request a cost and scope reconciliation before using these figures interchangeably.',
      basisTable(['Source measure','Amount / ratio','Currency basis'],[
        ['XER loaded cost',fmt(b.xer.loadedCost),b.xer.currency],['XER actual regular cost',fmt(b.xer.actualRegularCost),b.xer.currency],
        ['Actual regular cost / loaded cost',percent2(b.xer.actualRegularCostPercent)+'%','Within XER assignment population'],
        ...cost.flatMap(r=>['bac','ac','ev','pv'].filter(k=>r.values[k]!=null).map(k=>[({bac:'Cost-report budget',ac:'Cost-report actual cost',ev:'Cost-report earned value',pv:'Cost-report planned value'})[k]+' · '+planningShortDate(r.asOfIso),fmt(r.values[k]),r.currency+' / '+r.taxBasis]))
      ])+'<p>Unreported overtime cost is '+(b.xer.actualOvertimeCost==null?'unknown':fmt(b.xer.actualOvertimeCost))+'. XER loaded cost is not automatically the contract budget.</p>');
  }
  if(b&&key==='challenge-contract'){
    html+=renderResourceBasisReview(b)+basisPanel('Headcount implied by the weekly approved hours','Working hours per person are assumptions, not a supplied headcount plan.',
      '<p>Average approved usage through DD: '+fmt(b.weekly.averageApprovedHoursPerWeek)+' hours per week.</p>'+
      basisTable(['Assumed hours / person / week','Implied average people'],[40,60].map(h=>[h,b.weekly.averageApprovedHoursPerWeek==null?'Not available':fmt(b.weekly.averageApprovedHoursPerWeek/h)]))+
      '<p>Remaining XER labor budget: '+fmt(b.xer.remainingLaborHours)+' h. Future weekly planned hours: '+fmt(b.weekly.futurePlannedHours)+' h. Neither establishes measured remaining productive work.</p>');
  }
  if(['master-dashboard','command-center','pmo-analysis'].includes(key)){
    const h=data.sourceInterpretation?.hse;
    if(h?.periodEndIso){const m=h.metrics||{};html+=basisPanel('HSE figures reported through '+planningShortDate(h.periodEndIso),'Reported totals are separate from dated open incident cases.',planningKpis([['Lost-time injuries',m.lostTimeInjuries,'reported'],['Medical treatment cases',m.medicalTreatmentCases,'reported'],['First-aid cases',m.firstAidCases,'reported'],['Near misses',m.nearMisses,'reported']])+'<p>Exposure '+fmt(m.manHours)+' hours; reported LTIFR '+percent2(m.ltifr)+'; TRIR '+percent2(m.trir)+'. Confirm the rate method and reconcile the exposure hours with resource sources.</p>');}
    const a=data.sourceInterpretation?.availability;
    if(a?.length)html+=basisPanel('What information is missing, unread or inconsistent','Each gap has its own next step.',basisTable(['Topic','Specific gap','Evidence','Action'],a.map(r=>[r.topic,humanizeKey(r.state),r.detail,r.action])));
  }
  const overlap=data.determinationOverlapScenario;
  if(overlap)html+=basisPanel('Submitted finish: '+fmt(overlap.noneIncludedLatenessDays)+' to '+fmt(overlap.allIncludedLatenessDays)+' days after the adjusted date, conditionally',overlap.basis,'<p>'+fmt(overlap.determinedDays)+' days appear in determinations by DD. No additional days have been applied automatically.</p>');
  const actions=data.operationalReporting?.actions||data.sourceInterpretation?.actions||[];
  if(actions.length&&['command-center','pmo-analysis'].includes(key)){
    html+=basisPanel('Specific records requiring action','Owners and due dates are shown only when supplied. Full source records remain available.',
      '<p>'+fmt(actions.filter(r=>r.type==='NCR').length)+' open major / critical NCRs; '+fmt(actions.filter(r=>r.type==='RFI').length)+' overdue RFIs through DD.</p>'+
      basisTable(['Record','Priority','Age at reporting date','Overdue','Owner','Due','Next action'],actions.slice(0,10).map(r=>[r.recordId,r.priority,r.ageDays==null?'Raised date needed':r.ageDays+' d',r.overdueDays==null?'Due date needed':r.overdueDays+' d',r.owner||'Assign owner',r.dueIso?planningShortDate(r.dueIso):'Set due date',r.action]))+
      '<details><summary>All '+fmt(actions.length)+' action records</summary>'+basisTable(['Record','Subject','Priority','Age at reporting date','Overdue','Owner','Raised','Due','Next action'],actions.map(r=>[r.recordId,r.subject,r.priority,r.ageDays==null?'Raised date needed':r.ageDays+' d',r.overdueDays==null?'Due date needed':r.overdueDays+' d',r.owner||'Assign owner',planningShortDate(r.raisedIso),planningShortDate(r.dueIso),r.action]))+'</details>');
  }
  return html;
}
`;
