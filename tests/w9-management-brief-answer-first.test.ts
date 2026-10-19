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

test('F30 a page links its missing-information items to the one shared list instead of repeating each one',()=>{
  const missing=(field:string,summary:string)=>({kind:'missing_information',code:'MISSING_FIELD',field,summary,detail:'',action:'Upload the source field',owner:'Project evidence owner',moduleKeys:['pmo-analysis'],evidencePaths:[],sourceRefs:[],checkIds:[]});
  const issues=[missing('contract.completionIso','Contract completion date'),missing('contract.completionIso','Contract completion date'),missing('position.dataDateIso','Data date'),
    {kind:'data_quality',code:'SOURCE_QUALITY',summary:'Duplicate activity IDs',detail:'',action:'Correct the programme',owner:'Project evidence owner',moduleKeys:[],evidencePaths:[],sourceRefs:[],checkIds:[]}];
  const html=runInNewContext(functions(['readerIssue','renderIssueAssessment','experienceDisclosure'])+';renderIssueAssessment({issues,counts:{}})',{
    apiKeys:{},fmt:String,escapeHtml,humanizeKey:String,planningShortDate:String,issues,issueBadge:(x:any)=>'<span class="badge">'+x.primaryKind+'</span>',names:{},issueLabel:String,currentModuleResult:null
  }) as string;
  const main=html.replace(/<details[\s\S]*?<\/details>/g,'');
  // Before: one "Information needed" row per finding (3 rows here, 342 across 29 pages in the review).
  assert.equal((main.match(/<span class="badge">missing_information<\/span>/g)||[]).length,1,'one linked row, not one row per finding');
  assert.match(main,/2 information items used by this page/,'counted once by raw field identity');
  assert.match(main,/onclick="openProjectActions\(\)"/,'linked to the shared Actions and Data gaps list');
  assert.match(html,/<summary>Items<\/summary>[^<]*Contract completion date[^<]*Data date/,'item names kept behind Items, each once');
  assert.equal((html.match(/Contract completion date/g)||[]).length,1,'a repeated item is named once');
  assert.match(main,/Duplicate activity IDs/,'other findings keep their own rows');
});

test('F30 the shared list shows each gap once with its upload or inline control',()=>{
  const a={id:'matter:risks',target:{type:'inline',kind:'contract-value'},missingFields:[
    {field:'Risk owner',file:'Risk register',owner:'Risk Manager',fieldIdentity:'risk.ownerName',supply:{type:'upload',documentType:'Risk register',field:'owner name',label:'Upload: Risk register',uploadHint:'Risk register with the owner name column or field',uploadMode:'evidence'}},
    {field:'Contract value',file:'Contract',owner:'Commercial Manager',fieldIdentity:'commercial.contractValue',supply:{type:'input',kind:'contract-value',label:'Enter the contract value and currency'}}]};
  const html=runInNewContext(functions(['actionGapsHtml'])+';actionGapsHtml(a)',{a,fmt:String,escapeHtml,programmePurposeOptions:()=>''}) as string;
  assert.equal((html.match(/Information needed/g)||[]).length,1,'one heading for the matter');
  assert.match(html,/Information needed · 2 fields/);
  assert.match(html,/Risk owner · Risk register · Risk Manager/);
  assert.match(html,/Risk register with the owner name column or field<input type="file" class="gap-upload-file"/,'upload names the document type and the field');
  assert.match(html,/data-resolve-gap-upload="matter:risks" data-gap-index="0">Upload: Risk register</);
  assert.match(html,/Supplied here: Enter the contract value and currency \(below\)/,'typable value points to the inline input of this matter');
  assert.doesNotMatch(html,/class="action-upload-file"/,'gap controls never take over the matter upload');
});
