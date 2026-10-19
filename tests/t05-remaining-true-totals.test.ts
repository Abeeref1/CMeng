import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {pageProjectResponse} from '../packages/runtime-api/src/response-paging';
import {activityRegisterView} from '../packages/runtime-api/src/activity-register-page';

const script=[...cmengUatHtml().matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]!).join('\n');
const pick=(name:string)=>{
  const start=script.indexOf('function '+name+'(');
  assert.ok(start>=0,'browser function missing: '+name);
  const end=script.indexOf('\n}\n',start);
  return script.slice(start,end+2);
};
const one=(name:string)=>{
  const start=script.indexOf('function '+name+'(');
  assert.ok(start>=0,'browser function missing: '+name);
  return script.slice(start,script.indexOf('\n',start));
};
const helpers=()=>'let responsePopulationRoot=null,responsePopulationIndex=new WeakMap(),responseRowPopulationIndex=new WeakMap();const rootListTotalIndex=new WeakMap();\n'+
  ['indexResponsePopulations','responseListPopulation','listTotal','responseListTotalIn','actionListTotal'].map(pick).join('\n')+'\n'+
  ['knownScreenCount','screenCountText','actionShownOf'].map(one).join('\n');

test('T05/N1: Activity Review largest finish movements are ranked by the server over every activity, not the 25 rows sent',()=>{
  // The 5 largest movements sit at the END of the source order, outside the 25-row preview.
  const rows=Array.from({length:240},(_,i)=>({activityId:'A'+String(i).padStart(3,'0'),name:'n'+i,activityType:'task',status:'not_started',
    criticality:'noncritical',totalFloatHours:0,finishVarianceDays:i>=235?1000+i:i%7}));
  const page=pageProjectResponse({key:'activity-analytics',data:activityRegisterView({projectionKey:'activity_analytics',rows})},
    '/api/projects/P/schedule/modules/activity-analytics?view=page') as any;
  assert.equal(page.data.analysisRows.length,25,'only a preview of the rows is sent');
  const ranked=page.data.activitySummary.largestFinishMovements;
  assert.deepEqual(ranked.map((r:any)=>r.activityId),['A239','A238','A237','A236','A235']);
  assert.deepEqual(ranked.map((r:any)=>r.finishVarianceDays),[1239,1238,1237,1236,1235]);
  // The screen draws the server ranking; without it a cut preview is not drawn as the whole list.
  assert.ok(script.includes('const serverLate=p.activitySummary?.largestFinishMovements;'));
  const draw=runInNewContext(pick('renderMovementConcentration')+';renderMovementConcentration(null,null)',{}) as string;
  assert.match(draw,/Largest finish movements: Not established/);
  assert.doesNotMatch(draw,/No comparable movement/,'unknown is not shown as none');
});

test('T05/N1: findings and recorded locations inside each action show the retained total, not the 25 sent',()=>{
  const evidence=Array.from({length:25},(_,i)=>'Finding '+i);
  const findings=Array.from({length:25},(_,i)=>({code:'c'+i,summary:'Finding '+i,detail:'d'+i,moduleKeys:['m'],sourceRefs:[]}));
  const pages=['a','b','c'];
  const data={actions:[{id:'X',evidenceSummary:evidence,findings,affectedPages:pages}],
    responsePaging:{source:'/api/projects/P/actions',tables:[
      {pointer:'/actions/0/evidenceSummary',total:80,shown:25,kind:'array'},
      {pointer:'/actions/0/findings',total:64,shown:25,kind:'array'}]}};
  const api=runInNewContext(helpers()+'\n'+pick('reviewEvidenceHtml')+';({actionListTotal,reviewEvidenceHtml})',
    {projectActionState:{data},currentModuleResult:null,fmt:String,escapeHtml:String}) as any;
  const a=data.actions[0]!;
  assert.equal(api.actionListTotal(a.evidenceSummary),80);
  assert.equal(api.actionListTotal(a.findings),64);
  assert.equal(api.actionListTotal(a.affectedPages),3,'an uncut list keeps its own length');
  const html=api.reviewEvidenceHtml(a) as string;
  assert.match(html,/See 25 of 80 findings/);
  assert.doesNotMatch(html,/See all 25 findings/,'25 sent is never shown as all findings');
  assert.ok(script.includes(`'Open '+actionShownOf(a.correctionRecords,'recorded locations')`),'recorded locations use the retained total');
  assert.ok(script.includes(`'<small>Affects '+screenCountText(actionListTotal(a.affectedPages))+' view'`));
  assert.ok(!script.includes(`'<small>Affects '+fmt(a.affectedPages.length)`));
  assert.ok(!script.includes(`'Open all '+fmt(a.correctionRecords.length)+' recorded locations</summary>`));
});

test('T05/N1: dashboard priority actions and command-centre action captions count the full register',()=>{
  const actions=Array.from({length:25},(_,i)=>({issue:'Issue '+i,requiredAction:'Do '+i,affectedScope:['S'+i],severity:'high',owner:'O'}));
  const data={actions};
  const result={key:'master-dashboard',data,responsePaging:{source:'/api/projects/P/management/master-dashboard',tables:[{pointer:'/data/actions',total:140,shown:25,kind:'array'}]}};
  const html=runInNewContext(helpers()+'\n'+pick('renderDashboardExceptions')+';renderDashboardExceptions(data)',{currentModuleResult:result,data,fmt:String,escapeHtml:String,
    managementPanel:(t:string,d:string,b:string)=>'<section>'+t+' '+d+b+'</section>',basisTable:()=>'<table></table>',readerText:String,
    sourceWorkingFloatField:()=>'',actionDeadlineText:()=>'',managementModuleLink:(_k:string,label:string)=>'<a>'+label+'</a>'}) as string;
  assert.match(html,/140 actions in the shared register/);
  assert.match(html,/Open all 140 project actions/);
  assert.doesNotMatch(html,/25 actions in the shared register/);
  const total=runInNewContext(helpers()+'\n'+pick('commandActionTotal')+';[commandActionTotal(data,data.actions.map(a=>({...a}))),commandActionTotal({alerts:data.actions},[1,2]),commandActionTotal({decisions:[{d:1}]},[1])]',
    {currentModuleResult:result,data}) as any;
  assert.equal(total[0],140,'canonical list: retained server total');
  assert.equal(total[1],null,'fallback merged from a cut register: unknown, not the merged length');
  assert.equal(total[2],1,'fallback from complete registers: its own length');
  assert.ok(script.includes(`Showing '+fmt(Math.min(30,actions.length))+' of '+screenCountText(commandActionTotal(data,actions))+' distinct current actions.`));
});

test('T05/N1: completion position counts qualifications and difference rows by their retained totals',()=>{
  assert.ok(script.includes(`(limits.length?' · '+screenCountText(limitTotal)+' qualifications':'')`));
  assert.ok(!script.includes(`(limits.length?' · '+fmt(limits.length)+' qualifications':'')`));
  assert.ok(script.includes(`screenCountText(p.comparableActivityCount)+' comparable activities.`));
});
