import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {sourceCommercialEvidence} from '../packages/runtime-api/src/source-commercial-evidence';
import {programmeCashScenario} from '../packages/runtime-api/src/programme-cash-scenario';
import {responseSourceLabels} from '../packages/runtime-api/src/response-labels';
import {pageProjectResponse} from '../packages/runtime-api/src/response-paging';
import {quantityMappingForState} from '../packages/runtime-api/src/quantity-mapping-runtime';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {createCmengServer} from '../packages/runtime-api/src/server';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {resolveBoqSource} from '../packages/runtime-api/src/boq-source';
const code=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const ast=createSourceFile('actual-browser.js',code,ScriptTarget.Latest,true);
const helper=(name:string)=>{const n=ast.statements.filter(isFunctionDeclaration).find(n=>n.name?.text===name);assert.ok(n,name);return n.getText(ast);};
for(let n=0;n<10;n++)test('Source certificate identity, date and ambiguity '+n,()=>{
 const row:any={paymentId:'IPC-'+n,periodEnd:'2026-08-31',certificationDate:'2026-09-04',sourceStatus:'Certified',paymentDate:'2026-09-20',paymentReference:'BANK-'+n,
  amounts:{netCertifiedAmount:{value:100,currency:'SAR'},grossCertifiedAmount:{value:100},paidAmount:{value:70,currency:'SAR'}},receipt:{documentId:'DOC',locator:'row:'+n}};
 const state:any={evidenceDocuments:[],controls:{bonds:[]}},ledger:any={payments:[row],bonds:[]},position:any={currencies:[],certificateProfile:{groups:[]}};
 const before=JSON.stringify(ledger);let value=sourceCommercialEvidence(state,ledger,position,'2026-09-30');
 assert.equal(value.paymentLinkage.coveragePercent,100);assert.equal(value.paymentLinkage.rows[0]!.certificateReference,'IPC-'+n);assert.equal(JSON.stringify(ledger),before);
 ledger.payments.push({...row,receipt:{documentId:'OTHER',locator:'row:'+n},amounts:{...row.amounts,paidAmount:{value:null}}});
 value=sourceCommercialEvidence(state,ledger,position,'2026-09-30');assert.equal(value.paymentLinkage.linked,0);assert.equal(value.paymentLinkage.rows[0]!.state,'ambiguous');
 ledger.payments=[{...row,sourceStatus:'Applied'}];value=sourceCommercialEvidence(state,ledger,position,'2026-09-30');assert.equal(value.paymentLinkage.linked,0,'applied records never stand in for issued certificates');
 ledger.payments=[row];value=sourceCommercialEvidence(state,ledger,position,'2026-09-10');assert.equal(value.paymentLinkage.total,0,'future actual payments remain outside current matching percentage');
});
test('Source population and revision names survive selected response catalogue',()=>{
 const payload={population:{populationId:'population_abc',name:'Current payment certificates'},revision:{revisionId:'rev_xyz',label:'August accepted update'},item:{itemId:'boqitem_123',itemNumber:'3.01'}};
 const labels=responseSourceLabels({},payload);
 const reader=runInNewContext(helper('readerReference')+';readerReference',{currentModuleResult:{data:{sourceLabels:labels}}});
 assert.equal(reader('population_abc'),'Current payment certificates');assert.equal(reader('rev_xyz'),'August accepted update');assert.equal(reader('boqitem_123'),'3.01');
 assert.equal(payload.item.itemId,'boqitem_123');
});
test('One full Command Center denominator survives a 25-record preview',()=>{
 const original={key:'command-center',data:{operationalReporting:{actions:Array.from({length:401},(_,i)=>({recordId:'R'+i,action:'Inspect item '+i}))}}};
 const response:any=pageProjectResponse(original,'/api/projects/P/management/command-center');
 const fn=runInNewContext(helper('indexResponsePopulations')+'\n'+helper('responseListPopulation')+';responseListPopulation',{currentModuleResult:response,responsePopulationRoot:null,responsePopulationIndex:new WeakMap(),responseRowPopulationIndex:new WeakMap()});
 assert.equal(response.data.operationalReporting.actions.length,25);assert.equal(fn(response.data.operationalReporting.actions).total,401);
 assert.match(code,/responseListPopulation\(actions\)\.total/);
});
test('Unique section-name matching does not confuse item numbers or approve allocation',()=>{
 const state=loadCertifiedDemoProject('SECTION-'+randomUUID()),model=state.schedules.at(-1)!.revision.model,q=state.quantities!;
 model.wbs[0]!.name='Earthworks and Site Preparation';q.items=q.items.map(i=>({...i,section:'01. Earthworks & Site Preparation'}));q.allocations=[];state.version++;
 const mapping=quantityMappingForState(state,model)!;assert.equal(mapping.sourceWbsCoveragePercent,100);assert.equal(q.allocations.length,0);
 model.wbs.push({...model.wbs[0]!,wbsId:'DUPLICATE',parentWbsId:null});state.version++;
 const ambiguous=quantityMappingForState(state,model)!;assert.equal(ambiguous.sourceWbsCoveragePercent,0,'duplicate section names require actual source selection');
});
test('Forward receipt curve uses payment dates and conserved source totals',()=>{
 const position:any={foundation:{commercialTerms:{retentionPercent:{value:0},paymentPeriodDays:{value:30}}},currencies:[{currency:'SAR',currentContractValue:{value:1200},grossCertifiedAmount:{value:0},advanceBalance:{value:0}}]};
 const result=programmeCashScenario(position,'2026-08-31','2026-11-30'),g=result.groups[0]!;
 assert.equal(g.rows.reduce((sum,r)=>sum+r.grossValuation,0),1200);assert.equal(g.curvePoints?.at(-1)?.dateIso,'2026-11-30');
 assert.equal(g.curvePoints?.at(0)?.grossValuation,0);assert.equal(g.curvePoints?.find(r=>r.dateIso==='2026-09-30')?.netReceipt,0,'no payment before the assumed clause period');
 assert.equal(g.curvePoints?.at(-1)?.grossValuation,1200);
});
test('Create BOQ links is a real source-backed route and saves only a review candidate',async()=>{
 const state=loadCertifiedDemoProject('LINK-ROUTE-'+randomUUID()),current=projectControlSchedule(state)!;
 const source=resolveBoqSource(state,current.revision.revisionId).quantities!;
 const server=createCmengServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=(server.address() as any).port,base='http://127.0.0.1:'+port+'/api/projects/'+encodeURIComponent(state.projectId)+'/boq/activity-link-candidates';
 try{
  const menu:any=await (await fetch(base+'?kind=items')).json();assert.ok(menu.options.length>0);assert.ok(menu.options[0].label.includes(source.items[0]!.itemNumber!));
  const before=JSON.stringify(source.allocations);
  const saved=await fetch(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({quantityItemId:source.items[0]!.quantityItemId,activityId:current.revision.model.activities[0]!.activityId,proposedBy:'PMC planner',sourceRef:'Source BOQ item and current programme',reason:'Exact reviewed work scope'})});
  assert.equal(saved.status,201);const result:any=await saved.json();assert.equal(result.candidate.state,'candidate');assert.equal(JSON.stringify(source.allocations),before);
  assert.match(code,/Create BOQ links/);assert.match(code,/openBoqLinkEditor/);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
