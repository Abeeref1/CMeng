import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHseSummary,hseReportPosition} from '../packages/runtime-api/src/hse-report-evidence';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';

// F24: the HSE report's own wording ("831,000 man-hours", "LTI 1") is read from the report document.
const reportText=[
 'MONTHLY HSE REPORT',
 'Reporting Month: August 2026',
 'The project has achieved 831,000 man-hours worked to date.',
 'LTI: 1',
 'MTC 5',
 'RWC 1',
 'LTIFR 1.2 per 1,000,000 man-hours',
 'TRIR 1.68 normalised to 200,000 man-hours',
].join('\n');

test('HSE report narrative text: number-first exposure and LTI/MTC/RWC abbreviations are read; rate denominators are not exposure',()=>{
 const s=parseHseSummary(reportText,'h','doc');
 assert.equal(s.periodEndIso,'2026-08-31');
 assert.equal(s.metrics.manHours,831000);
 assert.equal(s.metrics.lostTimeInjuries,1);
 assert.equal(s.metrics.medicalTreatmentCases,5);
 assert.equal(s.metrics.restrictedWorkCases,1);
 assert.equal(s.metrics.ltifr,1.2);assert.equal(s.metrics.trir,1.68);
 assert.deepEqual(s.diagnostics,[]);
 assert.equal(parseHseSummary('TRIR is normalised to 200,000 man-hours. LTIFR per 1,000,000 man-hours.','h','doc').metrics.manHours,null,'a rate denominator is never exposure');
 assert.equal(parseHseSummary('LTIFR: 0.5','h','doc').metrics.lostTimeInjuries,null,'LTIFR is not an LTI count');
 assert.equal(parseHseSummary('Man hours: 10250000\nLost Time Injuries: 1','h','doc').metrics.manHours,10250000,'label-first wording still reads');
});

function stateWith(doc:Record<string,unknown>){
 const state=loadCertifiedDemoProject('HSE-REPORT-TEXT');
 state.evidenceDocuments=[{documentId:'hse-pdf',documentType:'hse_report',basisState:'active',sourceHashSha256:'hse-hash',
  fullTextRead:{sourceHashSha256:'hse-hash',result:{complete:true,failedPages:0,unresolvedPages:0,pages:[{text:reportText}]}},...doc} as any];
 state.version++;return state;
}

test('HSE page position reads exposure and LTI from the report document when the stored summary left them unread',()=>{
 const state=stateWith({hseSummary:{producerVersion:'hse-summary-v4',sourceHashSha256:'hse-hash',periodEndIso:null,metrics:{manHours:null,lostTimeInjuries:null},sourceRefs:[],diagnostics:[]}});
 const before=JSON.stringify(state.evidenceDocuments);
 const p=hseReportPosition(state,'2026-08-31');
 assert.equal(p.state,'source_report');assert.equal(p.periodEndIso,'2026-08-31');
 assert.equal(p.metrics.manHours,831000);assert.equal(p.metrics.lostTimeInjuries,1);
 assert.ok(p.sourceRefs.includes('evidence-document:hse-pdf:native-text-summary'),'the report document is the stated source');
 assert.equal(JSON.stringify(state.evidenceDocuments),before,'stored evidence is not rewritten');
 assert.equal(hseReportPosition(state,'2026-07-31').state,'not_established','a report after the Data Date is not used');
});

test('report text fills only unread fields of the same period and never overwrites values already read',()=>{
 const state=stateWith({hseSummary:{producerVersion:'hse-summary-v4',sourceHashSha256:'hse-hash',periodEndIso:'2026-08-31',metrics:{manHours:830000,lostTimeInjuries:null,ltifr:null,trir:null},sourceRefs:['evidence-document:hse-pdf:native-pdf-summary'],diagnostics:[]}});
 const p=hseReportPosition(state,'2026-08-31');
 assert.equal(p.metrics.manHours,830000,'stored value kept');assert.equal(p.metrics.lostTimeInjuries,1,'unread LTI read from the report text');
 const other=stateWith({hseSummary:{producerVersion:'hse-summary-v4',sourceHashSha256:'hse-hash',periodEndIso:'2026-07-31',metrics:{manHours:819280,lostTimeInjuries:null},sourceRefs:[],diagnostics:[]}});
 assert.equal(hseReportPosition(other,'2026-08-31').metrics.lostTimeInjuries,null,'a different period is not blended');
 const incomplete=stateWith({hseSummary:undefined,fullTextRead:{sourceHashSha256:'hse-hash',result:{complete:false,failedPages:1,unresolvedPages:0,pages:[{text:reportText}]}}});
 assert.equal(hseReportPosition(incomplete,'2026-08-31').state,'not_established','an incomplete text read is not used');
});
