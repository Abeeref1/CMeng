import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {readSnapshotJson,writeSnapshotJson} from '../packages/runtime-api/src/snapshot-json';

const xer=Buffer.from(['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tdata_date','%R\t1\tSAVE\t2026-09-18','%T\tPROJWBS','%F\twbs_id\tproj_id\twbs_short_name','%R\t10\t1\tROOT','%T\tTASK','%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t100\t1\t10\tA100\tMobilise\tTK_Active\t2026-09-01\t2026-09-02\t16\t8','%E'].join('\n'));
const input={projectId:'SAVE',bytes:xer,mediaType:'text/plain',sourceFilename:'Current.xer',role:'update',uploadedAt:'2026-09-26T00:00:00Z'};

for(const phase of ['source','snapshot'])test('failed '+phase+' writes restore saved state; retry cannot acknowledge an unsaved revision',async t=>{
 const root=fs.mkdtempSync(join(tmpdir(),'cmeng-save-failure-'));
 try{
  const store=new RuntimeProjectStore({dataDir:root});store.getOrCreate('SAVE');
  const path=store.persistenceStatus().stateFile,before=fs.readFileSync(path,'utf8');
  const original=fs.writeSync;
  const fault=t.mock.method(fs,'writeSync',(...args:any[])=>{if(phase==='source'||Buffer.from(args[1]).subarray(0,1).toString()==='{')throw Object.assign(new Error('Disk full'),{code:'ENOSPC'});return (original as Function)(...args);});
  for(let i=0;i<2;i++){
   await assert.rejects(store.ingestSchedule(input),(error:any)=>error.statusCode===503&&error.code==='PROJECT_SAVE_NOT_CONFIRMED');
   assert.equal(store.get('SAVE')!.schedules.length,0);assert.equal(store.get('SAVE')!.evidenceDocuments.length,0);
   assert.equal(fs.readFileSync(path,'utf8'),before);assert.ok(!fs.readdirSync(root).some(p=>p.endsWith('.tmp')));
  }
  fault.mock.restore();
  const saved=await store.ingestSchedule(input),retry=await store.ingestSchedule(input);assert.equal(saved.revisionId,retry.revisionId);
  const restored=new RuntimeProjectStore({dataDir:root});assert.equal(restored.get('SAVE')!.schedules.length,1);assert.equal(restored.get('SAVE')!.evidenceDocuments.length,1);
 }finally{t.mock.restoreAll();fs.rmSync(root,{recursive:true,force:true});}
});

test('failed deletion keeps the original source file and the saved evidence register',async t=>{
 const root=fs.mkdtempSync(join(tmpdir(),'cmeng-delete-failure-'));
 try{
  const store=new RuntimeProjectStore({dataDir:root});await store.ingestSchedule(input);
  const document=store.get('SAVE')!.evidenceDocuments[0]!,before=fs.readFileSync(document.storedPath!);
  const fault=t.mock.method(fs,'renameSync',()=>{throw Object.assign(new Error('Rename failed'),{code:'EACCES'});});
  assert.throws(()=>store.deleteEvidenceDocument('SAVE',document.documentId),(e:any)=>e.statusCode===503);
  assert.deepEqual(fs.readFileSync(document.storedPath!),before);assert.equal(store.get('SAVE')!.evidenceDocuments[0]!.documentId,document.documentId);
  fault.mock.restore();const restored=new RuntimeProjectStore({dataDir:root});assert.equal(restored.get('SAVE')!.schedules.length,1);
 }finally{t.mock.restoreAll();fs.rmSync(root,{recursive:true,force:true});}
});

test('bounded snapshot encoding preserves JSON values, Arabic, escaped text, surrogate boundaries and shared references',()=>{
 const root=fs.mkdtempSync(join(tmpdir(),'cmeng-json-'));
 try{
  const path=join(root,'snapshot.json'),shared={text:'نص عربي',number:0.000001},value={shared,again:shared,absent:undefined,array:[undefined,NaN,Infinity],date:new Date('2031-01-01'),omitted:{toJSON:()=>undefined},long:'x'.repeat(16383)+'\u{1F600}'+('\n"\\\u0001ع'.repeat(10000)),special:JSON.parse('{"__proto__":{"retained":true},"constructor":"source"}')};
  writeSnapshotJson(path,value);assert.deepEqual(readSnapshotJson(path),JSON.parse(JSON.stringify(value)));
  const before=fs.readFileSync(path);const circular:any={};circular.self=circular;assert.throws(()=>writeSnapshotJson(path,circular));assert.deepEqual(fs.readFileSync(path),before);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('large snapshot restore is complete and rejects truncation or trailing invalid data',()=>{
 const root=fs.mkdtempSync(join(tmpdir(),'cmeng-json-large-'));
 try{
  const path=join(root,'snapshot.json'),row='العربية "quoted" \\ text\n'.repeat(1000),value={rows:Array(1600).fill(row),special:JSON.parse('{"__proto__":{"retained":true},"constructor":"source"}')};
  writeSnapshotJson(path,value);assert.ok(fs.statSync(path).size>32*1024*1024);
  assert.deepEqual(readSnapshotJson(path),value);assert.equal(({} as any).retained,undefined);
  fs.appendFileSync(path,'bad');assert.throws(()=>readSnapshotJson(path));
  fs.truncateSync(path,fs.statSync(path).size-10);assert.throws(()=>readSnapshotJson(path));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
