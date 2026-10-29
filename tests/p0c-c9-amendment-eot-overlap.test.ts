import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {evidenceFamily} from '../packages/runtime-api/src/evidence-control';
import {canonicalTimeClaims} from '../packages/runtime-api/src/canonical-time-claims';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {contractTimeDates} from '../packages/runtime-api/src/contract-time-reader';
import {projectActions} from '../packages/runtime-api/src/project-actions';
import {openMissingValueInputs} from '../packages/runtime-api/src/missing-value-inputs';
import {summarizeControlIssues} from '../packages/truth-kernel/src';
import type {ProjectRuntimeState,StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';

// P0-C (C9, with M7.2) invariant. An effective amendment restates completion and
// the determinations register also awards EOT. Whether or not the amendment
// states how many days it contains, and whether the determinations are dated or
// not, CMeng proposes how many days are additional, so the governing completion
// is never lost while a contract date exists. The proposal is asked once in
// Project Review, pre-filled; the user's decision then replaces it everywhere.

process.env.CMENG_OCR_ENABLED='0';
const stamp='2026-09-20T10:00:00.000Z';
function fixture(t:{after(fn:()=>void):unknown}){
  const dir=mkdtempSync(join(tmpdir(),'cmeng-c9-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('C9-'+Math.random().toString(36).slice(2));
  state.schedules.push({role:'update',format:'xer',sourceFilename:'p.xer',sourceHashSha256:'schedule-hash',uploadedAt:stamp,
    revision:{revisionId:'U1',label:'Current',sequence:1,effectiveAt:'2026-08-31',model:{projectId:state.projectId,source:'xer',sourceRevisionId:'U1',dataDateIso:'2026-08-31T08:00:00',activities:[],relationships:[],wbs:[],calendars:[],diagnostics:[]}}} as unknown as ProjectRuntimeState['schedules'][number]);
  const contract=(id:string,role:'main'|'amendment',text:string,basisState='active')=>{
    state.evidenceDocuments.push({documentId:id,category:'contract',documentType:role==='main'?'contract_main':'contract_amendment',sourceFilename:id+'.pdf',sourceHashSha256:id+'-hash',uploadedAt:stamp,basisState,linkedArtifactId:null,diagnostics:[]} as unknown as StoredEvidenceDocument);
    state.contractDocuments.push({documentId:id,role,result:{sections:[{text,startPage:1,sectionKey:'preamble',sourceMode:'deterministic',sourceSpans:[],kind:'preamble',status:'verified',diagnostics:[]}],pdf:{pages:[]}}} as unknown as ProjectRuntimeState['contractDocuments'][number]);
    state.version++;
  };
  const determinations=(rows:Array<[string,number,string]>)=>{
    const text='Determination ID,Claim ID,Awarded EOT Days,Determination Date,Status,Authority,Governance State\n'+rows.map(([id,days,date])=>[id,'C1',days,date,'Determined','Engineer','Immutable'].join(',')).join('\n');
    const hash=createHash('sha256').update(text).digest('hex'),id='det-'+state.evidenceDocuments.length,path=join(dir,id+'.csv');writeFileSync(path,text);
    const family=evidenceFamily({category:'risk_claims_procurement',documentType:'delay_eot_claims_register',scheduleRole:null,textSample:text,sourceFilename:id+'.csv'});
    state.evidenceDocuments.push({documentId:id,category:'risk_claims_procurement',documentType:'delay_eot_claims_register',sourceFilename:id+'.csv',sourceRelativePath:null,mediaType:'text/csv',sourceHashSha256:hash,sizeBytes:Buffer.byteLength(text),storedPath:path,uploadedAt:stamp,
      authority:'candidate_only',parserState:'parsed',linkedArtifactId:null,scheduleRole:null,mapping:null,assertions:[],uploadIntent:'add_update',familyKey:family.familyKey,logicalDocumentKey:family.logicalDocumentKey,basisState:'active',supersedesDocumentIds:[],supersededByDocumentId:null,diagnostics:[],identification:{},lineage:{}} as unknown as StoredEvidenceDocument);
    state.version++;
  };
  return {store,state,contract,determinations};
}
const overlapItems=(state:ProjectRuntimeState)=>{const review=projectActions(state,summarizeControlIssues([],0));return [...review.actions,...review.information].filter(a=>a.target.kind==='review-eot-overlap'||/eot/i.test(a.id));};

// Each case: amendment text, an optional original contract, determinations, and the expected proposal.
const cases:Array<{name:string;amendment:string;original?:string;determinations:Array<[string,number,string]>;basis:string;days:number;governing:string}>=[
  {name:'amendment states its days',amendment:'Effective Date 15 August 2026\nRevised Contractual Completion 31 March 2030\nEOT Granted 20 calendar days',
    determinations:[['D1',15,'2026-07-24'],['D2',11,'2026-08-16'],['D3',112,'2026-09-08']],basis:'stated_in_amendment',days:6,governing:'2030-04-06'},
  {name:'no stated days, original contract date known',amendment:'Effective Date 15 August 2026\nRevised Contractual Completion 31 March 2030',original:'Original Contractual Completion 31 December 2029',
    determinations:[['D1',100,'2026-07-24'],['D2',20,'2026-08-16']],basis:'amendment_date_difference',days:30,governing:'2030-04-30'},
  {name:'no stated days, no original date, dated determinations',amendment:'Effective Date 15 August 2026\nRevised Contractual Completion 31 March 2030',
    determinations:[['D1',15,'2026-07-24'],['D2',11,'2026-08-16']],basis:'determination_dates',days:11,governing:'2030-04-11'},
  {name:'no stated days, no original date, one undated determination',amendment:'Effective Date 15 August 2026\nRevised Contractual Completion 31 March 2030',
    determinations:[['D1',15,'2026-07-24'],['D2',11,'']],basis:'determination_dates',days:11,governing:'2030-04-11'},
];

for(const c of cases)test('C9: '+c.name+': CMeng proposes the additional days, the governing date stands, and the question is asked once, pre-filled',t=>{
  const {state,contract,determinations}=fixture(t);
  if(c.original)contract('MAIN','main',c.original);
  contract('AMD','amendment',c.amendment,'additive');
  determinations(c.determinations);
  const basis=canonicalTimeClaims(state).contractTimeBasis;
  assert.equal(basis?.contractualCompletionIso,'2030-03-31');
  assert.equal(basis?.overlapProposal?.basis,c.basis,'proposal basis: '+JSON.stringify(basis?.overlapProposal));
  assert.equal(basis?.overlapProposal?.days,c.days,basis?.overlapProposal?.reason);
  // One shared governing date on every reader.
  const dates=contractTimeDates(state),facts=projectFactsForState(state) as any;
  assert.equal(dates.governingCompletionIso,c.governing,'the shared reader keeps a governing date');
  assert.equal(facts.time.governingContractCompletionIso.value,c.governing,'Project Facts');
  assert.equal(facts.time.extendedContractCompletionIso.value,c.governing,'the extended date shown is the same date');
  assert.equal(facts.time.extendedContractCompletionIso.complete,false,'it is marked as not confirmed');
  assert.ok(facts.time.extendedContractCompletionIso.diagnostics.includes('AMENDMENT_OVERLAP_PROPOSED_NOT_CONFIRMED'));
  // Asked exactly once, pre-filled; approved EOT days are not asked as a separate typed value.
  const items=overlapItems(state);
  assert.deepEqual(items.map(i=>i.id),['matter:eot-overlap'],'the overlap question is the one EOT question');
  assert.equal(items[0]!.category,'confirmation');
  assert.equal(items[0]!.target.reviewAdditionalDays,c.days,'pre-filled with the proposal');
  assert.ok(items[0]!.target.reviewOptions?.some(o=>o.value==='accept_proposal'));
  assert.ok(!openMissingValueInputs(state).has('approved-eot-days'),'the register holds the awards; no typed entry is asked');
});

test('C9: the user\'s decision replaces the proposal on every reader; ignoring the question keeps the proposal',t=>{
  const {state,contract,determinations}=fixture(t);
  contract('AMD','amendment','Effective Date 15 August 2026\nRevised Contractual Completion 31 March 2030','additive');
  determinations([['D1',15,'2026-07-24'],['D2',11,'2026-08-16']]);
  assert.equal(contractTimeDates(state).governingCompletionIso,'2030-04-11','ignored: the proposal stands');
  const item=overlapItems(state)[0]!;
  // The user decides that all 26 days are additional (the server stores the decision this way).
  state.controls.reviewDecisions={...(state.controls.reviewDecisions??{}),'eot-overlap':{choice:'confirm_additional_days',sourceFingerprint:item.reviewFingerprint!,additionalDays:26,reference:'',recordedAt:stamp} as any};
  state.version++;
  assert.equal(contractTimeDates(state).governingCompletionIso,'2030-04-26','the decision is used by the shared reader');
  const facts=projectFactsForState(state) as any;
  assert.equal(facts.time.governingContractCompletionIso.value,'2030-04-26');
  const after=overlapItems(state);
  assert.equal(after.length,1);assert.equal(after[0]!.category,'information','the decision stays reachable to change, not asked again');
  assert.equal(facts.time.extendedContractCompletionIso.value,'2030-04-26','the extended date shown is the decided date');
});

test('C9: a decision of zero additional days keeps the amended date everywhere (no other comparison replaces it)',t=>{
  const {state,contract,determinations}=fixture(t);
  contract('MAIN','main','Original Contractual Completion 31 December 2029');
  contract('AMD','amendment','Effective Date 15 August 2026\nRevised Contractual Completion 31 March 2030','additive');
  determinations([['D1',15,'2026-07-24'],['D2',11,'2026-08-16']]);
  const item=overlapItems(state)[0]!;
  assert.equal(item.target.reviewAdditionalDays,0,'the amendment (90 days) already holds the 26 awarded days');
  state.controls.reviewDecisions={...(state.controls.reviewDecisions??{}),'eot-overlap':{choice:'accept_proposal',sourceFingerprint:item.reviewFingerprint!,additionalDays:0,reference:'',recordedAt:stamp} as any};
  state.version++;
  const facts=projectFactsForState(state) as any;
  assert.equal(contractTimeDates(state).governingCompletionIso,'2030-03-31');
  assert.equal(facts.time.governingContractCompletionIso.value,'2030-03-31');
  assert.equal(facts.time.extendedContractCompletionIso.value??'2030-03-31','2030-03-31','never the original date plus the awards after the user decided');
});
