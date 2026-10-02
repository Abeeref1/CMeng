import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {sourceTables} from '../packages/truth-kernel/src';
import {defaultBlindSeed,generateBlindRound} from './blind-project-generator';

test('Batch J blind round: fresh generated projects survive real ingestion and shared table intelligence',async t=>{
  const seed=defaultBlindSeed();
  process.stdout.write('\nCMENG_BLIND_GENERATOR_SEED='+seed+'\n');
  const {projects}=await generateBlindRound(seed,24);

  assert.equal(new Set(projects.map(p=>p.projectId)).size,24,'project IDs must be unique');
  assert.equal(new Set(projects.map(p=>p.scenario)).size,8,'every evidence scenario must be exercised each round');
  assert.equal(new Set(projects.map(p=>p.language)).size,3,'English, Arabic and mixed evidence must all be exercised');
  assert.ok(new Set(projects.map(p=>p.currency)).size>=7,'currency coverage');
  assert.ok(projects.some(p=>p.documents.some(d=>d.kind==='csv')),'CSV evidence required');
  assert.ok(projects.some(p=>p.documents.some(d=>d.kind==='xlsx')),'Excel evidence required');
  assert.ok(projects.every(p=>p.documents.some(d=>d.kind==='xer')),'every project must have an independently generated XER');

  const dir=mkdtempSync(join(tmpdir(),'cmeng-blind-round-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false});

  let generatedTabular=0,readableTabular=0,opaquePreserved=0;
  const failures:Array<Record<string,unknown>>=[];

  for(const project of projects){
    for(const document of project.documents){
      try{
        await store.ingestEvidenceFile({
          projectId:project.projectId,
          sourceFilename:document.filename,
          sourceRelativePath:document.filename,
          bytes:document.bytes,
          mediaType:document.mediaType,
          uploadedAt:'2036-12-31T00:00:00.000Z',
          uploadIntent:'add_update',
        });
      }catch(error){
        failures.push({projectId:project.projectId,scenario:project.scenario,domain:document.domain,filename:document.filename,error:error instanceof Error?error.message:String(error)});
      }
    }
    await store.refreshSpreadsheetRegisters(project.projectId);
    const state=store.get(project.projectId);
    assert.ok(state,'project retained: '+project.projectId);
    assert.ok((state?.schedules.length??0)>0,'generated XER must create schedule evidence: '+project.projectId);

    const diagnostics:string[]=[];
    const tables=sourceTables(state!.evidenceDocuments,diagnostics,{includeHistorical:true});
    assert.ok(!diagnostics.some(x=>x.startsWith('SOURCE_HASH_MISMATCH')||x.startsWith('SOURCE_READ_FAILURE')),
      project.projectId+' source preservation: '+diagnostics.join(','));

    for(const document of project.documents.filter(d=>d.kind==='csv'||d.kind==='xlsx')){
      generatedTabular++;
      const matched=tables.filter(table=>table.document.sourceFilename===document.filename);
      const ingestFailure=failures.find(f=>f.projectId===project.projectId&&f.filename===document.filename);
      const retained=state!.evidenceDocuments.filter(d=>d.sourceFilename===document.filename).map(d=>({
        documentId:d.documentId,documentType:d.documentType,category:d.category,basisState:d.basisState,
        parserState:d.parserState,sourceHashSha256:d.sourceHashSha256,storedPath:d.storedPath,
        derivedRegisterRead:d.derivedRegisterRead??null,diagnostics:d.diagnostics,
      }));
      assert.ok(matched.length>0,'tabular evidence disappeared: '+project.projectId+' / '+document.filename+
        '; ingestFailure='+JSON.stringify(ingestFailure??null)+'; retained='+JSON.stringify(retained)+
        '; sourceDiagnostics='+JSON.stringify(diagnostics));
      if(document.truth.rows>0){
        if(matched.some(table=>table.intelligence.structurallyReadable&&table.intelligence.dataRowCount>0))readableTabular++;
        else failures.push({projectId:project.projectId,scenario:project.scenario,domain:document.domain,filename:document.filename,error:'TABLE_NOT_STRUCTURALLY_READABLE',intelligence:matched.map(t=>t.intelligence)});
      }
      if(matched.some(table=>table.recognition?.recognized===false&&table.intelligence.structurallyReadable))opaquePreserved++;
      for(const table of matched){
        assert.equal(table.intelligence.producerVersion,'evidence-table-intelligence-v1');
        assert.ok(table.intelligence.columnCount>=0);
        assert.doesNotMatch(JSON.stringify(table.intelligence),/NaN|Infinity/);
      }
    }
  }

  assert.equal(failures.filter(f=>String(f.error)!=='TABLE_NOT_STRUCTURALLY_READABLE').length,0,
    'blind ingestion failures seed='+seed+' '+JSON.stringify(failures.slice(0,8)));
  assert.ok(generatedTabular>=40,'round must exercise many independent tables');
  assert.ok(readableTabular>=Math.floor(generatedTabular*0.70),'most non-empty generated tables must be structurally readable seed='+seed);
  assert.ok(opaquePreserved>0,'at least one readable but legacy-unrecognised table must remain preserved; proves unknown schema is not discarded');
});

test('Batch J blind generator: same seed reproduces exact project truth, different seed changes it',async()=>{
  const a=await generateBlindRound('replay-seed-A',6);
  const b=await generateBlindRound('replay-seed-A',6);
  const c=await generateBlindRound('replay-seed-B',6);
  const manifest=(round:typeof a)=>round.projects.map(p=>({
    projectId:p.projectId,projectName:p.projectName,language:p.language,currency:p.currency,dataDateIso:p.dataDateIso,scenario:p.scenario,
    docs:p.documents.map(d=>({filename:d.filename,kind:d.kind,domain:d.domain,truth:d.truth})),truth:p.truth,
  }));
  assert.deepEqual(manifest(a),manifest(b),'same seed must reproduce the same blind round');
  assert.notDeepEqual(manifest(a),manifest(c),'different seed must produce a different blind round');
});
