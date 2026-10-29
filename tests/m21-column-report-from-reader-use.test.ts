import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {projectDocumentRegister} from '../packages/runtime-api/src/server';
import {consumedColumnsFor,registerReaderColumns} from '../packages/truth-kernel/src';
import type {ProjectRuntimeState,StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';

// M2.1 invariant: the column report equals what the readers consumed. A column
// is reported as read only when a CMeng reader read it for that document, and
// every column a reader read is reported as read. A heading that is in the old
// recognition word list but that no reader reads is reported as not used.

process.env.CMENG_OCR_ENABLED='0';
function project(t:{after(fn:()=>void):unknown}){
  const dir=mkdtempSync(join(tmpdir(),'m21-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const state=runtimeProjects.getOrCreate('M21-'+randomUUID().slice(0,8).toUpperCase());
  const model={projectId:state.projectId,source:'xer',sourceRevisionId:'C',dataDateIso:'2031-04-15T08:00:00',wbs:[],relationships:[],calendars:[],diagnostics:[],activities:[]};
  state.schedules.push({role:'update',format:'xer',sourceFilename:'u.xer',sourceHashSha256:'u',uploadedAt:'2031-05-01',revision:{revisionId:'C',label:'U',sequence:1,effectiveAt:'2031-04-15',model}} as unknown as ProjectRuntimeState['schedules'][number]);
  const csv=(id:string,documentType:string,category:string,text:string)=>{const path=join(dir,id+'.csv');writeFileSync(path,text);
    state.evidenceDocuments.push({documentId:id,sourceFilename:id+'.csv',sourceRelativePath:null,storedPath:path,sourceHashSha256:createHash('sha256').update(text).digest('hex'),mediaType:'text/csv',sizeBytes:text.length,
      basisState:'active',linkedArtifactId:null,category,documentType,familyKey:id,logicalDocumentKey:id,uploadedAt:'2031-05-01',diagnostics:[],assertions:[],authority:'candidate_only',parserState:'parsed',scheduleRole:null,mapping:null,uploadIntent:'add_update',supersedesDocumentIds:[],supersededByDocumentId:null,identification:{},lineage:{}} as unknown as StoredEvidenceDocument);
    state.version++;};
  return {state,csv};
}
function usage(projectId:string,documentId:string){
  const register:any=projectDocumentRegister(projectId);
  const doc=register.documents.find((d:any)=>d.documentId===documentId);
  return doc.columnUsage[0];
}

test('M2.1: the column report is what the readers consumed, for determinations, NCR and payment registers',t=>{
  const {state,csv}=project(t);
  csv('DET','delay_eot_claims_register','risk_claims_procurement','Determination ID,Claim ID,Days,Date,Source Letter,Status,Value\nD1,C1,15,2031-03-01,L-77,Determined,12\nD2,C1,11,2031-03-20,L-80,Determined,9');
  csv('NCR','quality_ncr_register','design_quality','NCR ID,Description,Raised Date,Status,Severity,Responsible Party,Value\nN1,Honeycombing,2031-03-02,Open,Major,QA Lead,3');
  csv('PAY','payment_certificate_register','boq_cost','Certificate No,Payment Type,Period End,Certificate Date,Gross Work,Net Certified,Currency,Certified Amount Basis\nIPC1,Interim,2031-03-31,2031-04-01,100,90,AED,Incremental');
  for(const id of ['DET','NCR','PAY']){
    const u=usage(state.projectId,id),doc=state.evidenceDocuments.find(d=>d.documentId===id)!;
    const consumed=consumedColumnsFor(id),declared=registerReaderColumns(u.canonicalColumns,doc.documentType);
    // Read <=> consumed, column by column (canonical columns align with the physical ones).
    const physicalHeaders=[...u.mappedColumns,...u.notUsedColumns.map((c:any)=>c.column)];
    for(const [i,key] of (u.canonicalColumns as string[]).entries()){
      const read=consumed.has(key)||declared.has(key);
      const shownAsRead=physicalHeaders.includes(physicalRaw(id,i))&&!u.notUsedColumns.some((c:any)=>c.column===physicalRaw(id,i));
      assert.equal(shownAsRead,read,id+': column '+key+' is reported '+(shownAsRead?'read':'not used')+' but '+(read?'a reader consumed it':'no reader consumed it'));
    }
  }
  const det=usage(state.projectId,'DET');
  for(const header of ['Date','Source Letter','Days'])assert.ok(det.mappedColumns.includes(header),'determinations: '+header+' is read by the determination reader');
  assert.ok(det.notUsedColumns.some((c:any)=>c.column==='Value'),'a word-list heading no reader reads is not used');
  assert.ok(usage(state.projectId,'NCR').notUsedColumns.some((c:any)=>c.column==='Value'),'NCR: unread heading is not used');
});
const RAW:Record<string,string[]>={DET:['Determination ID','Claim ID','Days','Date','Source Letter','Status','Value'],NCR:['NCR ID','Description','Raised Date','Status','Severity','Responsible Party','Value'],
  PAY:['Certificate No','Payment Type','Period End','Certificate Date','Gross Work','Net Certified','Currency','Certified Amount Basis']};
function physicalRaw(id:string,i:number){return RAW[id]![i]!;}
