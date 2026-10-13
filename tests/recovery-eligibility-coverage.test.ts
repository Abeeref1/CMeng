import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {recoveryAccelerationIntelligence} from '../packages/runtime-api/src/recovery-acceleration';
import {changeDelivery,deliveryRecords,deliveryStore} from '../packages/runtime-api/src/delivery-records';
import {cachedIndependentForecast} from '../packages/runtime-api/src/forecast-cache';

let sequence=0;
function fixture(){
 const state=loadCertifiedDemoProject('RECOVERY-COVERAGE-'+(++sequence));
 state.quantities=null;state.resourcesByRevision.clear();state.evidenceDocuments=[];delete state.delivery;state.version++;
 const model=projectControlSchedule(state)!.revision.model;
 const change=(input:any)=>{const result=changeDelivery(state,{expectedVersion:state.version,...input});state.version++;return result;};
 const create=(kind:'package'|'workfront',reference:string,fields:any={},governed=true)=>{
  change({action:'create',kind,fields:{'record reference':reference,description:reference,...fields}});
  const raw=deliveryStore(state).manual.at(-1)!;
  if(governed)change({action:'review',recordId:raw.recordId,sourceRevision:raw.revision,state:'governed',fields:{},note:'Source reviewed for this test.'});
  return deliveryRecords(state).records.find(row=>row.recordId===raw.recordId)!;
 };
 const confirm=(kind:'package'|'workfront')=>change({action:'confirm_population',kind,note:'Complete applicable source population reconciled.'});
 return {state,model,change,create,confirm};
}

test('Recovery keeps missing domains unknown beside an assessed on-time package, then preserves confirmed empty workfront zero',()=>{
 const f=fixture();f.create('package','ON-TIME',{status:'Ordered','required on site date':'2031-02-10','forecast delivery date':'2031-02-01'});f.confirm('package');
 const before=JSON.stringify(f.model),result=recoveryAccelerationIntelligence(f.state);
 assert.equal(result.eligibility.lateProcurementPackageCount,0);
 assert.equal(result.eligibility.actualEligibilityChecksPerformed,1);
 for(const key of ['activityFeasibilityCheckCount','crewAccelerationCandidateCount','unresolvedFeasibilityCheckCount','governedResequencingWorkfrontCount'] as const)assert.equal(result.eligibility[key],null,key);
 assert.equal(result.eligibility.knownActivityFeasibilityCheckCount,0);
 f.confirm('workfront');assert.equal(recoveryAccelerationIntelligence(f.state).eligibility.governedResequencingWorkfrontCount,0);
 f.create('workfront','NEW-UNKNOWN');
 const changed=recoveryAccelerationIntelligence(f.state);assert.equal(changed.eligibility.governedResequencingWorkfrontCount,null);
 f.confirm('workfront');assert.equal(recoveryAccelerationIntelligence(f.state).eligibility.governedResequencingWorkfrontCount,null,'population confirmation cannot manufacture a missing permission');
 assert.equal(JSON.stringify(f.model),before);
});

test('Recovery distinguishes known late/permission candidates from unresolved totals and processes the full register',()=>{
 const f=fixture();f.create('package','LATE',{status:'Ordered','required on site date':'2025-12-01','forecast delivery date':'2025-12-02'});f.create('package','UNKNOWN',{status:'Ordered'});f.confirm('package');
 f.create('workfront','YES',{'resequencing permitted':'yes'});f.create('workfront','NO',{'resequencing permitted':'no'});f.create('workfront','UNKNOWN');f.confirm('workfront');
 const partial=recoveryAccelerationIntelligence(f.state);
 assert.equal(partial.eligibility.lateProcurementPackageCount,null);assert.equal(partial.eligibility.knownLateProcurementPackageCount,1);
 assert.equal(partial.eligibility.governedResequencingWorkfrontCount,null);assert.equal(partial.eligibility.knownGovernedResequencingWorkfrontCount,1);
 assert.equal(partial.eligibility.actualEligibilityChecksPerformed,3);
 assert.equal(partial.scenarios.find(row=>row.subject==='LATE')?.possibleDaysRecovered,null,'historical lateness is not future recovery');
 const unknown=deliveryRecords(f.state).records.find(row=>row.kind==='workfront'&&row.reference==='UNKNOWN')!;
 f.change({action:'review',recordId:unknown.recordId,sourceRevision:unknown.revision,state:'governed',fields:{'resequencing permitted':'no'},note:'Confirmed no permission.'});f.confirm('workfront');
 assert.equal(recoveryAccelerationIntelligence(f.state).eligibility.governedResequencingWorkfrontCount,1);
 // Populate retained source records directly to keep the full-population test linear.
 const source=deliveryStore(f.state).manual.find(row=>row.kind==='workfront')!;
 for(let i=0;i<620;i++)deliveryStore(f.state).manual.push({...structuredClone(source),recordId:'WF-SCALE-'+i,reference:'WF-SCALE-'+i,state:'governed',fields:{...source.fields,'resequencing permitted':i===619?'yes':'no'}});
 f.state.version++;f.confirm('workfront');
 const full=recoveryAccelerationIntelligence(f.state);assert.equal(full.eligibility.governedResequencingWorkfrontCount,2);assert.equal(full.eligibility.workfrontPopulationCount,623);
});

test('Recovery keeps undated delivery status and missing forecasts unresolved, and confirmed package absence is a real zero',()=>{
 const f=fixture();f.confirm('package');assert.equal(recoveryAccelerationIntelligence(f.state).eligibility.lateProcurementPackageCount,0);
 f.create('package','UNDATED',{status:'Delivered','required on site date':'2031-02-10'});f.confirm('package');
 assert.equal(recoveryAccelerationIntelligence(f.state).eligibility.lateProcurementPackageCount,null);
 f.create('package','NO-FORECAST',{status:'Ordered','required on site date':'2031-02-10'});f.confirm('package');
 const r=recoveryAccelerationIntelligence(f.state);assert.equal(r.eligibility.lateProcurementPackageCount,null);assert.equal(r.eligibility.knownLateProcurementPackageCount,0);assert.equal(r.eligibility.actualEligibilityChecksPerformed,0);
});

test('Recovery feasibility coverage keeps unlinked items unknown and preserves assessed crew zero and local scenario mathematics',()=>{
 const f=fixture(),a=f.model.activities.find(row=>row.activityId==='A200')!;
 f.model.dataDateIso='2026-01-05T08:00:00Z';a.currentStartIso=a.forecastStartIso='2026-01-05T08:00:00Z';a.currentFinishIso=a.forecastFinishIso='2026-01-06T16:00:00Z';
 f.state.quantities={scheduleRevisionId:f.model.sourceRevisionId,items:[{quantityItemId:'Q',description:'Concrete',unit:'m3',contractQuantity:100,sourceRefs:[]}],allocations:[],installedSnapshots:[{quantityItemId:'Q',asOfIso:'2026-01-05',installedQuantity:20,sourceRefs:[]}]} as any;f.state.version++;
 const unlinked=recoveryAccelerationIntelligence(f.state).eligibility;assert.equal(unlinked.activityFeasibilityCheckCount,null);assert.equal(unlinked.unlinkedFeasibilityRowCount,1);assert.equal(unlinked.crewAccelerationCandidateCount,null);
 f.state.quantities!.allocations=[{quantityItemId:'Q',activityId:a.activityId,allocatedQuantity:100,sourceRefs:[]} as any];f.state.version++;
 const unresolved=recoveryAccelerationIntelligence(f.state).eligibility;assert.equal(unresolved.activityFeasibilityCheckCount,1);assert.equal(unresolved.unresolvedFeasibilityCheckCount,1);assert.equal(unresolved.crewAccelerationCandidateCount,null);
 const resources:any={sourceRevisionId:f.model.sourceRevisionId,resources:[{resourceId:'R',resourceType:'labor',unitAbbreviation:'h',calendarId:a.calendarId}],assignments:[{resourceId:'R',resourceType:'labor',activityId:a.activityId,remainingUnitsPerHour:10,remainingUnits:160,actualRegularUnits:40,actualOvertimeUnits:0,sourceRefs:[]}]};
 f.state.resourcesByRevision.set(projectControlSchedule(f.state)!.revision.revisionId,resources);f.state.version++;
 const fits=recoveryAccelerationIntelligence(f.state);assert.equal(fits.eligibility.crewAccelerationCandidateCount,0);assert.equal(fits.eligibility.unresolvedFeasibilityCheckCount,0);
 resources.assignments[0].remainingUnitsPerHour=5;f.state.version++;
 const exceeds=recoveryAccelerationIntelligence(f.state),crew=exceeds.scenarios.find(row=>row.scenarioId==='crew:A200')!;
 assert.equal(exceeds.eligibility.crewAccelerationCandidateCount,1);assert.equal(crew.possibleDaysRecovered,2);assert.equal(crew.estimatedCost,null);assert.equal(crew.authority,'scenario');
 f.state.quantities!.items.push({quantityItemId:'Q2',description:'Unmapped',unit:'m3',contractQuantity:50,sourceRefs:[]} as any);f.state.version++;
 const mixed=recoveryAccelerationIntelligence(f.state);assert.equal(mixed.eligibility.crewAccelerationCandidateCount,null);assert.equal(mixed.eligibility.knownCrewAccelerationCandidateCount,1);assert.equal(mixed.scenarios.find(row=>row.scenarioId==='crew:A200')!.possibleDaysRecovered,2);
});

test('Recovery driving coverage uses the complete calculated network and leaves an unavailable network unknown',()=>{
 const f=fixture(),network=cachedIndependentForecast(f.model,'2026-01-05').drivingNetwork!;
 assert.ok(network);const result=recoveryAccelerationIntelligence(f.state);
 assert.equal(result.drivingChainShortfall.drivingOpenActivityCount,f.model.activities.filter(row=>network.activityIds.includes(row.activityId)&&row.status!=='completed').length);
 assert.ok(result.drivingChainShortfall.drivingOpenActivityCount!>0);
 const missing=fixture();missing.model.calendars=[];missing.create('package','LATE',{status:'Ordered','required on site date':'2031-02-01','forecast delivery date':'2031-02-03'});missing.state.version++;
 const before=JSON.stringify(missing.model),unavailable=recoveryAccelerationIntelligence(missing.state);
 assert.equal(unavailable.drivingChainShortfall.drivingOpenActivityCount,null);assert.equal(unavailable.drivingChainShortfall.fiveDayDrivingActivityCount,null);assert.equal(unavailable.drivingChainShortfall.sixthDayScenarioAvailable,null);
 assert.equal(unavailable.scenarios.find(row=>row.subject==='LATE')!.drivingPath,null);assert.equal(JSON.stringify(missing.model),before);
 const completed=fixture();for(const row of completed.model.activities){row.status='completed';row.actualFinishIso=row.currentFinishIso;row.actualStartIso=row.currentStartIso;row.remainingDurationHours=0;}completed.state.version++;
 const zero=recoveryAccelerationIntelligence(completed.state);assert.equal(zero.drivingChainShortfall.drivingOpenActivityCount,0);assert.equal(zero.drivingChainShortfall.fiveDayDrivingActivityCount,0);assert.equal(zero.drivingChainShortfall.sixthDayScenarioAvailable,false);
});
