import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {evidenceFamily} from '../packages/runtime-api/src/evidence-control';
import {canonicalTimeClaims} from '../packages/runtime-api/src/canonical-time-claims';
import {weeklyResourceCapacityEvidence as canonicalWeekly} from '../packages/runtime-api/src/canonical-resource-evidence';
import {canonicalHeader,prepareRegisterRows} from '../packages/truth-kernel/src';
import type {ProjectRuntimeState,StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';

// P0-C (C7, with M2.2 and M7.1a) invariant. A register's headings are read by one
// tolerant rule used by every reader: word order, plurals, abbreviations and a
// bare generic heading whose table says what it means all reach the same field.
// So the same register under two heading sets gives the same output on every
// reader; and a determination signed by the Employer's Representative as
// "Granted" is an award.

const stamp='2026-09-20T10:00:00.000Z';
function project(t:{after(fn:()=>void):unknown}){
  const dir=mkdtempSync(join(tmpdir(),'cmeng-c7-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('C7-'+Math.random().toString(36).slice(2));
  state.schedules.push({role:'update',format:'xer',sourceFilename:'p.xer',sourceHashSha256:'h',uploadedAt:stamp,
    revision:{revisionId:'U1',label:'Current',sequence:1,effectiveAt:'2026-08-31',model:{projectId:state.projectId,source:'xer',sourceRevisionId:'U1',dataDateIso:'2026-08-31T08:00:00',activities:[],relationships:[],wbs:[],calendars:[],diagnostics:[]}}} as unknown as ProjectRuntimeState['schedules'][number]);
  const csv=(text:string,type:string,category:string)=>{
    const hash=createHash('sha256').update(text).digest('hex'),id='doc-'+state.evidenceDocuments.length,path=join(dir,id+'.csv');writeFileSync(path,text);
    const family=evidenceFamily({category,documentType:type,scheduleRole:null,textSample:text,sourceFilename:id+'.csv'});
    state.evidenceDocuments.push({documentId:id,category,documentType:type,sourceFilename:id+'.csv',sourceRelativePath:null,mediaType:'text/csv',sourceHashSha256:hash,sizeBytes:Buffer.byteLength(text),storedPath:path,uploadedAt:stamp,
      authority:'candidate_only',parserState:'parsed',linkedArtifactId:null,scheduleRole:null,mapping:null,assertions:[],uploadIntent:'add_update',familyKey:family.familyKey,logicalDocumentKey:family.logicalDocumentKey,basisState:'active',supersedesDocumentIds:[],supersededByDocumentId:null,diagnostics:[],identification:{},lineage:{}} as unknown as StoredEvidenceDocument);
    state.version++;
  };
  return {state,csv};
}
const determinationSets={
  canonical:'Determination ID,Claim ID,Awarded EOT Days,Determination Date,Status,Authority\nD1,C1,15,2026-07-24,Determined,Engineer\nD2,C1,11,2026-08-16,Approved,Engineer',
  variant:'Determination No,Claim Ref,Days Awarded,Date,Status,Authority\nD1,C1,15,2026-07-24,Granted,Employer\'s Representative\nD2,C1,11,2026-08-16,Agreed,PMC',
};
const resourceSets={
  canonical:'Resource ID,Week Start,Available Capacity,Planned Demand,Unit,Capacity Approval\nL,2026-08-24,100,120,labor_hour,Approved\nL,2026-08-31,100,90,labor_hour,Approved',
  variant:'Resource ID,Week Commencing,Weekly Capacity,Demand,Unit,Capacity Approval\nL,2026-08-24,100,120,labor_hour,Approved\nL,2026-08-31,100,90,labor_hour,Approved',
};

test('C7: heading variants reach the same field, by one rule',()=>{
  for(const [variant,field] of [['Days Awarded','awarded eot days'],['EOT Days Awarded','awarded eot days'],['Weekly Capacity','available capacity'],['Actual Usage','actual approved usage'],
    ['Conservative Rate / Day','conservative achievable rate day'],['Qty Planned','planned quantity'],['Determination No','determination id']] as const)
    assert.equal(canonicalHeader(variant),field,variant);
  // A shape two fields share is never guessed; a generic heading stays generic unless its table says what it is.
  assert.equal(canonicalHeader('Date'),'date');
  assert.deepEqual(prepareRegisterRows([['Determination ID','Claim ID','Days','Date'],['D1','C1','5','2026-01-01']]).headers,['determination id','claim id','awarded eot days','determination date']);
  assert.deepEqual(prepareRegisterRows([['Determination ID','Claim ID','Date','Notice Date'],['D1','C1','2026-01-01','2026-01-02']]).headers.slice(2),['determination date','notice date']);
  assert.deepEqual(prepareRegisterRows([['RFI ID','Subject','Date'],['R1','x','2026-01-01']]).headers.at(-1),'date','no table context: not guessed');
});

test('C7: the same determinations register under two heading sets gives the same awards; Employer\'s Representative and "Granted" count',t=>{
  const read=(text:string)=>{const {state,csv}=project(t);csv(text,'delay_eot_claims_register','risk_claims_procurement');const m=canonicalTimeClaims(state);
    return {register:m.registerDeterminationDays,effective:m.effectiveDeterminationDays,ids:m.determinations?.map((d:any)=>[d.determinationId,d.awardedDays,d.determinationDate,d.state])};};
  const a=read(determinationSets.canonical),b=read(determinationSets.variant);
  assert.equal(a.register,26);assert.deepEqual(b,a);
});

test('C7 / M2.2: the same resource register under two heading sets gives the same capacity and demand',t=>{
  const read=(text:string)=>{const {state,csv}=project(t);csv(text,'resource_register','schedule_control');const w=canonicalWeekly(state.evidenceDocuments,'2026-08-31') as any;
    return (w.points??w.weekly??[]).map((p:any)=>[p.resourceId,p.weekStartIso??p.weekStart,p.availableCapacity??p.capacity,p.plannedDemand??p.demand]);};
  const a=read(resourceSets.canonical),b=read(resourceSets.variant);
  assert.ok(a.length>=2,'the canonical set is read: '+JSON.stringify(a));assert.deepEqual(b,a);
});
