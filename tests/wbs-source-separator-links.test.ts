import test from 'node:test';
import assert from 'node:assert/strict';
import {indexWbsSeparatorCodes,wbsSeparatorKey} from '../packages/runtime-api/src/quantity-mapping-runtime';

test('S-17 source codes differing only by WBS separators resolve to exactly one real programme WBS',()=>{
 const nodes=[{wbsId:'100',code:'VLC-01',name:'Earthworks & Site Preparation'},
 {wbsId:'200',code:'MEP_02',name:'Mechanical & electrical'}] as any;
 const index=indexWbsSeparatorCodes(nodes);
 assert.equal(wbsSeparatorKey('VLC.01'),'vlc.01');
 assert.equal(wbsSeparatorKey('vlc_01'),'vlc.01');
 assert.equal(wbsSeparatorKey('MEP-02'),'mep.02');
 assert.equal(index.get(wbsSeparatorKey('VLC.01'))?.length,1);
 assert.equal(index.get(wbsSeparatorKey('VLC.01'))?.[0].wbsId,'100');
 assert.equal(index.get(wbsSeparatorKey('MEP-02'))?.[0].wbsId,'200');
 assert.equal(index.get(wbsSeparatorKey('UNKNOWN.99')),undefined);
});
test('S-17 collision is unresolved, not assigned to an arbitrary programme node',()=>{
 const index=indexWbsSeparatorCodes([{wbsId:'A',code:'LOT-01'},
 {wbsId:'B',code:'LOT.01'}] as any);
 assert.equal(index.get(wbsSeparatorKey('LOT_01'))?.length,2);
 // Production only accepts index results with exactly one source WBS node.
 assert.ok((index.get(wbsSeparatorKey('LOT_01'))?.length??0)!==1);
 assert.notEqual(wbsSeparatorKey('LOT01'),wbsSeparatorKey('LOT.01'));
});
