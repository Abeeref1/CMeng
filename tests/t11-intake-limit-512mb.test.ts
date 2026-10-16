import test from 'node:test';
import assert from 'node:assert/strict';
import type {IncomingMessage} from 'node:http';
import {DEFAULT_MAX_UPLOAD_BYTES,configuredUploadLimit,readRequestBody,UploadTooLargeError} from '../packages/runtime-api/src/request-body';

test('T11 project source intake retains the required 512 MiB ceiling without preallocating a file',async()=>{
  const ceiling=512*1024*1024;
  assert.equal(DEFAULT_MAX_UPLOAD_BYTES,ceiling);
  assert.equal(configuredUploadLimit(''),ceiling);
  assert.equal(configuredUploadLimit('268435456'),256*1024*1024,'explicit deployment settings still work');
  assert.throws(()=>configuredUploadLimit('not-a-number'),/positive whole number/);
  let discarded=0;
  const request={
    headers:{'content-length':String(ceiling+1)},
    resume:()=>{discarded++;}
  } as unknown as IncomingMessage;
  await assert.rejects(readRequestBody(request,undefined,ceiling),(err:unknown)=>{
    assert.ok(err instanceof UploadTooLargeError);
    assert.equal(err.statusCode,413);
    assert.equal(err.code,'UPLOAD_TOO_LARGE');
    assert.equal(err.limitBytes,ceiling);
    assert.equal(err.fileBytes,ceiling+1);
    return true;
  });
  assert.equal(discarded,1,'oversized stream is drained so a readable 413 can be returned');
});
