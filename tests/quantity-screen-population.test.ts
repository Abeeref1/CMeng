import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pageProjectResponse,recordDetailPage,PROJECT_SCREEN_MAX_BYTES} from '../packages/runtime-api/src/response-paging';
import {quantityCurvesScript} from '../packages/runtime-api/src/ui-quantity-curves';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {createCmengServer} from '../packages/runtime-api/src/server';
import {runInNewContext} from './browser-context';

const points=Array.from({length:31},(_,i)=>({dateIso:'2026-08-'+String(i+1).padStart(2,'0'),baselinePlannedQuantity:i,currentForecastQuantity:i+1,actualInstalledQuantity:i===0?0:null}));
function population(count:number){
 return {key:'installed-quantities',legacyKey:'quantity-scurve',projectVersion:7,status:'partial',reason:'Dated installed measurements remain incomplete.',page:{title:'Installed Quantities'},data:{projectionKey:'quantity_scurve',boqRevisionId:'B1',boqItemCount:count,unmappedItemCount:count,partiallyAllocatedItemCount:50,overAllocatedItemCount:40,allocatedItemCount:0,
  series:Array.from({length:count},(_,i)=>({seriesKey:'Q'+i,quantityItemId:'Q'+i,itemNumber:'1.'+String(i).padStart(5,'0'),description:'Scope item '+i,unit:i%2?'m':'m3',itemCount:1,points})),
  unmappedItemIds:Array.from({length:count},(_,i)=>'Q'+i),partiallyAllocatedItemIds:Array.from({length:50},(_,i)=>'P'+i),overAllocatedItemIds:Array.from({length:40},(_,i)=>'O'+i),quantityQueries:Array.from({length:3428},(_,i)=>({quantityItemId:'Q'+i,itemNumber:String(i),unit:'LS',quantity:2,reason:'Review source quantity'}))}};
}
const sourcePath='/api/projects/P/schedule/modules/installed-quantities';
test('24,000 BOQ item screen stays bounded with original title, reason, totals and complete selected histories',()=>{
 const source=population(24000),last=source.data.series.at(-1)!;
 const history=Array.from({length:365},(_,i)=>({...points[i%31]!,dateIso:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10)}));last.points=history;
 const page=pageProjectResponse(source,sourcePath) as any;
 assert.ok(Buffer.byteLength(JSON.stringify(page))<=PROJECT_SCREEN_MAX_BYTES);
 assert.equal(page.page.title,'Installed Quantities');assert.equal(page.reason,source.reason);
 assert.equal(page.data.series.length,25);assert.equal(page.data.boqItemCount,24000);
 assert.deepEqual(page.data.series[0].points,points);assert.equal(page.data.series[0].points[0].actualInstalledQuantity,0);
 assert.equal(page.responsePaging.tables.find((r:any)=>r.pointer==='/data/series').total,24000);
 assert.equal(page.responsePaging.tables.find((r:any)=>r.pointer==='/data/quantityQueries').total,3428);
 const end=recordDetailPage(source,'/data/series',23975) as any;assert.equal(end.rows.length,25);assert.equal(end.hasMore,false);assert.deepEqual(end.rows.at(-1).points,history);
 const found=recordDetailPage(source,'/data/series',0,25,{query:'Scope item 23999'}) as any;
 assert.equal(found.total,1);assert.equal(found.sourceTotal,24000);assert.equal(found.rows[0].quantityItemId,'Q23999');assert.deepEqual(found.rows[0].points,history);
 assert.equal((recordDetailPage(source,'/data/series',0,25,{query:'2026-08-01'}) as any).total,0,'dates inside histories are not item search matches');
 assert.equal(source.data.series.length,24000);assert.equal(source.data.series[0]!.points,points);assert.equal(last.points,history);
 const kpis:any[]=[];
 const context:any={currentModuleResult:page,project:()=> 'P',projectRequestSeq:1,fmt:String,escapeHtml:String,humanizeKey:String,planningKpis:(rows:any[])=>{kpis.push(...rows);return '';},renderLineChart:()=>'chart'};
 const html=runInNewContext('renderQuantityScurveVisual(currentModuleResult.data)',context);
 assert.equal(kpis.find(r=>r[0]==='Item curves')[1],24000);assert.equal(kpis.find(r=>r[0]==='Unmapped items')[1],24000);
 assert.equal(kpis.find(r=>r[0]==='Partially mapped')[1],50);assert.equal(kpis.find(r=>r[0]==='Over-allocated')[1],40);
 assert.match(html,/3428 lump-sum/);assert.match(html,/Browse all lump-sum/);assert.match(html,/Showing 1–25 of 24000/);assert.match(html,/Search all items/);
});

test('item browser pages and searches the full population, retains histories and ignores stale module/project responses',async()=>{
 const source=population(61),page=pageProjectResponse(source,sourcePath) as any;
 const target={isConnected:true,innerHTML:''},curve={innerHTML:''},feedback={textContent:''},input={value:''};
 const nodes:any={quantityCurveBrowser:target,quantityItemCurve:curve,quantityCurveFeedback:feedback,quantityCurveQuery:input};
 const requests:URL[]=[],charts:any[]=[],context:any={currentModuleResult:page,project:()=> 'P',projectRequestSeq:1,fmt:String,escapeHtml:String,el:(id:string)=>nodes[id],URLSearchParams,
  quantityItemCurve:(row:any)=>{charts.push(row);return row.quantityItemId+':'+row.points.length;},
  api:async(url:string)=>{const u=new URL(url,'http://localhost');requests.push(u);return {...recordDetailPage(source,u.searchParams.get('pointer')!,Number(u.searchParams.get('offset')),25,{query:u.searchParams.get('q')??''}),projectVersion:7};}};
 runInNewContext(quantityCurvesScript+';renderQuantityCurveBrowser(currentModuleResult.data)',context);
 await runInNewContext('loadQuantityCurvePage(25)',context);
 assert.equal(requests[0]!.searchParams.get('version'),'7');assert.equal(requests[0]!.searchParams.get('source'),sourcePath);
 assert.match(target.innerHTML,/Showing 26–50 of 61/);
 runInNewContext('selectQuantityItemCurve(24)',context);assert.equal(curve.innerHTML,'Q49:31');assert.deepEqual(charts.at(-1).points,points);
 await runInNewContext('loadQuantityCurvePage(50)',context);assert.match(target.innerHTML,/Showing 51–61 of 61/);
 input.value='Scope item 60';await runInNewContext('searchQuantityCurves()',context);assert.match(target.innerHTML,/of 1 matching item; 61/);assert.equal(charts.at(-1).quantityItemId,'Q60');
 const original=target.innerHTML;context.api=async()=>{throw Error('offline');};await runInNewContext('loadQuantityCurvePage(0)',context);assert.equal(target.innerHTML,original);assert.match(feedback.textContent,/Previous values are retained/);
 let finish!:(value:any)=>void;context.api=()=>new Promise(r=>{finish=r;});
 const pending=runInNewContext('loadQuantityCurvePage(0)',context);context.currentModuleResult={key:'other'};finish({rows:source.data.series.slice(0,25),offset:0,total:61,sourceTotal:61,projectVersion:7});await pending;assert.equal(target.innerHTML,original);
 context.currentModuleResult=page;const other=runInNewContext('loadQuantityCurvePage(0)',context);context.project=()=> 'OTHER';finish({rows:source.data.series.slice(0,25),offset:0,total:61,sourceTotal:61,projectVersion:7});await other;assert.equal(target.innerHTML,original);
 context.project=()=> 'P';const waiting:Array<(value:any)=>void>=[];context.api=()=>new Promise(r=>waiting.push(r));
 const first=runInNewContext("loadQuantityCurvePage(0,'')",context),second=runInNewContext("loadQuantityCurvePage(25,'')",context);
 waiting[1]!({rows:source.data.series.slice(25,50),offset:25,total:61,sourceTotal:61,projectVersion:7});await second;const latest=target.innerHTML;
 waiting[0]!({rows:source.data.series.slice(0,25),offset:0,total:61,sourceTotal:61,projectVersion:7});await first;assert.equal(target.innerHTML,latest,'late older requests cannot overwrite the selected page');
 context.api=async()=>({rows:source.data.series.slice(0,12),offset:0,total:61,sourceTotal:61,projectVersion:7,hasMore:true});
 await runInNewContext("loadQuantityCurvePage(0,'')",context);assert.match(target.innerHTML,/loadQuantityCurvePage\(12\)/,'a compacted response advances only by the received item count');
});

test('real HTTP quantity screen, item detail and complete report retain all items with version checks',async t=>{
 const state=loadCertifiedDemoProject('QUANTITY-SCREEN-'+randomUUID()),q=state.quantities!,model=state.schedules.at(-1)!.revision.model;
 const base=q.items[0]!;q.items=Array.from({length:61},(_,i)=>({...base,quantityItemId:'Q'+i,itemNumber:'ITEM-'+i,description:'Measured item '+i}));
 q.scheduleRevisionId=model.sourceRevisionId;q.allocations=[];q.installedSnapshots=[];state.version++;
 const server=createCmengServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const url='http://127.0.0.1:'+(server.address() as any).port,path='/api/projects/'+state.projectId+'/schedule/modules/installed-quantities';
 const response=await fetch(url+path+'?view=page');assert.equal(response.status,200);const page=await response.json() as any;
 assert.equal(page.page.title,'Installed Quantities');assert.equal(page.data.series.length,25);const meta=page.responsePaging;assert.equal(meta.tables.find((t:any)=>t.pointer==='/data/series').total,61);
 const params=new URLSearchParams({source:meta.source,pointer:'/data/series',offset:'50',version:String(meta.projectVersion)});
 const detail=await fetch(url+'/api/projects/'+state.projectId+'/record-page?'+params);assert.equal(detail.status,200);const last=await detail.json() as any;assert.equal(last.total,61);assert.equal(last.rows.length,11);assert.equal(last.rows.at(-1).itemNumber,'ITEM-60');
 params.set('offset','0');params.set('q','ITEM-60');const search=await (await fetch(url+'/api/projects/'+state.projectId+'/record-page?'+params)).json() as any;assert.equal(search.total,1);assert.equal(search.rows[0].itemNumber,'ITEM-60');
 const download=await fetch(url+path+'/report.json');assert.equal(download.status,200);const report=await download.json() as any;assert.equal(report.result.data.series.length,61);assert.deepEqual(last.rows.at(-1).points,report.result.data.series.at(-1).points);
 state.version++;assert.equal((await fetch(url+'/api/projects/'+state.projectId+'/record-page?'+params)).status,409);
 assert.equal(state.quantities!.items.length,61);assert.equal(state.quantities!.allocations.length,0);
});
