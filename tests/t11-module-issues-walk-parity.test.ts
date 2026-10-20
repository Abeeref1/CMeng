import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assessModuleIssues} from '../packages/runtime-api/src/module-issues';
import type {ModuleRuntimeResult} from '../packages/runtime-api/src/project-state-types';

// T11 differential: the readiness findings walk must give byte-identical
// issues, evidence paths and order to the v/int2 implementation (bb027e2d).
// The expected digest below was produced by running exactly these trees
// through the v/int2 build of assessModuleIssues; it is not derived from the
// code under test.
export function walkParityTrees():any[]{
 const shared:any={note:'shared neutral',rows:[{a:1,ids:['x','y']},{b:2,ids:[]}]};
 const sharedFinding:any={state:'missing',consequence:'shared missing value',sourceRefs:['SRC:shared']};
 const cycle:any={label:'cycle'};cycle.self=cycle;cycle.review={state:'invalid',diagnostics:['INVALID_DATE'],sourceRefs:['SRC:cycle']};
 let deep:any={state:'conflicted',diagnostics:['DEEP_CONFLICT']};for(let i=0;i<12;i++)deep={child:deep,level:i};
 const holes:any[]=new Array(4);holes[2]={state:'stale',sourceRefs:['SRC:hole']};
 const rows=Array.from({length:240},(_,i)=>{
  const row:any={activityId:'A'+i,name:'Work '+i,status:i%3?'not_started':'in_progress',totalFloatHours:i%7-2,
   predecessorIds:i?['A'+(i-1)]:[],successorIds:['A'+(i+1)],sourceRefs:['schedule-activity:A'+i],
   readiness:{state:'conditional',dimensions:[{key:'predecessor',state:'ready',sourceRefs:[],note:null},{key:'permit',state:'unknown',sourceRefs:[],note:null}]}};
  if(i%17===0)row.diagnostics=['SOURCE_DATE_INVALID'];
  if(i%29===0)row.check={state:'missing',sourceRefs:['SRC:'+i]};
  if(i%31===0)row.decision={state:'candidate',approvalRequired:i%62===0,sourceRefs:['SRC:d'+i]};
  if(i%37===0)row.population={dateBasis:'event',exclusions:[{reason:'date_missing'},{reason:'invalid_date'}]};
  if(i%41===0)row.detail={inner:{state:'submitted_unparsed',sourceRefs:['SRC:u'+i]}};
  if(i%43===0)row.required={diagnostics:['EVENT_DATE_REQUIRED'],sourceRefs:['SRC:r'+i]};
  if(i%47===0)row.challenge={state:'missing'};
  if(i%53===0)row.shared=shared;
  if(i%59===0)row.sharedFinding=sharedFinding;
  return row;
 });
 const topics=[{topic:'Permits',state:'missing'},{basis:'contract',state:'invalid',diagnostics:['MALFORMED_VALUE']},{plain:[{state:'pending_review'}]}];
 return [
  {rows,topics,holes,cycle,deep,shared,sharedFinding},
  {focus:{rows:rows.slice(0,60),cycle,shared},rows},
  {position:{advancePaymentBondRequirement:{state:'missing'},heldEvidence:{advancePaymentBonds:{count:1,rows:[{bondId:'B1'}]}}},rows:rows.slice(100)},
  {sourceProductivityForecast:{state:'missing'},list:[shared,shared,sharedFinding,cycle]},
 ];
}
function input(key:string,data:any):ModuleRuntimeResult{
 return {key,status:'ready',engineState:'ready',evidenceState:'partial',professionalState:'defensible',reason:'partial',dependencies:[],
  data:{systemEvidenceContract:{state:'verified_for_checked_metrics',checks:[{metric:'population',passed:true}]},challenge:{reconciliationState:'within_tolerance'},...data}} as any;
}
const PLAIN_SCOPE='Each type is counted on its own. Records that disagree, a missing input or a difference between the submitted and independent positions do not by themselves mean a software fault. A passed check covers only what it checks; project performance is reported separately.';
const EARLIER_SCOPE='Categories are independent. A source conflict, missing input or difference between submitted and independent positions is not proof of a software defect. Passed checks certify only their stated scope; project performance remains separate.';
export function walkParityDigest(assess:typeof assessModuleIssues):{digest:string;issues:number}{
 const pass={state:'pass' as const,failedCheckIds:[],checkCount:8};
 const hash=createHash('sha256');let issues=0;
 const trees=walkParityTrees();
 for(const shareContext of [false,true]){
  const context=shareContext?{eligibility:new WeakMap<object,boolean>()}:undefined;
  for(const key of ['activity-analytics','lookahead-schedule','cost-forecast','notices-claims'])for(const tree of trees){
   const assessed=assess(input(key,tree),pass,context);
   // SW-46 added the additive field checksRunCount (the listed checks that ran: 1 here). It is checked
   // on its own and left out of the walk digest, so the digest still proves identical issues, paths and order.
   assert.equal(assessed.checksRunCount,1);
   const walked:Record<string,unknown>={...assessed};delete walked.checksRunCount;
   // R15 C1: the fixed issue-type scope sentence is now in plain words (it no longer reads
   // "A source conflict, ..." on every page). It is one constant, not part of the walk: it is
   // checked on its own and the digest is taken with the earlier sentence, so it still proves
   // identical issues, paths and order.
   assert.equal(assessed.scope,PLAIN_SCOPE);walked.scope=EARLIER_SCOPE;
   issues+=assessed.issues.length;hash.update(JSON.stringify(walked));hash.update('\n');
  }
 }
 return {digest:hash.digest('hex'),issues};
}
test('readiness findings walk gives byte-identical issues, paths and order to v/int2',()=>{
 const {digest,issues}=walkParityDigest(assessModuleIssues);
 assert.ok(issues>0,'the trees produce findings');
 // The issue shape gained the identity fields of the lossless de-duplication fix (d1824129).
  // a40dfc12... is the digest of the PREVIOUS walk implementation on those same trees (built on
  // branch v/d1-identity, without the walk change), so this still proves the new walk is identical.
  // Round 15 (W2): two action sentences lost the word 'rerun' ('...then rerun the same validation.' and
  // '...and rerun validation.' now say '...then run the same check again.' / '...and run the check again.').
  // Checked before changing this digest: the previous verified build (7a3b4d94, digest
  // a40dfc1263b3e513193920eeb679af1421aa9a770cdef14bd632bf267dcfa45e) with only those two sentences
  // replaced gives exactly the digest below, so issues, evidence paths and order are unchanged.
  assert.equal(digest,'e8c2ab582d046c53b63e17bcb977e37501abac19470bc6cb6df372979a1a4b3b');
});
