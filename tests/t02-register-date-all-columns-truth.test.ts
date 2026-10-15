import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRegisterRows,type SourceTable} from '../packages/truth-kernel/src';
import {inspectRegisterDate,reviewRegisterDates,scopeRegisterDateReview} from '../packages/runtime-api/src/register-date-review';

function fixture(type:string,rows:string[][]):SourceTable {
 const prepared=prepareRegisterRows(rows,type),input=JSON.stringify(rows);
 const table={document:{documentId:'DOC-'+type,sourceFilename:type+'.csv',documentType:type},
   headers:prepared.headers,
   rows:prepared.rows.map(row=>({cells:Object.freeze(Object.fromEntries(prepared.headers.map((h,i)=>[h,row[i]??''])))})),
   sourceUnchanged:input} as unknown as SourceTable;
 return table;
}
test('T02/T07/T08 independently inspect every populated date field, not only first valid column',()=>{
 const cases=[
  {type:'quality_ncr_register',header:['NCR ID','Raised Date','Closed Date','Status'],
   values:[['N-1','31/08/2026','31/02/2026','Closed'],['N-2','01/09/2026','','Open']],
   fields:['raised date','issue date','status as of','closed date'],bad:'closed date'},
  {type:'rfi_register',header:['RFI ID','Raised Date','Due Date','Status'],
   values:[['R-1','31/08/2026','31/02/2026','Open'],['R-2','01/09/2026','','Open']],
   fields:['raised date','due date','issue date','status as of'],bad:'due date'},
  {type:'payment_certificates',header:['Certificate No','Certificate Date','Payment Date','Status'],
   values:[['IPC-1','31/08/2026','31/02/2026','Paid'],['IPC-2','01/09/2026','','Certified']],
   fields:['certificate date','period end','payment date'],bad:'payment date'},
  {type:'procurement_register',header:['Package ID','Required on Site','Forecast Delivery','Status'],
   values:[['P-1','31/08/2026','31/02/2026','Late'],['P-2','01/09/2026','','Open']],
   fields:['required on site','forecast delivery','actual delivery','due date'],bad:'forecast delivery'},
 ];
 const reviews=[];
 for(const row of cases){
  const original=JSON.stringify(row),table=fixture(row.type,[row.header,...row.values]);
  const actual=inspectRegisterDate(table,row.fields);
  assert.equal(actual.state,'values_invalid_or_missing',row.type);
  assert.equal(actual.total,2,row.type);
  assert.equal(actual.populated,2,row.type);
  assert.equal(actual.valid,1,row.type+' a valid first date never hides bad later date');
  assert.equal(actual.invalidPopulatedDateCells,1,row.type);
  assert.equal(actual.fieldAudit.find(x=>x.field===row.bad)?.invalid,1,row.type);
  assert.equal(actual.fieldAudit.find(x=>x.field===row.bad)?.populated,1,row.type);
  assert.match(actual.message,/populated date cell\(s\) are invalid/);
  assert.equal(JSON.stringify(row),original,'original row data untouched');
  reviews.push(table);
 }
 const project=reviewRegisterDates(reviews);
 assert.equal(project.rows.length,4);
 assert.equal(project.likelyMappingFault,false,'bad source date cell is not an invented reader schema failure');
 const scoped=scopeRegisterDateReview(project,'payments');
 assert.equal(scoped.rows.length,1);
 assert.equal(scoped.rows[0]?.documentType,'payment_certificates');
});
test('T02 fully valid required dates and blank optional dates are not false errors',()=>{
 const t=fixture('quality_ncr_register',[
  ['NCR ID','Raised Date','Closed Date','Status'],
  ['N-1','31/08/2026','','Open'],
  ['N-2','01/09/2026','02/09/2026','Closed']
 ]);
 const actual=inspectRegisterDate(t,['raised date','closed date']);
 assert.equal(actual.state,'complete');
 assert.equal(actual.valid,2);
 assert.equal(actual.invalidPopulatedDateCells,0);
 assert.equal(actual.fieldAudit.find(x=>x.field==='closed date')?.populated,1);
 const empty=fixture('rfi_register',[['RFI ID','Raised Date','Due Date','Status']]);
 const blank=inspectRegisterDate(empty,['raised date','due date']);
 assert.equal(blank.state,'rows_unavailable');
 assert.equal(blank.valid,0);
 assert.equal(blank.missingPercent,null);
 assert.match(blank.message,/no source record rows were read/);
});
