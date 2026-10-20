// Round 15 guard rules on the shared renderers (real functions from the assembled browser script):
// W1 no field names on screen, W7 no long ID dumps in text, N6 numbers formatted for people,
// N11 an ID column that repeats one value on every row is said once.
import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from './browser-context';
import {readableFieldLabel} from '../packages/runtime-api/src/field-labels';
import {assessModuleIssues} from '../packages/runtime-api/src/module-issues';

const plain=(html:string)=>html.replace(/<\/(?:dt|dd|p|summary|li|tr|h4|h5)>/g,'\n').replace(/<\/td>/g,'\t').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/[ ]+/g,' ');
// The guard's W1 shapes: a field key in Title Case words, and any camelCase or snake_case word.
const titleWords=(key:string)=>key.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/_/g,' ').split(/\s+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
const codeWord=/\b[a-z]+[A-Z][a-z]+[A-Za-z]*\b|\b[a-z]+_[a-z][a-z_]+\b/;
// The guard's W7 shape: 12 or more record IDs on one line of text.
const idDump=(text:string)=>text.split('\n').find(line=>(line.match(/\b[A-Z]{2,}[A-Z0-9]*-\d{2,}\b/g)??[]).length>=12&&!line.includes('\t'));

test('W1: the delivery key/value detail uses the shared label map, never a field name in words',()=>{
 const shown={kind:'quality',scopeId:null,denominator:null,knownRecordCount:1,pendingRecordCount:0,missingDatePolicy:'withhold_from_as_of',
  currentCount:null,knownCurrentCount:1,knownOpenCount:1,unknownStatusCount:0,knownOverdueCount:null,futureCount:0,undatedCount:0,openCount:null,overdueCount:null,
  closedCount:null,closurePercent:null,retestCount:null,knownOutcomeCount:0,unknownOutcomeCount:1,knownPassedCount:0,knownFailedCount:0,passedCount:null,failedCount:null,
  passRatePercent:null,reviewPeriodCalendarDays:null,reviewPeriodKnownCount:0,evidenceRecordCount:1,knownCurrentRecordCount:1,evidenceCoveragePercent:100,
  sourceDateConflictCount:0,dueAfterDataDateCount:1,statusDateMissingCount:0,missingProbabilityCount:1,missingImpactCount:1,sourceFactKey:'risk rating score conflict',
  sourceAnalyticalOnly:false,reviewIntervalDays:null,quantityTrackingEstablished:true,key:'submittal_throughput|submission|actual|records'};
 const html=runInNewContext('humanizeKey;deliveryObjectDetail(v)',{v:shown}) as string;
 for(const key of Object.keys(shown)){
  const words=titleWords(key);
  if(words.split(' ').length>=2)assert.doesNotMatch(html,new RegExp('(?<![A-Za-z])'+words+'(?![a-z])'),key+' is not shown as "'+words+'"');
 }
 assert.doesNotMatch(plain(html),codeWord,'no camelCase or snake_case word in the detail');
 assert.match(html,/<dt>Open records found<\/dt><dd>1<\/dd>/);
 assert.match(html,/<dt>Pass rate %<\/dt><dd>Not established<\/dd>/,'passRatePercent keeps its % unit');
 assert.match(html,/<dt>Reporting scope<\/dt><dd>Not established<\/dd>/);
 assert.match(html,/<dt>Rule for missing dates<\/dt><dd>Withheld from the as-of position<\/dd>/,'a code value is said in words');
 assert.match(html,/Submittal throughput · Submission · Actual · Records/,'a joined code key is said in words');
 // The same labels reach downloads (one shared map); IDs and units stay as recorded.
 assert.equal(readableFieldLabel('knownOverdueCount'),'Overdue records found');
 assert.equal(readableFieldLabel('passRatePercent'),'Pass rate %');
 for(const kept of ['act_1001','NCR-950','kVA'])assert.equal(runInNewContext('deliveryValue(v)',{v:kept}),kept);
});

test('W1: side-by-side page links keep a space so their words never run together',()=>{
 const html=runInNewContext('managementModuleLink("independent-forecast","Completion forecast")+managementModuleLink("progress-report","Progress measures")+managementModuleLink("command-center","Risk and HSE review")',
  {selected:'master-dashboard',appView:'project'}) as string;
 // Buttons are inline: without whitespace between them the page text reads 'Completion forecastProgress measures'.
 assert.doesNotMatch(html,/<\/button><button/);
 const joined=html.replace(/<[^>]+>/g,'');
 assert.match(joined,/Completion forecast\s+Progress measures\s+Risk and HSE review/);
 assert.doesNotMatch(joined,codeWord);
});

test('W1: decision tables and the EAC basis say codes in words',()=>{
 const shown=runInNewContext('humanizeKey;isReaderCodeValue;[decisionDisplay("within_qualified_contract_comparison","state"),decisionDisplay("established","contractAuthorityState"),decisionBasisText({method:"source_cost_snapshot:eac"}),decisionDisplay("Gross issued certificates","register")]') as string[];
 assert.deepEqual(Array.from(shown),['Within the contract sum (qualified comparison)','Confirmed','EAC basis: Source cost snapshot · EAC','Gross issued certificates']);
});

test('W7: a long reference list is its count with an expandable list, never one line of IDs',()=>{
 const ids=Array.from({length:20},(_,i)=>'ARC-'+(100+i)+'-'+i);
 const html=runInNewContext('renderPmcScope(v)',{v:ids}) as string;
 assert.equal(idDump(plain(html)),undefined,'no line holds 12 or more IDs');
 assert.match(html,/<summary>ARC-100-0; ARC-101-1 · 20 scope references<\/summary>/);
 assert.equal((html.match(/<li>/g)??[]).length,20,'every reference stays available');
 assert.equal(runInNewContext('renderPmcScope(v)',{v:ids.slice(0,3)}),'ARC-100-0; ARC-101-1; ARC-102-2','a short list stays inline');
 assert.equal(runInNewContext('renderPmcScope([])'),'Not classified');
 // Programme quality: the check count, the first part of a preview list, and each formula under its check name.
 const q={state:'calculated',checks:[{key:'negative_float',label:'Negative float',count:41,population:119,basis:'Total float below zero.',activityIds:ids}],
  relationships:[],updateGaps:[],bei:{basis:'',completed:0,planned:0},cpli:{basis:''},formulas:{negative_float:'count of remaining activities with float < 0',sf_links:'count of start-to-finish relationships'}};
 const review=runInNewContext('renderProgrammeQuality(q)',{q}) as string;
 assert.equal(idDump(plain(review)),undefined);
 assert.match(review,/Affected activities · first 20 of 41/);
 assert.match(review,/<dt>Negative float<\/dt><dd>count of remaining activities with float &lt; 0<\/dd><dt>Start-to-finish links<\/dt>/);
 assert.doesNotMatch(plain(review),/negative_float|sf_links/);
});

test('N6: executive amounts below one million are shown in full; stored ratios and percentages are rounded',()=>{
 const shown=runInNewContext('[fmtExecutive(524494.37),fmtExecutive(-818276),fmtExecutive(11046723),fmtExecutive(24.5)]') as string[];
 assert.deepEqual(Array.from(shown),['524,494','-818,276','11.05M','24.5']);
 for(const value of shown)assert.doesNotMatch(value,/\d(?:\.\d+)?k\b/,'no 4k style short form');
 const card=runInNewContext('pmcCard({title:"Cost",value:0.945205,meta:[["CPI",0.945205],["SPI",0.932432],["Current contract","10.23M USD"]]})') as string;
 assert.match(card,/<em>CPI<\/em><b>0\.95<\/b>/);assert.match(card,/<em>SPI<\/em><b>0\.93<\/b>/);assert.match(card,/10\.23M USD/);
 assert.doesNotMatch(card,/\d\.\d{3,}/,'no more than 2 decimals');
 const issues=assessModuleIssues({key:'progress-report',status:'partial',reason:'',data:{progressBases:{certified:{valuePercent:62.11021197477392}},
  challenge:{items:[{metric:'certified_progress_percent',reconciliationState:'independent_unavailable',independent:{diagnostics:['SOURCE_AUTHORITY_ONLY']},submitted:{value:62.11021197477392,sourceRefs:[]}}]}}} as any,
  {state:'pass',failedCheckIds:[],checkCount:0});
 const detail=issues.issues.find((i:any)=>i.code==='CERTIFIED_PROGRESS_INDEPENDENT_VERIFICATION')!.detail;
 assert.match(detail,/already holds 62\.11% certified financial progress/);
});

// A small element model with the parts of the DOM the shared table look code uses.
class Txt{nodeType=3;parentNode:El|null=null;constructor(public data:string){}get textContent(){return this.data;}}
class El{
 nodeType=1;parentNode:El|null=null;childNodes:(El|Txt)[]=[];attrs:Record<string,string>={};
 constructor(public tagName:string,public ownerDocument:any){}
 get children():El[]{return this.childNodes.filter((n):n is El=>n instanceof El);}
 get firstChild():El|Txt|null{return this.childNodes[0]??null;}
 get className(){return this.attrs.class??'';}set className(v:string){this.attrs.class=v;}
 get classList(){const list=()=>this.className.split(/\s+/).filter(Boolean);return {contains:(c:string)=>list().includes(c),add:(c:string)=>{if(!list().includes(c))this.className=[...list(),c].join(' ');},remove:(c:string)=>{this.className=list().filter(x=>x!==c).join(' ');}};}
 get colSpan(){return Number(this.attrs.colspan??1);}get rowSpan(){return Number(this.attrs.rowspan??1);}
 get textContent():string{return this.childNodes.map(n=>n.textContent).join('');}
 set textContent(v:string){this.childNodes=[];this.appendChild(new Txt(v));}
 get tHead():El|null{return this.children.find(c=>c.tagName==='THEAD')??null;}
 get tBodies():El[]{return this.children.filter(c=>c.tagName==='TBODY');}
 get rows():El[]{return this.children.filter(c=>c.tagName==='TR');}
 get cells():El[]{return this.children.filter(c=>c.tagName==='TH'||c.tagName==='TD');}
 get nextElementSibling():El|null{const s=this.parentNode?.children??[];return s[s.indexOf(this)+1]??null;}
 getAttribute(n:string){return n in this.attrs?this.attrs[n]!:null;}setAttribute(n:string,v:string){this.attrs[n]=String(v);}hasAttribute(n:string){return n in this.attrs;}
 appendChild(n:El|Txt){if(n.parentNode)n.parentNode.childNodes=n.parentNode.childNodes.filter(x=>x!==n);n.parentNode=this;this.childNodes.push(n);return n;}
 insertBefore(n:El,ref:El){if(n.parentNode)n.parentNode.childNodes=n.parentNode.childNodes.filter(x=>x!==n);n.parentNode=this;this.childNodes.splice(this.childNodes.indexOf(ref),0,n);return n;}
 remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(x=>x!==this);this.parentNode=null;}
 closest(){return null;}
 querySelector(){return null;}querySelectorAll(){return [];}
}
const doc:any={createElement:(t:string)=>new El(t.toUpperCase(),doc)};
function h(tag:string,attrs:Record<string,string>|null,...kids:(El|string)[]){const e=new El(tag.toUpperCase(),doc);Object.assign(e.attrs,attrs??{});for(const k of kids)e.appendChild(typeof k==='string'?new Txt(k):k);return e;}

test('N11: an ID column with one value on every row is said once above the table and comes back when rows differ',()=>{
 const rows=Array.from({length:25},(_,i)=>['ACT-'+(100+i),'10','C1','Sep '+(1+i%28)+', 2041']);
 const table=h('table',null,h('thead',null,h('tr',null,...['Activity','WBS','Calendar','Current finish'].map(x=>h('th',null,x)))),h('tbody',null,...rows.map(r=>h('tr',null,...r.map(x=>h('td',null,x))))));
 const wrap=h('div',{class:'table-wrap'},table),section=h('section',null,wrap);
 runInNewContext('lookConstantColumns(t)',{t:table});
 const note=section.children[0]!;
 assert.equal(note.tagName,'P');assert.equal(note.textContent,'All rows: WBS 10 · Calendar C1');
 const hidden=(i:number)=>[table.tHead!.rows[0]!,...table.tBodies[0]!.rows].every(r=>r.cells[i]!.classList.contains('look-constant-col'));
 assert.ok(hidden(1)&&hidden(2),'the repeated cells are hidden, not removed');
 assert.ok(!hidden(0)&&!hidden(3),'columns whose values differ stay');
 assert.equal(table.tBodies[0]!.rows[24]!.cells[1]!.textContent,'10','every value stays in the table');
 // Running again (re-render observer) changes nothing.
 runInNewContext('lookConstantColumns(t)',{t:table});assert.equal(section.children.length,2);
 // Another page of rows with a second WBS brings the column back.
 table.tBodies[0]!.rows[3]!.cells[1]!.textContent='20';
 runInNewContext('lookConstantColumns(t)',{t:table});
 assert.equal(note.textContent,'All rows: Calendar C1');assert.ok(!hidden(1)&&hidden(2));
 // Fewer than 10 rows: nothing is folded.
 const small=h('table',null,h('thead',null,h('tr',null,h('th',null,'WBS'))),h('tbody',null,...Array.from({length:4},()=>h('tr',null,h('td',null,'10')))));
 const holder=h('div',null,small);
 assert.equal(runInNewContext('lookConstantColumns(t)',{t:small}),false);assert.equal(holder.children.length,1);
});
