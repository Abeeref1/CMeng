/** L1/L3 (guard): one shared page layout for every CMeng page.
 * The first screen answers the page's question: the page verdict, the key
 * tiles and the main chart stay open. Every other panel and long table goes,
 * in page order, into collapsed groups under one "More detail" area. Nothing
 * is removed or changed: blocks are only moved, with their ids, handlers and
 * styles. A page shows at most 15 collapsed sections: the collapsed sections
 * of a moved panel merge into its More detail group, so each group opens with
 * one click and shows its whole content. A page that already fits (3 screens,
 * 15 collapsed sections) keeps its layout. */
export const pageLayoutStyles=String.raw`
.page-more-detail{margin:24px 0 0;padding-top:14px;border-top:1px solid #dce4ee}.page-more-detail>h4{margin:0 0 10px;font-size:15px;color:#294766}
.page-detail-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:start}
.page-detail-groups>details{margin:0!important;border:1px solid #dce4ee!important;border-radius:8px!important;background:#fff!important;box-shadow:none!important;overflow:hidden;min-width:0;padding:0!important}
.page-detail-groups>details[open]{grid-column:1/-1}
.page-detail-groups>details>summary{display:flex;align-items:center;gap:10px;min-height:42px;padding:10px 14px!important;margin:0!important;cursor:pointer;font-size:13.5px!important;font-weight:650;line-height:1.35;background:#f9fbfd!important;color:#294766;list-style:none;border:0!important}
.page-detail-groups>details>summary::-webkit-details-marker{display:none}.page-detail-groups>details>summary:before{content:'+';font-size:17px;font-weight:400}.page-detail-groups>details[open]>summary:before{content:'−'}
.page-detail-groups>details>summary span{font-size:12px;color:#61738a;font-weight:400;margin-left:auto}
.page-detail-body{padding:16px}.page-detail-body>*:last-child{margin-bottom:0}
@media(max-width:900px){.page-detail-groups{grid-template-columns:1fr}}
@media print{.page-detail-groups{display:block}}
`;
export const pageLayoutScript=String.raw`
const PAGE_SCREEN_PX=700;
const PAGE_DEFAULT_SCREENS=3;
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
 for(const table of Array.from(node.querySelectorAll('table')))if(pageNodeVisible(table))rows=Math.max(rows,table.querySelectorAll('tbody tr').length);
 return rows;
}
function pageClosedSections(node){
 return Array.from(node.querySelectorAll('details')).filter(d=>!d.open&&pageNodeVisible(d.querySelector('summary'))).length;
}
function pageShows(node,selector){
 return !!node.matches?.(selector)||Array.from(node.querySelectorAll(selector)).some(pageNodeVisible);
}
// The first heading line of a block, or '' when it has none.
function pageBlockTitle(node){
 const line=text=>String(text||'').split('\n').map(s=>s.trim()).find(Boolean)||'';
 if(node.tagName==='DETAILS'){const summary=node.querySelector(':scope>summary');return summary?line(summary.innerText||summary.textContent):'';}
 const heading=node.matches('h1,h2,h3,h4,h5')?node:node.querySelector('h1,h2,h3,h4,h5,summary');
 if(heading)return line(heading.innerText||heading.textContent);
 const lead=node.querySelector(':scope>b,:scope>strong');
 return lead?line(lead.innerText||lead.textContent).replace(/\s*[:·]\s*$/,''):'';
}
function pageShortTitle(title){title=String(title||'').trim();return title.length>90?title.slice(0,87).replace(/\s+\S*$/,'')+'…':title;}
function pageGroupTitle(titles){
 const named=[...new Set(titles.filter(Boolean))];
 if(!named.length)return 'Further information';
 if(named.length<=3)return pageShortTitle(named.join(' · '));
 return pageShortTitle(named.slice(0,2).join(' · '))+' and '+(named.length-2)+' more';
}
// The answer leads: page context and verdict always; then the reading box,
// the key tiles (and a block the page renderer names as part of its answer
// with data-page-answer), the main chart, the primary panel, a second row of
// tiles and short action notices, while the first screens hold them. A long
// table never leads the page.
function pageAnswerRank(node,seen){
 if(node.matches(PAGE_FIXED)&&node.tagName!=='DETAILS')return 0;
 if(node.tagName==='DETAILS'||node.matches('.owner-link-panel,.module-evidence-link,.experience-scope-note'))return -1;
 if(pageVisibleTableRows(node)>PAGE_LONG_TABLE_ROWS)return -1;
 if(node.matches('.experience-management-reading'))return 1;
 if(node.matches('[data-page-answer]'))return 2;
 const tiles=pageShows(node,PAGE_TILE);
 if(tiles&&!seen.tiles){seen.tiles=1;return 2;}
 if(!seen.chart&&pageShows(node,PAGE_CHART)){seen.chart=true;return 3;}
 if(!seen.primary&&node.matches('.primary')){seen.primary=true;return 4;}
 if(tiles&&seen.tiles===1){seen.tiles=2;return 5;}
 // A short notice or card with a button is a page action (for example "Upload register").
 if(node.matches('.actions,.action-notification')||node.querySelector('button')&&!node.querySelector('table')&&pageBlockHeight(node)<=PAGE_ACTION_MAX_PX)return 6;
 return -1;
}
// Copies of the wrappers a block came from (class and attributes, no id), so
// the moved block keeps its layout and style context.
function pageShellChain(chain){
 let outer=null,inner=null;
 for(const wrapper of chain){const shell=wrapper.cloneNode(false);shell.removeAttribute('id');if(inner)inner.appendChild(shell);else outer=shell;inner=shell;}
 return {outer,inner};
}
function pageFillGroup(body,blocks){
 let chain=null,inner=null;
 for(const block of blocks){
  if(!block.chain.length){body.appendChild(block.node);chain=null;inner=null;continue;}
  const same=chain&&chain.length===block.chain.length&&block.chain.every((wrapper,i)=>wrapper===chain[i]);
  if(!same){const shells=pageShellChain(block.chain);body.appendChild(shells.outer);chain=block.chain;inner=shells.inner;}
  inner.appendChild(block.node);
 }
}
function pageDetailGroup(title,blocks){
 let details;
 if(blocks.length===1&&blocks[0].node.tagName==='DETAILS'){
  // A block that is already a collapsed section is the group itself (one click).
  details=blocks[0].node;
  if(blocks[0].chain.length){
   const content=Array.from(details.childNodes).filter(child=>child.nodeName!=='SUMMARY');
   const shells=pageShellChain(blocks[0].chain);
   for(const child of content)shells.inner.appendChild(child);
   details.appendChild(shells.outer);
  }
 }else{
  details=document.createElement('details');
  const summary=document.createElement('summary');summary.textContent=title;
  if(blocks.length>1){const note=document.createElement('span');note.textContent=countText(blocks.length,'part',undefined,fmt);summary.appendChild(note);}
  const body=document.createElement('div');body.className='page-detail-body';
  pageFillGroup(body,blocks);
  details.appendChild(summary);details.appendChild(body);
 }
 details.classList.add('page-detail-group');
 // The group is the one click: the collapsed sections inside it are shown when
 // it opens. A section that loads its content when opened keeps its own click.
 for(const inner of Array.from(details.querySelectorAll('details')))if(!inner.open&&!pageLoadsOnOpen(inner))inner.open=true;
 return details;
}
function pageLoadsOnOpen(node){return node.hasAttribute('ontoggle')||Object.keys(node.dataset||{}).some(key=>/lazy/i.test(key));}
function pageClosedTotal(container){return Array.from(container.querySelectorAll('details')).filter(d=>!d.open).length;}
function pagePlanGroups(moved,limit){
 const groups=[];
 for(const block of moved){
  const title=pageBlockTitle(block.node),last=groups[groups.length-1];
  // A block without its own heading (a note, a line, a tile row) joins the group before it.
  if(!title&&last&&block.node.tagName!=='DETAILS'&&!last.closed){last.blocks.push(block);last.height+=block.height;continue;}
  groups.push({titles:[title],blocks:[block],height:block.height,closed:block.node.tagName==='DETAILS'});
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
 const budget=PAGE_DEFAULT_SCREENS*PAGE_SCREEN_PX;
 // A page that already fits keeps its layout.
 if(container.scrollHeight<=budget&&pageClosedTotal(container)<=PAGE_MAX_CLOSED_SECTIONS)return null;
 const blocks=pageBlocks(container);
 if(blocks.length<2)return null;
 const seen={};
 const ranked=blocks.map(block=>({...block,rank:pageAnswerRank(block.node,seen),height:pageBlockHeight(block.node)}));
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
 let chosen=plan(keep);
 // Drop the least important optional block until the first screens hold the answer.
 while(chosen.height>budget&&optional.length){
  const drop=optional.reduce((worst,block)=>block.rank>worst.rank||block.rank===worst.rank&&block.height>worst.height?block:worst,optional[0]);
  optional.splice(optional.indexOf(drop),1);keep.delete(drop);chosen=plan(keep);
 }
 if(!chosen.groups.length)return null;
 const area=document.createElement('section');
 area.className='page-more-detail';area.setAttribute('aria-label','More detail');
 const title=document.createElement('h4');title.textContent='More detail';area.appendChild(title);
 const list=document.createElement('div');list.className='page-detail-groups';area.appendChild(list);
 for(const group of chosen.groups)list.appendChild(pageDetailGroup(pageGroupTitle(group.titles),group.blocks));
 container.appendChild(area);
 return {kept:keep.size,groups:chosen.groups.length};
}
// A link to a block inside More detail opens the group that holds it.
function openPageDetailFor(node){
 for(let parent=node;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS'&&!parent.open)parent.open=true;
}
`;
