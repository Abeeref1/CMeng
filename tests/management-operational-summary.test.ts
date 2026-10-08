import test from 'node:test';
import assert from 'node:assert/strict';
import {compactManagementOperationalReporting} from '../packages/runtime-api/src/project-projections';

test('F61 management operations retain as-of counts without reproducing full register records',()=>{
 const records=Array.from({length:180},(_,i)=>({id:'R-'+i,sourceStatus:i%2?'Open':'Closed',status:i%2?'open':'closed',document:'Attached source '.repeat(70),receipt:{locator:'row:'+i}}));
 const register={state:'established',sourceRecordCount:180,currentRecordCount:175,futureRecordCount:2,undatedRecordCount:3,unknownStatusCount:1,
  current:records,sourceRows:records,validation:{rows:records}}; 
 const original={dataDateIso:'2026-08-31',counts:{openRfiCount:23,overdueRfiCount:11,openRiskCount:17,openCriticalMajorNcrCount:3},
  knownCounts:{uncertainCriticalMajorNcrCount:1},quality:register,rfi:register,risk:register,actions:records};
 const before=JSON.stringify(original);
 const management=compactManagementOperationalReporting(original as any);
 assert.equal(management.rfi.currentRecordCount,175);
 assert.equal(management.quality.sourceRecordCount,180);
 assert.equal(management.risk.undatedRecordCount,3);
 assert.equal(management.counts.overdueRfiCount,11);
 assert.equal(management.risk.sourceRows.length,180);
 assert.equal(management.risk.sourceRows[0]?.sourceStatus,'Closed');
 assert.equal(JSON.stringify(original),before,'no source/reporting records are modified');
 assert.ok(JSON.stringify(management).length<JSON.stringify(original).length/8);
 assert.ok(!('current' in management.rfi),'management summaries are not full specialist registers');
});
