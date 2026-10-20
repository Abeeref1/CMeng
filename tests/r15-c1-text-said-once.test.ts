// R15 c1-text: guard rules W2, W4, W5, W7 and N6 on the shared text builders and
// page renderers that still produced hits. Browser functions are the real ones
// from the assembled script (browser-context pulls their real helpers); server
// texts come from the real builders. Nothing here edits the guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from './browser-context';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';
import {enforceModuleReadiness,readinessComparisonText,readinessEvidenceText} from '../packages/runtime-api/src/module-readiness';
import {statedAmountText} from '../packages/runtime-api/src/management-values';
import {deliveryPopulationReason} from '../packages/runtime-api/src/delivery-records';
import type {ModuleRuntimeResult} from '../packages/runtime-api/src/project-state-types';

const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const escapeHtml=(s:unknown)=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const text=(html:string)=>html.replace(/<[^>]+>/g,'\n').replace(/&amp;/g,'&').replace(/&gt;/g,'>').replace(/&lt;/g,'<');
// The guard's sentence count (W5): a sentence of 8+ words said 3 or more times on one page.
function repeatedSentences(page:string){
 const counts=new Map<string,number>();
 for(const line of page.split('\n'))for(const s of line.trim().split(/(?<=[.!?])\s+/))if(s.split(/\s+/).length>=8)counts.set(s,(counts.get(s)??0)+1);
 return [...counts].filter(([,n])=>n>=3).map(([s])=>s);
}
const count=(haystack:string,needle:string)=>haystack.split(needle).length-1;
// The guard's S1 reason words: every unknown tile must still say why.
const UNK=/(?:Not established|Not in source|Not available|Not assessable|Not calculated|Not provided|Not recorded|Not confirmed|Unknown)/;
const REASON=/\b(because|until|needs?|require[sd]?|upload|confirm|missing|not supplied|no supplied|supply|provide|awaiting|pending|enter|add |select|choose|review|no .{0,30}(register|file|record|value|date|column)|without|cannot|not (yet )?(read|linked|mapped|supplied|dated))/i;
const tiles=(html:string)=>[...html.matchAll(/<div class="planning-kpi(?: [^"]*)?">([\s\S]*?)<\/div>/g)].map(m=>text(m[1]!).split('\n').map(x=>x.trim()).filter(Boolean).join(' | '));

test('W5: unknown tiles of one group keep their reason; the basis they share is said once',()=>{
 const why='Needs an insurance policy register';
 const html=runInNewContext('planningKpis(items)',{escapeHtml,items:[
  ['Active bonds',2,'security register records'],['Expired bonds',0,'security register records'],
  ['Active policies','Not established','insurance register records','',why],['Expired policies','Not established','insurance register records','',why],['Expiring policies','Not established','insurance register records','',why]
 ]}) as string;
 const page=text(html);
 assert.deepEqual(repeatedSentences(page),[],'before: "Needs an insurance policy register · insurance register records" on every tile');
 assert.equal(count(page,'insurance register records'),1,'the shared basis is said once');
 assert.match(page,/Active policies, Expired policies and Expiring policies: insurance register records/);
 const unknown=tiles(html).filter(tile=>UNK.test(tile));
 assert.equal(unknown.length,3,'each tile keeps Not established');
 for(const tile of unknown){assert.match(tile,/\| Not established \| Needs an insurance policy register$/);assert.match(tile,REASON,'S1: '+tile);}
 // A single unknown tile, or tiles with different bases, keep "reason · basis" as before.
 const single=runInNewContext('planningKpis(items)',{escapeHtml,items:[['Active policies','Not established','insurance register records','',why],['Expired bonds','Not established','at the Data Date','',why]]}) as string;
 assert.match(text(single),/Needs an insurance policy register · insurance register records/);
 assert.match(text(single),/Needs an insurance policy register · at the Data Date/);
});

test('W5/W4: the readiness reason is plain words and says each open check once',()=>{
 assert.equal(readinessComparisonText('independent_unavailable'),'no independent figure to compare with the submitted one');
 assert.equal(readinessComparisonText('submitted_missing'),'no submitted figure to compare with the independent one');
 assert.equal(readinessEvidenceText('partial'),'evidence incomplete');
 const input:ModuleRuntimeResult={key:'arbitrary-control',status:'ready',engineState:'ready',evidenceState:'partial',professionalState:'review_required',reason:'Resource assignments are not established.',dependencies:[],
  data:{systemEvidenceContract:{state:'verified_for_checked_metrics',checks:[{metric:'population',passed:true}]},challenge:{reconciliationState:'independent_unavailable',items:[{metric:'finish',reconciliationState:'independent_unavailable'}]}}} as any;
 const result=enforceModuleReadiness(input,{state:'pass',failedCheckIds:[],checkCount:8});
 assert.match(String(result.reason),/Readiness review: evidence incomplete; professional review required; no independent figure to compare with the submitted one/);
 assert.doesNotMatch(String(result.reason),/independent unavailable|reconciliation independent|information\/system|\(s\)/,'before: "submitted/independent reconciliation independent unavailable"');
});

test('W5: the specialist positions table says a shared readiness sentence once (no repeated calculation notes)',()=>{
 const ready='Readiness review: evidence incomplete; professional review required; no independent figure to compare with the submitted one.';
 const counts={system_defect:0,source_conflict:0,data_quality:0,missing_information:1,comparison_difference:0,governance_review:0,verification_pending:0};
 const pos=(key:string,label:string,reason:string)=>({key,label,group:'Progress',reason,issueAssessment:{counts}});
 const data={projectionKey:'master_control_programme',candidateInbox:[],controlHistory:[],revisionAuthority:{},wbsControl:{},scope:{},specialistPositions:[
  pos('resource-utilization','Resources','Resource assignments are not established. '+ready),pos('manhour-scurve','Man-Hour S-Curve','Governed labor history is not established. '+ready),
  pos('delay-claims','Delay Event Register','Delay events are not established. '+ready),pos('eot-assessment','EOT Assessment','Further adjustment is not established. '+ready)]};
 const html=runInNewContext('renderManagementControlVisual("master-control-programme",data)',{escapeHtml,data,names:{},renderMcpProgrammeControl:()=>'',experienceSourceContext:()=>'',currentModuleResult:null}) as string;
 const page=text(html);
 assert.deepEqual(repeatedSentences(page),[],'before: the raw reason repeated under Calculation notes on every row');
 assert.equal(count(page,ready),1);
 assert.match(page,/Labor history is not confirmed|Confirmed labor history is not confirmed/);
 assert.match(page,/Other reasons as for Resources/);
 assert.doesNotMatch(page,/Calculation notes/);
});

test('W5: a module page does not repeat a sentence already said under "What needs attention"',()=>{
 const said='Independent forecast is withheld from management comparison because its checks have not passed. Review calendars, remaining durations, logic and constraints; the submitted finish remains visible.';
 const reason=said+' Readiness review: evidence incomplete; professional review required.';
 assert.equal(runInNewContext('unsaidSentences(reason,[said])',{reason,said}),'Readiness review: evidence incomplete; professional review required.');
 assert.equal(runInNewContext('unsaidSentences(reason,[null])',{reason}),reason);
 assert.match(script,/const readinessReason=unsaidSentences\(userReason,\[statedReview,userFacingModuleReason\(result\.key,statedReview\)\]\);/);
});

test('W5: the three float-trend charts share one basis and one scale line',()=>{
 const points=[0,1,2].map(i=>({dateIso:'2031-0'+(i+1)+'-15',unfinishedExecutionActivityCount:46,criticalCount:10+i,nearCriticalCount:5,negativeFloatCount:3}));
 const html=runInNewContext('renderFloatPressureTrend(points,null)',{escapeHtml,points,currentModuleResult:null}) as string;
 const page=text(html);
 assert.deepEqual(repeatedSentences(page),[],'before: the share basis, the lower-count note and the scale line under every chart');
 assert.equal(count(page,'Share of unfinished execution activities (46 → 46 unfinished).'),1);
 assert.equal(count(page,'A lower count alone does not establish improvement when completed work leaves the count.'),1);
 assert.equal(count(page,'True date spacing · 3 plot points · % of unfinished activities'),1);
 assert.equal(count(html,'class="svg-chart"'),3,'all three charts are still drawn');
});

test('W5: a qualification shared by every revision is said once; each revision keeps its own',()=>{
 const shared='Required finish authority: A governed contractual/required finish is not established.';
 const point=(i:number,n:number)=>({sourceRevisionId:'R'+i,dataDateIso:'2040-0'+i+'-10',calculationReason:'Material activity-level divergence: '+n+' activities differ by more than 14 calendar days and require reconciliation. '+shared,
  calculationChecks:[{key:'required_finish_authority',label:'Required finish authority',state:'not_established',detail:'A governed contractual/required finish is not established.',count:0}]});
 const html=runInNewContext('renderForecastCalculationChecks(p)',{escapeHtml,p:{points:[point(1,44),point(2,40),point(3,45)]},humanizeKey:String,planningShortDate:String,fmt:String}) as string;
 const page=text(html);
 assert.deepEqual(repeatedSentences(page),[]);
 assert.equal(count(page,shared),1);
 for(const n of [44,40,45])assert.match(page,new RegExp('Material activity-level divergence: '+n+' activities'));
 const one=runInNewContext('renderForecastCalculationChecks(p)',{escapeHtml,p:{points:[point(1,44)]},humanizeKey:String,planningShortDate:String,fmt:String}) as string;
 assert.match(text(one),new RegExp(shared.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&')),'a single revision keeps its whole qualification');
});

test('W4: counts on the change report, diagnosis and delivery owner link use the shared count helper',()=>{
 const a={maximumDays:185,maximumCount:1,maximumPercent:2.13,population:{denominator:47,sourceCount:47},maximumRows:[{activityId:'PRC-399-5',movementDays:185}],fromLabel:'Rev A',toLabel:'Rev B',sourcePairVerifiedCount:1};
 const page=text(runInNewContext('renderRevisionMovementConcentration(a,[])',{escapeHtml,a,currentModuleResult:null}) as string);
 assert.match(page,/1 activity has the maximum/);assert.match(page,/1 representative of 1\./);assert.match(page,/47 matched activities/);
 assert.doesNotMatch(page,/\b1 (activities|representatives)\b/,'before: "1 activities share the maximum", "1 representatives of 1"');
 assert.match(deliveryScript(),/linkedWork\?countText\(linkedWork\.total,'package',undefined,fmt\):''/,'before: "1 packages"');
});

test('W7: window activity lists use the shared reader ID list with the count in the summary',()=>{
 const ids=Array.from({length:41},(_,i)=>'PRC-'+(100+i)+'-'+i);
 const html=runInNewContext('windowActivityList("At window start",ids,"None")',{escapeHtml,ids,currentModuleResult:null}) as string;
 for(const line of text(html).split('\n'))assert.ok((line.match(/\b[A-Z]{2,}[A-Z0-9]*-\d{2,}\b/g)||[]).length<12,'no line of 12+ IDs: '+line.slice(0,80));
 assert.match(html,/<summary>At window start · 41 activities<\/summary>/);
 assert.equal((html.match(/<li>/g)||[]).length,41,'every ID is still listed');
 assert.match(runInNewContext('windowActivityList("Entered critical",[],"None")',{escapeHtml,currentModuleResult:null}) as string,/Entered critical · 0<\/b><br>None/);
});

test('W2: delivery and interface controls say records and registers, not populations',()=>{
 const delivery=deliveryScript();
 // A3 (r15 c3-last): the button names its own register instead of "the selected register".
 assert.match(delivery,/id="deliveryConfirmPopulation">'\+escapeHtml\(deliveryConfirmRegisterText\(p\.kind\)\)\+'<\/button>/);
 assert.doesNotMatch(delivery,/Confirm the selected register is complete/);
 assert.doesNotMatch(delivery,/Confirm selected record population/);
 assert.doesNotMatch(script,/Confirm the complete interface population/);
 assert.equal(deliveryPopulationReason('commissioning'),'Confirm the Testing & commissioning register is complete');
 const data={interfaceProjectionKey:'interface_intelligence',managementPosition:'Interfaces from registers',population:{state:'not_established'},knownCount:2,confirmedCount:0,blockerCount:null,knownBlockerCount:1,candidateCount:0,linkedActivityCount:null,knownLinkedActivityCount:1,rows:[]};
 const html=runInNewContext('renderInterfaceIntelligenceVisual(data)',{escapeHtml,data,currentModuleResult:null}) as string;
 assert.doesNotMatch(text(html),/\bpopulation\b/i);
 assert.match(text(html),/Confirm the interface register is complete/);
});

test('N6: an amount stated with its currency in contract wording shows thousands separators',()=>{
 assert.equal(statedAmountText('Delay damages rate: USD 28022 per calendar day. Delay damages cap: 10% of the Contract Amount.'),'Delay damages rate: USD 28,022 per calendar day. Delay damages cap: 10% of the Contract Amount.');
 assert.equal(statedAmountText('Accepted Contract Amount: USD 10099856. Clause 2042 applies.'),'Accepted Contract Amount: USD 10,099,856. Clause 2042 applies.');
 assert.equal(statedAmountText('10099856 SAR and USD 28022.50'),'10,099,856 SAR and USD 28,022.50');
 assert.equal(statedAmountText('USD 1,234 per day; item 123456; 14 days'),'USD 1,234 per day; item 123456; 14 days','no currency code, no change');
 assert.match(script,/escapeHtml\(statedAmountText\(row\.textPreview\|\|""\)\)/);
 assert.match(script,/escapeHtml\(statedAmountText\(x\.textSnippet\)\)/);
});
