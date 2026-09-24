import test from 'node:test';
import assert from 'node:assert/strict';
import {withRequestAudit,appendAuditEvent,type AuditEvent} from '../packages/runtime-api/src/audit-context';
import type {IncomingMessage,ServerResponse} from 'node:http';

test('audit actor follows a signed request session, survives async work, and cannot be replaced by a claimed user header',async()=>{
 const headers:Record<string,string>={},res={setHeader:(k:string,v:string)=>headers[k]=v} as unknown as ServerResponse;
 const state:{version:number;auditHistory?:AuditEvent[]}={version:2};
 const req={method:'POST',url:'/api/projects/OTHER/controls?token=secret',headers:{'x-user':'Invented Administrator'}} as unknown as IncomingMessage;
 await withRequestAudit(req,res,async()=>{await Promise.resolve();appendAuditEvent(state,1);});
 const first=state.auditHistory![0]!;assert.equal(first.actor.kind,'anonymous_session');assert.equal(first.actor.identityVerified,false);assert.doesNotMatch(first.actor.label,/Administrator/);assert.doesNotMatch(first.operation,/secret/);
 req.headers.cookie=headers['Set-Cookie']!.split(';')[0];
 await withRequestAudit(req,res,async()=>{appendAuditEvent(state,2);});assert.equal(state.auditHistory![1]!.actor.id,first.actor.id);
 req.headers.cookie='cmeng_audit_session=forged.'+'0'.repeat(64);
 withRequestAudit(req,res,()=>appendAuditEvent(state,2));assert.notEqual(state.auditHistory![2]!.actor.id,first.actor.id);
 appendAuditEvent(state,2);assert.equal(state.auditHistory![3]!.actor.kind,'system');assert.equal(state.auditHistory!.length,4);
});

test('audit entries persist with their original actor across a store restart',async()=>{
 const {RuntimeProjectStore}=await import('../packages/runtime-api/src/project-state');
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'audit-store-'));try{
  const store=new RuntimeProjectStore({dataDir:dir,durable:true}),state=store.getOrCreate('AUDIT-OTHER');
  const req={method:'PUT',url:'/api/projects/AUDIT-OTHER/controls',headers:{}} as IncomingMessage;
  const res={setHeader(){}} as unknown as ServerResponse;
  withRequestAudit(req,res,()=>store.touch(state));
  const event=state.auditHistory!.at(-1)!;assert.equal(event.actor.kind,'anonymous_session');
  const restored=new RuntimeProjectStore({dataDir:dir,durable:true}).get('AUDIT-OTHER')!;
  assert.deepEqual(restored.auditHistory!.find(e=>e.eventId===event.eventId),event);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
