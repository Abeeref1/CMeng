import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

import {analyzeEvidenceTable,sourceTables,type EvidenceDocument} from '../packages/truth-kernel/src';

test('Evidence Table Intelligence infers opaque identifiers, dates and cumulative/incremental relations without register aliases',()=>{
  const rows=[
    ['ABC','XYZ','Q1','Q2','ZZ'],
    ['X001','01/08/2036','100000','100000','Open'],
    ['X002','15/08/2036','150000','50000','Open'],
    ['X003','30/08/2036','210000','60000','Review'],
    ['X004','15/09/2036','275000','65000','Review'],
    ['X005','30/09/2036','360000','85000','Closed'],
    ['X006','15/10/2036','450000','90000','Closed'],
  ];
  const result=analyzeEvidenceTable(rows);
  assert.equal(result.headerRowIndex,0);
  assert.equal(result.structurallyReadable,true);
  const id=result.columns[0]!,date=result.columns[1]!,cumulative=result.columns[2]!,incremental=result.columns[3]!;
  assert.ok(id.roleCandidates.some(r=>r.role==='record_identifier'&&r.confidence>=0.8));
  assert.ok(date.roleCandidates.some(r=>r.role==='reporting_date'&&r.confidence>=0.8));
  assert.ok(cumulative.roleCandidates.some(r=>r.role==='cumulative_value'));
  assert.ok(result.relationships.some(r=>r.kind==='cumulative_delta'&&r.columns[0]===2&&r.columns[1]===3&&r.confidence>=0.8));
  assert.ok(incremental.roleCandidates.some(r=>r.role==='incremental_value'||r.role==='amount'));
});

test('Evidence Table Intelligence reads Arabic digits, Arabic separators and mixed headings from values',()=>{
  const rows=[
    ['مرجع','تاريخ','القيمة','النسبة','عملة'],
    ['أ-١','٠١/٠٨/٢٠٣٦','١٬٢٥٠٬٠٠٠٫٥٠','٢٥%','AED'],
    ['أ-٢','١٥/٠٨/٢٠٣٦','١٬٥٠٠٬٠٠٠٫٧٥','٥٠%','AED'],
    ['أ-٣','٣٠/٠٨/٢٠٣٦','١٬٧٥٠٬٠٠٠٫٢٥','٧٥%','AED'],
  ];
  const result=analyzeEvidenceTable(rows);
  assert.equal(result.structurallyReadable,true);
  assert.ok(result.columns[0]!.identifierCandidate);
  assert.ok((result.columns[1]!.dateRatio??0)>=0.99);
  assert.ok((result.columns[2]!.numericRatio??0)>=0.99);
  assert.ok((result.columns[3]!.percentageRatio??0)>=0.99);
  assert.ok((result.columns[4]!.currencyCodeRatio??0)>=0.99);
  assert.doesNotMatch(JSON.stringify(result),/NaN|Infinity/);
});

test('Source-specific confirmation changes only the shared read meaning and preserves raw header audit',t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-confirmed-table-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,'opaque.csv');
  const bytes=Buffer.from('A,B,C\nR-1,2036-08-01,100\nR-2,2036-08-15,150\nR-3,2036-08-30,200\n');
  writeFileSync(path,bytes);
  const hash=createHash('sha256').update(bytes).digest('hex');
  const base:EvidenceDocument={
    documentId:'doc-1',sourceHashSha256:hash,storedPath:path,sourceFilename:'opaque.csv',mediaType:'text/csv',basisState:'active',
    linkedArtifactId:null,uploadedAt:'2036-09-01',familyKey:'other:opaque',documentType:'supporting_document',
  };
  const unconfirmed=sourceTables([base],[]);
  assert.equal(unconfirmed.length,1);
  assert.equal(unconfirmed[0]!.intelligence.columns[0]!.rawHeader,'A');
  assert.ok(!unconfirmed[0]!.headers.includes('certificate no'));

  const confirmed:EvidenceDocument={...base,tableConfirmations:[{
    sheetName:'CSV',columnIndex:0,rawHeader:'A',meaning:'certificate no',confirmedAt:'2036-09-02',note:'Confirmed for this source only.',
  }]};
  const reread=sourceTables([confirmed],[]);
  assert.equal(reread.length,1);
  assert.ok(reread[0]!.headers.includes('certificate no'));
  assert.equal(reread[0]!.intelligence.columns[0]!.rawHeader,'A');
  assert.equal(reread[0]!.intelligence.columns[0]!.confirmedMeaning,'certificate no');

  const another:EvidenceDocument={...base,documentId:'doc-2',familyKey:'other:opaque-2'};
  const anotherRead=sourceTables([another],[]);
  assert.ok(!anotherRead[0]!.headers.includes('certificate no'),'confirmation must never leak to another document');
});
