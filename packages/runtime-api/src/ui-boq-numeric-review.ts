export const boqNumericReviewStyles=String.raw`
.boq-review-dialog{width:min(1280px,96vw);max-height:94vh;border:1px solid #c5d2df;border-radius:12px;padding:0;color:#243649}.boq-review-dialog::backdrop{background:#15263888}.boq-review-head,.boq-review-foot{padding:16px 20px;background:#f6f9fc}.boq-review-head h2{margin:0 0 8px}.boq-review-body{padding:16px 20px;overflow:auto;max-height:65vh}.boq-review-source{margin:16px 0;border:1px solid #dae3ec;border-radius:9px;padding:14px}.boq-review-source summary{font-weight:700;cursor:pointer}.boq-review-source input[type=number]{width:105px;padding:7px;border:1px solid #b7c8d8;border-radius:5px}.boq-review-tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0}.boq-review-foot{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.boq-review-attention{color:#885515}.boq-review-note{font-size:12px;color:#53697e}.boq-review-source iframe{width:100%;height:520px;border:1px solid #d7e1ec}.boq-review-source .table-wrap{max-height:370px}.boq-review-close{float:right}
`;
export const boqNumericReviewScript=String.raw`
let boqReviewSession=null;
async function openBoqNumericReview(){
 const owner=project();if(!owner)return;
 let dialog=el('boqNumericReviewDialog');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='boqNumericReviewDialog';dialog.className='boq-review-dialog';document.body.appendChild(dialog);}
 dialog.innerHTML='<div class="boq-review-head"><button class="btn boq-review-close" onclick="this.closest(\'dialog\').close()">Close</button><h2>Review BOQ readings</h2><p role="status">Loading the remaining readings…</p></div>';
 if(!dialog.open)dialog.showModal();
 try{
  const data=await api('/api/projects/'+encodeURIComponent(owner)+'/boq/numeric-review');
  if(project()!==owner){dialog.close();return;}
  if(!boqReviewSession||boqReviewSession.owner!==owner||boqReviewSession.data.reviewToken!==data.reviewToken)boqReviewSession={owner,data,selected:new Set(),drafts:new Map(),pages:new Map(),batchId:null,payload:null};
  else boqReviewSession.data=data;
  renderBoqNumericReview();
 }catch(e){dialog.innerHTML='<div class="boq-review-head"><button class="btn boq-review-close" onclick="this.closest(\'dialog\').close()">Close</button><h2>BOQ review could not load</h2><p>'+escapeHtml(e.message)+'</p></div>';}
}
function boqReviewKey(source,row){return source.ingestionId+'|'+row.itemId;}
function boqReviewValues(source,row){return boqReviewSession.drafts.get(boqReviewKey(source,row))||row.values;}
function updateBoqReviewSelection(sourceIndex,rowIndex,checked){const s=boqReviewSession.data.sources[sourceIndex],r=s.rows[rowIndex],key=boqReviewKey(s,r);if(checked)boqReviewSession.selected.add(key);else boqReviewSession.selected.delete(key);boqReviewSession.payload=null;updateBoqReviewCount();}
function editBoqReviewValue(sourceIndex,rowIndex,field,text){const s=boqReviewSession.data.sources[sourceIndex],r=s.rows[rowIndex],key=boqReviewKey(s,r),values={...boqReviewValues(s,r)};values[field]=text===''?null:Number(text);boqReviewSession.drafts.set(key,values);boqReviewSession.selected.add(key);boqReviewSession.payload=null;const cb=el('boq-select-'+sourceIndex+'-'+rowIndex);if(cb)cb.checked=true;updateBoqReviewCount();}
function updateBoqReviewCount(){const count=el('boqReviewSelected');if(count)count.textContent=boqReviewSession.selected.size+' item(s) selected';}
function selectBoqReviewedGroup(index,checked){const source=boqReviewSession.data.sources[index];for(const row of source.rows){if(row.arithmeticConflict||row.values.quantity===null)continue;const key=boqReviewKey(source,row);if(checked)boqReviewSession.selected.add(key);else boqReviewSession.selected.delete(key);}boqReviewSession.payload=null;renderBoqNumericReview();}
function pageBoqReview(index,change){boqReviewSession.pages.set(index,Math.max(0,(boqReviewSession.pages.get(index)||0)+change));renderBoqNumericReview();}
function viewBoqReviewPage(sourceIndex,page){const source=boqReviewSession.data.sources[sourceIndex],target=el('boq-original-'+sourceIndex),url='/api/projects/'+encodeURIComponent(boqReviewSession.owner)+'/boq/numeric-review/source/'+encodeURIComponent(source.ingestionId);target.hidden=false;target.innerHTML=source.mediaType==='application/pdf'?'<iframe title="Original BOQ page" src="'+url+'#page='+(page||1)+'"></iframe>':'<a class="btn" href="'+url+'" target="_blank" rel="noopener">Download original source</a>';}
function renderBoqNumericReview(){
 const session=boqReviewSession,dialog=el('boqNumericReviewDialog');if(!session||!dialog)return;
 const data=session.data;
 const sources=data.sources.map((source,si)=>{
  if(!source.pendingCount)return '';
  const page=Math.min(session.pages.get(si)||0,Math.max(0,Math.ceil(source.rows.length/50)-1)),start=page*50;
  const attention=source.rows.filter(r=>r.arithmeticConflict||r.values.quantity===null).length;
  const rows=source.rows.slice(start,start+50).map((row,n)=>{const ri=start+n,values=boqReviewValues(source,row),key=boqReviewKey(source,row);
   return '<tr><td><input type="checkbox" id="boq-select-'+si+'-'+ri+'" aria-label="Select item '+escapeHtml(row.itemNumber||row.itemId)+'" '+(session.selected.has(key)?'checked':'')+' onchange="updateBoqReviewSelection('+si+','+ri+',this.checked)"></td><td><b>'+escapeHtml(row.itemNumber||'Unnumbered')+'</b><br>'+escapeHtml(row.description)+'<br><small>'+escapeHtml(row.unit||'Unit not established')+'</small></td>'+['quantity','rate','amount'].map(field=>'<td><input type="number" step="any" aria-label="'+field+' for item '+escapeHtml(row.itemNumber||row.itemId)+'" value="'+(values[field]===null?'':escapeHtml(values[field]))+'" oninput="editBoqReviewValue('+si+','+ri+',\''+field+'\',this.value)"></td>').join('')+'<td class="boq-review-note">'+row.reasons.map(escapeHtml).join('<br>')+(source.sourceAvailable?'<br><button class="btn small" onclick="viewBoqReviewPage('+si+','+(row.page||1)+')">Original'+(row.page?' page '+row.page:' source')+'</button>':'<br>Original source is not available in this project.')+'</td></tr>';
  }).join('');
  return '<details class="boq-review-source" open><summary>'+escapeHtml(source.filename)+' · '+source.pendingCount+' readings · '+attention+' need closer attention</summary><p class="boq-review-note">'+source.automaticCount+' native rows used automatically; '+source.confirmedCount+' reviewed rows already saved. Blank price fields stay blank.</p><div class="boq-review-tools"><label><input type="checkbox" onchange="selectBoqReviewedGroup('+si+',this.checked)"> Select consistent rows I checked against this source</label>'+(source.sourceAvailable?'<button class="btn" onclick="viewBoqReviewPage('+si+',1)">View original</button>':'')+'<button class="btn" '+(page===0?'disabled':'')+' onclick="pageBoqReview('+si+',-1)">Previous</button><span>Items '+(start+1)+'–'+Math.min(start+50,source.rows.length)+' of '+source.rows.length+'</span><button class="btn" '+(start+50>=source.rows.length?'disabled':'')+' onclick="pageBoqReview('+si+',1)">Next</button></div><div class="table-wrap"><table><thead><tr><th>Use</th><th>Item / unit</th><th>Quantity</th><th>Rate</th><th>Amount</th><th>Source check</th></tr></thead><tbody>'+rows+'</tbody></table></div><div id="boq-original-'+si+'" hidden></div></details>';
 }).join('');
 dialog.innerHTML='<div class="boq-review-head"><button class="btn boq-review-close" onclick="this.closest(\'dialog\').close()">Close</button><h2>Review remaining BOQ readings</h2><p>'+data.pendingCount+' item(s) remaining. '+data.automaticCount+' native rows need no confirmation. '+data.confirmedCount+' previously reviewed rows are saved.</p><p class="boq-review-note">Save reviewed rows together. One decision updates every affected view; it does not approve contract scope or certify installed work.</p></div><div class="boq-review-body">'+(sources||'<p>All numeric reviews are saved. There is nothing to confirm again.</p>')+'</div><div class="boq-review-foot"><span id="boqReviewSelected"></span><label><input id="boqReviewSourceChecked" type="checkbox"> I checked the selected figures against the original source</label><button id="boqReviewSave" class="btn primary" '+(!data.pendingCount?'disabled':'')+' onclick="saveBoqNumericReview()">Save reviewed figures together</button><p id="boqReviewMessage" role="status"></p></div>';
 updateBoqReviewCount();
}
async function saveBoqNumericReview(){
 const session=boqReviewSession,message=el('boqReviewMessage');
 if(!session||session.owner!==project()){if(message)message.textContent='Open this review again for the current project.';return;}
 if(!el('boqReviewSourceChecked').checked){message.textContent='Check the selected figures against the source, then tick the source check.';return;}
 const items=session.data.sources.flatMap(s=>s.rows.filter(r=>session.selected.has(boqReviewKey(s,r))).map(r=>({ingestionId:s.ingestionId,sourceHash:s.sourceHash,itemId:r.itemId,fingerprint:r.fingerprint,values:boqReviewValues(s,r)})));
 if(!items.length){message.textContent='Select the rows you reviewed.';return;}
 if(items.some(r=>Object.values(r.values).some(v=>v!==null&&!Number.isFinite(v)))){message.textContent='Use numbers or leave absent fields blank.';return;}
 session.payload=session.payload||{batchId:crypto.randomUUID(),reviewToken:session.data.reviewToken,reviewedSource:true,items};
 el('boqReviewSave').disabled=true;message.textContent='Saving the review and updating the project…';
 try{
  const result=await api('/api/projects/'+encodeURIComponent(session.owner)+'/boq/numeric-review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(session.payload)});
  if(project()!==session.owner){el('boqNumericReviewDialog').close();return;}
  session.data=result;session.selected.clear();session.drafts.clear();session.payload=null;renderBoqNumericReview();
  el('boqReviewMessage').textContent='Saved. '+result.pendingCount+' reading(s) remain; the reviewed figures are reused throughout this project.';
  await refresh(false);
 }catch(e){message.textContent=e.message+' Your entered values remain here.';el('boqReviewSave').disabled=false;}
}
`;
