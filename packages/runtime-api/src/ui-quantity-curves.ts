/** Independent item curves share no additive quantity authority. Browse the
 * complete item population, retaining the full time history for each selection. */
import {countTextSource} from './count-text';
export const quantityCurvesScript=String.raw`${countTextSource()}
let quantityCurveBrowserState=null;
function quantityCurveContextActive(s){
 return s===quantityCurveBrowserState&&s.result===(typeof currentModuleResult==='undefined'?null:currentModuleResult)&&
  s.owner===(typeof project==='function'?project():null)&&s.seq===(typeof projectRequestSeq==='undefined'?null:projectRequestSeq);
}
function quantityCurveBrowserHtml(s){
 const rows=s.rows,start=rows.length?s.offset+1:0,end=s.offset+rows.length,more=end<s.total;
 const selection=rows.length?'<label>BOQ item on this page <select aria-label="Quantity curve item" onchange="selectQuantityItemCurve(this.value)">'+rows.map((r,i)=>'<option value="'+i+'"'+(i===s.selected?' selected':'')+'>'+escapeHtml((r.itemNumber||r.quantityItemId||'Item')+' · '+(r.description||r.unit||'Description not recorded'))+'</option>').join('')+'</select></label>':'<p>No BOQ items match this search.</p>';
 const row=rows[s.selected];
 const curve=row?(row.points?.length?quantityItemCurve(row,s.projection):'<p>No dated curve is established for this item. Its source quantity and mapping basis remain available below.</p>'):'';
 const navigation=s.offset>0||more?'<div class="actions"><button class="btn small" '+(s.offset===0?'disabled ':'')+'onclick="loadQuantityCurvePage('+Math.max(0,s.offset-25)+')">Previous items</button><button class="btn small" '+(more?'':'disabled ')+'onclick="loadQuantityCurvePage('+end+')">Next items</button></div>':'';
 return '<p>Showing '+fmt(start)+'–'+fmt(end)+' of '+fmt(s.total)+(s.query?' '+countNoun(s.total,'matching item')+'; '+fmt(s.sourceTotal)+' BOQ item curves in total.': ' BOQ item curves.')+' Each item keeps its own unit and full date history.</p>'+selection+'<div id="quantityItemCurve">'+curve+'</div>'+navigation+'<p id="quantityCurveFeedback" role="status"></p>';
}
function renderQuantityCurveBrowser(p){
 const population=responseListPopulation(p.series),result=typeof currentModuleResult==='undefined'?null:currentModuleResult;
 const s={projection:p,result,owner:typeof project==='function'?project():null,seq:typeof projectRequestSeq==='undefined'?null:projectRequestSeq,
  source:population.source,pointer:population.pointer,version:result?.responsePaging?.projectVersion??null,
  allRows:p.series,rows:p.series.slice(0,25),offset:0,total:population.total,sourceTotal:population.total,query:'',selected:0,request:0};
 quantityCurveBrowserState=s;
 return '<section class="planning-panel"><div class="planning-panel-head"><h4>Individual BOQ item curves</h4></div><div class="planning-panel-body"><label>Find item number, description or unit <input id="quantityCurveQuery" maxlength="100" onkeydown="if(event.key===\'Enter\'){event.preventDefault();searchQuantityCurves();}"></label><button class="btn small" onclick="searchQuantityCurves()">Search all items</button><div id="quantityCurveBrowser">'+quantityCurveBrowserHtml(s)+'</div></div></section>';
}
function searchQuantityCurves(){return loadQuantityCurvePage(0,el('quantityCurveQuery')?.value??'');}
async function loadQuantityCurvePage(offset,query){
 const s=quantityCurveBrowserState,target=el('quantityCurveBrowser');if(!s||!target||!quantityCurveContextActive(s))return;
 const request=++s.request,q=String(query??s.query).trim().slice(0,100),at=Math.max(0,Math.floor(offset));
 if(!Number.isFinite(at))return;
 const feedback=el('quantityCurveFeedback');if(feedback)feedback.textContent='Loading item curves…';
 try{
  let page;
  if(s.source&&s.pointer){
   const params=new URLSearchParams({source:s.source,pointer:s.pointer,offset:String(at),q});
   if(Number.isInteger(s.version))params.set('version',String(s.version));
   page=await api('/api/projects/'+encodeURIComponent(s.owner)+'/record-page?'+params);
  }else{
   const matched=q?s.allRows.filter(r=>[r.quantityItemId,r.itemNumber,r.description,r.unit,r.unitKey].some(v=>String(v??'').toLowerCase().includes(q.toLowerCase()))):s.allRows;
   page={rows:matched.slice(at,at+25),offset:at,total:matched.length,sourceTotal:s.allRows.length};
  }
  if(!quantityCurveContextActive(s)||s.request!==request||!target.isConnected)return;
  if(!Array.isArray(page.rows)||page.rows.some(r=>!r||!Array.isArray(r.points))||!Number.isInteger(page.total)||!Number.isInteger(page.offset)||page.offset!==at||
    (Number.isInteger(s.version)&&Number.isInteger(page.projectVersion)&&s.version!==page.projectVersion))throw Error('Item curve population changed');
  Object.assign(s,{rows:page.rows,offset:page.offset,total:page.total,sourceTotal:page.sourceTotal??s.sourceTotal,query:q,selected:0});
  target.innerHTML=quantityCurveBrowserHtml(s);
 }catch(error){if(quantityCurveContextActive(s)&&s.request===request&&target.isConnected){const node=el('quantityCurveFeedback');if(node)node.textContent='The item curves could not be loaded. Previous values are retained; retry or refresh the page if project data changed.';}}
}
function selectQuantityItemCurve(index){
 const s=quantityCurveBrowserState,i=Number(index),target=el('quantityItemCurve');
 if(!s||!quantityCurveContextActive(s)||!target||!Number.isInteger(i)||i<0||i>=s.rows.length)return;
 s.selected=i;const row=s.rows[i];target.innerHTML=row.points.length?quantityItemCurve(row,s.projection):'<p>No dated curve is established for this item.</p>';
}
`;
