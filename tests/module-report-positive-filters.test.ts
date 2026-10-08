import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {preparedModuleResult} from '../packages/runtime-api/src/module-report';

test('positive report searches preserve the selected records and their evidence',()=>{
  for(let i=0;i<40;i++){
    const id=randomBytes(10).toString('hex');
    const selected={activityId:'A-'+id,name:'Selected '+id,totalFloatHours:0,
      sourceRefs:['source-'+randomBytes(10).toString('hex')],
      evidenceRefs:[{sourceId:'drawing-'+randomBytes(10).toString('hex'),locator:'Page '+(i+1)}],
      diagnostics:['Source calendar requires confirmation'],
      dependencies:[{key:'calendar',status:'partial'}],
      predecessorIds:['PREDECESSOR'],successorIds:['SUCCESSOR'],links:{activityIds:['LINKED']},
      receipts:[{id:'receipt-'+i,status:'retained'}]};
    const reportingContract={populations:{activities:{denominator:2,excluded:[{id:'UNKNOWN',reason:'date_missing'}]}},metricContracts:{float:{state:'partial',sourceRefs:['schedule-source']}}};
    const result={key:'near-critical',status:'partial' as const,reason:'Calendar incomplete',dependencies:[],
      data:{rows:[selected,{activityId:'B',name:'Excluded',totalFloatHours:8,sourceRefs:['other-source']}],reportingContract}};
    const before=JSON.stringify(result);
    const filtered=preparedModuleResult(result,{filters:{search:id}});
    assert.deepEqual((filtered.data as any).rows,[selected],'A selected fact must retain its full source and qualification evidence');
    assert.deepEqual((filtered.data as any).reportingContract,reportingContract,'Search must not erase population exclusions or metric authority');
    assert.equal(JSON.stringify(result),before,'Preparing a filtered report must not mutate the live result');
  }
});

test('zero-float report filters require a known numeric zero',()=>{
  const rows=[{activityId:'zero',totalFloatHours:0},{activityId:'text-zero',totalFloatHours:'0'},
    {activityId:'negative',totalFloatHours:-8},{activityId:'positive',totalFloatHours:8},
    {activityId:'null',totalFloatHours:null},{activityId:'absent'},
    {activityId:'empty',totalFloatHours:''},{activityId:'blank',totalFloatHours:' '},
    {activityId:'invalid',totalFloatHours:'unknown'}];
  const result={key:'near-critical',status:'partial' as const,reason:null,dependencies:[],data:{rows}};
  const zero=preparedModuleResult(result,{filters:{scheduleCondition:'zero_float'}});
  assert.deepEqual((zero.data as any).rows.map((row:any)=>row.activityId),['zero','text-zero']);
  const negative=preparedModuleResult(result,{filters:{scheduleCondition:'negative_float'}});
  assert.deepEqual((negative.data as any).rows.map((row:any)=>row.activityId),['negative']);
});
