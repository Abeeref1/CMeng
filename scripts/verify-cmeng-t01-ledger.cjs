'use strict';
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const text=path=>readFileSync(join(root,path),'utf8');
const json=path=>JSON.parse(text(path));
const ledger=json('docs/repair-notes/cmeng-t01-original-defect-evidence-ledger.json');
const consultant=json('docs/acceptance/cmeng-f01-f61-274-defect-plan.json');
const plan=text('docs/repair-notes/CMeng_Repair_Plan.md');
const assertDistinct=(rows,name,total)=>{
  assert.equal(rows.length,total,name+' complete original item population');
  const ids=rows.map(x=>x.id);
  assert.equal(new Set(ids).size,total,name+' unique IDs');
};
assertDistinct(ledger.sw,'SW',57);
assertDistinct(ledger.f,'F',61);
assertDistinct(ledger.s,'S',8);
assert.deepEqual(ledger.requirements,{sw:57,f:61,consultantFindings:274,s:8,abbObservations:641,
  abbDefects:579,abbHistoricallyPassing:62,projects:23,guardRules:39,guardChecks:43401,
  guardHistoricalFailing:11822,guardHistoricalPassing:31579});
assert.equal(ledger.countedNamedItems,126);
assert.equal(ledger.countedConsultantFindings,274);
assert.equal(ledger.requirements.guardHistoricalFailing+ledger.requirements.guardHistoricalPassing,
  ledger.requirements.guardChecks,'historical rule result population unchanged');
const swOriginal=plan.split('\n').filter(row=>/^\| SW-\d\d \|/.test(row)).map(row=>row.split('|').slice(1,-1).map(x=>x.trim()));
assert.equal(swOriginal.length,57,'all original SW lines remain in owner plan');
for(let i=1;i<=57;i++){
 const id='SW-'+String(i).padStart(2,'0'),original=swOriginal.find(row=>row[0]===id);
 const item=ledger.sw.find(row=>row.id===id);
 assert.ok(original&&item,'original SW item '+id);
 assert.equal(item.description,original[1],'SW wording remains identical to original');
 assert.equal(item.priority,original[2],'SW priority remains identical');
 assert.deepEqual(item.tasks,original[3].split(',').map(x=>x.trim()),'SW tasks cannot be silently dropped');
 assert.equal(item.guardRules,original[4],'SW guard assignment remains unchanged');
}
assert.equal(consultant.items.length,61,'all 61 consultant fix items present');
const defectIds=new Set();
for(let i=1;i<=61;i++){
 const id='F'+String(i).padStart(2,'0');
 const original=consultant.items.find(x=>x.id===id),item=ledger.f.find(x=>x.id===id);
 assert.ok(original&&item,'F item '+id);
 assert.deepEqual(item.originalDefectIds,original.d,'exact consultant source D/N mapping');
 assert.equal(item.repairRequirement,original.fix,'consultant repair must not be shortened');
 assert.equal(item.expectedSourceCheck,original.test,'independent expected source evidence stays original');
 assert.equal(item.consultantObservation.historicalStatus,original.live,'original historical finding status preserved');
 for(const d of item.originalDefectIds){assert.ok(!defectIds.has(d),'duplicate consultant source finding '+d);defectIds.add(d);}
}
assert.equal(defectIds.size,274,'all consultant D/N defects mapped once');
for(let i=1;i<=266;i++)assert.ok(defectIds.has('D-'+String(i).padStart(3,'0')));
for(let i=1;i<=8;i++)assert.ok(defectIds.has('N-'+i));
assert.deepEqual(ledger.s.map(x=>x.id),['S02','S06','S07','S17','S21','S32','S35','S45']);
assert.equal(ledger.abb.originalTotal,641);
assert.equal(ledger.abb.problems,579);
assert.equal(ledger.abb.historicalPasses,62);
assert.equal(ledger.abb.problems+ledger.abb.historicalPasses,ledger.abb.originalTotal);
assert.deepEqual(ledger.abb.historicalSeverities,{Critical:19,High:153,Medium:291,Low:178});
assert.equal(ledger.abb.sourceRef.libraryFileId,'libfile_5b34fb78486c81918ed5d038e1912fd0');
assert.equal(ledger.abb.sourceRef.originalWorkbookSha256,'b30041505c92ce20446ba584a44d69e95d02f7fcb7b98e50abc1e40776e4c296');
assert.equal(ledger.abb.sourceRef.originalWorkbookSizeBytes,276998);
const groupCounts={
 G1_MANAGEMENT:93,G2_PLANNING:83,G3_CHANGES_FORECAST:78,G4_PROGRESS:54,
 G5_DELAY:62,G6_COMMERCIAL:75,G7_PROCUREMENT:65,
 G8_DESIGN_CONSTRUCTION_QUALITY:83,G9_HANDOVER_RISK:48,
};
assert.deepEqual(ledger.abb.groupCounts,groupCounts,'entire original workbook category population');
const ids=new Set();
for(const [group,count] of Object.entries(groupCounts)){
 for(let i=1;i<=count;i++){
  const id=group+'-'+String(i).padStart(2,'0');
  assert.ok(!ids.has(id),'no duplicate ABB IDs');
  ids.add(id);
 }
}
assert.equal(ids.size,641);
assertDistinct(ledger.abb.individualObservations,'ABB',641);
const observed=new Set(ledger.abb.individualObservations.map(x=>x.id));
assert.deepEqual(observed,ids,'every original ABB finding identifier must be present once');
const verdictCounts={Problem:0,'Originally correct':0};
for(const x of ledger.abb.individualObservations){
 assert.equal(x.sourceRef.libraryFileId,ledger.abb.sourceRef.libraryFileId);
 assert.equal(x.sourceRef.workbook,ledger.abb.sourceRef.workbook);
 assert.equal(x.sourceRef.sheet,ledger.abb.sourceRef.sheet);
 assert.equal(x.sourceRef.findExactId,x.id,'each row must point to exact original workbook ID');
 assert.ok(Object.hasOwn(verdictCounts,x.historicalVerdict),'source-only verdict');
 verdictCounts[x.historicalVerdict]++;
}
assert.deepEqual(verdictCounts,{Problem:579,'Originally correct':62});
// Candidate mappings from the unchanged original ABB workbook are a
// prioritization crosswalk, NEVER a substitute for current-release verification.
// One finding may have two distinct shared causes, so do not discard overlaps.
const overlap=ledger.abb.proposedOverlapAudit;
assert.ok(overlap,'original candidate root mapping audit retained');
assert.equal(overlap.candidateSwMappedProblemObservations,522);
assert.equal(overlap.problemObservationsPendingDetailedRootMapping,57);
assert.equal(overlap.originallyCorrectObservationsWithNoProblemMapping,62);
assert.equal(overlap.candidateSwMappedProblemObservations+overlap.problemObservationsPendingDetailedRootMapping,ledger.abb.problems);
assert.equal(overlap.originallyCorrectObservationsWithNoProblemMapping,ledger.abb.historicalPasses);
assert.equal(overlap.originalSourceWorkbookSha256,ledger.abb.sourceRef.originalWorkbookSha256);
assert.equal(new Set(overlap.distinctSwCandidateRootIds).size,15);
for(const id of overlap.distinctSwCandidateRootIds)
 assert.ok(ledger.sw.some(item=>item.id===id),'proposed ABB root exists in original SW population: '+id);

const historicallyCorrect=new Set((
 'G1_MANAGEMENT-36,G1_MANAGEMENT-37,G1_MANAGEMENT-38,G1_MANAGEMENT-39,G1_MANAGEMENT-40,G1_MANAGEMENT-41,G1_MANAGEMENT-56,G1_MANAGEMENT-65,G1_MANAGEMENT-66,G1_MANAGEMENT-81,G1_MANAGEMENT-93,G2_PLANNING-21,G2_PLANNING-39,G2_PLANNING-54,G2_PLANNING-62,G2_PLANNING-67,G2_PLANNING-70,G2_PLANNING-83,G3_CHANGES_FORECAST-13,G3_CHANGES_FORECAST-20,G3_CHANGES_FORECAST-32,G3_CHANGES_FORECAST-38,G3_CHANGES_FORECAST-53,G3_CHANGES_FORECAST-69,G3_CHANGES_FORECAST-78,G4_PROGRESS-11,G4_PROGRESS-28,G4_PROGRESS-35,G4_PROGRESS-40,G4_PROGRESS-49,G4_PROGRESS-54,G5_DELAY-25,G5_DELAY-26,G5_DELAY-37,G5_DELAY-38,G5_DELAY-50,G5_DELAY-62,G6_COMMERCIAL-17,G6_COMMERCIAL-19,G6_COMMERCIAL-29,G6_COMMERCIAL-38,G6_COMMERCIAL-62,G6_COMMERCIAL-75,G7_PROCUREMENT-16,G7_PROCUREMENT-30,G7_PROCUREMENT-38,G7_PROCUREMENT-45,G7_PROCUREMENT-53,G7_PROCUREMENT-60,G7_PROCUREMENT-65,G8_DESIGN_CONSTRUCTION_QUALITY-16,G8_DESIGN_CONSTRUCTION_QUALITY-17,G8_DESIGN_CONSTRUCTION_QUALITY-18,G8_DESIGN_CONSTRUCTION_QUALITY-31,G8_DESIGN_CONSTRUCTION_QUALITY-39,G8_DESIGN_CONSTRUCTION_QUALITY-53,G8_DESIGN_CONSTRUCTION_QUALITY-76,G8_DESIGN_CONSTRUCTION_QUALITY-83,G9_HANDOVER_RISK-20,G9_HANDOVER_RISK-22,G9_HANDOVER_RISK-30,G9_HANDOVER_RISK-48'
).split(','));
assert.equal(historicallyCorrect.size,62,'all 62 original passing cases locked by source ID');
for(const item of ledger.abb.individualObservations){
 assert.equal(item.historicalVerdict,
  historicallyCorrect.has(item.id)?'Originally correct':'Problem',
  'original ABB observation verdict cannot be swapped or silently promoted: '+item.id);
}
const all=[...ledger.sw,...ledger.f,...ledger.s,...ledger.abb.individualObservations];
for(const item of all){
 assert.ok(['not_reconciled','partial_source_repair_saved','source_fix_verified','independently_certified'].includes(item.implementation.status),
  'explicit implementation state for '+item.id);
 assert.ok(['not_certified','certified'].includes(item.independentVerification.status),
  'no invented independent status for '+item.id);
 if(item.independentVerification.status==='certified')
  assert.ok(item.independentVerification.exactSha&&item.independentVerification.evidenceReceipt,
   'full exact-SHA independent evidence required for '+item.id);
 if(item.ownerAcceptance==='accepted')
  assert.ok(item.independentVerification.status==='certified'&&item.ownerReceipt,
   'independent evidence and owner receipt required before closure for '+item.id);
}
const open=all.filter(x=>x.ownerAcceptance!=='accepted').length;
console.log('CMENG_T01_TRACEABILITY_CHECK=PASS original_items='+all.length+
  ' sw='+ledger.sw.length+' f='+ledger.f.length+' consultant_findings='+defectIds.size+
  ' s='+ledger.s.length+' abb_source_rows='+ledger.abb.individualObservations.length+
  ' abb_problem='+verdictCounts.Problem+' abb_originally_correct='+verdictCounts['Originally correct']+
  ' owner_acceptance_outstanding='+open);
