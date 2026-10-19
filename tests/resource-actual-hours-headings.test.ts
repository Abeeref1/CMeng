import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {weeklyResourceCapacityEvidence} from '../packages/runtime-api/src/canonical-resource-evidence';
import {weeklyResourceCapacityEvidence as supportWeekly} from '../packages/runtime-api/src/resource-support-evidence';

// F16: recorded (actual) hours are read from the headings real registers use, and from timesheet registers.
function stored(dir:string,id:string,body:string){
 const bytes=Buffer.from(body),storedPath=join(dir,id+'.csv');writeFileSync(storedPath,bytes);
 return {documentId:id,sourceHashSha256:createHash('sha256').update(bytes).digest('hex'),storedPath,sourceFilename:'resource_'+id+'.csv',mediaType:'text/csv',
  basisState:'active',linkedArtifactId:null,uploadedAt:'2031-04-01',familyKey:'family-'+id,documentType:'resource_register',parserState:'parsed',
  identification:{needsReview:false},lineage:{needsReview:false},supersededByDocumentId:null} as any;
}

test('weekly register "Actual Hours" / "Actual Man-hours" columns are read as actual usage to the Data Date',()=>{
 const dir=mkdtempSync(join(tmpdir(),'f16-headings-'));
 try{
  const weekly=stored(dir,'weekly','resource id,resource name,week start,available capacity,planned demand,actual hours,unit\nR1,Foreman,2031-01-06,40,30,28,labor_hour\nR1,Foreman,2031-02-03,40,30,25,labor_hour\n');
  const s=weeklyResourceCapacityEvidence([weekly],'2031-01-31');
  const jan=s.points.find(p=>p.resourceId==='R1'&&p.weekStartIso?.startsWith('2031-01-06'))!;
  assert.equal(jan.actualApprovedUsage,28,'Actual Hours is read');
  assert.equal(s.points.find(p=>p.weekStartIso?.startsWith('2031-02-03'))!.actualApprovedUsage,null,'a week after the Data Date is withheld');
  const manhours=stored(dir,'manhours','resource id,resource name,week start,available capacity,planned demand,actual man-hours,unit\nR2,Mason,2031-01-06,40,30,31,labor_hour\n');
  assert.equal(weeklyResourceCapacityEvidence([manhours],'2031-01-31').points[0]!.actualApprovedUsage,31,'Actual Man-hours is read');
  const support=supportWeekly([stored(dir,'support','resource id,resource name,week start,available capacity,planned demand,actual manhours,unit\nR3,Painter,2031-01-06,40,30,22,labor_hour\n')] as any,{dataDateIso:'2031-01-31'} as any) as any;
  assert.equal(support.points.find((p:any)=>p.resourceId==='R3')?.actualApprovedUsage,22,'the resource-support reader also reads Actual Manhours');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('a timesheet register supplies recorded hours when the weekly register has none; conflicts and missing stay unknown',()=>{
 const dir=mkdtempSync(join(tmpdir(),'f16-timesheet-'));
 try{
  const weekly=stored(dir,'cap','resource id,resource name,week start,available capacity,planned demand,unit\nR1,Foreman,2031-01-06,40,30,labor_hour\nR2,Mason,2031-01-06,40,30,labor_hour\nR3,Painter,2031-01-06,40,30,labor_hour\n');
  const sheet=stored(dir,'sheet','resource id,week start,actual man-hours\nR1,2031-01-06,26\nR2,2031-01-06,10\nR2,2031-01-06,12\n');
  const s=weeklyResourceCapacityEvidence([weekly,sheet],'2031-01-31');
  const get=(id:string)=>s.points.find(p=>p.resourceId===id)!;
  assert.equal(get('R1').actualApprovedUsage,26,'timesheet hours are read');
  assert.ok(get('R1').receipts.some(r=>r.documentId==='sheet'),'the timesheet is cited');
  assert.ok(s.diagnostics.some(d=>d.startsWith('TIMESHEET_ACTUAL_HOURS_NOT_SEPARATELY_CONFIRMED:R1')));
  assert.equal(get('R2').actualApprovedUsage,null,'conflicting timesheet rows stay unknown');
  assert.equal(get('R3').actualApprovedUsage,null,'no recorded hours stays unknown, never 0');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
