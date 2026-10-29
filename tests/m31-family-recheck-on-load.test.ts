import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {inferEvidenceLineage} from '../packages/runtime-api/src/evidence';

// M3.1 / M3.2 invariants. A project saved under older family rules is decided
// again under the current rules when it loads (the same answer a fresh project
// gets); a file's predecessor is the latest current file of its family, never a
// held one and never itself.
const OLD='﻿Metric,Value,Currency/Unit,As Of\nEAC,4825000000,SAR,2026-07-02\nCPI,0.914,index,2026-07-02\n';
const LATEST='﻿Metric,Value,Currency/Unit,As Of,VAT Basis\nBAC,4175000000,SAR,2026-08-31,Exclusive of VAT\nPV,1000000000,SAR,2026-08-31,Exclusive of VAT\nEV,900000000,SAR,2026-08-31,Exclusive of VAT\nAC,950000000,SAR,2026-08-31,Exclusive of VAT\nEAC,4950000000,SAR,2026-08-31,Exclusive of VAT\n';

test('M3.1: a project saved with the old cost file current is corrected when it loads',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-m31-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('M31');
  const up=(name:string,body:string)=>store.ingestEvidenceFile({projectId:'M31',bytes:Buffer.from(body),mediaType:'text/csv',sourceFilename:name,uploadedAt:'2026-09-01'});
  await up('COST00_Old_EVM_DO_NOT_USE_AS_CURRENT.csv',OLD);await up('COST01_Latest_EVM.csv',LATEST);
  const doc=(s:any,prefix:string)=>s.evidenceDocuments.find((d:any)=>d.sourceFilename.startsWith(prefix));
  const fresh={old:doc(state,'COST00').basisState,latest:doc(state,'COST01').basisState};
  // Save the project in the shape older rules left it: the old file current, the latest held, no rules stamp.
  const path=join(dir,'cmeng-project-state.json'),saved=JSON.parse(readFileSync(path,'utf8'));
  const projects:any[]=Array.isArray(saved.projects)?saved.projects:Object.values(saved.projects);
  const stored=projects.find((p:any)=>p.projectId==='M31');delete stored.evidenceRulesVersion;
  const o=doc(stored,'COST00'),l=doc(stored,'COST01');
  o.basisState='active';o.supersededByDocumentId=null;o.supersedesDocumentIds=[];l.basisState='superseded';l.supersededByDocumentId=o.documentId;l.supersedesDocumentIds=[];
  writeFileSync(path,JSON.stringify(saved));
  const reloaded=new RuntimeProjectStore({dataDir:dir,durable:false}).get('M31')!;
  assert.deepEqual({old:doc(reloaded,'COST00').basisState,latest:doc(reloaded,'COST01').basisState},fresh,'loading gives the same answer as a fresh project');
  assert.notEqual(doc(reloaded,'COST00').basisState,'active','the DO_NOT_USE file is not current after loading');
});

test('M3.2: the predecessor is the latest current file of the family, never a held file or the same file',()=>{
  const base={category:'boq_cost',documentType:'cost_evm_report',familyKey:'boq_cost:cost_evm_report',scheduleRole:null,assertions:[]};
  const docs:any[]=[{...base,documentId:'A',basisState:'active',sourceHashSha256:'a'},{...base,documentId:'B',basisState:'candidate',sourceHashSha256:'b'},{...base,documentId:'C',basisState:'superseded',sourceHashSha256:'c'}];
  const lineage=(hash:string)=>inferEvidenceLineage({category:'boq_cost' as any,documentType:'cost_evm_report',textSample:'',existingDocuments:docs,sourceHashSha256:hash});
  assert.deepEqual(lineage('new').predecessorDocumentIds,['A'],'the active file, not the later held one');
  assert.deepEqual(lineage('a').predecessorDocumentIds,[],'a re-upload is not its own predecessor');
});
