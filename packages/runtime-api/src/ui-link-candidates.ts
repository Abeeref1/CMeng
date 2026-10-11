export const linkCandidateScript=String.raw`
function linkCandidateEntry(key){
 const kind=['payments','commercial-overview'].includes(key)?'payment_certificate':['pmo-analysis','quantity-scurve','challenge-contract'].includes(key)?'boq_activity':null;
 if(!kind)return '';
 const boq=kind==='boq_activity';
 return '<details class="planning-panel" id="link-candidate-review"><summary>'+(boq?'Check suggested BOQ–programme links':'Check suggested payment–certificate links')+'</summary><p>'+(boq?'CMeng can suggest which programme activity a BOQ item may relate to. Review the BOQ and programme evidence before accepting a link. Accepting a link does not change quantities, progress or programme dates.':'CMeng can suggest which certificate a payment may relate to. Review the payment and certificate evidence before accepting a link. Accepting a link does not change any payment or certificate amount.')+'</p><button type="button" class="btn small" onclick="loadLinkCandidates(&quot;'+kind+'&quot;)">Review suggested links</button><div id="link-candidate-content"></div></details>';
}
let linkCandidateReviewState=null;
async function loadLinkCandidates(kind,offset=0){
 const owner=project(),seq=projectRequestSeq,target=el('link-candidate-content');if(!target)return;
 const search=el('link-source-search')?.value||'';
 try{
  const data=await api('/api/projects/'+encodeURIComponent(owner)+'/link-candidates?kind='+kind+'&offset='+offset+'&q='+encodeURIComponent(search));
  if(owner!==project()||seq!==projectRequestSeq||!target.isConnected)return;
  linkCandidateReviewState={owner,seq,data};
  const permitted=data.providerConfigured&&data.providerPermittedForSession;
  const boq=kind==='boq_activity';
  const status=data.providerConfigured?(data.providerPermittedForSession?'CMeng suggestions are available.':'Suggestions are available to the project owner.'):'Automatic suggestions are not available. Existing accepted links remain visible.';
  target.innerHTML='<p>'+escapeHtml(status)+'</p><p>'+escapeHtml(fmt(data.sourceCount))+' '+(boq?'BOQ items':'payments')+'; '+escapeHtml(fmt(data.targetCount))+' '+(boq?'programme activities':'certificates')+'. '+escapeHtml(fmt(data.confirmedCount))+' accepted links. Every new link requires review.</p>'+
   '<label>'+(boq?'Find BOQ item':'Find payment')+' <input id="link-source-search" type="search" value="'+escapeHtml(search)+'"></label><button class="btn small" onclick="loadLinkCandidates(&quot;'+kind+'&quot;)">Search</button>'+
   '<p><select id="link-source-select">'+data.sourceOptions.map(r=>'<option value="'+escapeHtml(r.id)+'">'+escapeHtml(r.reference+' · '+r.description)+'</option>').join('')+'</select> <button class="btn small" '+(permitted&&data.sourceOptions.length?'':'disabled ')+'onclick="suggestSourceLinks()">'+(boq?'Find likely programme links':'Find likely certificate links')+'</button></p>'+
   '<p>'+(boq?'CMeng screens the full eligible programme for the selected BOQ item, then shows the strongest matches in review sets. You can continue through the remaining activities; none are silently removed from the search population.':'CMeng checks all eligible certificates for the selected payment and shows the strongest matches in review sets. You can continue through the remaining certificates.')+' A suggestion is never treated as an accepted link until you review the evidence.</p>'+
   '<label>Reviewed by <input id="link-reviewer" type="text" autocomplete="name"></label><label><input type="checkbox" id="link-review-ack"> I checked the cited '+(boq?'BOQ and programme':'payment and certificate')+' records and accept this link only.</label>'+
   '<div class="table-wrap"><table><thead><tr><th>'+(boq?'BOQ item':'Payment')+'</th><th>'+(boq?'Suggested programme activity':'Suggested certificate')+'</th><th>Match strength</th><th>Why CMeng suggests it</th><th>Decision</th></tr></thead><tbody>'+data.rows.map(r=>'<tr><td>'+escapeHtml(r.sourceLabel)+'</td><td>'+escapeHtml(r.targetLabel)+'</td><td>'+escapeHtml(percent2(r.confidence*100))+'%</td><td>'+escapeHtml(r.reason)+'<details><summary>Evidence used</summary>'+escapeHtml(r.sourceRefs.map(readerReference).join('; '))+'</details></td><td>'+escapeHtml(r.current?(r.state==='candidate'?'Awaiting review':r.state==='confirmed'?'Accepted':'Rejected'):'Project information changed — review again')+(r.current&&r.state==='candidate'?'<p><button class="btn small" data-link-review="confirm" data-link-id="'+escapeHtml(r.id)+'">Accept link</button> <button class="btn small" data-link-review="reject" data-link-id="'+escapeHtml(r.id)+'">Reject</button></p>':'')+(r.current&&r.state==='confirmed'?'<button class="btn small" data-link-review="reject" data-link-id="'+escapeHtml(r.id)+'">Withdraw acceptance</button>':'')+'</td></tr>').join('')+'</tbody></table></div><p>Showing '+escapeHtml(fmt(data.rows.length))+' of '+escapeHtml(fmt(data.total))+' saved suggestions.</p>'+
   '<button class="btn small" '+(offset?'':'disabled ')+'onclick="loadLinkCandidates(&quot;'+kind+'&quot;,'+Math.max(0,offset-25)+')">Previous</button> <button class="btn small" '+(data.hasMore?'':'disabled ')+'onclick="loadLinkCandidates(&quot;'+kind+'&quot;,'+(offset+25)+')">Next</button><p id="link-review-message" role="status"></p>';
  const details=el('link-candidate-review');if(details)details.open=true;
 }catch(e){if(owner===project()&&seq===projectRequestSeq&&target.isConnected)target.textContent='Suggested links could not be loaded. Project data remains unchanged.';}
}
async function suggestSourceLinks(matchOffset=0,sourceOverride=null){
 const state=linkCandidateReviewState;if(!state||state.owner!==project()||state.seq!==projectRequestSeq)return;
 const sourceId=sourceOverride||el('link-source-select')?.value;if(!sourceId)return;
 const target=el('link-review-message');if(target)target.textContent='Checking the eligible project information for likely links. Nothing will be changed.';
 try{const r=await api('/api/projects/'+encodeURIComponent(state.owner)+'/link-candidates/suggest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:state.data.kind,sourceId,expectedVersion:state.data.projectVersion,matchOffset})});
  if(state.owner!==project()||state.seq!==projectRequestSeq)return;
  await loadLinkCandidates(state.data.kind);
  const select=el('link-source-select');if(select&&[...select.options].some(o=>o.value===sourceId))select.value=sourceId;
  const message=el('link-review-message');if(message){const noun=state.data.kind==='boq_activity'?'programme activities':'certificates',start=(r.batchOffset??0)+1,end=(r.batchOffset??0)+(r.targetsReviewedThisBatch??0),summary='CMeng screened '+fmt(r.eligibleTargetCount??0)+' eligible '+noun+'. This review set covered '+fmt(start)+'–'+fmt(end)+'. '+(r.rows?.length?'Review the evidence before accepting any suggested link.':'No sufficiently supported link was found in this set. Nothing was changed.');message.innerHTML=escapeHtml(summary)+(r.nextOffset!==null&&r.nextOffset!==undefined?' <button type="button" class="btn small" data-link-more="'+escapeHtml(String(r.nextOffset))+'" data-link-source="'+escapeHtml(sourceId)+'">Continue search</button>':' <span>Full eligible population checked.</span>');}
 }catch(e){if(state.owner===project()&&state.seq===projectRequestSeq&&target?.isConnected)target.textContent='Suggestions could not be completed. Check the project information and owner access, then retry.';}
}
document.addEventListener('click',async event=>{
 const more=event.target.closest?.('[data-link-more]');if(more){await suggestSourceLinks(Number(more.dataset.linkMore)||0,more.dataset.linkSource||null);return;}
 const button=event.target.closest?.('[data-link-review]');if(!button)return;
 const state=linkCandidateReviewState;if(!state||state.owner!==project()||state.seq!==projectRequestSeq)return;
 const reviewer=el('link-reviewer')?.value?.trim(),confirmed=el('link-review-ack')?.checked===true,message=el('link-review-message');
 if(!reviewer||!confirmed){if(message)message.textContent='Enter the reviewer name and confirm that you checked the cited records.';return;}
 button.disabled=true;
 try{await api('/api/projects/'+encodeURIComponent(state.owner)+'/link-candidates/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:button.dataset.linkId,decision:button.dataset.linkReview,expectedVersion:state.data.projectVersion,reviewer,confirmed})});
  if(state.owner!==project()||state.seq!==projectRequestSeq)return;
  await loadModule(selected);await loadLinkCandidates(state.data.kind);
 }catch(e){if(state.owner===project()&&message?.isConnected)message.textContent='The decision was not saved. Refresh the project information and try again.';button.disabled=false;}
});
`;
