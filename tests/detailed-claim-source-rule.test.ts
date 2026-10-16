import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClaimChecks} from '../packages/runtime-api/src/project-decision-facts';
import type {NoticeRequirement} from '../packages/delay-analysis-core/src';
const rule:NoticeRequirement={requirementId:'contract:84',noticeKind:'detailed_claim',eventCategories:[],noticePeriodDays:84,triggerBasis:'awareness',state:'official',clauseIdentifiers:['20.2.4'],evidenceRefs:[{sourceType:'contract',sourceId:'contract',locator:'page:5'}]};
function row(extra:Record<string,string>={}){return {cells:{'claim id':'C1','awareness date':'2026-01-01','notice date':'2026-01-15','detailed claim date':'2026-03-20',...extra},receipt:{documentId:'claims',locator:'row:2'}} as any;}
test('84-day detailed claim deadline starts at recorded awareness, not notice',()=>{
 const result=buildClaimChecks([row()],'2026-03-31',[rule]);
 assert.equal(result.rows[0].dueDateIso,'2026-03-26');assert.equal(result.rows[0].detailedClaimState,'within_period');assert.equal(result.lateCount,0);
 assert.ok(result.rows[0].sourceRefs.includes('contract:contract:page:5'));
});
test('missing awareness and conflicting rules cannot silently become a 42-day deadline',()=>{
 for(const [rows,rules] of [[[row({'awareness date':''})],[rule]],[[row()],[rule,{...rule,requirementId:'conflict',noticePeriodDays:42}]],[[row()],[]]] as any){
  const result=buildClaimChecks(rows,'2026-03-31',rules);assert.equal(result.rows[0].dueDateIso,null);assert.equal(result.lateCount,0);
 }
});
test('dated amendment applies to trigger date, not later notice date',()=>{
 const rules=[{...rule,effectiveToIso:'2026-01-10'},{...rule,requirementId:'amendment',noticePeriodDays:28,effectiveFromIso:'2026-01-10'}];
 assert.equal(buildClaimChecks([row()],'2026-03-31',rules).rows[0].allowedDays,84);
});

 
// Independently calculated civil-day cases (Gregorian, no server timezone)
// verify the detailed-claim deadline, not the initial claim-notice deadline.
test('frozen detailed-claim day counts retain leap dates, amendments, and original source input',()=>{
 const originals=[{start:'2028-02-28',days:1,due:'2028-02-29'},
  {start:'2028-02-28',days:2,due:'2028-03-01'},
  {start:'2027-02-28',days:1,due:'2027-03-01'},
  {start:'2028-12-31',days:84,due:'2029-03-25'}];
 for(const c of originals){
  const sourceRule={...rule,noticePeriodDays:c.days};
  const originalRow=row({'awareness date':c.start,'detailed claim date':''});
  const snapshot=JSON.stringify({sourceRule,originalRow});
  const result=buildClaimChecks([originalRow],c.start,[sourceRule]);
  assert.equal(result.rows[0].dueDateIso,c.due,c.start+' + '+c.days);
  assert.equal(result.rows[0].allowedDays,c.days);
  assert.equal(result.rows[0].detailedClaimState,'submission_not_recorded');
  assert.equal(JSON.stringify({sourceRule,originalRow}),snapshot,'original records and rule authority are immutable');
 }
});
test('nonfinite and negative detailed-claim periods do not crash or invent deadlines',()=>{
 for(const invalid of [NaN,Infinity,-Infinity,-1,1e300]){
  const sourceRule={...rule,noticePeriodDays:invalid};
  const result=buildClaimChecks([row()],'2026-03-31',[sourceRule]);
  assert.equal(result.rows[0].dueDateIso,null);
  assert.equal(result.rows[0].allowedDays,null);
  assert.equal(result.rows[0].detailedClaimState,'due_basis_missing');
  assert.equal(result.lateCount,0);
  assert.match(result.rows[0].missingInputs.join(' '),/contract detailed-claim rule/);
  assert.equal(sourceRule.noticePeriodDays,invalid);
 }
});
