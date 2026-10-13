import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reserveModelUsage} from '../packages/project-ask/src/usage-budget';
test('Monthly budget reserves before calls, survives process re-entry and fails closed',t=>{const dir=mkdtempSync(join(tmpdir(),'cmeng-ai-budget-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const env={CMENG_AI_USAGE_DIR:dir,CMENG_AI_MONTHLY_USD:'0.01'};const r=reserveModelUsage('gpt-4.1-mini',10000,1000,env);assert.ok(r);assert.throws(()=>reserveModelUsage('gpt-4.1-mini',10000,1000,env),/BUDGET_EXHAUSTED/);r!.finish(100,50);assert.ok(reserveModelUsage('gpt-4.1-mini',10000,1000,env));assert.throws(()=>reserveModelUsage('unknown',1,1,env),/RATE_NOT_CONFIGURED/);const v=JSON.parse(readFileSync(join(dir,new Date().toISOString().slice(0,7)+'.json'),'utf8'));assert.equal(v.calls,2);assert.ok(v.reservedMicros<=10000);});
test('An uncertain or interrupted call retains its conservative reservation',t=>{const dir=mkdtempSync(join(tmpdir(),'cmeng-ai-uncertain-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const env={CMENG_AI_USAGE_DIR:dir,CMENG_AI_MONTHLY_USD:'0.006'};const r=reserveModelUsage('gpt-4.1-mini',10000,1000,env);r!.finish(null,null);assert.throws(()=>reserveModelUsage('gpt-4.1-mini',10000,1000,env),/BUDGET_EXHAUSTED/);});

test('blank, partial or overflowing configured rates cannot make paid usage free',t=>{
 const dir=mkdtempSync(join(tmpdir(),'cmeng-ai-rates-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const env={CMENG_AI_USAGE_DIR:dir,CMENG_AI_MONTHLY_USD:'1'};
 for(const rates of [{CMENG_AI_INPUT_USD_PER_MILLION:'',CMENG_AI_OUTPUT_USD_PER_MILLION:''},{CMENG_AI_INPUT_USD_PER_MILLION:'1'},{CMENG_AI_INPUT_USD_PER_MILLION:'1',CMENG_AI_OUTPUT_USD_PER_MILLION:'bad'}])assert.throws(()=>reserveModelUsage('gpt-4.1-mini',100,100,{...env,...rates}),/RATE_NOT_CONFIGURED/);
 assert.throws(()=>reserveModelUsage('custom',100,100,{...env,CMENG_AI_INPUT_USD_PER_MILLION:'1e300',CMENG_AI_OUTPUT_USD_PER_MILLION:'1'}),/ESTIMATE_INVALID/);
});

test('configured provider uses its supplied durable budget and refuses calls before transport when exhausted',async t=>{
 const {configuredAskModel}=await import('../packages/project-ask/src/provider');
 const dir=mkdtempSync(join(tmpdir(),'cmeng-ai-provider-budget-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=(async()=>{calls++;return new Response(JSON.stringify({status:'completed',usage:{input_tokens:50,output_tokens:10},output:[{type:'message',content:[{type:'output_text',text:'{"ok":true}'}]}]}),{status:200});}) as typeof fetch;
 t.after(()=>{globalThis.fetch=original;});
 const env={CMENG_ASK_AI_API_KEY:'fake',CMENG_ASK_AI_MODEL:'custom',CMENG_ASK_AI_PROTOCOL:'responses',CMENG_AI_USAGE_DIR:dir,CMENG_AI_MONTHLY_USD:'0.0001',CMENG_AI_INPUT_USD_PER_MILLION:'1',CMENG_AI_OUTPUT_USD_PER_MILLION:'1'};
 const schema={type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false};
 await assert.rejects(()=>configuredAskModel(env)!.structured('budget_test',schema,'Return the supplied value.',{ok:true}),/BUDGET_EXHAUSTED/);assert.equal(calls,0);
 await assert.rejects(()=>configuredAskModel({...env,CMENG_AI_USAGE_DIR:''})!.structured('budget_test',schema,'Return the supplied value.',{ok:true}),/BUDGET_DIRECTORY_NOT_CONFIGURED/);assert.equal(calls,0);
 const value=await configuredAskModel({...env,CMENG_AI_MONTHLY_USD:'1'})!.structured('budget_test',schema,'Return the supplied value.',{ok:true});
 assert.deepEqual(value,{ok:true});assert.equal(calls,1);
 const ledger=JSON.parse(readFileSync(join(dir,new Date().toISOString().slice(0,7)+'.json'),'utf8'));
 assert.equal(ledger.calls,1);assert.equal(ledger.reservedMicros,60);
});
