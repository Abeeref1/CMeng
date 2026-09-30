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
  if(page.projectId!==t.projectId||page.projectVersion!==t.version)throw new Error('The project changed. Refresh the analysis.');
  t.rows=page.rows;t.total=page.total;t.offset=page.offset;el(id).innerHTML=diagnosisTableHtml(t);
 }catch(e){if(project()===t.projectId&&el(id))el(id).innerHTML=diagnosisTableHtml(t)+'<p role="alert">'+escapeHtml(e.message)+'</p>';}
}
function diagnosisAsk(question){setAppView('ai');el('aiQuestion').value=question;askCmeng();}
function renderProjectDashboardSummary(d){
 if(!d)return '';
 const c=d.counts||{},value=x=>x?.value??x?.knownCount??'Not available';
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
 const driverRows=drivers.length?'<ul>'+drivers.map(r=>'<li><b>'+escapeHtml(String(r.wbs||'').split(' / ').slice(-3).join(' / '))+'</b> · '+fmt(r.pressureCount||0)+' pressure · '+fmt(r.drivingCount||0)+' driving</li>').join('')+'</ul>':'<p>No concentrated schedule pressure is established.</p>';
 const actionRows=actions.length?'<ol>'+actions.map(group=>{
   const unique=[...new Map(group.items.filter(item=>item.activityId||item.name).map(item=>[(item.activityId||item.name),item])).values()];
   const identities=unique.slice(0,3).map(item=>[item.activityId,item.name].filter(Boolean).join(' · ')).filter(Boolean);
   const more=Math.max(0,group.groupedCount-identities.length);
   const identityText=identities.length?'<span class="muted">'+escapeHtml(identities.join('; '))+(more?' · '+escapeHtml(fmt(more))+' more':'')+(group.wbs?' · WBS '+escapeHtml(group.wbs):'')+'</span>':'<span class="muted">'+escapeHtml(fmt(group.groupedCount))+' related activities'+(group.wbs?' · WBS '+escapeHtml(group.wbs):'')+'</span>';
   return '<li><b>'+escapeHtml(group.reason)+'</b><br>'+identityText+(group.action?'<br><span class="muted">Next: '+escapeHtml(group.action)+'</span>':'')+'</li>';
 }).join('')+'</ol>':'<p>No immediate programme action is ranked from the available fields.</p>';
 return '<section class="project-diagnosis dashboard-summary"><header class="diagnosis-heading"><h3>Current project position</h3><p>Data Date '+planningShortDate(d.dataDateIso)+'</p></header>'+renderCompletionPosition(d.completion)+'<p class="diagnosis-summary">'+escapeHtml(d.summary)+'</p>'+planningKpis([['Critical',value(c.critical),'activities'],['Negative float',value(c.negativeFloat),'activities'],['Near-critical',value(c.nearCritical),'activities'],['Driving network',d.tableTotals?.network??d.network?.rows?.length??'Not available','activities']])+'<div class="planning-primary-grid"><section class="diagnosis-section"><h4>Main schedule pressure</h4>'+driverRows+'</section><section class="diagnosis-section"><h4>Management priorities</h4>'+actionRows+'</section></div><details><summary>Detailed programme analysis</summary>'+renderProjectDiagnosis(d)+'</details></section>';
}
function renderProjectBrief(d){
 if(!d)return '';
 const driverGroups=(d.actions||[]).slice(0,5);
 const milestones=(d.milestoneRows||[]).slice(0,5);
 const revision=d.revision||{};
 const completion=renderCompletionPosition(d.completion);
 const drivers=driverGroups.length?'<div class="diagnosis-actions">'+driverGroups.map(row=>{
   const ids=(row.activityIds||[row.activityId]).filter(Boolean),wbs=String(row.wbs||'').split(' / ').slice(-3).join(' / ');
   return '<article class="diagnosis-action"><h5>'+escapeHtml(row.reason||'Schedule driver')+'</h5>'+
     '<p><b>'+escapeHtml(wbs||'Programme scope')+'</b> · '+escapeHtml(fmt(row.groupedCount||ids.length||1))+' affected activit'+((row.groupedCount||ids.length||1)===1?'y':'ies')+'</p>'+
     '<p>'+escapeHtml(ids.slice(0,4).join('; '))+(ids.length>4?' · '+escapeHtml(fmt(ids.length-4))+' more':'')+'</p>'+
     (row.linkedEvidence?'<p>'+escapeHtml(row.linkedEvidence)+'</p>':'')+
     '<p><b>Required action:</b> '+escapeHtml(row.action||'Review the remaining work and agree the next control action.')+'</p></article>';
 }).join('')+'</div>':'<div class="notice info">No distinct schedule driver is ranked from the available programme evidence.</div>';
 const milestoneHtml=milestones.length?'<div class="table-wrap"><table><thead><tr><th>Milestone</th><th>Current</th><th>Float</th><th>Exposure</th><th>Action</th></tr></thead><tbody>'+
   milestones.map(row=>'<tr><td><b>'+escapeHtml(row.activityId)+'</b><br>'+escapeHtml(row.name||'')+'</td><td>'+escapeHtml(planningShortDate(row.currentFinishIso))+'</td><td>'+escapeHtml(row.totalFloatHours===null||row.totalFloatHours===undefined?'—':fmt(row.totalFloatHours)+' h')+'</td><td>'+escapeHtml(row.reason||'Current programme milestone')+'</td><td>'+escapeHtml(row.action||'Protect the milestone and confirm its driving scope.')+'</td></tr>').join('')+
   '</tbody></table></div>':'<div class="notice info">No open priority milestone is established from the current programme.</div>';
 const decisions=driverGroups.length?'<ol>'+driverGroups.map(row=>'<li><b>'+escapeHtml(row.action||'Review programme pressure')+'</b><br><span class="muted">'+escapeHtml(row.reason||'')+'</span></li>').join('')+'</ol>':'<p>No immediate programme decision is ranked from the available information.</p>';
 const change=revision.state==='available'
   ?'<div class="notice info"><b>Since the previous adopted programme:</b> '+escapeHtml(fmt(revision.modified))+' activities changed, '+escapeHtml(fmt(revision.added))+' were added and '+escapeHtml(fmt(revision.removed))+' removed. Submitted completion movement: '+escapeHtml(revision.finishMovementCalendarDays===null||revision.finishMovementCalendarDays===undefined?'Not established':(revision.finishMovementCalendarDays>0?'+':'')+fmt(revision.finishMovementCalendarDays)+' d')+'.</div>'
   :'<div class="notice info">'+escapeHtml(revision.basis||'No comparable previous adopted programme is available, so revision movement is not stated.')+'</div>';
 return '<section class="project-diagnosis management-brief"><header class="diagnosis-heading"><h3>Management brief</h3><p>Data Date '+planningShortDate(d.dataDateIso)+' · '+fmt(d.executionActivityCount)+' execution activities</p></header>'+
   completion+'<p class="diagnosis-summary">'+escapeHtml(d.summary)+'</p>'+
   change+
   '<section class="diagnosis-section"><h4>What is driving the current position</h4><p class="diagnosis-note">Distinct driver groups are shown once; repeated activities sharing the same driver are grouped.</p>'+drivers+'</section>'+
   '<section class="diagnosis-section"><h4>Milestones to protect</h4>'+milestoneHtml+'</section>'+
   '<section class="diagnosis-section"><h4>Decisions and actions required</h4>'+decisions+'</section>'+
   '<details><summary>Supporting programme detail</summary><p>Critical '+escapeHtml(diagnosisCell(d.counts?.critical?.knownCount))+' · Negative float '+escapeHtml(diagnosisCell(d.counts?.negativeFloat?.knownCount))+' · Near-critical '+escapeHtml(diagnosisCell(d.counts?.nearCritical?.knownCount))+'.</p><p>'+escapeHtml(d.limitation||'')+'</p></details></section>';
}
function renderProjectDiagnosis(d){
 if(!d)return '';
 const c=d.counts,countText=x=>x.value??(x.knownCount===null?'Not available':fmt(x.knownCount)+' known');
 const metrics=planningKpis([['Negative float',countText(c.negativeFloat),'activities; source float'],['Critical',countText(c.critical),'activities; source float'],['Near-critical',countText(c.nearCritical),'assigned-calendar threshold'],['Missed starts',countText(c.missedStarts),'against Data Date'],['Overdue finishes',countText(c.overdueFinishes),'unfinished work'],['Slipped since previous',countText(c.previousUpdateSlippage),'adopted revision comparison']]);
 const net=d.network,network=net.state==='unavailable'?'<p>The independent finish-driving network is not calculable from the current programme fields. Known critical and negative-float activities remain available below.</p>':
 '<p>'+escapeHtml(net.state==='scenario'?'Calculated with the completion assumptions shown above.':'Calculated from the programme calendars and logic.')+' '+fmt(d.tableTotals?.network??net.rows.length)+' activities · '+fmt(d.tableTotals?.relationships??net.relationships.length)+' driving links. Parallel branches are retained; use the predecessor and successor columns to follow the actual sequence.</p>'+diagnosisTable(d,'network',net.rows,[['sequence','Order'],['activityId','Activity ID'],['name','Activity'],['wbs','WBS'],['calculatedStartIso','Calculated start'],['calculatedFinishIso','Calculated finish'],['remainingDurationHours','Remaining hours'],['totalFloatHours','Source float · h'],['previousFinishMovementCalendarDays','Movement · elapsed days'],['drivingPredecessors','Driving predecessors / link / lag'],['drivingSuccessors','Driving successors / link / lag']]);
 const actions=d.actions.map(r=>{const grouped=Number(r.groupedCount||1)>1,title=grouped?(r.rank+'. '+fmt(r.groupedCount)+' related activities'):(r.rank+'. '+r.activityId+' · '+r.name),detail=grouped?'<details><summary>View activity IDs</summary><p>'+escapeHtml((r.activityIds||[]).slice(0,40).join('; '))+((r.activityIds||[]).length>40?' · '+fmt(r.activityIds.length-40)+' more':'')+'</p></details>':'';return '<article class="diagnosis-action"><h5>'+escapeHtml(title)+'</h5><p>'+escapeHtml(grouped?(fmt(r.wbsGroupCount||1)+' WBS group'+((r.wbsGroupCount||1)===1?'':'s')):r.wbs)+'</p><p><b>'+escapeHtml(r.reason)+'</b></p>'+(r.previousPredecessorSlippage&&!grouped?'<p>'+escapeHtml(r.previousPredecessorSlippage)+'</p>':'')+(r.linkedEvidence?'<p>'+escapeHtml(r.linkedEvidence)+'</p>':'')+'<p>'+escapeHtml(r.action)+'</p>'+detail+'</article>';}).join('');
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
