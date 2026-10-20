import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RuntimeProjectStore } from '../packages/runtime-api/src/project-state';
import { evidenceFamily } from '../packages/runtime-api/src/evidence-control';
import { canonicalTimeClaims } from '../packages/runtime-api/src/canonical-time-claims';
import { detailedClaimTimeBar } from '../packages/runtime-api/src/detailed-claim-time-bar';
import { buildClaimChecks } from '../packages/runtime-api/src/project-decision-facts';
import { askClaimRegisterColumns } from '../packages/runtime-api/src/ask-authorities';
import { delayClaimsAsOf } from '../packages/delay-analysis-core/src/reporting';
import type { NoticeRequirement } from '../packages/delay-analysis-core/src';
import type { ProjectRuntimeState, StoredEvidenceDocument } from '../packages/runtime-api/src/project-state-types';
import { runInNewContext } from './browser-context';

// F13: the claims register's responsibility, awareness date and determination
// columns are carried onto every claim (claims, EOT and notices pages, Ask).
// F47: per claim, the detailed-claim submission is checked against the contract's
// own detailed-claim period from the stated trigger with the shared notice rules.

process.env.CMENG_OCR_ENABLED='0';
const stamp='2026-09-20T10:00:00.000Z';
function registerState(t:{after(fn:()=>void):unknown}){
  const dir=mkdtempSync(join(tmpdir(),'cmeng-f13-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false});
  const state=store.getOrCreate('F13');
  state.schedules.push({role:'update',format:'xer',sourceFilename:'u.xer',sourceHashSha256:'schedule-hash',uploadedAt:stamp,
    revision:{revisionId:'U1',label:'Current',sequence:1,effectiveAt:'2026-08-31',model:{projectId:'F13',source:'xer',sourceRevisionId:'U1',dataDateIso:'2026-08-31T08:00:00',activities:[],relationships:[],wbs:[],calendars:[],diagnostics:[]}}} as unknown as ProjectRuntimeState['schedules'][number]);
  const text='Claim ID,Event ID,Event,Event Start,Awareness Date,Responsibility,Notice Date,Detailed Claim Date,Days Claimed,Status,Determination,Determination Date\n'+
    'C1,EV-1,Access to Zone A withheld,2026-01-01,2026-01-05,Employer,2026-01-20,2026-02-10,20,Determined,Engineer determined 12 days,2026-04-01\n'+
    'C2,EV-2,Subcontractor late mobilisation,2026-02-01,2026-02-03,Contractor,2026-02-20,2026-05-30,5,Submitted,,\n'+
    'C3,EV-3,Exceptional rainfall,2026-03-01,,Neutral event,2026-03-10,,12,Submitted,,';
  const id='doc-claims',path=join(dir,id+'.csv');writeFileSync(path,text);
  const category='risk_claims_procurement',type='delay_eot_claims_register';
  const family=evidenceFamily({category,documentType:type,scheduleRole:null,textSample:text,sourceFilename:id+'.csv'});
  state.evidenceDocuments.push({documentId:id,category,documentType:type,sourceFilename:id+'.csv',sourceRelativePath:null,mediaType:'text/csv',
    sourceHashSha256:createHash('sha256').update(text).digest('hex'),sizeBytes:Buffer.byteLength(text),storedPath:path,uploadedAt:stamp,
    authority:'candidate_only',parserState:'parsed',linkedArtifactId:null,scheduleRole:null,mapping:null,assertions:[],uploadIntent:'add_update',
    familyKey:family.familyKey,logicalDocumentKey:family.logicalDocumentKey,basisState:'active',supersedesDocumentIds:[],supersededByDocumentId:null,
    diagnostics:[],identification:{},lineage:{}} as unknown as StoredEvidenceDocument);
  state.version++;
  return state;
}
const rule=(days:number):NoticeRequirement=>({requirementId:'contract:detailed_claim:'+days,sourceFilename:'contract.pdf',noticeKind:'detailed_claim',eventCategories:[],
  noticePeriodDays:days,triggerBasis:'awareness',state:'official',clauseIdentifiers:['20.2.4'],evidenceRefs:[{sourceType:'contract',sourceId:'contract',locator:'page:5'}]});

test('F13: responsibility, awareness date and determination columns are carried on each claim',t=>{
  const model=canonicalTimeClaims(registerState(t)).delayClaims!;
  assert.ok(model);
  const c=Object.fromEntries(model.claims.map(x=>[x.claimId,x.sourceRegister!]));
  assert.equal(c.C1!.responsibility,'employer');assert.equal(c.C1!.responsibilitySourceText,'Employer');
  assert.equal(c.C2!.responsibility,'contractor');
  assert.equal(c.C3!.responsibility,'neutral');assert.equal(c.C3!.responsibilitySourceText,'Neutral event');
  assert.equal(c.C1!.awarenessIso,'2026-01-05');assert.equal(c.C2!.awarenessIso,'2026-02-03');
  assert.equal(c.C3!.awarenessIso,null,'a missing awareness date stays unknown');
  assert.deepEqual(c.C1!.registerDetermination,{text:'Engineer determined 12 days',dateIso:'2026-04-01',days:null,reference:null});
  assert.equal(c.C2!.registerDetermination,null,'no determination in the register stays null');
  assert.equal(c.C1!.detailedClaimSubmittedIso,'2026-02-10');assert.equal(c.C3!.detailedClaimSubmittedIso,null);
  // No detailed-claim rule in any contract: never a default 42 or 84 days.
  for(const x of Object.values(c)){assert.equal(x.detailedClaimTimeBar!.status,'not_established');assert.equal(x.detailedClaimTimeBar!.allowedDays,null);}
  // The columns survive the dated reporting view used by the claims, EOT and notices pages.
  const rows=delayClaimsAsOf(model,'2026-08-31').reported.rows;
  const r1=rows.find(r=>r.claimId==='C1')!;
  assert.equal(r1.responsibility,'employer');assert.equal(r1.awarenessIso,'2026-01-05');assert.ok(r1.detailedClaimTimeBar);
  // Ask table cells carry the flattened determination and time-bar values.
  const ask=askClaimRegisterColumns(r1);
  assert.equal(ask.registerDeterminationText,'Engineer determined 12 days');assert.equal(ask.registerDeterminationDateIso,'2026-04-01');
  assert.equal(ask.detailedClaimStatus,'not_established');
});

test('F47: detailed claim on time / late / not established against the contract period from awareness',()=>{
  const at=(awarenessIso:string|null,submittedIso:string|null,rules=[rule(42)])=>detailedClaimTimeBar({awarenessIso,eventStartIso:'2026-01-01',submittedIso,cutoffIso:'2026-08-31'},rules);
  const onTime=at('2026-01-05','2026-02-10');
  assert.equal(onTime.status,'on_time');assert.equal(onTime.dueDateIso,'2026-02-16');assert.equal(onTime.allowedDays,42);assert.equal(onTime.daysToSubmission,36);
  assert.equal(onTime.triggerBasis,'awareness');assert.equal(onTime.triggerDateIso,'2026-01-05');
  assert.match(onTime.basis,/42 calendar days from awareness/);assert.ok(onTime.sourceRefs.includes('contract:contract:page:5'));
  assert.match(String(onTime.ruleReference),/contract\.pdf \(page:5\)/);
  const late=at('2026-02-03','2026-05-30');
  assert.equal(late.status,'late');assert.equal(late.dueDateIso,'2026-03-17');assert.equal(late.daysToSubmission,116);assert.equal(late.daysAfterDue,74);
  // The contract's own period is used (84 days FIDIC 20.2.4 makes the same claim on time).
  assert.equal(at('2026-02-03','2026-04-20',[rule(84)]).status,'on_time');
  assert.equal(at('2026-02-03','2026-04-29',[rule(84)]).status,'late');
  // Due date passed with no submission recorded: not established, never late.
  const missing=at('2026-02-03',null);
  assert.equal(missing.status,'not_established');assert.equal(missing.sourceState,'overdue_no_submission');assert.equal(missing.dueDateIso,'2026-03-17');
  // Missing awareness, no rule, two conflicting rules, working-day rule: not established.
  for(const x of [at(null,'2026-02-10'),at('2026-01-05','2026-02-10',[]),at('2026-01-05','2026-02-10',[rule(42),rule(84)]),
    at('2026-01-05','2026-02-10',[{...rule(42),sourceDayBasis:'working'}]),at('2026-01-05','2026-02-10',[{...rule(42),state:'candidate'}])]){
    assert.equal(x.status,'not_established');assert.equal(x.dueDateIso,null);assert.match(x.basis,/not established/);
  }
  // One shared rule: the notices-claims decision facts give the same due date and state.
  const rows=buildClaimChecks([{cells:{'claim id':'C2','awareness date':'2026-02-03','detailed claim date':'2026-05-30'},receipt:{documentId:'claims',locator:'row:3'}} as any],'2026-08-31',[rule(42)]).rows;
  assert.equal(rows[0].dueDateIso,late.dueDateIso);assert.equal(rows[0].detailedClaimState,'late');assert.equal(rows[0].daysAfterDue,late.daysAfterDue);
});

test('F13/F47: claims page shows responsibility, awareness, determination and the time-bar per claim',t=>{
  const model=canonicalTimeClaims(registerState(t)).delayClaims!;
  const reporting=delayClaimsAsOf(model,'2026-08-31') as any;
  // Inject a computed time bar to check the page wording for each status.
  reporting.reported.rows.find((x:any)=>x.claimId==='C1').detailedClaimTimeBar=detailedClaimTimeBar({awarenessIso:'2026-01-05',eventStartIso:null,submittedIso:'2026-02-10',cutoffIso:'2026-08-31'},[rule(42)]);
  reporting.reported.rows.find((x:any)=>x.claimId==='C2').detailedClaimTimeBar=detailedClaimTimeBar({awarenessIso:'2026-02-03',eventStartIso:null,submittedIso:'2026-05-30',cutoffIso:'2026-08-31'},[rule(42)]);
  const ctx={r:reporting,escapeHtml:String,fmt:String,humanizeKey:String,planningShortDate:String,readerText:String,planningKpis:()=>'',experienceDisclosure:(_t:string,html:string)=>html};
  const html=String(runInNewContext("renderClaimsReporting(r,'delay-claims')",ctx));
  assert.match(html,/Claim responsibility, awareness, determination and detailed-claim time bar · 3 claims/);
  assert.match(html,/<td>C1<\/td><td>employer \(Employer\)<\/td><td>2026-01-05<\/td><td>Engineer determined 12 days · 2026-04-01<\/td><td>2026-02-10<\/td><td>36 \/ 42 d<\/td><td>On time<\/td>/);
  assert.match(html,/<td>C2<\/td><td>contractor \(Contractor\)<\/td><td>2026-02-03<\/td><td>Not stated<\/td><td>2026-05-30<\/td><td>116 \/ 42 d<\/td><td>Late<\/td>/);
  assert.match(html,/<td>C3<\/td><td>neutral \(Neutral event\)<\/td><td>Not stated<\/td><td>Not stated<\/td><td>Not stated<\/td><td>Not established<\/td><td>Not established<\/td>/);
  // Same table on the notices and EOT pages (inside their claims disclosure).
  for(const key of ['notices-claims','eot-assessment'])assert.match(String(runInNewContext("renderClaimsReporting(r,'"+key+"')",ctx)),/detailed-claim time bar · 3 claims/);
});
