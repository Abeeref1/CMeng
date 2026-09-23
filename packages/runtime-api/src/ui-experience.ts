/** Shared presentation only. Values remain owned by the module resolvers. */
export const experienceStyles = String.raw`
:root{--bg:#f3f5f8;--ivory:#fff;--ink:#1b2c43;--muted:#526479;--line:#dce3ec;--accent:#316ba6;--accent-strong:#245783;--shadow:0 3px 12px rgba(22,42,67,.035)}
.badge.ready{background:#eaf2fb!important;color:#245e93!important}.badge.blocked{background:#edf1f6!important;color:#586c82!important}#moduleBadge:empty{display:none}#moduleContent{text-align:left}.badge{text-transform:none!important;letter-spacing:0!important}.management-metric-head>span{font-size:13px!important;text-transform:none!important;letter-spacing:0!important;color:#526479!important;max-width:100%}.management-metric-head{align-items:flex-start;gap:8px}.experience-brief p,.experience-fact,.experience-review{text-align:left}
body{font-size:15px;line-height:1.55;background:var(--bg)}
h1,h2,h3,h4,h5,.kpi-value,.position-value{font-family:Inter,"Segoe UI",system-ui,sans-serif;letter-spacing:-.02em}
.app{grid-template-columns:260px minmax(0,1fr)}
.sidebar{padding:20px 12px;background:#fff;box-shadow:none}.brand{background:#fff}.brand-copy p{font-size:10px}.nav-group{margin:14px 0}.nav-group-title{font-size:11px;color:#63738a;letter-spacing:.05em;margin-top:8px}.nav-item{font-size:13px;min-height:39px;padding:8px 11px;gap:8px;line-height:1.3}.nav-label{white-space:normal;overflow:visible;text-overflow:clip;flex:1}.nav-item.active{background:#eaf1fa;color:#1d568b;box-shadow:inset 3px 0 0 #316ba6}.nav-item:hover{background:#f0f4f9}.nav-count{min-width:20px;height:20px;padding:0 5px;border-radius:6px;background:#edf1f6;color:#596b80;font-size:10px;display:grid;place-items:center}.nav-count.attention{background:#fff0d7;color:#825400}.nav-count.error{background:#fde5e5;color:#a12626}.nav-state-legend{display:none}.sidebar-motto{font-size:12px}.active-project-card{box-shadow:none;background:#f7f9fc}.active-project-card b{font-size:13px}.active-project-card span{color:#596b80;font-size:12px}
.topbar{background:#fff;box-shadow:none;border-color:var(--line);min-height:52px;padding:8px 28px}.content{padding:22px 30px 48px;max-width:1700px;margin:0 auto}.workspace-header{align-items:center;margin-bottom:22px;gap:16px}.workspace-header .page-title .eyebrow{font-size:11px;margin-bottom:3px}.workspace-header .page-title h2{font-size:19px;margin:0}.workspace-header .page-title p{font-size:12px;max-width:600px;color:#526479}.workspace-actions{gap:7px}.workspace-actions .btn{font-size:12px;padding:8px 11px}.btn{border-radius:7px;box-shadow:none;font-weight:650}.btn.primary{background:#316ba6;border-color:#316ba6}.btn:focus-visible,button:focus-visible,summary:focus-visible,a:focus-visible{outline:3px solid #619ad4;outline-offset:3px}
.module-workspace{border:1px solid #dce3ec!important;border-radius:13px!important;box-shadow:var(--shadow)!important;background:#fff}.module-panel:before{display:none}.module-workspace>.module-head{padding:25px 28px 20px!important;background:#fff!important;align-items:flex-start}.module-head h3{font-size:27px!important;line-height:1.2;color:#172e49!important}.module-head p{font-size:14px!important;line-height:1.5;color:#526479!important;margin:8px 0 0;max-width:800px}.module-head .section-kicker{display:none}.module-head-actions{flex-wrap:wrap;justify-content:flex-end;max-width:300px}.module-head-actions .btn{font-size:12px}.module-panel #moduleContent{padding:22px 28px 30px!important}.role-view-selector{background:#fff;border-block:1px solid #e4e9f0;padding:0 28px;gap:18px}.role-view-selector-label{font-size:11px;color:#62758c}.role-view-button{padding:13px 0;font-size:12px;border:0;border-bottom:3px solid transparent;border-radius:0;background:transparent;color:#526479;box-shadow:none!important}.role-view-button.active{background:transparent;color:#245e95;border-color:#316ba6;font-weight:800}.role-view-button:hover{background:transparent;color:#245e95}.module-basis{margin:0 0 18px;gap:15px}.basis-chip{border:0;background:none;padding:0;min-height:22px;gap:6px}.basis-chip b{font-size:11px;color:#68798d;text-transform:none;letter-spacing:0}.basis-chip strong{font-size:12px;color:#34495f;font-weight:600;overflow-wrap:anywhere}
.experience-notes{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#f7f9fc;border:1px solid #e0e6ef;border-radius:8px;margin:0 0 18px;padding:10px 13px;font-size:13px;color:#465c75}.experience-notes.error{background:#fff2f1;border-color:#e6b0ac;color:#96312e}.experience-notes a{color:inherit;font-weight:700;text-underline-offset:3px}.experience-notes small{font-size:12px;color:inherit}.experience-notes .review-spacer{flex:1}.experience-notes .review-tag{border-right:1px solid #cfd8e4;padding-right:11px}.experience-notes .review-tag:last-of-type{border:0;padding:0}
.experience-brief{margin:0 0 22px}.experience-brief-heading{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:12px}.experience-brief-heading h4{font-size:18px;margin:0}.experience-brief-heading span{font-size:12px;color:#607188}.experience-brief p{font-size:14px;color:#526479;margin:8px 0 16px;max-width:960px}.experience-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid #dce4ee;border-radius:10px;overflow:hidden;margin:0 0 17px;background:#fff}.experience-fact{padding:18px 19px;min-width:0;border-right:1px solid #e3e9f1}.experience-fact:last-child{border-right:0}.experience-fact>span{font-size:12px;color:#526479;display:block;font-weight:650}.experience-fact>strong{display:block;font-size:27px;line-height:1.2;margin:9px 0;color:#172e49;font-weight:700;overflow-wrap:anywhere}.experience-fact>strong.unavailable{font-size:19px;color:#63748a}.experience-fact>small{display:block;font-size:12px;line-height:1.45;color:#5c6e84}.experience-review{border-left:3px solid #92aecb;background:#f6f9fc;padding:13px 17px;margin:14px 0;font-size:14px}.experience-review b{display:block;margin-bottom:4px;color:#2e4d6b}.experience-review p{margin:0;max-width:100%;font-size:14px}.experience-preview{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px;margin:18px 0}.experience-preview>.visual-chart{margin:0}.experience-preview:has(.milestone-date-chart),.experience-preview:has(.lookahead-timeline),.experience-preview:has(.date-ladder),.experience-preview:has(.pressure-matrix),.experience-preview:has(.float-histogram){grid-template-columns:1fr}
.experience-disclosure,.role-supporting-detail,.reconciliation-panel{border:1px solid #dce4ee!important;border-radius:9px!important;background:#fff!important;margin:16px 0!important;overflow:hidden;box-shadow:none!important}.experience-disclosure>summary,.role-supporting-detail>summary,.reconciliation-panel>summary{display:flex;align-items:center;gap:12px;padding:15px 18px!important;cursor:pointer;font-size:14px!important;font-weight:650;background:#f9fbfd!important;color:#294766;list-style:none}.experience-disclosure>summary:before,.role-supporting-detail>summary:before,.reconciliation-panel>summary:before{content:'+';font-size:18px;font-weight:400}.experience-disclosure[open]>summary:before,.role-supporting-detail[open]>summary:before,.reconciliation-panel[open]>summary:before{content:'−'}.experience-disclosure>summary span{font-size:12px;color:#61738a;font-weight:400;margin-left:auto}.experience-disclosure-body{padding:20px}.experience-disclosure>summary::-webkit-details-marker{display:none}.experience-audit .issue-assessment{margin:0;padding:0;border:0;background:#fff}.experience-audit h4{font-size:16px}.experience-audit p,.experience-audit small{font-size:13px;color:#526479}.experience-audit .issue-counts{display:flex;flex-wrap:wrap;gap:7px;margin:15px 0}.experience-audit .issue-counts span{border:1px solid #dce3ec;border-radius:5px;padding:4px 8px;font-size:12px}.experience-audit .table-wrap{max-height:520px}.experience-scope-note{font-size:12px;color:#596d84;margin:16px 0}.issue-badge{font-size:11px;padding:5px 8px;font-weight:650;text-transform:none;letter-spacing:0}.issue-badge.checked{background:#f0f3f7;color:#526479}
.planning-panel,.management-panel{border:1px solid #dde5ee!important;border-radius:10px!important;box-shadow:none!important;background:#fff!important;margin:0 0 22px!important}.planning-panel.primary{border-color:#cddbea!important}.planning-panel-head,.management-panel-head{padding:19px 21px!important;background:#fff!important;border-bottom:1px solid #e6ecf3!important}.planning-panel-head h4,.management-panel-head h4{font-size:18px!important;color:#203c59!important;text-align:left!important}.planning-panel-head p,.management-panel-head p{font-size:13px!important;line-height:1.55;color:#53677f!important;text-align:left!important;max-width:960px}.planning-panel-body,.management-panel-body{padding:20px!important}.planning-kpi-grid{gap:0!important;border:1px solid #e1e7ee;border-radius:9px;overflow:hidden;margin-bottom:20px!important;grid-template-columns:repeat(auto-fit,minmax(165px,1fr))!important}.planning-kpi{border:0!important;border-right:1px solid #e5eaf1!important;border-bottom:1px solid #e5eaf1!important;border-radius:0!important;background:#fff!important;box-shadow:none!important;padding:17px!important;text-align:left!important;min-height:103px}.planning-kpi span,.planning-kpi-label{font-size:12px!important;text-transform:none!important;letter-spacing:0!important;color:#53677f!important;white-space:normal!important}.planning-kpi strong,.planning-kpi b{font-size:25px!important;line-height:1.25!important;color:#203c59!important;white-space:normal!important;overflow-wrap:anywhere}.planning-kpi small{font-size:12px!important;line-height:1.45;color:#5b6d83!important}.planning-kpi.danger{border-top:3px solid #be5750!important}.planning-kpi.warning{border-top:3px solid #c18b2e!important}
.visual-chart{border:1px solid #dce4ee!important;border-radius:10px!important;box-shadow:none!important;background:#fff!important}.visual-chart-head{padding:17px 20px!important;background:#fff!important;align-items:flex-start}.visual-chart-head h5{font-size:16px!important;color:#254464!important;text-align:left!important}.visual-chart-head p{font-size:13px!important;line-height:1.5!important;color:#556b84!important;text-align:left!important}.visual-chart-body{padding:20px!important}.visual-focus-button{font-size:11px;padding:5px 8px}.visual-bar-row{grid-template-columns:minmax(140px,.85fr) minmax(70px,1.5fr) minmax(95px,.65fr);gap:14px;padding:6px 0}.visual-bar-label,.visual-bar-value{font-size:13px!important;white-space:normal!important}.visual-bar-track{height:10px;border-radius:3px;background:#edf1f6}.visual-bar-fill{border-radius:3px;background:#4a7fb8}.chart-legend,.line-legend,.donut-legend-row{font-size:12px!important}.line-chart{min-height:240px}.donut-layout{gap:25px}.donut-center b{font-size:29px!important}.donut-center span{font-size:12px!important}.donut-legend-row span{font-size:13px}.donut-legend-row b{font-size:13px}.chart-axis-label,.line-chart text{font-size:12px}.chart-caption{font-size:12px!important}
.notice{font-size:13px!important;line-height:1.6!important;padding:12px 15px!important;border-radius:7px!important}.notice.info{background:#f3f7fb!important;border-color:#dce6f1!important;color:#405d79!important}.notice.warn{background:#fff8e9!important;border-color:#ead7b0!important;color:#795b21!important}.muted,.empty-visual{color:#586d83!important}.empty-visual{padding:22px;font-size:14px;line-height:1.6}.domain-card,.metric-card,.management-metric-card{box-shadow:none!important;border-color:#dce4ee!important;border-radius:8px!important;text-align:left}.domain-card h5{font-size:15px}.domain-card p,.metric-line,.metric-line span{font-size:13px!important}.table-wrap{border-radius:7px;border-color:#dce4ee;max-height:560px}table{font-size:13px;line-height:1.5}th{background:#f2f6fa;font-size:12px;color:#4a6078;padding:12px}td{padding:12px;color:#243c56}tbody tr:nth-child(even) td{background:#f8fafc}tbody tr:hover td{background:#eef4fa}td small{font-size:11px;color:#607188}.reporting-populations{margin-top:16px!important}
.cash-flow-hero{padding:22px!important;border:0!important;border-radius:9px!important;background:#f1f6fc!important;color:#1d3a58!important;box-shadow:none!important;margin-bottom:20px!important}.cash-flow-hero.withheld{background:#f4f7fb!important}.cash-flow-hero>div>span{font-size:12px!important;color:#506b86!important;letter-spacing:0!important;text-transform:none!important}.cash-flow-hero strong{font-size:27px!important;line-height:1.2!important;color:#234363!important}.cash-flow-hero p{font-size:13px!important;color:#526980!important;max-width:800px}.cash-flow-hero-stats span{font-size:12px!important;color:#587087!important}.cash-flow-hero-stats b{font-size:19px!important;color:#254463!important}.cash-flow-curve-withheld{background:#f6f8fb;border:1px solid #e1e7ef;padding:17px;border-radius:8px}.cash-flow-curve-withheld p{font-size:13px;color:#53677f}.cash-readiness-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.cash-readiness-item{padding:15px;background:#fff!important;border-color:#dce4ee!important}.cash-readiness-item small{font-size:13px;color:#526479}.certificate-columns{display:flex;align-items:end;gap:22px;min-height:240px;padding:18px 14px 0;border-bottom:1px solid #ced9e5;overflow-x:auto}.certificate-column{flex:1;min-width:100px;max-width:200px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}.certificate-column .amount{font-size:14px;color:#284d73;font-weight:700;margin-bottom:9px;white-space:nowrap}.certificate-column .bar{display:block;width:65%;max-width:100px;min-height:2px;background:#4e81b6;border-radius:5px 5px 0 0}.certificate-column .bar.negative{background:#ba6460}.certificate-column .period{font-size:12px;color:#496078;text-align:center;padding:10px 0;line-height:1.6}.certificate-column .period b{display:block;color:#27486a}.certificate-footnote{font-size:12px;color:#596f85;margin:12px 0 0}.certificate-future .bar{background:#92a6be}
.metric-interpretation{margin-top:12px;border-top:1px solid #e4eaf1;padding-top:10px}.metric-interpretation summary{font-size:12px;color:#486785;cursor:pointer}.management-metric-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}.management-metric-basis{font-size:12px}.management-metric-note p{font-size:13px!important}.management-two-column{gap:20px}.management-metric-grid{gap:12px}.management-metric-card{padding:19px!important;background:#fff!important}.management-metric-label{font-size:12px!important}.management-metric-value{font-size:25px!important;color:#203c59!important}.management-metric-meta{font-size:12px!important}.management-decision{padding:15px;background:#f7f9fc;border:1px solid #e0e7ef;border-radius:8px}.management-decision b{font-size:14px}.management-decision-meta span{font-size:12px}.management-decision small{font-size:12px;color:#5d6f85}.management-link{font-size:12px!important}.report-shell .role-primary-analysis .table-wrap{max-height:600px}
@media(max-width:1200px){.app{grid-template-columns:228px minmax(0,1fr)}.content{padding:20px}.workspace-header{flex-wrap:wrap}.experience-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.experience-fact{border-bottom:1px solid #e3e9f1}.role-view-selector{gap:14px;padding-inline:20px}.module-head h3{font-size:24px!important}.commercial-visual-grid{grid-template-columns:1fr!important}}
@media(max-width:900px){.app{display:block}.sidebar{height:auto;max-height:290px;position:relative}.brand{position:relative;top:0}.content{padding:16px}.module-panel #moduleContent{padding:18px!important}.module-workspace>.module-head{padding:20px!important}.topbar{position:relative}.workspace-actions{justify-content:flex-start}.role-view-selector{padding-inline:18px}.experience-preview{grid-template-columns:1fr}.management-two-column{grid-template-columns:1fr}.management-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.planning-panel-body,.management-panel-body{padding:15px!important}}
@media(max-width:600px){.module-head{display:block}.module-head-actions{justify-content:flex-start;margin-top:15px;max-width:none}.experience-facts{grid-template-columns:1fr 1fr}.experience-fact{padding:14px}.experience-fact>strong{font-size:22px}.experience-brief-heading{display:block}.cash-readiness-grid{grid-template-columns:1fr}.experience-disclosure>summary{flex-wrap:wrap}.experience-disclosure>summary span{margin-left:0}.visual-bar-row{grid-template-columns:1fr 1fr;gap:8px}.visual-bar-value{grid-column:2;text-align:right}.visual-bar-label{grid-row:span 2}.certificate-columns{gap:12px}.workspace-actions .btn{font-size:11px}.planning-kpi-grid{grid-template-columns:1fr 1fr!important}}
@media print{.experience-disclosure:not([open]),.experience-notes,.experience-audit,.visual-focus-button{display:none!important}.experience-facts{grid-template-columns:repeat(4,1fr)}.role-primary-analysis .table-wrap{max-height:none!important;overflow:visible!important}.experience-preview{display:block}.experience-preview>.visual-chart{margin-bottom:16px}.planning-panel,.visual-chart,.experience-brief{break-inside:avoid}.report-shell .experience-disclosure[open]>.experience-disclosure-body{padding:0}}
`;

export const experienceScript = String.raw`
function experienceDisclosure(title,body,note='',className=''){
  return '<details class="experience-disclosure '+className+'"><summary>'+escapeHtml(title)+(note?'<span>'+escapeHtml(note)+'</span>':'')+'</summary><div class="experience-disclosure-body">'+body+'</div></details>';
}
function experienceReviewSummary(a,management=false){
  if(!a)return '';
  const c=(management?a.affectedModuleCounts:a.counts)||{};
  const labels={system_defect:'Calculation errors',source_conflict:'Sources disagree',data_quality:'Source corrections',missing_information:'Inputs needed',comparison_difference:'Positions to compare',governance_review:'Approvals needed'};
  const tags=Object.entries(labels).filter(([k])=>c[k]>0).map(([k,label])=>'<span class="review-tag">'+escapeHtml(label)+' <b>'+fmt(c[k])+'</b></span>').join('');
  if(!tags)return '<p class="experience-scope-note"><a href="#moduleReviewDetail">View source notes and calculation coverage</a></p>';
  return '<div class="experience-notes '+(c.system_defect>0?'error':'')+'">'+(management?'<small>Affected views</small>':'')+tags+'<span class="review-spacer"></span><a href="#moduleReviewDetail">Review details</a></div>';
}
function experienceValue(value,unit=''){
  const v=value&&typeof value==='object'&&'value' in value?value.value:value;
  if(v===null||v===undefined||typeof v==='number'&&!Number.isFinite(v))return 'Not available';
  if(unit==='date')return planningShortDate(v);
  const exactUnit=['','%','d','h'].includes(unit);
  return (typeof v==='number'?(exactUnit?fmt(v):fmtExecutive(v)):String(v))+(unit?' '+unit:'');
}
// Explicit module schemas prevent status words, arbitrary counts or unrelated fields becoming a management KPI.
function experienceBrief(key,data){
  const d=findProjectionRoot(data),s=d.result||d,p=d.position||{},f=p.foundation||{},c=p.contractControls||{};
  const facts=[];
  const add=(label,value,basis,unit='')=>facts.push({label,value,display:experienceValue(value,unit),basis:basis+(value&&typeof value==='object'&&['partial','candidate','provisional','conflicted'].includes(value.state)?' · '+humanizeKey(value.state):''),unit});
  let note='',review='';
  if(key==='pmo-analysis'){
    add('Schedule progress',d.progress?.durationWeightedProgressPercent,'Duration weighted schedule snapshot','%');
    add('Submitted completion',d.forecast?.sourceCompletionIso,'Current programme','date');
    add('Critical activities',d.schedule?.criticalCount,'Source float; execution population');
    add('Near-critical activities',d.schedule?.nearCriticalCount,'Source float; strict near-critical band');
    note='Programme, progress and resource positions share the reporting date shown above.';
    if(d.forecast?.origin==='scenario_with_assumptions')review='The independent finish is a scenario. Review its unapplied constraints before adopting it as a delivery commitment.';
  }else if(key==='schedule-analytics'){
    add('Execution activities',s.population?.executableActivityCount,'LOE and summary records excluded');
    add('Critical activities',s.float?.criticalCount,'Source total float');
    add('Near-critical activities',s.float?.nearCriticalCount,'Activity-calendar working-day threshold');
    add('Open logic starts',s.logicQuality?.executionOpenStartActivityIds?.length,'Execution activities without predecessors');
    note='Float classifications describe the submitted schedule. Open ends require a boundary review before they are treated as logic defects.';
    if(s.logicQuality?.executionOpenStartActivityIds?.length)review='Review the open starts against approved project boundaries. The complete activity list is in the analysis below.';
  }else if(key==='activity-analytics'){
    const m=d.movementAnalysis,dist=d.movementDistribution;
    add('Baseline-comparable',dist?.knownCount,'Of '+experienceValue(d.activityCount)+' source activities');
    add('Largest finish movement',dist?.maximum,'Current vs each activity’s controlled baseline','d');
    add('Activities at maximum',dist?.maximumCount,'Shared movement, not separate delay causes');
    add('Comparison coverage',d.finishVarianceCoveragePercent,'Known baseline/current date pairs','%');
    note='Activity finish movement measures changed source dates. It does not establish causation or EOT.';
    if(dist?.maximumCount>1)review='Review the shared maximum movement with the baseline/current date pairs and previous-revision comparison before attributing a cause.';
  }else if(key==='near-critical'){
    add('Strict near-critical',d.nearCriticalCount,'Above critical threshold, within near-critical band');
    add('Zero float',d.zeroFloatCount,'Included in the wider watchlist');
    add('Negative float',d.negativeFloatCount,'Below the critical threshold');
    add('Wider watchlist',d.floatRiskWatchlistCount,'Includes the critical boundary');
    note='The strict near-critical population and the wider watchlist have different definitions. Counts are not interchangeable.';
  }else if(key==='progress-report'){
    const b=d.progressBases||{};
    add('Baseline plan',b.baselinePlanned?.valuePercent,'Time-phased at the Data Date','%');
    add('Current plan',b.currentSchedule?.valuePercent,'Current programme at the Data Date','%');
    add('Schedule snapshot',b.scheduleSnapshot?.valuePercent,'Duration weighted; not measured physical progress','%');
    add('Physical progress',b.physical?.valuePercent,'Requires measured installation evidence','%');
    note='Plan, schedule snapshot and measured physical progress remain distinct measures.';
    if(b.physical?.valuePercent==null)review='Measured physical progress is unavailable. Use the schedule snapshot for programme review; establish installed quantities before assessing physical delivery.';
  }else if(key==='progress-scurve'){
    add('Actual observations',d.observationCount,'Schedule snapshots');
    add('Baseline coverage',d.baselineCoveragePercent,'Eligible baseline activities','%');
    add('Current coverage',d.currentCoveragePercent,'Eligible current activities','%');
    add('Snapshot coverage',d.actualSnapshotCoveragePercent,'Duration weighted source activities','%');
    note='The curve is duration weighted. Observed snapshots and planned curves use their own populations; interpolation is not an observation.';
  }else if(key==='lookahead-schedule'){
    add('Ready',d.readyCount,'Readiness evidence complete');add('Blocked',d.blockedCount,'Confirmed blockers');
    add('Conditional',d.conditionalCount,'Readiness not fully established');add('Window',d.windowDays,'From the Data Date','d');
    note='Readiness is assessed for activities entering the lookahead window.';
    if(d.blockedCount>0)review='Clear the evidenced blockers before releasing the affected activities. Review the conditional activities for missing prerequisites.';
  }else if(key==='milestones'){
    add('Open milestones',d.openCount,'Current milestone population');add('Completed',d.completedCount,'As of the Data Date');
    add('Critical milestones',d.criticalMilestoneCount,'Source float; may overlap open milestones');add('Due in 30 days',d.due30Count,'Open milestones');
    note='Source float, due dates and completion movement are separate measures of milestone exposure.';
    if(d.criticalMilestoneCount>0)review='Review the critical milestone dates and their driving activities before confirming recovery commitments.';
  }else if(key==='resource-utilization'){
    add('Resource identities',d.assignedResourceCount,'P6 resources with assignments');add('Weekly resources',d.weeklyObservedResourceCount,'Resources with weekly capacity evidence');
    add('Planned utilization',d.plannedUtilizationPercent,'Mean comparable resource-week ratios by Data Date','%');add('Actual utilization',d.actualUtilizationPercent,'Same comparable period basis','%');
    note='Resource identities, assignment rows and resource-week observations describe different populations.';
    if(d.weeklyCapacityEvidence?.overloadPeriods)review='Use the dated overload register to review capacity by resource and week. An average utilization does not rule out local overloads.';
  }else if(key==='manhour-scurve'){
    add('Planned hours',d.plannedHoursToDataDate,'Weekly plan by Data Date','h');add('Actual hours',d.actualHoursToDataDate,'Approved weekly usage by Data Date','h');
    add('Actual less plan',d.actualMinusPlannedHoursToDataDate,'Same reporting periods','h');add('Labor resources',d.laborResourceCount,'Labor only; equipment excluded');
    note='Hours compare resource use with plan. They do not measure productivity without installed output.';
  }else if(key==='quantity-scurve'){
    add('BOQ items',d.boqItemCount,'Source quantities');add('Linked items',d.allocatedItemCount,'Governed schedule mappings');
    add('Mapping coverage',d.itemLinkCoveragePercent,'Item coverage, not mixed-unit quantity coverage','%');add('Quantity units',d.series?.length,'Each unit remains separate');
    note='Source BOQ quantities remain available independently of schedule mapping. Measured installations require separate evidence.';
    if(d.allocationState!=='established')review='Review the BOQ-to-activity mapping before using a time-phased quantity plan. Keep measured installation evidence on its own dates and units.';
  }else if(key==='progress-breakdown'){
    add('Execution activities',d.totalActivityCount,'Nonadditive WBS hierarchy');add('Direct WBS groups',d.rows?.length,'Groups owning execution activities');
    add('Hierarchy groups',d.hierarchyRows?.length,'Parents and direct groups');
    note='Parent rows roll up their children and must not be added to child totals.';
  }else if(key==='schedule-change-report'){
    add('Added activities',d.addedActivityCount,'Current vs previous revision');add('Removed activities',d.removedActivityCount,'Previous vs current revision');
    add('Modified activities',d.modifiedActivityCount,'Matched source records with changed fields');add('Largest finish movement',d.finishMovementAnalysis?.maximumDays,'Previous revision comparison','d');
    note=(d.fromRevisionLabel?planningRevisionLabel(d.fromRevisionLabel)+' → '+planningRevisionLabel(d.toRevisionLabel)+'. ':'')+'This comparison is separate from controlled-baseline variance.';
    if(d.baselineMutationActivityCount>0)review=experienceValue(d.baselineMutationActivityCount)+' matched activities have changed baseline fields. Review the revision authority before adopting those fields as a controlled baseline.';
  }else if(['revision-trend','variance-trends','forecast-history'].includes(key)){
    add('Source revisions',d.revisionCount??d.snapshotCount,'Available revision history');
    if(key==='forecast-history'){add('Source forecasts',d.sourceForecastCount,'Submitted programme positions');add('Independent calculations',d.establishedForecastCount,'Scenario authority retained');}
    else add('Observations',d.points?.length,'Source snapshots, not interpolated history');
    note='Read each point on its own revision and reporting date. A change in population can affect the comparison.';
  }else if(key==='independent-forecast'){
    add('Contract completion',d.contractualCompletionIso,'Contract authority','date');add('Submitted completion',d.sourceForecastCompletionIso,'Current programme','date');
    add('Independent scenario',d.independentForecastCompletionIso,'Calculated, subject to assumptions','date');add('Scenario vs submitted',d.forecastVarianceDays,'Calendar days','d');
    note='Submitted dates and independent scenarios have different authority.';
    if(d.managementReviewState==='review_required')review=d.managementReviewReason||'Review calculation assumptions before adopting the independent date.';
  }else if(['notices-claims','delay-claims','windows-analysis','eot-assessment'].includes(key)){
    if(key==='eot-assessment'){
      add('Contract completion',d.contractualCompletionIso,'Governed contract date','date');add('Gross determined days',d.officialApprovedEotDays,'Dated determinations; overlap not resolved','d');
      add('Further adjusted finish',d.officialAdjustedCompletionIso,'Requires reconciled authority','date');add('Programme finish movement',d.projectCompletionMovementDays,'Source finish movement, not entitlement','d');
      if(d.timeBasisReconciliation?.overlapResolution==='unresolved')review='Resolve which determinations are already incorporated in the contract amendment before calculating any further adjusted completion.';
    }else if(key==='windows-analysis'){
      add('Revision windows',d.windowCount,'Available comparisons');add('Source finish movement',d.projectCompletionMovementDays,'First vs latest programme','d');
      add('Gross analytical movement',d.grossAnalyticalMovementDays,'Positive movement across windows','d');add('Complete windows',d.completeWindowCount,'Calculation coverage');
    }else{
      add('Claims by Data Date',d.claimCount,'Future and undated claims excluded');add('Events by Data Date',d.eventCount,'Evidence of existence, not causation');
      if(key==='delay-claims'){add('Activity-linked events',d.activityLinkedEventCount,'Accepted event/activity links');add('Source finish movement',d.projectCompletionMovementDays,'Calendar days, not attributable delay','d');}
      else{add('Notices by Data Date',d.noticeCount,'Dated notices');add('Notice period',d.contractNoticePeriod?.value,'Contract requirement','d');}
    }
    note='Schedule movement, event attribution, notice compliance and awarded EOT are separate conclusions.';
  }else if(key==='challenge-contract'){
    const q=d.deliveryChallenge?.scheduleChallenge||{};
    add('Contract completion',q.contractualCompletionIso,'Contract authority','date');add('Submitted completion',q.contractorSubmittedCompletionIso,'Source programme','date');
    add('Independent scenario',q.independentCompletionIso,'Calculated; assumptions apply','date');add('Scenario difference',q.contractorVsIndependentDays,'Independent vs submitted','d');
    note='Delivery review tests schedule and resource evidence. It does not determine EOT or entitlement.';
    review=d.independentForecastReviewReason||'';
  }else if(key==='cash-flow'){
    const rows=p.performance?.cashFlow?.currencies||[];
    if(rows.length===1){const r=rows[0];add('Cash received',r.paidIncome,'Actual dated receipts',r.currency);add('Cash spent',r.actualExpenditure,'Actual dated expenditure',r.currency);add('Net cash movement',r.netCashPosition,'Receipts less expenditure; opening cash excluded',r.currency);}
    add('Certificate periods',f.paymentRegister?.recordCount,'On or before the Data Date');
    note='Cash movements and certificate values are separate views. Currency and tax partitions are never combined.';
    if(rows.some(r=>!r.sourceReadiness?.netCashReady))review='Add paid amounts with receipt dates and actual cash expenditure dates to establish net cash. Certificate values by reporting period are available below.';
  }else if(key==='payments'){
    const r=f.paymentRegister||{};add('Certificate periods',r.recordCount,'By Data Date');add('Future periods',r.futureRows?.length,'Excluded from current position');
    add('Undated records',r.undatedRows?.length,'Outside dated totals');
    note='Application, certification and payment are separate events. A period-end date is not proof of a payment date.';
  }else if(key==='variations-change'){
    const t=p.sourceLedger?.temporalPosition?.variations||{};add('Approvals by Data Date',t.asOfApprovedCount,'Dated approved changes');
    add('Future approvals',t.futureApprovalCount,'Outside the current position');add('Undated approvals',t.undatedApprovalCount,'Approval date not established');
    note='Current approval records and the source contract summary retain separate date bases.';
  }else if(key==='cost-forecast'){
    const rows=p.performance?.costControl?.positions||[];
    if(rows.length===1){const r=rows[0];for(const [label,field,basis] of [['Budget','bac','Source budget'],['Actual cost','ac','Accrual cost, not cash expenditure'],['Forecast at completion','sourceEac','Source EAC'],['Variance at completion','calculatedVac','Calculated budget less EAC']])add(label,r[field],basis,r.currency);}
    note='Cost, earned value and cash use distinct measures. Forecast methods and currency partitions are retained in the analysis.';
  }else if(key==='contract-particulars-bonds'){
    const t=p.timeExposure||{},bi=c.bondsInsurance||{};add('Contract completion',t.contractualCompletion?.value,'Governed contract date','date');add('Further adjusted finish',t.officialAdjustedCompletion?.value,'Separate approval required','date');
    add('Active bonds',bi.bonds?.length?bi.activeBondCount:null,'Requires a current security register');add('Active policies',bi.insurances?.length?bi.activeInsuranceCount:null,'Requires an insurance register');
    note='Contract requirements do not establish whether a bond, policy or controlled obligation has been issued.';
  }else if(key==='commercial-claims-notices'){
    const r=d.claimsReporting;add('Claims by Data Date',r?.claims?.asOf?.length,'Dated claims only');add('Future claims',r?.claims?.future?.length,'Excluded from current totals');
    add('Commercial records',p.claimCommercialCount,'Claims with a commercial linkage');
    note='Money claims and time entitlement have separate assessment and approval bases.';
  }else if(key==='commercial-overview'){
    add('Approvals by Data Date',p.sourceLedger?.temporalPosition?.variations?.asOfApprovedCount,'Dated approved changes');add('Certificate periods',f.paymentRegister?.recordCount,'By Data Date');
    add('Currency partitions',p.currencies?.length,'Separate currency and tax bases');add('Contract completion',p.timeExposure?.contractualCompletion?.value,'Governed date','date');
    note='Contract value, change, certification, receipts and exposure remain distinct positions.';
  }
  return {facts,note,review};
}
function experienceRoleReview(role,brief,key,data){
  if(!brief.review)return '';
  const labels={planning:'Technical review',controls:'Control review','project-director':'Delivery review','program-director':'Programme review',executive:'Decision context'};
  return '<div class="experience-review"><b>'+escapeHtml(labels[role]||'Review focus')+'</b><p>'+escapeHtml(brief.review)+'</p></div>';
}
function experiencePreview(primaryView,limit=2){
  const host=document.createElement('template');host.innerHTML=primaryView;
  const panels='[data-visual-panel],.chart-card,.planning-panel';
  const visual='svg,.visual-bars,.donut-ring,.certificate-columns,.date-ladder,.cash-movement-bars,.waterfall-chart,.milestone-date-chart,.lookahead-timeline,.signed-bars,.status-band,.pressure-matrix,.float-histogram,.constraint-bars,.finish-period-bars';
  // All chart families share the overview, including planning timelines. Select leaf panels so a register or entire module is never copied into the preview.
  const charts=[...host.content.querySelectorAll(panels)].filter(n=>!n.querySelector(panels)&&!n.querySelector('table')&&n.querySelector(visual));
  return charts.length?'<div class="experience-preview">'+charts.slice(0,limit).map(n=>n.outerHTML).join('')+'</div>':'';
}
function experienceRoleContent(key,data,primaryView,challengeHtml='',includeTechnical=false){
  const role=selectedRoleView,brief=experienceBrief(key,data),leadership=['project-director','program-director','executive'].includes(role);
  const facts=brief.facts.slice(0,4);
  const factHtml=facts.length?'<div class="experience-facts">'+facts.map(f=>'<div class="experience-fact"><span>'+escapeHtml(f.label)+'</span><strong'+(f.display==='Not available'?' class="unavailable"':'')+' title="'+escapeHtml(f.value?.value??f.value??'Not available')+'">'+escapeHtml(f.display)+'</strong><small>'+escapeHtml(f.basis)+'</small></div>').join('')+'</div>':'';
  const briefHtml=role==='overall'?'':'<section class="experience-brief"><div class="experience-brief-heading"><h4>'+escapeHtml(leadership?'Position at a glance':'Review focus')+'</h4><span>'+escapeHtml(roleViews[role].label)+'</span></div>'+(leadership?factHtml:'')+(brief.note?'<p>'+escapeHtml(brief.note)+'</p>':'')+experienceRoleReview(role,brief,key,data)+'</section>';
  // Leadership gets a short overview, with every chart and record reachable in one disclosure.
  const analysis='<div class="role-primary-analysis">'+primaryView+'</div>';
  const content=leadership?experiencePreview(primaryView,role==='executive'?1:2)+experienceDisclosure('Complete module analysis',analysis,'All charts, registers and source records'):analysis;
  return '<div class="role-view-'+role+'">'+briefHtml+content+challengeHtml+'</div>';
}
function experienceCertificateGroups(position){
  const register=position?.foundation?.paymentRegister||{},source=position?.sourceLedger?.payments||[];
  const groups=new Map();
  for(const [scope,rows] of [['as_of',register.rows||[]],['future',register.futureRows||[]],['undated',register.undatedRows||[]]]){
    for(const row of rows){
      // The producer owns scope and values. This lookup supplies currency/tax metadata, never new amounts or dates.
      const matches=source.filter(x=>x.paymentId===row.paymentId&&x.periodEnd===row.periodEnd);
      const bases=[...new Set(matches.map(x=>JSON.stringify([x.amounts?.netCertifiedAmount?.currency||null,x.amounts?.netCertifiedAmount?.taxBasis||'unknown'])))];
      const [currency,taxBasis]=bases.length===1?JSON.parse(bases[0]):[null,'unknown'];
      const key=JSON.stringify([currency,taxBasis]);
      if(!groups.has(key))groups.set(key,{currency,taxBasis,as_of:[],future:[],undated:[]});
      groups.get(key)[scope].push({id:row.paymentId,date:row.periodEnd,value:row.amounts?.netCertifiedAmount?.value??null,basis:row.certifiedAmountBasis||'unknown'});
    }
  }
  return [...groups.values()];
}
function experienceCertificateChart(rows,currency,future=false){
  const dated=rows.filter(r=>r.date&&typeof r.value==='number'&&Number.isFinite(r.value)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  if(!dated.length)return '<div class="empty-visual">No dated certificate-period amounts are available for this group.</div>';
  const max=Math.max(1,...dated.map(r=>Math.abs(r.value)));
  const columns=dated.map(r=>'<div class="certificate-column" title="'+escapeHtml(r.id+' · '+r.date+' · '+fmt(r.value)+' '+(currency||'currency unknown'))+'"><span class="amount">'+escapeHtml(fmtExecutive(r.value))+'</span><i class="bar '+(r.value<0?'negative':'')+'" style="height:'+Math.max(2,Math.abs(r.value)/max*170).toFixed(1)+'px"></i><span class="period"><b>'+escapeHtml(r.id)+'</b>'+escapeHtml(planningShortDate(r.date))+'</span></div>').join('');
  const chart='<div class="certificate-columns '+(future?'certificate-future':'')+'" role="img" aria-label="Net certificate values by reporting period; '+escapeHtml(currency||'currency unknown')+'; individual records, not cash receipts">'+columns+'</div>';
  return chart+'<p class="certificate-footnote">'+fmt(dated.length)+' of '+fmt(rows.length)+' records plotted · '+escapeHtml(currency||'Currency not established')+'. Individual source values; no cumulative sum. A reporting period is not a certification or payment event date.</p>';
}
function experienceCertificatePanels(position){
  return experienceCertificateGroups(position).map(g=>{
    const title='Certificate values by reporting period';
    const subtitle=(g.currency||'Currency not established')+' · '+humanizeKey(g.taxBasis)+' tax basis. Source net certificate amounts, separate from actual cash.';
    const current=renderVisualPanel(title,subtitle,experienceCertificateChart(g.as_of,g.currency));
    const future=g.future.length?experienceDisclosure('Future certificate periods',experienceCertificateChart(g.future,g.currency,true),fmt(g.future.length)+' records excluded from current position'):'';
    const undated=g.undated.length?'<p class="certificate-footnote">'+fmt(g.undated.length)+' undated records are retained in Payments and excluded from both charts.</p>':'';
    return '<section class="certificate-period-position">'+current+future+undated+'</section>';
  }).join('');
}
`;
