import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runInNewContext} from 'node:vm';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {commercialPositionForState} from '../packages/runtime-api/src/commercial-runtime';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {projectDiagnosisScript} from '../packages/runtime-api/src/ui-project-diagnosis';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// F20 (D-066/D-096/D-098/D-149) and F29 (D-079/D-097/D-099/D-180).
function fixture(t:any){
 const dir=mkdtempSync(join(tmpdir(),'f20-cash-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const state=loadCertifiedDemoProject('F20-'+randomUUID());
 state.schedules.at(-1)!.revision.model.dataDateIso='2031-08-31';
 state.evidenceDocuments=[];state.controls.bonds=[];(state.controls as any).invoices=[];state.resourcesByRevision=new Map();state.version++;
 const csv=(type:string,content:string)=>{const documentId='source-'+state.evidenceDocuments.length,storedPath=join(dir,documentId+'.csv');writeFileSync(storedPath,content);
  state.evidenceDocuments.push({documentId,sourceFilename:documentId+'.csv',storedPath,sourceHashSha256:createHash('sha256').update(content).digest('hex'),mediaType:'text/csv',basisState:'active',linkedArtifactId:null,category:'boq_cost',documentType:type,familyKey:documentId,uploadedAt:'2031-09-01',diagnostics:[],assertions:[]} as any);state.version++;return documentId;};
 const certificates=csv('payment_certificates','Certificate No,Period End,Certificate Date,Payment Date,Gross Work,Variations,Net Certified,Paid Amount,Currency,Tax Basis,Status,Certified Amount Basis,Paid Amount Basis\n'+
  'P1,2031-06-30,2031-07-10,2031-07-20,110,0,100,100,QAR,exclusive,Paid,incremental,incremental\n'+
  'P2,2031-07-31,2031-08-10,2031-08-25,220,0,200,150,QAR,exclusive,Paid,incremental,incremental');
 return {state,csv,certificates};
}
const qar=(state:any)=>commercialPositionForState(state).datedCashSeries!.currencies.find(c=>c.currency==='QAR')!;

test('F20 one dated cash series by month: certified and paid points carry their date, currency and source row',t=>{
 const {state,certificates}=fixture(t);
 const s=qar(state);
 const certified=s.points.filter(p=>p.kind==='certified'),paid=s.points.filter(p=>p.kind==='paid');
 assert.deepEqual(certified.map(p=>[p.date,p.amount]),[['2031-07-10',100],['2031-08-10',200]]);
 assert.deepEqual(paid.map(p=>[p.date,p.amount]),[['2031-07-20',100],['2031-08-25',150]]);
 for(const p of [...certified,...paid]){assert.equal(p.currency,'QAR');assert.equal(p.basis,'source_record');assert.ok(p.sourceRefs.some(r=>r.includes(certificates)),'each point names its source document');}
 assert.deepEqual(s.periods.map(p=>[p.period,p.certified,p.paid]),[['2031-07',100,100],['2031-08',200,150]]);
 assert.equal(s.certifiedToDate,300);assert.equal(s.paidToDate,250);assert.equal(s.latestActualPeriod,'2031-08');
});

test('F29 a supplied source cash-flow forecast is read for future periods instead of "No source rows"',t=>{
 const {state,csv}=fixture(t);
 const forecast=csv('cost_evm_report','Metric,Value,Unit,Status,As Of\nCash Forecast,400,QAR,Forecast,2031-09-30\nCash Forecast,450,QAR,Forecast,2031-10-31');
 const receipts=csv('cost_evm_report','Period End,Forecast Receipts,Currency\n2031-09-30,180,QAR\n2031-10-31,210,QAR');
 const position=commercialPositionForState(state);
 // The cash-flow readiness keeps future rows out of its observed history; the shared series reads them as the forecast.
 assert.equal(position.performance.cashFlow.currencies.find(c=>c.currency==='QAR')!.sourceReadiness.forwardPlan.forecastBasis,'no_rows');
 const s=qar(state);
 assert.equal(s.forecastBasis,'source_cash_flow_forecast');assert.equal(s.forecastBasisLabel,'Source cash-flow forecast');
 const f=s.points.filter(p=>p.kind==='forecast');
 assert.deepEqual(f.filter(p=>p.flow==='expenditure').map(p=>[p.period,p.amount]),[['2031-09',400],['2031-10',450]]);
 assert.deepEqual(f.filter(p=>p.flow==='income').map(p=>[p.period,p.amount]),[['2031-09',180],['2031-10',210]]);
 assert.ok(f.filter(p=>p.flow==='expenditure').every(p=>p.sourceRefs.some(r=>r.includes(forecast))));
 assert.ok(f.filter(p=>p.flow==='income').every(p=>p.sourceRefs.some(r=>r.includes(receipts))));
 assert.deepEqual(s.periods.find(p=>p.period==='2031-09'),{period:'2031-09',certified:null,paid:null,forecastIncome:180,forecastExpenditure:400,sourceRefs:s.periods.find(p=>p.period==='2031-09')!.sourceRefs});
 assert.equal(s.forecastIncomeTotal,390);assert.equal(s.forecastExpenditureTotal,850);assert.equal(s.nextForecastPeriod,'2031-09');
 assert.equal(s.certifiedToDate,300,'future forecast rows never enter the actual to-date figures');
});

test('F29 without a source forecast, cost-loaded programme assignments give a dated remaining-value forecast with its basis stated',t=>{
 const {state}=fixture(t);
 const current=projectControlSchedule(state)!;
 const base={projectId:null,nativeTaskId:'T',resourceId:null,roleId:null,resourceType:'labor',plannedUnits:null,actualRegularUnits:null,actualOvertimeUnits:null,remainingUnits:null,atCompletionUnits:null,
  plannedCost:0,actualRegularCost:null,actualOvertimeCost:null,plannedUnitsPerHour:null,remainingUnitsPerHour:null,plannedStartIso:null,plannedFinishIso:null,actualStartIso:null,actualFinishIso:null,curveId:null,sourceRefs:[{source:'xer',locator:'TASKRSRC:1'}],diagnostics:[]};
 state.resourcesByRevision.set(current.revision.revisionId,{projectId:null,sourceRevisionId:current.revision.revisionId,units:[],financialPeriods:[],resources:[],periodActuals:[],diagnostics:[],assignments:[
  {...base,assignmentId:'A1',activityId:'X1',remainingCost:300,remainingStartIso:'2031-09-01T08:00',remainingFinishIso:'2031-10-30T17:00'},   // 30 + 30 days
  {...base,assignmentId:'A2',activityId:'X2',remainingCost:90,remainingStartIso:'2031-08-20T08:00',remainingFinishIso:'2031-09-09T17:00'},   // only the 9 days after the Data Date
  {...base,assignmentId:'A3',activityId:'X3',remainingCost:50,remainingStartIso:'2031-07-01T08:00',remainingFinishIso:'2031-07-31T17:00'},   // dated before the Data Date: not placed
  {...base,assignmentId:'A4',activityId:'X4',remainingCost:70,remainingStartIso:'2031-09-01T08:00',remainingFinishIso:'2031-09-30T17:00',curveId:'7'}, // named curve not read: not placed
 ] as any});state.version++;
 const s=qar(state);
 assert.equal(s.forecastBasis,'programme_cost_loaded_remaining_value');assert.equal(s.currencyBasis,'single_commercial_currency');
 const f=s.points.filter(p=>p.kind==='forecast');
 assert.deepEqual(f.map(p=>[p.period,p.amount,p.flow,p.state]),[['2031-09',240,'work_value','calculated'],['2031-10',150,'work_value','calculated']]);
 assert.equal(s.forecastIncomeTotal,390);assert.equal(s.unplacedRemainingValue,120);
 assert.match(s.forecastReason!,/2 assignment\(s\) with a named curve or no future dates are not placed/);
 assert.ok(f.every(p=>p.sourceRefs.some(r=>r.startsWith('programme-assignment:'))));
});

test('F29 without a source forecast or cost-loaded programme the forecast falls back to the stated programme scenario or says exactly why not',t=>{
 const {state}=fixture(t);
 const position=commercialPositionForState(state),s=qar(state),scenario=position.programmeCashScenario!;
 const group=scenario.groups.find(g=>g.currency==='QAR');
 if(group&&group.rows.length){
  assert.equal(s.forecastBasis,'programme_remaining_contract_value');
  assert.equal(s.points.filter(p=>p.kind==='forecast').reduce((sum,p)=>sum+p.amount,0),group.rows.reduce((sum,r)=>sum+r.grossValuation,0));
 }else{
  assert.equal(s.forecastBasis,'not_established');assert.equal(s.points.filter(p=>p.kind==='forecast').length,0,'no forecast is invented');
  assert.match(s.forecastReason!,/No source cash-flow forecast is supplied; the programme has no cost-loaded assignments with remaining cost/);
  for(const input of scenario.missingInputs)assert.ok(s.forecastReason!.includes(input),'the reason names '+input);
 }
});

const plain=(value:unknown)=>String(value??'');
const ctx={
 fmt:(n:unknown)=>typeof n==='number'?new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n):plain(n),
 escapeHtml:plain,planningShortDate:(v:unknown)=>v?String(v).slice(0,10):'Not established',
 planningKpis:(rows:any[])=>'<div class="kpis">'+rows.map(row=>'<div><b>'+plain(row[0])+':</b> '+plain(row[1])+'</div>').join('')+'</div>',
 readerReference:plain,readerText:plain,renderCompletionPosition:()=>'',managementModuleLink:(key:string,label:string)=>'<a data-module="'+key+'">'+label+'</a>'
};
const browserSource=createSourceFile('browser.js',cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!,ScriptTarget.Latest,true);
const helpers=['actionDeadlineText','sourceWorkingFloat','sourceWorkingFloatField'].map(name=>browserSource.statements.filter(isFunctionDeclaration).find(n=>n.name?.text===name)!.getText(browserSource)).join('\n');

test('F20 the Management Brief cost line reads the shared dated cash series and the certified unpaid amount',t=>{
 const {state,csv}=fixture(t);
 csv('cost_evm_report','Metric,Value,Unit,Status,As Of\nCash Forecast,400,QAR,Forecast,2031-09-30');
 const facts=projectFactsForState(state);
 const row=facts.commercial.currencies.find(c=>c.currency==='QAR')!;
 assert.equal(row.cashSeries!.latestPeriod!.period,'2031-08');assert.equal(row.cashSeries!.paidToDate,250);
 const d:any={projectId:'F20',dataDateIso:'2031-08-31',executionActivityCount:1,criticalityBasis:'source_total_float',network:{state:'unavailable'},
  completion:{},counts:{critical:{value:null},negativeFloat:{value:null},nearCritical:{value:null}},wbsRows:[],milestoneRows:[],revision:{state:'unavailable'},actionRegister:{total:0,actions:[]}};
 const html=runInNewContext(helpers+'\n'+projectDiagnosisScript+'\nrenderProjectBrief(d,data)',{...ctx,d,data:{progress:{},projectFacts:facts}}) as string;
 assert.match(html,/QAR dated cash series:<\/b> latest period 2031-08 certified 200 QAR, paid 150 QAR; to the Data Date certified 300 QAR, paid 250 QAR over 3 monthly period\(s\)\. Forecast basis: Source cash-flow forecast\. Next forecast period 2031-09: 400 QAR expenditure\./);
 assert.match(html,/certified unpaid /);
});
