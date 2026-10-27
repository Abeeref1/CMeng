// T01 round 16, group c: the owner's recovered ABB-100 findings for Delivery Control and
// Procurement, Commercial, Design / Construction / Quality / HSE and Testing / Handover /
// Delivery Risk, checked on one synthetic project with the ABB-100 shape. Every file goes
// through the real upload path (store.ingestEvidenceFile) and every figure is read from the
// real page function (moduleForProject), the same one the screens, downloads and Ask use.
// The project reproduces each finding's condition, on the ABB-100 Data Date 30 Sep 2026:
//  - TIT-PRG started 19 Apr 2026 and is in progress; PKG-0004 is linked to it with a register
//    required-on-site date of 5 Oct 2026 (still ahead), forecast 1 Oct 2026, status On Track.
//  - TIT-MIS (in progress, finishes 20 Oct 2026) is linked to PKG-0122 whose register
//    required-on-site date is 31 Jan 2027: after the linked work's finish (link timing mismatch).
//  - PKG-0400 is needed by both dates (programme 1 Jun 2026, register 1 Sep 2026): truly overdue.
//  - PKG-0200 and PKG-0201 are open packages on completed work (close-out), supplier Vendor 139.
//  - NCR-0003 and NCR-0004 are "Closed" with a close date before their raised date.
//  - TIT-BAD reports an actual finish after the Data Date (progress unknown for that activity).
//  - The risk register has the 9 R01 columns and no raised date (every row undated).
//  - C01 states a 28-day initial claim notice; C02 (effective 15 Jul 2026) amends it to 14 days.
//  - No payment certificate, bond, permit or location register is supplied.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';
import {buildModuleJsonDownload} from '../packages/runtime-api/src/module-report';
import {procurementTiming} from '../packages/truth-kernel/src';

const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
const task=(id:number,wbs:number,code:string,name:string,status:string,start:string,finish:string,actualStart:string,actualFinish:string,duration:number,remaining:number,pct:number)=>
 ['%R',id,1,wbs,1,code,name,'TT_Task',status,start,finish,start,finish,actualStart,actualFinish,duration,remaining,16,pct].join('\t');
const programme=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tABBSHAPE\t2026-09-30 17:00',
 '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tclndr_data','%R\t1\tSeven day\t8\t'+calendar,
 '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t10\t1\t\tROOT\tProject','%R\t11\t1\t10\tCIV\tCivil','%R\t12\t1\t10\tELE\tElectrical',
 '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\tact_start_date\tact_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct',
 task(1,11,'TIT-CMP','Civil foundations','TK_Complete','2026-03-01 08:00','2026-04-30 16:00','2026-03-01 08:00','2026-04-30 16:00',480,0,100),
 task(2,11,'TIT-PRG','Civil superstructure','TK_Active','2026-04-19 08:00','2026-11-30 16:00','2026-04-19 08:00','',1800,960,40),
 task(3,12,'TIT-MIS','Electrical containment','TK_Active','2026-08-14 08:00','2026-10-20 16:00','2026-08-14 08:00','',540,480,10),
 task(4,12,'TIT-FUT','Electrical switchgear','TK_NotStart','2026-12-01 08:00','2026-12-20 16:00','','',160,160,0),
 task(5,12,'TIT-BAD','Electrical cabling','TK_Complete','2026-09-01 08:00','2026-10-05 16:00','2026-09-01 08:00','2026-10-05 16:00',280,0,100),
 task(6,12,'TIT-ELC','Electrical earthing','TK_Active','2026-06-01 08:00','2026-10-31 16:00','2026-06-01 08:00','',1200,1000,20),
 '%E'].join('\n');
const procurement=['Package ID,Description,Required On Site,Forecast Delivery,Status,Long Lead,Linked Activity,Supplier',
 'PKG-0004,Rebar supply,2026-10-05,2026-10-01,On Track,No,TIT-PRG,Vendor 005',
 'PKG-0122,Cable tray,2027-01-31,2027-01-21,Manufacturing,No,TIT-MIS,Vendor 123',
 'PKG-0200,Formwork,2026-12-01,2026-12-10,Awarded,No,TIT-CMP,Vendor 139',
 'PKG-0201,Anchor bolts,2026-11-01,2026-11-20,Manufacturing,No,TIT-CMP,Vendor 139',
 'PKG-0300,Switchgear,2026-11-15,2026-11-10,On Track,Yes,TIT-FUT,Vendor 139',
 'PKG-0301,Transformers,2026-11-15,2026-11-25,Overdue,Yes,TIT-FUT,Vendor 139',
 'PKG-0400,Earthing kit,2026-09-01,2026-10-15,Manufacturing,No,TIT-ELC,Vendor 200'].join('\n');
const ncrs=['NCR ID,Discipline,Description,Raised Date,Severity,Status,Close Date,Linked Activity',
 'NCR-0001,Civil,Honeycombing,2026-05-01,Major,Open,,TIT-PRG','NCR-0002,Civil,Cover,2026-03-01,Minor,Closed,2026-04-01,TIT-CMP',
 'NCR-0003,Electrical,Tray support,2026-06-01,Minor,Closed,2026-05-15,TIT-MIS','NCR-0004,Electrical,Gland,2026-07-01,Major,Closed,2026-06-20,TIT-ELC',
 'NCR-0005,Electrical,Earthing,2026-08-01,Minor,Open,,TIT-ELC'].join('\n');
const risks=['Risk ID,Category,Description,Probability,Impact,Rating,Owner,Status,Due Date',
 'RISK-0001,Design,Late design freeze,0.8,5,Extreme,Design Manager,Open,2026-10-20','RISK-0002,Procurement,Long lead switchgear,0.6,4,High,Procurement Manager,Mitigating,2026-10-30',
 'RISK-0003,Site,Access constraint,0.4,3,Medium,Construction Manager,Open,2026-11-30','RISK-0004,Commercial,Payment delay,0.2,2,Low,Commercial Manager,Open,2026-12-31',
 'RISK-0005,HSE,Working at height,0.4,3,Medium,HSE Manager,Closed,2026-08-30','RISK-0006,Design,Clash detection,0.6,4,High,Design Manager,Mitigating,2026-10-15'].join('\n');
const mainContract=['MAIN CONSTRUCTION CONTRACT','Conditions of Contract and Contract Data.','Contract currency is SAR.','Accepted Contract Amount: SAR 5,840,000,000.','Original Completion 31 December 2028.',
 'Clause 20.2.1 Notice of Claim','The initial notice of claim shall be given within 28 days after the claiming Party became aware of the event.',
 'Clause 4.1 The Contractor shall submit the quality management system within 28 days of the Commencement Date.','Clause 8.3 The Contractor shall submit a revised programme whenever the programme ceases to reflect actual progress.'].join('\n');
const amendment=['AMENDMENT No. 01 TO THE MAIN CONSTRUCTION CONTRACT','Effective Date: 15 July 2026','1.1 Clause 20.2.1 is amended: the initial notice of claim shall be given within 14 days after the claiming Party became aware of the event.'].join('\n');
const variations=['VO No,Description,Status,Approved Date,Amount,Currency','VO-001,Additional piling,Approved,2026-05-10,150000000,SAR','VO-002,Facade change,Approved,2026-07-20,110000000,SAR'].join('\n');
const boq=['Item No,Description,Unit,Quantity,Rate,Amount,Currency','1.0001,MV Switchgear,No.,4,100000,400000,SAR','1.0002,Chillers,No.,2,250000,500000,SAR','1.0003,Concrete foundations,m3,1200,300,360000,SAR'].join('\n');

let built:Promise<string>|undefined;
function project():Promise<string>{
 return built??=(async()=>{
  const state=runtimeProjects.getOrCreate('T01C-ABB-'+randomUUID());
  const upload=(name:string,text:string,mediaType:string,uploadIntent?:'replace_current_basis')=>runtimeProjects.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(text),mediaType,sourceFilename:name,uploadedAt:'2026-10-01',...(uploadIntent?{uploadIntent}:{})});
  await upload('S03_Latest.xer',programme,'text/plain','replace_current_basis');
  await upload('P01_Procurement_Register.csv',procurement,'text/csv');
  await upload('Q01_Quality_NCR_Register.csv',ncrs,'text/csv');
  await upload('R01_Risk_Register.csv',risks,'text/csv');
  await upload('C01_Main_Contract.txt',mainContract,'text/plain');
  await upload('C02_Amendment_01.txt',amendment,'text/plain');
  await upload('VAR01_Approved_Variations.csv',variations,'text/csv');
  await upload('B01_Original_BOQ.csv',boq,'text/csv','replace_current_basis');
  return state.projectId;
 })();
}
const page=async(key:string)=>moduleForProject(await project(),key);
const data=async(key:string)=>(await page(key)).data as any;
const metric=(d:any,label:string)=>d.metrics.find((m:any)=>m.label===label);
const recordId=(d:any,reference:string)=>d.rows.find((r:any)=>r.reference===reference)?.recordId;
const findingsFor=(d:any,reference:string)=>d.findings.filter((f:any)=>f.recordId===recordId(d,reference));
const FALSE_ROS=/Required-on-site date has passed|after its required-on-site date|Required-on-site date \d{4}-\d{2}-\d{2} has passed|confirmed blocking prerequisite/;

test('G7_PROCUREMENT-19: every page names the date that passed and its basis; a programme date is never called the required-on-site date',async()=>{
 const pp=await data('procurement-packages');
 assert.deepEqual(findingsFor(pp,'PKG-0400').filter((f:any)=>f.code==='PACKAGE_REQUIRED_DATE_MISSED').map((f:any)=>f.message),
  ['The assessed need date (the linked programme need date (screening), 2026-06-01) has passed and delivery is not recorded at the reporting date.']);
 // PKG-0004: only the linked programme date has passed; the register date 5 Oct 2026 is still ahead.
 assert.equal(findingsFor(pp,'PKG-0004').some((f:any)=>f.code==='PACKAGE_REQUIRED_DATE_MISSED'),false);
 assert.match(findingsFor(pp,'PKG-0004').find((f:any)=>f.code==='DELIVERY_AFTER_PROGRAMME_NEED').message,
  /^Forecast delivery is 165 calendar days after the linked programme need date \(screening\)\. The linked programme need date 2026-04-19 has passed, but the register required-on-site date 2026-10-05 has not\./);
 const accountability=await data('cross-domain-accountability');
 const issue=(reference:string):string=>String(accountability.recordActions.find((a:any)=>a.owningModule==='procurement-packages'&&String(a.issue).startsWith(reference+' '))?.issue);
 assert.match(issue('PKG-0400'),/Package is still undelivered after its assessed need date \(the linked programme need date \(screening\), 2026-06-01\)$/);
 assert.match(issue('PKG-0004'),/forecast delivery is 165 calendar days after the linked programme need date \(screening\)$/);
 const recovery=JSON.stringify(await data('recovery-acceleration'));
 assert.match(recovery,/The assessed need date \(the linked programme need date \(screening\), 2026-06-01\) has passed\. Historical lateness cannot be counted as future recovery\./);
 const lookahead=JSON.stringify(await data('lookahead-schedule'));
 assert.match(lookahead,/The assessed need date \(the linked programme need date \(screening\), 2026-06-01\) has passed without dated delivery evidence\./);
 for(const [key,text] of [['procurement-packages',JSON.stringify(pp)],['cross-domain-accountability',JSON.stringify(accountability)],['recovery-acceleration',recovery],['lookahead-schedule',lookahead]] as Array<[string,string]>)
  assert.doesNotMatch(text,FALSE_ROS,key+' never says a required-on-site date passed when the date that passed is another one');
});

test('G7_PROCUREMENT-56: a passed programme date alone is not a blocker, and a blocked item names its real cause',async()=>{
 const readiness=await data('procurement-readiness');
 const state=(reference:string)=>readiness.rows.find((r:any)=>r.reference===reference)?.state;
 assert.equal(state('PKG-0400'),'blocked','both candidate need dates have passed: a real date blocker');
 assert.equal(state('PKG-0004'),'at_risk','register date still ahead: at risk until the date basis is chosen, not blocked');
 assert.equal(state('PKG-0122'),'unknown','link timing mismatch: readiness not assessed');
 assert.equal(metric(readiness,'Blocked · known subset').value,1);
 const blocked=readiness.findings.filter((f:any)=>f.code==='READINESS_BLOCKED').map((f:any)=>f.message);
 assert.deepEqual(blocked,['PKG-0400 is blocked: the assessed need date (the linked programme need date (screening), 2026-06-01) has passed and delivery is not recorded at the reporting date.']);
 assert.ok(readiness.rows.find((r:any)=>r.reference==='PKG-0004').missingInputs.includes('Procurement date basis (linked programme or register date)'));
 // the shared rule itself: register date not passed, programme date passed, open status
 const t:any=procurementTiming({dataDateIso:'2026-09-30',programmeNeedDate:'2026-04-19',sourceRequiredOnSite:'2026-10-05',forecastDelivery:'2026-10-01',actualDelivery:null,status:'On Track'});
 assert.equal(t.overdueUndelivered,false);assert.equal(t.needDatePassedOnProgrammeOnly,true);assert.equal(t.forecastLate,true);assert.equal(t.needDate,'2026-04-19');
 // a chosen programme basis still makes it overdue; a passed register date stays overdue under screening
 assert.equal(procurementTiming({dataDateIso:'2026-09-30',programmeNeedDate:'2026-04-19',sourceRequiredOnSite:'2026-10-05',forecastDelivery:'2026-10-01',actualDelivery:null,status:'On Track',governingDate:'programme'}).overdueUndelivered,true);
 assert.equal(procurementTiming({dataDateIso:'2026-09-30',programmeNeedDate:'2026-12-01',sourceRequiredOnSite:'2026-09-01',forecastDelivery:'2026-10-15',actualDelivery:null,status:'Ordered'}).overdueUndelivered,true);
 assert.doesNotMatch(JSON.stringify(readiness),FALSE_ROS);
});

test('G7_PROCUREMENT-28: the procurement pages raise the same link timing mismatch as the look-ahead',async()=>{
 const sentence='Source package is linked, but required-on-site date 2027-01-31 is after activity finish 2026-10-20; confirm the link and required date before assessing material readiness';
 for(const key of ['procurement-packages','procurement-readiness']){
  const d=await data(key);
  const mismatch=d.findings.filter((f:any)=>f.code==='MATERIAL_LINK_TIMING_MISMATCH');
  assert.deepEqual(mismatch.map((f:any)=>[f.recordId,f.message]),[[recordId(d,'PKG-0122'),sentence+'.']],key);
  assert.equal(findingsFor(d,'PKG-0122').some((f:any)=>f.code==='PACKAGE_REQUIRED_DATE_MISSED'||f.code==='READINESS_BLOCKED'),false,key+': no date-passed or blocked claim');
 }
 const row:any=deliveryPosition(runtimeProjects.get(await project())!).packageRows.find(r=>r.reference==='PKG-0122')!;
 assert.equal(row.linkTimingMismatch,true);assert.equal(row.linkedActivityFinish,'2026-10-20');assert.equal(row.readiness?.state,'unknown');
 assert.ok(row.readiness?.missingInputs.includes('Confirmed activity link and required-on-site date'));
 const lookahead=JSON.stringify(await data('lookahead-schedule'));
 assert.ok(lookahead.includes(sentence),'the look-ahead says the same sentence');assert.ok(lookahead.includes('MATERIAL_LINK_TIMING_MISMATCH'));
});

test('G7_PROCUREMENT-47: the required-delivery curve uses the lateness need date and every delivery curve states its date basis',async()=>{
 const d=await data('procurement-scurves');
 const rows=deliveryPosition(runtimeProjects.get(await project())!).packageRows;
 const required=d.curves[0];
 assert.equal(required.key,'throughput|delivery|required|records','the need-date curve is the default curve');
 const needDates=rows.filter(r=>r.needDate&&!r.notApplicable).map(r=>r.needDate!).sort();
 assert.equal(required.points.at(-1).value,needDates.length);
 for(const point of required.points)assert.equal(point.value,needDates.filter(date=>date<=point.dateIso).length,'cumulative need dates at '+point.dateIso);
 // the lateness tables and the curve agree on what was needed before the Data Date
 const neededBefore=required.points.filter((p:any)=>p.dateIso<'2026-09-30').at(-1)?.value??0;
 assert.equal(neededBefore,rows.filter(r=>r.needDate&&r.needDate<'2026-09-30').length);
 assert.match(required.dateBasis,/^Assessed need date of each package, the same date the lateness checks use: the earlier of the linked programme need date and the register required-on-site date \(screening/);
 const planned=d.curves.find((c:any)=>c.key==='throughput|delivery|planned|records');
 assert.match(planned.dateBasis,/required-on-site date where no planned delivery date is stated\. The lateness checks use the assessed need date/);
 const html=runInNewContext(deliveryScript()+';deliveryChart(curve)',{Intl,curve:required,escapeHtml:(v:unknown)=>String(v),currentModuleResult:{data:{dataDateIso:'2026-09-30'}}});
 assert.match(html,/Date basis: Assessed need date of each package/,'the chart says which date it plots');
});

test('G7_PROCUREMENT-61: supplier late counts use the same packages as the procurement late count; close-out is counted apart',async()=>{
 const suppliers=await data('delivery-suppliers'),packages=await data('procurement-packages');
 const late=metric(packages,'Late delivery · known subset').value;
 assert.equal(suppliers.rows.reduce((n:number,r:any)=>n+r.lateKnownPackageCount,0),late,'per-supplier late counts add up to the procurement late count');
 const vendor=suppliers.rows.find((r:any)=>r.reference==='Vendor 139');
 assert.equal(vendor.packageCount,4);assert.equal(vendor.lateKnownPackageCount,1);assert.equal(vendor.closeoutPackageCount,2);
 assert.match(metric(suppliers,'Suppliers with known late packages').basis,/the same packages as the procurement late count\. Packages on completed work are counted apart as close-out/);
});

test('G7_PROCUREMENT-06: Delivery Control lists the procurement close-out group',async()=>{
 const d=await data('delivery-control');
 assert.ok(d.managementActions.some((a:any)=>a.issue==='Close-out review: Procurement packages requiring attention (2 records): PKG-0200, PKG-0201'),
  JSON.stringify(d.managementActions.map((a:any)=>a.issue)));
 assert.equal((await data('procurement-packages')).packageLinkedWork.closeoutCount,2);
});

test('G8_DESIGN_CONSTRUCTION_QUALITY-65: NCRs closed before they were raised are status unclear, never open',async()=>{
 const d=await data('delivery-quality');
 assert.equal(metric(d,'Open records').value,2,'NCR-0001 and NCR-0005 only');
 assert.equal(metric(d,'Status unclear').value,2,'NCR-0003 and NCR-0004 (close date before raised date)');
 for(const reference of ['NCR-0003','NCR-0004'])assert.notEqual(d.rows.find((r:any)=>r.reference===reference)?.currentStatus,'open',reference);
});

test('G8_DESIGN_CONSTRUCTION_QUALITY-40 and -55: one activity with an actual date after the Data Date never blanks a group',async()=>{
 for(const key of ['construction-discipline','construction-locations']){
  const d=await data(key);
  const electrical=d.rows.find((r:any)=>r.label==='Electrical');
  assert.equal(typeof electrical.scheduleProgressPercent,'number',key+': the group keeps its known-member progress');
  assert.equal(electrical.scheduleProgressUnknownActivityCount,1,key+': the unknown activity is counted beside it');
  assert.ok(d.rows.every((r:any)=>typeof r.scheduleProgressPercent==='number'),key);
 }
});

test('G8_DESIGN_CONSTRUCTION_QUALITY-44: a group is blocked only when all its unfinished work is blocked; date-basis packages are not blockers',async()=>{
 const d=await data('construction-discipline');
 const civil=d.rows.find((r:any)=>r.label==='Civil'),electrical=d.rows.find((r:any)=>r.label==='Electrical');
 assert.equal(electrical.readinessState,'partly_blocked');assert.equal(electrical.blockedActivityCount,1);assert.equal(electrical.unfinishedActivityCount,4);
 assert.deepEqual(electrical.mainBlockers,['PKG-0400','NCR-0005'],'PKG-0122 (link timing mismatch) is not a blocker');
 assert.equal(civil.readinessState,'blocked','its only unfinished activity has an open NCR');
 assert.deepEqual(civil.mainBlockers,['NCR-0001'],'PKG-0004 (register date still ahead, On Track) is not a blocker');
});

test('G9_HANDOVER_RISK-33: Delivery Risks is the supplied risk register, undated rows included and counted by their reported status',async()=>{
 const result=await page('delivery-risks'),d=result.data as any;
 assert.equal(d.boqDerivedCandidate,false);
 assert.deepEqual(d.rows.map((r:any)=>r.riskId).sort(),['RISK-0001','RISK-0002','RISK-0003','RISK-0004','RISK-0005','RISK-0006']);
 assert.match(d.managementPosition,/^6 risk records are supplied: 0 current, 0 after the Data Date and 6 without a reporting date/);
 assert.equal(metric(d,'Supplied risk records').value,6);
 assert.equal(metric(d,'Reported open / mitigating').value,5,'3 Open + 2 Mitigating');
 assert.equal(metric(d,'Reporting date missing').value,6);
 assert.equal(d.rows[0].riskId,'RISK-0001','ranked by the register score (0.8 x 5)');
 assert.equal(d.rows.find((r:any)=>r.riskId==='RISK-0001').rating,'Extreme');
 assert.equal(d.metrics.some((m:any)=>/BOQ/i.test(m.label)),false);
 assert.doesNotMatch(String(d.managementPosition),/from the BOQ|No confirmed Project Risk Register/);
});

test('G9_HANDOVER_RISK-38: BOQ wording candidates are a separate list without a source rating, never in the risk table',async()=>{
 const d=await data('delivery-risks');
 const candidates=(d.derivedRiskCandidates??[]).filter((r:any)=>r.candidateGroup==='Candidates from BOQ wording, not risks');
 assert.ok(candidates.length>0,'the BOQ candidate stays visible in its own list');
 assert.equal(d.rows.some((r:any)=>r.candidateGroup||r.status==='Candidate'),false,'no candidate in the register table');
 const columns=runInNewContext(deliveryScript()+';deliveryColumns("delivery-risks")',{Intl});
 assert.ok(columns.some(([key,label]:[string,string])=>key==='rating'&&label==='Source rating'),'Source rating is a register-table column');
 const script=deliveryScript(),candidateTable=script.slice(script.indexOf("deliveryTable('derivedRisks'"),script.indexOf('</details>',script.indexOf("deliveryTable('derivedRisks'")));
 assert.ok(candidateTable.length>0);
 assert.doesNotMatch(candidateTable,/'rating'|'severity'|Source rating|'owner'/,'the candidate list shows no rating, severity or owner as a source fact');
});

test('G6_COMMERCIAL-08: an amendment that replaces the notice period from a date is a dated version, not a conflict',async()=>{
 const d=await data('commercial-overview'),terms=d.focus.commercialTerms;
 assert.equal(terms.noticePeriodDays.value,14);assert.equal(terms.noticePeriodDays.state,'established');
 // G5_DELAY-30 (same defect, group b) reads the dated notice clauses as labelled contract
 // terms, so the period in force comes from the explicit dated contract data.
 assert.equal(terms.noticePeriodDays.basis.method,'explicit_dated_contract_data');
 assert.deepEqual(terms.noticeVersions.filter((v:any)=>v.noticeKind==='claim_notice').map((v:any)=>[v.noticePeriodDays,v.effectiveFromIso,v.effectiveToIso]),[[28,null,'2026-07-15'],[14,'2026-07-15',null]]);
 assert.equal((d.issueAssessment?.issues??[]).some((i:any)=>/notice ?period/i.test(String(i.summary))&&i.kind==='source_conflict'),false,'no records-disagree item for the notice period');
});

test('G6_COMMERCIAL-14: Final Account never calls untestable variations or obligations clear',async()=>{
 const checks=(await data('final-account')).checks;
 const check=(key:string)=>checks.find((c:any)=>c.key===key);
 assert.equal(check('variations').state,'unresolved','an approved-only list does not establish pending variations');
 assert.equal(check('obligations').state,'unresolved');
 assert.match(check('obligations').detail,/^Open and overdue obligations are not established: \d+ obligation clauses? (?:is|are) read from the contract with no due date or status\.$/);
 assert.doesNotMatch(JSON.stringify(checks),/0 open · 0 overdue|0 pending variation/);
});

test('G6_COMMERCIAL-46: the receipts scenario lists every missing input and its method never claims a term that is not recorded',async()=>{
 const cash=await data('cash-flow'),scenario=cash.programmeCashScenario??cash.position?.programmeCashScenario;
 for(const input of ['Dated gross certification','Contract retention percentage','Contract payment period'])assert.ok(scenario.missingInputs.includes(input),input);
 assert.equal(scenario.retentionPercent,null);assert.equal(scenario.paymentDays,null);
 assert.doesNotMatch(scenario.basis,/recorded contract rate|recorded payment period/);
 assert.match(scenario.basis,/retention needs the contract retention percentage, which is not recorded\. Receipt dates need the contract payment period, which is not recorded\./);
});

test('G7_PROCUREMENT-33: Material Tracking shows unknown quantities as unknown and names the register that fills each column',async()=>{
 const d=await data('material-tracking');
 assert.ok(d.rows.length>0);
 for(const row of d.rows)for(const key of ['ordered','delivered','accepted','installed','remainingToInstall'])assert.equal(row[key],null,row.reference+' '+key+' stays unknown, never 0');
 assert.match(d.managementPosition,/Installed and Remaining to install need a dated installed-quantity \(measurement\) register with BOQ item numbers and units\./);
 assert.match(d.managementPosition,/Ordered, Delivered and Accepted need a procurement or material delivery register that gives quantities against BOQ item numbers \(7 of 7 procurement packages have no item allocation\)\./);
});

test('G6_COMMERCIAL-18, -45, -51: no payment certificate is supplied, so certified, paid, retention and advance stay unknown with the input named',async()=>{
 for(const key of ['commercial-overview','payments','cash-flow']){
  const d=await data(key);
  const currencies=d.currencies??d.position?.currencies??[];assert.ok(currencies.length>0,key+' has its currency rows');
  for(const currency of currencies)for(const field of ['grossCertifiedAmount','paidAmount','certifiedUnpaidAmount','retentionHeldAmount','advanceBalance']){
   assert.equal(currency[field]?.value??null,null,key+' '+field+' is never 0');
  }
  assert.ok((d.issueAssessment?.issues??[]).some((i:any)=>i.kind==='missing_information'&&/Payment register/.test(i.summary)&&/Do not substitute zero/.test(i.action)),key+' names the missing payment register');
 }
});

test('G6_COMMERCIAL-67: LD, retention, payment, certification and security terms not in the contract text stay missing with their next step',async()=>{
 const particulars=await data('contract-particulars-bonds'),terms=particulars.focus?.commercialTerms??particulars.commercialTerms;
 for(const key of ['ldRate','ldCap','retentionPercent','paymentPeriodDays','performanceBondRequirement','advancePaymentBondRequirement']){
  assert.equal(terms[key].value,null,key);assert.equal(terms[key].state,'missing',key);assert.ok(String(terms[key].action??'').length>0,key+' says what to do');
 }
});

test('G8_DESIGN_CONSTRUCTION_QUALITY-60: with no location register no location is invented; programme areas are offered for review',async()=>{
 const d=await data('construction-locations');
 assert.deepEqual(d.locations,[]);
 assert.deepEqual(d.locationReview.wbsCandidates.map((c:any)=>c.location),['Project','Civil','Electrical']);
 assert.ok(d.locationReview.wbsCandidates.every((c:any)=>/location use requires review/.test(c.basis)));
});

test('G8_DESIGN_CONSTRUCTION_QUALITY-64: with no permit register the page, its download and its figures say unknown, never 0',async()=>{
 const projectId=await project(),result=moduleForProject(projectId,'delivery-permits'),d=result.data as any;
 assert.equal(d.empty,true);assert.equal(result.status,'blocked');
 assert.ok(d.metrics.length>0);
 for(const m of d.metrics){assert.equal(m.value,null,m.label);assert.equal(m.reason,'Needs a permit register',m.label);}
 const download=JSON.parse(buildModuleJsonDownload(projectId,'delivery-permits',result).toString());
 assert.ok(download.result.data.metrics.every((m:any)=>m.value===null),'the download carries no false zero');
});
