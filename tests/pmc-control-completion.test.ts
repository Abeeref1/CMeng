import test from 'node:test';
import assert from 'node:assert/strict';
import {securityValidityReview} from '../packages/runtime-api/src/security-validity';
import {criticalResourceHours} from '../packages/runtime-api/src/canonical-resource-runtime';

test('performance security expiry is compared with the source completion and defects obligation',()=>{
 const state:any={evidenceDocuments:[{documentId:'C',basisState:'active'}],contractDocuments:[{documentId:'C',result:{sections:[{heading:'4.2 Performance Security',text:'Security shall be valid until works are complete and defects remedied. Defects Notification Period: 12 months',startPage:2}]}}]};
 const bonds:any[]=[{bondId:'PB1',kind:'performance',status:'active',expiryIso:'2031-12-31',sourceRefs:['bond:1']},{bondId:'PB2',kind:'performance',status:'released',expiryIso:'2031-01-01',sourceRefs:[]}];
 let rows=securityValidityReview(state,bonds,'2031-10-06');
 assert.equal(rows.length,1);assert.equal(rows[0]!.daysAfterProgrammeFinish,86);assert.equal(rows[0]!.assumedDefectsEndIso,'2032-10-06');assert.match(rows[0]!.finding,/expires before the defects/);
 state.contractDocuments[0].result.sections[0].text='Security shall be valid until completion and remedy of defects.';
 rows=securityValidityReview(state,bonds,'2031-10-06');assert.equal(rows[0]!.assumedDefectsEndIso,null);assert.match(rows[0]!.finding,/not demonstrated/);
 state.contractDocuments[0].result.sections[0].text+=' Defects Notification Period: 1 month';
 assert.equal(securityValidityReview(state,bonds,'2031-01-31')[0]!.assumedDefectsEndIso,'2031-02-28');
});

test('critical resource hours use remaining hourly labour assignments and exclude completed work and unlike units',()=>{
 const model:any={activities:[{activityId:'A',activityType:'task',status:'in_progress',totalFloatHours:-8},{activityId:'B',activityType:'task',status:'completed',totalFloatHours:0},{activityId:'C',activityType:'task',status:'not_started',totalFloatHours:80}]};
 const resources:any={resources:[{resourceId:'L',name:'Masons',resourceType:'labor',priceTimeUnit:'QT_Hour'},{resourceId:'Q',name:'Quantity',resourceType:'material',unitName:'m2'}],assignments:[{resourceId:'L',activityId:'A',remainingUnits:160},{resourceId:'L',activityId:'B',remainingUnits:99},{resourceId:'L',activityId:'C',remainingUnits:88},{resourceId:'Q',activityId:'A',remainingUnits:500}]};
 const rows=criticalResourceHours(model,resources);assert.equal(rows.length,1);assert.equal(rows[0]!.remainingHours,160);assert.deepEqual(rows[0]!.activityIds,['A']);
 resources.assignments[0].remainingUnits=null;assert.equal(criticalResourceHours(model,resources)[0]!.remainingHours,null);
});

test('retained XER labour quantities remain hours without a material unit or hourly price',()=>{
 const model:any={activities:[{activityId:'A',activityType:'task',status:'in_progress',totalFloatHours:-8}]};
 const resources:any={resources:[{resourceId:'L',name:'Mason',resourceType:'labor',unitName:null,unitAbbreviation:null,priceTimeUnit:null,sourceRefs:[{source:'xer',locator:'RSRC:1'}]}],assignments:[{resourceId:'L',activityId:'A',remainingUnits:240}]};
 assert.equal(criticalResourceHours(model,resources)[0]!.remainingHours,240);
 resources.resources[0].priceTimeUnit='QT_Day';assert.equal(criticalResourceHours(model,resources)[0]!.remainingHours,240);
 resources.resources[0].unitName='m2';assert.deepEqual(criticalResourceHours(model,resources),[],'an explicit unlike quantity unit cannot become hours');
 resources.resources[0].unitName=null;resources.resources[0].sourceRefs=[];assert.deepEqual(criticalResourceHours(model,resources),[],'unidentified quantities stay unassessed');
});
