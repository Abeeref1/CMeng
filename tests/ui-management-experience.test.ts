import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { createSourceFile, ScriptTarget, isFunctionDeclaration, isCallExpression, isIdentifier, forEachChild, Node } from 'typescript';
import { cmengUatHtml } from '../packages/runtime-api/src/ui';

const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
function functions(names:string[]) {
  const selected=source.statements.filter(isFunctionDeclaration).filter(n=>n.name&&names.includes(n.name.text));
  assert.equal(selected.length,names.length);
  return selected.map(n=>n.getText(source)).join('\n');
}
const common={fmt:String,fmtExecutive:String,escapeHtml:(s:unknown)=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!)),humanizeKey:String,planningShortDate:(s:unknown)=>s==null?'Not available':String(s),planningRevisionLabel:String};
const briefFunctions=functions(['experienceBrief','experienceValue','findProjectionRoot']);

test('management summaries use the declared module population, not arbitrary high-scoring fields',()=>{
  const facts=runInNewContext(briefFunctions+';experienceBrief("near-critical",data).facts',{
    ...common,data:{nearCriticalCount:17,zeroFloatCount:4,negativeFloatCount:9,floatRiskWatchlistCount:21,criticalFakeDelayForecastCount:999999}
  });
  assert.deepEqual(Array.from(facts,(f:any)=>f.value),[17,4,9,21]);
  assert.ok(facts.every((f:any)=>f.basis.length>0));
  const value=runInNewContext(functions(['experienceValue'])+';experienceValue',{...common,fmt:(v:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(v)});
  assert.equal(value(12701,''),'12,701');
  assert.equal(value(10.466109,'%'),'10.47 %');
  assert.equal(value(93.75,'%'),'93.75 %');
});

test('cash and physical progress summaries keep known zero distinct from missing values',()=>{
  const cash=runInNewContext(briefFunctions+';experienceBrief("cash-flow",data)',{
    ...common,data:{position:{foundation:{paymentRegister:{recordCount:3}},performance:{cashFlow:{currencies:[{currency:'EUR',paidIncome:{value:0},actualExpenditure:{value:null},netCashPosition:{value:null},sourceReadiness:{netCashReady:false}}]}}}}
  });
  assert.equal(cash.facts[0].display,'0 EUR');
  assert.equal(cash.facts[1].display,'Not available');
  assert.equal(cash.facts[2].display,'Not available');
  const progress=runInNewContext(briefFunctions+';experienceBrief("progress-report",data)',{...common,data:{progressBases:{baselinePlanned:{valuePercent:32},currentSchedule:{valuePercent:30},scheduleSnapshot:{valuePercent:0},physical:{valuePercent:null}}}});
  assert.equal(progress.facts[2].display,'0 %');
  assert.equal(progress.facts[3].display,'Not available');
  assert.match(progress.review,/Measured physical progress is unavailable/);
});

test('cost summaries preserve partial authority and never aggregate multiple currencies',()=>{
  const position={performance:{costControl:{positions:[{currency:'AED',bac:{value:100,state:'partial'},ac:{value:40},sourceEac:{value:120},calculatedVac:{value:-20}}]}}};
  const single=runInNewContext(briefFunctions+';experienceBrief("cost-forecast",data)',{...common,data:{position}});
  assert.match(single.facts[0].basis,/partial/);
  assert.equal(single.facts[2].display,'120 AED');
  assert.equal(single.facts[3].display,'-20 AED');
  const multi=runInNewContext(briefFunctions+';experienceBrief("cost-forecast",data)',{...common,data:{position:{performance:{costControl:{positions:[...position.performance.costControl.positions,{currency:'USD',bac:{value:900}}]}}}}});
  assert.equal(multi.facts.length,0,'separate currency positions are available in the full analysis, not summed');
});

const certificateFunctions=functions(['experienceCertificateGroups','experienceCertificateChart','experienceCertificatePanels','experienceDisclosure']);
function certificate(id:string,date:string|null,value:number|null,currency:string,taxBasis:string) {
  return {paymentId:id,periodEnd:date,certifiedAmountBasis:'unknown',amounts:{netCertifiedAmount:{value,currency,taxBasis}}};
}
test('certificate charts retain producer scope, separate currencies and tax bases, and never invent cash or cumulative values',()=>{
  const a=certificate('A','2031-02-01',10,'EUR','exclusive'),b=certificate('B','2031-03-01',90,'EUR','exclusive');
  const c=certificate('C','2031-02-01',20,'USD','exclusive'),d=certificate('D','2031-02-01',30,'EUR','inclusive');
  const missing=certificate('E','2031-02-01',null,'EUR','exclusive'),undated=certificate('U',null,40,'EUR','exclusive');
  const position={sourceLedger:{payments:[a,b,c,d,missing,undated]},foundation:{paymentRegister:{rows:[a,c,d,missing],futureRows:[b],undatedRows:[undated]}}};
  const ctx={...common,position,renderVisualPanel:(title:string,desc:string,body:string)=>title+desc+body};
  const groups=runInNewContext(certificateFunctions+';experienceCertificateGroups(position)',ctx);
  assert.equal(groups.length,3);
  const eur=groups.find((g:any)=>g.currency==='EUR'&&g.taxBasis==='exclusive');
  assert.deepEqual(Array.from(eur.as_of,(r:any)=>r.id),['A','E']);
  assert.deepEqual(Array.from(eur.future,(r:any)=>r.id),['B']);
  const current=runInNewContext(certificateFunctions+';experienceCertificateChart(rows,"EUR")',{...common,rows:eur.as_of});
  assert.match(current,/1 of 2 records plotted/);
  assert.match(current,/no cumulative sum/);
  assert.doesNotMatch(current,/>B<|>90<|NaN|undefined/);
  const whole=runInNewContext(certificateFunctions+';experienceCertificatePanels(position)',ctx);
  assert.match(whole,/Future certificate periods/);
  assert.match(whole,/1 undated records/);
  assert.equal(position.foundation.paymentRegister.rows.length,4,'presentation never mutates the source population');
});

test('a certificate with ambiguous currency metadata stays in its own unknown-currency group',()=>{
  const a=certificate('A','2031-02-01',10,'EUR','exclusive'),b=certificate('A','2031-02-01',10,'USD','exclusive');
  const groups=runInNewContext(certificateFunctions+';experienceCertificateGroups(position)',{...common,position:{sourceLedger:{payments:[a,b]},foundation:{paymentRegister:{rows:[a]}}}});
  assert.equal(groups[0].currency,null);
  assert.equal(groups[0].as_of[0].value,10);
});

test('fully evidenced actual cash renders its currency-specific chart; incomplete funding evidence cannot enable that chart',()=>{
  const names=new Set<string>();
  const node=source.statements.filter(isFunctionDeclaration).find(n=>n.name?.text==='renderCommercialVisual')!;
  function visit(n:Node){if(isCallExpression(n)&&isIdentifier(n.expression))names.add(n.expression.text);forEachChild(n,visit);}
  visit(node);
  const stubs=Object.fromEntries([...names].filter(n=>!['Number','String','Array','Object'].includes(n)).map(n=>[n,()=> '']));
  const charts:any[]=[];
  const row={currency:'GBP',taxBasis:'exclusive',sourceReadiness:{netCashReady:true,fundingCurveReady:true,certification:{},receipts:{},expenditure:{},forwardPlan:{}},netCashPosition:{value:6},paidIncome:{value:10},actualExpenditure:{value:4},cumulativePositionSeries:[{asOf:'2031-01-01',cumulativePaidIncome:5,cumulativeActualExpenditure:2,actualNetCash:3},{asOf:'2031-02-01',cumulativePaidIncome:10,cumulativeActualExpenditure:4,actualNetCash:6}]};
  const context={...stubs,...common,projectionFor:(d:any)=>d,metricValue:(m:any)=>m?.value??null,experienceValue:(v:any)=>String(v),renderLineChart:(points:any,series:any,_:any,options:any)=>{charts.push({points,series,options});return '<svg></svg>';},data:{position:{currencies:[],performance:{cashFlow:{currencies:[row]}}}}};
  const code=functions(['renderCommercialVisual']);
  runInNewContext(code+';renderCommercialVisual("cash-flow",data)',context);
  assert.equal(charts.length,1);
  assert.equal(charts[0].options.unit,'GBP');
  assert.deepEqual(Array.from(charts[0].points,(p:any)=>p.net),[3,6]);
  row.sourceReadiness.fundingCurveReady=false;charts.length=0;
  runInNewContext(code+';renderCommercialVisual("cash-flow",data)',context);
  assert.equal(charts.length,0);
});

test('all six lenses retain access to the full module and leadership does not invent repeated actions',()=>{
  const roles=['overall','planning','controls','project-director','program-director','executive'];
  const roleViews=Object.fromEntries(roles.map(r=>[r,{label:r}]));
  for(const role of roles){
    const html=runInNewContext(functions(['experienceRoleContent','experienceDisclosure','experienceRoleReview'])+';experienceRoleContent("test",{},"<table>evidence-row</table>","<aside>comparison</aside>",true)',{
      ...common,selectedRoleView:role,roleViews,experienceBrief:()=>({facts:[{label:'Known value',value:17,display:'17',basis:'Source'}],note:'Current position',review:'Review one specific issue.'}),experiencePreview:()=>'<svg>chart</svg>'
    });
    assert.equal((html.match(/evidence-row/g)||[]).length,1,role);
    assert.match(html,/comparison/,role);
    if(['project-director','program-director','executive'].includes(role))assert.match(html,/Complete module analysis/,role);
    assert.doesNotMatch(html,/Control action:|Consequence:|Focus 1/,role);
  }
});

test('calculation failures remain visible while zero-count diagnostic cards stay out of the working overview',()=>{
  const render=functions(['experienceReviewSummary']);
  const fail=runInNewContext(render+';experienceReviewSummary(a)',{...common,a:{counts:{system_defect:1,missing_information:0,verification_pending:5}}});
  assert.match(fail,/Calculation errors/);assert.match(fail,/experience-notes error/);
  assert.doesNotMatch(fail,/Inputs needed|System defect0|CMeng verification/);
  const pending=runInNewContext(render+';experienceReviewSummary(a)',{...common,a:{counts:{system_defect:0},systemCheckState:'unverified'}});
  assert.match(pending,/View source notes and calculation coverage/);
  assert.doesNotMatch(pending,/passed|green|ready/i);
  const management=runInNewContext(render+';experienceReviewSummary(a,true)',{...common,a:{counts:{source_conflict:25},affectedModuleCounts:{source_conflict:5}}});
  assert.match(management,/Affected views/);assert.match(management,/<b>5<\/b>/);assert.doesNotMatch(management,/>25</);
  assert.doesNotMatch(script,/function flattenRoleScalars|function roleSignalScore|function collectRoleActions/);
  assert.doesNotMatch(script,/querySelectorAll\("details"\)\.forEach\(node=>node.open=true\)/);
});
