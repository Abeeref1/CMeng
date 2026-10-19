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
