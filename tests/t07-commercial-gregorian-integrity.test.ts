import test from 'node:test';
import assert from 'node:assert/strict';
import {commercialIntegrityChecks} from '../packages/runtime-api/src/commercial-integrity';

// Independent certificate dates: each calendar day is externally fixed in the
// input expectation. No CMeng parser is used to calculate the expected answer.
const certificatePosition=(cutoff:string,asOf:string[],future:string[]=[])=>({
 sourceLedger:{dataDateIso:cutoff,payments:[...asOf,...future].map((date,i)=>({
  paymentId:'IPC-'+i,amounts:{netCertifiedAmount:{currency:'SAR',taxBasis:'inclusive'}},certificationDate:date
 }))},
 certificateProfile:{groups:[{currency:'SAR',taxBasis:'inclusive',
  as_of:asOf.map((date,i)=>({id:'IPC-'+i,date})),
  future:future.map((date,i)=>({id:'IPC-'+(i+asOf.length),date})),
  undated:[],totals:{}}]}
}) as any;
const check=(position:any,metric:string)=>commercialIntegrityChecks('payments',position)
 .find(row=>row.metric===metric)?.passed;

test('T07 impossible certificate calendar dates cannot satisfy independent as-of/future integrity checks',()=>{
 for(const invalid of ['2032-02-30','2031-02-29','2032-04-31','2032-02-30T08:00:00Z']){
  const source=certificatePosition('2032-05-01',[invalid]);
  const untouched=JSON.stringify(source);
  assert.equal(check(source,'certificate_current_cutoff:SAR:inclusive'),false,invalid);
  assert.equal(JSON.stringify(source),untouched,'never change the retained certificate source');
 }
 const future=certificatePosition('2032-03-01',[],['2032-04-31']);
 assert.equal(check(future,'certificate_future_cutoff:SAR:inclusive'),false,
  'invalid future certificate dates are not valid future evidence');
});
test('T07 malformed Data Date never validates otherwise real current certificate dates',()=>{
 const source=certificatePosition('2032-02-30',['2032-02-29']);
 assert.equal(check(source,'certificate_current_cutoff:SAR:inclusive'),false);
});
test('T07 valid leap dates and true future certificates preserve independent cutoff acceptance',()=>{
 const source=certificatePosition('2032-03-01',['2032-02-29','2032-03-01'],['2032-03-02']);
 const checks=commercialIntegrityChecks('payments',source);
 for(const metric of ['certificate_source_population:SAR:inclusive',
  'certificate_source_identities:SAR:inclusive','certificate_current_cutoff:SAR:inclusive',
  'certificate_future_cutoff:SAR:inclusive'])
  assert.equal(checks.find(row=>row.metric===metric)?.passed,true,metric);
});
test('T07 impossible issued notice dates are gaps; proven leap days are not',()=>{
 const assessments=[
  {noticeIssuedAt:'2032-02-30'},
  {noticeIssuedAt:'2032-02-29T08:00:00Z'},
  {noticeIssuedAt:null},
  {noticeIssuedAt:'2031-02-29'},
  {noticeIssuedAt:'2032-04-30'}
 ];
 const position={
  sourceLedger:{dataDateIso:'2032-05-01',payments:[]},
  claimsNotices:{evidenceRevisionId:'SOURCE-REVISION',diagnostics:[],
   noticeAssessments:assessments,
   noticeTimelinessCounts:{timely:5,requirement_missing:0},
   dimensionalEvidenceGaps:{noticeDateMissing:3,requirementMissing:0}
  }
 } as any;
 const untouched=JSON.stringify(position);
 const checks=commercialIntegrityChecks('commercial-claims-notices',position);
 assert.equal(checks.find(r=>r.metric==='notice_date_gap_population')?.passed,true,
  'three unproven dates remain source gaps instead of calendar-normalized receipts');
 assert.equal(checks.find(r=>r.metric==='notice_outcome_population')?.passed,true);
 assert.equal(JSON.stringify(position),untouched,'source assessments must not be edited');
 position.claimsNotices.dimensionalEvidenceGaps.noticeDateMissing=0;
 assert.equal(commercialIntegrityChecks('commercial-claims-notices',position)
  .find(r=>r.metric==='notice_date_gap_population')?.passed,false,
  'the independent check must reject a false zero on missing notice dates');
});
