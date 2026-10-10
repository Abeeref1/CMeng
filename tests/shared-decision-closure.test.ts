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
import {projectDecisionFacts,decisionAnalysisForModule} from '../packages/runtime-api/src/project-decision-facts';
import {boqProgrammeLinks} from '../packages/runtime-api/src/boq-programme-links';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
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

test('Decision-list paging is based on full rows and exposes all records with exact totals',()=>{
 const source:any={key:'near-critical',data:{decisionAnalysis:{kind:'float_erosion',trends:{rows:Array.from({length:251},(_,i)=>({activityReference:'ACT-'+i,currentFloatHours:i+1,turnsCriticalByIso:'2027-01-31'}))}}}};
 const p:any=pageProjectResponse(source,'/api/projects/P/schedule/modules/near-critical');assert.equal(p.responsePaging.tables.find((t:any)=>t.pointer==='/data/decisionAnalysis/trends/rows').total,251);
 assert.equal((recordDetailPage(source,'/data/decisionAnalysis/trends/rows',250) as any).rows[0].activityReference,'ACT-250');
 const ctx:any={currentModuleResult:p,fmt:String,escapeHtml:String,planningShortDate:String};
 const result=runInNewContext(funcs('decisionTable')+';decisionTable',ctx)('erosion',p.data.decisionAnalysis.trends.rows,'/data/decisionAnalysis/trends/rows',251);assert.match(result,/251/);assert.match(result,/ACT-0/);assert.doesNotMatch(result,/ACT-250/);assert.match(result,/loadDecisionPage/);
});

test('Decision caches reuse the exact version but invalidate on a new source version',t=>{
 const {state}=fixture(t);const a=projectDecisionFacts(state);assert.equal(projectDecisionFacts(state),a);assert.equal(a.completionConstraints,a.completionConstraints);state.version++;assert.notEqual(projectDecisionFacts(state),a);
});
