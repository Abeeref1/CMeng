export const projectDiagnosisStyles=String.raw`
.project-diagnosis{margin-bottom:24px}.diagnosis-heading h3{margin:0;font-size:22px}.diagnosis-heading p{color:var(--muted);margin:5px 0 16px}.diagnosis-summary{font-size:17px;line-height:1.65;margin:18px 0}.diagnosis-section{background:white;border:1px solid var(--line);border-radius:10px;padding:18px;margin:18px 0}.diagnosis-section h4{font-size:18px;margin:0 0 8px}.diagnosis-section p{line-height:1.6}.diagnosis-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0}.diagnosis-table{overflow-x:auto}.diagnosis-table table{font-size:12px;min-width:720px}.diagnosis-table td{max-width:340px;white-space:normal;overflow-wrap:anywhere}.diagnosis-note{font-size:13px;color:var(--muted)}.diagnosis-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:12px}.diagnosis-action{padding:14px;background:#f8fbfe;border:1px solid var(--line);border-radius:8px}.diagnosis-action h5{margin:0 0 7px;font-size:15px}.diagnosis-action p{font-size:13px;margin:6px 0}
`;
export const projectDiagnosisScript=String.raw`
let diagnosisTableSeq=0;const diagnosisTables=new Map();
function diagnosisCell(value){return value===null||value===undefined?'Not available':typeof value==='number'?fmt(value):typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)?planningShortDate(value):String(value);}
function diagnosisTableHtml(t){
 const rows=t.rows.slice(0,t.limit),start=t.offset||0;
 return '<div class="diagnosis-table">'+basisTable(t.columns.map(c=>c[1]),rows.map(r=>t.columns.map(c=>diagnosisCell(r[c[0]]))))+'</div><div class="diagnosis-toolbar"><span>'+(!rows.length?'No established matching rows.':(start+1)+'–'+(start+rows.length)+' of '+fmt(t.total))+'</span>'+
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
  if(page.projectId!==t.projectId||page.projectVersion!==t.version)throw new Error('The project changed. Refresh the diagnosis.');
  t.rows=page.rows;t.total=page.total;t.offset=page.offset;el(id).innerHTML=diagnosisTableHtml(t);
 }catch(e){if(project()===t.projectId&&el(id))el(id).innerHTML=diagnosisTableHtml(t)+'<p role="alert">'+escapeHtml(e.message)+'</p>';}
}
function diagnosisAsk(question){setAppView('ai');el('aiQuestion').value=question;askCmeng();}
function renderProjectDiagnosis(d){
 if(!d)return '';
 const c=d.counts,countText=x=>x.value??(x.knownCount===null?'Not available':fmt(x.knownCount)+' known');
 const metrics=planningKpis([['Negative float',countText(c.negativeFloat),'activities; source float'],['Critical',countText(c.critical),'activities; source float'],['Near-critical',countText(c.nearCritical),'assigned-calendar threshold'],['Missed starts',countText(c.missedStarts),'against Data Date'],['Overdue finishes',countText(c.overdueFinishes),'unfinished work'],['Slipped since previous',countText(c.previousUpdateSlippage),'adopted revision comparison']]);
 const net=d.network,network=net.state==='unavailable'?'<p>The independent finish-driving network is not calculable from the current programme fields. Known critical and negative-float activities remain available below.</p>':
 '<p>'+escapeHtml(net.state==='scenario'?'Calculated with the completion assumptions shown above.':'Calculated from the programme calendars and logic.')+' '+fmt(d.tableTotals?.network??net.rows.length)+' activities · '+fmt(d.tableTotals?.relationships??net.relationships.length)+' driving links. Parallel branches are retained; use the predecessor and successor columns to follow the actual sequence.</p>'+diagnosisTable(d,'network',net.rows,[['sequence','Order'],['activityId','Activity ID'],['name','Activity'],['wbs','WBS'],['calculatedStartIso','Calculated start'],['calculatedFinishIso','Calculated finish'],['remainingDurationHours','Remaining hours'],['totalFloatHours','Source float · h'],['previousFinishMovementCalendarDays','Movement · elapsed days'],['drivingPredecessors','Driving predecessors / link / lag'],['drivingSuccessors','Driving successors / link / lag']]);
 const actions=d.actions.map(r=>'<article class="diagnosis-action"><h5>'+r.rank+'. '+escapeHtml(r.activityId+' · '+r.name)+'</h5><p>'+escapeHtml(r.wbs)+'</p><p><b>'+escapeHtml(r.reason)+'</b></p>'+(r.previousPredecessorSlippage?'<p>'+escapeHtml(r.previousPredecessorSlippage)+'</p>':'')+(r.linkedEvidence?'<p>'+escapeHtml(r.linkedEvidence)+'</p>':'')+'<p>'+escapeHtml(r.action)+'</p></article>').join('');
 const revision=d.revision;
 return '<section class="project-diagnosis"><header class="diagnosis-heading"><h3>Programme analysed</h3><p>'+fmt(d.executionActivityCount)+' execution activities · '+fmt(d.relationshipCount)+' relationships · '+fmt(d.calendarCount)+' calendars · Data Date '+planningShortDate(d.dataDateIso)+'</p></header>'+renderCompletionPosition(d.completion)+
 '<p class="diagnosis-summary">'+escapeHtml(d.summary)+'</p>'+metrics+
 '<section class="diagnosis-section"><h4>Driving path to completion</h4>'+network+'<details><summary>Path calculation basis</summary><p>'+escapeHtml(net.basis)+'</p></details></section>'+
 '<section class="diagnosis-section"><h4>Where schedule pressure is concentrated</h4><p>WBS groups are ranked by unfinished driving activities, then pressure count. These counts do not allocate delay days or responsibility.</p>'+diagnosisTable(d,'wbs',d.wbsRows,[['wbs','WBS'],['pressureCount','Pressure activities'],['drivingCount','Unfinished driving'],['criticalCount','Critical'],['negativeFloatCount','Negative float'],['missedStartCount','Missed starts'],['overdueFinishCount','Overdue finishes'],['worstFloatHours','Lowest float · h']],5)+'</section>'+
 '<section class="diagnosis-section"><h4>Immediate management actions</h4><p class="diagnosis-note">'+escapeHtml(d.rankingBasis)+'</p><div class="diagnosis-actions">'+(actions||'<p>No confirmed activity action can be ranked from the available fields.</p>')+'</div></section>'+
 '<section class="diagnosis-section"><h4>What the linked records show</h4><p>'+fmt(d.evidenceCoverage.activitiesWithLinkedPressure)+' pressure activities have a linked blocker or late supporting record. A missing link is unknown; it is not proof of readiness.</p>'+diagnosisTable(d,'evidence',d.evidenceChecks,[['activityId','Activity'],['domain','Area'],['recordId','Source record'],['explanation','Finding']],5)+'<details><summary>Cross-check coverage</summary><p>'+escapeHtml(d.evidenceCoverage.basis)+'</p></details></section>'+
 '<section class="diagnosis-section"><h4>Milestones exposed</h4>'+diagnosisTable(d,'milestones',d.milestoneRows,[['activityId','Milestone ID'],['name','Milestone'],['currentFinishIso','Current date'],['totalFloatHours','Float · h'],['reason','Exposure'],['action','Action']],5)+'</section>'+
 '<section class="diagnosis-section"><h4>What changed since the previous programme</h4><p>'+escapeHtml(revision.state==='available'?(revision.modified+' changed, '+revision.added+' added and '+revision.removed+' removed activities. Completion movement: '+diagnosisCell(revision.finishMovementCalendarDays)+' elapsed days.'):revision.basis)+'</p>'+(revision.state==='available'?diagnosisTable(d,'changes',revision.largestChanges,[['activityId','Activity ID'],['name','Activity'],['finishMovementCalendarDays','Finish movement · elapsed days'],['floatMovementHours','Float movement · h'],['progressMovementPercent','Progress movement · points']],5):'')+'</section>'+
 '<section class="diagnosis-section"><h4>If nothing changes</h4><p>'+escapeHtml(d.noChangeOutlook)+'</p></section>'+
 '<div class="diagnosis-toolbar"><button class="btn" onclick="diagnosisAsk(\'List all delayed activities\')">All delayed activities</button><button class="btn" onclick="diagnosisAsk(\'Show all negative-float activities\')">All negative float</button><button class="btn" onclick="diagnosisAsk(\'Which activities should have started already?\')">Missed starts</button></div>'+
 '<details><summary>Programme checks and limits</summary>'+basisTable(['Check','Known count'],Object.entries(d.anomalies).filter(([k,v])=>typeof v==='number').map(([k,v])=>[humanizeKey(k),fmt(v)]))+'<p>'+escapeHtml(d.limitation)+'</p></details></section>';
}
`;
