import test from 'node:test';
import assert from 'node:assert/strict';
import {pageProjectResponse,recordDetailPage,jsonPointer,PROJECT_SCREEN_MAX_BYTES,isProjectScreenRequest} from '../packages/runtime-api/src/response-paging';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';

test('large screens stay under 2 MB and retain every original row via bounded server paging',()=>{
 const source={key:'delay-claims',status:'ready',projectVersion:10,data:{
   projectFacts:{time:{extendedContractCompletionIso:{value:'2027-09-21',basis:'source EOT',state:'confirmed'}}},
   rows:Array.from({length:5665},(_,i)=>({
     recordId:'raw-record-'+i,claimId:'CLM-'+i,sourceAmount:i+0.26,sourceDate:'2026-08-31',
     originalNarrative:'Reported source evidence '.repeat(70),sourceRefs:['source:document:'+i,'schedule:activity:'+i]
   })),
   financial:{certifiedUnpaid:12789,negativeFloat:12},
 }};
 const before=source.data.rows.length;
 const result=pageProjectResponse(source,'/api/projects/TEST/schedule/modules/delay-claims') as any;
 assert.ok(Buffer.byteLength(JSON.stringify(result))<PROJECT_SCREEN_MAX_BYTES);
 assert.equal(source.data.rows.length,before,'original source must never be truncated or mutated');
 assert.equal(result.data.projectFacts.time.extendedContractCompletionIso.value,'2027-09-21');
 assert.ok(result.responsePaging.tables.some((row:any)=>row.pointer==='/data/rows'&&row.total===5665));
 for(const page of [0,25,200,5650]){
   const detail=recordDetailPage(source,'/data/rows',page);
   assert.equal(detail.total,5665);
   assert.ok(Array.isArray(detail.rows));
   if(!Array.isArray(detail.rows))throw new Error('Expected source array page');
   assert.ok(detail.rows.length<=25);
   assert.equal(detail.rows[0].claimId,'CLM-'+page);
 }
});
test('small source responses are unchanged, and technical detail paths are not a hidden deletion',()=>{
 const source={data:{amount:125.37,days:26,records:[{id:'A',amount:12}]}};
 assert.equal(pageProjectResponse(source,'/api/projects/P/overview'),source);
 assert.equal(jsonPointer(source,'/data/records/0/amount'),12);
 assert.equal(jsonPointer(source,'/__proto__/polluted'),undefined);
 assert.equal(isProjectScreenRequest('GET','/api/projects/P/management/command-center'),true);
 assert.equal(isProjectScreenRequest('POST','/api/projects/P/management/command-center'),false);
});

test('management bundle and first-class pages retain the same canonical facts after paging',()=>{
 const shared={schemaVersion:'1.0',projectVersion:19,time:{
   contractualCompletionIso:{value:'2030-03-31',state:'confirmed'},
   awardedEotDays:{value:26,state:'confirmed'},
   extendedContractCompletionIso:{value:'2030-04-26',state:'from_register_not_confirmed'}
 },schedule:{criticalActivityCount:{value:41,state:'confirmed'}},
 controls:{openRfiCount:{value:53,state:'confirmed'}}};
 const page={projectionKey:'master_dashboard',projectFacts:shared,rows:Array.from({length:140},(_,i)=>({recordId:'M'+i,owner:'PMC',sourceRef:'register:'+i}))};
 const command={projectionKey:'command_center',projectFacts:shared,actions:Array.from({length:80},(_,i)=>({recordId:'A'+i,owner:'PMC'}))};
 const source={projectionKey:'management_surfaces',projectVersion:19,masterDashboard:page,commandCenter:command};
 const result=pageProjectResponse(source,'/api/projects/X/management-surfaces') as any;
 assert.ok(Buffer.byteLength(JSON.stringify(result))<=PROJECT_SCREEN_MAX_BYTES);
 for(const key of ['masterDashboard','commandCenter']){
   assert.equal(result[key].projectFacts.time.extendedContractCompletionIso.value,'2030-04-26');
   assert.equal(result[key].projectFacts.schedule.criticalActivityCount.value,41);
   assert.equal(result[key].projectFacts.controls.openRfiCount.value,53);
 }
 assert.equal((pageProjectResponse({data:page},'/api/projects/X/management/master-dashboard') as any).data.projectFacts.time.extendedContractCompletionIso.value,
   result.masterDashboard.projectFacts.time.extendedContractCompletionIso.value);
 assert.ok(result.responsePaging.tables.some((row:any)=>row.pointer==='/masterDashboard/rows'&&row.total===140));
 assert.equal(jsonPointer(source,'/masterDashboard/rows/75/recordId'),'M75','full bundle source remains available for exact pointer download');
});

test('S-49 embedded Delivery evidence renderer compiles and has complete server paging',()=>{
 const script=deliveryScript();
 assert.doesNotThrow(()=>new Function(script),'Client Delivery renderer JavaScript must parse successfully');
 assert.match(script,/function deliveryLoadEvidenceServerPage\(/);
 assert.match(script,/source:view\.server\.source,pointer:view\.server\.pointer/);
});

test('S-49 nested source evidence retains full population when initial view is paged',()=>{
 const source={key:'delivery-control',status:'ready',projectVersion:19,data:{
   projectionKey:'delivery',evidenceMetrics:{records:Array.from({length:108},(_,i)=>({recordId:'EV-'+i,detail:'Record '+i}))}
 }};
 const projection=pageProjectResponse(source,'/api/projects/P/delivery/modules/delivery-control') as any;
 const pointer='/data/evidenceMetrics/records';
 assert.ok(projection.responsePaging.tables.some((row:any)=>row.pointer===pointer&&row.total===108));
 assert.equal(projection.data.evidenceMetrics.records.length,25);
 const remainder=recordDetailPage(source,pointer,75);
 assert.equal(remainder.sourceTotal,108);
 assert.equal(remainder.total,108);
 assert.equal(remainder.rows.length,25);
 assert.equal(remainder.rows[0].recordId,'EV-75');
});
