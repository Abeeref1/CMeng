import test from 'node:test';
import assert from 'node:assert/strict';
import {pageProjectResponse} from '../packages/runtime-api/src/response-paging';

test('S-19/S-21/S-32/S-35 decision answers survive a wide module transport projection',()=>{
 for(const key of ['progress-breakdown','payments','activity-analytics','commercial-overview']){
  const data:any=Object.fromEntries(Array.from({length:180},(_,i)=>['supportingField'+i,i]));
  data.decisionAnalysis={kind:'source_based',periodProgress:14.25,paymentLinkage:{total:120,linked:35,coveragePercent:35/120*100},basis:'Dated source evidence; not zero or approval',rows:Array.from({length:90},(_,i)=>({reference:'ROW-'+i,quantity:i}))};
  data.positionVerdict='The actual management answer';data.managementPosition='Source-qualified position';
  const before=JSON.stringify(data),paged=pageProjectResponse({key,projectVersion:7,data},'/api/projects/PROOF/management/'+key) as any;
  assert.equal(paged.data.decisionAnalysis.periodProgress,14.25);
  assert.equal(paged.data.decisionAnalysis.paymentLinkage.total,120);
  assert.equal(paged.data.decisionAnalysis.paymentLinkage.linked,35);
  assert.equal(paged.data.decisionAnalysis.basis,data.decisionAnalysis.basis);
  assert.equal(paged.data.positionVerdict,data.positionVerdict);
  assert.equal(paged.data.managementPosition,data.managementPosition);
  assert.equal(paged.responsePaging.tables.find((r:any)=>r.pointer==='/data/decisionAnalysis/rows')?.total,90);
  assert.equal(JSON.stringify(data),before,'The complete producer result is not altered by paging');
 }
});
