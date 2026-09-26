import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,get,type IncomingHttpHeaders} from 'node:http';
import type {AddressInfo} from 'node:net';
import {gunzipSync,brotliDecompressSync} from 'node:zlib';
import {sendHttpBody,forwardHttpBody} from '../packages/runtime-api/src/http-response';

function raw(url:string,accept:string,method='GET'){
  return new Promise<{headers:IncomingHttpHeaders;body:Buffer;status:number}>((resolve,reject)=>{
    const req=get(url,{method,headers:{'accept-encoding':accept}},res=>{
      const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);
      res.on('end',()=>resolve({headers:res.headers,body:Buffer.concat(chunks),status:res.statusCode!}));
    });req.on('error',reject);
  });
}
const decode=(r:{headers:IncomingHttpHeaders;body:Buffer})=>r.headers['content-encoding']==='br'?brotliDecompressSync(r.body):r.headers['content-encoding']==='gzip'?gunzipSync(r.body):r.body;

test('HTTP compression preserves exact JSON, negotiates exclusions, and separates compressed representations',async t=>{
  const body=Buffer.from(JSON.stringify({missing:null,measuredZero:0,approved:false,rows:Array.from({length:20000},(_,i)=>({id:i,label:'مراجعة الكميات',quantity:i%31}))}));
  const server=createServer((req,res)=>sendHttpBody(res,200,{'content-type':'application/json','vary':'Origin','x-cmeng-project-version':'7'},body));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
  const url='http://127.0.0.1:'+(server.address() as AddressInfo).port;
  for(const [accept,expected] of [['gzip','gzip'],['gzip, br','br'],['br;q=0,gzip;q=0.5','gzip'],['gzip;q=0.9,br;q=0.2','gzip'],['*;q=1,br;q=0','gzip'],['identity',undefined],['gzip;q=0,br;q=0',undefined],['identity;q=1,gzip;q=0.5',undefined],['',undefined]] as const){
    const result=await raw(url,accept);assert.equal(result.status,200);assert.equal(result.headers['content-encoding'],expected,accept);
    assert.deepEqual(decode(result),body,'all fields, rows, nulls and zeroes survive '+accept);
    assert.equal(result.headers.vary,'Origin, Accept-Encoding');assert.equal(result.headers['x-cmeng-project-version'],'7');
    if(expected){assert.ok(result.body.length<body.length/4);assert.equal(result.headers['content-length'],undefined);assert.equal(result.headers['transfer-encoding'],'chunked');}
    else assert.equal(Number(result.headers['content-length']),body.length);
  }
});

test('small, binary, range, already encoded and no-transform responses are not recompressed',async t=>{
  const body=Buffer.alloc(4096,65);
  const server=createServer((req,res)=>{
    const path=req.url!;
    sendHttpBody(res,path==='/range'?206:200,{'content-type':path==='/binary'?'application/zip':path==='/events'?'text/event-stream':'application/json',
      ...(path==='/encoded'?{'content-encoding':'gzip'}:{}),...(path==='/no-transform'?{'cache-control':'private, no-transform'}:{})},path==='/small'?'{}':body);
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
  const url='http://127.0.0.1:'+(server.address() as AddressInfo).port;
  for(const path of ['/small','/binary','/range','/events','/encoded','/no-transform']){
    const result=await raw(url+path,'gzip, br');assert.equal(result.headers['content-encoding'],path==='/encoded'?'gzip':undefined);
    assert.deepEqual(result.body,path==='/small'?Buffer.from('{}'):body);
  }
  const head=await raw(url,'gzip, br','HEAD');assert.equal(head.body.length,0);assert.equal(head.headers['content-encoding'],undefined);
});

test('streamed worker responses and cached bodies share compression without double encoding',async t=>{
  const body=Buffer.from(JSON.stringify({events:Array.from({length:15000},(_,id)=>({id,source:'retained evidence',amount:null}))}));
  const source=createServer((_req,res)=>{res.writeHead(200,{'content-type':'application/json','x-cmeng-project-version':'3'});res.write(body.subarray(0,1500));res.end(body.subarray(1500));});
  await new Promise<void>(resolve=>source.listen(0,'127.0.0.1',resolve));t.after(()=>{source.closeAllConnections();source.close();});
  const server=createServer((req,res)=>{
    if(req.url==='/cached')sendHttpBody(res,200,{'content-type':'application/json','x-cmeng-project-version':'3'},body);
    else get('http://127.0.0.1:'+(source.address() as AddressInfo).port,upstream=>forwardHttpBody(res,upstream)).on('error',error=>res.destroy(error));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
  const url='http://127.0.0.1:'+(server.address() as AddressInfo).port;
  for(const path of ['/worker','/cached'])for(const encoding of ['br','gzip','identity']){
    const result=await raw(url+path,encoding);assert.equal(result.headers['content-encoding'],encoding==='identity'?undefined:encoding);
    if(encoding!=='identity')assert.equal(result.headers['transfer-encoding'],'chunked');
    assert.deepEqual(decode(result),body);assert.equal(result.headers['x-cmeng-project-version'],'3');
  }
});
