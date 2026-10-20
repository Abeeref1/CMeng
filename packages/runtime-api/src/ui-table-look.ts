// Shared look rules for every table, filter list and chart panel on the page (T10: L5, L6, S2, S3).
// Tables are built as HTML strings in many places, so the rules are applied once, here, to whatever
// is put on the page: sortable headers (keyboard buttons with aria-sort), a reason for an empty table,
// filter lists with no real choice switched off, and a reason instead of an empty chart panel.
// Nothing here changes a figure: sorting only reorders rows that are already on the screen.
// N11: an ID or code column that repeats one value on every row is said once above the table.
export const tableLookStyles=String.raw`
.th-sort{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:5px;cursor:pointer;font:inherit;color:inherit;text-align:left;width:100%}
.th-sort::after{content:"\2195";font-size:10px;opacity:.55}
th[aria-sort="ascending"] .th-sort::after{content:"\2191";opacity:1}
th[aria-sort="descending"] .th-sort::after{content:"\2193";opacity:1}
.th-sort:focus-visible{outline:2px solid #1f5fa8;outline-offset:2px;border-radius:3px}
button:focus-visible,a:focus-visible,select:focus-visible,input:focus-visible,summary:focus-visible,textarea:focus-visible,[tabindex]:focus-visible{outline:2px solid #1f5fa8;outline-offset:2px}
.look-empty-row td{color:#4a5a6d;font-style:italic;padding:12px}
.look-filter-single{opacity:.75}
.look-filter-note{display:block;font-size:11px;color:#4a5a6d;margin-top:2px}
.look-constant-col{display:none!important}
.look-constant-note{margin:4px 0 6px;font-size:12px;color:#4a5a6d}
.reader-id-items{display:flex;flex-wrap:wrap;gap:3px 6px;list-style:none;margin:6px 0 0;padding:0;font-size:12px}
.reader-id-items li{padding:1px 6px;border:1px solid #dfe6ee;border-radius:5px;background:#fbfdff}
.formula-list{margin:6px 0;font-size:12px}.formula-list dt{font-weight:650;margin-top:6px}.formula-list dd{margin:2px 0 0 0}
`;
export const tableLookScript=String.raw`
const LOOK_UNKNOWN_WORDS=/^(?:|-|\u2013|\u2014|n\/a|na|none|not available|not established|not confirmed|not stated|not recorded|not calculated|not comparable|not known|unknown|missing|withheld)$/i;
const LOOK_MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
function lookCellSortKey(text){
 const raw=String(text==null?'':text).replace(/\s+/g,' ').trim();
 if(LOOK_UNKNOWN_WORDS.test(raw))return {kind:'unknown',value:raw.toLowerCase()};
 const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
 if(iso)return {kind:'date',value:Date.UTC(+iso[1],+iso[2]-1,+iso[3],+(iso[4]||0),+(iso[5]||0))};
 const dmy=raw.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})(?: (\d{2}):(\d{2}))?/);
 if(dmy&&LOOK_MONTHS[dmy[2].toLowerCase()]!==undefined)return {kind:'date',value:Date.UTC(+dmy[3],LOOK_MONTHS[dmy[2].toLowerCase()],+dmy[1],+(dmy[4]||0),+(dmy[5]||0))};
 const num=raw.match(/^([+\-\u2212]?)(?:[A-Z]{3} )?(\d[\d,]*(?:\.\d+)?|\.\d+)(?=$|[\s%]|[a-zA-Z])/);
 if(num){const value=Number(num[2].replace(/,/g,''));if(Number.isFinite(value))return {kind:'number',value:(num[1]==='-'||num[1]==='\u2212')?-value:value};}
 return {kind:'text',value:raw.toLowerCase()};
}
function lookCompareSortKeys(a,b,direction){
 // Unknown values always go last, whatever the direction, so they are never read as the smallest number.
 if(a.kind==='unknown'||b.kind==='unknown')return a.kind===b.kind?0:a.kind==='unknown'?1:-1;
 const sign=direction==='descending'?-1:1;
 if(a.kind===b.kind&&a.kind!=='text')return sign*(a.value-b.value);
 if(a.kind!=='text'&&b.kind==='text')return -1*sign;
 if(a.kind==='text'&&b.kind!=='text')return sign;
 if(a.kind!==b.kind)return sign*(a.kind<b.kind?-1:1);
 return sign*String(a.value).localeCompare(String(b.value),undefined,{numeric:true});
}
function lookHeaderRow(table){
 const head=table.tHead;if(!head||!head.rows||!head.rows.length)return null;
 return head.rows[head.rows.length-1];
}
function lookBodyRows(table){
 const rows=[];for(const body of Array.from(table.tBodies||[]))for(const row of Array.from(body.rows||[]))rows.push(row);
 return rows;
}
function lookColumnCount(table){
 const header=lookHeaderRow(table);
 if(!header)return 1;
 return Array.from(header.cells||[]).reduce((n,cell)=>n+(Number(cell.colSpan)||1),0)||1;
}
function lookIsStateRow(row){
 return row.classList&&row.classList.contains('look-empty-row')||((row.cells||[]).length===1&&(Number(row.cells[0].colSpan)||1)>1);
}
function lookSortableRows(table){
 const rows=lookBodyRows(table);
 // Group rows, detail rows and messages span several columns; reordering them would break the table.
 if(rows.some(row=>lookIsStateRow(row)||Array.from(row.cells||[]).some(cell=>(Number(cell.rowSpan)||1)>1)))return null;
 return rows;
}
function lookSortTable(table,columnIndex,direction){
 const rows=lookSortableRows(table);
 if(!rows||rows.length<2||!table.tBodies||table.tBodies.length!==1)return false;
 const keyed=rows.map((row,order)=>({row,order,key:lookCellSortKey(row.cells[columnIndex]?row.cells[columnIndex].textContent:'')}));
 keyed.sort((a,b)=>lookCompareSortKeys(a.key,b.key,direction)||a.order-b.order);
 const body=table.tBodies[0];
 keyed.forEach(item=>body.appendChild(item.row));
 const header=lookHeaderRow(table);
 Array.from(header.cells).forEach((cell,index)=>{if(cell.querySelector('.th-sort'))cell.setAttribute('aria-sort',index===columnIndex?direction:'none');});
 return true;
}
// W5: the full reason is said once per page; later empty tables on the same page
// say it short. The page root is the topmost element the table sits in.
function lookPageRoot(node){
 let root=node;while(root&&root.parentNode&&root.parentNode.nodeType===1)root=root.parentNode;
 return root!==node&&root&&root.querySelectorAll?root:null;
}
function lookSaidOnPage(node,selector,text){
 const root=lookPageRoot(node);
 return root?Array.from(root.querySelectorAll(selector)).some(item=>(item.textContent||'').trim()===text):false;
}
function lookEmptyReason(table){
 const owner=table.closest?table.closest('[data-empty-reason]'):null;
 const stated=table.getAttribute('data-empty-reason')||(owner?owner.getAttribute('data-empty-reason'):'');
 if(stated)return stated;
 const scope=table.closest?table.closest('section,details,.card,.planning-panel,.module-panel,[data-paged-group]'):null;
 const filters=scope?Array.from(scope.querySelectorAll('select,input[type=search],input[type=text]')).filter(control=>control.value&&!/^all\b/i.test(control.options&&control.selectedIndex>=0?control.options[control.selectedIndex].text:'')):[];
 return filters.length
  ?'No rows match the selected filters. Clear or change the filters to see more rows.'
  :lookSaidOnPage(table,'.look-empty-row','No records of this kind are in the current project documents for this view.')?'No records of this kind.':'No records of this kind are in the current project documents for this view.';
}
function lookMarkEmptyTable(table){
 const rows=lookBodyRows(table);
 const existing=rows.filter(row=>row.classList&&row.classList.contains('look-empty-row'));
 const real=rows.filter(row=>!(row.classList&&row.classList.contains('look-empty-row')));
 if(real.length){existing.forEach(row=>row.remove());return false;}
 if(existing.length)return false;
 let body=table.tBodies&&table.tBodies[0];
 if(!body){body=table.ownerDocument.createElement('tbody');table.appendChild(body);}
 const row=table.ownerDocument.createElement('tr');row.className='look-empty-row';
 const cell=table.ownerDocument.createElement('td');cell.colSpan=lookColumnCount(table);cell.textContent=lookEmptyReason(table);
 row.appendChild(cell);body.appendChild(row);
 return true;
}
function lookEnhanceTableHeaders(table){
 const header=lookHeaderRow(table);if(!header)return 0;
 let added=0;
 Array.from(header.cells).forEach((cell,index)=>{
  if(cell.querySelector('.th-sort')||cell.querySelector('input,select,button,a,textarea'))return;
  const label=(cell.textContent||'').replace(/\s+/g,' ').trim();if(!label)return;
  const button=cell.ownerDocument.createElement('button');
  button.type='button';button.className='th-sort';button.setAttribute('data-sort-column',String(index));
  button.setAttribute('aria-label','Sort by '+label);
  while(cell.firstChild)button.appendChild(cell.firstChild);
  cell.appendChild(button);
  if(!cell.hasAttribute('aria-sort'))cell.setAttribute('aria-sort','none');
  added++;
 });
 return added;
}
// N11: an ID or code column (WBS, calendar, ID, code, number, reference) that holds the same value on
// every one of 10 or more rows is said once above the table ('All rows: WBS 10') instead of on every
// row. The cells stay in the table, only hidden, so sorting, search and downloads keep every value; the
// column comes back as soon as the rows on screen differ (another page, filter or sort).
const LOOK_ID_HEADING=/^(?:wbs|calendar|id|code|no\.?|number|ref(?:erence)?|.+ (?:id|code|no\.?|number|ref(?:erence)?))$/i;
function lookCellText(cell){return String(cell&&cell.textContent||'').replace(/\s+/g,' ').trim();}
function lookConstantColumns(table){
 const header=lookHeaderRow(table),rows=header?lookSortableRows(table):null,found=[];
 if(header&&rows&&rows.length>=10&&Array.from(header.cells||[]).every(cell=>(Number(cell.colSpan)||1)===1)&&rows.every(row=>(row.cells||[]).length===header.cells.length)){
  Array.from(header.cells).forEach((cell,index)=>{
   const label=lookCellText(cell);if(!LOOK_ID_HEADING.test(label))return;
   const cells=rows.map(row=>row.cells[index]);
   if(cells.some(c=>c.querySelector&&c.querySelector('button,a,input,select,textarea,details')))return;
   const value=lookCellText(cells[0]);
   if(!value||LOOK_UNKNOWN_WORDS.test(value)||cells.some(c=>lookCellText(c)!==value))return;
   found.push({index,label,value});
  });
 }
 if(!found.length&&!table.__lookConstant)return false;
 const hidden=new Set(found.map(c=>c.index));
 [header,...lookBodyRows(table)].filter(Boolean).forEach(row=>Array.from(row.cells||[]).forEach((cell,index)=>{
  const on=hidden.has(index)&&!lookIsStateRow(row);
  if(on!==cell.classList.contains('look-constant-col')){if(on)cell.classList.add('look-constant-col');else cell.classList.remove('look-constant-col');}
 }));
 const text=found.length?'All rows: '+found.map(c=>c.label+' '+c.value).join(' · '):'';
 const wrap=table.parentNode&&table.parentNode.classList&&table.parentNode.classList.contains('table-wrap')?table.parentNode:table;
 let note=table.__lookConstantNote||null;
 if(!text){if(note){note.remove();table.__lookConstantNote=null;}}
 else{
  if(!note){note=table.ownerDocument.createElement('p');note.className='look-constant-note';note.setAttribute('data-look-constant-note','');table.__lookConstantNote=note;}
  if(note.textContent!==text)note.textContent=text;
  if(note.nextElementSibling!==wrap&&wrap.parentNode)wrap.parentNode.insertBefore(note,wrap);
 }
 table.__lookConstant=found.map(c=>c.index+'='+c.value).join('|');
 return found.length>0;
}
function lookEnhanceTable(table){
 if(!table||table.closest&&table.closest('[data-look-skip]'))return;
 lookEnhanceTableHeaders(table);
 lookMarkEmptyTable(table);
 lookConstantColumns(table);
 // L3: a long table that arrives later inside collapsed detail also shows 25 rows at a time.
 if(typeof pageTablePager==='function')pageTablePager(table);
}
function lookFilterChoices(select){
 return Array.from(select.options||[]).filter(option=>!option.disabled&&!/^all\b/i.test((option.textContent||'').trim())&&option.value!=='');
}
function lookCheckFilter(select){
 if(!select||select.multiple)return;
 const hasAll=Array.from(select.options||[]).some(option=>/^all\b/i.test((option.textContent||'').trim())||option.value==='');
 const choices=lookFilterChoices(select);
 // A filter list is only a filter when it offers "All" plus at least one other value, or two values.
 const noChoice=hasAll?choices.length===0:false;
 if(noChoice&&!select.disabled){
  select.disabled=true;select.setAttribute('data-look-no-choice','true');select.classList.add('look-filter-single');
  select.title='No other values in this data to filter by';
  if(!select.nextElementSibling||!select.nextElementSibling.classList.contains('look-filter-note')){
   const note=select.ownerDocument.createElement('small');note.className='look-filter-note';note.textContent=lookSaidOnPage(select,'.look-filter-note','No other values in this data to filter by.')?'No other values.':'No other values in this data to filter by.';
   select.insertAdjacentElement('afterend',note);
  }
 }else if(!noChoice&&select.getAttribute('data-look-no-choice')==='true'){
  select.disabled=false;select.removeAttribute('data-look-no-choice');select.classList.remove('look-filter-single');select.removeAttribute('title');
  const note=select.nextElementSibling;if(note&&note.classList.contains('look-filter-note'))note.remove();
 }
}
function lookCheckChartPanel(panel){
 // A chart panel whose body is blank would be drawn empty: say why instead.
 const body=panel.querySelector('.visual-chart-body');
 if(!body||body.children.length||(body.textContent||'').trim())return false;
 const reason=panel.ownerDocument.createElement('div');reason.className='empty-visual';reason.setAttribute('data-chart-state','empty');
 reason.textContent='No values are established for this chart in the current project documents, so no chart is drawn.';
 body.appendChild(reason);
 return true;
}
function lookApply(root){
 if(!root||!root.querySelectorAll)return;
 if(root.tagName==='TABLE')lookEnhanceTable(root);
 root.querySelectorAll('table').forEach(lookEnhanceTable);
 root.querySelectorAll('select').forEach(lookCheckFilter);
 root.querySelectorAll('[data-visual-panel]').forEach(lookCheckChartPanel);
}
function lookHandleSortClick(event){
 const button=event.target&&event.target.closest?event.target.closest('.th-sort'):null;
 if(!button)return;
 const cell=button.closest('th,td'),table=button.closest('table');if(!cell||!table)return;
 const index=Array.from(cell.parentNode.cells).indexOf(cell);
 const direction=cell.getAttribute('aria-sort')==='ascending'?'descending':'ascending';
 if(!lookSortTable(table,index,direction)){
  const rows=lookBodyRows(table).filter(row=>!lookIsStateRow(row));
  button.title=rows.length<2?'Fewer than two rows to sort':'This table has grouped rows and keeps its source order';
 }
}
function lookStart(){
 if(typeof document==='undefined'||!document.body)return;
 document.addEventListener('click',lookHandleSortClick);
 lookApply(document.body);
 if(typeof MutationObserver==='undefined')return;
 let pending=new Set(),scheduled=false;
 const flush=()=>{scheduled=false;const roots=[...pending];pending=new Set();roots.forEach(node=>{if(node.isConnected!==false){lookApply(node);const table=node.closest&&node.closest('table');if(table)lookEnhanceTable(table);}});};
 new MutationObserver(records=>{
  for(const record of records){
   const target=record.target&&record.target.nodeType===1?record.target:record.target&&record.target.parentElement;
   if(!target||target.closest&&target.closest('.look-empty-row'))continue;
   pending.add(target);
  }
  if(!scheduled){scheduled=true;(typeof requestAnimationFrame==='function'?requestAnimationFrame:setTimeout)(flush);}
 }).observe(document.body,{childList:true,subtree:true});
}
`;
