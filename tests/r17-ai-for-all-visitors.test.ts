// Owner decision (28 Oct): the live app may allow AI for every visitor without
// sign-in. The switch is the deployment setting CMENG_AI_FOR_ALL_VISITORS=1; it is
// off by default, so a forged browser header still cannot spend the AI key.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';

test('R17 AI for every visitor only when the deployment switch is on',{timeout:120000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'cmeng-r17-ai-visitors-'));
  const saved=process.env.CMENG_AI_FOR_ALL_VISITORS;
  const gateway=await createProjectGateway(root,{maxWorkers:1,prepareRelease:false});
  try{
    await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
    assert.equal((await fetch(base+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:'AI-ALL'})})).status,201);
    const permitted=async(headers:Record<string,string>={})=>{const r=await fetch(base+'/api/projects/AI-ALL/intelligence/home',{headers});assert.equal(r.status,200);return ((await r.json()) as any).providerPermittedForSession;};
    delete process.env.CMENG_AI_FOR_ALL_VISITORS;
    assert.equal(await permitted({'x-cmeng-paid-ai':'1'}),false,'default: an anonymous visitor cannot use paid AI, even with a forged header');
    process.env.CMENG_AI_FOR_ALL_VISITORS='1';
    assert.equal(await permitted(),true,'switch on: every visitor may use AI');
    process.env.CMENG_AI_FOR_ALL_VISITORS='0';
    assert.equal(await permitted(),false,'switch off again');
  }finally{
    if(saved===undefined)delete process.env.CMENG_AI_FOR_ALL_VISITORS;else process.env.CMENG_AI_FOR_ALL_VISITORS=saved;
    await gateway.close();await rm(root,{recursive:true,force:true});
  }
});
