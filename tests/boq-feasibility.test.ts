import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBoqFeasibility} from '../packages/delivery-challenge/src/boq-feasibility';
import {programmePcMilestone,deliveryFeasibilityForState} from '../packages/runtime-api/src/delivery-feasibility';
import {suppliedBoqFigures} from '../packages/runtime-api/src/boq-source';

function fixture(){
 const calendar={calendarId:'CAL',name:'Eight hour source calendar',semanticComplete:true,standardDayHours:8,standardWeekHours:56,weeklyWorkMinutes:Array(7).fill(480),weeklyWorkIntervals:[1,2,3,4,5,6,7].map(dayIndex=>({dayIndex,intervals:[{start:'08:00',finish:'16:00',minutes:480}]})),exceptions:[],sourceRefs:[]};
 const activity={activityId:'A',name:'Concrete',activityType:'task',status:'in_progress',calendarId:'CAL',forecastStartIso:'2031-07-01T08:00:00Z',forecastFinishIso:'2031-07-02T16:00:00Z',currentFinishIso:'2031-07-02T16:00:00Z',sourceRefs:[],diagnostics:[]};
 const schedule:any={sourceRevisionId:'S',dataDateIso:'2031-07-01T08:00:00Z',activities:[activity],calendars:[calendar],relationships:[],wbs:[]};
 const quantities:any={scheduleRevisionId:'S',items:[{quantityItemId:'Q',description:'Concrete',unit:'m3',contractQuantity:100,sourceRefs:[]}],allocations:[{quantityItemId:'Q',activityId:'A',allocatedQuantity:100,sourceRefs:[]}],installedSnapshots:[{quantityItemId:'Q',asOfIso:'2031-07-01',installedQuantity:20,sourceRefs:[]}]};
 const resources:any={sourceRevisionId:'S',resources:[{resourceId:'R',resourceType:'labor',unitAbbreviation:'h',calendarId:'CAL'}],assignments:[{resourceId:'R',resourceType:'labor',activityId:'A',remainingUnitsPerHour:5,actualRegularUnits:40,actualOvertimeUnits:0,sourceRefs:[]}]};
 const rates=[{quantityItemId:'Q',activityId:'A',unit:'m3',laborHoursPerUnit:2,sourceRefs:['productivity-rate:row:2']}];
 return {schedule,quantities,resources,rates};
}
test('supplied BOQ figures preserve readable fields and zero without calculation or approval inputs',()=>{
 const boq:any={sourceFilename:'priced.xlsx',evidenceReceipt:{revisionId:'BOQ-1'},state:'partial_candidate',canonicalItems:[{itemId:'Q',itemNumber:'10',description:'Concrete',unit:'m3',quantity:100,rate:0,amount:0,currency:'SAR',status:'unresolved',sourceRefs:['row:4']},{itemId:'Q2',itemNumber:'20',description:'Steel',unit:'kg',quantity:50,rate:null,amount:null,currency:null,status:'unresolved',sourceRefs:['row:5']}]};
 const figures=suppliedBoqFigures(boq,null);
 assert.equal(figures.itemCount,2);assert.equal(figures.readableQuantityCount,2);
 assert.deepEqual(figures.rows.map(r=>[r.quantity,r.rate,r.amount,r.currency]),[[100,0,0,'SAR'],[50,null,null,null]]);
 const quantities=fixture().quantities;quantities.allocations=[];quantities.installedSnapshots=[];
 assert.equal(suppliedBoqFigures(null,quantities).rows[0]!.quantity,100);
});
test('BOQ and calendar establish required manpower, then supplied capacity tests duration',()=>{
 const result=buildBoqFeasibility(fixture()),row=result.rows[0]!,activity=result.activityChecks[0]!;
 assert.equal(row.remainingQuantity,80);assert.equal(row.requiredLaborHours,160);assert.equal(row.availableWorkingHours,16);assert.equal(row.requiredAveragePeople,10);
 assert.equal(activity.submittedPeople,5);assert.equal(activity.manpowerGap,-5);assert.equal(activity.productionFinishIso,'2031-07-04T16:00:00.000Z');assert.equal(activity.scheduleState,'exceeds');assert.equal(result.overallStatus,'Challenge required');
 const second=fixture();second.resources.assignments[0].remainingUnitsPerHour=10;
 const supported=buildBoqFeasibility(second);assert.equal(supported.activityChecks[0]!.scheduleState,'fits');assert.equal(supported.overallStatus,'No material contradiction found');
});
test('measured productivity uses the same mapped scope and reporting date, not remaining budget hours',()=>{
 const input=fixture();input.rates=[];input.resources.assignments[0].remainingUnits=999999;
 const result=buildBoqFeasibility(input);assert.equal(result.rows[0]!.productivityBasis,'measured_same_scope');assert.equal(result.rows[0]!.requiredLaborHours,160);
 input.resources.assignments[0].actualOvertimeUnits=null;
 const missing=buildBoqFeasibility(input);assert.equal(missing.requiredLaborHours,null);assert.match(missing.rows[0]!.reason,/complete labor hours/);assert.equal(missing.overallStatus,'Unable to assess');
});
test('unreadable calendar, missing quantities, future progress, missing rate, and unconfirmed mapping stay unresolved',()=>{
 for(const mutate of [(f:any)=>{f.schedule.calendars=[];},(f:any)=>{f.quantities.installedSnapshots=[];},(f:any)=>{f.quantities.installedSnapshots[0].asOfIso='2031-07-03';},(f:any)=>{f.rates=[];f.resources=null;},(f:any)=>{f.quantities.allocations=[];}]){
  const input=fixture();mutate(input);const result=buildBoqFeasibility(input);assert.equal(result.state,'unresolved');assert.equal(result.requiredLaborHours,null);assert.equal(result.rows[0]!.requiredAveragePeople,null);assert.ok(result.rows[0]!.reason);assert.equal(result.overallStatus,'Unable to assess');
 }
});
test('multiple BOQ items use the combined activity labor requirement and do not reuse the full crew per item',()=>{
 const f=fixture();f.quantities.items.push({...f.quantities.items[0],quantityItemId:'Q2',contractQuantity:50,unit:'kg'});f.quantities.allocations.push({quantityItemId:'Q2',activityId:'A',allocatedQuantity:50,sourceRefs:[]});f.quantities.installedSnapshots.push({quantityItemId:'Q2',asOfIso:'2031-07-01',installedQuantity:10,sourceRefs:[]});f.rates.push({quantityItemId:'Q2',activityId:'A',unit:'kg',laborHoursPerUnit:2,sourceRefs:['rate:2']});
 const result=buildBoqFeasibility(f),a=result.activityChecks[0]!;assert.equal(a.requiredLaborHours,240);assert.equal(a.requiredAveragePeople,15);assert.equal(a.manpowerGap,-10);assert.equal(a.productionFinishIso,'2031-07-06T16:00:00.000Z');assert.equal(result.rows.length,2);
});
test('Programme PC must be an explicit unique milestone; a latest task finish is never a substitute',()=>{
 const f=fixture();assert.equal(programmePcMilestone(f.schedule).dateIso,null);
 f.schedule.activities.push({...f.schedule.activities[0],activityId:'PC',name:'Programme PC',activityType:'finish_milestone'});
 assert.equal(programmePcMilestone(f.schedule).dateIso,'2031-07-02T16:00:00.000Z');
 f.schedule.activities.push({...f.schedule.activities[1],activityId:'PC-2'});assert.equal(programmePcMilestone(f.schedule).dateIso,null);
});

test('runtime reads a supplied productivity rate and compares only the adopted Programme PC milestone',t=>{
 const f=fixture(),dir=mkdtempSync(join(tmpdir(),'boq-delivery-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 f.resources.assignments[0].actualRegularUnits=null;
 f.schedule.activities.push({...f.schedule.activities[0],activityId:'PC',name:'Programme PC',activityType:'finish_milestone',forecastFinishIso:'2031-09-15T16:00:00Z'});
 const base=structuredClone(f.schedule);base.sourceRevisionId='BASE';base.dataDateIso='2031-06-01T08:00:00Z';base.activities[1].forecastFinishIso='2031-09-01T16:00:00Z';
 const bytes=Buffer.from('BOQ Item ID,Activity ID,Unit,Labour Hours Per Unit,Effective Date\nQ,A,m3,2,01/07/2031');const storedPath=join(dir,'rates.csv');writeFileSync(storedPath,bytes);
 const state:any={version:1,activeEvidenceBasis:{'schedule:control':{activeArtifactId:'S'},'schedule:baseline':{activeArtifactId:'BASE'}},schedules:[{role:'baseline',revision:{revisionId:'BASE',model:base}},{role:'update',revision:{revisionId:'S',model:f.schedule}}],quantities:f.quantities,resourcesByRevision:new Map([['S',f.resources]]),evidenceDocuments:[{documentId:'RATES',sourceFilename:'productivity.csv',mediaType:'text/csv',basisState:'active',sourceHashSha256:createHash('sha256').update(bytes).digest('hex'),storedPath,linkedArtifactId:null,uploadedAt:'2031-07-01'}]};
 const result=deliveryFeasibilityForState(state)!;assert.equal(result.requiredLaborHours,160);assert.equal(result.rows[0]!.productivityBasis,'supplied_rate');assert.equal(result.programmePc.movementDays,14);assert.equal(result.programmePc.state,'established');
 state.activeEvidenceBasis['schedule:baseline']=undefined;state.version++;
 assert.equal(deliveryFeasibilityForState(state)!.programmePc.movementDays,null);
});
