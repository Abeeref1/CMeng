import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {pageProjectResponse,recordDetailPage} from '../packages/runtime-api/src/response-paging';
import {activityRegisterView} from '../packages/runtime-api/src/activity-register-page';

const script=[...cmengUatHtml().matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]!).join('\n');
const pick=(name:string)=>{
  const start=script.indexOf('function '+name+'(');
  assert.ok(start>=0,'browser function missing: '+name);
  const end=script.indexOf('\n}\n',start);
  return script.slice(start,end+2);
};
const helpers=()=>'let responsePopulationRoot=null,responsePopulationIndex=new WeakMap(),responseRowPopulationIndex=new WeakMap();\n'+
  ['indexResponsePopulations','responseListPopulation','listTotal','knownScreenCount','screenCountText'].map(pick).join('\n');

test('T05: listTotal is the true source total; cut-preview subsets are unknown, never the page size',()=>{
  const preview=Array.from({length:25},(_,i)=>({id:'S'+i,kind:i<22?'missing_information':'data_quality'}));
  const complete=[{id:'A',kind:'x'},{id:'B',kind:'y'}];
  const ids=Array.from({length:25},(_,i)=>'ACT-'+i);
  const result={data:{sourceIssues:preview,rows:complete,group:{activityIds:ids}},responsePaging:{source:'/api/projects/P/management/source-quality',
    tables:[{pointer:'/data/sourceIssues',total:77,shown:25,kind:'array'},{pointer:'/data/group/activityIds',total:8900,shown:25,kind:'array'}]}};
  const api=runInNewContext(helpers()+';({listTotal,screenCountText})',{currentModuleResult:result,fmt:String}) as any;
  assert.equal(api.listTotal(result.data.sourceIssues),77,'25 rows sent of 77 shows 77');
  assert.equal(api.listTotal(result.data.group.activityIds),8900);
  assert.equal(api.listTotal(result.data.rows),2,'an uncut list keeps its own length');
  assert.equal(api.listTotal(complete.filter(r=>r.kind==='x')),1,'a subset of a complete list keeps its own count');
  assert.equal(api.listTotal(preview.filter(r=>r.kind==='data_quality')),null,'a subset of a cut preview is unknown, not 3');
  assert.equal(api.listTotal(undefined),null,'an absent list is unknown, not 0');
  assert.equal(api.screenCountText(api.listTotal(undefined)),'Not established');
});

test('T05/N12: source-quality tiles and group counts use the true totals and add up to the page total',()=>{
  const issues=Array.from({length:25},(_,i)=>({kind:i<22?'missing_information':'data_quality',summary:'s',detail:'d',action:'a',moduleKeys:['m'],sourceRefs:[]}));
  const data={sourceIssues:issues,systemFailures:[],reviewActions:[],pendingChecks:[],documents:[],
    issueAssessment:{counts:{source_conflict:0,data_quality:3,missing_information:74,system_defect:0,comparison_difference:0,governance_review:0,verification_pending:0}}};
  const result={key:'source-quality',data,responsePaging:{source:'/api/projects/P/management/source-quality',tables:[{pointer:'/data/sourceIssues',total:77,shown:25,kind:'array'}]}};
  const code=helpers()+'\n'+pick('sourceIssueKindTotal')+'\n'+pick('renderSourceQuality')+';renderSourceQuality(data)';
  const html=runInNewContext(code,{currentModuleResult:result,data,fmt:String,escapeHtml:String,names:{},
    readerIssue:(i:any)=>({title:i.summary,action:i.action,owner:'o',assignTo:'o'}),managementModuleLink:()=>'',
    managementPanel:(t:string,_d:string,b:string)=>'<section>'+t+b+'</section>',
    experienceDisclosure:(t:string,b:string,n='')=>'<details><summary>'+t+' '+n+'</summary>'+b+'</details>',
    renderProjectActionList:()=>'',basisTable:()=>''}) as string;
  assert.match(html,/Information items<b>77<\/b>/,'tile shows 77, not the 25 rows sent');
  assert.match(html,/Information to provide 74 items/);
  assert.match(html,/Records to correct 3 items/);
  assert.match(html,/Records that disagree 0 items/);
  assert.match(html,/Showing 22 of 74 items/,'rows shown and true total are both stated');
  assert.doesNotMatch(html,/22 items|Information items<b>25<\/b>/);
});

test('T05: Activity Review page view never counts the 25 transported analysis rows as the population',()=>{
  const rows=Array.from({length:240},(_,i)=>({activityId:'A'+i,name:'n',activityType:'task',status:'not_started',criticality:'noncritical',totalFloatHours:i,finishVarianceDays:0}));
  const page=pageProjectResponse({key:'activity-analytics',data:activityRegisterView({projectionKey:'activity_analytics',rows})},
    '/api/projects/P/schedule/modules/activity-analytics?view=page') as any;
  assert.equal(page.data.analysisRows.length,25,'transport preview');
  assert.equal(page.data.activitySummary.executionCount,240);
  assert.ok(script.includes(`const executionTotal=p.activitySummary?.executionCount??(listTotal(allRows)===allRows.length?executionRows.length:null);`));
  assert.ok(script.includes(`<b id="activityFilterCount">Showing '+(ranked.length?1:0)+'–'+fmt(ranked.length)+' of '+screenCountText(executionTotal)+' execution activities</b>`));
  assert.ok(!script.includes(`<b id="activityFilterCount">'+fmt(executionRows.length)+' of '+fmt(executionRows.length)`),'no "25 of 25" from the preview');
});

test('T05: count captions on every affected screen read the true total, while "Showing X" keeps rows shown',()=>{
  for(const site of [
    `screenCountText(listTotal(r.activityIds))`,
    `'of '+screenCountText(listTotal(f.rows||[]))+' BOQ item rows'`,
    `screenCountText(listTotal(all))+" maximum rows inspected"`,
    `' representatives of '+escapeHtml(screenCountText(listTotal(all)))`,
    `Showing '+fmt(Math.min(30,backlogRows.length))+' of '+screenCountText(backlogCount)+' overdue activities.`,
    `' of '+screenCountText(sourceTotal)+' float review records.`,
    `fmt(listTotal(row.activityIds)-5))+' more'`,
    `fmt(listTotal(group.activityIds)-8))+' more'`,
    `screenCountText(listTotal(i.sourceRefs||[]))+' references · '+screenCountText(listTotal(i.moduleKeys))+' affected pages`,
    `const count=data.recordCount??listTotal(rows);`,
    `screenCountText(listTotal(p.series))+" source partitions"`,
  ])assert.ok(script.includes(site),site);
  assert.ok(!script.includes(`fmt(all.length)+" maximum rows inspected"`));
  assert.ok(!script.includes(`'+fmt(r.activityIds.length)+'</td>`));
  assert.ok(script.includes(`Showing '+fmt(p.events.length)+' of '+fmt(responseListPopulation(p.events).total)`),'preview captions keep the shown count');
});

test('T05 double paging: a requested 50-row object page is not cut to 25 by the transport',()=>{
  const source={data:{register:Object.fromEntries(Array.from({length:120},(_,i)=>['F'+i,i]))}};
  const page=recordDetailPage(source,'/data/register',0,50) as any;
  assert.equal(page.rows.length,50);assert.equal(page.total,120);assert.equal(page.hasMore,true);
  const http=pageProjectResponse({...page,pageSize:50,projectVersion:1},'/api/projects/P/schedule/modules/x') as any;
  assert.equal(http.rows.length,50,'the next page starts at offset 50, so all 50 rows must arrive');
  assert.equal(http.total,120);
  const arrayPage=recordDetailPage({data:{rows:Array.from({length:90},(_,i)=>({id:i}))}},'/data/rows',0,50) as any;
  assert.equal((pageProjectResponse({...arrayPage,pageSize:50},'/api/projects/P/schedule/modules/x') as any).rows.length,50);
});
