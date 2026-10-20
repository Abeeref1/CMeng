import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {commercialCanonical,commercialRegisterScope} from '../packages/runtime-api/src/commercial-canonical';
import {canonicalCommercialModule} from '../packages/runtime-api/src/commercial-runtime';
import {pageProjectResponse,recordDetailPage} from '../packages/runtime-api/src/response-paging';
import {buildModuleJsonDownload} from '../packages/runtime-api/src/module-report';
import {runInNewContext} from './browser-context';
const date=(i:number)=>i<150?'2031-08-01':i<280?'2032-01-01':null;
function render(root:any,key='renderCommercialLedgerVisual(data)'){
 const kpis:any[]=[],html=runInNewContext(key,{data:root.data,currentModuleResult:root,planningKpis:(rows:any[])=>{kpis.push(...rows);return '';}});
 return {html,kpis};
}

test('retained commercial sources establish complete date cohorts before paging and keep source bytes intact',t=>{
 const dir=mkdtempSync(join(tmpdir(),'commercial-populations-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const state=loadCertifiedDemoProject('COMMERCIAL-POP-'+randomUUID());state.evidenceDocuments=[];state.schedules.at(-1)!.revision.model.dataDateIso='2031-08-31';state.version++;
 const sources:Array<{path:string;content:string}>=[];
 const csv=(type:string,content:string)=>{const documentId='source-'+sources.length,path=join(dir,documentId+'.csv');writeFileSync(path,content);sources.push({path,content});
  state.evidenceDocuments.push({documentId,sourceFilename:documentId+'.csv',storedPath:path,sourceHashSha256:createHash('sha256').update(content).digest('hex'),mediaType:'text/csv',basisState:'active',linkedArtifactId:null,category:'boq_cost',documentType:type,familyKey:documentId,uploadedAt:'2031-09-01',diagnostics:[],assertions:[]} as any);state.version++;};
 csv('variation_register','Variation ID,Description,Approval Date,Status,Approved Amount,Currency,Tax Basis\n'+Array.from({length:420},(_,i)=>['V'+i,'Variation '+i,date(i)??'','Approved',i===419?'0':'12.35',i%2?'SAR':'EUR',i%3?'exclusive':'inclusive'].join(',')).join('\n'));
 csv('payment_certificates','Certificate No,Period End,Certificate Date,Gross Work,Variations,Net Certified,Paid Amount,Currency,Tax Basis,Status,Certified Amount Basis,Paid Amount Basis\n'+Array.from({length:420},(_,i)=>['P'+i,date(i)??'',date(i)??'',100,0,100,i%2?'':0,'SAR','exclusive','Certified','incremental','incremental'].join(',')).join('\n'));
 csv('cost_evm_report','Metric,Value,Unit,Status,As Of,VAT Basis\n'+Array.from({length:420},(_,i)=>['PV',i,'SAR','Approved',date(i)??'','exclusive'].join(',')).join('\n'));
 const sourceBefore=JSON.stringify(state.evidenceDocuments),ledger=commercialCanonical(state),before=JSON.stringify(ledger);
 for(const scope of Object.values(ledger.registerScopes!)){
  assert.deepEqual([scope.asOf.summary.recordCount,scope.future.summary.recordCount,scope.undated.summary.recordCount],[150,130,140]);
  assert.equal(scope.asOf.rows.length+scope.future.rows.length+scope.undated.rows.length,420);
 }
 assert.equal(ledger.registerScopes!.variations.asOf.summary.approvedByDataDateCount,150);
 assert.equal(ledger.registerScopes!.payments.asOf.summary.recordedPaidAmountCount,75,'explicit zero is recorded; blank stays unknown');
 assert.equal(ledger.registerScopes!.payments.future.summary.recordedPaidAmountCount,65);
 for(const [moduleKey,field]of [['commercial-variations','variations'],['commercial-payment-register','payments'],['commercial-cost-register','costMetrics']] as const){
  const full={key:moduleKey,data:{projectionKey:'commercial_canonical',moduleKey,dataDateIso:ledger.dataDateIso,rows:ledger[field],registerScope:ledger.registerScopes![field]}},page:any=pageProjectResponse(full,'/api/projects/P/commercial/modules/'+moduleKey);
  assert.equal(page.data.registerScope.asOf.rows.length,25);assert.equal(page.data.registerScope.future.rows.length,25);
  const {html,kpis}=render(page);assert.match(html,/Showing 25 of 150 source records/);assert.match(html,/130 source records/);assert.match(html,/140 source records/);assert.match(html,/Browse all records in this source group/);
  if(field==='variations'){assert.equal(kpis.find(r=>r[0]==='Source variations')[1],150);assert.equal(kpis.find(r=>r[0]==='Approved by Data Date')[1],150);}
  if(field==='payments'){assert.equal(kpis.find(r=>r[0]==='Certificate source records')[1],150);assert.equal(kpis.find(r=>r[0]==='Recorded paid amounts')[1],75);}
  const last:any=recordDetailPage(full,'/data/registerScope/undated/rows',125);assert.equal(last.total,140);assert.equal(last.rows.length,15);
 }
 const lastVariation=ledger.registerScopes!.variations.undated.rows.at(-1)!;assert.equal(lastVariation.variationId,'V419');assert.equal(lastVariation.approvedAmount.value,0);assert.equal(lastVariation.approvedAmount.currency,'SAR');
 const module=canonicalCommercialModule(state,'variations-change')!;
 assert.equal((module.data as any).position.sourceLedger.registerScopes.variations.future.summary.recordCount,130,'real module adapter carries complete cohorts');
 const livePage:any=pageProjectResponse(module,'/api/projects/'+state.projectId+'/commercial/modules/variations-change');
 const liveHtml=render(livePage,"renderCommercialVisual('variations-change',data)").html;const shown=livePage.data.position.sourceLedger.registerScopes.variations.asOf.rows.length;assert.ok(liveHtml.includes('Showing '+shown+' of 150 source records'),'real module current cohort retains its total after response compaction');assert.ok(liveHtml.includes('130 source records'),'real module future cohort is retained');assert.match(liveHtml,/Browse all variation lifecycle records/);
 const exported=JSON.parse(buildModuleJsonDownload(state.projectId,'variations-change',module).toString()).result;
 assert.equal(exported.data.position.sourceLedger.variations.length,420);assert.equal(exported.data.position.sourceLedger.registerScopes.variations.undated.rows.at(-1).variationId,'V419');
 assert.equal(JSON.stringify(ledger),before);assert.equal(JSON.stringify(state.evidenceDocuments),sourceBefore);for(const source of sources)assert.equal(readFileSync(source.path,'utf8'),source.content);
});

test('legacy partial ledger cannot reconstruct cohorts or claim a subtype zero',()=>{
 const rows=Array.from({length:240},(_,i)=>({variationId:'V'+i,status:i<25?'Rejected':'Approved',approvalDate:i<25?'2031-08-01':'2032-01-01',approvedAmount:{value:null,currency:null,taxBasis:'unknown'},receipt:{}}));
 const full={data:{projectionKey:'commercial_canonical',moduleKey:'commercial-variations',dataDateIso:'2031-08-31',rows}},page:any=pageProjectResponse(full,'/api/projects/P/commercial/modules/commercial-variations');
 const {html,kpis}=render(page);assert.match(html,/cannot establish complete dated groups/);assert.match(html,/Showing 25 of 240 source records/);assert.equal(kpis.find(r=>r[0]==='Approved by Data Date')[1],null);
 assert.doesNotMatch(html,/After Data Date, excluded from current totals.*0 source records/);
 const scope=commercialRegisterScope(rows,null,r=>r.approvalDate);assert.equal(scope.asOf.summary.recordCount,0);assert.equal(scope.future.summary.recordCount,0);assert.equal(scope.undated.summary.recordCount,240);
 const unknown:any=pageProjectResponse({data:{...full.data,dataDateIso:null,registerScope:scope}},'/api/projects/P/commercial/modules/commercial-variations');const unknownHtml=render(unknown).html;assert.match(unknownHtml,/Current and future source cohorts cannot be stated/);assert.match(unknownHtml,/Outside a dated position/);assert.match(unknownHtml,/240 source records/);
});

test('variation lifecycle uses full badges and a browse control from the original row population',()=>{
 const rows=Array.from({length:150},(_,i)=>({variationId:'VO'+i,lifecycleStage:'approved',description:'Variation '+i,dates:{approved:'2031-08-01'},cost:{}}));
 const full={data:{projectionKey:'variations_change',position:{currencies:[],contractControls:{variations:{state:'established',recordCount:150,rows},siteInstructions:{}},registers:{}}}};
 const page:any=pageProjectResponse(full,'/api/projects/P/commercial/modules/variations-change');
 const {html}=render(page,"renderCommercialVisual('variations-change',data)");assert.match(html,/150 current rows/);assert.match(html,/Showing 25 of 150 records/);assert.match(html,/Browse all variation lifecycle records/);
 assert.equal((recordDetailPage(full,'/data/position/contractControls/variations/rows',125) as any).rows.at(-1).variationId,'VO149');
});

test('approved-only lifecycle display withholds pending exposure and empty aging bars while keeping identified subsets visible',()=>{
 const vo:any={state:'established',recordCount:620,sourceRecordCount:620,approvedCount:620,pendingCount:null,knownPendingCount:0,unknownAsOfStageCount:0,rows:[],pendingAgeBands:{upTo30Days:0,days31To60:0,days61To90:0,over90Days:0,unknown:0}};
 const full:any={data:{projectionKey:'variations_change',position:{currencies:[],contractControls:{variations:vo,siteInstructions:{}},registers:{}}}};
 const show=()=>render(full,"renderCommercialVisual('variations-change',data)");
 let result=show();assert.equal(result.kpis.find(row=>row[0]==='Known pending')[1],'Not established');assert.match(result.html,/Approved-only or rejected-only rows do not prove/);
 assert.match(result.html,/complete exposure is not established/);
 assert.doesNotMatch(result.html,/There are zero confirmed pending or unknown-stage records/,'an empty identified subset does not prove zero');
 vo.knownPendingCount=4;vo.pendingAgeBands.upTo30Days=4;vo.unknownAsOfStageCount=2;result=show();assert.equal(result.kpis.find(row=>row[0]==='Known pending')[1],4);assert.doesNotMatch(result.html,/No pending lifecycle population is established/);assert.match(result.html,/does not establish the complete pending exposure/);
 vo.pendingCount=0;vo.knownPendingCount=0;vo.unknownAsOfStageCount=0;vo.pendingAgeBands.upTo30Days=0;
 result=show();assert.equal(result.kpis.find(row=>row[0]==='Known pending')[1],0,'a source-established complete zero remains zero');
 assert.match(result.html,/There are zero confirmed pending or unknown-stage records/);
 assert.doesNotMatch(result.html,/Approved-only or rejected-only rows do not prove/,'do not falsely claim uncertainty when a source confirms complete zero');
});
