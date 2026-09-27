import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request,type IncomingMessage} from 'node:http';
import {Readable} from 'node:stream';
import {configuredUploadLimit,DEFAULT_MAX_UPLOAD_BYTES,readRequestBody,UploadTooLargeError} from '../packages/runtime-api/src/request-body';

function incoming(chunks:Buffer[],length?:number){
  return Object.assign(Readable.from(chunks),{headers:length===undefined?{}:{'content-length':String(length)}}) as unknown as IncomingMessage;
}
test('upload ceiling is 200 MB, remains configurable, and invalid limits cannot disable it',()=>{
  assert.equal(DEFAULT_MAX_UPLOAD_BYTES,200*1024*1024);
  assert.equal(configuredUploadLimit(''),DEFAULT_MAX_UPLOAD_BYTES);
  assert.equal(configuredUploadLimit(String(75*1024*1024)),75*1024*1024);
  for(const value of ['NaN','bad','-1','0','1.5','50MB','Infinity'])assert.throws(()=>configuredUploadLimit(value));
});
test('declared oversized file is rejected before reading with its size and an actionable limit',async()=>{
  let pulls=0;const stream=Readable.from((function*(){pulls++;yield Buffer.from('unused');})());
  const req=Object.assign(stream,{headers:{'content-length':String(DEFAULT_MAX_UPLOAD_BYTES+1)}}) as unknown as IncomingMessage;
  await assert.rejects(()=>readRequestBody(req,undefined,DEFAULT_MAX_UPLOAD_BYTES),(e:unknown)=>{
    assert.ok(e instanceof UploadTooLargeError);assert.equal(e.statusCode,413);assert.equal(e.code,'UPLOAD_TOO_LARGE');
    assert.equal(e.limitBytes,DEFAULT_MAX_UPLOAD_BYTES);assert.match(e.message,/200 MB upload limit/);assert.match(e.message,/not been imported/);return true;
  });
  // Rejected input is drained without accumulating an upload buffer.
  assert.ok(pulls<=1);
});
test('exact 200 MB boundary is accepted without changing bytes; chunked byte 200 MB + 1 is rejected',async()=>{
  const block=Buffer.alloc(1024*1024,0x41),chunks=Array(200).fill(block);
  let received=0;const bytes=await readRequestBody(incoming(chunks,DEFAULT_MAX_UPLOAD_BYTES),(n)=>received=n,DEFAULT_MAX_UPLOAD_BYTES);
  assert.equal(bytes.length,DEFAULT_MAX_UPLOAD_BYTES);assert.equal(received,DEFAULT_MAX_UPLOAD_BYTES);assert.equal(bytes[0],0x41);assert.equal(bytes.at(-1),0x41);
  await assert.rejects(()=>readRequestBody(incoming([...chunks,Buffer.from('x')]),undefined,DEFAULT_MAX_UPLOAD_BYTES),UploadTooLargeError);
});
test('chunked rejection returns readable HTTP 413 and the next upload still works',async t=>{
  let imported=0;const server=createServer(async(req,res)=>{
    try{const bytes=await readRequestBody(req,undefined,1024);imported++;res.writeHead(201,{'content-type':'application/json'});res.end(JSON.stringify({bytes:bytes.length}));}
    catch(e){assert.ok(e instanceof UploadTooLargeError);res.writeHead(e.statusCode,{'content-type':'application/json'});res.end(JSON.stringify({error:e.code,message:e.message}));}
  });
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
  const url='http://127.0.0.1:'+(server.address() as any).port;
  const rejected=await new Promise<{status:number;body:string}>((resolve,reject)=>{
    const req=request(url,{method:'POST',headers:{'transfer-encoding':'chunked'}},res=>{let body='';res.on('data',d=>body+=d);res.on('end',()=>resolve({status:res.statusCode!,body}));});
    req.on('error',reject);req.write(Buffer.alloc(1024));req.end(Buffer.from('x'));
  });
  assert.equal(rejected.status,413);assert.equal(JSON.parse(rejected.body).error,'UPLOAD_TOO_LARGE');assert.equal(imported,0);
  const accepted=await fetch(url,{method:'POST',body:Buffer.alloc(1024)});assert.equal(accepted.status,201);assert.equal(imported,1);
});
