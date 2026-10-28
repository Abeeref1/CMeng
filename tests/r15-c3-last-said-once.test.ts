// R15 c3-last: the last real guard hits of rules W5 (a sentence of 8+ words said 3 or more
// times on one page) and A3 (the same action sentence on 5 or more pages), fixed at their
// shared builders. Browser functions are the real ones from the assembled script
// (browser-context pulls their real helpers); server texts come from the real builders.
// Nothing here edits the guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {runInNewContext} from './browser-context';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';
import {deliveryPopulationReason} from '../packages/runtime-api/src/delivery-records';
import {deliveryKinds,deliveryLabels} from '../packages/delivery-core/src/types';
import {buildForecastReconciliationGate} from '../packages/runtime-api/src/forecast-control';

const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const escapeHtml=(s:unknown)=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const text=(html:string)=>html.replace(/<[^>]+>/g,'\n').replace(/&amp;/g,'&').replace(/&gt;/g,'>').replace(/&lt;/g,'<');
// The guard's sentence count (W5).
function repeatedSentences(page:string){
 const counts=new Map<string,number>();
 for(const line of page.split('\n')){if(line.includes('\t'))continue;for(const s of line.trim().split(/(?<=[.!?])\s+/))if(s.split(/\s+/).length>=8)counts.set(s.trim(),(counts.get(s.trim())??0)+1);}
 return [...counts].filter(([,n])=>n>=3).map(([s])=>s);
}
const count=(haystack:string,needle:string)=>haystack.split(needle).length-1;
// Every function a browser renderer calls, so a test can keep the ones it checks real
// and give the rest of the page an empty answer.
function calledNames(name:string){
 const source=ts.createSourceFile('browser.js',script,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const node=source.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text===name)!;
 const names=new Set<string>();
 const visit=(n:ts.Node)=>{if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression))names.add(n.expression.text);ts.forEachChild(n,visit);};
 visit(node);return names;
}
const stubsExcept=(name:string,keep:string[])=>Object.fromEntries([...calledNames(name)].filter(n=>!keep.includes(n)&&!['Number','String','Array','Object','Boolean','Set','Map'].includes(n)).map(n=>[n,()=>'']));

test('W5: a commercial card says its shared basis once; an amount that differs only in its record count keeps that count',()=>{
 const m=(value:number,refs:number,taxBasis?:string)=>({value,state:'established',sourceRefs:Array.from({length:refs},(_,i)=>'r'+i),...(taxBasis?{taxBasis}:{})});
 const row={currency:'USD',originalContractValue:m(10_000,2),currentContractValue:m(12_000,2),pendingVariationAmount:m(500,2),grossCertifiedAmount:m(6_000,3),paidAmount:m(5_000,3),
  certifiedUnpaidAmount:m(400,3),retentionDeductedAmount:m(250,3),retentionHeldAmount:m(600,4),claimedAmount:m(650,2),activeBondAmount:m(1_500,2)};
 const keep=['commercialMetricHtml','sumBasisLabel','commercialSourceState','commercialFieldLabel','fmt','escapeHtml'];
 const render=(key:string,currency:any)=>text(runInNewContext('renderCommercialVisual(key,data)',{...stubsExcept('renderCommercialVisual',keep),escapeHtml,fmt:String,
  projectionFor:(d:any)=>d,key,data:{reportingContract:{dataDateIso:'2042-08-18'},position:{currencies:[currency]}}}) as string);
 const basisLines=(page:string)=>page.split('\n').filter(line=>/Basis/.test(line)).length;
 const page=render('commercial-overview',row);
 assert.deepEqual(repeatedSentences(page),[],'before: "Basis: 3 source records · currency USD · tax basis not established · as of ..." on 4 amounts');
 assert.equal(count(page,'currency USD · tax basis not established · as of 2042-08-18'),1,'the shared part is said once');
 assert.match(page,/Basis of the amounts above: 2 source records unless stated · currency USD · tax basis not established · as of 2042-08-18/);
 assert.equal(count(page,'Basis: 2 source records'),0);assert.equal(count(page,'Basis: 3 source records\n'),4);assert.equal(count(page,'Basis: 4 source records\n'),1);
 assert.ok(basisLines(page)<=6,'the card is not taller than before (5 amounts with their own label and one shared line)');
 for(const amount of ['10000 USD','6000 USD','1500 USD'])assert.match(page,new RegExp(amount),'every amount is still shown');
 // Cash Flow: amounts on one basis say nothing more; each label stays next to its value.
 const cash=render('cash-flow',{...row,grossCertifiedAmountColumn:'net',grossCertifiedAmountLabel:'Certified (net; gross not stated)'});
 assert.match(cash,/\nCertified \(net; gross not stated\)\n+6000 USD\n/,'R12: the certified label stays next to its value');
 assert.match(cash,/Basis of the amounts above: 3 source records unless stated · currency USD · tax basis not established · as of 2042-08-18/);
 assert.equal(count(cash,'Basis: 3 source records'),0);assert.equal(count(cash,'Basis: 4 source records\n'),1);assert.equal(basisLines(cash),2);
 // An amount on another basis keeps its whole basis, and the shared line says so.
 const mixed=render('commercial-overview',{...row,paidAmount:m(5_000,3,'exclusive')});
 assert.match(mixed,/Basis: 3 source records · currency USD · tax basis exclusive · as of 2042-08-18/);
 assert.match(mixed,/as of 2042-08-18 \(unless an amount states its own basis\)/);
 // The single-figure renderer keeps the whole F27 label when nothing is shared.
 const one=runInNewContext('commercialMetricHtml(metric,"USD","2042-08-18")',{escapeHtml,fmt:String,planningShortDate:String,metric:m(10,3)}) as string;
 assert.match(text(one),/Basis: 3 source records · currency USD · tax basis not established · as of 2042-08-18/);
});

test('A clause heading does not run into its own wording',()=>{
 const html=runInNewContext('clauseWordingHtml(row,escapeHtml(row.textPreview))',{escapeHtml,row:{identifier:'3',heading:'Retention',textPreview:'3 Retention Retention rate: 10%. Retention cap: 5% of the Accepted Contract Amount.'}}) as string;
 assert.equal(html,'<b>3 Retention</b><br>Retention rate: 10%. Retention cap: 5% of the Accepted Contract Amount.','before: "3 Retention Retention rate: 10%"');
 assert.equal(runInNewContext('clauseWordingHtml(row,escapeHtml(row.textPreview))',{escapeHtml,row:{identifier:'4',heading:null,textPreview:'4 The Contractor shall'}}),'4 The Contractor shall','no heading, no change');
 assert.equal(runInNewContext('clauseWordingHtml(row,escapeHtml(row.textPreview))',{escapeHtml,row:{identifier:'5',heading:'Delay Damages',textPreview:'Delay damages rate: USD 28,022 per day.'}}),'Delay damages rate: USD 28,022 per day.','wording without its heading is unchanged');
 assert.match(script,/<p>"\+clauseWordingHtml\(row,escapeHtml\(statedAmountText\(row\.textPreview\|\|""\)\)\)\+"<\/p>/,'the clause register uses it');
});

test('W5: EOT checks that cannot be worked out say so in short; the reason and the candidate note are said once per table',()=>{
 const note='Independent result is not mathematically established, so this candidate cannot be gap-tested yet.';
 const candidate=(value:number)=>({submittedValue:value,submittedUnit:'days',sourceRefs:['claim:Claims.csv · row '+value],comparable:false,gapValue:null,gapUnit:'days',note});
 const conflicted=(metric:string,label:string)=>({metric,label,submitted:{state:'conflicted',value:null,unit:'days'},independent:{state:'not_derivable',value:null,unit:'days'},gap:{value:null,unit:'days'},
  candidateComparisons:[candidate(10),candidate(20)],conflictRecommendation:{candidates:[],recommendedValue:null}});
 const missing=(metric:string,label:string)=>({metric,label,submitted:{state:'not_submitted',value:null,unit:'days'},independent:{state:'not_derivable',value:null,unit:'days'},gap:{value:null,unit:'days'}});
 const challenge=(items:any[])=>({items,submittedEvidenceState:'partial',independentState:'missing',notSubmittedCount:1,unavailableCheckCount:items.length,scenarioCount:0,challengedCount:items.length});
 const render=(items:any[])=>text(runInNewContext('renderUniversalChallenge(c)',{escapeHtml,humanizeKey:String,reconciliationSummary:()=>'',readerAuditAction:String,c:challenge(items)}) as string);
 const page=render([conflicted('claimed','Claimed EOT vs analytical time impact'),conflicted('attributable','Attributable analytical EOT candidate'),missing('awarded','Official awarded EOT')]);
 assert.deepEqual(repeatedSentences(page),[],'before: "CMeng check: Cannot be worked out from the current records" x3 and the gap-test note x4');
 assert.equal(count(page,'CMeng check: Not worked out'),3,'each row keeps a short state');
 assert.equal(count(page,'Not worked out: the current records are not enough for CMeng to check these 3 items.'),1);
 assert.equal(count(page,note),1,'the candidate note is said once under the table');
 assert.match(page,/For each position above that is not directly comparable: Independent result is not mathematically established/);
 assert.equal(count(page,'Not directly comparable'),4,'each position keeps its short state');
 for(const ref of ['row 10','row 20'])assert.equal(count(page,ref),2,'every position keeps its sources');
 // One item keeps the whole reason on its row.
 const single=render([missing('awarded','Official awarded EOT')]);
 assert.match(single,/CMeng check: Cannot be worked out from the current records/);
 assert.doesNotMatch(single,/Not worked out/);
});

test('W5 plain words: the required finish is said once per page, as one plain sentence',()=>{
 const forecast:any={independentForecastCompletionIso:'2030-12-31',sourceForecastCompletionIso:'2030-12-31',activityCoveragePercent:100,calculatedActivityCount:2,unresolvedActivityCount:0,diagnostics:[],
  activities:[{activityId:'A1',calendarMode:'source_calendar',status:'calculated',finishVarianceDays:0},{activityId:'A2',calendarMode:'source_calendar',status:'calculated',finishVarianceDays:30}]};
 const model:any={activities:[{activityId:'A1',sourceConstraints:[]},{activityId:'A2',sourceConstraints:[]}]};
 const gate=buildForecastReconciliationGate({forecast,model,requiredFinishIso:null});
 const plain='No confirmed contract or required finish date is established yet.';
 assert.equal(gate.checks.find(c=>c.key==='required_finish_authority')!.detail,plain);
 assert.ok(gate.reason.endsWith(' '+plain),gate.reason);
 assert.doesNotMatch(gate.reason,/Required finish authority:|governed contractual\/required finish/,'before: "Required finish authority: A governed contractual/required finish is not established."');
 // The Completion Forecast warning and the page's findings do not repeat what "What needs attention" says.
 const data={independentForecastCompletionIso:'2030-12-31',sourceForecastCompletionIso:'2030-12-31',dataDateIso:'2030-01-31',complete:true,forecastReconciliationGate:gate,managementReviewState:'review_required',managementReviewReason:gate.reason,probabilistic:{}};
 const warning=runInNewContext('renderForecastVisual(data)',{data,escapeHtml,fmt:String,humanizeKey:String,projectionFor:(d:any)=>d,planningKpis:()=>'',planningDateLadder:()=>'',renderVisualPanel:()=>'',renderVisualBars:()=>'',
  experienceBrief:()=>({review:gate.reason})}) as string;
 // P0-B: the calculated finish is shown first; its qualifications follow under one heading.
 assert.match(warning,/What qualifies this finish/);
 assert.equal(count(text(warning),plain),1,'said once, in the gate table');
 assert.ok(!text(warning).split('\n').some(line=>!line.includes('\t')&&line.includes(plain)&&!/^\s*No confirmed/.test(line)),'the warning does not repeat the reason');
 const issue={kind:'governance_review',code:'CALCULATION_BASIS_REVIEW',summary:'Calculated basis requires review',detail:gate.reason,moduleKeys:['independent-forecast'],sourceRefs:['schedule:R2']};
 const findings=(said:any)=>text(runInNewContext('renderIssueAssessment(a,false,said)',{escapeHtml,a:{issues:[issue],counts:{}},said,names:{'independent-forecast':'Completion Forecast'},ownsBlock:()=>true,currentModuleResult:null}) as string);
 assert.equal(count(findings([gate.reason]),plain),0,'already said under What needs attention');
 assert.match(findings([gate.reason]),/Calculated basis requires review · schedule:R2|Calculated basis requires review/);
 assert.equal(count(findings(null),plain),1,'without a page summary the finding keeps its detail');
});

test('W5: the dashboard source decisions say a shared sentence once; each keeps its own record count',()=>{
 const shared='Confirm only if these are all the applicable records, so percentages can be reported.';
 const actions=['Construction HSE','Permits & authorities','Asset & system handover','Testing & commissioning','RFI & design'].map((label,i)=>({recordKey:'review|delivery-population:'+i,issue:'Confirm the complete '+label+' register',consequence:(i+1)+' usable source records are available. '+shared}));
 const html=runInNewContext('renderDashboardDecisions(data)',{escapeHtml,data:{actions},managementPanel:(_t:string,_i:string,body:string)=>body,managementModuleLink:(_k:string,label:string)=>'<a>'+label+'</a>',currentModuleResult:null}) as string;
 const page=text(html);
 assert.deepEqual(repeatedSentences(page),[],'before: the shared sentence under each of the 5 decisions');
 assert.equal(count(page,shared),1);
 assert.match(page,/For the decisions above: Confirm only if these are all the applicable records/);
 for(let i=1;i<=5;i++)assert.match(page,new RegExp('\\n'+i+' usable source records are available\\.\\n'));
 assert.equal(count(page,'Review findings and existing evidence before deciding'),5,'each decision keeps its link');
});

test('W5/T10: record groups that read alike are named from their own records',()=>{
 const views=['By WBS','By WBS Level','By Zone','By Level','By Work Front','By CBS'].map((label,i)=>({label,dimension:'d'+i,rows:[{groupLabel:i<2?['Main Works','Level 1'][i]:'Unclassified',activityIds:['A1']}]}));
 const tables=views.map((_,i)=>({pointer:'/data/dimensionViews/'+i+'/rows/0/activityIds',total:114,shown:25,kind:'array'}));
 const labels=runInNewContext('pagedRecordGroupLabels(tables,result)',{tables,result:{data:{title:'Progress breakdown',dimensionViews:views}}}) as string[];
 assert.deepEqual([...labels],['By WBS · Main Works · activity IDs','By WBS Level · Level 1 · activity IDs','By Zone · Unclassified · activity IDs','By Level · Unclassified · activity IDs','By Work Front · Unclassified · activity IDs','By CBS · Unclassified · activity IDs']);
 assert.equal(new Set(labels).size,6,'before: "Dimension views · rows · activity IDs" six times');
 // Groups with their own names keep them.
 const own=runInNewContext('pagedRecordGroupLabels(tables,result)',{tables:[{pointer:'/data/rows'},{pointer:'/data/hierarchyRows'}],result:{data:{}}}) as string[];
 assert.deepEqual([...own],['Rows','Hierarchy rows']);
});

test('W5: float changes in original hours say why once; each bar keeps its hours',()=>{
 const p={changedActivities:[],changeSummary:{total:0,largestFloatMovements:[{activityId:'A1',floatShiftHours:-80,floatShiftWorkingDays:null},{activityId:'A2',floatShiftHours:-80,floatShiftWorkingDays:null},{activityId:'A3',floatShiftHours:-80,floatShiftWorkingDays:null},{activityId:'A4',floatShiftHours:104,floatShiftWorkingDays:null}]}};
 const html=runInNewContext('renderScheduleChangeVisual(p)',{...stubsExcept('renderScheduleChangeVisual',['planningSignedBars','fmt','escapeHtml']),escapeHtml,fmt:String,projectionFor:(d:any)=>d,p}) as string;
 const page=text(html);
 assert.deepEqual(repeatedSentences(page),[],'before: "+80 original hours lost (working days not established for every activity)" on every bar');
 assert.equal(count(page,'+80 original hours lost'),3);assert.equal(count(page,'-104 original hours lost'),1);
 assert.equal(count(page,'working days are not established for every activity'),1);
});

test('A3: each delivery page confirms its own register by name',()=>{
 const delivery=deliveryScript();
 assert.doesNotMatch(delivery,/Confirm the selected register is complete/,'before: the same button sentence on 15 delivery pages');
 const helper=delivery.match(/function deliveryConfirmRegisterText\(kind\)\{[^\n]*\}/)![0];
 const name=new Function('deliveryKindLabels',helper+';return deliveryConfirmRegisterText;')(deliveryLabels) as (kind:string)=>string;
 for(const kind of deliveryKinds)assert.equal(name(kind),deliveryPopulationReason(kind),'browser and server say the same sentence for '+kind);
 assert.equal(new Set(deliveryKinds.map(name)).size,deliveryKinds.length,'every register has its own sentence');
 assert.match(delivery,/el\('deliveryKind'\)\.onchange=\(\)=>\{el\('deliveryConfirmPopulation'\)\.textContent=deliveryConfirmRegisterText\(el\('deliveryKind'\)\.value\);\};/,'choosing another record type renames the button');
});


test('W5/S1: Cash Flow unknown figures have distinct grounded requirements and preserve the complete shared evidence list',()=>{
 const missingInputs=['Dated gross certification','Contract retention percentage','Contract payment period','Remaining advance recovery balance'];
 const reason='Needs '+missingInputs.join('; ');
 const group={currency:'USD',remainingGross:null,retention:null,advanceRecovery:null,netReceipts:null,missingInputs,notEstablishedReason:reason,rows:[],certificateCount:3};
 const seen:any[]=[];
 const html=String(runInNewContext('renderProgrammeCashScenario(scenario)',{
  scenario:{groups:[group]},
  escapeHtml:(s:unknown)=>String(s),
  planningKpis:(rows:any[])=>{
   seen.push(...rows);
   return rows.map(row=>'<div class="planning-kpi"><span>'+row[0]+'</span><strong>'+String(row[1]??'Not established')+'</strong><small>'+String(row[4]||'')+'</small></div>').join('');
  }
 }));
 assert.deepEqual(seen.map(row=>row[0]),['Remaining gross work','Future retention','Advance recovery','Indicative net receipts']);
 assert.deepEqual(seen.map(row=>row[1]),[null,null,null,null],'unknown must stay unknown, never zero');
 const notes=seen.map(row=>String(row[4]));
 assert.equal(new Set(notes).size,4,'one long shared missing-input reason cannot repeat on four different Cash Flow tiles');
 assert.match(notes[0]??'',/Needs Dated gross certification/);
 assert.match(notes[1]??'',/Needs Contract retention percentage/);
 assert.match(notes[2]??'',/Needs Remaining advance recovery balance/);
 assert.equal(notes[3],reason,'net receipts retain the complete list of missing source requirements');
 assert.match(html,/Missing inputs: Dated gross certification; Contract retention percentage; Contract payment period; Remaining advance recovery balance/);
 // No source amount is altered when the requirements are shown in shorter wording.
 const known:any[]=[];
 runInNewContext('renderProgrammeCashScenario(scenario)',{
  scenario:{groups:[{...group,remainingGross:120,retention:15,advanceRecovery:5,netReceipts:100,notEstablishedReason:'',missingInputs:[]}]},
  escapeHtml:(s:unknown)=>String(s),
  planningKpis:(rows:any[])=>{known.push(...rows);return '';}
 });
 assert.deepEqual(known.map(row=>row[1]),[120,15,5,100],'known values and their currencies are unchanged');
 assert.deepEqual(known.map(row=>row[2]),['USD','USD','USD','USD']);
});
