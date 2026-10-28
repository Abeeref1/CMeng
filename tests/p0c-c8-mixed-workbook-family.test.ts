import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ExcelJS from 'exceljs';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {deliveryRecords} from '../packages/runtime-api/src/delivery-records';
import {workbookStem} from '../packages/runtime-api/src/evidence-control';

// P0-C (C8) invariant. Every workbook that holds several register types was put
// in one shared evidence family, so an unrelated workbook could supersede or
// hold back another and its registers dropped out. A workbook is now its own
// family: unrelated workbooks never affect each other, revisions of the same
// workbook still replace each other, and projects saved under the old shared
// family are separated when they load.

const XLSX='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
async function workbook(prefix:string){
  const book=new ExcelJS.Workbook();
  const rfi=book.addWorksheet('RFI Log');rfi.addRow(['RFI ID','Subject','Discipline','Status','Raised Date','Due Date']);
  rfi.addRow([prefix+'-RFI-1','Slab levels','STR','Open','2031-08-01','2031-09-01']);rfi.addRow([prefix+'-RFI-2','Door schedule','ARCH','Closed','2031-08-03','2031-08-20']);
  const ncr=book.addWorksheet('NCR Log');ncr.addRow(['NCR ID','Description','Responsible','Status','Date Raised','Due Date']);
  ncr.addRow([prefix+'-NCR-1','Weld defect','QA Manager','Open','2031-08-05','2031-09-05']);
  return Buffer.from(await book.xlsx.writeBuffer());
}
async function project(t:any,id:string){
  const dir=mkdtempSync(join(tmpdir(),'cmeng-c8-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false});store.getOrCreate(id);
  const upload=(name:string,bytes:Buffer,intent='add_update')=>store.ingestEvidenceFile({projectId:id,bytes,mediaType:XLSX,sourceFilename:name,uploadedAt:'2031-09-01',uploadIntent:intent as any});
  return {dir,store,upload};
}
const refs=(state:any)=>new Set(deliveryRecords(state).records.filter(r=>r.state!=='superseded'&&r.sourceActive).map(r=>r.reference));

test('C8: workbook names keep their identity across revisions and nothing else',()=>{
  assert.equal(workbookStem('Package_A_Registers_Rev2_2031-09-30.xlsx'),workbookStem('Package_A_Registers_Rev1.xlsx'));
  assert.equal(workbookStem('Registers (2) latest.xlsx'),workbookStem('Registers.xlsx'));
  assert.notEqual(workbookStem('Package_A_Registers.xlsx'),workbookStem('Package_B_Registers.xlsx'));
});

test('C8: two unrelated mixed workbooks both stay in use; a revision of one replaces only that one',async t=>{
  const {store,upload}=await project(t,'C8-UNRELATED');
  await upload('Package_A_Registers.xlsx',await workbook('A'));
  await upload('Package_B_Registers.xlsx',await workbook('B'));
  const state=store.get('C8-UNRELATED')!;
  const docs=state.evidenceDocuments.filter(d=>d.documentType==='mixed_register_workbook');
  assert.equal(docs.length,2,'both workbooks must be read as mixed register workbooks: '+state.evidenceDocuments.map(d=>d.documentType).join(','));
  assert.notEqual(docs[0]!.familyKey,docs[1]!.familyKey,'unrelated workbooks must not share a family');
  assert.deepEqual(docs.map(d=>d.basisState).sort(),['active','active'],'neither workbook may supersede or hold the other');
  for(const ref of ['A-RFI-1','A-NCR-1','B-RFI-1','B-NCR-1'])assert.ok(refs(state).has(ref),ref+' dropped out');
  // A revision of workbook A replaces A only.
  await upload('Package_A_Registers_Rev2.xlsx',await workbook('A2'),'replace_current_basis');
  const now=refs(state);
  assert.ok(now.has('A2-RFI-1')&&now.has('B-RFI-1'),'the revision replaces A and keeps B');
  assert.ok(!now.has('A-RFI-1'),'the replaced revision of A is no longer current');
});

test('C8: a project saved under the old shared family is separated when it loads',async t=>{
  const {dir,store,upload}=await project(t,'C8-LEGACY');
  await upload('Package_A_Registers.xlsx',await workbook('A'));
  await upload('Package_B_Registers.xlsx',await workbook('B'));
  // Write the state back in the old shape: one shared family, B holding A back.
  const path=join(dir,'cmeng-project-state.json'),saved=JSON.parse(readFileSync(path,'utf8'));
  const projects:any[]=Array.isArray(saved.projects)?saved.projects:Object.values(saved.projects);
  const stored=projects.find((p:any)=>p.projectId==='C8-LEGACY');
  for(const d of stored.evidenceDocuments.filter((d:any)=>d.documentType==='mixed_register_workbook')){d.familyKey='other:mixed_register_workbook';d.logicalDocumentKey='other:mixed_register_workbook';}
  const a=stored.evidenceDocuments.find((d:any)=>d.sourceFilename==='Package_A_Registers.xlsx'),b=stored.evidenceDocuments.find((d:any)=>d.sourceFilename==='Package_B_Registers.xlsx');
  a.basisState='superseded';a.supersededByDocumentId=b.documentId;b.supersedesDocumentIds=[a.documentId];
  writeFileSync(path,JSON.stringify(saved));
  const reloaded=new RuntimeProjectStore({dataDir:dir,durable:false}).get('C8-LEGACY')!;
  const docs=reloaded.evidenceDocuments.filter(d=>d.documentType==='mixed_register_workbook');
  assert.notEqual(docs[0]!.familyKey,docs[1]!.familyKey);
  assert.deepEqual(docs.map(d=>d.basisState).sort(),['active','active'],'loading must separate the workbooks and restore A');
  assert.ok(refs(reloaded).has('A-RFI-1'),'A\'s registers are back in use after loading');
});
