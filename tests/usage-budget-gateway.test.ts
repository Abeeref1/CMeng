import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';

test('different project workers spend from one durable default ledger',async t=>{
 const root=mkdtempSync(join(tmpdir(),'gateway-budget-')),preload=join(root,'reserve.cjs'),results=join(root,'reservations.jsonl');
 writeFileSync(preload,`const {workerData}=require('node:worker_threads');if(workerData?.projectId){const {reserveModelUsage}=require(${JSON.stringify(join(__dirname,'../packages/project-ask/src/usage-budget.js'))});let outcome='reserved';try{reserveModelUsage('gpt-4.1-mini',10000,1000,{CMENG_AI_USAGE_DIR:process.env.CMENG_AI_USAGE_DIR,CMENG_AI_MONTHLY_USD:'0.01'});}catch(e){outcome=e.message;}require('node:fs').appendFileSync(${JSON.stringify(results)},JSON.stringify({project:workerData.projectId,outcome})+'\\n');}`);
 const old=process.env.CMENG_AI_USAGE_DIR;delete process.env.CMENG_AI_USAGE_DIR;
 t.after(()=>{if(old===undefined)delete process.env.CMENG_AI_USAGE_DIR;else process.env.CMENG_AI_USAGE_DIR=old;rmSync(root,{recursive:true,force:true});});
 const gateway=await createProjectGateway(root,{maxWorkers:2,workerExecArgv:['--require',preload]});
 try{
  await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+(gateway.server.address() as any).port;
  for(const projectId of ['LEDGER-A','LEDGER-B'])assert.equal((await fetch(base+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId})})).status,201);
  const rows=readFileSync(results,'utf8').trim().split('\n').map(line=>JSON.parse(line));
  assert.deepEqual(rows.map(row=>row.outcome),['reserved','MODEL_MONTHLY_BUDGET_EXHAUSTED']);
  const ledger=JSON.parse(readFileSync(join(root,'ai-usage',new Date().toISOString().slice(0,7)+'.json'),'utf8'));
  assert.equal(ledger.calls,1);assert.equal(ledger.reservedMicros,5600);
 }finally{await gateway.close();}
});
