import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {bindProjectFacts,projectFactConsumerMismatches} from '../packages/runtime-api/src/project-fact-consumers';
import {experienceScript} from '../packages/runtime-api/src/ui-experience';

const script=createSourceFile('experience.js',experienceScript,ScriptTarget.Latest,true);
const briefScript=script.statements.filter(isFunctionDeclaration).filter(n=>['experienceBrief','experienceValue'].includes(n.name?.text??'')).map(n=>n.getText(script)).join('\n');
const renderBrief=(key:string,data:any)=>runInNewContext(briefScript+';experienceBrief(key,data)',{
  key,data,findProjectionRoot:(d:any)=>d,fmt:String,fmtExecutive:String,planningShortDate:String,humanizeKey:String,
});

test('missing registers remain missing in shared facts instead of becoming measured zero',()=>{
  const state=runtimeProjects.getOrCreate('NO-REGISTER-'+randomUUID());
  const facts=projectFactsForState(state);
  for(const key of ['openRfiCount','overdueRfiCount','openRiskCount'] as const){
    assert.equal(facts.controls[key].value,null,key);
    assert.equal(facts.controls[key].state,'missing',key);
  }
});

test('ten fresh projects render the shared critical count and detect a changed display field even with an unchanged snapshot',()=>{
  for(let count=1;count<=10;count++){
    const state=loadCertifiedDemoProject('VISIBLE-FACTS-'+randomUUID());
    const template=state.schedules.at(-1)!.revision.model.activities.find(a=>a.status!=='completed')!;
    const model=state.schedules.at(-1)!.revision.model;
    model.activities=Array.from({length:count},(_,i)=>({...template,activityId:'C'+i,nativeId:String(i),totalFloatHours:-8}));
    model.relationships=[];state.version++;
    const facts=projectFactsForState(state);
    assert.equal(facts.schedule.criticalActivityCount.value,count);
    for(const key of ['pmo-analysis','schedule-analytics']){
      const old=key==='pmo-analysis'?{schedule:{criticalCount:999},forecast:{}}:{result:{float:{criticalCount:999}}};
      const page=bindProjectFacts(key,old,facts);
      assert.equal(projectFactConsumerMismatches(page).length,0);
      const shown=renderBrief(key,page).facts.find((f:any)=>f.label==='Critical activities');
      assert.equal(shown.value,count);assert.equal(shown.display,String(count));
      const path=key==='pmo-analysis'?page.schedule!:page.result!.float;
      path.criticalCount=999;
      assert.equal(projectFactConsumerMismatches(page).length,1,'the same snapshot must not hide wrong displayed values');
      assert.equal(facts.schedule.criticalActivityCount.value,count,'consumer edits cannot mutate the shared fact');
    }
  }
});

test('fact wiring leaves historical and filtered counts intact and updates only the explicitly equivalent current total',()=>{
  const facts=projectFactsForState(loadCertifiedDemoProject('HISTORICAL-FACTS-'+randomUUID()));
  const source={result:{float:{criticalCount:999}},points:[{criticalCount:71}],groups:[{criticalCount:3}]};
  const page=bindProjectFacts('schedule-analytics',source,facts);
  assert.equal(page.result.float.criticalCount,facts.schedule.criticalActivityCount.value);
  assert.equal(page.points[0]!.criticalCount,71);assert.equal(page.groups[0]!.criticalCount,3);
  assert.equal(source.result.float.criticalCount,999,'cached producer results remain unmodified');
});
