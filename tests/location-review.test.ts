import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {locationReviewBasis,locationReviewInput,projectScopeClassification} from '../packages/runtime-api/src/location-review';
import {scheduleScopeClassification} from '../packages/runtime-api/src/schedule-scope-classification';
import {deliveryModule} from '../packages/runtime-api/src/delivery-projections';
import {emptyLinks} from '../packages/delivery-core/src/types';

function fixture(t:any){
 const root=mkdtempSync(join(tmpdir(),'location-review-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false}),state=store.getOrCreate('LOCATION');
 const activity=(id:string,wbsId:string,name:string)=>({projectId:'LOCATION',activityId:id,nativeId:id,name,wbsId,calendarId:null,activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:'2031-09-01',currentFinishIso:'2031-10-01',actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:80,remainingDurationHours:80,totalFloatHours:null,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]});
 const model:any={projectId:'LOCATION',source:'xer',sourceRevisionId:'R1',dataDateIso:'2031-08-31',activities:[activity('A','N','Pour slab'),activity('B','S','Fit out'),activity('C','S','Area SOURCE installation')],relationships:[],calendars:[],wbs:[{wbsId:'ROOT',name:'Complex',parentWbsId:null,sourceRefs:[]},{wbsId:'N',name:'Manufacturing North',parentWbsId:'ROOT',sourceRefs:[]},{wbsId:'S',name:'Research South',parentWbsId:'N',sourceRefs:[]}],diagnostics:[]};
 state.schedules.push({role:'update',format:'xer',sourceFilename:'Current.xer',sourceHashSha256:'programme-one',uploadedAt:'2031-08-31',revision:{revisionId:'R1',label:'Current',sequence:1,effectiveAt:model.dataDateIso,model}} as any);
 state.delivery={schemaVersion:1,decisions:[],populations:[],manual:[{recordId:'ASSET',projectId:state.projectId,kind:'asset',reference:'FM-X',description:'Pump',revision:'ASSET-R1',state:'governed',fields:{location:'FM plant room'},links:emptyLinks(),receipts:[],diagnostics:[],sourceActive:true}]};
 return {store,state,model};
}
test('location candidates require exact review and fill missing locations through the nearest chosen WBS ancestor',t=>{
 const {state,model}=fixture(t),source=JSON.stringify(model),base=scheduleScopeClassification(model),basis=locationReviewBasis(state)!;
 assert.ok(basis.wbsCandidates.some(c=>c.wbsId==='N'&&c.activityCount===3));assert.equal(basis.assetCandidates[0]!.location,'FM plant room');
 assert.equal(base.rows[0]!.location,null);assert.ok(base.rows[2]!.location);
 for(const text of ['NOPE','N | invented place','N\nN'])assert.throws(()=>locationReviewInput(state,{choice:'confirm_wbs_locations',locationAssignmentsText:text,reference:'CHECK'}));
 assert.throws(()=>locationReviewInput(state,{choice:'confirm_wbs_locations',locationAssignmentsText:'N',reference:''}));
 const input=locationReviewInput(state,{choice:'confirm_wbs_locations',locationAssignmentsText:'N\nS | FM plant room',reference:'LOC-CHECK'});
 state.controls.reviewDecisions={'location-grouping':{...input,choice:'confirm_wbs_locations',sourceFingerprint:basis.sourceFingerprint,confirmedAt:'2031-08-31',sourceRefs:basis.sourceRefs}};state.version++;
 const reviewed=projectScopeClassification(state,model);assert.equal(reviewed.rows[0]!.location,'Manufacturing North');assert.equal(reviewed.rows[1]!.location,'FM plant room');assert.equal(reviewed.rows[2]!.location,base.rows[2]!.location);
 assert.equal(reviewed.rows[0]!.classificationBasis.location,'user_reviewed');assert.equal(reviewed.coverage.find(c=>c.key==='location')!.classified,3);
 assert.equal(scheduleScopeClassification(model),base);assert.equal(base.rows[0]!.location,null);assert.equal(JSON.stringify(model),source);
 const view=deliveryModule(state,'construction-locations').data as any;assert.ok(view.rows.some((r:any)=>r.label==='Manufacturing North'));assert.ok(view.rows.some((r:any)=>r.label==='FM plant room'));assert.equal(view.rows.reduce((n:number,r:any)=>n+r.activityCount,0),3);
 state.schedules[0]!.sourceHashSha256='new-programme';state.version++;assert.equal(locationReviewBasis(state)!.decision,null);assert.equal(projectScopeClassification(state,model).rows[0]!.location,null);
});
test('asset location source revisions invalidate a saved mapping; keeping source-only clears its effect',t=>{
 const {state,model}=fixture(t),basis=locationReviewBasis(state)!;
 const input=locationReviewInput(state,{choice:'confirm_wbs_locations',locationAssignmentsText:'N | FM plant room',reference:'CHECK'});
 state.controls.reviewDecisions={'location-grouping':{...input,choice:'confirm_wbs_locations',sourceFingerprint:basis.sourceFingerprint,confirmedAt:'2031-08-31',sourceRefs:[]}};state.version++;
 assert.equal(projectScopeClassification(state,model).rows[0]!.location,'FM plant room');
 state.delivery!.manual[0]!.revision='ASSET-R2';state.version++;assert.equal(projectScopeClassification(state,model).rows[0]!.location,null);
 const current=locationReviewBasis(state)!;state.controls.reviewDecisions['location-grouping']={...locationReviewInput(state,{choice:'keep_source_locations',reference:'CHECK-2'}),sourceFingerprint:current.sourceFingerprint,choice:'keep_source_locations',confirmedAt:'2031-08-31',sourceRefs:[]};state.version++;
 assert.equal(projectScopeClassification(state,model),scheduleScopeClassification(model));
});
