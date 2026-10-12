import {AsyncLocalStorage} from 'node:async_hooks';
import {createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
export type AuditActor={id:string;kind:'anonymous_session'|'system'|'user';label:string;identityVerified:boolean};
export type AuditContext={actor:AuditActor;requestId:string;operation:string};
export type AuditEvent={eventId:string;occurredAt:string;actor:AuditActor;requestId:string;operation:string;projectVersion:number;previousVersion:number|null};
const context=new AsyncLocalStorage<AuditContext>();
const secret=process.env.CMENG_AUDIT_SECRET?Buffer.from(process.env.CMENG_AUDIT_SECRET,'hex'):randomBytes(32);
const sign=(id:string)=>createHmac('sha256',secret).update(id).digest('hex');
export function auditContext():AuditContext {return context.getStore()??{actor:{id:'cmeng-runtime',kind:'system',label:'CMeng background process',identityVerified:true},requestId:randomUUID(),operation:'Background project update'};}
export function withRequestAudit<T>(req:IncomingMessage,res:ServerResponse,run:()=>T):T {
  const workerKey=process.env.CMENG_EXTERNAL_WORKER_KEY;
  const actorValue=String(req.headers['x-cmeng-verified-actor']??''),actorSignature=String(req.headers['x-cmeng-verified-actor-signature']??'');
  if(workerKey&&actorValue.length<4096&&/^[a-f0-9]{64}$/.test(actorSignature)){
    const expected=createHmac('sha256',workerKey).update(actorValue).digest('hex');
    if(timingSafeEqual(Buffer.from(expected),Buffer.from(actorSignature))){
      let actor:{id?:unknown}|null=null;
      try{actor=JSON.parse(Buffer.from(actorValue,'base64url').toString('utf8'));}catch{}
      if(typeof actor?.id==='string'&&actor.id.length>0&&actor.id.length<=200){
        const requestId=randomUUID();res.setHeader('X-Request-Id',requestId);
        return context.run({actor:{id:actor.id,kind:'user',label:actor.id,identityVerified:true},requestId,operation:(req.method??'GET')+' '+new URL(req.url??'/','http://localhost').pathname},run);
      }
    }
  }
  const supplied=/(?:^|;\s*)cmeng_audit_session=([a-f0-9-]+)\.([a-f0-9]+)/.exec(req.headers.cookie??'');
  const valid=!!supplied&&supplied[2]!.length===64&&timingSafeEqual(Buffer.from(supplied[2]!),Buffer.from(sign(supplied[1]!)));
  const id=valid?supplied![1]!:randomUUID();
  if(!valid)res.setHeader('Set-Cookie','cmeng_audit_session='+id+'.'+sign(id)+'; Path=/; HttpOnly; SameSite=Lax'+(req.headers['x-forwarded-proto']==='https'?'; Secure':''));
  const requestId=randomUUID();res.setHeader('X-Request-Id',requestId);
  const operation=(req.method??'GET')+' '+new URL(req.url??'/', 'http://localhost').pathname;
  return context.run({actor:{id,kind:'anonymous_session',label:'Session '+id.slice(0,8)+' (identity unverified)',identityVerified:false},requestId,operation},run);
}
export function appendAuditEvent(state:{version:number;auditHistory?:AuditEvent[]},previousVersion:number|null) {
  const c=auditContext();(state.auditHistory??=[]).push({eventId:randomUUID(),occurredAt:new Date().toISOString(),...c,projectVersion:state.version,previousVersion});
}
