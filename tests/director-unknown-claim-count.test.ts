import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// An unknown delay-event or claim count on the Director view stays unknown.
// Before this fix the Director projection wrote 0 when the claims reader gave no count,
// so the page showed "0 claims" for a register it could not read.
const root=process.cwd();
const source=readFileSync(join(root,'packages/runtime-api/src/project-projections.ts'),'utf8');

test('Director claim and event counts never fall back to zero when unknown',()=>{
 for(const key of ['eventCount','claimCount']){
  const pattern=new RegExp(key+':\\s*delayModel\\s*\\?\\s*\\(\\s*noticesClaims\\s*\\?\\.'+key+'\\s*\\?\\?\\s*(\\w+)');
  const match=source.match(pattern);
  assert.ok(match,'Director '+key+' reads the shared claims reader');
  assert.equal(match![1],'null',key+' keeps an unknown count unknown');
 }
});

test('the Director metric line shows Not established for an unknown count',()=>{
 const ui=readFileSync(join(root,'packages/runtime-api/src/ui.ts'),'utf8');
 assert.match(ui,/\["Delay events",p\.claims\.eventCount\],\["Claims",p\.claims\.claimCount\]/);
 assert.match(ui,/function metricLine\(label,value\)\{\n\s*return .*value===null\|\|value===undefined\?"Not established":fmt\(value\)/);
});
