import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {ingestBoq} from '../packages/boq-ingestion/src';
import {quantityModelFromBoq} from '../packages/runtime-api/src/boq-source';
import {projectDecisionFacts,decisionAnalysisForModule} from '../packages/runtime-api/src/project-decision-facts';
import {pageProjectResponse} from '../packages/runtime-api/src/response-paging';
import {decisionFactsScript} from '../packages/runtime-api/src/ui-decision-facts';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {runInNewContext} from './browser-context';

async function fixture(){
 const state=loadCertifiedDemoProject('BOQ-VALUES-'+randomUUID());state.evidenceDocuments=[];
 const model=state.schedules.at(-1)!.revision.model;model.dataDateIso='2026-08-31';
 const csv='Item,Section,Description,Unit,Qty,Rate,Amount,Currency\n'+[
  '1.0001,Area A,Rounded source amount,m,3,3.333,10,QAR',
  '2,Area A,Missing source amount,m,2,5,,QAR',
  '3,Area A,Explicit zero,m,0,5,0,QAR',
  '4,Area A,Unpriced item,m,1,,,QAR',
  '5,Area A,Other currency,m,2,3,6,USD',
  '6,Area A,Amount without quantity or rate,m,,,50,QAR',
  '7,Area A,Conflicting source reading,m,300,4,12,QAR',
 ].join('\n');
 const boq=await ingestBoq({projectId:state.projectId,bytes:Buffer.from(csv),verifiedMediaType:'text/csv',receivedAt:'2026-08-01',sourceFilename:'source-amount.csv'});
 state.boq=boq;state.boqRevisions=[boq];state.quantities=quantityModelFromBoq(boq,model.sourceRevisionId,null);
 const item=state.quantities.items.find(i=>i.itemNumber==='1.0001')!;
 state.quantities.installedSnapshots=[{snapshotId:'MEASURED',quantityItemId:item.quantityItemId,installedQuantity:3,asOfIso:'2026-08-31',sourceRefs:[{source:'installed_measurement',locator:'measurement:1'}]}] as any;
 state.version++;return state;
}

test('priced BOQ scope retains source amount precision, zero, unknowns and currency without changing measured value',async()=>{
 const state=await fixture(),original=JSON.stringify([state.boq,state.quantities]);
 const facts=projectDecisionFacts(state).quantities,rows=facts.items;
 const byNumber=(n:string)=>rows.find(r=>r.itemNumber===n)!;
 assert.equal(byNumber('1.0001').contractValue,10);assert.equal(byNumber('1.0001').installedValue,9.999);
 assert.equal(byNumber('1.0001').contractValueBasis,'Source BOQ amount');
 assert.equal(byNumber('2').contractValue,10);assert.match(byNumber('2').contractValueBasis,/Calculated/);
 assert.equal(byNumber('3').contractValue,0);assert.equal(byNumber('3').contractValueBasis,'Source BOQ amount');
 assert.equal(byNumber('4').contractValue,null);
 assert.equal(byNumber('6').contractValue,50);assert.equal(byNumber('6').contractQuantity,null);
 assert.equal(byNumber('7').contractValue,null,'a quarantined source amount must not become a priced input');
 const qar=facts.areas.find(a=>a.currency==='QAR')!,usd=facts.areas.find(a=>a.currency==='USD')!;
 assert.equal(qar.contractValue,70);assert.equal(usd.contractValue,6);
 assert.equal(qar.pricedItemCount,4);assert.equal(qar.itemCount,6);
 assert.equal(qar.sourceAmountItemCount,3);assert.equal(qar.calculatedAmountItemCount,1);
 assert.equal(qar.installedValue,9.999);assert.equal(qar.physicalProgressPercent,100*9.999/70);
 assert.match(qar.physicalBasis,/rounding/);assert.equal(qar.certifiedValue,null);
 assert.equal(JSON.stringify([state.boq,state.quantities]),original,'source amounts and measurements are immutable');
 const analysis=decisionAnalysisForModule(state,'progress-breakdown') as any;
 const page=pageProjectResponse({key:'progress-breakdown',data:{decisionAnalysis:analysis}},'/api/projects/P/schedule/modules/progress-breakdown') as any;
 assert.deepEqual(page.data.decisionAnalysis.areas,facts.areas,'screen and complete reporting data share one qualified amount');
});

test('decision tables format money consistently and do not label a small complete list as pageable',()=>{
 const ctx:any={readerText:String,managementNumber:(v:number)=>v.toLocaleString('en'),escapeHtml:String,planningShortDate:String,currentModuleResult:null};
 const display=runInNewContext(decisionFactsScript+';decisionDisplay',ctx);
 assert.equal(display(417143373.8,'contractValue'),'417,143,373.80');assert.equal(display(0,'installedValue'),'0.00');
 assert.equal(display(null,'contractValue'),'Not established','M15.2: a missing value is not established, never "Not in source"');assert.equal(display('1.0001','itemNumber'),'1.0001');
 const table=runInNewContext('decisionTable',ctx);
 const small=table('areas',[{area:'Area A',currency:'QAR',contractValue:10,installedValue:null,missingInputs:['Dated installed measurements']}],'/data/decisionAnalysis/areas',1);
 assert.match(small,/10\.00/);assert.match(small,/Showing 1–1 of 1/);assert.doesNotMatch(small,/Previous records|Next records|not in shown rows/);
 assert.match(small,/not established for that record/);assert.match(small,/class="decision-inputs"/);
 const paged=table('areas',[{area:'Area A'}],'/data/decisionAnalysis/areas',31);
 assert.match(paged,/Next records/);assert.match(paged,/of 31/);
 const last=table('areas',[],'/data/decisionAnalysis/areas',31,25,{rows:[{area:'Last'}],offset:25,total:31,hasMore:false});
 assert.match(last,/Previous records/);assert.match(last,/disabled onclick=.*Next records/);
 assert.match(cmengUatHtml(),/\.decision-panel \.table-wrap \.decision-inputs\{min-width:280px/);
});
