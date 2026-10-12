import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reserveModelUsage} from '../packages/project-ask/src/usage-budget';
test('Monthly budget reserves before calls, survives process re-entry and fails closed',t=>{const dir=mkdtempSync(join(tmpdir(),'cmeng-ai-budget-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const env={CMENG_AI_USAGE_DIR:dir,CMENG_AI_MONTHLY_USD:'0.01'};const r=reserveModelUsage('gpt-4.1-mini',10000,1000,env);assert.ok(r);assert.throws(()=>reserveModelUsage('gpt-4.1-mini',10000,1000,env),/BUDGET_EXHAUSTED/);r!.finish(100,50);assert.ok(reserveModelUsage('gpt-4.1-mini',10000,1000,env));assert.throws(()=>reserveModelUsage('unknown',1,1,env),/RATE_NOT_CONFIGURED/);const v=JSON.parse(readFileSync(join(dir,new Date().toISOString().slice(0,7)+'.json'),'utf8'));assert.equal(v.calls,2);assert.ok(v.reservedMicros<=10000);});
test('An uncertain or interrupted call retains its conservative reservation',t=>{const dir=mkdtempSync(join(tmpdir(),'cmeng-ai-uncertain-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const env={CMENG_AI_USAGE_DIR:dir,CMENG_AI_MONTHLY_USD:'0.006'};const r=reserveModelUsage('gpt-4.1-mini',10000,1000,env);r!.finish(null,null);assert.throws(()=>reserveModelUsage('gpt-4.1-mini',10000,1000,env),/BUDGET_EXHAUSTED/);});
