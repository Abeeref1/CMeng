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
