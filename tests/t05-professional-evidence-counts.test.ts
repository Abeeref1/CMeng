import test from "node:test";
import assert from "node:assert/strict";
import {applyProfessionalModuleState} from "../packages/runtime-api/src/project-projections";

// Independent expectations: only explicit nonnegative numeric source counts
// establish zero; absent, invalid and conflicting values must require review.
function assessment(key:string,data:unknown){
 return applyProfessionalModuleState({key,status:"ready",reason:null,dependencies:[],
   engineState:"ready",evidenceState:"established",professionalState:"defensible",data} as any);
}
const claims=(change:Record<string,unknown>={})=>({position:{claimsNotices:{
 lifecycleClaimCount:0,commercialClaimCount:0,commercialLifecycleLinkCoveragePercent:100,
 noticeTimelinessCounts:{requirement_missing:0,event_date_missing:0,notice_date_missing:0},
 ...change
}}});
test("T05/T07 complete Financial Claims source zero stays established but missing notice columns do not",()=>{
 assert.equal(assessment("commercial-claims-notices",claims()).status,"ready");
 for(const key of ["requirement_missing","event_date_missing","notice_date_missing"]){
  const value=assessment("commercial-claims-notices",claims({noticeTimelinessCounts:{
    requirement_missing:0,event_date_missing:0,notice_date_missing:0,[key]:undefined}}));
  assert.equal(value.status,"partial",key);
  assert.match(value.reason??"",/not established/i);
 }
 for(const value of [undefined,null,-1,NaN,Infinity,"0"]){
  const output=assessment("commercial-claims-notices",claims({noticeTimelinessCounts:{
    requirement_missing:value,event_date_missing:0,notice_date_missing:0}}));
  assert.equal(output.status,"partial",String(value));
 }
 const sourceGap=assessment("commercial-claims-notices",claims({noticeTimelinessCounts:{
   requirement_missing:2,event_date_missing:1,notice_date_missing:0}}));
 assert.equal(sourceGap.status,"partial");
 assert.match(sourceGap.reason??"",/3 notice assessment/);
});
test("T05/T07 missing lifecycle or commercial-money linkage cannot certify a zero-gap claims position",()=>{
 for(const update of [
  {lifecycleClaimCount:undefined},{lifecycleClaimCount:null},
  {lifecycleClaimCount:-1},{lifecycleClaimCount:2,commercialClaimCount:undefined},
  {lifecycleClaimCount:2,commercialClaimCount:2,commercialLifecycleLinkCoveragePercent:null}
 ]){
  const result=assessment("commercial-claims-notices",claims(update));
  assert.equal(result.status,"partial",JSON.stringify(update));
  assert.match(result.reason??"",/(not established|requires review)/i);
 }
 assert.equal(assessment("commercial-claims-notices",claims({lifecycleClaimCount:2,
  commercialClaimCount:2,commercialLifecycleLinkCoveragePercent:100})).status,"ready");
});
test("T05 notices and payment record counts preserve unknown and legitimate zero",()=>{
 const unknown=assessment("notices-claims",{noticeAssessmentState:"assessed",noticeRequirementMissingCount:null});
 assert.equal(unknown.status,"partial");
 assert.match(unknown.reason??"",/not assessable for the complete set of records/i);
 assert.equal(assessment("notices-claims",{noticeAssessmentState:"assessed",
  noticeRequirementMissingCount:0}).status,"ready");
 const pay=(count:number|null,coverage:number|null)=>assessment("payments",
  {focus:{paymentRegister:{recordCount:count,stageCoveragePercent:coverage}}});
 assert.equal(pay(null,100).status,"partial");
 assert.match(pay(null,100).reason??"",/complete payment register is not established/i);
 assert.equal(pay(0,null).status,"ready");
 assert.equal(pay(1,null).status,"partial");
});
