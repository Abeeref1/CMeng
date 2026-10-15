import test from 'node:test';
import assert from 'node:assert/strict';
import {recordDetailPage} from '../packages/runtime-api/src/response-paging';

const source=(projectId:string,rows:unknown[])=>({
  key:'delivery-control',projectId,data:{rows}
});

test('T05 administrative source state does not mask real current business status in full register filtering',()=>{
  const rows=[
    {recordId:'REC-001',state:'candidate',currentStatus:'open',amount:11},
    {recordId:'REC-002',state:'current',currentStatus:'closed',amount:12},
    {recordId:'REC-003',state:'verified',currentStatus:'open',amount:13},
    {recordId:'REC-004',state:'source',currentStatus:'rejected',amount:14},
    {recordId:'REC-005',state:'candidate',currentStatus:' ',status:'open',amount:15},
    {recordId:'REC-006',state:'open',amount:16},
    {recordId:'REC-007',state:'source',currentStatus:null,permitStatus:'expired',amount:17},
  ];
  const input=source('SOURCE-ONE',rows),unchanged=JSON.stringify(input);
  const open=recordDetailPage(input,'/data/rows',0,2,{status:'open',sort:'amount',direction:'desc'}) as any;
  assert.equal(open.total,4,'open filter uses real source business status across all seven rows');
  assert.equal(open.sourceTotal,7,'true unfiltered source count remains independently visible');
  assert.deepEqual(open.rows.map((r:any)=>r.recordId),['REC-006','REC-005']);
  assert.equal(open.hasMore,true);
  const second=recordDetailPage(input,'/data/rows',2,2,{status:'open',sort:'amount',direction:'desc'}) as any;
  assert.deepEqual(second.rows.map((r:any)=>r.recordId),['REC-003','REC-001']);
  assert.equal(second.total,4);
  assert.equal(second.hasMore,false);
  const closed=recordDetailPage(input,'/data/rows',0,25,{status:'closed'}) as any;
  assert.deepEqual(closed.rows.map((r:any)=>r.recordId),['REC-002']);
  const expired=recordDetailPage(input,'/data/rows',0,25,{status:'expired'}) as any;
  assert.deepEqual(expired.rows.map((r:any)=>r.recordId),['REC-007']);
  assert.equal(JSON.stringify(input),unchanged,'paging and sorting never change retained source records');
});

test('T05 status filters preserve the complete original denominator and separate projects with identical IDs',()=>{
  const make=(id:string,state:string,currentStatus:string)=>({
    recordId:id,state,currentStatus,amount:10
  });
  const projectA=source('SOURCE-A',Array.from({length:105},(_,i)=>
    make('SHARED-'+i,'candidate',i%3===0?'open':'closed')));
  const projectB=source('SOURCE-B',Array.from({length:105},(_,i)=>
    make('SHARED-'+i,'verified',i%2===0?'open':'closed')));
  const beforeA=JSON.stringify(projectA),beforeB=JSON.stringify(projectB);
  const a=recordDetailPage(projectA,'/data/rows',25,25,{status:'open'}) as any;
  const b=recordDetailPage(projectB,'/data/rows',25,25,{status:'open'}) as any;
  assert.equal(a.total,35,'A full 105-row denominator is used, never the first 25');
  assert.equal(b.total,53,'B full 105-row denominator stays isolated');
  assert.equal(a.rows.length,10,'A final page is not discarded');
  assert.equal(b.rows.length,25);
  assert.equal(a.hasMore,false);
  assert.equal(b.hasMore,true);
  assert.equal(JSON.stringify(projectA),beforeA);
  assert.equal(JSON.stringify(projectB),beforeB);
});
