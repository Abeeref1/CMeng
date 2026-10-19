import test from 'node:test';
import assert from 'node:assert/strict';
import {responseSourceLabels} from '../packages/runtime-api/src/response-labels';
import {pageProjectResponse,takeSerializedPage} from '../packages/runtime-api/src/response-paging';
import {analyzeEvidenceTable,inferTableSemanticRoute,prepareEvidenceRows} from '../packages/truth-kernel/src';
import {excelJs} from '../packages/shared/src/lazy-exceljs';
import {jsZip} from '../packages/shared/src/lazy-jszip';

// T11 (j8-final): work done on every page request or every project-worker
// start was cut without changing any answer. Each check compares the new path
// with the previous one on the same input.

/** responseSourceLabels as it stood before T11, kept verbatim as the reference. */
function referenceSourceLabels(catalogue:Record<string,string>|undefined,value:unknown):Record<string,string>{
 const selected:Record<string,string>={};
 catalogue={...(catalogue??{})};
 const scanned=new Set<object>();
 const identify=(input:any):void=>{
  if(!input||typeof input!=='object'||scanned.has(input))return;scanned.add(input);
  if(Array.isArray(input)){input.forEach(identify);return;}
  const identities=[['populationId',input.name??input.populationName??({execution_control:'Execution activities',source_records:'Source activity records',unfinished_execution:'Remaining execution activities'} as Record<string,string>)[String(input.basis)]],['revisionId',input.label??input.revisionName??input.sourceFilename],['itemId',input.itemNumber],['quantityItemId',input.itemNumber]];
  for(const[id,label]of identities)if(typeof input[id]==='string'&&typeof label==='string'&&label.trim())catalogue![input[id]]=label.trim();
  for(const[key,child]of Object.entries(input))if(key!=='sourceLabels')identify(child);
 };
 identify(value);
 const seen=new Set<object>();
 const add=(token:string)=>{
  let candidate=token;
  for(let depth=0;depth<8&&candidate;depth++){
   if(Object.hasOwn(catalogue,candidate)){selected[candidate]=catalogue[candidate]!;break;}
   const last=candidate.lastIndexOf(':');if(last<0)break;candidate=candidate.slice(0,last);
  }
 };
 const visit=(input:any,key='')=>{
  if(key==='sourceLabels')return;
  if(typeof input==='string'){
   add(input);for(const token of input.match(/[\p{L}\p{N}_:@.\/-]+/gu)??[])add(token);return;
  }
  if(!input||typeof input!=='object'||seen.has(input))return;seen.add(input);
  if(Array.isArray(input))input.forEach(v=>visit(v));else for(const[k,v]of Object.entries(input))visit(v,k);
 };
 visit(value);return selected;
}
function generator(seed:number){let s=seed>>>0;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function randomResponse(seed:number){
 const r=generator(seed),pick=<T>(values:readonly T[])=>values[Math.floor(r()*values.length)]!;
 const ids=['evidence-document:D1:row:4','evidence-document:D2','schedule-revision:REV-1','population:abc','REV-2','item:7','BQ.12','activity:A10:start','قسم:١'];
 const text=()=>Array.from({length:1+Math.floor(r()*4)},()=>pick([...ids,'plain words','Row 7 of REV-2.',''])).join(r()<0.5?' ':', ');
 const shared={sourceRefs:[pick(ids),pick(ids)],note:text()};
 const node=(depth:number):any=>{
  if(depth>3||r()<0.2)return r()<0.7?text():Math.floor(r()*100);
  if(r()<0.4)return Array.from({length:Math.floor(r()*5)},()=>node(depth+1));
  const out:any={};
  for(let i=0;i<1+Math.floor(r()*5);i++)out[pick(['a','b','populationId','revisionId','label','name','itemId','itemNumber','basis','sourceLabels','rows','x'])+(r()<0.3?String(i):'')]=r()<0.2?shared:node(depth+1);
  if(r()<0.3){out.populationId=pick(ids);out.name=r()<0.5?'Population '+seed:'';}
  if(r()<0.3){out.revisionId=pick(ids);out.label='Revision '+seed;}
  if(r()<0.2){out.itemId='item:7';out.itemNumber='7.'+seed;}
  if(r()<0.2)out.basis=pick(['execution_control','source_records','unfinished_execution','other']);
  return out;
 };
 const catalogue:Record<string,string>={};
 for(const id of ids)if(r()<0.5)catalogue[id.split(':').slice(0,1+Math.floor(r()*3)).join(':')]='Label '+id;
 return {catalogue,value:{data:node(0),again:node(0),shared,repeat:[shared,shared]}};
}

test('T11 source labels read each string once: same aliases in the same order as reading every string',()=>{
 for(let seed=1;seed<=300;seed++){
  const {catalogue,value}=randomResponse(seed);
  const expected=referenceSourceLabels(catalogue,value);
  // Twice: the second call reads tokens kept from the first.
  for(const run of [1,2])assert.equal(JSON.stringify(responseSourceLabels(catalogue,value)),JSON.stringify(expected),'seed '+seed+' run '+run);
 }
});

test('T11 one table analysis per sheet: semantic route and prepared rows are the same as analysing twice',()=>{
 const tables:string[][][]=[
  [['RFI ID','Subject','Status','Raised Date','Due Date','Owner'],['RFI-1','Design','Open','2031-01-02','2031-01-09','Engineer'],['RFI-2','Facade','Closed','2031-01-03','2031-01-10','Architect']],
  [['Project Title',''],['',''],['NCR No','Description','Status','Closed Date'],['NCR-1','Weld','Open',''],['NCR-2','Concrete','Closed','2031-02-01']],
  [['Certificate No','Period End','Net Certified','Paid Amount','Currency'],['IPC-1','2031-01-31','1,000.50','1000','SAR'],['IPC-2','2031-02-28','(200)','','SAR']],
  [['Package ID','Description','Required On Site','Status','Linked Activity'],['PKG-1','Chillers','2031-05-01','Ordered','A10']],
  [['Metric','Value SAR'],['PV','100'],['EV','90'],['AC','95']],
  [['a','b'],['1','2']],
 ];
 for(const [index,rows] of tables.entries())for(const hint of ['', 'rfi_register','payment_certificates']){
  const confirmations=index===1?[{sheetName:'CSV',columnIndex:1,meaning:'description'} as any]:[];
  const analysis=analyzeEvidenceTable(rows,confirmations);
  assert.deepEqual(inferTableSemanticRoute(rows,hint,confirmations,analysis),inferTableSemanticRoute(rows,hint,confirmations),'route '+index+' '+hint);
  assert.deepEqual(prepareEvidenceRows(rows,hint,confirmations,[],analysis),prepareEvidenceRows(rows,hint,confirmations,[]),'rows '+index+' '+hint);
 }
});

test('T11 a screen page is serialised once: the kept text equals serialising the returned page',()=>{
 const facts={projectId:'P',projectVersion:3,time:{dataDateIso:'2031-01-01',note:{value:'x'.repeat(900),state:'confirmed'}},sourceRefs:Array.from({length:40},(_,i)=>'ref:'+i)};
 const bodies:any[]=[
  {key:'k',projectId:'P',projectVersion:3,data:{projectFacts:facts,rows:Array.from({length:60},(_,i)=>({id:i,text:'row "'+i+'" é \\'}))}},
  {key:'k',data:{projectFacts:facts,rows:[{a:1}],responsePaging:{responseBytes:0}}},
  {key:'k',responsePaging:{responseBytes:0},data:{projectFacts:facts,rows:Array.from({length:30},(_,i)=>({id:i}))}},
  {key:'k',data:{projectFacts:facts,nested:{responsePaging:{responseBytes:0,source:'"responseBytes":0'}},rows:Array.from({length:200},(_,i)=>({id:i,v:'"responseBytes":0'}))}},
  {key:'k',data:{rows:[1,2,3]}},
 ];
 let kept=0;
 for(const [index,body] of bodies.entries())for(const budget of [undefined,40_000,1_000]){
  const page=pageProjectResponse(body,'/api/projects/P/management/master-dashboard',budget);
  const text=takeSerializedPage(page);
  if(text!==undefined){kept++;assert.equal(text,JSON.stringify(page),'body '+index+' budget '+budget);}
  assert.equal(takeSerializedPage(page),undefined,'the kept text is used once');
 }
 assert.ok(kept>=4,'pages that fit their budget keep their text');
});

test('T11 ExcelJS, JSZip and the application page load on first use and are the same',async t=>{
 const loaded=()=>Object.keys(require.cache).filter(path=>/[\\/]node_modules[\\/](?:exceljs|jszip)[\\/]/.test(path));
 const uiLoaded=()=>Object.keys(require.cache).some(path=>/[\\/]runtime-api[\\/]src[\\/]ui\.js$/.test(path));
 // The project server and state modules (what a project worker loads at start) do not load them.
 const {createCmengServer}=require('../packages/runtime-api/src/server');require('../packages/runtime-api/src/project-state');
 assert.equal(uiLoaded(),false,'a project worker does not build the application page at start');
 const server=createCmengServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const page=await (await fetch('http://127.0.0.1:'+server.address().port+'/')).text();
 assert.equal(page,require('../packages/runtime-api/src/ui').cmengUatHtml(),'the page built on first request is the same page');
 require('../packages/runtime-api/src/project-gateway');
 assert.deepEqual(loaded(),[],'no archive or workbook library is loaded at start');
 assert.equal(excelJs(),require('exceljs'));
 assert.equal(typeof excelJs().Workbook,'function');
 assert.equal(excelJs().ValueType.Formula,require('exceljs').ValueType.Formula);
 assert.equal(jsZip(),require('jszip'));
 assert.equal(typeof jsZip().loadAsync,'function');
});
