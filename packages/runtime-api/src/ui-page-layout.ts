/** L1/L3 (guard): one shared page layout for every CMeng page.
 * The first screen answers the page's question: the page verdict, the key
 * tiles and the main chart stay open. Every other panel and long table goes,
 * in page order, into collapsed groups under one "More detail" area. Nothing
 * is removed or changed: blocks are only moved, with their ids, handlers and
 * styles. A page shows at most 15 collapsed sections: the collapsed sections
 * of a moved panel merge into its More detail group, so each group opens with
 * one click and shows its whole content. A page that already fits (3 screens,
 * 15 collapsed sections) keeps its layout. Opened detail stays short
 * (compactPageDetail): long tables show 25 rows at a time, blocks of the same
 * kind share one selector, and a More detail that would still pass 20 screens or 15
 * tables when opened is read on detail pages; every row, block and group stays on
 * the page. */
export const pageLayoutStyles=String.raw`
.page-more-detail{margin:24px 0 0;padding-top:14px;border-top:1px solid #dce4ee}.page-more-detail>h4{margin:0 0 10px;font-size:15px;color:#294766}
.page-detail-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:start}
.page-detail-groups>details{margin:0!important;border:1px solid #dce4ee!important;border-radius:8px!important;background:#fff!important;box-shadow:none!important;overflow:hidden;min-width:0;padding:0!important}
.page-detail-groups>details[open]{grid-column:1/-1}
.page-detail-groups>details>summary{display:flex;align-items:center;gap:10px;min-height:42px;padding:10px 14px!important;margin:0!important;cursor:pointer;font-size:13.5px!important;font-weight:650;line-height:1.35;background:#f9fbfd!important;color:#294766;list-style:none;border:0!important}
.page-detail-groups>details>summary::-webkit-details-marker{display:none}.page-detail-groups>details>summary:before{content:'+';font-size:17px;font-weight:400}.page-detail-groups>details[open]>summary:before{content:'−'}
.page-detail-groups>details>summary span{font-size:12px;color:#61738a;font-weight:400;margin-left:auto}
.page-detail-body{padding:16px}.page-detail-body>*:last-child{margin-bottom:0}.page-detail-body .page-detail-title-shown{display:none}
.row-evidence{display:block;font-size:12px;line-height:1.45;color:#526479;overflow-wrap:anywhere}.row-evidence b{font-weight:650;color:#3d5570}
.table-row-paged,.page-kind-hidden,.page-detail-off{display:none!important}
.page-detail-pager{margin:0 0 12px;padding:10px 12px;border:1px solid #dce4ee;border-radius:8px;background:#f9fbfd;font-size:12.5px;color:#294766}
.page-detail-pager-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.page-detail-pager-bar [role="status"]{font-weight:650}
.page-detail-index{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:4px}.page-detail-index li{display:flex;flex-wrap:wrap;gap:3px 12px;align-items:baseline}
.page-detail-index li>span{font-weight:650;min-width:52px;color:#61738a}.page-detail-index li[aria-current="true"]>span{color:#16324f}
.page-detail-index button{all:unset;cursor:pointer;color:#1f5fa8;text-decoration:underline;text-underline-offset:2px}
.table-pager{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 14px;font-size:12px;color:#526479}
.page-kind-pick{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:2px 0 12px;font-size:13px;color:#294766}.page-kind-pick>b{font-weight:650;margin-right:2px}.page-kind-pick select{max-width:min(100%,640px)}.page-kind-pick span{font-size:12px;color:#61738a}
.page-kind-option{border:1px solid #cfdbe8;background:#fff;color:#294766;border-radius:999px;padding:5px 11px;font:inherit;font-size:12.5px;line-height:1.3;cursor:pointer;text-align:left}.page-kind-option[aria-pressed="true"]{background:#e8f0f9;border-color:#7d9cc0;font-weight:650}
.page-said-once,.page-unknown-col{display:none!important}.page-unknown-once{margin:4px 0 8px;font-size:12.5px;color:#526479}.page-unknown-once b{font-weight:650;color:#3d5570}.page-panel-basis{margin:10px 0 0!important;font-size:12px!important;color:#61738a!important}
@media(max-width:900px){.page-detail-groups{grid-template-columns:1fr}}
@media print{.page-detail-groups{display:block}.table-row-paged{display:table-row!important}.page-kind-hidden,.page-detail-off{display:block!important}.table-pager,.page-kind-pick,.page-detail-pager{display:none!important}}
`;
export const pageLayoutScript=String.raw`
const PAGE_SCREEN_PX=700;
const PAGE_DEFAULT_SCREENS=3;
// Room kept below the 3-screen limit for content a page fills in after it is drawn.
const PAGE_LATE_CONTENT_PX=120;
const PAGE_MAX_CLOSED_SECTIONS=15;
const PAGE_LONG_TABLE_ROWS=8;
const PAGE_ACTION_MAX_PX=220;
// Containers that only group other blocks: the role view, the analysis area,
// the page view and its grids. Their blocks are arranged one by one.
const PAGE_WRAPPER_CLASS=/(?:^|\s)(?:role-view-[a-z-]+|role-primary-analysis|planning-view|planning-primary-grid|visual-chart-grid|experience-preview|management-two-column)(?:\s|$)/;
const PAGE_FIXED='.module-basis,.position-verdict,.view-state-bar,[role="alert"],.experience-notes.error';
const PAGE_TILE='.planning-kpi,.kpi-card,.kpi,.scalar,.metric-card,.position-card,.experience-kpi,.experience-fact,.management-metric-card,.pmc-domain-card,.currency-card';
const PAGE_CHART='[data-visual-panel],.visual-chart,.chart-card,svg.svg-chart,.float-histogram,.milestone-date-chart,.lookahead-timeline,.certificate-columns,.date-ladder,.pressure-matrix,.cash-movement-bars,.waterfall-chart,.signed-bars,.status-band,.constraint-bars,.finish-period-bars,.donut-ring,.visual-bars';
function pageNodeVisible(node){return !!(node&&node.offsetParent!==null);}
// Shown on the screen: rendered and not inside a closed section (a summary line is shown).
function pageNodeShown(node){
 if(!pageNodeVisible(node))return false;
 let parent=node.parentElement;
 if(node.tagName==='SUMMARY'&&parent)parent=parent.parentElement;
 return !parent?.closest('details:not([open])');
}
function pageBlockHeight(node){
 const box=node.getBoundingClientRect();let margin=0;
 try{const style=getComputedStyle(node);margin=(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0);}catch{}
 return (box.height||0)+margin;
}
function pageIsWrapper(node){
 if(node.tagName==='DETAILS'||node.id||!['DIV','SECTION'].includes(node.tagName))return false;
 if(!PAGE_WRAPPER_CLASS.test(' '+String(node.className||'')+' '))return false;
 for(const attribute of Array.from(node.attributes||[]))if(/^data-/.test(attribute.name))return false;
 return node.children.length>0;
}
// The page's blocks in page order, each with the wrapper chain it sits in.
function pageBlocks(container){
 const out=[];
 const walk=(parent,chain)=>{
  for(const child of Array.from(parent.children)){
   if(['STYLE','SCRIPT','TEMPLATE','LINK'].includes(child.tagName))continue;
   if(pageIsWrapper(child))walk(child,chain.concat(child));
   else if(String(child.textContent||'').trim()||child.querySelector('svg,canvas,img,table'))out.push({node:child,chain});
  }
 };
 walk(container,[]);
 return out;
}
function pageVisibleTableRows(node){
 let rows=0;
 for(const table of Array.from(node.querySelectorAll('table')))if(pageNodeShown(table))rows=Math.max(rows,table.querySelectorAll('tbody tr').length);
 return rows;
}
function pageClosedSections(node){
 return Array.from(node.querySelectorAll('details')).filter(d=>!d.open&&pageNodeVisible(d.querySelector('summary'))).length;
}
function pageShows(node,selector){
 return !!node.matches?.(selector)||Array.from(node.querySelectorAll(selector)).some(pageNodeShown);
}
// The first heading of a block (its element and first line), or none.
function pageBlockHeading(node){
 const line=text=>String(text||'').split('\n').map(s=>s.trim()).find(Boolean)||'';
 if(node.tagName==='DETAILS'){const summary=node.querySelector(':scope>summary');return {el:summary,text:summary?line(summary.innerText||summary.textContent):''};}
 const heading=node.matches('h1,h2,h3,h4,h5')?node:node.querySelector('h1,h2,h3,h4,h5,summary');
 if(heading)return {el:heading,text:line(heading.innerText||heading.textContent)};
 const lead=node.querySelector(':scope>b,:scope>strong');
 return {el:lead,text:lead?line(lead.innerText||lead.textContent).replace(/\s*[:·]\s*$/,''):''};
}
function pageBlockTitle(node){return pageBlockHeading(node).text;}
function pageShortTitle(title){title=String(title||'').trim();return title.length>90?title.slice(0,87).replace(/\s+\S*$/,'')+'…':title;}
function pageGroupTitle(titles){
 const named=[...new Set(titles.filter(Boolean))];
 if(!named.length)return 'Further information';
 if(named.length<=3)return pageShortTitle(named.join(' · '));
 return pageShortTitle(named.slice(0,2).join(' · '))+' and '+(named.length-2)+' more';
}
// P3 (owner rule): the page's management answer leads, its actions follow, and
// qualifications and system evidence come after them. The verdict, alerts and the
// programme / Data Date line always stay; then, while the first screens hold them,
// the reading box, the key tiles, a block the page renderer names as part of its
// answer (data-page-answer) and the main chart, the primary panel, the page actions
// and a second row of tiles. A long table, a collapsed section and a block of system
// evidence (readiness, evidence snapshot, calculation checks) never lead the page.
const PAGE_EVIDENCE='[data-page-role="evidence"],.module-evidence-link,.experience-scope-note,.experience-audit,.page-review-summary,[data-owner-topic="cross-module-consistency"]';
function pageIsAction(node){
 if(node.matches('[data-page-role="action"],.actions,.action-notification'))return true;
 return !!node.querySelector('button')&&!node.querySelector('table')&&!node.matches(PAGE_EVIDENCE)&&pageBlockHeight(node)<=PAGE_ACTION_MAX_PX;
}
function pageAnswerRank(node,seen){
 if(node.matches(PAGE_FIXED)&&node.tagName!=='DETAILS')return 0;
 if(node.matches(PAGE_EVIDENCE)||pageIsUnknownOnly(node))return -1;
 if(node.tagName==='DETAILS'||node.matches('.owner-link-panel'))return -1;
 // A chart is the page's answer even when a long table sits under it in the same block.
 if(!seen.chart&&pageShows(node,PAGE_CHART)&&!node.matches('[data-page-answer]')){seen.chart=true;return 3;}
 if(pageVisibleTableRows(node)>PAGE_LONG_TABLE_ROWS)return -1;
 if(node.matches('.experience-management-reading'))return 1;
 const tiles=pageShows(node,PAGE_TILE);
 if(tiles&&!seen.tiles&&!node.matches('[data-page-answer]')){seen.tiles=1;return 2;}
 if(node.matches('[data-page-answer]'))return 3;
 if(!seen.chart&&pageShows(node,PAGE_CHART)){seen.chart=true;return 3;}
 if(!seen.primary&&node.matches('.primary')){seen.primary=true;return 4;}
 // A short notice or card with a button is a page action (for example "Upload register").
 if(pageIsAction(node))return 5;
 if(tiles&&seen.tiles===1){seen.tiles=2;return 6;}
 return -1;
}
// P3: the order on the page, for every page (also one that already fits 3 screens).
// Within each group of sibling blocks: the verdict (the answer), the one-line
// programme and Data Date context, a system alert, the page's own content, its
// actions, then qualifications and system evidence. Blocks are only moved.
// A short line that only says a figure is unknown (for example "BOQ coverage: Not
// calculable, because ...") is a qualification. It never opens a page: it follows
// the page's answer and its actions, and moves to More detail on a long page.
function pageIsUnknownOnly(node){
 if(node.matches('.position-verdict,.module-basis,[role="alert"]'))return false;
 if(node.querySelector('table,svg,canvas,.planning-kpi,.experience-fact,.pmc-domain-card'))return false;
 const copy=node.cloneNode(true);for(const button of Array.from(copy.querySelectorAll('button,a.btn')))button.remove();
 const text=String(copy.textContent||'').replace(/\s+/g,' ').trim();
 return text.length>0&&text.length<=320&&/\b(?:not calculable|not established|not available|not assessable|cannot (?:yet )?be (?:calculated|established|assessed))\b/i.test(text);
}
function pageOrderKey(node,hasVerdict){
 if(node.matches('.position-verdict'))return 0;
 if(node.matches('.view-state-bar'))return hasVerdict?2:0;
 if(node.matches('.module-basis')&&node.tagName!=='DETAILS')return 1;
 if(node.matches('[role="alert"],.experience-notes.error'))return 2;
 if(node.matches(PAGE_EVIDENCE)||pageIsUnknownOnly(node))return 5;
 if(node.tagName!=='DETAILS'&&pageIsAction(node))return 4;
 return 3;
}
function pageAnswerFirst(container){
 const hasVerdict=!!container.querySelector('.position-verdict');
 let moved=0;
 const order=parent=>{
  const items=Array.from(parent.children).filter(child=>!['STYLE','SCRIPT','TEMPLATE','LINK'].includes(child.tagName)&&(String(child.textContent||'').trim()||child.querySelector('svg,canvas,img,table')));
  for(const child of items)if(pageIsWrapper(child))order(child);
  if(items.length<2)return;
  const keyed=items.map((node,i)=>({node,i,key:pageIsWrapper(node)?3:pageOrderKey(node,hasVerdict)}));
  const sorted=[...keyed].sort((a,b)=>a.key-b.key||a.i-b.i);
  if(sorted.every((item,i)=>item===keyed[i]))return;
  const anchor=document.createComment('page-order');parent.insertBefore(anchor,items[0]);
  for(const item of sorted)parent.insertBefore(item.node,anchor);
  anchor.remove();moved++;
 };
 order(container);
 // Inside a panel, the method note under its heading is a qualification: it follows the panel's answer.
 for(const note of Array.from(container.querySelectorAll('.planning-panel-head p,.pmc-control-head p,.pmc-domain-sub'))){
  const panel=note.closest('.planning-panel,.pmc-control-room,.pmc-domain-card');
  if(!panel||!String(note.textContent||'').trim()||note.closest('.position-verdict'))continue;
  note.classList.add('page-panel-basis');panel.appendChild(note);moved++;
 }
 return moved;
}
// P3: unknown information is stated once, not repeated per row or per block.
// (1) A table column that is unknown on every row is one line above the table.
// (2) The same unknown sentence on several rows of a column is one line above the
//     table; each row says "Not established" (the full sentence stays in the cell).
// (3) The same unknown sentence in several blocks of the page is said where it is
//     first shown. Nothing is removed: the repeats are only hidden.
const PAGE_UNKNOWN_VALUE=/^(?:not established|not available|unknown|not known|unresolved|not calculated|not calculable|not assessable|not recorded|not stated|not supplied|not confirmed|n\/a|[—–-])\.?$/i;
const PAGE_UNKNOWN_TEXT=/\b(?:not established|not available|not known|unresolved|cannot (?:yet )?be (?:calculated|established|priced|compared|assessed)|not calculable|not assessable|not recorded|not stated|not supplied|not confirmed|not linked|no [a-z ]{0,40}(?:supplied|recorded|provided|in the documents)|is missing|are missing)\b/i;
function pageNormal(text){return String(text||'').replace(/\s+/g,' ').trim();}
function pageUnknownNote(table,html){
 const host=table.closest('.table-wrap')||table;
 const line=document.createElement('p');line.className='page-unknown-once';line.innerHTML=html;
 host.parentNode.insertBefore(line,host);
 return line;
}
function pageSayUnknownOnce(container){
 let said=0;
 const esc=value=>String(value).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
 for(const table of Array.from(container.querySelectorAll('table'))){
  if(table.closest('.position-verdict')||table.dataset.pageUnknownOnce)continue;
  const head=table.tHead?.rows?.[table.tHead.rows.length-1];
  const rows=Array.from(table.tBodies||[]).flatMap(body=>Array.from(body.rows)).filter(row=>!head||row.cells.length===head.cells.length);
  if(!head||rows.length<3)continue;
  table.dataset.pageUnknownOnce='1';
  const allUnknown=[],repeated=[];
  for(let col=0;col<head.cells.length;col++){
   const texts=rows.map(row=>pageNormal(row.cells[col]?.textContent));
   const label=pageNormal(head.cells[col].textContent)||'Column '+(col+1);
   if(texts.every(text=>!text||PAGE_UNKNOWN_VALUE.test(text))&&texts.some(text=>text&&/[a-z]/i.test(text))&&head.cells.length>2){allUnknown.push({col,label});continue;}
   const counts=new Map();
   for(const text of texts)if(text.length>=30&&PAGE_UNKNOWN_TEXT.test(text))counts.set(text,(counts.get(text)||0)+1);
   for(const [text,count] of counts)if(count>=3)repeated.push({col,label,text,count});
  }
  if(allUnknown.length&&allUnknown.length<head.cells.length){
   const cols=new Set(allUnknown.map(item=>item.col));
   for(const row of [head,...rows])for(const col of cols)row.cells[col]?.classList.add('page-unknown-col');
   pageUnknownNote(table,'<b>Not established for every row:</b> '+esc(allUnknown.map(item=>item.label).join(', '))+'.');said++;
  }
  for(const item of repeated){
   for(const row of rows){
    const cell=row.cells[item.col];if(!cell||pageNormal(cell.textContent)!==item.text)continue;
    const full=document.createElement('span');full.className='page-said-once';
    while(cell.firstChild)full.appendChild(cell.firstChild);
    const short=document.createElement('span');short.className='page-unknown-short';short.textContent='Not established';
    cell.appendChild(short);cell.appendChild(full);cell.title=item.text;
   }
   pageUnknownNote(table,'<b>'+esc(item.label)+' ('+esc(item.count)+' rows):</b> '+esc(item.text));said++;
  }
 }
 // (4) A row of tiles where every tile is unknown is one line, not one tile per measure:
 // "Not established (Needs an interface register): Interfaces from registers, Blocked / overdue".
 for(const grid of Array.from(container.querySelectorAll('.planning-kpi-grid,.experience-facts,.kpi-grid'))){
  if(grid.dataset.pageUnknownOnce||grid.closest('.position-verdict'))continue;
  const tiles=Array.from(grid.children).filter(tile=>tile.matches(PAGE_TILE));
  if(tiles.length<2)continue;
  const read=tile=>({label:pageNormal(tile.querySelector('span,b,.label')?.textContent),value:pageNormal(tile.querySelector('strong,.value')?.textContent),
    note:pageNormal(tile.querySelector('small,.sub')?.textContent)});
  const unknown=tiles.map(tile=>({tile,...read(tile)})).filter(v=>v.label&&/^(?:not established|not available|not calculable|not assessable|unknown|not recorded|not supplied)\b/i.test(v.value));
  if(unknown.length<2)continue;
  grid.dataset.pageUnknownOnce='1';
  const reasons=[...new Set(unknown.map(v=>v.note.split('·')[0].trim()).filter(Boolean))];
  const line=document.createElement('p');line.className='page-unknown-once';
  line.innerHTML='<b>Not established'+(reasons.length===1?' ('+esc(reasons[0])+')':'')+':</b> '+esc(unknown.map(v=>v.label).join(', '))+'.';
  grid.parentNode.insertBefore(line,grid.nextSibling);
  for(const v of unknown)v.tile.classList.add('page-said-once');
  if(unknown.length===tiles.length)grid.classList.add('page-said-once');
  said++;
 }
 // (3) The same unknown sentence in several blocks: said once, where it is first shown.
 const groups=new Map();
 for(const node of Array.from(container.querySelectorAll('p,li,small,.notice,.pmc-domain-sub,.planning-kpi small,.experience-fact small'))){
  if(node.closest('table,summary,.page-said-once'))continue;
  const text=pageNormal(node.textContent);
  if(text.split(' ').length<8||text.length>400||!PAGE_UNKNOWN_TEXT.test(text))continue;
  let up=node.parentElement,inside=false;
  while(up&&up!==container){if(pageNormal(up.textContent)===text&&up.matches('p,li,small,.notice,.pmc-domain-sub')){inside=true;break;}up=up.parentElement;}
  if(inside)continue;
  if(!groups.has(text))groups.set(text,[]);
  groups.get(text).push(node);
 }
 for(const nodes of groups.values()){
  if(nodes.length<2)continue;
  const keep=nodes.find(pageNodeShown)||nodes[0];
  for(const node of nodes)if(node!==keep){node.classList.add('page-said-once');said++;}
 }
 return said;
}
// Copies of the wrappers a block came from (class and attributes, no id), so
// the moved block keeps its layout and style context.
function pageShellChain(chain){
 let outer=null,inner=null;
 for(const wrapper of chain){const shell=wrapper.cloneNode(false);shell.removeAttribute('id');if(inner)inner.appendChild(shell);else outer=shell;inner=shell;}
 return {outer,inner};
}
// Every move is logged so a layout that still runs past the first screens can be
// put back exactly as it was before the next, smaller answer is tried.
function pageMove(log,node,parent){
 const from=node.parentNode,next=node.nextSibling;
 parent.appendChild(node);
 log.push(()=>from.insertBefore(node,next));
}
function pageFillGroup(body,blocks,log){
 let chain=null,inner=null;
 for(const block of blocks){
  if(!block.chain.length){pageMove(log,block.node,body);chain=null;inner=null;continue;}
  const same=chain&&chain.length===block.chain.length&&block.chain.every((wrapper,i)=>wrapper===chain[i]);
  if(!same){const shells=pageShellChain(block.chain);body.appendChild(shells.outer);chain=block.chain;inner=shells.inner;}
  pageMove(log,block.node,inner);
 }
}
function pageDetailGroup(list,title,blocks,log){
 let details;
 if(blocks.length===1&&blocks[0].node.tagName==='DETAILS'){
  // A block that is already a collapsed section is the group itself (one click).
  details=blocks[0].node;
  if(blocks[0].chain.length){
   const content=Array.from(details.childNodes).filter(child=>child.nodeName!=='SUMMARY');
   const shells=pageShellChain(blocks[0].chain);
   details.appendChild(shells.outer);
   log.push(()=>shells.outer.remove());
   for(const child of content)pageMove(log,child,shells.inner);
  }
  if(!details.classList.contains('page-detail-group')){details.classList.add('page-detail-group');log.push(()=>details.classList.remove('page-detail-group'));}
  pageMove(log,details,list);
 }else{
  details=document.createElement('details');details.className='page-detail-group';
  const summary=document.createElement('summary');summary.textContent=title;
  if(blocks.length>1||title===PAGE_LINKED_TITLE){const note=document.createElement('span');note.textContent=countText(blocks.length,title===PAGE_LINKED_TITLE?'link':'part',undefined,fmt);summary.appendChild(note);}
  const body=document.createElement('div');body.className='page-detail-body';
  details.appendChild(summary);details.appendChild(body);
  // The group line already says a block's own heading: it is not said twice.
  for(const block of blocks){
   const heading=pageBlockHeading(block.node);
   const whole=heading.el?String(heading.el.textContent||'').replace(/\s+/g,' ').trim().replace(/\s*[:·]\s*$/,''):'';
   // A nested section's summary line may be the one said: its section opens with the group.
   const nestedLoads=heading.el?.tagName==='SUMMARY'&&pageLoadsOnOpen(heading.el.parentElement);
   if(heading.el&&heading.el!==block.node&&!nestedLoads&&heading.text&&whole===title){heading.el.classList.add('page-detail-title-shown');log.push(()=>heading.el.classList.remove('page-detail-title-shown'));}
   else if(heading.el?.tagName==='SUMMARY'&&!nestedLoads&&heading.text===title){
    // A summary with a note after its title: only the title text is not said twice.
    const text=Array.from(heading.el.childNodes).find(child=>child.nodeType===3&&child.nodeValue.trim());
    if(text&&text.nodeValue.trim()===title){
     const span=document.createElement('span');span.className='page-detail-title-shown';
     heading.el.insertBefore(span,text);span.appendChild(text);
     log.push(()=>{span.parentNode.insertBefore(text,span);span.remove();});
    }
   }
  }
  pageFillGroup(body,blocks,log);
  list.appendChild(details);
 }
 // The group is the one click: the collapsed sections inside it are shown when
 // it opens. A section that loads its content when opened keeps its own click.
 for(const inner of Array.from(details.querySelectorAll('details')))if(!inner.open&&!pageLoadsOnOpen(inner)){inner.open=true;log.push(()=>{inner.open=false;});}
 return details;
}
function pageLoadsOnOpen(node){return node.hasAttribute('ontoggle')||Object.keys(node.dataset||{}).some(key=>/lazy/i.test(key));}
function pageClosedTotal(container){return Array.from(container.querySelectorAll('details')).filter(d=>!d.open).length;}
// S1 and the first-screen rule: a line that says why one of the page's own figures
// is not established ("Future receipts not established: ...") stays open with the
// answer. A short panel that carries such a line stays whole; a long one keeps its
// heading and the reason lines open, and its other parts go to More detail under
// the panel's name.
const PAGE_UNKNOWN_LEAD=/\b(?:not established|cannot (?:yet )?be (?:calculated|priced)|not calculable|not assessable)\b[.:]?$/i;
const PAGE_UNKNOWN_SENTENCE=/^[^.:]{3,90}\b(?:not established|cannot (?:yet )?be (?:calculated|priced))\b[.:]/i;
const PAGE_REASON_FOLLOW=/^(?:Missing|Needs|Source inputs required|Provide|Upload|Confirm)\b/i;
const PAGE_REASON_PANEL_MAX_PX=300;
function pageUnknownReasons(node){
 const lines=[];
 const add=line=>{
  if(lines.includes(line))return;
  lines.push(line);
  for(let next=line.nextElementSibling;next&&next.tagName==='P'&&PAGE_REASON_FOLLOW.test(String(next.textContent||'').trim());next=next.nextElementSibling)if(!lines.includes(next))lines.push(next);
 };
 // A tile's own reason is part of its tile row; the verdict and the reading box always stay.
 const outside=el=>!el.closest('td,th,summary,.position-verdict,.experience-management-reading,'+PAGE_TILE);
 for(const lead of Array.from(node.querySelectorAll('b,strong'))){
  if(!pageNodeShown(lead)||!outside(lead)||!PAGE_UNKNOWN_LEAD.test(String(lead.textContent||'').trim()))continue;
  let line=lead.parentElement;
  while(line&&line!==node&&!/^(?:P|DIV|LI|SECTION|ARTICLE)$/.test(line.tagName))line=line.parentElement;
  add(line||node);
 }
 for(const line of Array.from(node.querySelectorAll('p')))if(pageNodeShown(line)&&outside(line)&&PAGE_UNKNOWN_SENTENCE.test(String(line.textContent||'').trim()))add(line);
 if(node.tagName==='P'&&PAGE_UNKNOWN_SENTENCE.test(String(node.textContent||'').trim()))add(node);
 return lines;
}
// The parts of a long panel: its headings and reason lines stay; every other part
// keeps the panel's own place in the answer order (or goes to More detail under
// the panel's own name, in its panel's style).
function pageSplitReasonBlock(block,lines,rank){
 const parts=[],title=pageBlockTitle(block.node);
 const walk=(parent,chain)=>{
  for(const child of Array.from(parent.children)){
   if(['STYLE','SCRIPT','TEMPLATE','LINK'].includes(child.tagName))continue;
   if(!String(child.textContent||'').trim()&&!child.querySelector('svg,canvas,img,table'))continue;
   const holds=lines.some(line=>child===line||child.contains(line)),height=pageBlockHeight(child);
   // A short part that holds a reason (a card, a notice) stays whole.
   // C1: an element with an id is a render target (for example the action panel that
   // Actions required re-renders by id). It is moved whole, never taken apart: moving
   // its children into id-less copies would strand them when the target is rendered again.
   if(holds&&!child.id&&!lines.includes(child)&&height>PAGE_REASON_PANEL_MAX_PX&&child.children.length&&!/^(?:DETAILS|TABLE|UL|OL)$/.test(child.tagName)){walk(child,chain.concat(child));continue;}
   const stays=holds||child.matches('h1,h2,h3,h4,h5,header,.planning-panel-head,.management-panel-head');
   parts.push({node:child,chain,rank:stays?0:rank>0?rank:-1,height,titleHint:title});
  }
 };
 walk(block.node,block.chain.concat(block.node));
 return parts;
}
const PAGE_LINKED_TITLE='Shown on other pages';
function pagePlanGroups(moved,limit){
 const groups=[];
 let linked=null;
 for(const block of moved){
  // The links to the pages that own a block are one group, at the first link's place.
  if(block.node.matches('.owner-link-panel')){
   if(linked){linked.blocks.push(block);linked.height+=block.height;}
   else{linked={titles:[PAGE_LINKED_TITLE],blocks:[block],height:block.height,closed:true,linked:true};groups.push(linked);}
   continue;
  }
  const own=block.titleHint&&block.node.tagName!=='DETAILS'?'':pageBlockTitle(block.node),title=own||block.titleHint||'',last=groups[groups.length-1];
  // The moved parts of one panel stay together under the panel's name.
  if(block.titleHint&&last&&last.hint===block.titleHint&&block.node.tagName!=='DETAILS'){last.blocks.push(block);last.height+=block.height;continue;}
  // A block without its own heading (a note, a line, a tile row) joins the group before it.
  if(!title&&last&&block.node.tagName!=='DETAILS'&&!last.closed){last.blocks.push(block);last.height+=block.height;continue;}
  groups.push({titles:[title],blocks:[block],height:block.height,closed:block.node.tagName==='DETAILS',hint:block.node.tagName==='DETAILS'?null:block.titleHint||null});
 }
 if(groups.length>1&&!groups[0].titles[0]&&!groups[0].closed&&!groups[1].closed){const first=groups.shift();groups[0].blocks.unshift(...first.blocks);groups[0].height+=first.height;}
 // The smallest neighbouring groups are merged until the page holds the limit.
 while(groups.length>limit){
  let best=0;
  for(let i=1;i<groups.length-1;i++)if(groups[i].height+groups[i+1].height<groups[best].height+groups[best+1].height)best=i;
  const a=groups[best],b=groups[best+1];
  groups.splice(best,2,{titles:a.titles.concat(b.titles),blocks:a.blocks.concat(b.blocks),height:a.height+b.height,closed:false});
 }
 return groups;
}
function arrangePageDetail(container){
 if(!container||!container.children||typeof container.querySelectorAll!=='function'||typeof container.getBoundingClientRect!=='function')return null;
 if(typeof document==='undefined'||typeof document.createElement!=='function'||container.isConnected===false)return null;
 const limitHeight=PAGE_DEFAULT_SCREENS*PAGE_SCREEN_PX,budget=limitHeight-PAGE_LATE_CONTENT_PX;
 // P3: on every page the answer leads, actions follow and evidence comes after; unknowns are said once.
 pageSayUnknownOnce(container);
 pageAnswerFirst(container);
 // A page that already fits keeps that order.
 if(container.scrollHeight<=limitHeight&&pageClosedTotal(container)<=PAGE_MAX_CLOSED_SECTIONS)return null;
 const blocks=pageBlocks(container);
 if(blocks.length<2)return null;
 const seen={},ranked=[];
 for(const block of blocks){
  const rank=pageAnswerRank(block.node,seen),height=pageBlockHeight(block.node);
  const lines=rank===0||block.node.tagName==='DETAILS'?[]:pageUnknownReasons(block.node);
  if(!lines.length)ranked.push({...block,rank,height});
  else if(height<=PAGE_REASON_PANEL_MAX_PX||lines.includes(block.node))ranked.push({...block,rank:0,height});
  else ranked.push(...pageSplitReasonBlock(block,lines,rank));
 }
 const frame=72,row=56,heading=72;
 const plan=keep=>{
  const moved=ranked.filter(block=>!keep.has(block));
  // The answer's own collapsed sections, and sections that load when opened, count too.
  const answerClosed=[...keep].reduce((sum,block)=>sum+pageClosedSections(block.node),0);
  const loading=moved.reduce((sum,block)=>sum+Array.from(block.node.querySelectorAll('details')).filter(d=>!d.open&&pageLoadsOnOpen(d)).length,0);
  const groups=pagePlanGroups(moved,Math.max(1,PAGE_MAX_CLOSED_SECTIONS-answerClosed-loading));
  const answer=[...keep].reduce((sum,block)=>sum+block.height+(block.chain.length?18:0),0);
  return {moved,groups,height:frame+answer+(groups.length?heading+Math.ceil(groups.length/2)*row:0)};
 };
 const keep=new Set(ranked.filter(block=>block.rank===0));
 const optional=[];
 for(const rank of [1,2,3,4,5,6])for(const block of ranked)if(block.rank===rank){keep.add(block);optional.push(block);}
 // The least important optional block goes first: the highest rank, then the tallest.
 // A page without a verdict keeps its last answer block (reading, tiles, answer or
 // chart) on the first screen even when it is tall: the answer never moves into
 // More detail, leaving only buttons on screen.
 const hasVerdict=!!container.querySelector('.position-verdict');
 const droppable=()=>{const answers=optional.filter(block=>block.rank<=4);
  return hasVerdict||answers.length>1?optional:optional.filter(block=>block.rank>4);};
 const dropOptional=()=>{
  const pool=droppable();if(!pool.length)return false;
  const drop=pool.reduce((worst,block)=>block.rank>worst.rank||block.rank===worst.rank&&block.height>worst.height?block:worst,pool[0]);
  optional.splice(optional.indexOf(drop),1);keep.delete(drop);return true;
 };
 let chosen=plan(keep);
 const dropped=[];
 while(chosen.height>budget&&droppable().length){const before=new Set(optional);dropOptional();dropped.push(...[...before].filter(block=>!optional.includes(block)));chosen=plan(keep);}
 // A smaller part of the answer dropped on the way comes back when the first
 // screens still hold it (short page actions are not brought back).
 for(const block of [...dropped].filter(block=>block.rank<6).sort((a,b)=>a.rank-b.rank||a.height-b.height)){
  keep.add(block);const trial=plan(keep);
  if(trial.height<=budget){optional.push(block);chosen=trial;}else keep.delete(block);
 }
 // Draw the More detail area at the end of the page, then measure: while the
 // first screens still run past 3 screens, put the page back and try again
 // without the least important optional block.
 for(;;){
  if(!chosen.groups.length)return null;
  const log=[];
  const area=document.createElement('section');
  area.className='page-more-detail';area.setAttribute('aria-label','More detail');
  const title=document.createElement('h4');title.textContent='More detail';area.appendChild(title);
  const list=document.createElement('div');list.className='page-detail-groups';area.appendChild(list);
  container.appendChild(area);log.push(()=>area.remove());
  for(const group of chosen.groups)pageDetailGroup(list,pageGroupTitle(group.titles),group.blocks,log);
  if(container.scrollHeight<=budget||!droppable().length)return {kept:keep.size,groups:chosen.groups.length};
  for(let i=log.length-1;i>=0;i--)log[i]();
  dropOptional();chosen=plan(keep);
 }
}
// L3: collapsed detail stays short when it is opened, and nothing is removed.
// (1) A table of more than 25 rows inside collapsed detail shows 25 rows at a time
// with Previous / Next; every row stays in the table, so sorting, search, print and
// downloads keep all of them. (2) Blocks of the same kind side by side in collapsed
// detail (the same ledger for each register, the same table for each period) are
// one block with a selector: one is shown and every other one is one choice away,
// in its own place. The first screen is never changed.
const PAGE_TABLE_PAGE_ROWS=25;
function pageCount(value){return Number(value).toLocaleString('en-US');}
function pageInDetail(node){
 if(!node?.closest||!node.closest('#moduleContent'))return false;
 if(node.closest('.page-more-detail'))return true;
 const section=node.closest('details');
 return !!section&&!section.open;
}
// A table that already pages its own rows (a "Showing …" line or Previous / Next
// beside it, or rows a script refills) keeps its own control.
function pageTableOwnPaging(table,wrap){
 if(table.closest('.diagnosis-table,[data-delivery-table],.paged-evidence-list,[data-own-paging]')||Array.from(table.tBodies).some(body=>body.id))return true;
 const near=[];
 for(let node=wrap.previousElementSibling,i=0;node&&i<2;node=node.previousElementSibling,i++)near.push(node);
 for(let node=wrap.nextElementSibling,i=0;node&&i<2;node=node.nextElementSibling,i++)near.push(node);
 return near.some(node=>node.matches('.source-population,[role="status"]')||/^Showing\b/i.test(String(node.textContent||'').trim())||
  Array.from(node.matches('button')?[node]:node.querySelectorAll('button')).some(button=>/^(?:previous|next)\b/i.test(String(button.textContent||'').trim())));
}
function pageTablePager(table){
 if(!table||table.__pageRows||!table.tBodies||table.tBodies.length!==1||typeof document==='undefined')return false;
 const rows=lookSortableRows(table);
 if(!rows||rows.filter(row=>!lookIsStateRow(row)).length<=PAGE_TABLE_PAGE_ROWS||!pageInDetail(table))return false;
 const wrap=table.parentNode?.classList?.contains('table-wrap')?table.parentNode:table;
 if(pageTableOwnPaging(table,wrap))return false;
 const bar=document.createElement('div');bar.className='table-pager';bar.setAttribute('data-table-pager','');
 const status=document.createElement('span');status.setAttribute('role','status');
 const button=(text,step)=>{const b=document.createElement('button');b.type='button';b.className='btn small';b.textContent=text;b.onclick=()=>{state.page+=step;render();if(wrap!==table)wrap.scrollTop=0;};return b;};
 const state={page:0};
 const previous=button('Previous 25 rows',-1),next=button('Next 25 rows',1);
 bar.append(previous,status,next);
 const dataRows=()=>lookBodyRows(table).filter(row=>!lookIsStateRow(row));
 const render=()=>{
  const all=dataRows(),pages=Math.max(1,Math.ceil(all.length/PAGE_TABLE_PAGE_ROWS));
  state.page=Math.max(0,Math.min(state.page,pages-1));
  const start=state.page*PAGE_TABLE_PAGE_ROWS,end=Math.min(start+PAGE_TABLE_PAGE_ROWS,all.length);
  all.forEach((row,index)=>row.classList.toggle('table-row-paged',index<start||index>=end));
  status.textContent='Showing rows '+pageCount(all.length?start+1:0)+'–'+pageCount(end)+' of '+pageCount(all.length);
  previous.disabled=state.page===0;next.disabled=end>=all.length;
 };
 table.__pageRows=render;
 table.__pageShowRow=row=>{const index=dataRows().indexOf(row);if(index>=0){state.page=Math.floor(index/PAGE_TABLE_PAGE_ROWS);render();}};
 // Sorting reorders every row of the table; the current 25 are then taken again.
 table.addEventListener('click',event=>{if(event.target?.closest?.('.th-sort'))setTimeout(render,0);});
 wrap.insertAdjacentElement('afterend',bar);
 render();
 return true;
}
// The kind of a block: the column headings of every table in it, in order, or the
// kind a renderer states (data-table-kind) for tables that list the same records.
function pageTableKind(table){
 const stated=table.closest('[data-table-kind]');
 if(stated)return 'kind:'+stated.getAttribute('data-table-kind');
 const header=lookHeaderRow(table);
 return header?Array.from(header.cells).map(cell=>lookCellText(cell).toLowerCase()).join('|'):'';
}
function pageBlockKind(node){
 if(!node.querySelectorAll||node.matches('table,.table-wrap,.page-kind-pick,[data-table-pager]'))return '';
 const tables=Array.from(node.querySelectorAll('table'));
 if(!tables.length)return '';
 const kinds=tables.map(pageTableKind);
 return kinds.some(kind=>!kind)?'':kinds.join('||');
}
// A block's own name: its summary line, or its first heading or bold lead.
function pageKindTitle(node){
 const line=text=>String(text||'').split('\n').map(s=>s.trim()).find(Boolean)||'';
 if(node.tagName==='DETAILS'){
  // A summary line and its note ("4 available measures") are said as two parts.
  const summary=node.querySelector(':scope>summary');if(!summary)return '';
  const parts=Array.from(summary.childNodes).map(child=>line(child.textContent)).filter(Boolean);
  return pageShortTitle(parts.join(' · '));
 }
 const head=node.querySelector('h1,h2,h3,h4,h5,summary,b,strong');
 return head?pageShortTitle(line(head.textContent)):'';
}
// A short note between two blocks of the same kind (no table, section or control)
// stays where it is and does not separate them.
function pageShortNote(node){
 return !node.matches('details')&&!node.querySelector('details,table,select,button,input')&&String(node.textContent||'').trim().length<=400;
}
// Up to 6 blocks are offered as buttons, so every block's name and count stays on
// the screen; more than 6 share one list. A renderer can name the block shown
// first (data-kind-first), for example the complete list before a filtered one.
const PAGE_KIND_BUTTONS=6;
function pageJoinRun(members){
 const titles=members.map(pageKindTitle);
 // Only blocks that each say what they are can be offered by name.
 if(titles.some(title=>!title))return false;
 const labels=titles.map((title,index)=>titles.indexOf(title)!==titles.lastIndexOf(title)?title+' ('+(index+1)+')':title);
 const pick=document.createElement('div');pick.className='page-kind-pick';pick.setAttribute('data-page-kind-pick','');
 const lead=document.createElement('b');lead.textContent='Show';pick.appendChild(lead);
 let select=null;const buttons=[];
 if(members.length<=PAGE_KIND_BUTTONS){
  pick.setAttribute('role','group');pick.setAttribute('aria-label','Show one of '+pageCount(members.length));
  labels.forEach((text,index)=>{const button=document.createElement('button');button.type='button';button.className='page-kind-option';button.textContent=text;button.onclick=()=>show(index);buttons.push(button);pick.appendChild(button);});
 }else{
  select=document.createElement('select');select.setAttribute('data-page-kind','');select.setAttribute('aria-label','Show one of '+pageCount(members.length));
  labels.forEach((text,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=text;select.appendChild(option);});
  select.addEventListener('change',()=>show(Number(select.value)));
  pick.appendChild(select);
  const note=document.createElement('span');note.textContent=pageCount(members.length)+' of the same kind';pick.appendChild(note);
 }
 members[0].parentNode.insertBefore(pick,members[0]);
 function show(index){
  members.forEach((node,i)=>node.classList.toggle('page-kind-hidden',i!==index));
  const chosen=members[index];if(chosen.tagName==='DETAILS'&&!chosen.open&&!pageLoadsOnOpen(chosen))chosen.open=true;
  if(select)select.value=String(index);
  buttons.forEach((button,i)=>button.setAttribute('aria-pressed',i===index?'true':'false'));
 }
 members.forEach((node,index)=>{node.__pageKindShow=()=>show(index);});
 show(Math.max(0,members.findIndex(node=>node.hasAttribute('data-kind-first'))));
 return true;
}
function pageJoinSameKind(root){
 let joined=0;
 const visit=parent=>{
  const children=Array.from(parent.children).filter(child=>!['STYLE','SCRIPT','TEMPLATE','LINK'].includes(child.tagName));
  let run=[],kind='',notes=0;
  const flush=()=>{if(run.length>1&&pageJoinRun(run))joined++;run=[];kind='';notes=0;};
  for(const child of children){
   if(child.__pageKindShow||child.matches('[data-page-kind-pick]')){flush();continue;}
   const own=pageBlockKind(child);
   // A line with no text between two blocks does not separate them.
   if(!own&&!String(child.textContent||'').trim())continue;
   if(own&&own===kind){run.push(child);notes=0;continue;}
   if(!own&&run.length&&!notes&&pageShortNote(child)){notes=1;continue;}
   flush();
   if(own){run=[child];kind=own;}
  }
  flush();
  for(const child of children)if(child.children.length&&!child.matches('table'))visit(child);
 };
 visit(root);
 return joined;
}
// (3) When the opened More detail would still pass 20 screens or 15 tables, its
// groups are read on detail pages, in their own order ("Detail page 1 of N",
// Previous / Next). A list on every detail page names every group and the page that
// holds it, and "Show all detail pages" shows them together. Every group stays in the
// page and in print; a link to a block opens the detail page that holds it.
const PAGE_OPEN_MAX_PX=20*PAGE_SCREEN_PX;
const PAGE_OPEN_MAX_TABLES=15;
// Room kept on each detail page for its controls, and a margin under the limit for
// content a section fills in after it is measured.
const PAGE_DETAIL_PAGER_PX=260;
const PAGE_OPEN_TARGET_PX=PAGE_OPEN_MAX_PX-280;
function pageShownNode(node){return typeof node.checkVisibility==='function'?node.checkVisibility():node.offsetParent!==null;}
function pageVisibleTables(root){return Array.from(root.querySelectorAll('table')).filter(pageShownNode).length;}
// Measures the page as a reader sees it with every section opened, then closes again
// what it opened (a section that loads its content when opened is left as it is).
function pageOpenedMeasure(container,measure){
 const opened=[];
 for(let round=0;round<4;round++){
  let more=false;
  for(const section of Array.from(container.querySelectorAll('details')))if(!section.open&&!pageLoadsOnOpen(section)&&pageShownNode(section)){section.open=true;opened.push(section);more=true;}
  if(!more)break;
 }
 try{return measure();}finally{for(let i=opened.length-1;i>=0;i--)opened[i].open=false;}
}
function pageSplitGroups(sizes,heightBudget,tableBudget){
 const pages=[];let page=[],height=0,tables=0;
 sizes.forEach((size,index)=>{
  const add=(page.length?8:0)+size.height;
  if(page.length&&(height+add>heightBudget||tables+size.tables>tableBudget)){pages.push(page);page=[];height=0;tables=0;}
  height+=(page.length?8:0)+size.height;tables+=size.tables;page.push(index);
 });
 if(page.length)pages.push(page);
 return pages;
}
function pageSummaryTitle(details){
 const summary=details.querySelector(':scope>summary');if(!summary)return '';
 return Array.from(summary.childNodes).map(child=>String(child.textContent||'').replace(/\s+/g,' ').trim()).find(Boolean)||'';
}
function pageDrawDetailPages(area,list,groups,plan){
 const nav=document.createElement('nav');nav.className='page-detail-pager';nav.setAttribute('data-detail-pager','');nav.setAttribute('aria-label','Detail pages');
 const bar=document.createElement('div');bar.className='page-detail-pager-bar';
 const status=document.createElement('span');status.setAttribute('role','status');
 const control=(text,onclick)=>{const b=document.createElement('button');b.type='button';b.className='btn small';b.textContent=text;b.onclick=onclick;return b;};
 let current=0,all=false;
 const previous=control('Previous detail page',()=>{show(current-1);area.scrollIntoView?.({block:'start'});});
 const next=control('Next detail page',()=>{show(current+1);area.scrollIntoView?.({block:'start'});});
 const every=control('Show all detail pages',()=>{if(all)show(current);else showAll();});
 bar.append(previous,status,next,every);nav.appendChild(bar);
 const index=document.createElement('ol');index.className='page-detail-index';
 const lines=plan.map((members,page)=>{
  const line=document.createElement('li');const name=document.createElement('span');name.textContent='Page '+pageCount(page+1);line.appendChild(name);
  members.forEach(at=>{const group=groups[at];const b=document.createElement('button');b.type='button';b.textContent=pageSummaryTitle(group)||'Further information';
   b.onclick=()=>{if(!all)show(page);group.open=true;group.scrollIntoView?.({block:'start'});};line.appendChild(b);});
  index.appendChild(line);return line;
 });
 nav.appendChild(index);
 list.parentNode.insertBefore(nav,list);
 plan.forEach((members,page)=>members.forEach(at=>{groups[at].__detailPage=page;groups[at].__showDetailPage=()=>{if(!all)show(page);};}));
 function show(page){
  all=false;current=Math.max(0,Math.min(page,plan.length-1));
  groups.forEach(group=>group.classList.toggle('page-detail-off',group.__detailPage!==current));
  status.textContent='Detail page '+pageCount(current+1)+' of '+pageCount(plan.length);
  previous.disabled=current===0;next.disabled=current===plan.length-1;every.textContent='Show all detail pages';
  lines.forEach((line,i)=>line.setAttribute('aria-current',i===current?'true':'false'));
 }
 function showAll(){
  all=true;groups.forEach(group=>group.classList.remove('page-detail-off'));
  status.textContent='All '+pageCount(plan.length)+' detail pages shown';
  previous.disabled=true;next.disabled=true;every.textContent='Show one detail page at a time';
  lines.forEach(line=>line.setAttribute('aria-current','false'));
 }
 show(0);
 return {show,remove(){nav.remove();groups.forEach(group=>{group.classList.remove('page-detail-off');delete group.__detailPage;delete group.__showDetailPage;});}};
}
function pageDetailPages(container){
 const area=Array.from(container.children||[]).find(node=>node.classList?.contains('page-more-detail'));
 const list=area?.querySelector(':scope>.page-detail-groups');
 const groups=list?Array.from(list.children).filter(node=>node.tagName==='DETAILS'):[];
 if(groups.length<2||typeof container.getBoundingClientRect!=='function')return null;
 const sizes=pageOpenedMeasure(container,()=>({total:container.scrollHeight,tables:pageVisibleTables(container),list:list.getBoundingClientRect().height,
  groups:groups.map(group=>({height:pageBlockHeight(group),tables:pageVisibleTables(group)}))}));
 if(sizes.total<=PAGE_OPEN_MAX_PX&&sizes.tables<=PAGE_OPEN_MAX_TABLES)return null;
 const base={height:sizes.total-sizes.list,tables:sizes.tables-sizes.groups.reduce((sum,group)=>sum+group.tables,0)};
 let room=PAGE_DETAIL_PAGER_PX,tableRoom=0;
 for(let attempt=0;attempt<4;attempt++){
  const plan=pageSplitGroups(sizes.groups,PAGE_OPEN_TARGET_PX-base.height-room,PAGE_OPEN_MAX_TABLES-base.tables-tableRoom);
  if(plan.length<2)return null;
  const drawn=pageDrawDetailPages(area,list,groups,plan);
  // Each detail page is opened and measured; a page still over the limit is split again.
  let over=0,overTables=0;
  plan.forEach((members,page)=>{
   if(members.length<2)return;
   drawn.show(page);
   const opened=pageOpenedMeasure(container,()=>({total:container.scrollHeight,tables:pageVisibleTables(container)}));
   over=Math.max(over,opened.total-PAGE_OPEN_TARGET_PX);overTables=Math.max(overTables,opened.tables-PAGE_OPEN_MAX_TABLES);
  });
  drawn.show(0);
  if(over<=0&&overTables<=0||attempt===3)return {pages:plan.length};
  drawn.remove();room+=Math.max(0,over)+40;tableRoom+=Math.max(0,overTables);
 }
 return null;
}
function compactPageDetail(container){
 if(!container?.querySelectorAll||typeof document==='undefined'||typeof document.createElement!=='function')return null;
 const roots=Array.from(container.querySelectorAll('.page-detail-group'));
 for(const section of Array.from(container.querySelectorAll('details')))if(!section.open&&!section.closest('.page-detail-group')&&!roots.some(root=>root.contains(section)))roots.push(section);
 let joined=0,paged=0;
 for(const root of roots)joined+=pageJoinSameKind(root);
 for(const table of Array.from(container.querySelectorAll('table')))if(pageTablePager(table))paged++;
 const pages=pageDetailPages(container);
 // A link to a section of the page (#id) first opens the detail page that holds it.
 if(!document.__pageDetailLinks&&typeof document.addEventListener==='function'){
  document.__pageDetailLinks=true;
  document.addEventListener('click',event=>{
   const link=event.target?.closest?.('a[href^="#"]');if(!link)return;
   let id='';try{id=decodeURIComponent(link.getAttribute('href').slice(1));}catch{}
   const target=id&&document.getElementById(id);if(target)openPageDetailFor(target);
  },true);
 }
 if(pages&&typeof location!=='undefined'&&location.hash.length>1){let id='';try{id=decodeURIComponent(location.hash.slice(1));}catch{}const target=id&&document.getElementById(id);if(target&&container.contains(target))openPageDetailFor(target);}
 return {joined,paged,pages:pages?.pages||1};
}
// A link to a block inside More detail opens the detail page and the group that hold
// it, chooses the block when it shares a selector, and turns its table to the row's 25.
function openPageDetailFor(node){
 for(let parent=node;parent;parent=parent.parentElement){
  if(parent.__showDetailPage&&parent.classList.contains('page-detail-off'))parent.__showDetailPage();
  if(parent.__pageKindShow&&parent.classList.contains('page-kind-hidden'))parent.__pageKindShow();
  if(parent.tagName==='TR'&&parent.classList.contains('table-row-paged'))parent.closest('table')?.__pageShowRow?.(parent);
  if(parent.tagName==='DETAILS'&&!parent.open)parent.open=true;
 }
}
`;
