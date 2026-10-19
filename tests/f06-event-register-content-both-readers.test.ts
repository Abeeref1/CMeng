import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RuntimeProjectStore } from '../packages/runtime-api/src/project-state';
import { evidenceFamily } from '../packages/runtime-api/src/evidence-control';
import { canonicalTimeClaims } from '../packages/runtime-api/src/canonical-time-claims';
import { deriveControlsFromCsv, combineDelayModels } from '../packages/runtime-api/src/evidence-control-adapters';
import { detectEventSourceTable } from '../packages/runtime-api/src/event-source-register';
import { canonicalHeader } from '../packages/truth-kernel/src';
import type { CanonicalDelayEvent } from '../packages/delay-analysis-core/src';
import type { ProjectRuntimeState, StoredEvidenceDocument } from '../packages/runtime-api/src/project-state-types';

// SW-15 / F06: an event register is found by its headers or by its column
// content (identifiers, dates, descriptions, no claim columns, no amounts), and
// both claims readers (canonical-time-claims and evidence-control-adapters) read
// it with one shared reader, so they give the same events and dates.

process.env.CMENG_OCR_ENABLED='0';
const stamp='2026-09-20T10:00:00.000Z';
const claimsCsv='Claim ID,Event ID,Event,Event Start,Notice Date,Days Claimed,Status\n'+
  'C1,DR-01,Access to Zone A withheld,2026-06-01,2026-06-10,20,Submitted\n'+
  'C2,DR-01,Access to Zone A withheld (cost),2026-06-03,2026-06-20,5,Submitted\n'+
  'C3,DR-02,Late design approval,2026-07-01,2026-07-05,12,Submitted';

function project(t:{after(fn:()=>void):unknown},registers:string[]) {
  const dir=mkdtempSync(join(tmpdir(),'cmeng-f06-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false});
  const state=store.getOrCreate('F06');
  state.schedules.push({role:'update',format:'xer',sourceFilename:'u.xer',sourceHashSha256:'schedule-hash',uploadedAt:stamp,
    revision:{revisionId:'U1',label:'Current',sequence:1,effectiveAt:'2026-08-31',model:{projectId:'F06',source:'xer',sourceRevisionId:'U1',dataDateIso:'2026-08-31T08:00:00',activities:[],relationships:[],wbs:[],calendars:[],diagnostics:[]}}} as unknown as ProjectRuntimeState['schedules'][number]);
  const docs:StoredEvidenceDocument[]=[];
  [claimsCsv,...registers].forEach((text,index)=>{
    const id='doc-'+index,path=join(dir,id+'.csv');writeFileSync(path,text);
    const category='risk_claims_procurement',type='delay_eot_claims_register';
    const family=evidenceFamily({category,documentType:type,scheduleRole:null,textSample:text,sourceFilename:id+'.csv'});
    const doc={documentId:id,category,documentType:type,sourceFilename:id+'.csv',sourceRelativePath:null,mediaType:'text/csv',
      sourceHashSha256:createHash('sha256').update(text).digest('hex'),sizeBytes:Buffer.byteLength(text),storedPath:path,uploadedAt:stamp,
      authority:'candidate_only',parserState:'parsed',linkedArtifactId:null,scheduleRole:null,mapping:null,assertions:[],uploadIntent:'add_update',
      familyKey:family.familyKey+':'+index,logicalDocumentKey:family.logicalDocumentKey+':'+index,basisState:'active',supersedesDocumentIds:[],supersededByDocumentId:null,
      diagnostics:[],identification:{},lineage:{}} as unknown as StoredEvidenceDocument;
    state.evidenceDocuments.push(doc);docs.push(doc);
  });
  state.version++;
  return {state,docs};
}
const shape=(events:readonly CanonicalDelayEvent[])=>events.map(e=>({eventId:e.eventId,title:e.title,identitySource:e.identitySource,startIso:e.startIso,endIso:e.endIso,responsibility:e.responsibility}))
  .sort((a,b)=>a.eventId.localeCompare(b.eventId));
const adapterModel=(state:ProjectRuntimeState,doc:StoredEvidenceDocument)=>deriveControlsFromCsv({state,document:doc,bytes:readFileSync(doc.storedPath)}).delayClaims!;

function bothReadersAgree(t:{after(fn:()=>void):unknown},register:string,expectContent:boolean){
  const {state,docs}=project(t,[register]);
  const canonical=canonicalTimeClaims(state).delayClaims!;
  assert.deepEqual(shape(canonical.events),[
    {eventId:'DR-01',title:'Zone A access withheld by the Employer',identitySource:'event_register',startIso:'2026-05-01',endIso:null,responsibility:'employer'},
    {eventId:'DR-02',title:'Design approval issued late',identitySource:'event_register',startIso:'2026-06-25',endIso:null,responsibility:'employer'},
  ],'events and dates come from the register, not from the claim rows');
  assert.equal(canonical.events.every(e=>e.diagnostics.includes('EVENT_REGISTER_IDENTIFIED_BY_COLUMN_CONTENT')),expectContent);
  assert.deepEqual(canonical.claims.map(c=>[c.claimId,c.eventIds[0]]),[['C1','DR-01'],['C2','DR-01'],['C3','DR-02']],'claims stay claims and cite the events');
  const registerModel=adapterModel(state,docs[1]!);
  assert.deepEqual(registerModel.claims,[],'the register gives no claims');
  assert.deepEqual(shape(registerModel.events),shape(canonical.events),'the second reader gives the same events and dates');
  const combined=combineDelayModels(adapterModel(state,docs[0]!),registerModel);
  assert.deepEqual(shape(combined.events),shape(canonical.events),'merged with the claims register, both readers agree');
  assert.deepEqual(combined.claims.map(c=>c.claimId),['C1','C2','C3']);
  assert.deepEqual(shape(combineDelayModels(registerModel,adapterModel(state,docs[0]!)).events),shape(canonical.events),'upload order does not matter');
}

test('F06: an event register found by its headers is read the same by both claims readers',t=>{
  bothReadersAgree(t,'Event ID,Description,Event Date,Responsibility\nDR-01,Zone A access withheld by the Employer,2026-05-01,Employer\nDR-02,Design approval issued late,2026-06-25,Employer',false);
});

test('F06: an event register found by its column content (no event headers) is read the same by both claims readers',t=>{
  bothReadersAgree(t,'Delay Ref,Occurrence Date,Narrative,Cause\nDR-01,2026-05-01,Zone A access withheld by the Employer,Employer\nDR-02,2026-06-25,Design approval issued late,Employer',true);
});

test('F06: claims tables, amount tables and non-delay logs are never read as event registers',()=>{
  const detect=(documentType:string,raw:string[],rows:string[][])=>detectEventSourceTable({documentType,headers:raw.map(h=>canonicalHeader(h,documentType)),rawHeaders:raw,rows});
  // "Ref" is read by the shared schema as the claim id in a claims document: claims stay claims.
  assert.equal(detect('delay_eot_claims_register',['Ref','Event','Notice Date','Status'],[['CL-1','Access withheld','2026-06-10','Submitted'],['CL-2','Late approval','2026-07-05','Submitted']]),null);
  // A money column means claim amounts, never an event register.
  assert.equal(detect('delay_eot_claims_register',['Delay Ref','Occurrence Date','Narrative','Value'],[['DR-01','2026-05-01','Zone A access withheld','1000'],['DR-02','2026-06-25','Design approval late','2000']]),null);
  // Content alone never turns an RFI or NCR log into delay events.
  assert.equal(detect('rfi_register',['RFI No','Raised','Subject'],[['R-01','2026-05-01','Slab level query'],['R-02','2026-06-25','Door schedule query']]),null);
  // A column of repeated text is not a description of distinct events.
  assert.equal(detect('delay_eot_claims_register',['Delay Ref','Occurrence Date','Cause'],[['DR-01','2026-05-01','Employer delay'],['DR-02','2026-06-25','Employer delay']]),null);
});
