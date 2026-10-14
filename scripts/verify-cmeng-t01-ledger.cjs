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
const all=[...ledger.sw,...ledger.f,...ledger.s];
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
console.log('CMENG_T01_TRACEABILITY_CHECK=PASS named='+all.length+' consultant='+defectIds.size+
  ' sw='+ledger.sw.length+' f='+ledger.f.length+' s='+ledger.s.length+
  ' abb_pending_row_reconciliation='+ledger.abb.originalTotal+
  ' not_owner_accepted='+open);
