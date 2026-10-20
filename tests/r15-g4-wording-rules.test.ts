// R15 guard rules W4, W5, W6, A3 and C1 on the shared page renderers and text
// builders. The page functions are the real ones from the assembled browser
// script (browser-context pulls their real helpers); server texts are the real
// producers. Nothing here edits the guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from './browser-context';
import {countText,countUnit} from '../packages/runtime-api/src/count-text';
import {positionVerdict} from '../packages/runtime-api/src/position-review';
import {summarizeControlIssues} from '../packages/truth-kernel/src/issues';

const escapeHtml=(s:unknown)=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const text=(html:string)=>html.replace(/<[^>]+>/g,'\n').replace(/&amp;/g,'&');
// The guard's sentence count: a sentence of 8+ words said 3 or more times on one page.
function repeatedSentences(page:string){
 const counts=new Map<string,number>();
 for(const line of page.split('\n'))for(const s of line.trim().split(/(?<=[.!?])\s+/))if(s.split(/\s+/).length>=8)counts.set(s,(counts.get(s)??0)+1);
 return [...counts].filter(([,n])=>n>=3).map(([s])=>s);
}

test('W4: one count helper makes figures and nouns agree, including units after a figure',()=>{
 assert.equal(countText(1,'group of records','groups of records'),'1 group of records');
 assert.equal(countText(3,'group of records','groups of records'),'3 groups of records');
 assert.deepEqual([countUnit(1,'items'),countUnit(2,'items'),countUnit(1,'scope items'),countUnit(1,'calendar days'),countUnit(1,'USD'),countUnit(1,'%'),countUnit(null,'records')],
  ['item','items','scope item','calendar day','USD','%','records']);
 // renderVisualBars feature-detects the shared count helper (typeof), so the test names it to run the real one.
 const bars=runInNewContext('countUnit;renderVisualBars([{label:"Open",value:1},{label:"Overdue",value:0},{label:"Complete",value:2}],"items")',{escapeHtml}) as string;
 assert.match(bars,/>1 item</);assert.match(bars,/>0 items</);assert.match(bars,/>2 items</);
 assert.doesNotMatch(bars,/\b1 items\b/,'before: "Open 1 items"');
 const populations=Object.fromEntries(Array.from({length:3},(_,n)=>[n,{populationId:'P'+n,name:'Register '+n,entity:'record',denominator:2,sourceCount:3,exclusions:[{reason:'after_data_date'}],dateBasis:'Actual date'}]));
 const scope=runInNewContext('renderRegisterScope(data)',{escapeHtml,humanizeKey:String,planningShortDate:String,data:{reportingContract:{populations,dataDateIso:'2031-06-30'}}}) as string;
 assert.match(scope,/<summary>3 groups of records include later or missing dates/,'before: "3 record groups include", read as "3 record"');
 const one=runInNewContext('renderRegisterScope(data)',{escapeHtml,humanizeKey:String,planningShortDate:String,data:{reportingContract:{populations:{0:populations[0]},dataDateIso:'2031-06-30'}}}) as string;
 assert.match(one,/<summary>1 group of records includes later or missing dates/);
});

test('W5: a long note shared by several known tiles is said once; an unknown tile keeps its reason',()=>{
 const basis='Submitted programme float; the independent calculation is not reconciled with it';
 const html=runInNewContext('planningKpis(items)',{escapeHtml,items:[['Critical',59,basis],['Negative float',35,basis],['Near-critical',36,basis],['Driving network',null,'Not established until the network is calculated']]}) as string;
 assert.equal((html.match(new RegExp(basis,'g'))||[]).length,1,'before: the same basis under every tile');
 assert.match(html,/Critical, Negative float and Near-critical: Submitted programme float/);
 assert.match(html,/Not established until the network is calculated/,'the unknown tile keeps its own reason');
 assert.match(html,/<strong>59<\/strong>/);assert.match(html,/<strong>35<\/strong>/);assert.match(html,/<strong>36<\/strong>/);
});

test('W5: the commercial register basis is said once for the current, later and undated groups',()=>{
 const empty={rows:[],summary:{recordCount:0}};
 const data={projectionKey:'commercial_canonical',moduleKey:'commercial-payment-register',dataDateIso:'2031-08-31',rows:[],registerScope:{asOf:empty,future:empty,undated:empty},summary:{}};
 const html=runInNewContext('renderCommercialLedgerVisual(data)',{escapeHtml,humanizeKey:String,planningShortDate:String,data,projectionFor:(d:unknown)=>d,planningKpis:()=>''}) as string;
 const page=text(html);
 assert.deepEqual(repeatedSentences(page),[],'no sentence of 8+ words three times');
 assert.equal((page.match(/Currency, tax basis and reporting period are kept separate\./g)||[]).length,1);
 assert.equal((page.match(/A certificate does not prove an employer approval or a bank receipt\./g)||[]).length,1);
 assert.match(page,/After Data Date, excluded from current totals · 0 source records/);
 assert.match(page,/Date not confirmed, excluded from current totals · 0 source records/);
});

test('W5: an empty-table reason and a single-choice filter note are said in full once per page',()=>{
 class El{
  nodeType=1;parentNode:El|null=null;childNodes:El[]=[];attrs:Record<string,string>={};text='';disabled=false;multiple=false;value='';title='';
  constructor(public tagName:string,public ownerDocument:any){}
  get children():El[]{return this.childNodes;}get className(){return this.attrs.class??'';}set className(v:string){this.attrs.class=v;}
  get classList(){const self=this;const list=()=>self.className.split(/\s+/).filter(Boolean);return{contains:(c:string)=>list().includes(c),add:(c:string)=>{if(!list().includes(c))self.className=[...list(),c].join(' ');},remove:(c:string)=>{self.className=list().filter(x=>x!==c).join(' ');}};}
  get textContent():string{return this.text+this.childNodes.map(n=>n.textContent).join('');}set textContent(v:string){this.childNodes=[];this.text=v;}
  get tBodies():El[]{return this.childNodes.filter(c=>c.tagName==='TBODY');}get tHead():El|null{return this.childNodes.find(c=>c.tagName==='THEAD')??null;}
  get rows():El[]{return this.childNodes.filter(c=>c.tagName==='TR');}get cells():El[]{return this.childNodes.filter(c=>c.tagName==='TD'||c.tagName==='TH');}
  get options():El[]{return this.childNodes.filter(c=>c.tagName==='OPTION');}
  get nextElementSibling():El|null{const s=this.parentNode?.childNodes??[];return s[s.indexOf(this)+1]??null;}
  getAttribute(n:string){return n in this.attrs?this.attrs[n]!:null;}setAttribute(n:string,v:string){this.attrs[n]=v;}hasAttribute(n:string){return n in this.attrs;}removeAttribute(n:string){delete this.attrs[n];}
  appendChild(n:El){n.parentNode=this;this.childNodes.push(n);return n;}remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(x=>x!==this);}
  insertAdjacentElement(_w:string,n:El){const p=this.parentNode!;n.parentNode=p;p.childNodes.splice(p.childNodes.indexOf(this)+1,0,n);}
  matches(sel:string):boolean{return sel.split(',').some(one=>{const m=one.trim().match(/^([a-z]*)((?:\.[\w-]+)*)(?:\[([\w-]+)\])?$/i);if(!m)return false;const[,tag,cls,attr]=m;if(tag&&this.tagName!==tag.toUpperCase())return false;if(cls&&!cls.split('.').filter(Boolean).every(c=>this.classList.contains(c)))return false;if(attr&&!(attr in this.attrs))return false;return true;});}
  closest(sel:string):El|null{let n:El|null=this;while(n){if(n.matches(sel))return n;n=n.parentNode;}return null;}
  querySelectorAll(sel:string):El[]{const out:El[]=[];const walk=(e:El)=>{for(const c of e.childNodes){if(c.matches(sel))out.push(c);walk(c);}};walk(this);return out;}
  querySelector(sel:string):El|null{return this.querySelectorAll(sel)[0]??null;}
 }
 const doc:any={createElement:(t:string)=>new El(t.toUpperCase(),doc)};
 const el=(tag:string,...kids:El[])=>{const e=new El(tag.toUpperCase(),doc);kids.forEach(k=>e.appendChild(k));return e;};
 const opt=(label:string,value:string)=>{const o=el('option');o.text=label;o.value=value;return o;};
 const page=el('main'),tables=[0,1,2].map(()=>{const t=el('table',el('thead',el('tr',el('th'))),el('tbody'));page.appendChild(el('section',t));return t;});
 const selects=[0,1,2].map(()=>{const s=el('select',opt('All owners',''));page.appendChild(el('label',s));return s;});
 runInNewContext('tables.forEach(lookEnhanceTable);selects.forEach(lookCheckFilter)',{tables,selects,document:undefined,MutationObserver:undefined});
 const reasons=tables.map(t=>t.querySelector('.look-empty-row')!.textContent);
 assert.equal(reasons[0],'No records of this kind are in the current project documents for this view.');
 assert.deepEqual(reasons.slice(1),['No records of this kind.','No records of this kind.'],'before: the full sentence in every empty table');
 const notes=selects.map(s=>s.nextElementSibling!.textContent);
 assert.equal(notes[0],'No other values in this data to filter by.');
 assert.deepEqual(notes.slice(1),['No other values.','No other values.']);
 assert.ok(selects.every(s=>s.disabled),'every single-choice filter is still switched off and says why');
});

test('W6: Financial Claims, Notice Compliance, Resources and Man-Hour S-Curve each state their own headline',()=>{
 const verdict=(key:string,data:any)=>positionVerdict({key,status:'partial',reason:null,dependencies:[],data} as any).text;
 const notices=verdict('notices-claims',{noticeCount:3,noticeAssessmentState:'not_assessable_without_delay_events_and_requirements'});
 const claims=verdict('commercial-claims-notices',{position:{claimsNotices:{sourceClaimCount:3,state:'established'}}});
 assert.notEqual(notices,claims,'before: one shared sentence on both pages');
 assert.match(notices,/^3 notices are recorded\. Notice timing is not yet assessed because the delay events and the contract notice periods are not confirmed\./);
 assert.match(claims,/^3 claims are in the claim register\./);
 assert.match(verdict('notices-claims',{timelyNoticeCount:2,lateNoticeCount:1}),/^3 assessed notices: 2 on time and 1 late\./);
 assert.match(verdict('commercial-claims-notices',{position:{claimsNotices:{state:'not_submitted'}}}),/^No claim register is in the current project documents/);
 const resources=verdict('resource-utilization',{capacityStatus:{state:'missing'}});
 const hours=verdict('manhour-scurve',{earnedHours:{state:'not_established',actualHoursReason:'The programme has no hour-based labour assignments.'}});
 assert.notEqual(resources,hours);
 assert.match(resources,/^Labour demand cannot be compared with capacity yet/);
 assert.match(hours,/^Earned and spent man-hours are not established\. The programme has no hour-based labour assignments\./);
 assert.match(verdict('manhour-scurve',{earnedHours:{state:'established',earnedHours:12500,actualHoursSpent:14000.4}}),/^12,500 earned hours to the Data Date against 14,000 hours spent\./);
});

// The page's owner helpers are feature-detected in the renderer (typeof), so the
// test names them to run the real ones.
const OWNER_HELPERS='ownsBlock;ownerLinkPanel;';
const issue=(kind:string,summary:string)=>({kind,code:kind.toUpperCase(),summary,detail:'',action:'Act',owner:'Project controls reviewer',moduleKeys:['near-critical'],evidencePaths:[],sourceRefs:[],checkIds:[]});
const assessment=(counts:Record<string,number>,issues:any[]=[])=>({counts,affectedModuleCounts:counts,issues,systemCheckState:'unverified',scope:'Each type is counted on its own.'});
const reviewContext=(pageKey:string|null)=>({escapeHtml,names:{'source-quality':'Actions required','near-critical':'Near-Critical'},currentModuleResult:pageKey?{key:pageKey}:null,openOwnerPage:()=>{}});
const allKinds=(n:number)=>({system_defect:0,source_conflict:n,data_quality:1,missing_information:0,comparison_difference:0,governance_review:2,verification_pending:0});

test('A3: what each review type means is listed on Actions required; another page shows its counts with a link',()=>{
 const owner=runInNewContext(OWNER_HELPERS+'renderIssueAssessment(a)',{...reviewContext('source-quality'),a:assessment(allKinds(0))}) as string;
 assert.match(owner,/A supplied field or link needs correction\./);assert.match(owner,/An approval or authority is not confirmed\./);
 const other=runInNewContext(OWNER_HELPERS+'renderIssueAssessment(a)',{...reviewContext('cost-forecast'),a:assessment(allKinds(0))}) as string;
 assert.doesNotMatch(other,/A supplied field or link needs correction\.|An approval or authority is not confirmed\./,'before: the type meanings on 31 pages');
 assert.match(other,/data-owner-link="review-items" data-owner-page="source-quality" data-owner-scope="page"/);
 assert.match(other,/On this page: Record needs correction 1 · Review required 2\./,'this page keeps its own counts');
 assert.match(other,/data-owner-open="source-quality"/);
 // A management page counts the project's findings and links to the list; the
 // finding's page (and the summary page) keep the full row.
 const findings=[issue('governance_review','Calculated basis requires review'),issue('comparison_difference','Positions differ')];
 const management=runInNewContext(OWNER_HELPERS+'renderIssueAssessment(a,true)',{...reviewContext('command-center'),a:assessment(allKinds(0),findings)}) as string;
 assert.match(management,/2 project findings listed here/);assert.match(management,/<summary>Findings<\/summary>[^<]*calculated basis requires review/i);
 assert.doesNotMatch(management,/Project controls reviewer<br>/,'the owner and next step stay on the owner list');
 const own=runInNewContext(OWNER_HELPERS+'renderIssueAssessment(a)',{...reviewContext('near-critical'),a:assessment(allKinds(0),findings)}) as string;
 assert.match(own,/Project controls reviewer<br>/,'the affected page keeps its own full row');
 const summary=runInNewContext(OWNER_HELPERS+'renderIssueAssessment(a,true)',{...reviewContext('master-dashboard'),a:assessment(allKinds(0),findings)}) as string;
 assert.match(summary,/Project controls reviewer<br>/,'the summary page keeps the full rows');
});

test('C1: records that disagree come with a choose control; none found is said as none',()=>{
 const some=runInNewContext(OWNER_HELPERS+'renderIssueAssessment(a)',{...reviewContext('cost-forecast'),a:assessment(allKinds(2))}) as string;
 assert.match(some,/<button[^>]*onclick="openProjectActions\(true\)">Choose the value to use<\/button>/,'opens the same-page decision place (pick a value or enter your own)');
 assert.match(some,/Records disagree 2/);
 const ownerSome=runInNewContext(OWNER_HELPERS+'renderIssueAssessment(a)',{...reviewContext('source-quality'),a:assessment(allKinds(2))}) as string;
 assert.match(ownerSome,/Supplied sources make incompatible assertions\. <button[^>]*>Choose the value to use<\/button>/);
 const none=runInNewContext(OWNER_HELPERS+'renderIssueAssessment(a)',{...reviewContext('source-quality'),a:assessment(allKinds(0))}) as string;
 assert.doesNotMatch(none,/Choose the value to use/);
 assert.match(none,/None found by the listed checks\./,'a zero count is not read as a conflict');
 const scope=summarizeControlIssues([]).scope;
 assert.doesNotMatch(scope,/source conflict/i,'before: "A source conflict, missing input ..." on every page');
 assert.match(scope,/Records that disagree, a missing input or a difference between the submitted and independent positions do not by themselves mean a software fault\./);
});
