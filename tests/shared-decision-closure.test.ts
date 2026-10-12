import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {commercialCanonical} from '../packages/runtime-api/src/commercial-canonical';
import {commercialPositionForState} from '../packages/runtime-api/src/commercial-runtime';
import {sourceProgressEvidence} from '../packages/runtime-api/src/source-progress-evidence';
import {projectDecisionFacts,decisionAnalysisForModule,buildRegisterChecks} from '../packages/runtime-api/src/project-decision-facts';
import {boqProgrammeLinks} from '../packages/runtime-api/src/boq-programme-links';
import {quantityModelFromBoq} from '../packages/runtime-api/src/boq-source';
import {ingestBoq} from '../packages/boq-ingestion/src';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {buildDeliveryWorkfrontBreakdown} from '../packages/progress-breakdown/src/projector';
import {schedulePlanPositions} from '../packages/progress-scurve/src/projector';
import {pageProjectResponse,recordDetailPage} from '../packages/runtime-api/src/response-paging';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {runInNewContext} from './browser-context';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';

function fixture(t:any){
 const dir=mkdtempSync(join(tmpdir(),'cmeng-decisions-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const state=loadCertifiedDemoProject('DECISION-'+randomUUID());state.evidenceDocuments=[];state.controls.bonds=[];state.controls.progressEvidence={};state.version++;
 const csv=(type:string,content:string)=>{const documentId='held-'+state.evidenceDocuments.length,storedPath=join(dir,documentId+'.csv');writeFileSync(storedPath,content);
  state.evidenceDocuments.push({documentId,sourceFilename:type+'-'+documentId+'.csv',storedPath,sourceHashSha256:createHash('sha256').update(content).digest('hex'),mediaType:'text/csv',basisState:'active',linkedArtifactId:null,category:'boq_cost',documentType:type,familyKey:documentId,uploadedAt:'2026-09-01',diagnostics:[],assertions:[]} as any);state.version++;return documentId;};
 return {state,csv};
}
const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const ast=createSourceFile('assembled.js',script,ScriptTarget.Latest,true);
function funcs(...names:string[]){return names.map(name=>{const n=ast.statements.filter(isFunctionDeclaration).find(n=>n.name?.text===name);assert.ok(n,name);return n.getText(ast)}).join('\n');}

for(let sample=0;sample<10;sample++)test('Unmatched source WBS still uses a unique section relationship, not an invented allocation '+sample,t=>{
 const {state}=fixture(t),model=state.schedules.at(-1)!.revision.model,q=state.quantities!;
 model.wbs[0]!.name='Earthworks & Site Preparation';q.items=q.items.map(r=>({...r,section:'Earthworks & Site Preparation',wbsCode:'OTHER-SYSTEM.01'}));q.allocations=[];state.version++;
 const before=JSON.stringify(q),link=boqProgrammeLinks(state,model);
 assert.equal(link.coveragePercent,100);assert.equal(link.approvedAllocatedItemCount,0);assert.match(link.rows[0].basis,/no exact programme match/);assert.equal(JSON.stringify(q),before);
 model.wbs.push({...model.wbs[0]!,wbsId:'DUPLICATE'});state.version++;
 assert.equal(boqProgrammeLinks(state,model).coveragePercent,0,'ambiguous section remains unlinked');
});

test('Currency-qualified certificate values and alternate instrument columns remain source records',t=>{
 const {state,csv}=fixture(t);state.schedules.at(-1)!.revision.model.dataDateIso='2026-08-31';state.controls.contractValue={amount:1000,currency:'QAR',sourceRefs:['contract:amount']};
 csv('bond_register','Security No,Type,Amount QAR,Expiry Date,Status\nAB,Advance Payment Guarantee,100,2027-01-01,Active\nCAR,CAR Insurance Policy,5000,2027-01-01,Active');
 csv('payment_certificates','Certificate No,Period End,Certificate Date,Actual Payment Date,Gross Work QAR,Net Certified QAR,Amount Paid QAR,Tax Basis,Status,Certified Amount Basis,Paid Amount Basis\nIPC-1,2026-06-30,2026-07-03,2026-07-20,100,100,100,exclusive,Paid,incremental,incremental\nIPC-2,2026-07-31,2026-08-03,,200,200,0,exclusive,Certified,incremental,incremental\nIPC-3,2026-08-31,,,400,400,0,exclusive,Applied,incremental,incremental');
 const ledger=commercialCanonical(state),p:any=commercialPositionForState(state);
 assert.equal(ledger.bonds?.length,1);assert.equal(ledger.insurances?.length,1,'combined security insurance remains present and is not a bond');assert.equal(ledger.bonds[0]!.kind,'advance_payment');assert.equal(ledger.payments[0]!.amounts.netCertifiedAmount.value,100);assert.equal(ledger.payments[0]!.amounts.netCertifiedAmount.currency,'QAR');
 assert.equal(p.heldEvidence.advancePaymentBonds.count,1);assert.equal(p.heldEvidence.certificates.count,2,'application excluded');assert.equal(p.paymentLinkage.coveragePercent,100);
 const progress=sourceProgressEvidence(state).certified!;assert.equal(progress.valuePercent,30);assert.equal(progress.asOfIso,'2026-08-31');
});

test('Commercial Brief reads current EAC and CPI from the same period and retains values under paging',t=>{
 const {state,csv}=fixture(t);state.schedules.at(-1)!.revision.model.dataDateIso='2026-08-31';
 csv('cost_evm_report','Metric,Value,Unit,Status,As Of,VAT Basis\nPV,90,AED,Approved,2026-08-31,exclusive\nEV,80,AED,Approved,2026-08-31,exclusive\nAC,100,AED,Actual,2026-08-31,exclusive\nBAC,120,AED,Approved,2026-08-31,exclusive\nEAC,150,AED,Forecast,2026-08-31,exclusive');
 const facts=projectDecisionFacts(state);assert.equal(facts.commercialSummary.find(r=>r.currency==='AED')!.cpi.value,0.8);assert.equal(facts.commercialSummary.find(r=>r.currency==='AED')!.forecastEac.value,150);
 const r:any=moduleForProject(state.projectId,'pmo-analysis'),p:any=pageProjectResponse(r,'/api/projects/'+state.projectId+'/schedule/modules/pmo-analysis');
 assert.deepEqual(p.data.briefCommercialPosition,r.data.briefCommercialPosition,'screen and report consume identical complete commercial facts');
 assert.equal(p.data.briefCommercialPosition.currencies.find((r:any)=>r.currency==='AED').cpi.value,0.8);
});

test('Completion constraints retain the programme type and date rather than a generic investigation request',t=>{
 const {state}=fixture(t),model=state.schedules.at(-1)!.revision.model;
 model.activities.push({...model.activities.at(-1)!,activityId:'PROJECT-COMPLETE',activityType:'finish_milestone',name:'Project completion',status:'not_started',sourceConstraints:[{type:'CS_MEOA',dateIso:'2027-01-14T17:00:00Z'}]} as any);state.version++;
 const facts=projectDecisionFacts(state);assert.ok(facts.completionConstraints.some(c=>c.activityReference==='PROJECT-COMPLETE'&&c.typeLabel==='Finish on or after'&&c.dateIso==='2027-01-14'));
});

test('Float erosion uses all activities and real elapsed months without predicting an increasing-float risk',t=>{
 const {state}=fixture(t),previous=state.schedules[0]!.revision.model,current=state.schedules.at(-1)!.revision.model;
 previous.dataDateIso='2026-06-30';current.dataDateIso='2026-07-31';
 const base=current.activities.find(a=>a.status!=='completed')!;
 previous.activities=[{...base,totalFloatHours:24,currentFinishIso:'2026-08-15',forecastFinishIso:null}];
 current.activities=[{...base,totalFloatHours:12,currentFinishIso:'2026-09-15',forecastFinishIso:null}];state.version++;
 const trend=projectDecisionFacts(state).trends;assert.equal(trend.elapsedMonths,1);assert.equal(trend.rows[0].floatErosionHoursPerMonth,12);assert.equal(trend.rows[0].turnsCriticalByIso,'2026-08-31');assert.equal(trend.slipRate.value,31);
 current.activities[0]!.totalFloatHours=30;state.version++;assert.equal(projectDecisionFacts(state).trends.rows[0].turnsCriticalByIso,null);
});

test('Detailed claim and long-window screens are derived from actual notice and submission dates',t=>{
 const {state,csv}=fixture(t);state.schedules.at(-1)!.revision.model.dataDateIso='2026-09-30';
 csv('claim_register','Claim ID,Event Notice Date,Detailed Claim Date,Window Start,Window End\nC1,2026-01-01,2026-02-13,2026-01-01,2026-04-02\nC2,2026-03-01,2026-04-01,2026-03-01,2026-06-01');
 const c=projectDecisionFacts(state).claimChecks;assert.equal(c.total,2);assert.equal(c.rows[0].dueDateIso,'2026-02-12');assert.equal(c.rows[0].daysAfterDue,1);assert.equal(c.longWindowCount,1);assert.equal(c.rows[1].longWindow,false);
 assert.match(c.rows[0].basis,/screening/);assert.equal(decisionAnalysisForModule(state,'notices-claims')!.kind,'detailed_claims');
});

test('Monthly EVM includes all retained months and preserves currency separation and missing values',t=>{
 const {state,csv}=fixture(t);state.schedules.at(-1)!.revision.model.dataDateIso='2026-08-31';
 csv('cost_evm_report','Period End,PV,EV,AC,BAC,Currency,VAT Basis\n2026-06-30,80,70,75,100,QAR,exclusive\n2026-07-31,90,80,85,100,QAR,exclusive\n2026-08-31,100,90,95,100,QAR,exclusive\n2026-09-30,110,100,105,100,QAR,exclusive');
 const series=projectDecisionFacts(state).monthlyEvm.find((s:any)=>s.currency==='QAR');assert.ok(series);assert.deepEqual(series.points.map((p:any)=>p.dateIso),['2026-06-30','2026-07-31','2026-08-31']);assert.equal(series.points[2].ev,90);assert.equal(series.points[2].ac,95);
});

test('Measured productivity never substitutes schedule progress or mixes unqualified area certificates',t=>{
 const {state,csv}=fixture(t),model=state.schedules.at(-1)!.revision.model;model.dataDateIso='2026-08-31';
 const q=state.quantities!;q.installedSnapshots=[];q.items[0]!.section='Earthworks';
 for(const a of model.activities)if(a.activityId==='A200'){a.currentFinishIso='2026-09-30';a.forecastFinishIso='2026-09-30';}
 csv('installed_measurement_register','Item No,Unit,Section,Measurement Date,Cumulative Installed Qty,Labour Hours Per Unit,Actual Labour Hours,Period Start,Period End,Area\n1.1,m3,Earthworks,2026-07-31,20,2,10,2026-06-30,2026-07-31,Plot 01\n1.1,m3,Earthworks,2026-08-31,50,2,15,2026-07-31,2026-08-31,Plot 01');
 const d=projectDecisionFacts(state).quantities.items[0]!;assert.equal(d.installedQuantity,50);assert.equal(d.installedPercent,50);assert.equal(d.periodInstalledQuantity,30);assert.equal(d.periodProgressPercent,30);assert.equal(d.earnedHours,100);assert.equal(d.periodEarnedHours,60);assert.equal(d.actualHours,15);assert.equal(d.productivityPerActualHour,2);assert.equal(d.requiredRatePerCalendarDay,50/30);assert.equal(d.installedValue,null,'no invented unit price');assert.equal(d.area,'Plot 01');
 assert.equal(projectDecisionFacts(state).quantities.areas[0]!.certifiedValue,null,'whole-project certification never allocated to areas');
});

test('S-32 keeps BOQ item progress, productivity and installed-versus-certified value on explicit source evidence only',async t=>{
 const {state,csv}=fixture(t),model=state.schedules.at(-1)!.revision.model;model.dataDateIso='2026-08-31';
 const boq=await ingestBoq({projectId:state.projectId,bytes:Buffer.from('Item,Section,Description,Unit,Qty,Rate,Amount,Currency\n1.1,Earthworks,Concrete,m3,100,10,1000,QAR'),verifiedMediaType:'text/csv',sourceFilename:'priced-boq.csv',receivedAt:'2026-08-01T00:00:00.000Z'});
 state.boq=boq;state.boqRevisions=[boq];state.quantities=quantityModelFromBoq(boq,model.sourceRevisionId,null);
 const q=state.quantities!,item=q.items[0]!;q.installedSnapshots=[];q.allocations=[{allocationId:'S32-A200',quantityItemId:item.quantityItemId,activityId:'A200',allocatedQuantity:100,sourceRefs:[{source:'governed_mapping',locator:'S32:A200'}]}];state.version++;
 for(const a of model.activities)if(a.activityId==='A200'){a.currentFinishIso='2026-09-30';a.forecastFinishIso='2026-09-30';}
 csv('installed_measurement_register','Item No,Unit,Section,Measurement Date,Cumulative Installed Qty,Labour Hours Per Unit,Actual Labour Hours,Period Start,Period End,Area\n1.1,m3,Earthworks,2026-07-31,20,2,10,2026-06-30,2026-07-31,Plot 01\n1.1,m3,Earthworks,2026-08-31,50,2,15,2026-07-31,2026-08-31,Plot 01');
 csv('payment_certificates','Certificate No,Certification Date,Item No,Unit,Section,Area,Certified Value,Certified Amount Basis,Currency,Status\nIPC-ITEM-1,2026-08-20,1.1,m3,Earthworks,Plot 01,400,incremental,QAR,Certified');
 const row=projectDecisionFacts(state).quantities.items[0]!;
 assert.equal(row.installedPercent,50);assert.equal(row.periodProgressPercent,30);assert.equal(row.earnedHours,100);assert.equal(row.periodEarnedHours,60);
 assert.equal(row.actualHours,15);assert.equal(row.productivityPerActualHour,2);assert.equal(row.installedValue,500);assert.equal(row.certifiedValue,400);assert.equal(row.installedAgainstCertified,100);
 assert.ok(row.requiredRatePerCalendarDay!==null);assert.doesNotMatch(row.basis,/allocated to items/i);
 const analysis:any=decisionAnalysisForModule(state,'quantity-scurve');assert.equal(analysis.kind,'measured_productivity');assert.equal(analysis.quantities.items[0].certifiedValue,400);
 assert.match(script,/Period earned hours/);assert.match(script,/Installed less certified/);
});

test('S-34 payment due dates use explicit lifecycle authority and applications never become certificates',t=>{
 const {state,csv}=fixture(t);state.schedules.at(-1)!.revision.model.dataDateIso='2026-08-31';
 csv('payment_certificates','Certificate No,Period End,Certificate Date,Payment Due Date,Actual Payment Date,Net Certified QAR,Amount Paid QAR,Tax Basis,Status,Certified Amount Basis,Paid Amount Basis\nIPC-DUE,2026-06-30,2026-07-01,2026-07-31,2026-08-02,100,100,exclusive,Paid,incremental,incremental\nIPC-APP,2026-07-31,,2026-08-31,,200,0,exclusive,Applied,incremental,incremental');
 const p=projectDecisionFacts(state).paymentChecks,paid=p.rows.find((r:any)=>r.certificateReference==='IPC-DUE')!,application=p.rows.find((r:any)=>r.certificateReference==='IPC-APP')!;
 assert.equal(paid.contractDueDateIso,'2026-07-31');assert.equal(paid.state,'paid_late');assert.equal(paid.daysLate,2);assert.match(paid.basis,/explicit source due date/);
 assert.equal(application.state,'application_not_certified');assert.equal(application.includedInCertifiedTotals,false);assert.equal(p.appliedExcludedCount,1);
 assert.match(p.basis,/Applications are not certifications/);
});

test('S-35 every comparable same-currency register total is checked against current contract and every excess is queried',()=>{
 const fact=(value:number|null,state='established')=>({value,state,sourceRefs:value===null?[]:['SOURCE']});
 const commercial={currencies:[
  {currency:'QAR',currentContractValue:fact(1000,'official'),grossCertifiedAmount:fact(1200),netCertifiedAmount:fact(900),paidAmount:fact(800),pendingVariationAmount:fact(null)},
  {currency:'USD',currentContractValue:fact(2000,'official'),grossCertifiedAmount:fact(1500),netCertifiedAmount:fact(null),paidAmount:fact(null),pendingVariationAmount:fact(null)}
 ]};
 const quantities={items:[{currency:'QAR',contractValue:1100,sourceRefs:['BOQ:1']},{currency:'USD',contractValue:1800,sourceRefs:['BOQ:2']} ]};
 const checks=buildRegisterChecks(commercial,{},quantities);
 const qarGross=checks.checkedRows.find((r:any)=>r.currency==='QAR'&&r.register==='Gross issued certificates')!,qarBoq=checks.checkedRows.find((r:any)=>r.currency==='QAR'&&r.register==='Priced BOQ items')!;
 assert.equal(qarGross.state,'query_required');assert.equal(qarGross.excess,200);assert.equal(qarBoq.state,'query_required');assert.equal(qarBoq.excess,100);
 assert.ok(checks.checkedRows.some((r:any)=>r.currency==='QAR'&&r.register==='Net issued certificates'&&r.state==='within_qualified_contract_comparison'));
 assert.equal(checks.rows.length,2,'only actual above-contract exceptions are in the exception list');
 assert.ok(checks.rows.every((r:any)=>r.action.includes('Reconcile the source scope')));
 assert.equal(checks.checkedRows.some((r:any)=>r.register==='Pending variations'),false,'missing totals are not converted to zero');
});
test('Decision-list paging is based on full rows and exposes all records with exact totals',()=>{
 const source:any={key:'near-critical',data:{decisionAnalysis:{kind:'float_erosion',trends:{rows:Array.from({length:251},(_,i)=>({activityReference:'ACT-'+i,currentFloatHours:i+1,turnsCriticalByIso:'2027-01-31'}))}}}};
 const p:any=pageProjectResponse(source,'/api/projects/P/schedule/modules/near-critical');assert.equal(p.responsePaging.tables.find((t:any)=>t.pointer==='/data/decisionAnalysis/trends/rows').total,251);
 assert.equal((recordDetailPage(source,'/data/decisionAnalysis/trends/rows',250) as any).rows[0].activityReference,'ACT-250');
 const ctx:any={currentModuleResult:p,fmt:String,escapeHtml:String,planningShortDate:String};
 const result=runInNewContext(funcs('decisionTable')+';decisionTable',ctx)('erosion',p.data.decisionAnalysis.trends.rows,'/data/decisionAnalysis/trends/rows',251);assert.match(result,/251/);assert.match(result,/ACT-0/);assert.doesNotMatch(result,/ACT-250/);assert.match(result,/loadDecisionPage/);
});

test('S-07 substantive decision tables have one owning page and are not repeated on neighbouring pages',t=>{
 const {state}=fixture(t);
 const owners=new Map([
  ['quantity-scurve','measured_productivity'],['progress-breakdown','area_progress'],['progress-scurve','monthly_evm'],
  ['notices-claims','detailed_claims'],['payments','payment_due'],['commercial-overview','register_reconciliation'],
  ['near-critical','float_erosion'],['variance-trends','finish_slip']
 ]);
 for(const [key,kind] of owners)assert.equal((decisionAnalysisForModule(state,key) as any)?.kind,kind,key);
 for(const key of ['progress-report','cost-forecast','commercial-claims-notices','schedule-analytics','activity-analytics'])
   assert.equal(decisionAnalysisForModule(state,key),null,key+' must link to the owning decision page rather than repeat its block');
});
test('Decision caches reuse the exact version but invalidate on a new source version',t=>{
 const {state}=fixture(t);const a=projectDecisionFacts(state);assert.equal(projectDecisionFacts(state),a);assert.equal(a.completionConstraints,a.completionConstraints);state.version++;assert.notEqual(projectDecisionFacts(state),a);
});


test('Window screening uses actual programme intervals as well as dated claim register windows',t=>{
 const {state}=fixture(t);
 const input={windows:[
  {windowId:'W1',sequence:1,windowStartIso:'2026-01-31',windowEndIso:'2026-04-30',fromRevisionId:'R1',toRevisionId:'R2'},
  {windowId:'W2',sequence:2,windowStartIso:'2026-04-30',windowEndIso:'2026-08-01',fromRevisionId:'R2',toRevisionId:'R3'},
  {windowId:'W3',sequence:3,windowStartIso:null,windowEndIso:'2026-09-01',fromRevisionId:'R3',toRevisionId:'R4'}
 ]};
 const before=JSON.stringify(input),result:any=decisionAnalysisForModule(state,'windows-analysis',input);
 assert.equal(result.claimChecks.rows[0].longWindow,false,'exactly three calendar months is not over three months');
 assert.equal(result.claimChecks.rows[1].longWindow,true);assert.match(result.claimChecks.rows[1].warning,/exceeds three calendar months/);
 assert.equal(result.claimChecks.rows[2].longWindow,null);assert.deepEqual(result.claimChecks.rows[2].missingInputs,['Window start date']);
 assert.equal(result.claimChecks.windowCount,3);assert.equal(JSON.stringify(input),before,'original analysis intervals are retained');
});

// Exact parity is mandatory: sharing source-wide working calendar positions
// must not alter any WBS/workfront number, denominator, classification or evidence.
test('Cold Delivery shared calendar positions exactly equal standalone workfront calculations',t=>{
 const {state}=fixture(t),baseline=state.schedules[0]!.revision.model,current=state.schedules.at(-1)!.revision.model;
 const sharedPlanPositions=schedulePlanPositions(current,baseline);
 const input={generatedAt:'2026-08-31T00:00:00Z',producerVersion:'shared-calendar-parity',baselineModel:baseline};
 const groups=new Map<string,typeof current.activities>();
 for(const a of current.activities){const key=a.wbsId??'unassigned';const list=groups.get(key)??[];list.push(a);groups.set(key,list);}
 for(const activities of [...groups.values()].slice(0,12)){
  const subset={...current,activities};
  const original=buildDeliveryWorkfrontBreakdown(subset,input);
  const reused=buildDeliveryWorkfrontBreakdown(subset,{...input,sharedPlanPositions});
  assert.deepEqual(reused,original,'full result must be identical, with no changed WBS/float/progress values');
 }
});
