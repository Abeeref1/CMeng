import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext, createContext, runInContext } from 'node:vm';
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

const certificateFunctions=functions(['certificateMoney','experienceCertificateGroups','experienceCertificateChart','experienceCertificatePanels','experienceDisclosure']);
function certificate(id:string,date:string|null,value:number|null,currency:string,taxBasis:string) {
  return {paymentId:id,periodEnd:date,certifiedAmountBasis:'unknown',amounts:{netCertifiedAmount:{value,currency,taxBasis}}};
}
test('certificate charts retain producer scope, separate currencies and tax bases, and never invent cash or confirmed cumulative balances',()=>{
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
  assert.match(current,/Running total of listed amounts; confirm they are not cumulative/);
  assert.match(current,/<line.*stroke="#dce4ed"/);
  assert.equal((current.match(/data-axis-count="1"/g)||[]).length,2,'period and cumulative amounts each have their own single-axis chart');
  assert.match(current,/Certificate period amounts · EUR million/);
  assert.doesNotMatch(current,/>B<|>90<|NaN|undefined/);
  const whole=runInNewContext(certificateFunctions+';experienceCertificatePanels(position)',ctx);
  assert.match(whole,/Future certificate plan/);
  assert.match(whole,/1 undated records/);
  assert.equal(position.foundation.paymentRegister.rows.length,4,'presentation never mutates the source population');
});

test('a certificate with ambiguous currency metadata stays in its own unknown-currency group',()=>{
  const a=certificate('A','2031-02-01',10,'EUR','exclusive'),b=certificate('A','2031-02-01',10,'USD','exclusive');
  const groups=runInNewContext(certificateFunctions+';experienceCertificateGroups(position)',{...common,position:{sourceLedger:{payments:[a,b]},foundation:{paymentRegister:{rows:[a]}}}});
  assert.equal(groups[0].currency,null);
  assert.equal(groups[0].as_of[0].value,10);
});

test('cash chart labels use the same rounding as tooltips and credit amounts stay inside the plot',()=>{
  const rows=[{id:'C1',date:'2032-01-01',value:76925000},{id:'C2',date:'2032-02-01',value:-92500000},{id:'C3',date:'2032-03-01',value:122335000}];
  const html=runInNewContext(certificateFunctions+';experienceCertificateChart(rows,"EUR",false,"2032-02-15")',{...common,rows});
  assert.match(html,/76\.93M EUR/);assert.match(html,/certificate-value">76\.93</);assert.match(html,/certificate-value">122\.34</);
  assert.match(html,/certificate-value">-92\.50</);assert.match(html,/Data Date · 2032-02-15/);
  for(const rect of html.matchAll(/<rect[^>]* y="([^"]+)"[^>]* height="([^"]+)"/g)){
    assert.ok(Number(rect[1])>=38);assert.ok(Number(rect[1])+Number(rect[2])<=266,'negative certificates fit the scaled chart');
  }
});

test('calendar source context changes with the evidence rather than applying one project warning everywhere',()=>{
  const render=functions(['experienceSourceContext']);
  const ctx={...common,data:{sourceInterpretation:{calendarReview:{state:'no_pattern_detected',population:{denominator:4},elapsedDayMatchCount:0,assignedCalendarMismatchCount:0}}},managementModuleLink:()=>''};
  const healthy=runInNewContext(render+';experienceSourceContext("independent-forecast",data)',ctx);
  assert.match(healthy,/No elapsed-day duration pattern was detected/);assert.doesNotMatch(healthy,/This date is excluded/);
  ctx.data.sourceInterpretation.calendarReview.state='calendar_basis_difference';
  const review=runInNewContext(render+';experienceSourceContext("independent-forecast",data)',ctx);
  assert.match(review,/This date is excluded from delay and entitlement/);
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
      ...common,selectedRoleView:role,roleViews,experienceBrief:()=>({facts:[{label:'Known value',value:17,display:'17',basis:'Source'}],note:'Current position',review:'Review one specific issue.'}),experienceSourceContext:()=>'',experiencePreview:()=>'<svg>chart</svg>'
    });
    assert.equal((html.match(/evidence-row/g)||[]).length,1,role);
    assert.match(html,/comparison/,role);
    if(['project-director','program-director','executive'].includes(role))assert.match(html,/All charts and records/,role);
    assert.doesNotMatch(html,/Control action:|Consequence:|Focus 1/,role);
  }
});

test('calculation failures remain visible while zero-count diagnostic cards stay out of the working overview',()=>{
  const render=functions(['humanizeKey','experienceReviewSummary']);
  const fail=runInNewContext(render+';experienceReviewSummary(a)',{...common,a:{counts:{system_defect:1,missing_information:0,verification_pending:5}}});
  assert.match(fail,/System failure/);assert.match(fail,/experience-notes error/);
  assert.doesNotMatch(fail,/Inputs needed|System defect0|CMeng verification/);
  const pending=runInNewContext(render+';experienceReviewSummary(a)',{...common,a:{counts:{system_defect:0},systemCheckState:'unverified'}});
  assert.match(pending,/Supporting details/);
  assert.doesNotMatch(pending,/passed|green|ready/i);
  const management=runInNewContext(render+';experienceReviewSummary(a,true)',{...common,a:{counts:{source_conflict:25},affectedModuleCounts:{source_conflict:5}}});
  assert.match(management,/Affected pages/);assert.match(management,/<b>5<\/b>/);assert.doesNotMatch(management,/>25</);
  assert.doesNotMatch(script,/function flattenRoleScalars|function roleSignalScore|function collectRoleActions/);
  assert.doesNotMatch(script,/querySelectorAll\("details"\)\.forEach\(node=>node.open=true\)/);
});

function moduleLoader(api:(route:string)=>Promise<unknown>) {
  const elements=new Map<string,any>();
  const el=(id:string)=>{if(!elements.has(id))elements.set(id,{innerHTML:'',classList:{remove(){}},textContent:'',onclick:null});return elements.get(id);};
  const rendered:any[]=[];
  const context=createContext({...common,document:{body:{classList:{remove(){}}},querySelectorAll:()=>[]},el,api,overview:{},names:{cash:'Cash',progress:'Progress'},descriptions:{},project:()=> 'unrelated-project',moduleRequestSeq:0,currentModuleResult:{key:'old',data:{value:999}},managementSurfaceKeysForApi:new Set(),commercialModuleKeysForApi:new Set(),setBusy:()=>{},renderModuleResult:(r:any)=>{rendered.push(r);context.currentModuleResult=r;el('moduleContent').innerHTML='Rendered '+r.key;}});
  runInContext(functions(['loadModule']),context);
  return {context,elements,rendered,load:(key:string)=>{context.requestedKey=key;return runInContext('loadModule(requestedKey)',context) as Promise<void>;}};
}

test('a failed view request clears the old position, offers retry and does not invent a calculation failure',async()=>{
  let reject:(e:unknown)=>void=()=>{},calls=0;
  const first=new Promise((_,r)=>{reject=r;});
  const h=moduleLoader(async()=>{calls++;return calls===1?first:{key:'cash',status:'partial',data:{paid:0}};});
  const pending=h.load('cash');
  assert.equal(h.context.currentModuleResult,null,'old values cannot be exported or rendered by a lens while the new view loads');
  reject(Object.assign(new Error('Service unavailable'),{status:503}));await pending;
  assert.equal(h.rendered.length,0,'a transport failure is not a classified module result');
  assert.match(h.elements.get('moduleContent').innerHTML,/Unable to load Cash/);
  assert.doesNotMatch(h.elements.get('moduleContent').innerHTML,/Unverified|calculation is unavailable|missing information/i);
  assert.equal(h.elements.get('moduleBadge').textContent,'Not loaded');
  await h.elements.get('retryModule').onclick();
  assert.equal(h.rendered[0].key,'cash');assert.equal(h.rendered[0].data.paid,0);
});

test('a classified blocked module response retains its real assessment',async()=>{
  const blocked={key:'cash',status:'blocked',reason:'Invalid supplied dates',issueAssessment:{primaryKind:'data_quality'}};
  const h=moduleLoader(async()=>{throw Object.assign(new Error('Unavailable'),{data:blocked});});
  await h.load('cash');assert.equal(h.rendered[0],blocked);
});

test('an obsolete view request cannot replace the current page with an error',async()=>{
  let reject:(e:unknown)=>void=()=>{};
  const h=moduleLoader(async route=>route.endsWith('/cash')?new Promise((_,r)=>{reject=r;}):{key:'progress',status:'ready'});
  const first=h.load('cash');await h.load('progress');reject(new Error('Late old request'));await first;
  assert.deepEqual(h.rendered.map(r=>r.key),['progress']);
  assert.equal(h.elements.get('moduleContent').innerHTML,'Rendered progress');
  assert.equal(h.context.currentModuleResult.key,'progress');
});

test('shared verdict, source scope and Source Quality distinguish source issues from system failures',()=>{
 const code=functions(['renderPositionVerdict','renderRegisterScope']);
 const html=runInNewContext(code+';renderPositionVerdict(data)+renderRegisterScope(data)',{...common,data:{positionVerdict:{rag:'red',label:'Action required',text:'Submitted completion is 7 days late.',nextAction:'Review recovery',owner:'Project controls reviewer',basis:'Contract comparison'},reportingContract:{dataDateIso:'2031-04-15',populations:{register:{populationId:'x',entity:'claim',name:'Claims',sourceCount:3,denominator:1,dateBasis:'notice date',exclusions:[{id:'F',reason:'after_data_date'},{id:'U',reason:'record_date_missing'}]}}}}});
 assert.match(html,/Position verdict/);assert.match(html,/Future excluded/);assert.match(html,/Date missing \/ invalid/);assert.match(html,/1 \/ 3/);
 assert.match(script,/Information items/);assert.match(script,/system failures/);assert.doesNotMatch(script,/4\/6\/8 multipliers/);
});

test('delay and float matrix visibly reconciles excluded LOE and WBS records',()=>{
 const render=functions(['planningActivityPressure']);const html=runInNewContext(render+';planningActivityPressure(rows)',{...common,rows:[{activityType:'task',criticality:'critical',finishVarianceDays:4},{activityType:'level_of_effort',criticality:'critical',finishVarianceDays:4},{activityType:'wbs_summary',finishVarianceDays:null}]});
 assert.match(html,/LOE \/ WBS summaries/);assert.match(html,/2 source records excluded/);assert.match(html,/All 1 execution activities/);
});
test('source quality and date scope preserve record evidence behind concise disclosures',()=>{
 const render=functions(['renderSourceQuality','renderRegisterScope','experienceDisclosure','readerIssue']);
 const ctx={...common,names:{one:'One'},managementModuleLink:(k:string,label:string)=>label,managementPanel:(t:string,s:string,b:string)=>t+s+b,basisTable:()=>'',formatDocumentTime:String,
 data:{sourceIssues:[{kind:'missing_information',summary:'Receipt dates missing',detail:'Two records',action:'Supply dates',owner:'Evidence owner',sourceRefs:['A:1','A:2'],moduleKeys:['one']}],systemFailures:[],reviewActions:[],pendingChecks:[],coverage:[],documents:[],pageValueChecks:[],scope:'Checked scope'}};
 const html=runInNewContext(render+';renderSourceQuality(data)',ctx);
 assert.match(html,/Identical requests are counted once/);assert.match(html,/<details class="source-request">/);assert.match(html,/<li>A:1<\/li><li>A:2/);
 const populations=Object.fromEntries(Array.from({length:8},(_,n)=>[n,{populationId:'P'+n,name:'Register '+n,entity:'record',denominator:2,sourceCount:3,exclusions:[{reason:'after_data_date'}],dateBasis:'Actual date'}]));
 const scope=runInNewContext(render+';renderRegisterScope(data)',{...ctx,data:{reportingContract:{populations,dataDateIso:'2031-06-30'}}});
 assert.match(scope,/<summary>8 record groups include later or missing dates/);assert.equal((scope.match(/<tr><td>Register /g)||[]).length,8);
});

test('navigation does not multiply information warnings across page links; calculation failures remain explicit',()=>{
 const render=functions(['renderNav']);
 const nav={innerHTML:'',querySelectorAll:()=>[]};
 const ctx={...common,el:()=>nav,appView:'project',selected:'one',names:{one:'One',two:'Two'},groups:{Planning:['one','two']},overview:{moduleStates:[{key:'one',issueAssessment:{counts:{missing_information:3}}},{key:'two',issueAssessment:{counts:{system_defect:1,source_conflict:4}}}],managementStates:[{key:'master-dashboard',issueAssessment:{counts:{missing_information:7,system_defect:1}}}]}};
 runInNewContext(render+';renderNav()',ctx);
 assert.match(nav.innerHTML,/Information items<b>7/);
 assert.doesNotMatch(nav.innerHTML,/nav-count attention|>Source [0-9]/);
 assert.match(nav.innerHTML,/aria-label="1 system failures">Error 1/);
 assert.equal((nav.innerHTML.match(/data-key=/g)||[]).length,2);
});

test('plain information actions preserve original findings and all document references',()=>{
 const render=functions(['readerIssue','renderSourceQuality','experienceDisclosure']);
 const issue={code:'MISSING_SOURCE_VALUE',kind:'missing_information',summary:'cashFlow · information missing',detail:'BANK-SOURCE-required.pdf: row 7; amount 123.45',action:'Original diagnostic action',owner:'Project evidence owner',evidencePaths:['focus.cashFlow.receipts'],sourceRefs:['BANK-SOURCE-required.pdf:row:7'],moduleKeys:['cash-flow']};
 const original=JSON.stringify(issue);
 const ctx={...common,names:{'cash-flow':'Cash Flow'},managementModuleLink:(_k:string,label:string)=>label,managementPanel:(_t:string,_s:string,b:string)=>b,basisTable:()=>'',formatDocumentTime:String,data:{sourceIssues:[issue],systemFailures:[],reviewActions:[],pendingChecks:[],coverage:[],documents:[],pageValueChecks:[]}};
 const html=runInNewContext(render+';renderSourceQuality(data)',ctx);
 assert.match(html,/Provide the certificate, receipt or payment amount and its actual event date/);
 assert.match(html,/Document owner \(assign a person\)/);
 assert.match(html,/Original finding and document references/);
 assert.match(html,/BANK-SOURCE-required.pdf: row 7; amount 123.45/);
 assert.match(html,/BANK-SOURCE-required.pdf:row:7/);
 assert.equal(JSON.stringify(issue),original);
});

test('routine review counts are expandable while failed checks remain an alert',()=>{
 const render=functions(['experienceReviewSummary']);
 const invoke=(counts:object)=>runInNewContext(render+';experienceReviewSummary({counts})',{...common,counts});
 const routine=invoke({missing_information:9});
 assert.match(routine,/<details class="page-review-summary">/);assert.match(routine,/<b>9<\/b>/);
 const failed=invoke({system_defect:1,missing_information:9});
 assert.match(failed,/role="alert"/);assert.doesNotMatch(failed,/<details/);
});

test('information request titles use business terms instead of projection field names',()=>{
 const read=runInNewContext(functions(['readerIssue'])+';readerIssue');
 for(const [summary,expected] of [['currencies · advanceBalance · information missing','Advance payment balance'],['sourceReadiness · expenditure · information missing','Cash expenditure records'],['progressBases · physical · information missing','Measured physical progress'],['commercialTerms · ldRate · information missing','Delay damages rate']]){
  const result=read({kind:'missing_information',code:'MISSING_SOURCE_VALUE',summary,action:'Confirm the record',evidencePaths:[],owner:'Project evidence owner'});
  assert.ok(result.title.startsWith(expected));assert.doesNotMatch(result.title,/currencies|sourceReadiness|progressBases|commercialTerms|advanceBalance|ldRate/);
 }
});

test('generic guidance and complete date counts remain available without preceding the page results',()=>{
 const code=functions(['renderPositionVerdict','renderRegisterScope']);
 const data={positionVerdict:{specific:false,rag:'amber',label:'Review needed',text:'General guidance',nextAction:'Review documents',owner:'Reviewer',basis:'Status explanation'},reportingContract:{dataDateIso:'2031-04-15',populations:{one:{populationId:'A',entity:'record',name:'Certificates',denominator:2,sourceCount:2,dateBasis:'Certificate date',exclusions:[]}}}};
 const context={...common,data};
 assert.equal(runInNewContext(code+';renderPositionVerdict(data)+renderRegisterScope(data)',context),'');
 const detail=runInNewContext(code+';renderPositionVerdict(data,true)+renderRegisterScope(data,true)',context);
 assert.match(detail,/General guidance/);assert.match(detail,/Status explanation/);assert.match(detail,/Certificates/);assert.match(detail,/2 \/ 2/);
});

test('resource unit labels translate known register codes and preserve other project units exactly',()=>{
 const label=runInNewContext(functions(['resourceUnitLabel'])+';resourceUnitLabel');
 assert.equal(label('labor_hour'),'Labor hours');assert.equal(label('labour_hour'),'Labor hours');assert.equal(label('equipment_hour'),'Equipment hours');
 for(const unit of ['kWh','m3','m²','W/m²','custom_unit'])assert.equal(label(unit),unit);
});

test('programme summaries separate internal check-state messages from the business explanation',()=>{
 const read=runInNewContext(functions(['readerModuleSummary'])+';readerModuleSummary');
 assert.equal(read('Payment dates are missing. Shared readiness gate: evidence partial; comparison pending.'),'Payment dates are missing.');
 assert.equal(read('Shared readiness gate: submitted/independent reconciliation submitted missing.'),'Open this page for its figures and follow-up actions.');
 assert.equal(read('3 events have no governed activity link; 26 days remain under review.'),'3 events have no confirmed activity link; 26 days remain under review.');
 assert.match(script,/Calculation notes<\/summary>'\+escapeHtml\(p.reason\)/,'the original reason remains available');
});
