import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createServer,request as httpRequest,type IncomingMessage,type ServerResponse,type ClientRequest} from 'node:http';
import type {AddressInfo} from 'node:net';
import {abortProjectProxyOnDisconnect} from '../packages/runtime-api/src/project-proxy-cancellation';

function harness(patch:{alreadyAborted?:boolean;destroyedResponse?:boolean}={}){
  const request=Object.assign(new EventEmitter(),{aborted:patch.alreadyAborted??false}) as unknown as IncomingMessage;
  const response=Object.assign(new EventEmitter(),{writableFinished:false,destroyed:patch.destroyedResponse??false}) as unknown as ServerResponse;
  const upstream=Object.assign(new EventEmitter(),{destroyed:false,lastError:null as Error|null}) as unknown as ClientRequest & {lastError:Error|null};
  upstream.destroy=((error?:Error)=>{upstream.destroyed=true;upstream.lastError=error;upstream.emit('close');return upstream;}) as ClientRequest['destroy'];
  let canceled=0;
  const cleanup=abortProjectProxyOnDisconnect(request,response,upstream,()=>canceled++);
  return {request,response,upstream,cleanup,get canceled(){return canceled;}};
}

test('T11: leaving a project before its calculation returns releases the unused upstream lane',()=>{
 const h=harness();h.response.emit('close');
 assert.equal(h.canceled,1);assert.equal(h.upstream.destroyed,true);
 assert.match(h.upstream.lastError!.message,/CLIENT_CONNECTION_CLOSED/);
 h.request.emit('aborted');assert.equal(h.canceled,1,'same abandoned request must be canceled only once');
 assert.equal(h.request.listenerCount('aborted'),0);assert.equal(h.response.listenerCount('close'),0);
});

test('T11: browser disconnect while waiting to acquire a worker is rejected on arrival',()=>{
 for(const patch of [{alreadyAborted:true},{destroyedResponse:true}]){
  const h=harness(patch);
  assert.equal(h.canceled,1);assert.equal(h.upstream.destroyed,true);
 }
});

test('T11: normal completed stream and completed upstream do not get canceled by a later close',()=>{
 const done=harness();(done.response as any).writableFinished=true;done.response.emit('close');
 assert.equal(done.canceled,0);assert.equal(done.upstream.destroyed,false);
 const responseDone=harness();responseDone.upstream.emit('close');responseDone.request.emit('aborted');
 assert.equal(responseDone.canceled,0);assert.equal(responseDone.upstream.destroyed,false);
});

test('T11: real HTTP browser abort destroys upstream transport without changing successful response behavior',async t=>{
 let liveUpstream:ClientRequest|null=null, canceled=0;
 let sourceReceived!:()=>void;
 const arrived=new Promise<void>(resolve=>{sourceReceived=resolve;});
 const source=createServer((req,res)=>{
  if(req.url==='/slow'){sourceReceived();res.writeHead(200,{'content-type':'text/plain'});res.write('original document retained');return;}
  res.writeHead(200);res.end('original response');
 });
 source.listen(0,'127.0.0.1');await new Promise<void>(resolve=>source.once('listening',resolve));
 const sourcePort=(source.address() as AddressInfo).port;
 const gateway=createServer((req,res)=>{
  const up=httpRequest({host:'127.0.0.1',port:sourcePort,path:req.url||'/',method:req.method},remote=>remote.pipe(res));
  liveUpstream=up;
  abortProjectProxyOnDisconnect(req,res,up,()=>{canceled++;});
  up.on('error',()=>{});
  req.pipe(up);
 });
 gateway.listen(0,'127.0.0.1');await new Promise<void>(resolve=>gateway.once('listening',resolve));
 const port=(gateway.address() as AddressInfo).port;
 t.after(async()=>{
  gateway.closeAllConnections();source.closeAllConnections();
  await Promise.all([new Promise<void>(resolve=>gateway.close(()=>resolve())),new Promise<void>(resolve=>source.close(()=>resolve()))]);
 });
 const original=await new Promise<string>((resolve,reject)=>{
  const req=httpRequest({host:'127.0.0.1',port,path:'/normal'},res=>{
   const chunks:Buffer[]=[];res.on('data',(b:Buffer)=>chunks.push(b));res.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
  });req.on('error',reject);req.end();
 });
 assert.equal(original,'original response');assert.equal(canceled,0);
 const browser=httpRequest({host:'127.0.0.1',port,path:'/slow'});
 browser.on('error',()=>{});browser.end();
 await Promise.race([arrived,new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('slow source was never reached')),2500))]);
 browser.destroy();
 await Promise.race([new Promise<void>((resolve,reject)=>{
  const check=()=>canceled===1&&liveUpstream?.destroyed?resolve():setTimeout(check,10);
  setTimeout(()=>reject(new Error('abandoned upstream transport was not canceled')),2500);
  check();
 }),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('abort response did not settle')),2700))]);
 assert.equal(canceled,1);
 assert.equal(liveUpstream?.destroyed,true);
});
