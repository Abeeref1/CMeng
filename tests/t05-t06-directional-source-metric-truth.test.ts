import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {resolveProjectControlNumberMetric} from '../packages/runtime-api/src/project-control-source-metrics';
import type {StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';

// Independent CSV source rows drive the real shared qualified-source reader.
// The expectations are literal source values, never calculated using CMeng.
function fixture(t:any, entries:ReadonlyArray<readonly [string,string]>) {
  const root=mkdtempSync(join(tmpdir(),'directional-source-metric-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:root,durable:false});
  const state=store.getOrCreate('DIRECTIONAL-MOVEMENT');
  const csv='Metric,Value,Unit\n'+entries.map(([label,value])=>[label,value,'days'].join(',')).join('\n');
  const path=join(root,'movement.csv');
  writeFileSync(path,csv);
  const sourceHashSha256=createHash('sha256').update(csv).digest('hex');
  const document={
    documentId:'SOURCE-MOVEMENT',category:'schedule_control',
    documentType:'schedule_metric_register',sourceFilename:'movement.csv',
    sourceRelativePath:null,mediaType:'text/csv',sourceHashSha256,
    sizeBytes:Buffer.byteLength(csv),storedPath:path,
    uploadedAt:'2032-09-01T10:00:00Z',authority:'candidate_only',
    parserState:'parsed',linkedArtifactId:null,scheduleRole:null,
    mapping:null,assertions:[],uploadIntent:'add_update',
    familyKey:'schedule_metric_register',logicalDocumentKey:'movement-register',
    basisState:'active',supersedesDocumentIds:[],
    supersededByDocumentId:null,diagnostics:[],identification:{},lineage:{},
  } as unknown as StoredEvidenceDocument;
  state.evidenceDocuments.push(document);
  state.version++;
  return {state,source:csv,document};
}

test('T05/T06 unsigned gross programme movement cannot become positive delay evidence',t=>{
  const {state,source,document}=fixture(t,[['Programme Gross Movement','21.5'],['Window Gross Movement','18']]);
  const before=JSON.stringify(state.evidenceDocuments);
  const positive=resolveProjectControlNumberMetric(state,'gross_positive_programme_movement');
  const negative=resolveProjectControlNumberMetric(state,'gross_negative_programme_movement');
  assert.equal(positive.value,null,'the source does not state a direction');
  assert.equal(positive.state,'missing');
  assert.equal(negative.value,null);
  assert.equal(negative.state,'missing');
  assert.equal(JSON.stringify(state.evidenceDocuments),before);
  assert.equal(document.sourceHashSha256,createHash('sha256').update(source).digest('hex'));
});

test('T05/T06 all three directionally explicit source word orders still qualify',t=>{
  const labels=['Gross positive programme movement','Positive programme movement days','Programme gross positive movement'];
  for(const label of labels){
    const {state}=fixture(t,[[label,'12.3456789']]);
    const result=resolveProjectControlNumberMetric(state,'gross_positive_programme_movement');
    assert.equal(result.value,12.3456789,label);
    assert.equal(result.state,'official',label);
    assert.equal(result.receipts.length,1,label);
    assert.equal(result.sourceRefs.length,1,label);
  }
});

test('T05/T06 source-precise conflicting numbers stay disputed, not silently equal after six decimals',t=>{
  const {state,source}=fixture(t,[
    ['Gross positive programme movement','7.0000001'],
    ['Gross positive programme movement','7.0000002'],
  ]);
  const before=JSON.stringify(state.evidenceDocuments);
  const result=resolveProjectControlNumberMetric(state,'gross_positive_programme_movement');
  assert.equal(result.state,'conflicted');
  assert.equal(result.value,null);
  assert.equal(result.receipts.length,2,'retain both independently read source rows');
  assert.ok(result.diagnostics.some(d=>d.includes('CONFLICTING_PROJECT_CONTROL_METRIC')));
  assert.equal(JSON.stringify(state.evidenceDocuments),before);
  assert.equal(createHash('sha256').update(source).digest('hex'),state.evidenceDocuments[0]!.sourceHashSha256);
});

test('T05/T06 negative direction is distinct from positive, with full original precision',t=>{
  const {state}=fixture(t,[['Gross negative programme movement','-4.1250009']]);
  const positive=resolveProjectControlNumberMetric(state,'gross_positive_programme_movement');
  const negative=resolveProjectControlNumberMetric(state,'gross_negative_programme_movement');
  assert.equal(positive.value,null);
  assert.equal(negative.value,-4.1250009);
  assert.equal(negative.state,'official');
});
