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

test('S-49 visible registers retain paging metadata even when nested facts exceed cap',()=>{
 const nested=Array.from({length:10},(_,row)=>Object.fromEntries(Array.from({length:20},(_,column)=>[
   'facts'+column,Array.from({length:16},(_,i)=>row*320+column*16+i)
 ])));
 const source={projectVersion:22,data:{projectFacts:{deep:{rows:nested}},
   rows:Array.from({length:127},(_,i)=>({recordId:'RECORD-'+i,amount:i+0.25}))}};
 const projected=pageProjectResponse(source,'/api/projects/P/delivery/modules/delivery-control') as any;
 assert.deepEqual(projected.data.projectFacts,source.data.projectFacts,'no canonical fact group or nested evidence is removed');
 assert.ok(projected.responsePaging.tables.some((t:any)=>t.pointer==='/data/rows'&&t.total===127),
   'The visible register must have its full 127-row paging pointer, not only 25 rows');
 assert.equal(projected.data.rows.length,25);
 const remaining=recordDetailPage(source,'/data/rows',100);
 assert.equal(remaining.kind,'array');
 assert.ok(Array.isArray(remaining.rows));
 assert.equal(remaining.rows![0].recordId,'RECORD-100');
});

test('S-51 project facts retain every section and qualified authority after paging',()=>{
 const facts={projectVersion:8,time:{awardedEotDays:{value:13}},contractSections:[
  {section:'1',ldPerDay:35000,completionIso:'2030-01-01'}, {section:'2',ldPerDay:15000,completionIso:'2030-02-01'}
 ],programmeQuality:{reconciliation:'review_required'},securityValidity:{bond:{expiryIso:'2031-01-01'}},
  deep:{rows:Array.from({length:42},(_,i)=>({recordId:'FACT-'+i,amount:i}))}};
 const input={key:'liquidated-damages',projectVersion:8,data:{projectFacts:facts,rows:Array.from({length:210},(_,i)=>({recordId:'LD-'+i,note:'Source detail '.repeat(30)}))}};
 const rendered=pageProjectResponse(input,'/api/projects/A/commercial/modules/liquidated-damages') as any;
 assert.deepEqual(rendered.data.projectFacts,facts);
 assert.equal(rendered.data.projectFacts.contractSections.length,2);
 assert.equal(rendered.data.projectFacts.deep.rows.length,42);
 assert.equal(rendered.data.rows.length,25);
 assert.equal(rendered.responsePaging.tables.find((t:any)=>t.pointer==='/data/rows')?.total,210);
});

test('S-51 full chart histories survive while large visible registers remain paged',()=>{
 for(const [key,field,count] of [['progress-scurve','points',290],['manhour-scurve','points',3567],['resource-utilization','weeklyTotals',204]] as const){
  const source={key,projectVersion:99,data:{projectionKey:key, [field]:Array.from({length:count},(_,i)=>({dateIso:'2030-01-01',planned:i/100,actual:i/150})),
    rows:Array.from({length:600},(_,i)=>({recordId:'RESOURCE-'+i,source:'A',unit:'labor_hour',capacity:5}))}};
  const page=pageProjectResponse(source,'/api/projects/A/schedule/modules/'+key) as any;
  assert.equal(page.data[field].length,count,key+' must not end at row 25');
  assert.equal(page.data.rows.length,25,key+' visible register is paged');
  assert.equal(page.responsePaging.tables.find((t:any)=>t.pointer==='/data/rows')?.total,600);
 }
});

test('S-51 milestone decisions cannot turn into a false all-clear when critical rows occur after 25',()=>{
 const rows=Array.from({length:160},(_,i)=>({activityId:'M-'+i,status:i<130?'completed':'not_started',criticality:i>=145?'critical':'positive_float',negativeFloat:i>=145,managementPriority:i>=145?'critical':'normal',currentDateIso:'2030-01-01',baselineDateIso:'2029-12-01',daysFromDataDate:2}));
 const source={key:'milestones',projectVersion:55,data:{projectionKey:'milestones',rows,openCount:30,criticalPriorityCount:15,completedCount:130}};
 const p=pageProjectResponse(source,'/api/projects/A/schedule/modules/milestones') as any;
 assert.equal(p.data.rows.length,160,'whole milestone decision population must remain available to ranking and timeline');
 assert.equal(p.data.rows.filter((r:any)=>r.status!=='completed'&&r.negativeFloat).length,15);
 assert.equal(p.data.criticalPriorityCount,15);
});

test('Milestone source totals and open/completed browse pages never depend on a 25-row preview',()=>{
 const sourceRows=Array.from({length:340},(_,i)=>({
   activityId:'MS-'+i,name:'Milestone '+i,managementPriority:i%4===0?'critical':i%4===1?'high':i%4===2?'watch':'normal',
   status:i<50?'completed':'not_started',dueState:i%3===0?'overdue':'future',
   varianceDays:i%5===0?10:0,movementBasis:'actual_vs_baseline',sourceRefs:['SCHEDULE-'+i],summary:'Evidence '.repeat(15)
 }));
 const source={key:'milestones',data:{projectId:'P',projectionKey:'milestones',milestoneCount:340,openCount:290,completedCount:50,rows:sourceRows}};
 const page=pageProjectResponse(source,'/api/projects/P/schedule/modules/milestones',50000) as any;
 assert.ok(page.responsePaging?.sourcePreserved,'the large register must be paged without altering source');
 assert.ok(page.data.rows.length<sourceRows.length,'the page preview must remain bounded');
 const full=page.data.milestoneFullCounts;
 assert.equal(full.sourceRows,340);assert.equal(full.openCount,290);assert.equal(full.completedCount,50);
 assert.equal(full.overdueOpenCount,sourceRows.filter(r=>r.status!=='completed'&&r.dueState==='overdue').length);
 assert.equal(full.openLateBaselineCount,sourceRows.filter(r=>r.status!=='completed'&&r.varianceDays>0).length);
 assert.equal(full.completedLateBaselineCount,10);
 assert.equal(Object.values(full.priorityCounts).reduce((sum:number,count:any)=>sum+Number(count),0),290);
 const firstOpen=recordDetailPage(source,'/data/rows',0,25,{status:'__open__'}) as any;
 const finalOpen=recordDetailPage(source,'/data/rows',275,25,{status:'__open__'}) as any;
 const completed=recordDetailPage(source,'/data/rows',25,25,{status:'__completed__'}) as any;
 assert.equal(firstOpen.total,290);assert.equal(finalOpen.rows.length,15);
 assert.ok((firstOpen.rows as any[]).every(r=>r.status!=='completed'));
 assert.equal(completed.total,50);assert.ok((completed.rows as any[]).every(r=>r.status==='completed'));
 assert.equal(source.data.rows.length,340,'paging never mutates the full source population');
});
