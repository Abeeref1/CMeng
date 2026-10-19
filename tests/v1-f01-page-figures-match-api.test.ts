import {runInNewContext} from './browser-context';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {moduleRegistry} from '../packages/runtime-api/src/registry';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';

// F01 (N-8): what each page SHOWS is checked against the API answer key of the
// same project. The page figures come from the real assembled browser script
// (experienceBrief and pageRoleLensContext), fed with each page's API result;
// the answer key is the project's shared facts snapshot. A page/API mismatch
// on a main figure fails here.
const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
function functions(names:string[]){
  const selected=source.statements.filter(isFunctionDeclaration).filter(n=>n.name&&names.includes(n.name.text));
  assert.equal(selected.length,names.length,'all called helpers must exist in the assembled browser script');
  return selected.map(n=>n.getText(source)).join('\n');
}
const common={apiKeys:{},fmt:String,fmtExecutive:String,humanizeKey:String,planningShortDate:(s:unknown)=>s==null?'Not available':String(s),
  planningRevisionLabel:String,currentModuleResult:null,escapeHtml:String};
const briefScript=functions(['aggregateCount','experienceRecordCount','experienceBrief','experienceValue','findProjectionRoot','fmtForField']);
const lensScript=functions(['pageRoleLensContext','findProjectionRoot']);

function fixture(){
  const projectId='V1-F01-PAGE-API';
  const state:any=runtimeProjects.getOrCreate(projectId);
  const N=90;
  const activities=Array.from({length:N},(_,i)=>({projectId,activityId:'F01-'+i,nativeId:String(i),name:'Zone '+Math.floor(i/30),
   wbsId:'AW'+Math.floor(i/30),calendarId:'C'+i%2,activityType:'task',status:i<10?'completed':'not_started',
   baselineStartIso:'2031-01-01',baselineFinishIso:'2031-02-01',currentStartIso:'2031-01-01',currentFinishIso:'2031-03-01',
   actualStartIso:i<10?'2031-01-01':null,actualFinishIso:i<10?'2031-02-01':null,forecastStartIso:null,forecastFinishIso:null,
   originalDurationHours:24,remainingDurationHours:i<10?0:24,totalFloatHours:i%11===0?-8:i%7,freeFloatHours:null,
   percentComplete:i<10?100:0,sourceRefs:[],diagnostics:[]}));
  const relationships:any[]=[];
  for(let i=1;i<N;i++)if(i%30!==0)relationships.push({relationshipId:'R'+i,predecessorActivityId:activities[i-1]!.activityId,
   successorActivityId:activities[i]!.activityId,type:'FS',lagHours:0,sourceRefs:[],diagnostics:[]});
  for(let revision=0;revision<2;revision++){
    const revisionId='F01-REV-'+revision;
    const model:any={projectId,source:'xer',sourceRevisionId:revisionId,dataDateIso:'2031-04-0'+(revision+1),activities,relationships,
     wbs:[0,1,2].map(i=>({wbsId:'AW'+i,name:'Area '+i,parentWbsId:null,sourceRefs:[]})),
     calendars:[0,1].map(i=>({...ELAPSED_24H_CALENDAR,calendarId:'C'+i})),diagnostics:[]};
    state.schedules.push({role:revision?'update':'baseline',format:'xer',sourceFilename:revisionId+'.xer',sourceHashSha256:revisionId,
     uploadedAt:model.dataDateIso,revision:{revisionId,label:revisionId,sequence:revision+1,effectiveAt:model.dataDateIso,model}});
  }
  state.testProject=true;
  runtimeProjects.touch(state);
  return projectId;
}

test('F01: every page shows the same main figures as the API answer key for the project',()=>{
  const projectId=fixture();
  const facts=projectFactsForState(runtimeProjects.getOrCreate(projectId));
  const answer:Record<string,unknown>={
    'Critical activities':facts.schedule.criticalActivityCount.value,
    'Near-critical activities':facts.schedule.nearCriticalActivityCount.value,
    'Negative-float activities':facts.schedule.negativeFloatActivityCount.value,
    'Open actions':facts.actions.openCount.value,
  };
  assert.equal(typeof answer['Critical activities'],'number','the answer key has an established critical count');
  const mismatches:string[]=[];let compared=0;
  for(const {key} of moduleRegistry){
    const data=moduleForProject(projectId,key).data as any;
    if(!data)continue;
    const brief=runInNewContext(briefScript+';experienceBrief(key,data)',{...common,key,data}) as any;
    for(const fact of brief?.facts??[]){
      if(!(fact.label in answer))continue;
      compared++;
      if(fact.value!==answer[fact.label])mismatches.push(key+' brief "'+fact.label+'": page '+fact.value+' API '+answer[fact.label]);
    }
    if(!(data.projectFacts||data.result?.projectFacts))continue;
    const lens=runInNewContext(lensScript+';pageRoleLensContext(data)',{...common,data,overview:null}) as any;
    const shown:Record<string,unknown>={'Critical activities':lens.planning?.criticalCount,'Near-critical activities':lens.planning?.nearCriticalCount,
      'Negative-float activities':lens.planning?.negativeFloatCount,'Open actions':lens.projectDirector?.openActionCount};
    for(const [label,value] of Object.entries(shown)){
      compared++;
      if(value!==answer[label])mismatches.push(key+' role view "'+label+'": page '+value+' API '+answer[label]);
    }
    for(const metric of lens.executive?.metrics??[]){
      if(!(metric.label in answer))continue;
      compared++;
      if(metric.value!==answer[metric.label])mismatches.push(key+' executive "'+metric.label+'": page '+metric.value+' API '+answer[metric.label]);
    }
  }
  assert.ok(compared>=20,'the main figures are compared on many pages ('+compared+')');
  assert.deepEqual(mismatches,[],'page figures equal the API answer key');
});

// F01 widened: dates and money. The certified demo project carries a contract
// value, certificates, payments and programme dates. Every page function that
// shows a completion date, contract value, EAC or cash received must show the
// API answer key's value for the same project (currencies never mixed).
test('F01: completion dates and money shown on every page equal the API answer key',async()=>{
  const {loadCertifiedDemoProject}=await import('../packages/runtime-api/src/demo-project');
  const projectId='V1-F01-DATES-MONEY';
  loadCertifiedDemoProject(projectId);
  const facts=projectFactsForState(runtimeProjects.getOrCreate(projectId));
  const raw=(x:any)=>x&&typeof x==='object'&&'value' in x?x.value:x;
  const day=(x:unknown)=>typeof x==='string'?x.slice(0,10):x;
  const dates:Record<string,unknown>={
    'Submitted completion':day(facts.schedule.submittedProgrammeCompletionIso.value),
    'Contract completion':day(facts.time.contractualCompletionIso.value),
    'Recorded contractual completion':day(facts.time.contractualCompletionIso.value),
  };
  const byCurrency=new Map(facts.commercial.currencies.map(row=>[row.currency,row]));
  assert.ok(byCurrency.size>0,'the answer key has a currency position');
  const money=(label:string,currency:string):unknown=>{
    const row=byCurrency.get(currency);if(!row)return undefined;
    return label==='Original contract value'?row.originalContractValue.value:label==='Current contract value'?row.currentContractValue.value:
      label==='Forecast at completion'?row.forecastEac?.value??null:label==='Cash received'?row.paidAmount.value:undefined;
  };
  const mismatches:string[]=[];let compared=0;
  const check=(where:string,label:string,shown:unknown,expected:unknown)=>{
    if(expected===undefined)return;
    compared++;
    if(shown!==expected)mismatches.push(where+' "'+label+'": page '+JSON.stringify(shown)+' API '+JSON.stringify(expected));
  };
  for(const {key} of moduleRegistry){
    const data=moduleForProject(projectId,key).data as any;
    if(!data)continue;
    const brief=runInNewContext(briefScript+';experienceBrief(key,data)',{...common,key,data}) as any;
    for(const fact of brief?.facts??[]){
      if(fact.label in dates)check(key+' brief',fact.label,day(raw(fact.value)),dates[fact.label]);
      else if(fact.unit&&byCurrency.has(fact.unit))check(key+' brief',fact.label+' · '+fact.unit,raw(fact.value),money(fact.label,fact.unit));
    }
    if(!(data.projectFacts||data.result?.projectFacts))continue;
    const lens=runInNewContext(lensScript+';pageRoleLensContext(data)',{...common,data,overview:null}) as any;
    for(const metric of lens.executive?.metrics??[]){
      if(metric.label in dates){check(key+' executive',metric.label,day(metric.value),dates[metric.label]);continue;}
      const [label,currency]=String(metric.label).split(' · ');
      if(currency&&byCurrency.has(currency))check(key+' executive',metric.label,metric.value,money(label!,currency));
    }
    check(key+' role view','Submitted completion',day(lens.controls?.submittedCompletionIso),dates['Submitted completion']);
    // Cost and contract comparison panel (commercial basis review): the same
    // current contract value, and the source EAC where one position exists.
    const reviews=(data.position?.costBasisReview??[]).filter((r:any)=>!data.position?.sourceLedger?.dataDateIso||r.asOf<=data.position.sourceLedger.dataDateIso);
    for(const r of reviews){
      if(!byCurrency.has(r.currency))continue;
      check(key+' cost comparison','Current contract value · '+r.currency,r.currentContractValue,money('Current contract value',r.currency));
      if(reviews.filter((x:any)=>x.currency===r.currency).length===1&&r.sourceEac!=null)
        check(key+' cost comparison','Source EAC · '+r.currency,r.sourceEac,money('Forecast at completion',r.currency));
    }
  }
  assert.ok(compared>=20,'dates and money are compared on many pages ('+compared+')');
  assert.deepEqual(mismatches,[],'page dates and money equal the API answer key');
});
