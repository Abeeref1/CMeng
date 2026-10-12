import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';

test('ordinary project startup and CSV ingestion do not initialize workbook or native renderers',()=>{
  const child=spawnSync(process.execPath,['-e',`
    const assert=require('node:assert/strict');
    require('./dist/packages/runtime-api/src/server');
    const {ingestBoq}=require('./dist/packages/boq-ingestion/src');
    (async()=>{
      const result=await ingestBoq({projectId:'COLD-CSV',bytes:Buffer.from('Item,Description,Unit,Quantity,Rate,Amount\\n1,Concrete,m3,7,11,77'),verifiedMediaType:'text/csv',receivedAt:'2032-01-05'});
      assert.equal(result.canonicalItems[0].amount,77);
      for(const name of ['exceljs','pdfkit','@napi-rs/canvas'])assert.equal(require.cache[require.resolve(name)],undefined,name+' must wait for a format request');
    })().catch(error=>{console.error(error);process.exitCode=1});
  `],{cwd:join(__dirname,'../..'),env:{...process.env,CMENG_TEST_MODE:'1',CMENG_OCR_ENABLED:'0'},encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
});
