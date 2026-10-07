import test from 'node:test';
import assert from 'node:assert/strict';
import {delayClaimsAsOf} from '../packages/delay-analysis-core/src/reporting';
import type {CanonicalClaimRecord,DelayClaimsModel} from '../packages/delay-analysis-core/src';

const claim=(changes:Partial<CanonicalClaimRecord>={}):CanonicalClaimRecord=>({
  claimId:'MONEY-CLAIM',title:'Professional monetary assessment',state:'determined',eventIds:[],
  submittedAt:'2032-01-05',claimedDays:12,claimedAmount:1000,
  assessedAt:'2032-01-15',assessedDays:8,assessedDaysState:'official',assessedAmount:800,assessedAmountState:'official',
  clauseIdentifiers:[],evidenceRefs:[{sourceType:'claim',sourceId:'review-1',locator:'dated-professional-review'}],diagnostics:[],...changes,
});
const source=(row:CanonicalClaimRecord):DelayClaimsModel=>({
  projectId:'ASSESSMENT-REGRESSION',evidenceRevisionId:'governed-review',dataDateIso:'2032-01-31',
  events:[],claims:[row],notices:[],noticeRequirements:[],diagnostics:[],
});

test('Stage 1 retains a dated official claim assessment without promoting the final register status',()=>{
  const original=source(claim());
  const current=delayClaimsAsOf(original,'2032-01-31').current.claims[0]!;
  assert.equal(current.claimedAmount,1000);
  assert.equal(current.assessedAmount,800);
  assert.equal(current.assessedAmountState,'official');
  assert.equal(current.assessedDays,8);
  assert.equal(current.assessedDaysState,'official');
  assert.equal(current.state,'submitted');
  assert.equal(current.sourceRegister?.state,'determined');
  assert.equal(original.claims[0]!.assessedAmount,800,'reporting must not mutate retained evidence');
});

test('Stage 1 withholds future, undated and candidate assessments and retains real zero only with dated authority',()=>{
  for(const changes of [
    {assessedAt:'2032-02-01'},
    {assessedAt:null},
    {assessedDaysState:'candidate' as const,assessedAmountState:'candidate' as const},
  ]){
    const original=source(claim(changes));
    const current=delayClaimsAsOf(original,'2032-01-31').current.claims[0]!;
    assert.equal(current.assessedAmount,null);
    assert.equal(current.assessedAmountState,'missing');
    assert.equal(current.assessedDays,null);
    assert.equal(current.assessedDaysState,'missing');
    assert.equal(original.claims[0]!.assessedAmount,800);
  }
  const zero=delayClaimsAsOf(source(claim({assessedAmount:0,assessedDays:0})),'2032-01-31').current.claims[0]!;
  assert.equal(zero.assessedAmount,0);
  assert.equal(zero.assessedAmountState,'official');
  assert.equal(zero.assessedDays,0);
  const boundary=delayClaimsAsOf(source(claim({assessedAt:'2032-01-31'})),'2032-01-31').current.claims[0]!;
  assert.equal(boundary.assessedAmount,800);
});
