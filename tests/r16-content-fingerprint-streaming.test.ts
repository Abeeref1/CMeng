// Live finding, 27 Oct (release 1da532f8): ABB-100 could not be restored,
// "CMENG_STATE_RESTORE_FAILED: Invalid string length". The project content
// fingerprint (unchanged re-saves keep their version) turned the whole project
// into one JSON string, and a large project is longer than one JavaScript string
// can be. The fingerprint is now streamed through the same chunked encoder as the
// saved snapshot; it gives the same hash as the JSON text for ordinary values.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {hashJsonStream} from '../packages/runtime-api/src/snapshot-json';

const sha=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');

test('R16 streamed JSON hash equals the hash of the JSON text, with the same replacer rules',()=>{
 const long='x'.repeat(70_000)+'" \\'+'y'.repeat(40_000);
 const value={a:1,b:'two',c:[1,undefined,()=>1,{d:null,e:new Date('2031-01-02T03:04:05Z')}],f:undefined,g:{h:[{i:long}],diagnostics:['KEEP','DROP:1']},
  big:Array.from({length:3000},(_,i)=>({id:'A'+i,n:i,s:'row '+i,tags:['t'+(i%5)]}))};
 assert.equal(hashJsonStream(value),sha(JSON.stringify(value)));
 const filter=function(this:any,key:string,v:unknown){if(this===value&&key==='b')return undefined;if(key==='diagnostics'&&Array.isArray(v))return v.filter(c=>!String(c).startsWith('DROP'));return v;};
 assert.equal(hashJsonStream(value,(holder,key,v)=>filter.call(holder,key,v)),sha(JSON.stringify(value,filter)));
});

test('R16 the project content fingerprint never builds the whole project as one string',()=>{
 const source=readFileSync(require.resolve('../packages/runtime-api/src/project-state'),'utf8');
 const start=source.indexOf('function projectContentFingerprint(');
 assert.ok(start>=0);
 const body=source.slice(start,source.indexOf('\n}',start));
 assert.match(body,/hashJsonStream\)?\(/);
 assert.doesNotMatch(body,/JSON\.stringify\(/);
});
