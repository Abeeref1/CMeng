export const projectActionsStyles=String.raw`
.action-summary{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0;color:#4a5e72}.project-action-list{display:grid;gap:12px}.project-action{border:1px solid #d6e1eb;border-left:4px solid #b57a26;border-radius:9px;background:#fff;padding:18px;scroll-margin-top:110px}.project-action h4{margin:0 0 8px;font-size:17px}.project-action p{margin:7px 0;line-height:1.5}.project-action footer{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}.action-filters{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.action-filters input{flex:1;min-width:180px}.action-filters input,.action-filters select,.project-action select,.project-action input[type="text"],.project-action input[type="date"],.project-action input[type="file"]{padding:10px;border:1px solid #bdcbd8;border-radius:7px;font:inherit;background:#fff}.project-action-count{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:10px;background:#fff0d5;color:#6f4616}.action-notification{font-size:13px;color:#7a541c;margin:0 0 12px}.project-action small{color:#546c81}.action-resolution{display:grid;gap:9px;margin-top:12px;padding:12px;border:1px solid #e1e8ef;border-radius:8px;background:#fbfdff}.action-resolution-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px}.action-resolution label{display:grid;gap:5px;font-size:11px;font-weight:750;color:#5b6d80}.action-resolution .btn{justify-self:start}.action-inline-message{min-height:18px;font-size:12px;color:#526579}.action-information{border-left-color:#9aa8b5;background:#fbfcfd}.action-information .action-resolution{display:none}
`;
export const projectActionsScript=String.raw`
let projectActionState=null,projectActionRequest=0,projectActionSearch='',projectActionFilter='all',projectActionPage=0;
function actionStateCurrent(){return projectActionState?.projectId===project();}
function updateActionIndicator(){
 const button=el('openProjectActions');if(!button)return;
 const ready=actionStateCurrent()&&projectActionState.status==='ready';
 button.disabled=!overview;button.innerHTML='Actions required'+(ready?' <span class="project-action-count">'+fmt(projectActionState.data.actionCount)+'</span>':'');
 const notice=el('projectActionNotification');if(notice){
  const a=projectActionState?.data?.analysis;
  const position=a?.state==='analysed'?'Project analysed · '+fmt(a.activityCount)+' activities recognised · Data Date '+planningShortDate(a.dataDateIso):a?.state==='programme_selection_needed'?'Programme read · one confirmation may be needed':'Project records loaded';
  notice.textContent=ready?position+(projectActionState.data.actionCount?' · '+projectActionState.data.actionCount+' action'+(projectActionState.data.actionCount===1?'':'s')+' need your input':' · No user action required'):(actionStateCurrent()&&projectActionState.status==='error'?'Actions could not be refreshed. Open Actions required to retry.':'Checking the latest project position…');
 }
 const navCount=el('projectActionNavCount');if(navCount)navCount.textContent=ready?String(projectActionState.data.actionCount):'…';
}
function resetProjectActions(){projectActionRequest++;projectActionState=null;projectActionSearch='';projectActionFilter='all',projectActionPage=0;updateActionIndicator();}
async function loadProjectActions(){
 if(!overview)return;
 const owner=project(),seq=++projectActionRequest,projectSeq=projectRequestSeq;
 projectActionState={projectId:owner,status:'loading',data:actionStateCurrent()?projectActionState?.data:null};updateActionIndicator();
 try{const data=await api('/api/projects/'+encodeURIComponent(owner)+'/actions');if(seq!==projectActionRequest||!projectRequestIsCurrent(owner,projectSeq))return;if(data.projectId!==owner)throw new Error('The action list belongs to a different project.');projectActionState={projectId:owner,status:'ready',data};}
 catch(e){if(seq!==projectActionRequest||!projectRequestIsCurrent(owner,projectSeq))return;projectActionState={projectId:owner,status:'error',message:e.message};}
 updateActionIndicator();for(const id of ['projectActionPanel','projectReviewPanel']){const panel=el(id);if(panel){panel.innerHTML=renderProjectActionList();bindProjectActions(panel);}}
}
function renderActionFindings(a,expanded=false){
 const readable=value=>typeof readerText==='function'?readerText(value):String(value??'');
 const reference=value=>typeof readerReference==='function'?readerReference(value):readable(value);
 const rows=(a.findings||[]).map(i=>{const r=readerIssue(i);return '<details'+(expanded?' open':'')+'><summary>'+escapeHtml(r.title||i.summary)+'</summary><p>'+escapeHtml(readable(i.detail))+'</p><p><b>Next step:</b> '+escapeHtml(readable(r.action||i.action))+'</p><p>Affects: '+escapeHtml(i.moduleKeys.map(k=>names[k]||k).join(', '))+'</p>'+(!a.correctionRecords?.length&&i.sourceRefs.length?'<p>Supporting records: '+escapeHtml(i.sourceRefs.map(reference).join('; '))+'</p>':'')+'</details>';}).join('');
 return (a.completionPosition?renderCompletionPosition(a.completionPosition,true):'')+rows;
}
function programmePurposeOptions(current='update'){
 return [['update','Progress update'],['baseline','Approved baseline'],['revised_baseline','Approved revised baseline'],['recovery','Recovery plan'],['scenario','Draft / scenario']].map(([value,label])=>'<option value="'+value+'" '+(value===current?'selected':'')+'>'+label+'</option>').join('');
}
function actionResolutionHtml(a){
 const t=a.target||{},r=a.resolution||{};
 if(!r.requiresUserAction)return '';
 if(t.type==='module')return '<div class="action-resolution"><button class="btn" data-action-module="'+escapeHtml(t.moduleKey)+'">'+escapeHtml(t.label||'Open supporting record')+'</button></div>';
 if(t.type==='inline'&&t.kind==='boq-numeric-review')return '<div class="action-resolution"><button class="btn primary" data-boq-numeric-review>Review BOQ readings together</button><p>One saved review updates all affected views. Native values and previously confirmed readings are not requested again.</p></div>';
 if(t.type==='schedule'){
  if(t.needsPurpose)return '<div class="action-resolution"><p>'+escapeHtml(r.instruction||'Confirm the programme purpose and use it for reporting.')+'</p><div class="action-resolution-grid"><label>Programme purpose<select class="action-schedule-role">'+programmePurposeOptions(t.scheduleRole||'update')+'</select></label><label>Baseline approval reference<input type="text" class="action-schedule-approval" placeholder="Required only for approved baseline / revised baseline"></label></div><button class="btn primary" data-resolve-schedule="'+escapeHtml(a.id)+'">Confirm and use programme</button><p class="action-inline-message" role="status"></p></div>';
  return '<div class="action-resolution"><p>'+escapeHtml(r.instruction||'Confirm this programme for reporting.')+'</p><button class="btn primary" data-resolve-schedule="'+escapeHtml(a.id)+'">'+escapeHtml(t.label||'Use this programme')+'</button><p class="action-inline-message" role="status"></p></div>';
 }
 if(t.type==='document'){
  const options=(t.relationshipOptions||[]).map(o=>'<option value="'+escapeHtml(o.value)+'">'+escapeHtml(o.label)+'</option>').join('');
  const targets=(t.relationshipTargets||[]).map(x=>'<option value="'+escapeHtml(x.documentId)+'">'+escapeHtml(x.filename)+'</option>').join('');
  return '<div class="action-resolution"><p>'+escapeHtml(r.instruction||'Choose how this document updates the Project.')+'</p><div class="action-resolution-grid"><label>Document relationship<select class="action-document-kind">'+options+'</select></label><label class="action-document-target-label" hidden>Related current document<select class="action-document-target"><option value="">Choose document</option>'+targets+'</select></label></div><button class="btn primary" data-resolve-document="'+escapeHtml(a.id)+'">Confirm relationship</button><p class="action-inline-message" role="status"></p></div>';
 }
 if(t.type==='upload'){
  const schedule=t.uploadMode==='schedule';
  return '<div class="action-resolution"><p>'+escapeHtml(r.instruction||'Upload the evidence needed to complete this action.')+'</p><div class="action-resolution-grid"><label>'+escapeHtml(t.uploadHint||'Evidence')+'<input type="file" class="action-upload-file" '+(schedule?'accept=".xer,.xml,.xlsx,.xlsm,.csv"':'accept=".zip,.csv,.pdf,.docx,.xlsx,.xlsm,.xer,.xml,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp"')+'></label>'+(schedule?'<label>Programme purpose<select class="action-upload-role">'+programmePurposeOptions(t.scheduleRole||'update')+'</select></label><label>Baseline approval reference<input type="text" class="action-upload-approval" placeholder="Required only for baseline / revised baseline"></label>':'')+'</div><button class="btn primary" data-resolve-upload="'+escapeHtml(a.id)+'">'+escapeHtml(t.label||'Upload evidence')+'</button><p class="action-inline-message" role="status"></p></div>';
 }
 if(t.type==='delivery'&&t.population)return '<div class="action-resolution"><p>'+escapeHtml(r.instruction||'Confirm that the current records are the complete reporting population.')+'</p><button class="btn primary" data-resolve-population="'+escapeHtml(a.id)+'">'+escapeHtml(t.label||'Confirm complete population')+'</button><p class="action-inline-message" role="status"></p></div>';
 if(t.type==='inline'&&t.kind==='contract-completion'){
  const candidate=typeof t.suggestedDateIso==='string'?t.suggestedDateIso.slice(0,10):'';
  const candidateNote=candidate?'<p><b>Suggested candidate:</b> '+escapeHtml(planningShortDate(candidate))+' from the current submitted programme finish. This is not treated as contractual unless you confirm it.</p>':'';
  return '<div class="action-resolution"><p>'+escapeHtml(r.instruction||'Confirm the contractual completion date.')+'</p>'+candidateNote+'<div class="action-resolution-grid"><label>Contractual completion date<input type="date" class="action-contract-completion-date" value="'+escapeHtml(candidate)+'"></label></div><button class="btn primary" data-resolve-contract-completion="'+escapeHtml(a.id)+'">'+escapeHtml(t.label||'Confirm contractual completion date')+'</button><p class="action-inline-message" role="status"></p></div>';
 }
 return '';
}
function renderProjectActionList(){
 if(!actionStateCurrent()||projectActionState.status==='loading')return '<p role="status">Checking actions required…</p>';
 if(projectActionState.status==='error')return '<p role="alert">Actions could not be refreshed. '+escapeHtml(projectActionState.message)+'</p><button class="btn" data-action-refresh>Try again</button>';
 const data=projectActionState.data,items=data.actions||[];
 const filtered=items.filter(a=>(projectActionFilter==='all'||a.category===projectActionFilter)&&((a.title+' '+a.reason).toLowerCase().includes(projectActionSearch.toLowerCase())));
 const article=(a,information=false)=>'<article class="project-action '+(information?'action-information':'')+'" data-action-id="'+escapeHtml(a.id)+'"><h4>'+escapeHtml(a.title)+'</h4><p>'+escapeHtml(a.reason)+'</p>'+('<p><b>Responsible role:</b> '+escapeHtml(a.owner||'PMC Project Controls Manager')+'</p>')+(a.category==='follow_up'&&a.dueIso?'<p><b>Due:</b> '+escapeHtml(planningShortDate(a.dueIso))+'</p>':'')+(a.missingFields?.length?'<p><b>Information needed:</b> '+a.missingFields.map(row=>escapeHtml(row.field+' · '+row.file+' · '+row.owner)).join('; ')+'</p>':'')+(!information&&a.resolution?.instruction?'<p><b>What you need to do:</b> '+escapeHtml(a.resolution.instruction)+'</p>':'')+(a.correctionRecords?.length?'<p><b>Records to correct:</b> '+a.correctionRecords.map(row=>escapeHtml(row.source+' · '+row.locator)).join('; ')+'</p>':'')+(!information?actionResolutionHtml(a):'')+((a.completionPosition||a.findings?.length)?'<details class="review-inline"'+(a.resolution?.kind==='upload'||information&&a.completionPosition?' open':'')+'><summary>'+(a.resolution?.kind==='upload'?'Fields and correction details':'Supporting information')+'</summary>'+renderActionFindings(a,a.resolution?.kind==='upload')+'</details>':'')+(a.affectedPages?.length?'<small>Affects '+fmt(a.affectedPages.length)+' view'+(a.affectedPages.length===1?'':'s')+' · supporting findings retained</small>':'')+'</article>';
 return '<div class="action-summary"><b>'+fmt(data.actionCount)+' action'+(data.actionCount===1?'':'s')+' require your input</b><small>Checked '+escapeHtml(formatDocumentTime(data.checkedAt))+'</small><button class="btn small" data-action-refresh>Refresh</button><button class="btn small" data-action-close>Close</button></div><p>Confirm source decisions here and follow up the ranked register records with their responsible owners.</p><div class="action-filters"><input class="project-action-search" aria-label="Find an action" placeholder="Find an action or document" value="'+escapeHtml(projectActionSearch)+'"><select class="project-action-filter" aria-label="Action type">'+[['all','All actions'],['confirmation','Confirm / choose'],['review','Source correction'],['follow_up','Record follow-up']].map(([value,label])=>'<option value="'+value+'" '+(projectActionFilter===value?'selected':'')+'>'+label+'</option>').join('')+'</select></div><div class="project-action-list">'+filtered.slice(projectActionPage*25,(projectActionPage+1)*25).map(a=>article(a,false)).join('')+'</div>'+(filtered.length>25?'<p><button class="btn small" data-action-page="-1" '+(projectActionPage===0?'disabled':'')+'>Previous</button> '+fmt(projectActionPage*25+1)+'–'+fmt(Math.min((projectActionPage+1)*25,filtered.length))+' of '+fmt(filtered.length)+' <button class="btn small" data-action-page="1" '+((projectActionPage+1)*25>=filtered.length?'disabled':'')+'>Next</button></p>':'')+(!filtered.length?'<p>'+(items.length?'No actions match this filter.':'No user action is required for the current Project position.')+'</p>':'')+(data.information?.length?'<details class="review-inline"><summary>Data gaps · '+fmt(data.information.length)+'</summary><p>These source fields are not established. Their available source figures remain visible. Items without a direct correction route are listed here.</p>'+(data.information||[]).map(a=>article(a,true)).join('')+'</details>':'')+(data.systemCheckCount?'<p>'+fmt(data.systemCheckCount)+' CMeng calculation/check item'+(data.systemCheckCount===1?' is':'s are')+' tracked separately and require no user input.</p>':'');
}
function actionNode(id){return document.querySelector('[data-action-id="'+CSS.escape(id)+'"]');}
function actionMessage(id,text){const node=actionNode(id)?.querySelector('.action-inline-message');if(node)node.textContent=text;}
function setActionBusy(id,busy){actionNode(id)?.querySelectorAll('button,input,select').forEach(node=>node.disabled=busy);}
async function resolveScheduleAction(id){
 if(!actionStateCurrent()||projectActionState.status!=='ready')return;
 const owner=project(),version=projectActionState.data.projectVersion,a=projectActionState.data.actions.find(x=>x.id===id);if(!a)return;
 const t=a.target,node=actionNode(id);setActionBusy(id,true);actionMessage(id,'Saving programme selection…');
 try{
  if(t.needsPurpose){
   const role=node.querySelector('.action-schedule-role').value,approval=node.querySelector('.action-schedule-approval').value.trim();
   if(['baseline','revised_baseline'].includes(role)&&!approval)throw new Error('Enter the baseline approval reference.');
   const purposePath='/api/projects/'+encodeURIComponent(owner)+(t.phaseId?'/phases/'+encodeURIComponent(t.phaseId):'')+'/schedule/revisions/'+encodeURIComponent(t.revisionId)+'/purpose';
   await api(purposePath,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:version,sourceHash:t.sourceHash,role,approvalReference:approval})});
   const adoptPath=t.phaseId?'/api/projects/'+encodeURIComponent(owner)+'/phases/'+encodeURIComponent(t.phaseId)+'/schedule/revisions/'+encodeURIComponent(t.revisionId)+'/adopt':'/api/projects/'+encodeURIComponent(owner)+'/schedule/revisions/'+encodeURIComponent(t.revisionId)+'/adopt';
   await api(adoptPath,{method:'POST'});
  }else{
   await api('/api/projects/'+encodeURIComponent(owner)+'/actions/confirm-schedule',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:version,actionId:id})});
  }
  if(project()===owner)await refresh(false);
 }catch(e){actionMessage(id,e.message);setActionBusy(id,false);}
}
async function resolveDocumentAction(id){
 if(!actionStateCurrent()||projectActionState.status!=='ready')return;
 const owner=project(),version=projectActionState.data.projectVersion,a=projectActionState.data.actions.find(x=>x.id===id);if(!a)return;
 const t=a.target,node=actionNode(id),kind=node.querySelector('.action-document-kind').value,target=node.querySelector('.action-document-target')?.value||'';
 if(kind!=='new_record'&&!target){actionMessage(id,'Choose the current document this replaces or amends.');return;}
 setActionBusy(id,true);actionMessage(id,'Saving document relationship…');
 try{
  await api('/api/projects/'+encodeURIComponent(owner)+'/evidence/documents/'+encodeURIComponent(t.documentId)+'/relationship',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:version,sourceHash:t.sourceHash,kind,targetDocumentId:kind==='new_record'?null:target,note:'Confirmed in Actions required: '+kind.replaceAll('_',' ')})});
  if(project()===owner)await refresh(false);
 }catch(e){actionMessage(id,e.message);setActionBusy(id,false);}
}
async function resolveUploadAction(id){
 if(!actionStateCurrent()||projectActionState.status!=='ready')return;
 const owner=project(),a=projectActionState.data.actions.find(x=>x.id===id);if(!a)return;
 const t=a.target,node=actionNode(id),file=node.querySelector('.action-upload-file')?.files?.[0];
 if(!file){actionMessage(id,'Choose a file to upload.');return;}
 setActionBusy(id,true);actionMessage(id,'Uploading and updating the Project position…');
 try{
  const headers={'content-type':fileType(file),'x-source-filename':file.name,'x-source-relative-path':file.webkitRelativePath||file.name,'x-rerun-after-upload':'true'};
  let path='/api/projects/'+encodeURIComponent(owner)+'/evidence/uploads';
  if(t.uploadMode==='schedule'){
   const role=node.querySelector('.action-upload-role')?.value||'update',approval=node.querySelector('.action-upload-approval')?.value.trim()||'';
   if(['baseline','revised_baseline'].includes(role)&&!approval)throw new Error('Enter the baseline approval reference.');
   path=t.phaseId?'/api/projects/'+encodeURIComponent(owner)+'/phases/'+encodeURIComponent(t.phaseId)+'/schedule/uploads':'/api/projects/'+encodeURIComponent(owner)+'/schedule/uploads';
   Object.assign(headers,{'x-upload-intent':'replace_current_basis','x-schedule-role':role,'x-schedule-role-confirmed':'1'});
   if(approval)headers['x-approval-reference']=approval;
  }else Object.assign(headers,{'x-upload-intent':'add_update'});
  await api(path,{method:'POST',headers,body:file});
  if(project()===owner)await refresh(false);
 }catch(e){actionMessage(id,e.message);setActionBusy(id,false);}
}
async function resolveContractCompletionAction(id){
 if(!actionStateCurrent()||projectActionState.status!=='ready')return;
 const owner=project(),version=projectActionState.data.projectVersion,a=projectActionState.data.actions.find(x=>x.id===id);if(!a)return;
 const node=actionNode(id),date=node?.querySelector('.action-contract-completion-date')?.value||'';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){actionMessage(id,'Enter the contractual completion date.');return;}
 setActionBusy(id,true);actionMessage(id,'Saving contractual completion date…');
 try{
  await api('/api/projects/'+encodeURIComponent(owner)+'/actions/confirm-contract-completion',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:version,actionId:id,dateIso:date})});
  if(project()===owner)await refresh(false);
 }catch(e){actionMessage(id,e.message);setActionBusy(id,false);}
}
async function resolvePopulationAction(id){
 if(!actionStateCurrent()||projectActionState.status!=='ready')return;
 const owner=project(),version=projectActionState.data.projectVersion,a=projectActionState.data.actions.find(x=>x.id===id);if(!a)return;
 setActionBusy(id,true);actionMessage(id,'Saving confirmation…');
 try{
  await api('/api/projects/'+encodeURIComponent(owner)+'/delivery/records',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:version,action:'confirm_population',kind:a.target.kind,note:'Confirmed complete population in Actions required.'})});
  if(project()===owner)await refresh(false);
 }catch(e){actionMessage(id,e.message);setActionBusy(id,false);}
}
async function openProjectActions(){
 if(!overview)return;
 const drawer=el('projectReviewDrawer');drawer.hidden=false;drawer.open=true;
 await loadProjectActions();drawer.scrollIntoView({block:'start'});
}
function bindProjectActions(root){
 root.querySelectorAll('[data-action-page]').forEach(b=>b.onclick=()=>{projectActionPage=Math.max(0,projectActionPage+Number(b.dataset.actionPage));root.innerHTML=renderProjectActionList();bindProjectActions(root);});
 root.querySelectorAll('[data-action-module]').forEach(b=>b.onclick=()=>{const drawer=el('projectReviewDrawer');if(drawer){drawer.open=false;drawer.hidden=true;}selected=b.dataset.actionModule;localStorage.setItem('cmeng-module',selected);renderNav();loadModule(selected);});
 root.querySelectorAll('[data-boq-numeric-review]').forEach(b=>b.onclick=()=>openBoqNumericReview());
 root.querySelectorAll('[data-resolve-schedule]').forEach(b=>b.onclick=()=>resolveScheduleAction(b.dataset.resolveSchedule));
 root.querySelectorAll('[data-resolve-document]').forEach(b=>b.onclick=()=>resolveDocumentAction(b.dataset.resolveDocument));
 root.querySelectorAll('[data-resolve-upload]').forEach(b=>b.onclick=()=>resolveUploadAction(b.dataset.resolveUpload));
 root.querySelectorAll('[data-resolve-population]').forEach(b=>b.onclick=()=>resolvePopulationAction(b.dataset.resolvePopulation));
 root.querySelectorAll('[data-resolve-contract-completion]').forEach(b=>b.onclick=()=>resolveContractCompletionAction(b.dataset.resolveContractCompletion));
 root.querySelectorAll('.action-document-kind').forEach(select=>select.onchange=()=>{const label=select.closest('.action-resolution').querySelector('.action-document-target-label');if(label)label.hidden=select.value==='new_record';});
 root.querySelectorAll('[data-action-refresh]').forEach(b=>b.onclick=()=>loadProjectActions());
 root.querySelectorAll('[data-action-close]').forEach(b=>b.onclick=()=>{const drawer=el('projectReviewDrawer');drawer.open=false;drawer.hidden=true;el('moduleContent')?.scrollIntoView({block:'start'});});
 const search=root.querySelector('.project-action-search');if(search)search.oninput=()=>{projectActionSearch=search.value;projectActionPage=0;const start=search.selectionStart;root.innerHTML=renderProjectActionList();bindProjectActions(root);const input=root.querySelector('.project-action-search');input?.focus();input?.setSelectionRange(start,start);};
 const filter=root.querySelector('.project-action-filter');if(filter)filter.onchange=()=>{projectActionFilter=filter.value;projectActionPage=0;root.innerHTML=renderProjectActionList();bindProjectActions(root);};
}
`;
