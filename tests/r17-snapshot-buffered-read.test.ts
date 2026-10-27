// T11 (27 Oct): restoring ABB-100 spent most of its time in the token-by-token
// JSON reader (8.6 s of 16 s on the real ABB sources) and in the JavaScript
// encoder behind the change fingerprint and the save. A large save is now read
// into one buffer and split at value boundaries, each bounded value parsed by
// the native parser; the encoder hands values below the top levels to the
// native serializer. Values, hashes and saved bytes are the same as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync,readFileSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseJsonBuffer,readSnapshotJson,writeSnapshotJson,hashJsonStream} from '../packages/runtime-api/src/snapshot-json';

const sha=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
const tricky=()=>({
 a:'quote " backslash \\ slash / tab \t newline \n unicode é 中文 😀   end \\',
 b:['\\"',"\\\\\"",'',' ',[],{},[[]],[{}],{x:[]}],
 'key "with" quotes':{'\\':1,'':2},
 n:[0,-0.5,1e21,1.5e-7,123456789012345680000,-1],
 t:[true,false,null],
 deep:{l1:{l2:{l3:{l4:{l5:['x',{y:'z'}]}}}}},
 rows:Array.from({length:200},(_,i)=>({id:'R'+i,v:i/3,s:'é'.repeat(i%7),tags:i%2?[]:['a','b'],nested:{d:i%3?null:'2031-01-0'+(1+i%9)}})),
});

test('R17 the buffered reader gives the same values as JSON.parse, with any spacing',()=>{
 const value=tricky();
 for(const text of [JSON.stringify(value),JSON.stringify(value,null,2),JSON.stringify(value,null,'\t').replace(/\n/g,'\r\n')]){
  const parsed=parseJsonBuffer(Buffer.from(text,'utf8'));
  assert.deepStrictEqual(parsed,JSON.parse(text));
 }
 for(const text of ['[]','{}','"x"','12','null',' [ 1 , { "a" : [ ] } ] ']) assert.deepStrictEqual(parseJsonBuffer(Buffer.from(text)),JSON.parse(text));
 // An own "__proto__" key stays an own key, as JSON.parse keeps it.
 const proto=parseJsonBuffer(Buffer.from('{"__proto__":{"polluted":1},"a":1}')) as any;
 assert.deepStrictEqual(Object.keys(proto),['__proto__','a']);assert.equal(({} as any).polluted,undefined);
});

test('R17 containers larger than one slice are walked and still equal JSON.parse',()=>{
 // About 20 MB: the root, the array and one large record exceed the slice size.
 const long='Clause text with "quotes" and \\ backslashes, é and 😀. '.repeat(160_000);
 const value={schemaVersion:1,projects:[{projectId:'P',documents:Array.from({length:6},(_,i)=>({id:'D'+i,text:i===2?long:'short '+i,rows:Array.from({length:20_000},(_,j)=>[j,'r'+j])})),big:long}]};
 const text=JSON.stringify(value);
 assert.ok(Buffer.byteLength(text)>16*1024*1024);
 assert.deepStrictEqual(parseJsonBuffer(Buffer.from(text,'utf8')),value);
 assert.throws(()=>parseJsonBuffer(Buffer.from(text.slice(0,-10),'utf8')));
 assert.throws(()=>parseJsonBuffer(Buffer.from(text+'bad','utf8')));
 assert.throws(()=>parseJsonBuffer(Buffer.from(text.replace('"projectId":"P"','"projectId" "P"'),'utf8')));
});

test('R17 a save between 32 MB and the buffer limit is read by the buffered reader, values unchanged',()=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-r17-read-'));
 try{
  const path=join(root,'state.json');
  const value={schemaVersion:1,projects:[{projectId:'P',evidence:Array.from({length:40},(_,i)=>({id:'E'+i,text:('Text '+i+' é 😀 "q" ').repeat(60_000)}))}]};
  writeSnapshotJson(path,value);
  assert.ok(statSync(path).size>32*1024*1024);
  assert.equal(readFileSync(path,'utf8'),JSON.stringify(value),'the saved bytes are the JSON text');
  assert.deepStrictEqual(readSnapshotJson(path),value);
  writeFileSync(path,readFileSync(path).subarray(0,statSync(path).size-5));
  assert.throws(()=>readSnapshotJson(path));
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('R17 the encoder gives the JSON.stringify text and hash at every depth, with and without a filter',()=>{
 const value:any={...tricky(),when:new Date('2031-02-03T04:05:06Z'),skip:undefined,fn:()=>1,
  levels:{a:{b:{c:{d:[undefined,()=>1,new Date(0),{toJSON:(key:string)=>'json:'+key},{diagnostics:['KEEP','X_MIGRATION_V2'],v:1}]}}}},
  diagnostics:['TOP','Y_REFRESH_V3']};
 assert.equal(hashJsonStream(value),sha(JSON.stringify(value)));
 const replacer=function(this:any,key:string,v:unknown){if(this===value&&key==='skipMe')return undefined;if(key==='diagnostics'&&Array.isArray(v))return v.filter(c=>!/_(?:MIGRATION|REFRESH)_V\d+$/.test(String(c)));return v;};
 value.skipMe='gone';
 assert.equal(hashJsonStream(value,(holder,key,v)=>replacer.call(holder,key,v)),sha(JSON.stringify(value,replacer)));
 const root=mkdtempSync(join(tmpdir(),'cmeng-r17-write-'));
 try{const path=join(root,'s.json');writeSnapshotJson(path,value);assert.equal(readFileSync(path,'utf8'),JSON.stringify(value));}
 finally{rmSync(root,{recursive:true,force:true});}
});

test('R17 a value the fingerprint filter cannot touch hashes the same with or without calling the filter per key',()=>{
 const receipt=(i:number)=>i%7===0?['KEEP_'+i,'ROW_'+i+'_MIGRATION_V'+(i%9)]:['KEEP_'+i];
 const value:any={version:9,sourceIntegrationVersion:'v7',a:{b:{rows:Array.from({length:300},(_,i)=>({id:i,diagnostics:receipt(i),text:'MIGRATION_V not a code '+i,nested:{diagnostics:i%11===0?['X_REFRESH_V12']:[]}}))}},
  c:{d:{e:[{diagnostics:['PLAIN']},{diagnostics:['Y_MIGRATION_V5','Z']}]}},diagnostics:['TOP_MIGRATION_V1','TOP']};
 const filter=(holder:any,key:string,v:unknown)=>{if(holder===value&&(key==='version'||key==='sourceIntegrationVersion'))return undefined;
  if(key==='diagnostics'&&Array.isArray(v))return v.filter(c=>!(typeof c==='string'&&/^[A-Z0-9_]+_(?:MIGRATION|REFRESH)_V\d+$/.test(c)));return v;};
 const expected=sha(JSON.stringify(value,function(this:any,key,v){return filter(this,key,v);}));
 assert.equal(hashJsonStream(value,filter),expected);
 assert.equal(hashJsonStream(value,filter,text=>/_(?:MIGRATION|REFRESH)_V\d/.test(text)),expected);
 assert.notEqual(hashJsonStream(value),expected,'the filter does remove receipt codes here');
});
