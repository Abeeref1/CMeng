import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RuntimeProjectStore } from '../packages/runtime-api/src/project-state';
import { evidenceFamily } from '../packages/runtime-api/src/evidence-control';
import { canonicalTimeClaims } from '../packages/runtime-api/src/canonical-time-claims';
import { buildDelayClaimsProjection } from '../packages/delay-claims/src';
import { buildNoticesClaimsProjection } from '../packages/notices-claims/src';
import type { DelayClaimsModel } from '../packages/delay-analysis-core/src';
import type { WindowsAnalysisProjection } from '../packages/windows-analysis/src';
import type { ProjectRuntimeState, StoredEvidenceDocument } from '../packages/runtime-api/src/project-state-types';

// SW-15 (T07): a claim is not an event. A claim may cite events and one event may
// have several claims, so claims register rows never establish the event count or
// event dates. Claims stay listed and counted as claims.

process.env.CMENG_OCR_ENABLED='0';
const stamp='2026-09-20T10:00:00.000Z';
function claimsRegisterOnlyState(t:{after(fn:()=>void):unknown}) {
  const dir=mkdtempSync(join(tmpdir(),'cmeng-sw15-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false});
  const state=store.getOrCreate('SW15');
  state.schedules.push({role:'update',format:'xer',sourceFilename:'u.xer',sourceHashSha256:'schedule-hash',uploadedAt:stamp,
    revision:{revisionId:'U1',label:'Current',sequence:1,effectiveAt:'2026-08-31',model:{projectId:'SW15',source:'xer',sourceRevisionId:'U1',dataDateIso:'2026-08-31T08:00:00',activities:[],relationships:[],wbs:[],calendars:[],diagnostics:[]}}} as unknown as ProjectRuntimeState['schedules'][number]);
  // Three claims; C1 and C2 both cite event EV-1, C3 cites EV-2. Only a claims register is supplied.
  const text='Claim ID,Event ID,Event,Event Start,Notice Date,Days Claimed,Status\n'+
    'C1,EV-1,Access to Zone A withheld,2026-06-01,2026-06-10,20,Submitted\n'+
    'C2,EV-1,Access to Zone A withheld (cost),2026-06-03,2026-06-20,5,Submitted\n'+
    'C3,EV-2,Late design approval,2026-07-01,2026-07-05,12,Submitted';
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
const noWindows={windows:[],windowCount:0,positiveIndependentMovementDays:null,positiveProgrammeMovementDays:null,
  projectCompletionMovementDays:null,projectCompletionMovementBasis:'unavailable',diagnostics:[]} as unknown as WindowsAnalysisProjection;
const meta={generatedAt:stamp,producerVersion:'sw15-test'};

test('SW-15: claims register only gives event count null with a reason; claims stay listed and counted',t=>{
  const model=canonicalTimeClaims(claimsRegisterOnlyState(t)).delayClaims;
  assert.ok(model,'the claims register is read');
  assert.equal(model.claims.length,3);
  const delay=buildDelayClaimsProjection(noWindows,model,meta);
  const notices=buildNoticesClaimsProjection(model,meta);
  for(const projection of [delay,notices]){
    assert.equal(projection.eventCount,null,'no event source: the event count is not established');
    assert.equal(projection.eventPopulationState,'not_established');
    assert.match(String(projection.eventPopulationReason),/NO_EVENT_SOURCE/);
    assert.equal(projection.claimCount,3,'claims are still counted as claims');
  }
  for(const key of ['claimLinkedEventCount','activityLinkedEventCount','windowLinkedEventCount','noticeLinkedEventCount','determinationLinkedEventCount','fullDeterminationChainEventCount','determinationChainIncompleteEventCount','activityEvidenceInsufficientEventCount'] as const)
    assert.equal(delay[key],null,key+' counts events, so it is not established either');
  for(const key of ['timelyNoticeCount','lateNoticeCount','missingNoticeCount','noticeRequirementMissingCount','noticeEventDateMissingCount','noticeRequirementConflictCount'] as const)
    assert.equal(notices[key],null,key+' counts events by notice timeliness, so it is not established either');
  assert.deepEqual(notices.claims.map(c=>c.claimId),['C1','C2','C3'],'claims stay on the page unchanged');
  assert.deepEqual(notices.claims.map(c=>c.claimedDays),[20,5,12]);
  assert.equal(notices.noticeCount,3,'notices are counted as notices, not as events');
  assert.ok(delay.events.length>0&&notices.events.length>0,'cited event references stay (all keys kept)');
});

const event=(eventId:string,identitySource?:'event_register'|'claims_register_row')=>({eventId,title:eventId,category:'other' as const,startIso:'2026-06-01',endIso:null,
  responsibility:'unknown' as const,responsibilityState:'missing' as const,describedImpactDays:null,describedImpactState:'missing' as const,
  relatedActivityIds:[],relatedClauseIdentifiers:[],evidenceRefs:[],diagnostics:[],...(identitySource?{identitySource}:{})});
const claim=(claimId:string,eventIds:string[])=>({claimId,title:claimId,state:'submitted' as const,eventIds,submittedAt:null,claimedDays:10,claimedAmount:null,
  assessedDays:null,assessedDaysState:'missing' as const,assessedAmount:null,assessedAmountState:'missing' as const,clauseIdentifiers:[],evidenceRefs:[],diagnostics:[]});
const baseModel=(events:DelayClaimsModel['events'],diagnostics:string[]=[]):DelayClaimsModel=>({projectId:'SW15',evidenceRevisionId:'r',events,
  claims:[claim('C1',['EV-1']),claim('C2',['EV-1'])],notices:[],noticeRequirements:[],diagnostics});

test('SW-15: a stored claims-register model read before the event tag existed is judged the same way',()=>{
  const model=baseModel([event('EV-1'),event('EV-1')],['DELAY_EVENTS_GOVERNED_FROM_CLAIMS_REGISTER_FIELDS']);
  const delay=buildDelayClaimsProjection(noWindows,model,meta),notices=buildNoticesClaimsProjection(model,meta);
  assert.equal(delay.eventCount,null);assert.equal(notices.eventCount,null);
  assert.equal(delay.claimCount,2);assert.equal(notices.claimCount,2);
});

test('SW-15: events from an event source are counted; claim rows citing them add no events',()=>{
  const model=baseModel([event('EV-1','event_register'),event('EV-1','claims_register_row'),event('EV-1','claims_register_row')]);
  const delay=buildDelayClaimsProjection(noWindows,model,meta),notices=buildNoticesClaimsProjection(model,meta);
  assert.equal(delay.eventPopulationState,'established');assert.equal(delay.eventPopulationReason,null);
  assert.equal(delay.eventCount,1,'one event with two claims is one event');
  assert.equal(notices.eventCount,1);
  assert.equal(delay.claimCount,2);assert.equal(notices.claimCount,2);
});
