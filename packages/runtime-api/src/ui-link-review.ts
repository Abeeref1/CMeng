export const linkReviewScript=String.raw`
function linkReviewToolbar(key){
 const kind=['payments','commercial-overview'].includes(key)?'payment_certificate':['quantity-scurve','progress-breakdown','boq-scope','construction-locations'].includes(key)?'boq_activity':null;
 return kind?'<div class="delivery-toolbar"><button class="btn small" onclick="openRecordLinkReview(\''+kind+'\')">Review '+(kind==='boq_activity'?'BOQ–programme':'payment–certificate')+' relationships</button></div>':'';
}
async function openRecordLinkReview(kind){
 const owner=project();document.getElementById('recordLinkReview')?.remove();
 const panel=document.createElement('section');panel.id='recordLinkReview';panel.className='planning-panel primary';
 panel.innerHTML='<h4>'+escapeHtml(kind==='boq_activity'?'BOQ–programme relationship review':'Payment–certificate relationship review')+'</h4><p>Suggestions are not confirmed links. Reviewing a relationship never changes quantities, money, source dates or allocations.</p><div class="delivery-toolbar"><label>Find source record <input type="search" id="recordLinkQuery" placeholder="Item or payment reference"></label><button class="btn" id="recordLinkRules">Suggest with rules</button><button class="btn" id="recordLinkAi">Suggest with AI</button><button class="btn" id="recordLinkPrevious">Previous</button><button class="btn" id="recordLinkNext">Next</button><button class="btn" id="recordLinkClose">Close</button></div><p id="recordLinkFeedback" role="status"></p><div id="recordLinkRows"></div>';
 el('moduleContent').prepend(panel);panel.scrollIntoView({block:'start'});
 const url='/api/projects/'+encodeURIComponent(owner)+'/link-review';let offset=0,ticket=0,data=null,busy=false;
 const feedback=text=>{if(panel.isConnected)panel.querySelector('#recordLinkFeedback').textContent=text;};
 const post=body=>api(url+(body.candidateId?'/decide':'/propose'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const controls=()=>{panel.querySelector('#recordLinkRules').disabled=busy||!data?.sources?.length;panel.querySelector('#recordLinkAi').disabled=busy||!data?.providerAllowed||!data?.sources?.length;panel.querySelector('#recordLinkPrevious').disabled=busy||offset===0;panel.querySelector('#recordLinkNext').disabled=busy||!data?.hasMore;};
 async function load(){const serial=++ticket;busy=true;controls();try{
  const next=await api(url+'?kind='+kind+'&offset='+offset+'&q='+encodeURIComponent(panel.querySelector('#recordLinkQuery').value));
  if(!panel.isConnected||owner!==project()||serial!==ticket)return;data=next;
  const sourceText=data.sources.map(row=>'<div><b>'+escapeHtml(row.reference)+'</b> · '+escapeHtml(row.label)+'</div>').join('');
  const rows=data.candidates.map((row,i)=>'<tr><td>'+escapeHtml(row.sourceLabel)+'</td><td>'+escapeHtml(row.targetLabel)+'</td><td>'+escapeHtml(row.aiAssessment||row.method==='ai'?'AI suggestion':row.method==='manual'?'User suggestion':'Rule-based suggestion')+((row.aiAssessment?.confidence??row.confidence)==null?'':' · '+escapeHtml(fmt((row.aiAssessment?.confidence??row.confidence)*100))+'%')+'</td><td>'+escapeHtml(row.aiAssessment?.reason??row.reason)+'</td><td>'+escapeHtml(humanizeKey(row.state))+'</td><td>'+(data.confirmationAllowed&&row.state!=='source_changed'?'<button class="btn small" data-link-index="'+i+'" data-link-decision="'+(row.state==='confirmed'?'revoked':'confirmed')+'">'+(row.state==='confirmed'?'Revoke':'Confirm')+'</button> <button class="btn small" data-link-index="'+i+'" data-link-decision="rejected">Reject</button>':'Verified-user review required')+'</td></tr>').join('');
  panel.querySelector('#recordLinkRows').innerHTML='<p>Showing '+(data.sources.length?offset+1:0)+'–'+(offset+data.sources.length)+' of '+fmt(data.matchingSources)+' matching source records; '+fmt(data.totalSources)+' total. '+fmt(data.counts.confirmed)+' confirmed relationships; '+fmt(data.counts.proposed)+' awaiting review; '+fmt(data.counts.sourceChanged)+' need review against changed sources.</p>'+sourceText+'<div class="table-wrap"><table><thead><tr><th>Source record</th><th>Related record</th><th>Suggestion</th><th>Reason</th><th>Review state</th><th>Decision</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  for(const button of panel.querySelectorAll('[data-link-index]'))button.onclick=async()=>{
   const row=data.candidates[Number(button.dataset.linkIndex)],decision=button.dataset.linkDecision;
   const reason=window.prompt('State the source-based reason for this relationship decision:');if(!reason)return;
   const sourceRef=window.prompt('Enter the supporting document/page/record reference:');if(!sourceRef)return;
   busy=true;controls();button.disabled=true;try{const result=await post({kind,basisHash:data.basisHash,candidateId:row.id,decision,reason,sourceRef});await load();feedback(result.message);}catch(error){feedback(error.message||'Decision not saved.');}finally{busy=false;controls();}
  };
  feedback(data.providerAllowed?'AI suggestions are optional, bounded and require confirmation.':data.providerConfigured?'AI provider is configured. Verified owner permission and the agreed model are required to use it.':'AI provider is not configured. Rule-based suggestions remain available.');
 }catch(error){feedback(error.message||'Source relationships could not be loaded.');}finally{busy=false;if(panel.isConnected)controls();}}
 async function suggest(useAi){if(busy||!data)return;busy=true;controls();feedback('Checking this source batch; no values or allocations are being changed.');try{const result=await post({kind,basisHash:data.basisHash,sourceIds:data.sources.map(row=>row.id),useAi});await load();feedback(result.message+(result.providerState==='failed_rules_retained'?' AI was unavailable; rule-based suggestions were retained.':''));}catch(error){feedback(error.message||'Suggestions could not be saved.');}finally{busy=false;controls();}}
 panel.querySelector('#recordLinkRules').onclick=()=>suggest(false);panel.querySelector('#recordLinkAi').onclick=()=>suggest(true);
 panel.querySelector('#recordLinkPrevious').onclick=()=>{offset=Math.max(0,offset-10);load();};panel.querySelector('#recordLinkNext').onclick=()=>{offset+=10;load();};
 let queryTimer;panel.querySelector('#recordLinkQuery').oninput=()=>{clearTimeout(queryTimer);queryTimer=setTimeout(()=>{offset=0;load();},250);};
 panel.querySelector('#recordLinkClose').onclick=()=>{clearTimeout(queryTimer);++ticket;panel.remove();};await load();
}
`;
