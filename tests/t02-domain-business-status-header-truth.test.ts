import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalHeader,isRegisterHeader,prepareRegisterRows,registerBusinessStatusFields,
} from '../packages/truth-kernel/src/register-schema';

// The independent source matrix retains raw column names and independent
// business-status cells; recognition never implies approval or final closure.
const domains=[
 {type:'quality_ncr_register',id:'NCR ID',statuses:['NCR Status','Closure Status'],values:['Open','Pending']},
 {type:'rfi_register',id:'RFI ID',statuses:['RFI Status','Response Status'],values:['Under review','Unanswered']},
 {type:'risk_register',id:'Risk ID',statuses:['Risk Status','Risk Treatment Status'],values:['Active','Mitigating']},
 {type:'submittal_register',id:'Submittal ID',statuses:['Submittal Status','Approval Status','Review Status'],values:['Submitted','Approved with comments','Pending']},
 {type:'procurement_register',id:'Package ID',statuses:['Procurement Status','Delivery Status','Package Status'],values:['Ordered','Not delivered','Open']},
] as const;
for(const domain of domains){
 test('T02 source-status column audit retains '+domain.type+' business fields distinctly',()=>{
   const headers=[domain.id,...domain.statuses,'Location','Unfamiliar Third-Party Field'];
   const cells=['SRC-17',...domain.values,'Zone B','Needs domain review'];
   const original=[['Source register'],headers,cells];
   const preserved=JSON.stringify(original);
   const read=prepareRegisterRows(original.map(row=>[...row]),domain.type);
   assert.equal(read.recognized,true,'real source headers must establish table identity');
   assert.equal(read.headerRow,2);
   assert.equal(read.readRowCount,1);
   assert.deepEqual(read.rows,[cells],'source status and extra fields remain exact, including case');
   assert.deepEqual(read.rawHeaders,headers);
   assert.deepEqual(read.unknown,['Unfamiliar Third-Party Field']);
   const kinds=read.columnAudit.slice(1,1+domain.statuses.length);
   for(let i=0;i<domain.statuses.length;i++){
     const expected=canonicalHeader(domain.statuses[i]!,domain.type);
     assert.equal(kinds[i]!.canonicalHeader,expected);
     assert.equal(kinds[i]!.mappingState,'schema_recognized');
     assert.equal(isRegisterHeader(domain.statuses[i]!),true);
     assert.ok(registerBusinessStatusFields(domain.type).includes(expected),
       'the actual shared consumer selects this business status field');
   }
   assert.equal(new Set(kinds.map(k=>k.canonicalHeader)).size,domain.statuses.length,
     'approval, response, closure and package statuses must not collapse');
   assert.equal(JSON.stringify(original),preserved,'preparation is read-only');
 });
}

test('T02 two-column status register is recognized without treating workflow status as source governance',()=>{
 const rows=[['NCR ID','NCR Status'],['N-29','Open'],['N-30','Closed']];
 const result=prepareRegisterRows(rows,'quality_ncr_register');
 assert.equal(result.recognized,true);
 assert.deepEqual(result.headers,['ncr id','ncr status']);
 assert.deepEqual(result.rows,[['N-29','Open'],['N-30','Closed']]);
 assert.deepEqual(result.unknown,[]);
 assert.equal(result.columnAudit[1]!.mappingState,'schema_recognized');
});

test('T02 unknown fields remain explicitly unmapped rather than falsely approved',()=>{
 const rows=[['Submittal ID','Review Status','Expected Final Approval'],['SUB-1','Reviewed','Owner to decide']];
 const result=prepareRegisterRows(rows,'submittal_register');
 assert.equal(result.recognized,true);
 assert.deepEqual(result.unknown,['Expected Final Approval']);
 assert.equal(result.rows[0]![1],'Reviewed');
 assert.equal(result.rows[0]![2],'Owner to decide');
});
