import test from 'node:test';
import assert from 'node:assert/strict';
import {pageProjectResponse,recordDetailPage,jsonPointer,PROJECT_SCREEN_MAX_BYTES} from '../packages/runtime-api/src/response-paging';

for(let sample=0;sample<10;sample++)test('Complete fact values survive long evidence lists without page refusal · '+sample,()=>{
 const refs=Array.from({length:27000+sample*37},(_,i)=>'evidence-document:SOURCE-'+sample+'-'+i+':sheet:Payment certificates:row:'+i);
 const ids=Array.from({length:25630+sample*17},(_,i)=>'ACT-'+sample+'-'+i);
 const fact={value:123456.78+sample,state:'from_register_not_confirmed',complete:false,basis:'Dated source total with qualification; not a determination',sourceRefs:refs,diagnostics:['RECORDS_RETAINED']};
 const facts={schemaVersion:'1.0',projectId:'NEW-FACT-'+sample,projectVersion:sample+1,
  commercial:{currencies:[{currency:'SAR',certifiedUnpaidAmount:fact}]},
  time:{awardedEotDays:{value:181,state:'confirmed',basis:'Register award',sourceRefs:refs}},
  programmeQuality:{checks:[{key:'high_float',count:ids.length,population:ids.length,activityIds:ids,basis:'Source float screening'}]},
  contractSections:[{sectionId:'1',rate:10000,cap:500000,completionIso:'2030-03-31'}]};
 const original={key:'master-dashboard',data:{projectFacts:facts,positionVerdict:{text:'Current project position'},rows:Array.from({length:77},(_,i)=>({reference:'RFI-'+i,amount:i}))}};
 const projected=pageProjectResponse(original,'/api/projects/NEW-FACT-'+sample+'/management/master-dashboard') as any;
 assert.ok(Buffer.byteLength(JSON.stringify(projected))<=PROJECT_SCREEN_MAX_BYTES);
 assert.equal(projected.data.projectFacts.commercial.currencies[0].certifiedUnpaidAmount.value,fact.value);
 assert.equal(projected.data.projectFacts.commercial.currencies[0].certifiedUnpaidAmount.state,fact.state);
 assert.equal(projected.data.projectFacts.commercial.currencies[0].certifiedUnpaidAmount.basis,fact.basis);
 assert.equal(projected.data.projectFacts.programmeQuality.checks[0].count,ids.length);
 assert.deepEqual(projected.data.projectFacts.contractSections,facts.contractSections);
 const pointer='/data/projectFacts/commercial/currencies/0/certifiedUnpaidAmount/sourceRefs';
 assert.ok(projected.responsePaging.tables.some((p:any)=>p.pointer===pointer&&p.total===refs.length&&p.shown===25));
 const last=recordDetailPage(original,pointer,refs.length-1) as any;
 assert.deepEqual(last.rows,[refs.at(-1)]);assert.equal(last.total,refs.length);
 assert.equal(jsonPointer(original,'/data/projectFacts/programmeQuality/checks/0/activityIds/25600'),ids[25600]);
 assert.equal(original.data.projectFacts.commercial.currencies[0]!.certifiedUnpaidAmount.sourceRefs.length,refs.length,'the retained source list is never mutated');
});
