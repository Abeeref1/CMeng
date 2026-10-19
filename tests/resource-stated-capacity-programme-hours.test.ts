import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {weeklyResourceCapacityEvidence} from '../packages/runtime-api/src/canonical-resource-evidence';
import {canonicalResourceModule,programmeRecordedLaborHours} from '../packages/runtime-api/src/canonical-resource-runtime';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';

// F16: stated register capacity is used for utilization (labelled stated, not approved) instead of being dropped;
// overload verdicts still need approved capacity. Programme-recorded actual hours are used when no register gives them.
function stored(dir:string,id:string,body:string){
 const bytes=Buffer.from(body),storedPath=join(dir,id+'.csv');writeFileSync(storedPath,bytes);
 return {documentId:id,sourceHashSha256:createHash('sha256').update(bytes).digest('hex'),storedPath,sourceFilename:'resource_'+id+'.csv',mediaType:'text/csv',
  basisState:'active',linkedArtifactId:null,uploadedAt:'2031-04-01',familyKey:'family-'+id,documentType:'resource_register',parserState:'parsed',
  identification:{needsReview:false},lineage:{needsReview:false},supersededByDocumentId:null} as any;
}

test('register capacity without an approval column is used for utilization, labelled stated, not approved; no overload verdict',()=>{
 const dir=mkdtempSync(join(tmpdir(),'f16-stated-'));
 try{
  const s=weeklyResourceCapacityEvidence([stored(dir,'stated','resource id,resource name,week start,available capacity,planned demand,actual hours,unit\nR1,Foreman,2031-01-06,40,50,30,labor_hour\n')],'2031-01-31');
  const p=s.points[0]!;
  assert.equal(p.capacityAuthority,'stated_not_approved');assert.equal(p.utilizationCapacity,40);
  assert.equal(p.availableCapacity,null,'approved-capacity field (used for verdicts) stays approved-only');
  const r=s.resourceSummaries[0]!;
  assert.equal(r.plannedUtilizationPercent,125);assert.equal(r.actualUtilizationPercent,75);assert.equal(r.capacityBasis,'stated_not_approved');
  assert.equal(r.plannedPeriodCountToDataDate,1);assert.equal(r.actualPeriodCountToDataDate,1);
  assert.equal(s.plannedAverageToDataDate,125);assert.equal(s.actualAverageToDataDate,75);assert.equal(s.utilizationCapacityBasis,'stated_not_approved');
  assert.equal(s.overloadedRowCount,0,'no overload verdict from unapproved capacity');assert.equal(s.capacityChecksToDataDate!.planned.exceededCount,0);
  assert.equal(r.plannedOverloadOccurrences,0);assert.deepEqual(s.futureCapacityPeaks,[]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('an approval column that does not say approved keeps capacity out; approved capacity gives utilization and verdicts',()=>{
 const dir=mkdtempSync(join(tmpdir(),'f16-approval-'));
 try{
  const pending=weeklyResourceCapacityEvidence([stored(dir,'pending','resource id,resource name,week start,available capacity,planned demand,unit,capacity approval\nR1,Foreman,2031-01-06,40,50,labor_hour,Pending\n')],'2031-01-31');
  assert.equal(pending.points[0]!.utilizationCapacity,null);assert.equal(pending.points[0]!.capacityAuthority,'source_unconfirmed');
  assert.equal(pending.resourceSummaries[0]!.plannedUtilizationPercent,null);assert.equal(pending.resourceSummaries[0]!.capacityBasis,'not_established');
  assert.equal(pending.plannedAverageToDataDate,null,'utilization stays not established only when no usable capacity exists');
  const approved=weeklyResourceCapacityEvidence([stored(dir,'approved','resource id,resource name,week start,available capacity,planned demand,unit,capacity approval\nR1,Foreman,2031-01-06,40,50,labor_hour,Approved\n')],'2031-01-31');
  assert.equal(approved.points[0]!.availableCapacity,40);assert.equal(approved.resourceSummaries[0]!.capacityBasis,'approved_source');
  assert.equal(approved.plannedAverageToDataDate,125);assert.equal(approved.overloadedRowCount,1);
  const none=weeklyResourceCapacityEvidence([stored(dir,'none','resource id,resource name,week start,planned demand,available capacity,unit\nR1,Foreman,2031-01-06,50,,labor_hour\n')],'2031-01-31');
  assert.equal(none.points[0]!.utilizationCapacity,null);assert.equal(none.plannedAverageToDataDate,null,'missing capacity is never 0');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('programme-recorded actual hours (act_reg_qty + act_ot_qty) are established only when every labour assignment states them',()=>{
 const resource={resourceId:'L',name:'Labour',shortName:'L',resourceType:'labor',unitName:'Hour',unitAbbreviation:'hr',priceTimeUnit:'hour'};
 const a=(id:string,reg:number|null,ot:number|null)=>({assignmentId:id,resourceId:'L',activityId:'A',actualRegularUnits:reg,actualOvertimeUnits:ot});
 assert.equal(programmeRecordedLaborHours({resources:[resource],assignments:[a('1',20,2),a('2',8,0)]} as any).hours,30);
 const partial=programmeRecordedLaborHours({resources:[resource],assignments:[a('1',20,2),a('2',null,0)]} as any);
 assert.equal(partial.hours,null);assert.match(partial.reason!,/1 of 2 labour assignments/);
 assert.equal(programmeRecordedLaborHours(null).hours,null);
 assert.equal(programmeRecordedLaborHours({resources:[{...resource,resourceType:'material',unitName:'m3',unitAbbreviation:'m3',priceTimeUnit:null}],assignments:[a('1',20,0)]} as any).hours,null,'non-labour units are not labour hours');
});

test('Man-hour S-curve uses programme-recorded actual hours when the weekly register gives none, labelled as such',()=>{
 const dir=mkdtempSync(join(tmpdir(),'f16-programme-'));
 try{
  const state=loadCertifiedDemoProject('F16-PROGRAMME-HOURS');
  state.evidenceDocuments=[...state.evidenceDocuments,stored(dir,'weekly','resource id,resource name,week start,available capacity,planned demand,unit\nLAB1,Civil Labour,2025-12-29,40,30,labor_hour\n')];state.version++;
  const m=canonicalResourceModule(state,'manhour-scurve')!;
  const d=m.data as any;
  assert.equal(d.actualHoursBasis,'programme_recorded');
  assert.equal(d.actualHoursKnownCurrent,20,'demo XER assignment states 20 regular + 0 overtime actual hours');
  assert.equal(d.programmeRecordedActualHours,20);
  assert.equal(d.actualHoursToDataDate,null,'register plan-to-date comparison does not mix in programme hours');
  const withRegister=loadCertifiedDemoProject('F16-REGISTER-HOURS');
  withRegister.evidenceDocuments=[...withRegister.evidenceDocuments,stored(dir,'weekly2','resource id,resource name,week start,available capacity,planned demand,actual hours,unit\nLAB1,Civil Labour,2025-12-29,40,30,12,labor_hour\n')];withRegister.version++;
  const r=canonicalResourceModule(withRegister,'manhour-scurve')!.data as any;
  assert.equal(r.actualHoursBasis,'source_register');assert.equal(r.actualHoursKnownCurrent,12);assert.equal(r.programmeRecordedActualHours,null);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
