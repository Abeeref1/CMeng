import test from 'node:test';
import assert from 'node:assert/strict';
import {ncrStatusFromSource,operationalControlsAsOf} from '../packages/runtime-api/src/operational-reporting';
import type {NcrRecord} from '../packages/project-director/src';

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
const ncrs:NcrRecord[]=raw.map(([ncrId,status,closedIso])=>({ncrId,severity:'major',status:ncrStatusFromSource(status).status,
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
