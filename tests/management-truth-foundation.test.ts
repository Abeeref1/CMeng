import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bestAvailableFact,
  diagnosticBusinessLabel,
  establishedPopulationCount,
  featureAvailability,
  managementAction,
  managementFactView,
  populationCanAssertZero,
  populationAuthority,
  type ManagementFactView,
  type PopulationAuthority,
} from '../packages/truth-kernel/src';
import {scheduleLongLeadEvidence} from '../packages/runtime-api/src/management-context';

const pop=(state:PopulationAuthority['state']):PopulationAuthority=>({
  state,sourceCount:null,applicableCount:null,currentCount:null,excludedCount:null,coveragePercent:null,basis:'test'
});

test('population zero is only authoritative for an established population',()=>{
  assert.equal(populationCanAssertZero(pop('established')),true);
  for(const state of ['partial','source_only','candidate','missing','not_applicable','quarantined','conflicted'] as const)
    assert.equal(populationCanAssertZero(pop(state)),false,state);
  assert.equal(establishedPopulationCount(0,pop('established')),0);
  assert.equal(establishedPopulationCount(0,pop('source_only')),null);
});

test('shared population authority keeps source, applicable, current, exclusions and bounded coverage together',()=>{
  const p=populationAuthority({state:'partial',sourceCount:12,applicableCount:10,currentCount:7,excludedCount:2,coveragePercent:116,basis:'controlled test'});
  assert.deepEqual(p,{state:'partial',sourceCount:12,applicableCount:10,currentCount:7,excludedCount:2,coveragePercent:100,basis:'controlled test'});
  assert.equal(populationAuthority({state:'missing',sourceCount:-1,basis:'missing'}).sourceCount,null);
});

test('best available fact prefers usable higher-authority evidence without erasing qualified evidence',()=>{
  const facts:ManagementFactView<number>[]=[
    managementFactView<number>({key:'gap',label:'Gap',value:null,state:'missing',authority:'none',basis:'missing',coverage:{known:0,total:1}}),
    managementFactView<number>({key:'candidate',label:'Candidate',value:49,state:'candidate',authority:'candidate',basis:'schedule WBS',limitation:'Procurement status not established',coverage:{known:49,total:49},dataDateIso:'2030-01-31',diagnostics:['QUALIFIED_SCOPE'],population:pop('candidate')}),
    managementFactView<number>({key:'source',label:'Source',value:12,state:'partial',authority:'source',basis:'source rows',limitation:'Population incomplete',coverage:{known:12,total:20},dataDateIso:'2030-01-31',population:pop('partial')}),
  ];
  assert.equal(bestAvailableFact(facts)?.key,'source');
  assert.equal(bestAvailableFact([facts[0]!,facts[1]!])?.value,49);
  const candidate=bestAvailableFact([facts[0]!,facts[1]!] as const)!;
  assert.equal(candidate.dataDateIso,'2030-01-31');
  assert.equal(candidate.population?.state,'candidate');
  assert.deepEqual(candidate.diagnostics,['QUALIFIED_SCOPE']);
});

test('management fact contract carries every Task 01 authority field',()=>{
  const view=managementFactView({
    key:'progress',label:'Progress',value:42,state:'partial',authority:'source',basis:'reported progress',
    coverage:{known:42,total:50},dataDateIso:'2030-01-31',diagnostics:['PARTIAL_SCOPE'],population:pop('partial'),
  });
  assert.equal(view.value,42);assert.equal(view.state,'partial');assert.equal(view.authority,'source');
  assert.deepEqual(view.coverage,{known:42,total:50});assert.equal(view.dataDateIso,'2030-01-31');
  assert.deepEqual(view.diagnostics,['PARTIAL_SCOPE']);assert.equal(view.population?.state,'partial');
  assert.ok(Array.isArray(view.receipts));
});

test('feature availability distinguishes evidence-only from active and blocked',()=>{
  assert.equal(featureAvailability({hasEstablishedResult:true}),'active');
  assert.equal(featureAvailability({hasUsefulEvidence:true,prerequisitesSatisfied:false}),'evidence_only');
  assert.equal(featureAvailability({hasUsefulEvidence:true}),'useful_partial');
  assert.equal(featureAvailability({applicable:false}),'not_applicable');
  assert.equal(featureAvailability({}),'blocked');
});

test('management actions deduplicate scope, milestones and source references',()=>{
  const action=managementAction({
    actionId:'A1',issue:'Late package',consequence:'Milestone threat',
    affectedScope:['Zone 1','Zone 1'],affectedMilestones:['M1','M1'],owner:null,organisation:null,
    requiredAction:'Expedite',dueIso:null,escalation:null,severity:'high',authority:'source',sourceRefs:['R1','R1']
  });
  assert.deepEqual(action.affectedScope,['Zone 1']);
  assert.deepEqual(action.affectedMilestones,['M1']);
  assert.deepEqual(action.sourceRefs,['R1']);
  assert.equal(action.confidence,null);
  assert.equal(managementAction({...action,confidence:'high'}).confidence,'high');
});

test('diagnostic labels expose management language rather than raw codes',()=>{
  assert.match(diagnosticBusinessLabel('SCHEDULE_GRAPH_CYCLES:A1'),/circular relationship/i);
  assert.equal(diagnosticBusinessLabel('UNKNOWN_INTERNAL_CODE:X'),'Additional calculation qualification');
});

test('schedule long-lead evidence is reusable outside the schedule module',()=>{
  const model:any={
    projectId:'P',sourceRevisionId:'R1',dataDateIso:'2030-01-01',
    wbs:[
      {wbsId:'W0',parentWbsId:null,name:'Project'},
      {wbsId:'W1',parentWbsId:'W0',name:'Long Lead Materials'},
      {wbsId:'W2',parentWbsId:'W0',name:'Civil Works'},
    ],
    activities:[
      {activityId:'A1',activityType:'task',name:'Transformer procurement',wbsId:'W1',currentStartIso:'2030-01-02',currentFinishIso:'2030-03-01',totalFloatHours:8,percentComplete:0},
      {activityId:'A2',activityType:'task',name:'Excavate trench',wbsId:'W2',currentStartIso:'2030-01-02',currentFinishIso:'2030-01-20',totalFloatHours:40,percentComplete:0},
    ],
    relationships:[],
  };
  const rows=scheduleLongLeadEvidence(model);
  assert.deepEqual(rows.map(row=>row.activityId),['A1']);
  assert.match(rows[0]!.wbsPath??'',/Long Lead Materials/);
});
