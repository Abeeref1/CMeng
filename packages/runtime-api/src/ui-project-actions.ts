export const projectActionsStyles=String.raw`
.action-summary{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0;color:#4a5e72}.project-action-list{display:grid;gap:12px}.project-action{border:1px solid #d6e1eb;border-left:4px solid #b57a26;border-radius:9px;background:#fff;padding:18px;scroll-margin-top:110px}.project-action h4{margin:0 0 8px;font-size:17px}.project-action p{margin:7px 0;line-height:1.5}.project-action footer{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}.action-filters{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.action-filters input{flex:1;min-width:180px}.action-filters input,.action-filters select{padding:10px;border:1px solid #bdcbd8;border-radius:7px;font:inherit}.project-action-count{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:10px;background:#fff0d5;color:#6f4616}.action-notification{font-size:13px;color:#7a541c;margin:0 0 12px}.project-action-target{outline:3px solid #c39b54;outline-offset:3px}.project-action small{color:#546c81}
`;
export const projectActionsScript=String.raw`
let projectActionState=null,projectActionRequest=0,projectActionSearch='',projectActionFilter='all';
function actionStateCurrent(){return projectActionState?.projectId===project();}
function updateActionIndicator(){
 const button=el('openProjectActions');if(!button)return;
 const ready=actionStateCurrent()&&projectActionState.status==='ready';
 button.disabled=!overview;button.innerHTML='Project review'+(ready?' <span class="project-action-count">'+fmt(projectActionState.data.actionCount)+'</span>':'');
 const notice=el('projectActionNotification');if(notice){
  const a=projectActionState?.data?.analysis;
  const position=a?.state==='analysed'?'Project analysed · '+fmt(a.activityCount)+' activities recognised · Data Date '+planningShortDate(a.dataDateIso):a?.state==='programme_selection_needed'?'Programme read · select the reporting schedule in Project review':'Project records loaded';
  notice.textContent=ready?position+(projectActionState.data.actionCount?' · '+projectActionState.data.actionCount+' matters need review':' · No outstanding decisions in the current checks'):(actionStateCurrent()&&projectActionState.status==='error'?'Project review could not be refreshed. Open Project review to retry.':'Checking the latest project position…');
 }

 const navCount=el('projectActionNavCount');if(navCount)navCount.textContent=ready?String(projectActionState.data.actionCount):'…';
}
function resetProjectActions(){projectActionRequest++;projectActionState=null;projectActionSearch='';projectActionFilter='all';updateActionIndicator();}
async function loadProjectActions(){
 if(!overview)return;
 const owner=project(),seq=++projectActionRequest,projectSeq=projectRequestSeq;
 projectActionState={projectId:owner,status:'loading',data:actionStateCurrent()?projectActionState?.data:null};updateActionIndicator();
 try{const data=await api('/api/projects/'+encodeURIComponent(owner)+'/actions');if(seq!==projectActionRequest||!projectRequestIsCurrent(owner,projectSeq))return;if(data.projectId!==owner)throw new Error('The action list belongs to a different project.');projectActionState={projectId:owner,status:'ready',data};}
 catch(e){if(seq!==projectActionRequest||!projectRequestIsCurrent(owner,projectSeq))return;projectActionState={projectId:owner,status:'error',message:e.message};}
 updateActionIndicator();for(const id of ['projectActionPanel','projectReviewPanel']){const panel=el(id);if(panel){panel.innerHTML=renderProjectActionList();bindProjectActions(panel);}}
}
function renderActionFindings(a){
 const rows=(a.findings||[]).map(i=>{const r=readerIssue(i);return '<details><summary>'+escapeHtml(r.title||i.summary)+'</summary><p>'+escapeHtml(i.detail)+'</p><p><b>What is needed:</b> '+escapeHtml(r.action||i.action)+'</p><p>Affects: '+escapeHtml(i.moduleKeys.map(k=>names[k]||k).join(', '))+'</p>'+(i.sourceRefs.length?'<p>Sources: '+escapeHtml(i.sourceRefs.join('; '))+'</p>':'')+'</details>';}).join('');
 return (a.completionPosition?renderCompletionPosition(a.completionPosition,true):'')+rows;
}
function renderProjectActionList(){
 if(!actionStateCurrent()||projectActionState.status==='loading')return '<p role="status">Checking the latest project review…</p>';
 if(projectActionState.status==='error')return '<p role="alert">Project review could not be refreshed. '+escapeHtml(projectActionState.message)+'</p><button class="btn" data-action-refresh>Try again</button>';
 const data=projectActionState.data,items=data.actions;
 const filtered=items.filter(a=>(projectActionFilter==='all'||a.category===projectActionFilter)&&((a.title+' '+a.reason).toLowerCase().includes(projectActionSearch.toLowerCase())));
 const article=a=>'<article class="project-action" data-action-id="'+escapeHtml(a.id)+'"><h4>'+escapeHtml(a.title)+'</h4><p>'+escapeHtml(a.reason)+'</p>'+
  (a.target.type==='inline'?'<details class="review-inline"><summary>'+escapeHtml(a.target.label)+'</summary>'+renderActionFindings(a)+'</details>':'<footer><button class="btn primary" data-project-action="'+escapeHtml(a.id)+'">'+escapeHtml(a.target.label)+'</button>'+(a.target.type==='schedule'&&a.target.canConfirm?'<button class="btn" data-project-action-review="'+escapeHtml(a.id)+'">Review schedule first</button>':'')+'</footer>')+
  (a.affectedPages?.length?'<small>One matter affecting '+fmt(a.affectedPages.length)+' pages · all '+fmt(a.requestCount)+' supporting findings retained</small>':'')+'</article>';
 return '<div class="action-summary"><b>'+fmt(data.actionCount)+' matters to review</b><small>Checked '+escapeHtml(formatDocumentTime(data.checkedAt))+'</small><button class="btn small" data-action-refresh>Refresh review</button><button class="btn small" data-action-close>Return to answer</button></div><p>Resolve document decisions here. Review differences without leaving your answer. Missing optional information is listed separately below.</p><div class="action-filters"><input class="project-action-search" aria-label="Find a project matter" placeholder="Find a matter or document" value="'+escapeHtml(projectActionSearch)+'"><select class="project-action-filter" aria-label="Review type">'+[['all','All matters'],['confirmation','Decisions'],['review','Differences and checks'],['information','Information needed']].map(([value,label])=>'<option value="'+value+'" '+(projectActionFilter===value?'selected':'')+'>'+label+'</option>').join('')+'</select></div><p class="project-action-message" role="status"></p><div class="project-action-list">'+filtered.map(article).join('')+'</div>'+(!filtered.length?'<p>'+(items.length?'No matters match this filter.':'No outstanding user decisions in the current checks.')+'</p>':'')+
  '<details class="review-inline"><summary>Other information not yet available · '+fmt(data.information?.length||0)+' groups</summary><p>These are limits on the relevant measures, not tasks you must complete to use the available project analysis.</p>'+(data.information||[]).map(article).join('')+'</details>'+
  (data.systemCheckCount?'<p>'+fmt(data.systemCheckCount)+' CMeng checks are tracked separately. They do not require you to supply a document unless a specific missing input is identified.</p>':'');
}
async function openProjectActions(){
 if(!overview)return;
 const drawer=el('projectReviewDrawer');drawer.hidden=false;drawer.open=true;
 await loadProjectActions();drawer.scrollIntoView({block:'start'});
}

async function openActionDocument(target){
 if(target.phaseId){await loadPhaseProgrammes();const drawer=el('evidenceControlDrawer');drawer.hidden=false;drawer.open=true;el('phaseProgrammesPanel')?.scrollIntoView({block:'center'});return;}
 const owner=project();await loadEvidence();if(project()!==owner)return;
 const drawer=el('evidenceLibraryDrawer');drawer.hidden=false;drawer.open=true;
 const input=[...el('evidenceLibrary').querySelectorAll('.evidence-select')].find(x=>x.dataset.documentId===target.documentId),row=input?.closest('tr');
 if(row){row.classList.add('project-action-target');row.scrollIntoView({block:'center'});const relation=row.querySelector('.document-relationship');if(relation)relation.click();}
 else drawer.scrollIntoView({block:'start'});
}
async function followProjectAction(id,reviewOnly=false){
 if(!actionStateCurrent()||projectActionState.status!=='ready')return;
 const owner=project(),version=projectActionState.data.projectVersion,a=projectActionState.data.actions.find(a=>a.id===id);if(!a)return;
 const target=a.target,message=el('projectReviewPanel')?.querySelector('.project-action-message');
 try{
   if(target.type==='schedule'){
     if(reviewOnly||!target.canConfirm){await openActionDocument(target);return;}
     document.querySelectorAll('[data-project-action]').forEach(b=>b.disabled=true);if(message)message.textContent='Saving your reporting schedule selection…';
     await api('/api/projects/'+encodeURIComponent(owner)+'/actions/confirm-schedule',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:version,actionId:id})});if(project()===owner){await refresh(false);const result=el('projectReviewPanel')?.querySelector('.project-action-message');if(result)result.textContent='Reporting schedule confirmed. The action list is up to date.';}return;
   }
   if(target.type==='document'){await openActionDocument(target);return;}
   if(target.type==='upload'){el('openEvidenceTop').click();if(target.phaseId){el('scheduleScope').value='phase';el('schedulePhase').value=target.phaseId;}el('scheduleFiles')?.focus();return;}
   selected=target.moduleKey;localStorage.setItem('cmeng-module',selected);setAppView('project');await loadModule(selected);if(project()!==owner||selected!==target.moduleKey)return;
   if(target.type==='delivery'&&el('deliveryReviewPanel')){el('deliveryReviewPanel').open=true;el('deliveryKind').value=target.kind;await deliveryBrowseRecords();if(project()===owner){el('deliveryReviewPanel').scrollIntoView({block:'start'});if(target.population)el('deliveryConfirmPopulation').focus();}}
 }catch(e){if(project()!==owner)return;await loadProjectActions();const result=el('projectReviewPanel')?.querySelector('.project-action-message');if(result)result.textContent=e.message;}
}
function bindProjectActions(root){
 root.querySelectorAll('[data-project-action]').forEach(b=>b.onclick=()=>followProjectAction(b.dataset.projectAction));
 root.querySelectorAll('[data-project-action-review]').forEach(b=>b.onclick=()=>followProjectAction(b.dataset.projectActionReview,true));
 root.querySelectorAll('[data-action-refresh]').forEach(b=>b.onclick=()=>loadProjectActions());
 root.querySelectorAll('[data-action-close]').forEach(b=>b.onclick=()=>{const drawer=el('projectReviewDrawer');drawer.open=false;drawer.hidden=true;el('moduleContent')?.scrollIntoView({block:'start'});});
 const search=root.querySelector('.project-action-search');if(search)search.oninput=()=>{projectActionSearch=search.value;const start=search.selectionStart;root.innerHTML=renderProjectActionList();bindProjectActions(root);const input=root.querySelector('.project-action-search');input?.focus();input?.setSelectionRange(start,start);};
 const filter=root.querySelector('.project-action-filter');if(filter)filter.onchange=()=>{projectActionFilter=filter.value;root.innerHTML=renderProjectActionList();bindProjectActions(root);};
}
`;
