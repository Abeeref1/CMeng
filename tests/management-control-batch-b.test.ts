import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';

import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {programmeControlStages} from '../packages/runtime-api/src/management-context';

const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
function functions(names:string[]){
  return source.statements.filter(isFunctionDeclaration).filter(node=>node.name&&names.includes(node.name.text)).map(node=>node.getText(source)).join('\n');
}

test('Master Dashboard uses schedule WBS long-lead evidence instead of an unestablished zero',()=>{
  const data:any={
    metrics:[
      {key:'contract-finish',value:'2030-06-30'},
      {key:'submitted-programme-finish',value:'2030-06-30'},
      {key:'independent-forecast-finish',value:null},
      {key:'submitted-vs-contract',value:0},
      {key:'independent-vs-contract',value:null},
      {key:'progress-position',value:null},
      {key:'schedule-spi',value:null},
    ],
    visualControl:{
      progress:{scopeComparison:null,progressBases:null},
      commercial:{positions:[],cost:[]},
      sourceInventory:{domains:[]},
      claims:{},
      boqScope:{candidateLongLeadCount:49,boqCandidateLongLeadCount:null,scheduleCandidateLongLeadCount:49,candidatePackageCount:null,
        basis:'Schedule/WBS long-lead scope',topLongLead:[]}
    },
    delivery:{packagePopulationState:'not_established',confirmedPackageCount:0,knownPackageRecordCount:0,candidatePackageCount:null,candidateLongLeadCount:null,
      latePackageKnownCount:null,sourceAvailability:{}},
    operationalReporting:{counts:{}},sourceInterpretation:{hse:{metrics:{}}},variationReconciliation:[],
    reportingContract:{dataDateIso:'2026-09-14'}
  };
  const code=functions(['pmcDefined','pmcFirst','pmcMetric','pmcSource','pmcMoney','pmcDays','pmcCard','pmcSourceValue','renderPmcControlRoom']);
  const output=runInNewContext(code+';renderPmcControlRoom(data)',{
    data,fmtExecutive:String,fmt:String,planningShortDate:String,
    managementModuleLink:(_key:string,label:string)=>label,escapeHtml:(value:any)=>String(value??''),overview:{latestDataDateIso:'2026-09-14'}
  });
  assert.match(output,/49 schedule\/WBS long-lead candidates/);
  assert.doesNotMatch(output,/0 procurement source \/ scope items/);
  assert.match(output,/Control gaps/,'missing domains remain available as secondary gaps');
  assert.ok(output.indexOf('Procurement / Long Lead')<output.indexOf('Control gaps'),'available long-lead evidence must precede missing domains');
});

test('Task 11 Command Center keeps issue consequence scope owner action due and escalation as separate primary columns',()=>{
  assert.match(script,/<th>Priority<\/th><th>Issue<\/th><th>Consequence<\/th><th>Scope<\/th><th>Owner<\/th><th>Action<\/th><th>Due<\/th><th>Escalation<\/th>/);
});

test('management UI is action-first and MCP execution-first',()=>{
  assert.match(script,/Actions requiring management attention/);
  assert.match(script,/Issue & consequence/);
  assert.match(script,/Accountability action register/);
  assert.match(script,/Integrated programme control sequence/);
  assert.match(script,/Control authority & evidence matrix/);
  assert.match(script,/renderMcpProgrammeControl\(data\)[\s\S]*experienceDisclosure\("Control authority & evidence"/,
    'MCP branch must render execution control before supporting governance/evidence');
});

test('programme control stages derive an integrated execution sequence from programme evidence',()=>{
  const model:any={
    projectId:'P',sourceRevisionId:'R1',dataDateIso:'2030-01-01',relationships:[],
    wbs:[
      {wbsId:'D',parentWbsId:null,name:'Design'},
      {wbsId:'P',parentWbsId:null,name:'Long Lead Procurement'},
      {wbsId:'C',parentWbsId:null,name:'Civil Construction'},
      {wbsId:'T',parentWbsId:null,name:'Testing & Commissioning'},
      {wbsId:'H',parentWbsId:null,name:'Handover'},
    ],
    activities:[
      {activityId:'D1',activityType:'task',name:'Design approval',wbsId:'D',status:'in_progress',currentStartIso:'2030-01-01',currentFinishIso:'2030-02-01',forecastFinishIso:null,totalFloatHours:24},
      {activityId:'P1',activityType:'task',name:'Transformer procurement',wbsId:'P',status:'not_started',currentStartIso:'2030-02-01',currentFinishIso:'2030-05-01',forecastFinishIso:null,totalFloatHours:-8},
      {activityId:'C1',activityType:'task',name:'Civil construction',wbsId:'C',status:'not_started',currentStartIso:'2030-05-01',currentFinishIso:'2030-08-01',forecastFinishIso:null,totalFloatHours:0},
      {activityId:'T1',activityType:'task',name:'Testing and commissioning',wbsId:'T',status:'not_started',currentStartIso:'2030-08-01',currentFinishIso:'2030-09-01',forecastFinishIso:null,totalFloatHours:20},
      {activityId:'H1',activityType:'task',name:'Final handover',wbsId:'H',status:'not_started',currentStartIso:'2030-09-01',currentFinishIso:'2030-09-30',forecastFinishIso:null,totalFloatHours:40},
    ],
  };
  const stages=programmeControlStages(model);
  assert.deepEqual(stages.slice(0,5).map(row=>row.stage),['design','procurement','construction','testing_commissioning','handover']);
  const procurement=stages.find(row=>row.stage==='procurement')!;
  const construction=stages.find(row=>row.stage==='construction')!;
  assert.equal(procurement.criticalOrNegativeFloatCount,1);
  assert.equal(construction.criticalOrNegativeFloatCount,1);
  assert.deepEqual(procurement.wbsPaths,['Long Lead Procurement']);
  assert.deepEqual(construction.wbsPaths,['Civil Construction']);
  assert.equal(procurement.latestCurrentFinishIso,'2030-05-01');
  assert.equal(procurement.latestForecastFinishIso,null);
  assert.ok(Array.isArray(procurement.dependencyStages));
  assert.ok(Array.isArray(procurement.controlMilestoneIds));
});

test('Task 13 MCP renderer exposes package, dependency, current/forecast, float, readiness, owner and action controls',()=>{
  assert.match(script,/Work packages \/ WBS/);
  assert.match(script,/Control milestones/);
  assert.match(script,/Dependencies/);
  assert.match(script,/Current finish/);
  assert.match(script,/Forecast finish/);
  assert.match(script,/Readiness \/ long lead/);
  assert.match(script,/<th>Owner<\/th><th>Action<\/th>/);
});


test('Task 08 Dashboard ranks intervention before material/source information and gaps',()=>{
  const data:any={
    metrics:[
      {key:'contract-finish',value:'2030-06-30'},
      {key:'submitted-programme-finish',value:'2030-07-30'},
      {key:'submitted-vs-contract',value:30},
      {key:'independent-forecast-finish',value:null},
      {key:'independent-vs-contract',value:null},
      {key:'progress-position',value:null},
      {key:'schedule-spi',value:null},
    ],
    visualControl:{
      progress:{scopeComparison:null,progressBases:null},
      commercial:{positions:[],cost:[]},
      sourceInventory:{domains:[
        {domain:'risk',label:'Risk',documentCount:1,readableRowCount:12},
        {domain:'procurement',label:'Procurement',documentCount:1,readableRowCount:5,signals:{longLeadMarkedCount:2}},
      ]},
      claims:{},boqScope:{candidateLongLeadCount:2,boqCandidateLongLeadCount:null,scheduleCandidateLongLeadCount:null,candidatePackageCount:null,topLongLead:[]}
    },
    delivery:{packagePopulationState:'not_established',confirmedPackageCount:0,knownPackageRecordCount:0,candidatePackageCount:null,candidateLongLeadCount:null,
      latePackageKnownCount:null,sourceAvailability:{}},
    operationalReporting:{counts:{}},sourceInterpretation:{hse:{metrics:{}}},variationReconciliation:[],
    reportingContract:{dataDateIso:'2026-09-14'}
  };
  const code=functions(['pmcDefined','pmcFirst','pmcMetric','pmcSource','pmcMoney','pmcDays','pmcCard','pmcSourceValue','renderPmcControlRoom']);
  const output=runInNewContext(code+';renderPmcControlRoom(data)',{
    data,fmtExecutive:String,fmt:String,planningShortDate:String,
    managementModuleLink:(_key:string,label:string)=>label,escapeHtml:(value:any)=>String(value??''),overview:{latestDataDateIso:'2026-09-14'}
  });
  assert.ok(output.indexOf('>Time<')>=0);
  assert.ok(output.indexOf('>Time<')<output.indexOf('>Procurement / Long Lead<'),'schedule intervention must precede material exposure');
  assert.ok(output.indexOf('>Procurement / Long Lead<')<output.indexOf('>Risk<'),'material exposure must precede source-only risk information');
  assert.ok(output.indexOf('>Risk<')<output.indexOf('Control gaps'),'usable source information must precede gaps');
});
