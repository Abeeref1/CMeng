import {runInNewContext} from './browser-context';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// SW-43 / SW-44 (T10, guards L1, L3, W5): the shared module page renderer.
// Real renderModuleResultBody, real verdict and real generic field view. Only the
// DOM node lookup, the role selector and the page-specific visual are test inputs.
const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
const functions=(names:string[])=>source.statements.filter(isFunctionDeclaration).filter(n=>n.name&&names.includes(n.name.text)).map(n=>n.getText(source)).join('\n');

function renderPage(key:string,data:any,specialized:string){
 const nodes=new Map<string,any>();
 const el=(id:string)=>{if(!nodes.has(id))nodes.set(id,{style:{},classList:{remove(){},add(){}},innerHTML:'',textContent:'',className:'',disabled:false,hidden:false,open:false});return nodes.get(id);};
 const ctx:any={el,renderModuleWorkspace(){},renderRoleViewSelector(){},renderDelivery:()=>false,renderSpecializedModule:()=>specialized,
  selectedRoleView:'overall',appView:'project',overview:{latestDataDateIso:null},currentModuleResult:null,project:()=>'P',projectRequestSeq:1,
  localStorage:{getItem:()=>null,setItem(){}}};
 runInNewContext(functions(['renderModuleResultBody']),ctx);
 ctx.renderModuleResultBody({key,status:'partial',data});
 return String(nodes.get('moduleContent').innerHTML);
}
const verdict={specific:true,label:'Review needed',rag:'amber',text:'524 activities carry negative float.',nextAction:'Confirm the recovery sequence.',assignTo:'Planning Manager',owner:'Planning Manager',basis:'Amber: information or review is incomplete.',schemaVersion:'1.0',facts:{}};

test('SW-43: a module page opens with its verdict before its tables and evidence',()=>{
 const html=renderPage('near-critical',{projectionKey:'near_critical',positionVerdict:verdict,issueAssessment:{issues:[],counts:{}}},'<section class="planning-panel"><div class="table-wrap"><table><tbody><tr><td>EVIDENCE-TABLE</td></tr></tbody></table></div></section>');
 const answer=html.indexOf('class="position-verdict');
 assert.ok(answer>=0,'the page verdict (state, finding, next step) is on the page');
 assert.match(html,/524 activities carry negative float\./);
 assert.ok(answer<html.indexOf('EVIDENCE-TABLE'),'the verdict comes before the tables');
 assert.ok(answer<html.indexOf('Actions and supporting details'),'the verdict comes before review and supporting detail');
 assert.equal(html.split('524 activities carry negative float.').length-1,1,'the verdict is printed once');
 // A non-specific verdict is not an answer: it stays inside the supporting detail only.
 const general=renderPage('near-critical',{projectionKey:'near_critical',positionVerdict:{...verdict,specific:false,text:'GENERAL VIEW TEXT'},issueAssessment:{issues:[],counts:{}}},'<section>EVIDENCE-TABLE</section>');
 assert.ok(!general.includes('class="position-verdict'));
 assert.equal(general.split('GENERAL VIEW TEXT').length-1,1);
 assert.ok(general.indexOf('GENERAL VIEW TEXT')>general.indexOf('Actions and supporting details'));
});

test('SW-44: the generic field view prints each figure once, keeps every field, and collapses the long list behind Details',()=>{
 const data:any={projectionKey:'near_critical',positionVerdict:verdict,issueAssessment:{issues:[],counts:{}},
  // Two fields the screen labels identically with the same value: one figure on screen.
  execution_control:120,execution_control_population:120};
 for(let i=1;i<=14;i++)data['measure'+i+'Count']=1000+i;
 const html=renderPage('near-critical',data,'');
 assert.equal(html.split('<b>Execution activities</b><span>120</span>').length-1,1,'the same figure is printed once');
 for(let i=1;i<=14;i++)assert.ok(html.includes('1,0'+String(i).padStart(2,'0')),'field '+i+' stays on the page (nothing removed)');
 const details=html.indexOf('<details class="management-detail generic-field-details"><summary>Details');
 assert.ok(details>=0,'the long field list is collapsed behind Details');
 const keyFigures=html.slice(html.indexOf('generic-key-figures'),details);
 assert.equal((keyFigures.match(/<div class="scalar">/g)||[]).length,6,'six key figures lead');
 assert.match(html,/Details · 9 more fields/);
 assert.ok(html.indexOf('class="position-verdict')<html.indexOf('generic-key-figures'),'the answer leads the key figures');
 assert.ok(html.indexOf('generic-key-figures')<details,'key figures come before the collapsed detail');
});

test('SW-43: buttons and notices added after the page is drawn go after the verdict, not above it',()=>{
 const run=(withVerdict:boolean)=>{
  const calls:string[]=[];
  const verdictNode={insertAdjacentHTML:(where:string,html:string)=>calls.push('verdict:'+where+':'+html)};
  const content:any={insertAdjacentHTML:(where:string,html:string)=>calls.push('page:'+where+':'+html),querySelector:(selector:string)=>withVerdict&&selector===':scope>.position-verdict'?verdictNode:null,querySelectorAll:()=>[]};
  const ctx:any={renderModuleResultBody(){},el:(id:string)=>id==='moduleContent'?content:null,applyPmcDisplayOwners(){},applyProjectDisplayText(){},observeProjectDisplay(){},
   renderDecisionAnalysis:()=>'',linkCandidateEntry:()=>'',openProjectActions(){},bindProjectActions(){},planningShortDate:String,fmt:String};
  runInNewContext(functions(['renderModuleResult']),ctx);
  ctx.renderModuleResult({key:'material-tracking',status:'partial',data:{projectFacts:{time:{extendedContractCompletionIso:{value:'2031-05-01',diagnostics:['AMENDMENT_OVERLAP_TO_CONFIRM']},awardedEotDays:{value:12}}}}});
  return calls;
 };
 const placed=run(true);
 const buttons=placed.find(c=>c.includes('Create BOQ links')),notice=placed.find(c=>c.includes('Extended completion comparison'));
 assert.ok(buttons?.startsWith('verdict:afterend:'),'BOQ link buttons follow the verdict');
 assert.ok(notice?.startsWith('verdict:afterend:'),'the extended completion notice follows the verdict');
 assert.ok(!placed.some(c=>c.startsWith('page:afterbegin:')),'nothing is put above the verdict');
 assert.match(notice!,/12 awarded EOT days/,'the notice keeps its figures');
 // A page without a verdict keeps them at the top, as before.
 const plain=run(false);
 assert.ok(plain.find(c=>c.includes('Create BOQ links'))?.startsWith('page:afterbegin:'));
 assert.ok(plain.find(c=>c.includes('Extended completion comparison'))?.startsWith('page:afterbegin:'));
});

// Role-content harness: real experienceRoleContent, real summary box, real
// figure cards; only the role lens text and source context are test inputs.
const escapeHtml=(s:unknown)=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const count=(html:string,text:string)=>html.split(text).length-1;
function roleContent(role:string,key:string,data:any,primaryView:string){
 const ctx:any={selectedRoleView:role,roleViews:{[role]:{label:role}},escapeHtml,experienceRoleLensContext:()=>'',experienceRoleReview:()=>'',experienceSourceContext:()=>'SOURCE-CONTEXT'};
 return String(runInNewContext(functions(['experienceRoleContent'])+';experienceRoleContent(__key,__data,__view,"")',Object.assign(ctx,{__key:key,__data:data,__view:primaryView})));
}

test('SW-44: the summary box and the figure cards share one printed-figure list',()=>{
 const data={projectionKey:'near_critical',nearCriticalCount:7732,zeroFloatCount:644,negativeFloatCount:524,floatRiskWatchlistCount:8376};
 const cards=String(runInNewContext('planningKpis(__rows)',{__rows:[['Strict near-critical',7732,'TF > 0 working days and ≤ 5 working days','warning'],['Float-risk watchlist',8376,'critical boundary through 5 working days','accent']],escapeHtml}));
 assert.equal(count(cards,'<strong>7,732</strong>'),1,'precondition: the card prints the figure');
 const html=roleContent('overall','near-critical',data,'<section class="planning-panel">'+cards+'<table><tbody><tr><td>EVIDENCE-ROW</td></tr></tbody></table></section>');
 assert.equal(count(html,'7,732'),1,'the figure is printed once on the page');
 const summary=html.slice(html.indexOf('experience-management-reading'),html.indexOf('role-primary-analysis'));
 assert.match(summary,/Strict near-critical: <strong>7,732<\/strong>/,'the summary box prints the figure');
 assert.match(summary,/TF &gt; 0 working days and ≤ 5 working days/,'the summary carries the card explanation');
 const card=html.slice(html.indexOf('<span>Strict near-critical</span>'));
 assert.match(card,/^<span>Strict near-critical<\/span><strong class="figure-shown-above">Shown above<\/strong><small>TF &gt; 0 working days and ≤ 5 working days<\/small>/,'the card keeps its label and explanation');
 assert.match(html,/<span>Float-risk watchlist<\/span><strong>8,376<\/strong>/,'a card the summary does not print is unchanged');
 assert.equal(count(html,'EVIDENCE-ROW'),1,'evidence stays on the page');
});

test('SW-44: role views show each preview chart once; the full-detail panel holds the rest of the same page',()=>{
 const view='<section class="planning-panel"><h4>Trend</h4><svg viewBox="0 0 1 1"><rect x="0" y="0"/><text>CHART-A</text></svg></section>'+
  '<section class="planning-panel"><div class="chart-card"><svg><text>CHART-B</text></svg></div><p>PARENT-TEXT</p></section>'+
  '<section class="planning-panel"><svg><text>CHART-C</text></svg><table><tbody><tr><td>REGISTER-ROW</td></tr></tbody></table></section>';
 for(const role of ['controls','project-director','executive']){
  const html=roleContent(role,'variance-trends',{projectionKey:'variance_trends'},view);
  for(const part of ['CHART-A','CHART-B','CHART-C','REGISTER-ROW','PARENT-TEXT','<h4>Trend</h4>'])assert.equal(count(html,part),1,role+': '+part+' is printed once and kept');
  const preview=html.indexOf('experience-preview'),disclosure=html.indexOf('<details class="experience-disclosure');
  assert.ok(preview>=0&&preview<disclosure,role+': the preview leads');
  assert.ok(html.indexOf('CHART-A')<disclosure,role+': the first chart is in the preview');
  assert.ok(html.indexOf('REGISTER-ROW')>disclosure,role+': a panel with a register is never moved into the preview');
  if(role==='executive')assert.ok(html.indexOf('CHART-B')>disclosure,'executive preview holds one chart');
  else assert.ok(html.indexOf('CHART-B')<disclosure,role+': the second leaf chart is in the preview');
 }
 // The pure split on its own: the leaf chart card moves; its parent panel stays.
 const split=runInNewContext('experiencePreview(__v,2)',{__v:view,escapeHtml}) as any;
 assert.equal(count(split.preview+split.rest,'CHART-B'),1);
 assert.match(split.rest,/<section class="planning-panel"><p>PARENT-TEXT<\/p><\/section>/);
 assert.equal(runInNewContext('experiencePreview(__v,2).rest',{__v:'<table><tr><td>ONLY</td></tr></table>'}),'<table><tr><td>ONLY</td></tr></table>','a page without chart panels is unchanged');
});
