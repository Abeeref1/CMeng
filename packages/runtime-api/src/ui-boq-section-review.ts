export const boqSectionReviewScript=String.raw`
let boqSectionReviewState=null;
function currentBoqSectionReview(s){return boqSectionReviewState===s&&project()===s.owner&&projectRequestSeq===s.seq&&s.panel.isConnected;}
function retainBoqSectionDrafts(s){
 for(const row of s.panel.querySelectorAll('[data-boq-section-row]')){
  const source=s.view?.rows?.[Number(row.dataset.boqSectionRow)];if(source)s.drafts.set(source.section,{wbsId:row.querySelector('[data-section-wbs]').value,reference:row.querySelector('[data-section-reference]').value});
 }
}
function renderBoqSectionReview(s){
 const v=s.view;
 s.panel.innerHTML='<h4>Review BOQ section scope</h4><p>'+escapeHtml(v.basis||v.reason||'')+'</p>'+
  (v.available?'<p>'+escapeHtml(v.boqFilename||'Current BOQ')+' → '+escapeHtml(v.programmeFilename||'Current programme')+'. '+countText(v.itemCount,'item','items',fmt)+'; '+countText(v.sectionCount,'section','sections',fmt)+'; '+countText(v.unsectionedItemCount,'item','items',fmt)+' without a section. '+countText(v.reviewedSectionCount,'section','sections',fmt)+' currently reviewed.</p>'+
   (v.previousReviewNeedsRefresh?'<p class="notice warn">The BOQ or programme changed. Previous decisions remain in history and must be reviewed again.</p>':'')+
   '<label>Find section <input id="boqSectionSearch" type="search" value="'+escapeHtml(s.q)+'"></label><button class="btn" id="boqSectionSearchButton">Search</button><p>Choose a suggested WBS or type a current WBS ID/name to search all groups. Nothing is selected automatically. A rejected section match leaves explicit source-code links and approved allocations intact.</p>'+
   v.rows.map((row,index)=>{const draft=s.drafts.get(row.section),choice=draft?.wbsId??row.review?.wbsId??'',reference=draft?.reference??row.review?.reference??'';
    return '<article class="project-action" data-boq-section-row="'+index+'"><h4>'+escapeHtml(row.section)+'</h4><p>'+fmt(row.itemCount)+' BOQ items · '+fmt(row.suggestionCount)+' name suggestions. '+(row.review?'Saved decision: '+escapeHtml(row.review.decision==='confirm'?'Confirm scope → '+row.review.wbsId:'Reject section association'):'No saved section review')+'</p><p>'+escapeHtml(row.suggestions.map(w=>w.wbsId+' · '+w.name).join('; ')||'No name suggestion. Search the programme to select a group.')+'</p><label>Programme WBS (ID or name search) <input data-section-wbs list="boqSectionOptions'+index+'" value="'+escapeHtml(choice)+'"></label><datalist id="boqSectionOptions'+index+'">'+row.suggestions.map(w=>'<option value="'+escapeHtml(w.wbsId)+'">'+escapeHtml(w.name)+'</option>').join('')+'</datalist><p data-section-options-status></p><button type="button" class="btn small" data-section-more hidden>More WBS matches</button><label>Review reference <input data-section-reference value="'+escapeHtml(reference)+'"></label><div class="actions"><button class="btn" data-section-save="confirm">Confirm selected scope</button><button class="btn" data-section-save="reject">Reject section association</button>'+(row.review?'<button class="btn" data-section-save="remove_review">Remove my review</button>':'')+'</div><p data-section-feedback role="status"></p></article>';
   }).join('')+'<p>Sections '+fmt(v.rows.length?v.offset+1:0)+'–'+fmt(v.offset+v.rows.length)+' of '+fmt(v.total)+'</p><button class="btn" id="boqSectionPrevious" '+(v.offset?'':'disabled')+'>Previous 25</button><button class="btn" id="boqSectionNext" '+(v.hasMore?'':'disabled')+'>Next 25</button>':'')+
  '<p id="boqSectionFeedback" role="status"></p><button class="btn" id="boqSectionClose">Close</button>';
 s.panel.querySelector('#boqSectionClose').onclick=()=>{if(s.saving)return;const refresh=currentBoqSectionReview(s)&&s.changed;if(boqSectionReviewState===s)boqSectionReviewState=null;s.panel.remove();if(refresh)loadModule();};
 if(!v.available)return;
 s.panel.querySelector('#boqSectionSearchButton').onclick=()=>loadBoqSections(0,s.panel.querySelector('#boqSectionSearch').value);
 s.panel.querySelector('#boqSectionPrevious').onclick=()=>loadBoqSections(Math.max(0,v.offset-25),s.q);
 s.panel.querySelector('#boqSectionNext').onclick=()=>loadBoqSections(v.offset+25,s.q);
 s.panel.querySelectorAll('[data-boq-section-row]').forEach(node=>{
  const input=node.querySelector('[data-section-wbs]');let ticket=0,offset=0,query='';
  async function options(nextOffset){
   const current=++ticket,value=input.value;query=value;
   try{const data=await api('/api/projects/'+encodeURIComponent(s.owner)+'/boq/section-links?kind=wbs&q='+encodeURIComponent(value)+'&offset='+nextOffset);
    if(!currentBoqSectionReview(s)||!node.isConnected||ticket!==current||input.value!==value||data.projectVersion!==s.view.projectVersion)return;
    const list=node.querySelector('datalist'),html=data.options.map(w=>'<option value="'+escapeHtml(w.wbsId)+'">'+escapeHtml(w.name+' · '+w.activityCount+' tasks')+'</option>').join('');
    if(nextOffset===0)list.innerHTML=html;else list.insertAdjacentHTML('beforeend',html);
    offset=nextOffset+data.options.length;node.querySelector('[data-section-options-status]').textContent=fmt(offset)+' of '+fmt(data.total)+' WBS matches loaded. Select an exact ID.';node.querySelector('[data-section-more]').hidden=!data.hasMore;
   }catch(error){if(currentBoqSectionReview(s)&&node.isConnected)node.querySelector('[data-section-options-status]').textContent=error.message||'WBS choices unavailable.';}
  }
  input.oninput=()=>options(0);node.querySelector('[data-section-more]').onclick=()=>options(input.value===query?offset:0);
  node.querySelectorAll('[data-section-save]').forEach(button=>button.onclick=()=>saveBoqSection(Number(node.dataset.boqSectionRow),button.dataset.sectionSave));
 });
}
async function loadBoqSections(offset=0,q=''){
 const s=boqSectionReviewState;if(!s||!currentBoqSectionReview(s)||s.saving)return;retainBoqSectionDrafts(s);const ticket=++s.ticket;
 try{const view=await api('/api/projects/'+encodeURIComponent(s.owner)+'/boq/section-links?offset='+offset+'&q='+encodeURIComponent(q));if(!currentBoqSectionReview(s)||ticket!==s.ticket)return;
  if(s.view&&view.sourceFingerprint!==s.view.sourceFingerprint)s.drafts.clear();s.view=view;s.q=q;renderBoqSectionReview(s);
 }catch(error){if(currentBoqSectionReview(s)){const feedback=s.panel.querySelector('#boqSectionFeedback');if(feedback)feedback.textContent=error.message||'Section review unavailable.';else s.panel.innerHTML='<p>'+escapeHtml(error.message||'Section review unavailable. Reopen to retry.')+'</p>';}}
}
async function openBoqSectionReview(){
 el('boqSectionReviewEditor')?.remove();const panel=document.createElement('section');panel.id='boqSectionReviewEditor';panel.className='planning-panel primary';panel.innerHTML='<p>Loading section suggestions…</p>';el('moduleContent').prepend(panel);panel.scrollIntoView({block:'start'});
 boqSectionReviewState={owner:project(),seq:projectRequestSeq,panel,view:null,q:'',ticket:0,drafts:new Map(),saving:false};await loadBoqSections();
}
async function saveBoqSection(index,decision){
 const s=boqSectionReviewState;if(!s?.view||!currentBoqSectionReview(s)||s.saving)return;
 const row=s.view.rows[index],node=s.panel.querySelector('[data-boq-section-row="'+index+'"]');if(!row||!node)return;
 retainBoqSectionDrafts(s);const draft=s.drafts.get(row.section),feedback=node.querySelector('[data-section-feedback]');
 const request={expectedVersion:s.view.projectVersion,sourceFingerprint:s.view.sourceFingerprint,section:row.section,decision,wbsId:decision==='confirm'?draft.wbsId:null,reference:draft.reference};
 s.saving=true;s.ticket++;feedback.textContent='Saving section review…';
 try{const view=await api('/api/projects/'+encodeURIComponent(s.owner)+'/boq/section-links?offset='+s.view.offset+'&q='+encodeURIComponent(s.q),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)});
  if(!currentBoqSectionReview(s))return;s.view=view;s.changed=true;s.drafts.delete(row.section);renderBoqSectionReview(s);s.panel.querySelector('#boqSectionFeedback').textContent='Section review saved. Quantity allocations and source values are unchanged. Page coverage will refresh when you close this review.';
 }catch(error){if(currentBoqSectionReview(s)&&node.isConnected)feedback.textContent=error.message||'Section review not saved. Reopen if the project changed.';}
 finally{s.saving=false;}
}
`;
