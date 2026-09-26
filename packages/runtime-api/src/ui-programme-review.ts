/** Shared first-upload and pending-revision workflow on every programme consumer. */
export function programmeReviewScript():string{return String.raw`
function renderProgrammeReview(review){
  if(!review)return '';
  const pending=review.pendingSchedules||[];
  if(review.state==='established'&&!pending.length)return '';
  const labels={later:'Later Data Date',same:'Same Data Date as the current programme',earlier:'Earlier Data Date',date_missing:'Data Date not established',no_current_programme:'No programme adopted yet'};
  const rows=pending.map(r=>'<tr><td><b>'+escapeHtml(r.filename)+'</b></td><td>'+escapeHtml(r.dataDateIso?planningShortDate(r.dataDateIso):'Not established')+'<br><small>'+escapeHtml(labels[r.dateRelationship]||'Review required')+'</small></td><td>'+escapeHtml(r.role==='baseline'||r.role==='revised_baseline'?'Baseline programme':'Current programme')+'</td><td>'+(r.canAdopt?'<button class="btn small programme-review-adopt" data-project="'+escapeHtml(review.projectId)+'" data-revision="'+escapeHtml(r.revisionId)+'">'+(r.role==='baseline'||r.role==='revised_baseline'?'Adopt as baseline':'Adopt as current')+'</button>':'<span>'+escapeHtml(r.adoptionBlocker||'Review required before adoption')+'</span>')+'</td></tr>').join('');
  return '<section class="notice warn programme-review" aria-label="Programme adoption review"><b>'+(review.state==='missing'?'Programme adoption required':'Programmes awaiting review')+'</b><p>'+escapeHtml(review.explanation)+'</p>'+(pending.length?'<p>'+pending.length+' programme'+(pending.length===1?' is':'s are')+' awaiting adoption. Reporting continues to use the adopted programme until you select a replacement.</p><div class="table-wrap"><table><thead><tr><th>Uploaded programme</th><th>Data Date</th><th>Role</th><th>Decision</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'')+'<p><button class="btn small programme-review-documents">Open programme documents</button></p><p class="programme-review-message" role="status"></p></section>';
}
function bindProgrammeReview(container){
  container.querySelectorAll('.programme-review-documents').forEach(button=>button.onclick=()=>{const drawer=el('evidenceControlDrawer');drawer.hidden=false;drawer.open=true;drawer.scrollIntoView({block:'start',behavior:'smooth'});});
  container.querySelectorAll('.programme-review-adopt').forEach(button=>button.onclick=async()=>{
    const owner=button.dataset.project,revision=button.dataset.revision;
    if(project()!==owner)return;
    const message=button.closest('.programme-review').querySelector('.programme-review-message');
    button.disabled=true;message.textContent='Adopting the selected programme…';
    try{await api('/api/projects/'+encodeURIComponent(owner)+'/schedule/revisions/'+encodeURIComponent(revision)+'/adopt',{method:'POST'});if(project()===owner)await refresh(false);}
    catch(error){button.disabled=false;message.textContent='Programme was not adopted. '+error.message;}
  });
}
`;}
