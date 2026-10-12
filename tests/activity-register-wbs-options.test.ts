import test from 'node:test';
import assert from 'node:assert/strict';
import {activityRegisterView,activityRegisterPage} from '../packages/runtime-api/src/activity-register-page';

test('S-23 WBS dropdown shows programme hierarchy while API filters preserve exact source WBS code',()=>{
 const data={rows:[
  {activityId:'A-01',activityType:'task',name:'Concrete',wbsId:'WBS-08',wbsPath:'Central Tower / Structure / Concrete',status:'not_started'},
  {activityId:'A-02',activityType:'task',name:'Steel',wbsId:'WBS-09',wbsPath:'Central Tower / Structure / Steel',status:'not_started'},
  {activityId:'A-03',activityType:'task',name:'Unnamed',wbsId:'WBS-10',status:'not_started'}
 ]};
 const view=activityRegisterView(data);
 assert.deepEqual(view.activitySummary.filterOptions.wbsId,[
  ['WBS-10','WBS reference WBS-10 · source name unavailable'],
  ['WBS-08','Central Tower / Structure / Concrete'],
  ['WBS-09','Central Tower / Structure / Steel']
 ].sort((a,b)=>a[1]!.localeCompare(b[1]!,undefined,{numeric:true})));
 const selected=activityRegisterPage(data.rows,new URLSearchParams({wbsId:'WBS-08',pageSize:'50'}));
 assert.equal(selected.matchingCount,1);
 assert.equal(selected.rows[0]!.activityId,'A-01');
 assert.equal(data.rows[0]!.wbsId,'WBS-08','the source record identity must not be rewritten for presentation');
});
