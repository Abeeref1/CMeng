import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCommercialFoundation} from '../packages/commercial-foundation/src';
import {buildCommercialPerformance} from '../packages/commercial-performance/src';

test('T07 six independent Decimal-oracle near-zero TCPI source money cases',()=>{
 const dataDateIso='2026-08-31',generatedAt='2026-10-15T00:00:00.000Z';
 const cases=[
  [36061.08,88462.46,36061.16,36061.20,655017.25,-1310034.5],
  [7069.4,41089.15,7069.43,7069.41,1133991.666667,1700987.5],
  [62621.46,20651.12,62621.47,62621.42,-4197034,-839406.8],
  [57720.03,60683.15,57719.97,57719.98,-49385.333333,-296312],
  [1,1.01,-19999,-19999.01,-0.000001,1],
  [10.01,9.99,10.01,10.01,null,null],
 ] as const;
 for(const [index,[bac,ev,ac,eac,budget,forecast]] of cases.entries()){
  const projectId='MONEY-ORACLE-'+index;
  const foundation=buildCommercialFoundation({projectId,generatedAt,dataDateIso,
   contractValue:null,contractValueCandidates:[],variations:[],contractTimeBasis:null,
   ldTerms:null,contractSections:[],amendments:[],costMetrics:[],payments:[]});
  const values={bac,ev,ac,eac,pv:100,etc:100};
  const original=JSON.stringify(values);
  const result=buildCommercialPerformance({projectId,generatedAt,dataDateIso,foundation,
   costSnapshots:[{currency:'AED',taxBasis:'exclusive',asOf:dataDateIso,state:'official',
    values,sourceRefs:['SOURCE:'+index],diagnostics:[]}],costMetrics:[],payments:[]});
  const position=result.costControl.positions[0]!;
  assert.equal(position.tcpiBudget.value,budget,'Decimal budget case '+index);
  assert.equal(position.tcpiForecast.value,forecast,'Decimal forecast case '+index);
  assert.equal(JSON.stringify(values),original,'no source money mutation');
 }
});
