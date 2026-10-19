import test from 'node:test';
import assert from 'node:assert/strict';
import {exportModuleReport} from '../packages/runtime-api/src/module-report';

// T10 X2: Generate report (a saved report view) must carry every figure the
// page shows. It kept only the first 1,000 and dropped the rest without saying so.
test('Generate report keeps every page figure, not only the first 1,000',async()=>{
  const figures=Object.fromEntries(Array.from({length:1500},(_,i)=>['openCount'+i,i]));
  const result={key:'near-critical',status:'ready' as const,reason:'Current position.',dependencies:[],data:{dataDateIso:'2031-04-15',figures}};
  const json=JSON.parse((await exportModuleReport('T10-G','near-critical',result,'json',{})).bytes.toString('utf8'));
  const metrics=json.sections.find((s:any)=>s.authorityId==='summary').metrics;
  const ids=new Set(metrics.map((m:any)=>m.id));
  for(let i=0;i<1500;i++)assert.ok(ids.has('module.figures.openCount'+i),'figure '+i+' is in the report');
  assert.equal(metrics.find((m:any)=>m.id==='module.figures.openCount1499').value,1499);
  assert.ok(ids.has('module.dataDateIso'));
});
