export const boqPageReviewStyles=String.raw`
.boq-page-layout{display:grid;grid-template-columns:minmax(300px,42%) minmax(400px,58%);gap:12px}.boq-page-layout iframe{width:100%;height:620px;border:1px solid #bccbd8}.boq-page-layout .table-wrap{max-height:580px;overflow:auto}.boq-page-layout input,.boq-page-layout textarea,.boq-page-layout select{max-width:100%;padding:5px;box-sizing:border-box}.boq-page-layout textarea{min-width:180px;min-height:56px}.boq-page-layout input[type=number]{width:90px}.boq-page-status{padding:10px;background:#eef3f8}.boq-page-review table{min-width:1000px}@media(max-width:900px){.boq-page-layout{grid-template-columns:1fr}.boq-page-layout iframe{height:350px}}
`;
export const boqPageReviewScript=String.raw`
let boqPageSession=null;
function renderBoqPageOverview(){
 const data=boqReviewSession?.pageData;if(!data?.sources?.length)return '';
 return '<section class="boq-page-review"><h3>Source page completeness</h3><p>Check missing or combined items against the original. Numerical confirmation alone does not establish a complete page.</p>'+data.sources.map((s,si)=>'<div class="boq-review-source"><b>'+escapeHtml(s.filename)+'</b><p>'+s.automaticItemCount+' automatically extracted items · '+s.reviewedCoveragePercent+'% of pages accounted for through automatic reading or source review.</p><label>Source page <select id="boqPageChoice-'+si+'">'+s.pages.map(p=>'<option value="'+p.page+'">Page '+p.page+' · '+escapeHtml(({confirmed:'Review saved',automatic:'Automatically accounted for',reopened:'Reopened',needs_review:'Needs review'})[p.status])+' · '+p.automaticItemCount+' extracted items</option>').join('')+'</select></label> <button class="btn" onclick="openBoqPageEditor('+si+')">Review selected page</button></div>').join('')+'<div id="boqPageEditor"></div></section>';
}
async function openBoqPageEditor(sourceIndex){
 const owner=boqReviewSession.owner,oldSource=boqReviewSession.pageData.sources[sourceIndex],pageNumber=Number(el('boqPageChoice-'+sourceIndex).value),target=el('boqPageEditor');
 try{
  const data=await api('/api/projects/'+encodeURIComponent(owner)+'/boq/page-review');if(project()!==owner)return;
  boqReviewSession.pageData=data;const source=data.sources.find(s=>s.ingestionId===oldSource.ingestionId),page=source?.pages.find(p=>p.page===pageNumber);
  if(!page)throw Error('The source page changed. Reopen the BOQ review.');
  const key=source.ingestionId+'|'+pageNumber+'|'+page.reviewToken;
  if(!boqReviewSession.pageDrafts)boqReviewSession.pageDrafts=new Map();
  if(!boqReviewSession.pageDrafts.has(key))boqReviewSession.pageDrafts.set(key,{rows:JSON.parse(JSON.stringify(page.items)),note:page.note||'',selected:new Set(),payload:null});
  boqPageSession={owner,source,page,key,draft:boqReviewSession.pageDrafts.get(key)};renderBoqPageEditor();
 }catch(e){target.textContent=e.message;}
}
function editBoqPageField(index,field,value){
 const d=boqPageSession.draft,row=d.rows[index];if(['quantity','rate','amount'].includes(field))row.values[field]=value===''?null:Number(value);else row[field]=value===''&&['itemNumber','section','unit','currency'].includes(field)?null:value;
 d.payload=null;const check=el('boqPageAttest');if(check)check.checked=false;
}
function addBoqPageItem(after){
 const d=boqPageSession.draft;d.rows.splice(after+1,0,{id:'added-'+crypto.randomUUID(),origins:[],kind:'item',itemNumber:null,section:null,description:'',unit:null,currency:null,values:{quantity:null,rate:null,amount:null},note:''});d.selected.clear();d.payload=null;renderBoqPageEditor();
}
function splitBoqPageItem(index){
 const d=boqPageSession.draft,row=d.rows[index],second=JSON.parse(JSON.stringify(row));second.id='split-'+crypto.randomUUID();
 row.values={quantity:null,rate:null,amount:null};second.values={quantity:null,rate:null,amount:null};d.rows.splice(index+1,0,second);d.selected.clear();d.payload=null;renderBoqPageEditor();
 el('boqPageMessage').textContent='Two items retained. Enter each description and its own source figures before confirming.';
}
function combineBoqPageItems(){
 const d=boqPageSession.draft,indices=[...d.selected].sort((a,b)=>a-b);if(indices.length<2){el('boqPageMessage').textContent='Select at least two fragments from this source page.';return;}
 const selected=indices.map(i=>d.rows[i]),first=indices[0],combined={...selected[0],id:'combined-'+crypto.randomUUID(),origins:[...new Set(selected.flatMap(r=>r.origins))],description:selected.map(r=>r.description).join(' '),values:{quantity:null,rate:null,amount:null},note:selected.map(r=>r.note).filter(Boolean).join('; ')};
 d.rows=d.rows.filter((r,i)=>!d.selected.has(i));d.rows.splice(first,0,combined);d.selected.clear();d.payload=null;renderBoqPageEditor();el('boqPageMessage').textContent='Fragments combined. Check the description, unit and source figures before confirming.';
}
function renderBoqPageEditor(){
 const session=boqPageSession;if(!session)return;const {source,page,draft:d}=session,locked=page.status==='confirmed',disabled=locked?' disabled':'';
 const input=(i,r,f,type='text')=>'<input type="'+type+'" aria-label="'+f+' item '+(i+1)+'" value="'+escapeHtml((type==='number'?r.values[f]:r[f])??'')+'"'+(type==='number'?' step="any"':'')+disabled+' oninput="editBoqPageField('+i+',\''+f+'\',this.value)">';
 const rows=d.rows.map((r,i)=>'<tr><td><input type="checkbox" aria-label="Select fragment '+(i+1)+'"'+disabled+' onchange="this.checked?boqPageSession.draft.selected.add('+i+'):boqPageSession.draft.selected.delete('+i+')"><br>'+(i+1)+'</td><td>'+input(i,r,'itemNumber')+'<textarea aria-label="Description item '+(i+1)+'"'+disabled+' oninput="editBoqPageField('+i+',\'description\',this.value)">'+escapeHtml(r.description)+'</textarea><select aria-label="Source role item '+(i+1)+'"'+disabled+' onchange="editBoqPageField('+i+',\'kind\',this.value)"><option value="item" '+(r.kind==='item'?'selected':'')+'>BOQ item</option><option value="non_item" '+(r.kind==='non_item'?'selected':'')+'>Heading / other source text</option></select><br><button class="btn small"'+disabled+' onclick="addBoqPageItem('+i+')">Add after</button> <button class="btn small"'+disabled+' onclick="splitBoqPageItem('+i+')">Split</button></td><td>'+input(i,r,'section')+'</td><td>'+input(i,r,'unit')+'</td>'+['quantity','rate','amount'].map(f=>'<td>'+input(i,r,f,'number')+'</td>').join('')+'<td>'+input(i,r,'currency')+'</td><td>'+input(i,r,'note')+'</td></tr>').join('');
 const url='/api/projects/'+encodeURIComponent(session.owner)+'/boq/numeric-review/source/'+encodeURIComponent(source.ingestionId)+'#page='+page.page;
 el('boqPageEditor').innerHTML='<h3>'+escapeHtml(source.filename)+' · Page '+page.page+'</h3><p class="boq-page-status">Automatically extracted: '+page.automaticItemCount+' · Added through saved review: '+page.addedItemCount+' · Reviewed items: '+(page.reviewedItemCount??'Not confirmed')+'</p>'+(locked?'<p>Page review saved. Reopen it to correct a decision. Original evidence remains unchanged.</p>':'<p>Account for every item on this page. Missing figures remain blank. Explain heading text and genuinely absent quantities.</p>')+'<div class="boq-page-layout">'+(source.sourceAvailable?'<iframe title="Original source page '+page.page+'" src="'+url+'"></iframe>':'<p>Original source unavailable. Confirmation is blocked.</p>')+'<div><div class="table-wrap"><table><thead><tr><th>Select / order</th><th>Item / description</th><th>Section</th><th>Unit</th><th>Quantity</th><th>Rate</th><th>Amount</th><th>Currency</th><th>Source note</th></tr></thead><tbody>'+rows+'</tbody></table></div><button class="btn"'+disabled+' onclick="addBoqPageItem(boqPageSession.draft.rows.length-1)">Add item at end</button> <button class="btn"'+disabled+' onclick="combineBoqPageItems()">Combine selected fragments</button></div></div><label>Page note <input id="boqPageNote" value="'+escapeHtml(d.note)+'"'+disabled+' oninput="boqPageSession.draft.note=this.value;boqPageSession.draft.payload=null;el(\'boqPageAttest\').checked=false"></label><p><label><input id="boqPageAttest" type="checkbox"'+disabled+'> I checked the entire source page and accounted for every BOQ item.</label></p><button id="boqPageSave" class="btn primary" '+(!source.sourceAvailable?'disabled':'')+' onclick="saveBoqPageReview(\''+(locked?'reopen':'confirm')+'\')">'+(locked?'Reopen page review':'Save page review')+'</button><p id="boqPageMessage" role="status"></p>';
}
async function saveBoqPageReview(action){
 const s=boqPageSession,message=el('boqPageMessage');if(!s||s.owner!==project()){message.textContent='Reopen the review for the current project.';return;}
 if(action==='confirm'&&!el('boqPageAttest').checked){message.textContent='Check the complete source page before confirming.';return;}
 const d=s.draft;d.payload=d.payload||{requestId:crypto.randomUUID(),reviewToken:s.page.reviewToken,ingestionId:s.source.ingestionId,sourceHash:s.source.sourceHash,revisionId:s.source.revisionId,page:s.page.page,action,reviewedSource:action==='confirm',items:d.rows,note:d.note};
 el('boqPageSave').disabled=true;
 try{
  const result=await api('/api/projects/'+encodeURIComponent(s.owner)+'/boq/page-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d.payload)});
  if(project()!==s.owner)return;boqReviewSession.pageDrafts.delete(s.key);boqReviewSession.pageData=result;
  s.source=result.sources.find(x=>x.ingestionId===s.source.ingestionId);s.page=s.source.pages.find(p=>p.page===s.page.page);s.draft={rows:JSON.parse(JSON.stringify(s.page.items)),note:s.page.note||'',selected:new Set(),payload:null};
  s.key=s.source.ingestionId+'|'+s.page.page+'|'+s.page.reviewToken;boqReviewSession.pageDrafts.set(s.key,s.draft);
  boqReviewSession.data=await api('/api/projects/'+encodeURIComponent(s.owner)+'/boq/numeric-review');if(project()!==s.owner)return;
  renderBoqNumericReview();renderBoqPageEditor();el('boqPageMessage').textContent=action==='confirm'?'Page review saved. Corrected items are reused throughout this project.':'Page reopened. Its completeness is no longer confirmed.';await refresh(false);
 }catch(e){message.textContent=e.message+' Your corrections remain here.';el('boqPageSave').disabled=false;}
}
`;
