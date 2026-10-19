import test from 'node:test';
import assert from 'node:assert/strict';
import {ncrStatusFromSource,operationalControlsAsOf} from '../packages/runtime-api/src/operational-reporting';
import type {NcrRecord} from '../packages/project-director/src';
import {procurementTiming,statedLeadReviewDays} from '../packages/truth-kernel/src';

// Hand-made NCR records, all raised before the Data Date 2026-03-31.
// Expected by hand at the Data Date:
//   NCR-1 'Open'                                  -> open
//   NCR-2 'Closed', closed 2026-02-15             -> closed
//   NCR-3 'Closed - pending verification', closed 2026-02-20 -> unclear (not closed)
//   NCR-4 'Under review'                          -> unclear (not open)
//   NCR-5 ''                                      -> unclear (blank)
//   NCR-6 'TBC'                                   -> unclear
//   NCR-7 'Rejected'                              -> unclear
//   NCR-8 'Closed', closed 2026-04-20 (after DD)  -> open at the Data Date
// open = 2 (NCR-1, NCR-8), closed = 1 (NCR-2), unclear = 5 (NCR-3..7)
const DD='2026-03-31';
const raw:[string,string,string|null][]=[
  ['NCR-1','Open',null],['NCR-2','Closed','2026-02-15'],['NCR-3','Closed - pending verification','2026-02-20'],
  ['NCR-4','Under review',null],['NCR-5','',null],['NCR-6','TBC',null],['NCR-7','Rejected',null],['NCR-8','Closed','2026-04-20'],
];
const ncrs:NcrRecord[]=raw.map(([ncrId,status,closedIso])=>({ncrId,severity:'major',status:ncrStatusFromSource(status).status,statusReason:ncrStatusFromSource(status).reason,
  raisedIso:'2026-01-10',closedIso,statusAsOfIso:null,dueIso:'2026-03-01',sourceRefs:['manual:'+ncrId]}));
const state={evidenceDocuments:[],controls:{ncrs,rfis:[],risks:[]}} as any;

test('SW-19 shared NCR status mapping: only clear wording is open or closed; unclear carries a reason',()=>{
  assert.deepEqual(raw.map(([,s])=>ncrStatusFromSource(s).status),['open','closed','unknown','unknown','unknown','unknown','unknown','closed']);
  assert.equal(ncrStatusFromSource('Open').reason,null);
  assert.equal(ncrStatusFromSource('TBC').reason,'Source status "TBC" is not a clear open or closed status');
  assert.equal(ncrStatusFromSource('Closed - pending verification').reason,'Source status "Closed - pending verification" is not a clear open or closed status');
  assert.equal(ncrStatusFromSource('  ').reason,'Source status is blank');
  // the old adapter rule (contains "closed"/"complete", else open) misread these:
  assert.equal(ncrStatusFromSource('Not closed').status,'unknown');
  assert.equal(ncrStatusFromSource('Incomplete').status,'unknown');
});

test('SW-19 open / closed / unclear NCR counts at the Data Date, computed by hand',()=>{
  const r=operationalControlsAsOf(state,DD);
  const by=(s:string)=>r.quality.current.filter(x=>x.status===s).map(x=>x.ncrId).sort();
  assert.deepEqual(by('open'),['NCR-1','NCR-8']);
  assert.deepEqual(by('closed'),['NCR-2']);
  assert.deepEqual(by('unknown'),['NCR-3','NCR-4','NCR-5','NCR-6','NCR-7']);
  assert.equal(r.quality.unknownStatusCount,5);
  assert.equal(r.knownCounts.openNcrCount,2);
  assert.equal(r.knownCounts.openCriticalMajorNcrCount,2);
  assert.equal(r.knownCounts.overdueNcrCount,2);
  // five unclear records: the complete open count is not established, never a number
  assert.equal(r.quality.complete,false);
  assert.equal(r.counts.openNcrCount,null);
  assert.equal(r.counts.openCriticalMajorNcrCount,null);
  assert.equal(r.knownCounts.uncertainCriticalMajorNcrCount,5);
});

test('SW-19 unclear NCRs carry their reason and their own count for screens and Ask',()=>{
  const r=operationalControlsAsOf(state,DD);
  assert.equal(r.knownCounts.unclearNcrCount,5);
  assert.equal(r.knownCounts.closedNcrCount,1);
  assert.equal(r.knownCounts.openNcrCount+r.knownCounts.closedNcrCount+r.knownCounts.unclearNcrCount,8,'every current record is in exactly one state');
  assert.deepEqual(r.quality.unclearStatusRecords.map(x=>[x.ncrId,x.reason]),[
    ['NCR-3','Source status "Closed - pending verification" is not a clear open or closed status'],
    ['NCR-4','Source status "Under review" is not a clear open or closed status'],
    ['NCR-5','Source status is blank'],
    ['NCR-6','Source status "TBC" is not a clear open or closed status'],
    ['NCR-7','Source status "Rejected" is not a clear open or closed status'],
  ]);
  assert.equal(r.quality.current.find(x=>x.ncrId==='NCR-1')!.statusReason,null);
  assert.match(r.quality.unclearStatusSummary!,/^5 current NCR\(s\) have an unclear status and are counted neither open nor closed: NCR-3 /);
  // a closed status with no closure or status-as-of date is unclear at the Data Date, with that reason
  const undated=operationalControlsAsOf({evidenceDocuments:[],controls:{rfis:[],risks:[],ncrs:[{ncrId:'NCR-9',severity:'minor',status:'closed',statusReason:null,raisedIso:'2026-01-10',closedIso:null,statusAsOfIso:null,sourceRefs:['manual:NCR-9']}]}} as any,DD);
  assert.deepEqual(undated.quality.unclearStatusRecords.map(x=>x.reason),['Source status "closed" has no closure or status-as-of date on or before the Data Date']);
});

// SW-17 hand-checked procurement need dates. Data Date 2026-04-20.
// Linked activity start (current programme) 2026-05-01.
const T=(over:Partial<Parameters<typeof procurementTiming>[0]>)=>procurementTiming({dataDateIso:'2026-04-20',programmeNeedDate:'2026-05-01',
  sourceRequiredOnSite:null,forecastDelivery:null,actualDelivery:null,status:'In transit',governingDate:'programme',...over});

test('SW-17 stated lead/review time is read, never defaulted',()=>{
  assert.deepEqual(statedLeadReviewDays(''),{state:'not_stated',days:null,raw:''});
  assert.deepEqual(statedLeadReviewDays('14'),{state:'stated',days:14,raw:'14'});
  assert.deepEqual(statedLeadReviewDays('21 calendar days'),{state:'stated',days:21,raw:'21 calendar days'});
  assert.equal(statedLeadReviewDays('10 working days').state,'unreadable');
  assert.equal(statedLeadReviewDays('TBC').state,'unreadable');
});

test('SW-17 need date = current programme start less the stated lead/review time; overdue only when before the Data Date and undelivered',()=>{
  // 2026-05-01 less 14 calendar days = 2026-04-17 (hand count: Apr 17 + 14 = May 1). Before DD 04-20, undelivered -> overdue.
  const a=T({leadReviewTime:'14'});
  assert.equal(a.needDate,'2026-04-17'); assert.equal(a.programmeStartDate,'2026-05-01'); assert.equal(a.overdueUndelivered,true);
  assert.match(a.needDateBasis,/less the stated 14 calendar-day lead\/review time/);
  // no stated time: need date is the start itself (no fixed default) -> 2026-05-01, after DD -> not overdue
  const b=T({});
  assert.equal(b.needDate,'2026-05-01'); assert.equal(b.overdueUndelivered,false); assert.equal(b.needDateBasis,'the confirmed programme need date');
  // 11 days: 2026-04-20 = the Data Date itself -> not before the Data Date -> not overdue
  const c=T({leadReviewTime:'11'});
  assert.equal(c.needDate,'2026-04-20'); assert.equal(c.overdueUndelivered,false);
  // 12 days: 2026-04-19, one day before DD -> overdue
  assert.equal(T({leadReviewTime:'12'}).overdueUndelivered,true);
  // delivered on 2026-04-10 (on/before DD) -> never overdue
  const d=T({leadReviewTime:'14',actualDelivery:'2026-04-10',status:'Delivered'});
  assert.equal(d.deliveredAtDataDate,true); assert.equal(d.overdueUndelivered,false);
  // unclear delivery status is not proof of non-delivery -> not overdue
  assert.equal(T({leadReviewTime:'14',status:'TBC'}).overdueUndelivered,false);
  // stated but unreadable time: the programme need date is not established (not the raw start)
  const e=T({leadReviewTime:'10 working days'});
  assert.equal(e.needDate,null); assert.equal(e.overdueUndelivered,false); assert.equal(e.leadReview.state,'unreadable');
  // screening (no governing choice): earliest of programme need 2026-04-17 and register ROS 2026-04-25
  const f=T({governingDate:null,leadReviewTime:'14',sourceRequiredOnSite:'2026-04-25'});
  assert.equal(f.needDate,'2026-04-17'); assert.match(f.needDateBasis,/linked programme need date \(screening\) \(linked activity start 2026-05-01/);
  // forecast headroom is measured against the adjusted need date: forecast 2026-04-24 vs need 04-17 = -7 days
  const g=T({leadReviewTime:'14',forecastDelivery:'2026-04-24'});
  assert.equal(g.headroomCalendarDays,-7); assert.equal(g.forecastLate,true);
});
