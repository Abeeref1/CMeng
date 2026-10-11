export const linkCandidateScript=String.raw`
function linkCandidateEntry(key){
 const kind=['payments','commercial-overview'].includes(key)?'payment_certificate':['pmo-analysis','quantity-scurve','challenge-contract'].includes(key)?'boq_activity':null;
 if(!kind)return '';
 return '<details class="planning-panel" id="link-candidate-review"><summary>Review '+(kind==='boq_activity'?'BOQ-to-activity':'payment-to-certificate')+' link proposals</summary><p>Existing source records only. AI suggests relationships; CMeng validates them. Your confirmation approves a relationship, not a quantity allocation or a new financial amount.</p><button type="button" class="btn small" onclick="loadLinkCandidates(&quot;'+kind+'&quot;)">Open source matching</button><div id="link-candidate-content"></div></details>';
}
let linkCandidateReviewState=null;
async function loadLinkCandidates(kind,offset=0,sourceOffset=0){
 const owner=project(),seq=projectRequestSeq,target=el('link-candidate-content');if(!target)return;
 const search=el('link-source-search')?.value||'';
 try{
  const data=await api('/api/projects/'+encodeURIComponent(owner)+'/link-candidates?kind='+kind+'&offset='+offset+'&sourceOffset='+sourceOffset+'&q='+encodeURIComponent(search));
  if(owner!==project()||seq!==projectRequestSeq||!target.isConnected)return;
  linkCandidateReviewState={owner,seq,data,sourceOffset};
  const permitted=data.providerConfigured&&data.providerPermittedForSession;
  const status=data.providerConfigured?(data.providerPermittedForSession?'AI provider configured. Suggestions use the capped paid account.':'AI provider configured. Owner activation is required for paid suggestions.'):'AI provider is not configured. Existing rule-based links remain available.';
  target.innerHTML='<p>'+escapeHtml(status)+'</p><p>'+escapeHtml(fmt(data.sourceCount))+' source records; '+escapeHtml(fmt(data.targetCount))+' target records. '+escapeHtml(fmt(data.confirmedCount))+' currently confirmed relationships; '+escapeHtml(fmt(data.candidateCount))+' proposals awaiting review; '+escapeHtml(fmt(data.sourceNotYetProposedCount))+' source records without a current proposal. No approval is automatic.</p>'+
   '<label>Find source <input id="link-source-search" type="search" value="'+escapeHtml(search)+'"></label><button class="btn small" onclick="loadLinkCandidates(&quot;'+kind+'&quot;)">Search source records</button>'+
   '<p><select id="link-source-select">'+data.sourceOptions.map(r=>'<option value="'+escapeHtml(r.id)+'">'+escapeHtml(r.reference+' · '+r.description)+'</option>').join('')+'</select> <button class="btn small" '+(permitted&&data.sourceOptions.length?'':'disabled ')+'onclick="suggestSourceLinks()">Suggest links for selected source</button></p>'+
   '<p>Source records '+escapeHtml(fmt(data.sourceOptions.length?data.sourceOffset+1:0))+'–'+escapeHtml(fmt(data.sourceOffset+data.sourceOptions.length))+' of '+escapeHtml(fmt(data.sourceMatchCount))+
   ' <button class="btn small" '+(data.sourceOffset?'':'disabled ')+'onclick="loadLinkCandidates(&quot;'+kind+'&quot;,0,'+Math.max(0,data.sourceOffset-data.sourcePageSize)+')">Previous sources</button>'+
   ' <button class="btn small" '+(data.sourceHasMore?'':'disabled ')+'onclick="loadLinkCandidates(&quot;'+kind+'&quot;,0,'+(data.sourceOffset+data.sourcePageSize)+')">Next sources</button></p>'+
   '<label>Compatible-target window starting at <input id="link-target-offset" type="number" min="0" step="20" value="0" style="width:95px" aria-label="Candidate target start position"></label>'+
   '<p>Each paid suggestion checks at most 20 of the compatible target records, starting at the chosen position. Later windows remain available; a proposal is not complete-source coverage. Missing dates, currency or certification remain missing.</p>'+
   '<label>Reviewer name <input id="link-reviewer" type="text" autocomplete="name"></label><label><input type="checkbox" id="link-review-ack"> I checked the source references and am confirming only the relationship.</label>'+
   '<div class="table-wrap"><table><thead><tr><th>Source</th><th>Proposed target</th><th>Confidence</th><th>Reason and evidence</th><th>Review</th></tr></thead><tbody>'+data.rows.map(r=>'<tr><td>'+escapeHtml(r.sourceLabel)+'</td><td>'+escapeHtml(r.targetLabel)+'</td><td>'+escapeHtml(percent2(r.confidence*100))+'%</td><td>'+escapeHtml(r.reason)+'<details><summary>Source references</summary>'+escapeHtml(r.sourceRefs.map(readerReference).join('; '))+'</details></td><td>'+escapeHtml(r.current?r.state:'Source changed — review again')+(r.current&&r.state==='candidate'?'<p><button class="btn small" data-link-review="confirm" data-link-id="'+escapeHtml(r.id)+'">Confirm relationship</button> <button class="btn small" data-link-review="reject" data-link-id="'+escapeHtml(r.id)+'">Reject</button></p>':'')+(r.current&&r.state==='confirmed'?'<button class="btn small" data-link-review="reject" data-link-id="'+escapeHtml(r.id)+'">Revoke relationship</button>':'')+'</td></tr>').join('')+'</tbody></table></div><p>Showing '+escapeHtml(fmt(data.rows.length))+' of '+escapeHtml(fmt(data.total))+' saved proposals.</p>'+
   '<button class="btn small" '+(offset?'':'disabled ')+'onclick="loadLinkCandidates(&quot;'+kind+'&quot;,'+Math.max(0,offset-25)+','+data.sourceOffset+')">Previous</button> <button class="btn small" '+(data.hasMore?'':'disabled ')+'onclick="loadLinkCandidates(&quot;'+kind+'&quot;,'+(offset+25)+','+data.sourceOffset+')">Next</button><p id="link-review-message" role="status"></p>';
  const details=el('link-candidate-review');if(details)details.open=true;
 }catch(e){if(owner===project()&&seq===projectRequestSeq&&target.isConnected)target.textContent='Source matching could not be loaded. Existing records have not been changed.';}
}
async function suggestSourceLinks(){
 const state=linkCandidateReviewState;if(!state||state.owner!==project()||state.seq!==projectRequestSeq)return;
 const sourceId=el('link-source-select')?.value;if(!sourceId)return;
 const targetOffset=Number(el('link-target-offset')?.value??0);
 if(!Number.isSafeInteger(targetOffset)||targetOffset<0){const message=el('link-review-message');if(message)message.textContent='Enter a valid position in the compatible-target list.';return;}
 const target=el('link-review-message');if(target)target.textContent='Checking a bounded source shortlist. Nothing is being approved.';
 try{const r=await api('/api/projects/'+encodeURIComponent(state.owner)+'/link-candidates/suggest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:state.data.kind,sourceId,targetOffset,expectedVersion:state.data.projectVersion})});
  if(state.owner!==project()||state.seq!==projectRequestSeq)return;
  await loadLinkCandidates(state.data.kind,0,state.sourceOffset);
  const next=el('link-target-offset');if(next)next.value=String(r.hasMoreTargets?r.nextTargetOffset:targetOffset);
  if(el('link-review-message'))el('link-review-message').textContent=(r.rows?.length?'Review the proposed relationships before confirming. ':'No reliable proposal was established in this target window. ')+
    'Checked '+r.targetsOffered+' of '+r.eligibleTargetCount+' compatible targets in this window. '+(r.hasMoreTargets?'The next target window is selected; request it only if needed.':'No further compatible target windows.')
 }catch(e){if(state.owner===project()&&state.seq===projectRequestSeq&&target?.isConnected)target.textContent='No link was approved. Check owner access, the monthly AI budget, and source dates/currency; then refresh and retry.';}
}
document.addEventListener('click',async event=>{
 const button=event.target.closest?.('[data-link-review]');if(!button)return;
 const state=linkCandidateReviewState;if(!state||state.owner!==project()||state.seq!==projectRequestSeq)return;
 const reviewer=el('link-reviewer')?.value?.trim(),confirmed=el('link-review-ack')?.checked===true,message=el('link-review-message');
 if(!reviewer||!confirmed){if(message)message.textContent='Enter your reviewer name and confirm that you checked the source references.';return;}
 button.disabled=true;
 try{await api('/api/projects/'+encodeURIComponent(state.owner)+'/link-candidates/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:button.dataset.linkId,decision:button.dataset.linkReview,expectedVersion:state.data.projectVersion,reviewer,confirmed})});
  if(state.owner!==project()||state.seq!==projectRequestSeq)return;
  await loadModule(selected);await loadLinkCandidates(state.data.kind,0,state.sourceOffset);
 }catch(e){if(state.owner===project()&&message?.isConnected)message.textContent='The review was not applied. Refresh the source records before retrying.';button.disabled=false;}
});
`;
