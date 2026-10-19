// F10 (D-108, D-123, D-149, D-153, D-158, D-169, D-185, D-189, D-207, D-209 in the REEM review):
// one page per question. Each topic has one owner page; other pages link to it
// instead of copying its block. The Dashboard is the summary page: its tiles are
// summaries with links and stay as they are.
//
// The project is built through the real upload path (HTTP gateway, real parsers),
// every module and management page is read from the real API and drawn with the
// real page renderer (renderModuleResult from the complete assembled browser
// script). Only the DOM itself is a minimal stand-in.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {moduleRegistry} from '../packages/runtime-api/src/registry';
import {runInNewContext} from './browser-context';
import {generateCommercialFeatureBlindProject,generateDeliveryFeatureBlindProject,type BlindDocument} from './blind-project-generator';

const SEED='CMENG-F10-ONE-OWNER-PAGE-PER-BLOCK';
const PROJECT_ID='F10-OWNER-PAGES';

async function listen(gateway:Awaited<ReturnType<typeof createProjectGateway>>){
 await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
 return 'http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
}
async function request(base:string,path:string,init?:RequestInit){
 const response=await fetch(base+path,init),text=await response.text();
 let body:any=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
 return {status:response.status,body,text};
}

// One rich project: the commercial cohort (contract, programme, cost/EVM, payments,
// variations, site instructions, retention, claims, bonds) plus the delivery cohort
// registers (procurement, design, quality, HSE, commissioning, assets, risks, BOQ,
// installed quantities). Only one programme is uploaded.
async function richDocuments(){
 const commercial=await generateCommercialFeatureBlindProject(SEED,0);
 const delivery=await generateDeliveryFeatureBlindProject(SEED,0);
 const documents:BlindDocument[]=[...commercial.documents,...delivery.documents.filter(document=>document.domain!=='schedule')];
 return {documents,commercial};
}
async function uploadRichProject(base:string){
 const {documents,commercial}=await richDocuments();
 const created=await request(base,'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:PROJECT_ID})});
 assert.equal(created.status,201,'project creation failed: '+created.text);
 for(const [index,document] of documents.entries()){
  const contract=document.domain==='contract'&&document.kind==='pdf';
  const uploaded=await request(base,'/api/projects/'+encodeURIComponent(PROJECT_ID)+(contract?'/contract/uploads':'/evidence/uploads'),{
   method:'POST',
   headers:{'content-type':document.mediaType,'x-source-filename-encoded':encodeURIComponent(document.filename),
    'x-source-relative-path-encoded':encodeURIComponent(document.filename),
    ...(contract?{'x-contract-role':'main'}:{'x-upload-intent':'add_update','x-upload-id':'F10-'+index})},
   body:Buffer.from(document.bytes),
  });
  assert.equal(uploaded.status,201,document.filename+' upload failed: '+uploaded.text.slice(0,500));
 }
 return commercial;
}
// The same page request the browser makes (loadModule).
function pagePath(key:string){
 const page=moduleRegistry.find(row=>row.key===key)!;
 const api=page.apiKey||page.key;
 return '/api/projects/'+encodeURIComponent(PROJECT_ID)+(page.area==='management'?'/management/'+encodeURIComponent(api):'/'+page.area+'/modules/'+encodeURIComponent(api)+(key==='activity-analytics'?'?view=page':''));
}

// Minimal DOM stand-in: every element keeps its HTML as a string.
class FakeElement{
 innerHTML='';textContent='';value='';className='';hidden=false;open=false;disabled=false;onclick:unknown=null;
 style:Record<string,string>={};dataset:Record<string,string>={};children:FakeElement[]=[];
 classList={add(){},remove(){},toggle(){},contains(){return false;}};
 insertAdjacentHTML(where:string,html:string){this.innerHTML=where==='afterbegin'||where==='beforebegin'?html+this.innerHTML:this.innerHTML+html;}
 querySelector(selector:string){return selector.startsWith(':scope>')?null:new FakeElement();}
 querySelectorAll(){return [] as FakeElement[];}
 addEventListener(){}removeEventListener(){}setAttribute(){}removeAttribute(){}getAttribute(){return null;}
 appendChild(){}remove(){}closest(){return null;}focus(){}click(){}scrollIntoView(){}
}
function renderPage(result:any,withoutOwners=false):string{
 const nodes=new Map<string,FakeElement>();
 const el=(id:string)=>{if(!nodes.has(id))nodes.set(id,new FakeElement());return nodes.get(id)!;};
 const storage=new Map<string,string>();
 const ctx:any={el,
  document:{getElementById:el,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>new FakeElement(),body:new FakeElement(),addEventListener(){}},
  localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,String(v)),removeItem:(k:string)=>storage.delete(k)},
  window:{location:{search:'',pathname:'/',hash:''},addEventListener(){},history:{pushState(){},replaceState(){}}},
  location:{search:'',pathname:'/',hash:''},
  setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0,console,
  overview:{projectId:PROJECT_ID,latestDataDateIso:null},appView:'project',selectedRoleView:'overall',project:()=>PROJECT_ID,
  __result:result,...(withoutOwners?{pageBlockOwners:{},deliveryRegisterOwners:{}}:{})};
 runInNewContext('renderModuleResult(__result);',ctx);
 // Tables a renderer fills after the page is drawn (el(id).innerHTML=...) are put
 // back into their empty placeholder, as a browser would show them.
 let html=el('moduleContent').innerHTML;
 for(let pass=0;pass<3;pass++)for(const [id,node] of nodes){
  if(id==='moduleContent'||!node.innerHTML)continue;
  html=html.replace(new RegExp('(<([a-zA-Z0-9]+)[^>]*\\bid="'+id.replace(/[^a-zA-Z0-9_-]/g,'')+'"[^>]*>)(</\\2>)'),(_m,open,_tag,close)=>open+node.innerHTML+close);
 }
 return html;
}

// ---- block reading ---------------------------------------------------------
const decode=(s:string)=>s.replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
const textOf=(html:string)=>decode(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const VOID=new Set(['br','hr','img','input','meta','link','source','wbr','col','area','base','embed','param','track']);
type Block={heading:string;body:string;start:number;end:number;html:string;tag:string;attrs:string};
// A block is a section, details or article, or a div card / panel / notice, with a
// heading (h1-h6, summary, or the leading <b>/<strong> of a notice) and a body.
// A tile group (planning KPI grid, delivery KPI grid) is a block too; its heading is
// its first tile label.
const TILE_GROUP=/\bclass="(?:planning-kpi-grid|grid kpi)"/;
function isBlockTag(tag:string,attrs:string){
 if(['section','details','article'].includes(tag))return true;
 if(tag!=='div')return false;
 if(TILE_GROUP.test(' '+attrs))return true;
 const cls=(attrs.match(/class="([^"]*)"/)?.[1]??'').split(/\s+/);
 return cls.some(c=>/^(?:card|planning-panel|notice|visual-panel|chart-card|management-panel)$/.test(c));
}
// Scope of the check (stated, not hidden):
// - An owner link (data-owner-link: "<heading>: see <owner page>", or a notice that
//   opens the shared Actions and Data gaps list) is the link itself; it is meant to
//   appear wherever the topic is referenced, so its text is not a copy.
// - A disclosure inside a table cell is part of that record's row, not a page block.
// - The page's own review section (page verdict, "Items to review" and "Actions and
//   supporting details") states this page's own review state; each review item is
//   owned by Actions and Data gaps (F30), which the section already links to.
// - Guidance text with no figure, date or record reference carries no project fact.
const OWNER_LINK=/<section class="owner-link-panel"[\s\S]*?<\/section>/g;
const OWN_REVIEW=/\bclass="[^"]*\b(?:position-verdict|page-review-summary|experience-audit)\b/;
function headingOf(inner:string,attrs=''){
 if(TILE_GROUP.test(' '+attrs)){const named=attrs.match(/aria-label="([^"]*)"/);if(named)return decode(named[1]!);const t=inner.match(/<(?:span|div class="kpi-label")[^>]*>([\s\S]*?)<\/(?:span|div)>/i);return t?textOf(t[1]!):'';}
 const h=inner.match(/<(h[1-6]|summary)\b[^>]*>([\s\S]*?)<\/\1>/i);
 if(h)return textOf(h[2]!);
 const b=inner.match(/^\s*<(b|strong)\b[^>]*>([\s\S]*?)<\/\1>/i);
 return b?textOf(b[2]!):'';
}
export function readBlocks(html:string):Block[]{
 const blocks:Block[]=[];const stack:{tag:string;attrs:string;start:number;contentStart:number}[]=[];
 const re=/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;let m:RegExpExecArray|null;
 while((m=re.exec(html))){
  const tag=m[1]!.toLowerCase(),closing=m[0]!.startsWith('</');
  if(VOID.has(tag)||(!closing&&m[0]!.endsWith('/>')))continue;
  if(!closing){stack.push({tag,attrs:m[2]??'',start:m.index,contentStart:m.index+m[0]!.length});continue;}
  let i=stack.length-1;while(i>=0&&stack[i]!.tag!==tag)i--;
  if(i<0)continue;
  const open=stack[i]!,ancestors=stack.slice(0,i);stack.length=i;
  if(!isBlockTag(open.tag,open.attrs))continue;
  if(/data-owner-link=/.test(open.attrs)||OWN_REVIEW.test(' '+open.attrs)||ancestors.some(a=>OWN_REVIEW.test(' '+a.attrs)))continue;
  // A disclosure inside a table cell belongs to that record row; rows are records, not page blocks.
  if(ancestors.some(a=>a.tag==='td'||a.tag==='th'))continue;
  const inner=html.slice(open.contentStart,m.index).replace(OWNER_LINK,' '),heading=headingOf(inner,open.attrs);
  const body=textOf(inner);
  if(!heading||body.length<=heading.length+3||!/[0-9]/.test(body))continue;
  blocks.push({heading,body,start:open.start,end:m.index+m[0]!.length,html:html.slice(open.start,m.index+m[0]!.length),tag:open.tag,attrs:open.attrs});
 }
 return blocks.sort((a,b)=>a.start-b.start);
}
// The Dashboard is the summary page (its tiles are summaries with links). A block
// that the Dashboard shares with ONE owner page is that page's summary, not a copy.
const SUMMARY_PAGE='master-dashboard';
export function duplicateBlocks(pages:Map<string,string>){
 const where=new Map<string,{heading:string;pages:Set<string>}>();
 const perPage=new Map<string,Block[]>();
 for(const [key,html] of pages){
  const blocks=readBlocks(html);perPage.set(key,blocks);
  for(const block of blocks){
   const signature=block.heading+'\u0000'+block.body;
   if(!where.has(signature))where.set(signature,{heading:block.heading,pages:new Set()});
   where.get(signature)!.pages.add(key);
  }
 }
 const copied=(signature:string)=>{const pages=[...where.get(signature)!.pages].filter(key=>key!==SUMMARY_PAGE);return pages.length>1?pages:null;};
 const found=new Map<string,{heading:string;pages:string[];sample:string}>();
 for(const [key,blocks] of perPage){
  for(const block of blocks){
   const signature=block.heading+'\u0000'+block.body,pagesWith=copied(signature);
   if(!pagesWith||found.has(signature))continue;
   // Report the outermost copied block only.
   const covered=blocks.some(outer=>outer!==block&&outer.start<=block.start&&outer.end>=block.end&&copied(outer.heading+'\u0000'+outer.body)?.length===pagesWith.length);
   if(covered)continue;
   found.set(signature,{heading:block.heading,pages:pagesWith.sort(),sample:block.body.slice(0,240)});
  }
 }
 return [...found.values()];
}

let rendered:Map<string,string>|null=null,results:Map<string,any>|null=null;
async function renderAllPages(){
 if(rendered)return {rendered,results:results!};
 const root=await mkdtemp(join(tmpdir(),'cmeng-f10-owner-'));
 const gateway=await createProjectGateway(root,{maxWorkers:2}),base=await listen(gateway);
 try{
  await uploadRichProject(base);
  rendered=new Map();results=new Map();
  for(const page of moduleRegistry){
   const response=await request(base,pagePath(page.key));
   assert.ok(response.status===200||response.status===409,page.key+' returned '+response.status+': '+response.text.slice(0,300));
   results.set(page.key,response.body);
   rendered.set(page.key,renderPage(response.body));
  }
  const dump=process.env.CMENG_F10_DUMP_DIR;
  if(dump){const {mkdirSync,writeFileSync}=await import('node:fs');mkdirSync(dump,{recursive:true});
   for(const [key,html] of rendered)writeFileSync(join(dump,key+'.html'),html);
   for(const [key,body] of results)writeFileSync(join(dump,key+'.json'),JSON.stringify(body));}
 }finally{
  await gateway.close();
  await rm(root,{recursive:true,force:true});
 }
 return {rendered,results};
}

test('F10 harness reads blocks by heading and body, and treats the Dashboard as the summary page',()=>{
 const panel=(h:string,b:string)=>'<section class="planning-panel"><h4>'+h+'</h4><p>'+b+'</p></section>';
 const pages=new Map([
  ['master-dashboard',panel('Pending variations','3 records')],
  ['commercial-overview',panel('Pending variations','3 records')+panel('Own','only here')],
  ['cost-forecast','<div class="card">'+panel('Pending variations','3 records')+'</div>'],
  ['payments',panel('Pending variations','4 records')],
 ]);
 const found=duplicateBlocks(pages);
 assert.equal(found.length,1);
 assert.deepEqual(found[0]!.pages,['commercial-overview','cost-forecast']);
 assert.equal(duplicateBlocks(new Map([['master-dashboard',panel('A','1')],['payments',panel('A','1')]])).length,0,'Dashboard summary plus one owner page is not a copy');
});

const attr=(tag:string,name:string)=>{const m=tag.match(new RegExp('\\b'+name+'="([^"]*)"'));return m?decode(m[1]!):null;};
const openTags=(html:string,name:string)=>[...html.matchAll(new RegExp('<[a-zA-Z][^>]*\\b'+name+'="[^"]*"[^>]*>','g'))].map(m=>m[0]!);
function ownerLinks(html:string){
 return openTags(html,'data-owner-link').map(tag=>{
  const at=html.indexOf(tag),panel=tag.startsWith('<section class="owner-link-panel"')?html.slice(at,html.indexOf('</section>',at)+10):tag;
  return {topic:attr(tag,'data-owner-link')!,owner:attr(tag,'data-owner-page')!,pageScoped:attr(tag,'data-owner-scope')==='page',
   figure:(panel.match(/data-owner-figure="([^"]*)"/)?.[1]!==undefined)?decode(panel.match(/data-owner-figure="([^"]*)"/)![1]!):'',panel};
 });
}
function ownerBlocks(html:string){
 return openTags(html,'data-owner-topic').map(tag=>({topic:attr(tag,'data-owner-topic')!,figure:attr(tag,'data-owner-figure')??''}));
}

test('F10: no full block appears on two pages of a rich project; every replaced block links to its owner page',{timeout:600000},async()=>{
 const {rendered}=await renderAllPages();
 assert.equal(rendered.size,moduleRegistry.length,'every module and management page is rendered');
 const found=duplicateBlocks(rendered);
 const report=found.map(d=>d.heading+' · '+d.pages.join(', ')+' · '+d.sample).join('\n');
 process.stdout.write('\nF10_DUPLICATE_BLOCKS='+found.length+'\n'+report+'\n');
 assert.deepEqual(found.map(d=>d.heading+' · '+d.pages.join(', ')),[],'blocks copied across pages:\n'+report);

 // Every replaced block is a link to its owner page, and the owner page keeps the
 // full block with the same headline figure (the same shared fact).
 let links=0;const linked=new Set<string>();
 for(const [key,html] of rendered){
  for(const link of ownerLinks(html)){
   links++;linked.add(link.topic);
   assert.ok(moduleRegistry.some(page=>page.key===link.owner),key+': '+link.topic+' links to a real page');
   assert.notEqual(link.owner,key,key+': a page never links to itself for '+link.topic);
   if(link.panel.startsWith('<section class="owner-link-panel"')){
    const title=moduleRegistry.find(page=>page.key===link.owner)!.title;
    assert.match(link.panel,new RegExp(': see '+title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/&/g,'&amp;')+'</h4>'),key+': the link panel names its owner page');
    assert.match(link.panel,new RegExp('data-owner-open="'+link.owner+'"'),key+': the link panel opens its owner page');
   }
   const owner=rendered.get(link.owner)!;
   const full=ownerBlocks(owner).filter(block=>block.topic===link.topic);
   assert.ok(full.length>0,key+': '+link.topic+' is linked to '+link.owner+', which must keep the full block');
   if(!link.pageScoped)assert.ok(full.some(block=>block.figure===link.figure),key+': '+link.topic+' headline "'+link.figure+'" equals the owner page figure ('+full.map(b=>b.figure).join(' | ')+')');
  }
 }
 process.stdout.write('F10_OWNER_LINKS='+links+' topics='+[...linked].sort().join(',')+'\n');
 for(const topic of ['programme-source-records','commercial-cost-ledger','commercial-payment-ledger','contract-time-position','claim-register','delivery-procurement-position','delivery-boq-value'])
  assert.ok(linked.has(topic),topic+' is shared by several pages of this project and must be linked, not copied');
});

test('F10: the Dashboard is the summary page; it keeps every block and figure and is never replaced by a link',async()=>{
 const {rendered,results}=await renderAllPages();
 const dashboard=rendered.get(SUMMARY_PAGE)!;
 assert.equal(ownerLinks(dashboard).filter(link=>!link.pageScoped).length,0,'no Dashboard block is replaced by a link');
 // Drawn again with no owner map at all, the Dashboard is identical: the owner rule
 // adds only owner markers there and removes no block and no figure.
 const strip=(html:string)=>html.replace(/ data-owner-[a-z]+="[^"]*"/g,'');
 assert.equal(strip(dashboard),strip(renderPage(results.get(SUMMARY_PAGE),true)));
});
