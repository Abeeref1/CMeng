import {runInNewContext} from './browser-context';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// F52: the Management Brief must open with its answer, not with a role lens's
// long activity table. The table stays on the page, collapsed below the brief.
const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const source=ts.createSourceFile('browser.js',script,ts.ScriptTarget.Latest,true);
function functions(names:string[]){
  const selected=source.statements.filter(ts.isFunctionDeclaration).filter(n=>n.name&&names.includes(n.name.text));
  assert.equal(selected.length,names.length,'all called helpers must exist in the assembled browser script');
  return selected.map(n=>n.getText(source)).join('\n');
}
const escapeHtml=(s:unknown)=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const helpers=functions(['experienceRoleContent','experienceDisclosure','experienceRoleReview','experienceRoleLensContext','pageRoleLensContext','findProjectionRoot','roleLensFacts','roleLensTable','experienceValue','fmtForField']);

test('F52 Management Brief opens with the brief; the 220-row driving-activity table follows it collapsed and complete',()=>{
  const drivers=Array.from({length:220},(_,i)=>({activityId:'ACT-'+String(i).padStart(4,'0'),name:'Driving work '+i,wbs:'WBS-A',calculatedFinishIso:'2031-11-01',totalFloatHours:-8*i}));
  const overview={roleLensContext:{planning:{criticalCount:4,nearCriticalCount:7,negativeFloatCount:2,drivingNetworkState:'calculated',drivers}}};
  const html=runInNewContext(helpers+';experienceRoleContent("pmo-analysis",{},"<section class=\\"brief-answer\\">Management conclusion</section>")',{
    apiKeys:{},fmt:String,fmtExecutive:String,escapeHtml,humanizeKey:String,planningShortDate:(s:unknown)=>s==null?'Not available':String(s),
    sourceWorkingFloatField:(r:any,k:string)=>String(r[k])+' h',currentModuleResult:null,
    overview,selectedRoleView:'planning',roleViews:{planning:{label:'Planning Engineer'}},
    experienceBrief:()=>({facts:[],note:'',review:''}),experienceSourceContext:()=>'',experiencePreview:()=>'',renderProjectDiagnosis:()=>'',renderCompletionPosition:()=>''
  }) as string;
  const answer=html.indexOf('Management conclusion'),table=html.indexOf('<table'),firstRow=html.indexOf('ACT-0000');
  assert.ok(answer>=0,'brief answer present');
  assert.ok(table>answer,'no activity table before the brief answer (before: the 220-row table came first)');
  assert.ok(firstRow>answer,'driving activity rows follow the answer');
  const details=html.lastIndexOf('<details',firstRow);
  assert.ok(details>answer&&html.indexOf('</details>',details)>firstRow,'the table sits inside a collapsed disclosure');
  assert.doesNotMatch(html.slice(details,html.indexOf('>',details)),/\bopen\b/,'collapsed by default');
  for(const row of drivers)assert.ok(html.includes(row.activityId),'nothing removed: '+row.activityId);
  assert.equal((html.match(/Management conclusion/g)||[]).length,1,'brief printed once');
});

test('F52 overall view and pages other than the Management Brief keep their layout',()=>{
  const overview={roleLensContext:{planning:{criticalCount:1,drivers:[{activityId:'ACT-X',name:'W',wbs:'A',calculatedFinishIso:'2031-01-01',totalFloatHours:0}]}}};
  const ctx=(role:string)=>({apiKeys:{},fmt:String,fmtExecutive:String,escapeHtml,humanizeKey:String,planningShortDate:String,sourceWorkingFloatField:(r:any,k:string)=>String(r[k]),currentModuleResult:null,
    overview,selectedRoleView:role,roleViews:{planning:{label:'Planning Engineer'},overall:{label:'Overall'}},
    experienceBrief:()=>({facts:[],note:'',review:''}),experienceSourceContext:()=>'',experiencePreview:()=>'',renderProjectDiagnosis:()=>'',renderCompletionPosition:()=>''});
  const overall=runInNewContext(helpers+';experienceRoleContent("pmo-analysis",{},"<p>BRIEF</p>")',ctx('overall')) as string;
  assert.doesNotMatch(overall,/ACT-X/,'overall lens adds no role tables');
  const other=runInNewContext(helpers+';experienceRoleContent("activity-analytics",{},"<p>BRIEF</p>")',ctx('planning')) as string;
  assert.ok(other.indexOf('ACT-X')<other.indexOf('BRIEF'),'planning pages keep the role context first');
});

test('F55 Accountability shows one block per owner (assigned owner, else accountable role) with every register group kept',()=>{
  const g=(owner:string,register:string,count:number,overdue:number|null,known:number)=>({key:owner+'|'+register+'|active_control',owner,register,state:'active_control',count,overdueRecordCount:overdue,knownOverdueRecordCount:known,earliestDueIso:null,worstOverdueDays:null,topPriority:'high'});
  const ownerGroups=[g('Design Manager','delivery-design',5,2,2),g('Procurement Manager','procurement-packages',3,1,1),g('Design Manager','delivery-quality',4,null,1),g('design manager','notices-claims',1,0,0)];
  const html=runInNewContext(functions(['accountabilityOwnerGroups','accountabilityCount'])+';accountabilityOwnerGroups(data)',{
    data:{ownerGroups},fmt:String,escapeHtml,humanizeKey:String,planningShortDate:String,names:{}
  }) as string;
  const blocks=html.match(/<tbody class="accountability-owner-block">/g)||[];
  assert.equal(blocks.length,2,'one block per owner (before: one row per owner/register pair, owner repeated)');
  assert.match(html,/2 owners/);
  assert.match(html,/Design Manager · 10 records · overdue Not established<br><small>3 confirmed overdue/,'unknown overdue stays unknown; known subset shown');
  assert.match(html,/Procurement Manager · 3 records · overdue 1/);
  assert.equal((html.match(/Open all members/g)||[]).length,4,'every register group and its member button kept');
});
