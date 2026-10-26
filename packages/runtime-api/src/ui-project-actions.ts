import {ownerDisplayState} from './action-priority';
export const projectActionsStyles=String.raw`
.action-summary{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0;color:#4a5e72}.project-action-list{display:grid;gap:12px}.project-action{border:1px solid #d6e1eb;border-left:4px solid #b57a26;border-radius:9px;background:#fff;padding:18px;scroll-margin-top:110px}.project-action h4{margin:0 0 8px;font-size:17px}.project-action p{margin:7px 0;line-height:1.5}.project-action footer{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}.action-filters{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.action-filters input{flex:1;min-width:180px}.action-filters input,.action-filters select,.project-action select,.project-action input[type="text"],.project-action input[type="date"],.project-action input[type="file"]{padding:10px;border:1px solid #bdcbd8;border-radius:7px;font:inherit;background:#fff}.project-action-count{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:10px;background:#fff0d5;color:#6f4616}.action-notification{font-size:13px;color:#7a541c;margin:0 0 12px}.project-action small{color:#546c81}.action-resolution{display:grid;gap:9px;margin-top:12px;padding:12px;border:1px solid #e1e8ef;border-radius:8px;background:#fbfdff}.action-resolution-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px}.action-resolution label{display:grid;gap:5px;font-size:11px;font-weight:750;color:#5b6d80}.action-resolution .btn{justify-self:start}.action-inline-message{min-height:18px;font-size:12px;color:#526579}.action-information{border-left-color:#9aa8b5;background:#fbfcfd}.action-information .action-resolution{display:none}.action-information.action-review-recorded .action-resolution{display:grid}.action-findings-preview{margin:12px 0;padding:13px 16px;border-radius:8px;background:#f5f8fc;border:1px solid #dce5ee;font-size:13px;line-height:1.55}.action-correction-note{font-size:13px;line-height:1.55}.review-evidence{border:1px solid #d6e2ef;background:#f6f9fd;padding:12px 16px;margin:12px 0;border-radius:8px;line-height:1.6}.review-evidence li{margin:6px 0}.review-matrix{width:100%;min-height:90px}.action-follow-up{border-left-color:#8796a4}.action-type{display:block;font-size:12px;font-weight:700;color:#536579;margin:0 0 8px}
`;
export const projectActionsScript=String.raw`
${ownerDisplayState.toString()}
/** A missing owner is shown as missing, with its accountable role and the way to
 * set it: a named owner in the source register is always kept (pmcRoleOwner). */
/** A1: the page where a missing owner is set. A register record goes to the
 * register's own page (shared owner map); anything else to Actions and data gaps
 * (F30/A4), where the owner can be set. The document library only for a document
 * source with no register page. Never a page that is not in moduleRegistry.
 * Self-contained so the screen and the isolated checks read one rule. */
function ownerMissingHtml(owner,accountableRole=null,route=null){
 const state=ownerDisplayState(owner);
 if(!state.named&&!state.role&&typeof accountableRole==='string'&&accountableRole.trim())state.role=accountableRole.trim();
 if(state.named)return escapeHtml(owner);
 const exists=key=>!!key&&typeof moduleRegistry!=='undefined'&&Array.isArray(moduleRegistry)&&moduleRegistry.some(m=>m.key===key);
 const actions=(typeof blockOwnerEntry==='function'?blockOwnerEntry('review-items')?.owner:null)||'source-quality';
 const target=route==='documents'?'documents':exists(route)?route:exists(actions)?actions:'documents';
 let control;
 if(target==='documents')control='<button type="button" class="management-module-link" data-module="documents" data-set-owner>Name the owner in the source register</button>';
 else{
  const title=(typeof names!=='undefined'&&names?.[target])||target;
  const here=typeof currentPageKey==='function'&&(typeof appView==='undefined'||appView==='project')?currentPageKey():null;
  control=target===here?'<small data-set-owner data-owner-page="'+escapeHtml(target)+'">Set the owner on this page</small>'
   :'<button type="button" class="management-module-link" data-module="'+escapeHtml(target)+'" data-set-owner data-owner-page="'+escapeHtml(target)+'">Set the owner in '+escapeHtml(title)+'</button>';
 }
 return '<span class="owner-missing" data-owner-missing>Owner not set</span>'+(state.role?' <small>Accountable role: '+escapeHtml(state.role)+'</small>':'')+' '+control;
}
/** A4: a missing action due date is shown as missing, with the way to set it, on
 * the same page as a missing owner (ownerMissingHtml): the register's own page, or
 * Actions and data gaps (F30/A4), where owner and due date are saved together.
 * Self-contained for the same reason as ownerMissingHtml. */
function dueMissingHtml(route=null){
 const exists=key=>!!key&&typeof moduleRegistry!=='undefined'&&Array.isArray(moduleRegistry)&&moduleRegistry.some(m=>m.key===key);
 const actions=(typeof blockOwnerEntry==='function'?blockOwnerEntry('review-items')?.owner:null)||'source-quality';
 const target=route==='documents'?'documents':exists(route)?route:exists(actions)?actions:'documents';
 let control;
 if(target==='documents')control='<button type="button" class="management-module-link" data-module="documents" data-set-due>Record the due date in the source register</button>';
 else{
  const title=(typeof names!=='undefined'&&names?.[target])||target;
  const here=typeof currentPageKey==='function'&&(typeof appView==='undefined'||appView==='project')?currentPageKey():null;
  control=target===here?'<small data-set-due data-owner-page="'+escapeHtml(target)+'">Set the due date on this page</small>'
   :'<button type="button" class="management-module-link" data-module="'+escapeHtml(target)+'" data-set-due data-owner-page="'+escapeHtml(target)+'">Set the due date in '+escapeHtml(title)+'</button>';
 }
 return '<span class="due-missing" data-due-missing>Due date not set</span> '+control;
}
let projectActionState=null,projectActionRequest=0,projectActionSearch='',projectActionFilter='all',projectActionPage=0,projectDataGapsPage=0,projectActionSearchTimer=null;
function actionStateCurrent(){return projectActionState?.projectId===project();}
function updateActionIndicator(){
 const button=el('openProjectActions');if(!button)return;
 const ready=actionStateCurrent()&&projectActionState.status==='ready';
 button.disabled=!overview;button.innerHTML='Project review'+(ready?' <span class="project-action-count">'+fmt(projectActionState.data.userDecisionCount??projectActionState.data.actionCount)+'</span>':'');
 const notice=el('projectActionNotification');if(notice){
  const a=projectActionState?.data?.analysis;
  const position=a?.state==='analysed'?'Project analysed · '+countText(a.activityCount,'activity','activities',fmt)+' recognised · Data Date '+planningShortDate(a.dataDateIso):a?.state==='programme_selection_needed'?'Programme read · one confirmation may be needed':'Project records loaded';
  const count=ready?(projectActionState.data.userDecisionCount??projectActionState.data.actionCount):0;
  notice.textContent=ready?position+(count?' · '+count+' decision'+(count===1?'':'s')+' awaiting your response':' · No decisions awaiting your response'):(actionStateCurrent()&&projectActionState.status==='error'?'Project review could not be refreshed. Open Project review to retry.':'Checking the latest project position…');
 }
 const navCount=el('projectActionNavCount');if(navCount)navCount.textContent=ready?String(projectActionState.data.userDecisionCount??projectActionState.data.actionCount):'…';
}
// T05/N1: lists inside each action (findings, evidence, recorded locations,
// affected pages) are cut to 25 by the transport. Count the retained total.
function actionListTotal(list){
 if(!Array.isArray(list))return null;
 const own=typeof responseListTotalIn==='function'?responseListTotalIn(typeof projectActionState==='undefined'?null:projectActionState?.data,list):list.length;
 if(own===null||own!==list.length)return own;
 const current=typeof listTotal==='function'?listTotal(list):own;return current===null?null:Math.max(current,own);
}
function actionShownOf(list,noun){const total=actionListTotal(list);return total===list.length?fmt(total)+' '+noun:fmt(list.length)+' of '+(total===null?'Not established':fmt(total))+' '+noun;}
function resetProjectActions(){projectActionRequest++;projectActionState=null;projectActionSearch='';projectActionFilter='all';projectActionPage=0;projectDataGapsPage=0;updateActionIndicator();}
async function loadProjectActions(){
 if(!overview)return;
 const owner=project(),seq=++projectActionRequest,projectSeq=projectRequestSeq;
 projectActionState={projectId:owner,status:'loading',data:actionStateCurrent()?projectActionState?.data:null};updateActionIndicator();
 try{const query=new URLSearchParams({page:String(projectActionPage),pageSize:'25',dataGapsPage:String(projectDataGapsPage),query:projectActionSearch,category:projectActionFilter});const data=await api('/api/projects/'+encodeURIComponent(owner)+'/actions?'+query);if(seq!==projectActionRequest||!projectRequestIsCurrent(owner,projectSeq))return;if(data.projectId!==owner)throw new Error('The action list belongs to a different project.');projectActionState={projectId:owner,status:'ready',data};}
 catch(e){if(seq!==projectActionRequest||!projectRequestIsCurrent(owner,projectSeq))return;projectActionState={projectId:owner,status:'error',message:e.message};}
 updateActionIndicator();for(const id of ['projectActionPanel','projectReviewPanel']){const panel=el(id);if(panel){panel.innerHTML=renderProjectActionList();bindProjectActions(panel);}}
}
function projectReviewFinding(i){
 const code=String(i.code||''),detail=String(i.detail||''),all=(code+' '+detail+' '+i.summary).toLowerCase();
 if(/schedule.graph|broken.relationship|broken.predecessor|broken.successor|duplicate.activity/.test(all)){
   const dup=/duplicate activity ids?\s*[·: -]*([a-z0-9-]+)/i.exec(detail);
   const predecessor=/broken predecessors?[^\d]*([0-9]+)/i.exec(detail);
   const successor=/broken successors?[^\d]*([0-9]+)/i.exec(detail);
   const examples=[dup?'Repeated activity ID '+dup[1]:null,predecessor?'Missing predecessor example '+predecessor[1]:null,successor?'Missing successor example '+successor[1]:null].filter(Boolean);
   return {title:'Programme activity and logic references need checking',detail:examples.length?examples.join('. ')+'.':'Some activity IDs or relationship references are invalid.',owner:'Planning Engineer'};
 }
 if(/material.link.timing.mismatch/.test(all))return {title:'Procurement need dates and activity dates do not agree',detail:'The Procurement Manager must check each package against the activity it supports.',owner:'Procurement Manager'};
 if(/closure.before.raised.date/.test(all))return {title:'Some design or inspection records closed before they were raised',detail:'The relevant register owner must check the original raised and closure dates.',owner:'Design / Quality Manager'};
 if(/risk.rating.score.conflict/.test(all))return {title:'Equal risk scores have different ratings',detail:'The current scores and entered ratings are preserved. Confirm the approved rating basis.',owner:'Risk Manager'};
 if(/notice.period|contract.notice|noticeperiod|conflicting commercial term candidates/.test(all))return {title:'Contract notice provisions require interpretation',detail:'Compare the effective dates and values above before deciding which provision applies.',owner:'Contracts Manager'};
 const r=readerIssue(i);
 const problematic=value=>/[_]{1}|(?:[A-Z]{3,}:)|\b(?:native|data quality|source quality)\s*[·:]/i.test(String(value||''));
 return {title:problematic(r.title)?'Source record needs review':r.title||'Source record needs review',
   detail:readerText(detail||r.detail||r.action||'Review the source record.'),
   owner:r.owner||'Project Controls Manager'};
}
function renderActionFindings(a,expanded=false){
 const readable=value=>typeof readerText==='function'?readerText(value):String(value??'');
 const reference=value=>typeof readerReference==='function'?readerReference(value):readable(value);
 const unique=new Map();
 for(const i of a.findings||[]){const r=projectReviewFinding(i),key=r.title+'|'+r.detail;const group=unique.get(key)||{r,modules:new Set(),refs:new Set()};for(const mod of i.moduleKeys??[])group.modules.add(mod);for(const ref of i.sourceRefs??[])group.refs.add(ref);unique.set(key,group);}
 const rows=[...unique.values()].map(({r,modules,refs})=>'<details'+(expanded?' open':'')+'><summary>'+escapeHtml(r.title)+'</summary><p>'+escapeHtml(r.detail)+'</p><p><b>Review owner:</b> '+escapeHtml(r.owner)+'</p><p>Relevant pages: '+escapeHtml([...modules].map(k=>(typeof names==='object'&&names[k])||k.replace(/-/g,' ')).join(', '))+'</p>'+(refs.size?'<p>'+fmt(refs.size)+' source references retained for audit and the full records.</p>':'')+'</details>').join('');
 const cut=Array.isArray(a.findings)&&a.findings.length&&actionListTotal(a.findings)!==a.findings.length?'<p>'+actionShownOf(a.findings,'findings')+' are listed here. The full list is in the action export.</p>':'';
 return (a.completionPosition?renderCompletionPosition(a.completionPosition,true):'')+cut+rows;
}
function reviewFindingPreview(a){
 if(!a.findings?.length||a.evidenceSummary?.length)return '';
 const groups=new Map();
 for(const i of a.findings){const r=projectReviewFinding(i);if(!groups.has(r.title))groups.set(r.title,r);}
 const rows=[...groups.values()];
 return '<section class="review-evidence"><b>What CMeng found in the documents already provided</b><ol>'+rows.slice(0,3).map(r=>'<li><strong>'+escapeHtml(r.title)+'</strong><p>'+escapeHtml(r.detail)+'</p></li>').join('')+'</ol>'+
   (actionListTotal(a.findings)!==a.findings.length?'<small>'+actionShownOf(a.findings,'findings')+' received here; the full list is in supporting information and the action export.</small>':rows.length>3?'<small>'+fmt(rows.length-3)+' more distinct findings are in supporting information.</small>':'')+'</section>';
}
function reviewEvidenceHtml(a){
 if(!a.evidenceSummary?.length)return '';
 const rows=a.evidenceSummary.slice(0,3).map(row=>'<li>'+escapeHtml(row)+'</li>').join('');
 const rest=a.evidenceSummary.length>3?'<details><summary>'+(actionListTotal(a.evidenceSummary)===a.evidenceSummary.length?'See all '+fmt(a.evidenceSummary.length)+' findings':'See '+actionShownOf(a.evidenceSummary,'findings'))+'</summary><ol>'+a.evidenceSummary.slice(3).map(row=>'<li>'+escapeHtml(row)+'</li>').join('')+'</ol></details>':'';
 return '<section class="review-evidence"><b>What CMeng found in the documents already provided</b><ol>'+rows+'</ol>'+rest+'</section>';
}
function programmePurposeOptions(current='update'){
 return [['update','Progress update'],['baseline','Approved baseline'],['revised_baseline','Approved revised baseline'],['recovery','Recovery plan'],['scenario','Draft / scenario']].map(([value,label])=>'<option value="'+value+'" '+(value===current?'selected':'')+'>'+label+'</option>').join('');
}
function actionResolutionHtml(a){
 const t=a.target||{},r=a.resolution||{};
 if(t.type==='module')return '<div class="action-resolution"><button class="btn" data-action-module="'+escapeHtml(t.moduleKey)+'">'+escapeHtml(t.label||'Open supporting record')+'</button></div>';
 if(['review-notice','review-risk','review-procurement-date','review-risk-snapshot','review-eot-overlap','review-contract-value','review-hse-rates','review-document-classification','review-milestones','review-locations','review-handover-sources','review-programme-tasks','review-commercial-record','review-contract-fact'].includes(t.kind??'')){
  const choices=(t.reviewOptions||[]).map(x=>'<option value="'+escapeHtml(x.value)+'"'+(x.value===t.reviewChoice?' selected':'')+'>'+escapeHtml(x.label)+'</option>').join('');
  return '<div class="action-resolution"><p>'+escapeHtml(r.instruction)+'</p><label>Your decision<select class="review-choice">'+choices+'</select></label>'+
   (t.kind==='review-notice'?'<fieldset><legend>Retained notice provisions (used with the selected-provisions option)</legend>'+(t.noticeCandidates||[]).map(c=>'<label><input type="checkbox" class="review-notice-source" value="'+escapeHtml(c.sourceKey)+'" '+((t.noticeSourceKeys||[]).includes(c.sourceKey)?'checked':'')+'> '+escapeHtml(c.value+' '+c.unit+' · '+c.sourceFilename+' · '+(c.effectiveFromIso||'original provision')+' to '+(c.effectiveToIso||'no later source date'))+'</label><p>'+escapeHtml(c.sourceRefs.map(ref=>ref.split(':').slice(-2).join(' ')).join('; '))+(c.sourceHash?' · <a href="/api/projects/'+encodeURIComponent(project())+'/evidence/documents/'+encodeURIComponent(c.documentId)+'/source?hash='+encodeURIComponent(c.sourceHash)+'">Download retained source</a>':'')+'</p>').join('')+'</fieldset><label>Notice review reference<input class="review-reference" value="'+escapeHtml(t.reviewReference||'')+'"></label><p>Selections keep the source effective dates and trigger. A missing interval or unresolved working-day basis remains unavailable.</p>':'')+
   (t.kind==='review-risk'?'<label>Approved score-to-rating matrix (only if selecting the matrix option)<textarea class="review-matrix" placeholder="One score per line, e.g. 0.4=High">'+escapeHtml(t.reviewMatrixText||'')+'</textarea></label>':'')+
   (t.kind==='review-contract-fact'&&t.reviewInputType==='date'?'<label>Your own date (only with the enter-your-own option)<input type="date" class="review-entered-date"></label>':'')+
   (['review-commercial-record','review-contract-fact'].includes(t.kind)&&t.reviewInputType!=='date'?'<label>Your own value (only with the enter-your-own option)<input type="number" step="any" class="review-entered-value"></label>':'')+
   (t.kind==='review-contract-value'?'<label>Your own contract value (only with the enter-your-own option)<input type="number" min="0" step="any" class="review-entered-value"></label><label>Currency (three letters)<input class="review-entered-currency" maxlength="3"></label>':'')+
   (t.kind==='review-risk-snapshot'?'<label>Register status as-of date<input type="date" class="review-as-of" value="'+escapeHtml((t.reviewDateIso||'').slice(0,10))+'"></label>':'')+
   (t.kind==='review-eot-overlap'?'<label>Additional awarded days<input type="number" min="0" step="any" class="review-additional-days" value="'+escapeHtml(t.reviewAdditionalDays??'')+'"></label><label>Supporting decision reference<input class="review-reference" value="'+escapeHtml(t.reviewReference||'')+'"></label>':'')+
   (t.kind==='review-handover-sources'?'<p><button class="btn" data-action-module="handover-readiness">Compare programme and asset sources</button></p><label>Source basis review reference<input class="review-reference" value="'+escapeHtml(t.reviewReference||'')+'"></label>':'')+
   (t.kind==='review-locations'?'<p><button class="btn" data-action-module="construction-locations">Open location candidates</button></p><label>WBS location mappings (one per line)<textarea class="review-location-assignments" placeholder="WBS ID | exact candidate location">'+escapeHtml(t.reviewLocationsText||'')+'</textarea></label><label>Location review reference<input class="review-reference" value="'+escapeHtml(t.reviewReference||'')+'"></label>':'')+
   (t.kind==='review-programme-tasks'?'<p><button class="btn" data-action-module="activity-analytics">Open Activity Review</button></p><label>Programme task IDs (one per line)<textarea class="review-activity-ids">'+escapeHtml((t.reviewActivityIds||[]).join('\n'))+'</textarea></label><label>Task scope review reference<input class="review-reference" value="'+escapeHtml(t.reviewReference||'')+'"></label><p>Add or remove exact source IDs. Clear the list to confirm no tasks. Programme progress does not prove test results or acceptance.</p>':'')+
   (t.kind==='review-milestones'?'<p><button class="btn" data-action-module="activity-analytics">Open Activity Review</button></p><label>Key-date activity IDs (one per line)<textarea class="review-activity-ids">'+escapeHtml((t.reviewActivityIds||[]).join('\n'))+'</textarea></label><label>Programme review reference<input class="review-reference" value="'+escapeHtml(t.reviewReference||'')+'"></label><p>Use exact IDs from the current Activity Register. Clear this list when confirming no milestones.</p>':'')+
   (t.kind==='review-document-classification'?'<p><a class="btn" href="/api/projects/'+encodeURIComponent(project())+'/evidence/documents/'+encodeURIComponent(t.documentId)+'/source?hash='+encodeURIComponent(t.sourceHash)+'">Download retained source</a></p><label>Source review reference<input class="review-reference" value="'+escapeHtml(t.reviewReference||'')+'"></label>':'')+
   (t.kind==='review-hse-rates'?'<div class="action-resolution-grid">'+[['trir','Reviewed TRIR'],['trirBasisHours','TRIR basis in exposure hours'],['ltifr','Reviewed LTIFR'],['ltifrBasisHours','LTIFR basis in exposure hours']].map(([key,label])=>'<label>'+label+'<input type="number" min="0" step="any" class="review-hse-'+key+'" value="'+escapeHtml(t.reviewedRates?.[key]??'')+'"></label>').join('')+'</div><label>Supporting HSE review reference<input class="review-reference" value="'+escapeHtml(t.reviewReference||'')+'"></label><p>Enter rates only when selecting reviewed rates. Leave both rate and basis blank where unavailable.</p>':'')+
   '<button class="btn primary" data-resolve-review="'+escapeHtml(a.id)+'">Record decision</button><p class="action-inline-message" role="status"></p></div>';
 }
 if(!r.requiresUserAction&&!(a.category==='follow_up'&&t.type==='upload'))return '';
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
  return '<div class="action-resolution">'+(a.category==='review'?'<p class="action-correction-note"><b>Only if the existing evidence is wrong or incomplete:</b> upload a corrected document. First compare the findings above with the retained source and any applicable amendment. Uploading does not establish which contract clause or record has authority.</p>':'<p>'+escapeHtml(r.instruction||'Upload the evidence needed to complete this action.')+'</p>')+'<div class="action-resolution-grid"><label>'+escapeHtml(t.uploadHint||'Evidence')+'<input type="file" class="action-upload-file" '+(schedule?'accept=".xer,.xml,.xlsx,.xlsm,.csv"':'accept=".zip,.csv,.pdf,.docx,.xlsx,.xlsm,.xer,.xml,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp"')+'></label>'+(schedule?'<label>Programme purpose<select class="action-upload-role">'+programmePurposeOptions(t.scheduleRole||'update')+'</select></label><label>Baseline approval reference<input type="text" class="action-upload-approval" placeholder="Required only for baseline / revised baseline"></label>':'')+'</div><button class="btn primary" data-resolve-upload="'+escapeHtml(a.id)+'">'+escapeHtml(a.category==='review'?'Upload replacement only if needed':t.label||'Upload evidence')+'</button><p class="action-inline-message" role="status"></p></div>';
 }
 if(t.type==='delivery'&&t.population)return '<div class="action-resolution"><p>'+escapeHtml(r.instruction||'Confirm that the current records are the complete register for reporting.')+'</p><button class="btn primary" data-resolve-population="'+escapeHtml(a.id)+'">'+escapeHtml(t.label||'Confirm complete register')+'</button><p class="action-inline-message" role="status"></p></div>';
 if(t.type==='inline'&&t.kind==='contract-completion'){
  const candidate=typeof t.suggestedDateIso==='string'?t.suggestedDateIso.slice(0,10):'';
  const candidateNote=candidate?'<p><b>Suggested candidate:</b> '+escapeHtml(planningShortDate(candidate))+' from the current submitted programme finish. This is not treated as contractual unless you confirm it.</p>':'';
  return '<div class="action-resolution"><p>'+escapeHtml(r.instruction||'Confirm the contractual completion date.')+'</p>'+candidateNote+'<div class="action-resolution-grid"><label>Contractual completion date<input type="date" class="action-contract-completion-date" value="'+escapeHtml(candidate)+'"></label></div><button class="btn primary" data-resolve-contract-completion="'+escapeHtml(a.id)+'">'+escapeHtml(t.label||'Confirm contractual completion date')+'</button><p class="action-inline-message" role="status"></p></div>';
 }
 if(t.type==='inline'&&(t.kind==='contract-value'||t.kind==='approved-eot-days'||t.kind==='commencement-date')){
  const fields=t.kind==='contract-value'
   ?'<label>Contract value<input type="text" inputmode="decimal" class="action-missing-amount" placeholder="Amount"></label><label>Currency<input type="text" class="action-missing-currency" maxlength="3" placeholder="SAR"></label>'
   :t.kind==='commencement-date'?'<label>Commencement Date<input type="date" class="action-missing-date"></label>'
   :'<label>Approved EOT (days)<input type="number" min="0" step="1" class="action-missing-days"></label>';
  return '<div class="action-resolution"><p>'+escapeHtml(r.instruction||'Enter the missing value.')+'</p><div class="action-resolution-grid">'+fields+'</div><button class="btn primary" data-resolve-missing-value="'+escapeHtml(a.id)+'">'+escapeHtml(t.label||'Save value')+'</button><p class="action-inline-message" role="status"></p></div>';
 }
 return '';
}
function actionSourceLink(row){
 const label=escapeHtml((row.source||'Retained source record')+' · '+(row.locator||'Source section'));
 if(!row.documentId||!row.sourceHash)return label;
 const address='/api/projects/'+encodeURIComponent(project())+'/evidence/documents/'+encodeURIComponent(row.documentId)+'/source?hash='+encodeURIComponent(row.sourceHash);
 return '<a href="'+escapeHtml(address)+'" title="Open original source evidence">'+label+'</a>';
}

function renderProjectActionList(){
 if(!actionStateCurrent()||projectActionState.status==='loading')return '<p role="status">Checking actions required…</p>';
 if(projectActionState.status==='error')return '<p role="alert">Actions could not be refreshed. '+escapeHtml(projectActionState.message)+'</p><button class="btn" data-action-refresh>Try again</button>';
 const sourceData=projectActionState.data;
 const comparisonInformation=(sourceData.information||[]).filter(a=>a.completionPosition||a.id==='matter:schedule-calculation'||a.id==='matter:programme-comparison');
 const data={...sourceData,information:(sourceData.information||[]).filter(a=>!comparisonInformation.includes(a))},items=(data.actions||[]).filter(a=>(a.category==='confirmation'||a.category==='review')&&a.resolution?.requiresUserAction===true);
 const filtered=data.pageSize?items:items.filter(a=>(projectActionFilter==='all'||a.category===projectActionFilter)&&((a.title+' '+a.reason).toLowerCase().includes(projectActionSearch.toLowerCase())));
 const perPage=data.pageSize||25,total=data.matchedActionCount??filtered.length;
 const pageRows=data.pageSize?filtered:filtered.slice(projectActionPage*perPage,(projectActionPage+1)*perPage);
 const decisionCount=data.userDecisionCount??data.actionCount??items.length;
 const article=(a,information=false)=>{
  const team=a.category==='follow_up';
  const records=team&&a.recordCount>1?'<p><b>Records in this owner group:</b> '+fmt(a.recordCount)+' · review individual record dates and evidence in the supporting view.</p>':'';
  return '<article class="project-action '+(information?'action-information'+(a.target?.kind?.startsWith('review-')?' action-review-recorded':''):team?'action-follow-up':'')+'" data-action-id="'+escapeHtml(a.id)+'">'+
   (!information?'<span class="action-type">'+(team?'PROJECT-TEAM FOLLOW-UP':a.category==='review'?'REVIEW EXISTING DOCUMENTS':'CONFIRMATION / DECISION')+'</span>':'')+
   '<h4>'+escapeHtml(a.title)+'</h4><p>'+escapeHtml(a.reason)+'</p>'+reviewEvidenceHtml(a)+reviewFindingPreview(a)+
   '<p><b>'+(team?'Responsible project-team owner:':a.category==='review'?'Review owner:':'Decision owner:')+'</b> '+(a.assignedOwner?escapeHtml(a.assignedOwner)+' <small>Assigned in CMeng</small>':ownerMissingHtml(a.owner,a.accountableRole))+'</p>'+records+(information?'':actionAssignEditor(a))+
   (team&&a.dueIso?'<p><b>'+(a.recordCount>1?'Earliest due date in this group:':'Due date:')+'</b> '+escapeHtml(planningShortDate(a.dueIso))+'</p>':'')+
   actionGapsHtml(a)+
   (!information&&a.resolution?.instruction&&a.category!=='confirmation'?'<p><b>'+(team?'Project-team follow-up:':'What the owner should check:')+'</b> '+escapeHtml(a.resolution.instruction)+'</p>':'')+
   (a.correctionRecords?.length?'<div><b>Documents and locations to examine</b><p>'+a.correctionRecords.slice(0,3).map(row=>actionSourceLink(row)).join('; ')+'</p>'+(a.correctionRecords.length>3?'<details><summary>'+(actionListTotal(a.correctionRecords)===a.correctionRecords.length?'Open all '+fmt(a.correctionRecords.length)+' recorded locations':'Open '+actionShownOf(a.correctionRecords,'recorded locations'))+'</summary><p>'+a.correctionRecords.slice(3).map(row=>actionSourceLink(row)).join('; ')+'</p></details>':'')+'</div>':'')+
   (!information||a.target?.kind?.startsWith('review-')?actionResolutionHtml(a):'')+
   ((a.completionPosition||a.findings?.length)?'<details class="review-inline"'+(a.resolution?.kind==='upload'||information&&a.completionPosition?' open':'')+'><summary>'+(a.resolution?.kind==='upload'?'Findings, owners and affected pages':'Supporting information')+'</summary>'+renderActionFindings(a,a.resolution?.kind==='upload')+'</details>':'')+
   (a.affectedPages?.length?'<small>Affects '+screenCountText(actionListTotal(a.affectedPages))+' view'+(actionListTotal(a.affectedPages)===1?'':'s')+' · supporting findings retained</small>':'')+'</article>';
 };
 return '<div class="action-summary"><b>'+fmt(decisionCount)+' decision'+(decisionCount===1?' needs':'s need')+' your review</b><small>Checked '+escapeHtml(formatDocumentTime(data.checkedAt))+'</small><button class="btn small" data-action-refresh>Refresh</button><button class="btn small" data-action-close>Close</button></div><p>Confirm source decisions that require your authority. Other project-team work is under Accountability. <button class="btn small" data-action-module="cross-domain-accountability">Open Accountability</button></p><div class="action-filters"><input class="project-action-search" aria-label="Find an action" placeholder="Find an action or document" value="'+escapeHtml(projectActionSearch)+'"><select class="project-action-filter" aria-label="Action type">'+[['all','All decisions'],['confirmation','Confirm / choose'],['review','Source review']].map(([value,label])=>'<option value="'+value+'" '+(projectActionFilter===value?'selected':'')+'>'+label+'</option>').join('')+'</select></div><div class="project-action-list">'+pageRows.map(a=>article(a,false)).join('')+'</div>'+(total>perPage?'<p><button class="btn small" data-action-page="-1" '+(projectActionPage===0?'disabled':'')+'>Previous</button> '+fmt(projectActionPage*perPage+1)+'–'+fmt(Math.min((projectActionPage+1)*perPage,total))+' of '+fmt(total)+' <button class="btn small" data-action-page="1" '+((projectActionPage+1)*perPage>=total?'disabled':'')+'>Next</button></p>':'')+(!filtered.length?'<p>'+(items.length?'No actions match this filter.':'No decisions or source confirmations await your response.')+'</p>':'')+((data.dataGapsTotalCount??data.information?.length)>0?'<details class="review-inline"><summary>Data gaps and recorded decisions · '+screenCountText(data.dataGapsTotalCount??listTotal(data.information))+'</summary><p>Review missing source fields and saved reporting decisions here. Available source figures remain visible.</p>'+(data.information||[]).map(a=>article(a,true)).join('')+(data.dataGapsTotalCount>perPage?'<p><button class="btn small" data-gap-page="-1" '+(projectDataGapsPage===0?'disabled':'')+'>Previous gaps</button> '+fmt(projectDataGapsPage*perPage+1)+'–'+fmt(Math.min((projectDataGapsPage+1)*perPage,data.dataGapsTotalCount))+' of '+fmt(data.dataGapsTotalCount)+' <button class="btn small" data-gap-page="1" '+((projectDataGapsPage+1)*perPage>=data.dataGapsTotalCount?'disabled':'')+'>More gaps</button></p>':'')+'</details>':'')+(comparisonInformation.length?'<details class="review-inline"><summary>Additional information · programme calculation qualifications</summary>'+comparisonInformation.map(a=>article(a,true)).join('')+'</details>':'');
}
async function resolveReviewDecision(id){
 if(!actionStateCurrent()||projectActionState.status!=='ready')return;
 const owner=project(),version=projectActionState.data.projectVersion,a=[...projectActionState.data.actions,...(projectActionState.data.information||[])].find(x=>x.id===id);
 if(!a)return;
 const node=actionNode(id),choice=node?.querySelector('.review-choice')?.value,matrixText=node?.querySelector('.review-matrix')?.value||'';
 if(!choice){actionMessage(id,'Select the applicable decision.');return;}
 setActionBusy(id,true);actionMessage(id,'Recording the decision…');
 try{
  await api('/api/projects/'+encodeURIComponent(owner)+'/actions/confirm-review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:version,actionId:id,sourceFingerprint:a.reviewFingerprint,choice,matrixText,noticeSourceKeys:Array.from(node?.querySelectorAll('.review-notice-source:checked')||[]).map(input=>input.value),locationAssignmentsText:node?.querySelector('.review-location-assignments')?.value,activityIds:(node?.querySelector('.review-activity-ids')?.value||'').split(/\r?\n/).map(id=>id.trim()).filter(Boolean),asOfIso:node?.querySelector('.review-as-of')?.value,additionalDays:node?.querySelector('.review-additional-days')?.value,enteredValue:node?.querySelector('.review-entered-value')?.value,enteredCurrency:node?.querySelector('.review-entered-currency')?.value,enteredDateIso:node?.querySelector('.review-entered-date')?.value,reference:node?.querySelector('.review-reference')?.value,reviewedRates:Object.fromEntries(['trir','trirBasisHours','ltifr','ltifrBasisHours'].map(key=>[key,node?.querySelector('.review-hse-'+key)?.value]))})});
  if(project()===owner)await refresh(false);
 }catch(e){actionMessage(id,e.message);setActionBusy(id,false);}
}
/** T09: inline owner and due-date inputs (save and clear) for an open action. */
function actionAssignEditor(a){
 return (a.assignedDueIso?'<p><b>Assigned due date:</b> '+escapeHtml(planningShortDate(a.assignedDueIso))+(a.assignedOverdue===true?' · overdue at the Data Date':'')+'</p>':'')+
  '<div class="action-assign"><label>Owner <input class="action-assign-owner" maxlength="120" autocomplete="name" value="'+escapeHtml(a.assignedOwner||'')+'"></label> '+
  '<label>Due date <input type="date" class="action-assign-due" value="'+escapeHtml(a.assignedDueIso||'')+'"></label> '+
  '<button type="button" class="management-module-link" data-assign-save="'+escapeHtml(a.id)+'">Save owner and due date</button>'+
  (a.assignmentState==='assigned'?' <button type="button" class="management-module-link" data-assign-clear="'+escapeHtml(a.id)+'">Clear</button>':'')+
  '<p class="action-inline-message" aria-live="polite"></p></div>';
}
async function saveActionAssignment(id,clear=false){
 if(!actionStateCurrent()||projectActionState.status!=='ready')return;
 const owner=project(),version=projectActionState.data.projectVersion,node=actionNode(id);
 const body=clear?{action:'clear'}:{owner:(node?.querySelector('.action-assign-owner')?.value||'').trim(),dueIso:node?.querySelector('.action-assign-due')?.value||''};
 if(!clear&&!body.owner&&!body.dueIso){actionMessage(id,'Enter an owner name or a due date.');return;}
 setActionBusy(id,true);actionMessage(id,clear?'Clearing…':'Saving…');
 try{
  await api('/api/projects/'+encodeURIComponent(owner)+'/actions/assign',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:version,actionId:id,...body})});
  if(project()===owner)await refresh(false);
 }catch(e){actionMessage(id,e.message);setActionBusy(id,false);}
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
/** F30: each missing field once, with the control that supplies it: the inline
 * input of this matter, or an upload naming the document type and the field. */
function actionGapsHtml(a){
 const rows=a.missingFields||[];if(!rows.length)return '';
 const owner=row=>typeof apiOwnerText==='function'?apiOwnerText(row):row.owner;
 const control=(row,index)=>{
  const s=row.supply;if(!s)return '';
  if(s.type==='input')return '<small class="gap-supply">Supplied here: '+escapeHtml(s.label)+(a.target?.kind===s.kind?' (below)':'')+'</small>';
  const schedule=s.uploadMode==='schedule';
  return '<div class="action-resolution-grid"><label>'+escapeHtml(s.uploadHint)+'<input type="file" class="gap-upload-file" '+(schedule?'accept=".xer,.xml,.xlsx,.xlsm,.csv"':'accept=".zip,.csv,.pdf,.docx,.xlsx,.xlsm,.xer,.xml,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp"')+'></label>'+
   (schedule?'<label>Programme purpose<select class="gap-upload-role">'+programmePurposeOptions('update')+'</select></label><label>Baseline approval reference<input type="text" class="gap-upload-approval" placeholder="Required only for baseline / revised baseline"></label>':'')+
   '</div><button class="btn small" type="button" data-resolve-gap-upload="'+escapeHtml(a.id)+'" data-gap-index="'+index+'">'+escapeHtml(s.label)+'</button>';
 };
 return '<div class="action-gaps"><b>Information needed · '+fmt(rows.length)+' field'+(rows.length===1?'':'s')+'</b><ul>'+rows.map((row,index)=>'<li data-gap-row="'+index+'"><span>'+escapeHtml(row.field+' · '+(row.supply?.type==='upload'?row.supply.documentType:row.file)+' · '+owner(row))+'</span>'+control(row,index)+'</li>').join('')+'</ul><p class="gap-inline-message" role="status"></p></div>';
}
async function resolveUploadAction(id,gapIndex=null){
 if(!actionStateCurrent()||projectActionState.status!=='ready')return;
 const owner=project(),a=[...projectActionState.data.actions,...(projectActionState.data.information||[])].find(x=>x.id===id);if(!a)return;
 const gap=gapIndex===null?null:a.missingFields?.[gapIndex]?.supply;if(gapIndex!==null&&gap?.type!=='upload')return;
 const t=gap||a.target,node=gapIndex===null?actionNode(id):actionNode(id)?.querySelector('[data-gap-row="'+gapIndex+'"]'),cls=gapIndex===null?'.action-upload':'.gap-upload',file=node?.querySelector(cls+'-file')?.files?.[0];
 const say=text=>{if(gapIndex===null){actionMessage(id,text);return;}const m=actionNode(id)?.querySelector('.gap-inline-message');if(m)m.textContent=text;};
 if(!file){say('Choose a file to upload.');return;}
 setActionBusy(id,true);say('Uploading and updating the Project position…');
 try{
  const headers={'content-type':fileType(file),'x-source-filename':file.name,'x-source-relative-path':file.webkitRelativePath||file.name,'x-rerun-after-upload':'true'};
  let path='/api/projects/'+encodeURIComponent(owner)+'/evidence/uploads';
  if(t.uploadMode==='schedule'){
   const role=node.querySelector(cls+'-role')?.value||'update',approval=node.querySelector(cls+'-approval')?.value.trim()||'';
   if(['baseline','revised_baseline'].includes(role)&&!approval)throw new Error('Enter the baseline approval reference.');
   path=t.phaseId?'/api/projects/'+encodeURIComponent(owner)+'/phases/'+encodeURIComponent(t.phaseId)+'/schedule/uploads':'/api/projects/'+encodeURIComponent(owner)+'/schedule/uploads';
   Object.assign(headers,{'x-upload-intent':'replace_current_basis','x-schedule-role':role,'x-schedule-role-confirmed':'1'});
   if(approval)headers['x-approval-reference']=approval;
  }else Object.assign(headers,{'x-upload-intent':'add_update'});
  await api(path,{method:'POST',headers,body:file});
  if(project()===owner)await refresh(false);
 }catch(e){say(e.message);setActionBusy(id,false);}
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
async function resolveMissingValueAction(id){
 if(!actionStateCurrent()||projectActionState.status!=='ready')return;
 const owner=project(),version=projectActionState.data.projectVersion,a=projectActionState.data.actions.find(x=>x.id===id);if(!a)return;
 const node=actionNode(id),value=cls=>(node?.querySelector(cls)?.value||'').trim();
 const body=a.target.kind==='contract-value'?{amount:value('.action-missing-amount'),currency:value('.action-missing-currency')}:a.target.kind==='commencement-date'?{dateIso:value('.action-missing-date')}:{days:value('.action-missing-days')};
 if(Object.values(body).some(v=>v==='')){actionMessage(id,'Enter every field before saving.');return;}
 setActionBusy(id,true);actionMessage(id,'Saving…');
 try{
  await api('/api/projects/'+encodeURIComponent(owner)+'/actions/confirm-missing-value',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:version,actionId:id,...body})});
  if(project()===owner)await refresh(false);
 }catch(e){actionMessage(id,e.message);setActionBusy(id,false);}
}
async function resolvePopulationAction(id){
 if(!actionStateCurrent()||projectActionState.status!=='ready')return;
 const owner=project(),version=projectActionState.data.projectVersion,a=projectActionState.data.actions.find(x=>x.id===id);if(!a)return;
 setActionBusy(id,true);actionMessage(id,'Saving confirmation…');
 try{
  await api('/api/projects/'+encodeURIComponent(owner)+'/delivery/records',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:version,action:'confirm_population',kind:a.target.kind,note:'Confirmed complete register in Actions required.'})});
  if(project()===owner)await refresh(false);
 }catch(e){actionMessage(id,e.message);setActionBusy(id,false);}
}
async function openProjectActions(inlineForCurrentPage=false){
 if(!overview)return;
 const drawer=el('projectReviewDrawer');
 if(!drawer)return;
 if(inlineForCurrentPage){
   // One action form, one source-bound decision producer. The existing
   // drawer is moved beside the current page rather than duplicating its
   // controls or introducing a second place to save a decision. It remains
   // outside moduleContent so changing pages never destroys it.
   const modulePanel=el('projectModulePanel');
   if(modulePanel)modulePanel.insertAdjacentElement('afterend',drawer);
 }
 drawer.hidden=false;drawer.open=true;
 await loadProjectActions();drawer.scrollIntoView({block:'start'});
}
function bindProjectActions(root){
 root.querySelectorAll('[data-action-page]').forEach(b=>b.onclick=()=>{projectActionPage=Math.max(0,projectActionPage+Number(b.dataset.actionPage));void loadProjectActions();});
 root.querySelectorAll('[data-gap-page]').forEach(b=>b.onclick=()=>{projectDataGapsPage=Math.max(0,projectDataGapsPage+Number(b.dataset.gapPage));void loadProjectActions();});
 root.querySelectorAll('[data-action-module]').forEach(b=>b.onclick=()=>{if(!names[b.dataset.actionModule])return;const drawer=el('projectReviewDrawer');if(drawer){drawer.open=false;drawer.hidden=true;}selected=b.dataset.actionModule;localStorage.setItem('cmeng-module',selected);syncBrowserRoute();renderNav();loadModule(selected);});
 root.querySelectorAll('[data-boq-numeric-review]').forEach(b=>b.onclick=()=>openBoqNumericReview());
 root.querySelectorAll('[data-resolve-review]').forEach(b=>b.onclick=()=>resolveReviewDecision(b.dataset.resolveReview));
 root.querySelectorAll('[data-assign-save]').forEach(b=>b.onclick=()=>saveActionAssignment(b.dataset.assignSave));
 root.querySelectorAll('[data-assign-clear]').forEach(b=>b.onclick=()=>saveActionAssignment(b.dataset.assignClear,true));
 root.querySelectorAll('[data-resolve-schedule]').forEach(b=>b.onclick=()=>resolveScheduleAction(b.dataset.resolveSchedule));
 root.querySelectorAll('[data-resolve-document]').forEach(b=>b.onclick=()=>resolveDocumentAction(b.dataset.resolveDocument));
 root.querySelectorAll('[data-resolve-upload]').forEach(b=>b.onclick=()=>resolveUploadAction(b.dataset.resolveUpload));
 root.querySelectorAll('[data-resolve-gap-upload]').forEach(b=>b.onclick=()=>resolveUploadAction(b.dataset.resolveGapUpload,Number(b.dataset.gapIndex)));
 root.querySelectorAll('[data-resolve-population]').forEach(b=>b.onclick=()=>resolvePopulationAction(b.dataset.resolvePopulation));
 root.querySelectorAll('[data-resolve-contract-completion]').forEach(b=>b.onclick=()=>resolveContractCompletionAction(b.dataset.resolveContractCompletion));
 root.querySelectorAll('[data-resolve-missing-value]').forEach(b=>b.onclick=()=>resolveMissingValueAction(b.dataset.resolveMissingValue));
 root.querySelectorAll('.action-document-kind').forEach(select=>select.onchange=()=>{const label=select.closest('.action-resolution').querySelector('.action-document-target-label');if(label)label.hidden=select.value==='new_record';});
 root.querySelectorAll('[data-action-refresh]').forEach(b=>b.onclick=()=>loadProjectActions());
 root.querySelectorAll('[data-action-close]').forEach(b=>b.onclick=()=>{const drawer=el('projectReviewDrawer');drawer.open=false;drawer.hidden=true;el('moduleContent')?.scrollIntoView({block:'start'});});
 const search=root.querySelector('.project-action-search');if(search)search.oninput=()=>{
  projectActionSearch=search.value;projectActionPage=0;
  if(projectActionSearchTimer)clearTimeout(projectActionSearchTimer);
  projectActionSearchTimer=setTimeout(()=>{projectActionSearchTimer=null;void loadProjectActions();},300);
 };
 const filter=root.querySelector('.project-action-filter');if(filter)filter.onchange=()=>{projectActionFilter=filter.value;projectActionPage=0;void loadProjectActions();};
}
`;
