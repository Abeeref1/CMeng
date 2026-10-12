import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';

import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {boqScopeIntelligence} from '../packages/runtime-api/src/boq-scope-intelligence';
import type {DelayClaimsModel} from '../packages/delay-analysis-core/src';

function xer(wbsName:string,taskCode:string,taskName:string,dataDate:string,finish:string,floatHours:number){
  return [
    'ERMHDR\t23.12',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tlast_recalc_date',
    '%R\t1\tGENERIC\t'+dataDate,
    '%T\tPROJWBS',
    '%F\twbs_id\tproj_id\tparent_wbs_id\twbs_name',
    '%R\t10\t1\t\t'+wbsName,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',
    '%R\t100\t1\t10\t'+taskCode+'\t'+taskName+'\tTK_NotStart\t'+dataDate+'\t'+finish+'\t80\t80\t'+floatHours,
    '%E',
  ].join('\n');
}
async function ingest(id:string,name:string,content:string,mediaType:string){
  return runtimeProjects.ingestEvidenceFile({
    projectId:id,
    sourceFilename:name,
    bytes:Buffer.from(content),
    mediaType,
    uploadedAt:'2036-09-01',
    uploadIntent:'replace_current_basis',
  });
}
function claimModel(projectId:string,variant:number):DelayClaimsModel{
  const eventId='EV-'+variant,claimId='CL-'+variant,noticeId='NT-'+variant;
  return {
    projectId,
    evidenceRevisionId:'generic-claims-'+variant,
    dataDateIso:variant===1?null:'2036-08-'+String(20+variant).padStart(2,'0'),
    events:[{
      eventId,
      title:variant===3?'تأخر معلومات التصميم':'Late information '+variant,
      category:variant===2?'late_access':'late_information',
      startIso:variant===1?null:'2036-08-0'+variant,
      endIso:null,
      responsibility:variant===2?'neutral':'employer',
      responsibilityState:'official',
      describedImpactDays:variant,
      describedImpactState:'candidate',
      relatedActivityIds:variant===3?['UNSEEN-ACTIVITY-77']:[],
      relatedClauseIdentifiers:['20.'+variant],
      evidenceRefs:[{sourceType:'correspondence',sourceId:'LETTER-'+variant,locator:'page:1'}],
      diagnostics:[],
    }],
    notices:[{
      noticeId,
      kind:'eot_notice',
      eventId,
      claimId,
      actualIssuedAt:variant===1?null:'2036-08-0'+(variant+1),
      actualReceivedAt:null,
      plannedAt:null,
      subject:'Notice '+variant,
      clauseIdentifiers:['20.'+variant],
      evidenceRefs:[{sourceType:'notice',sourceId:noticeId,locator:'page:1'}],
      diagnostics:[],
    }],
    claims:[{
      claimId,
      title:'Claim '+variant,
      state:variant===2?'under_review':'submitted',
      eventIds:[eventId],
      submittedAt:variant===1?null:'2036-08-1'+variant,
      claimedDays:variant*3,
      claimedAmount:null,
      assessedDays:null,
      assessedDaysState:'missing',
      assessedAmount:null,
      assessedAmountState:'missing',
      clauseIdentifiers:['20.'+variant],
      evidenceRefs:[{sourceType:'claim',sourceId:claimId,locator:'row:1'}],
      diagnostics:[],
    }],
    noticeRequirements:[{
      requirementId:'REQ-'+variant,
      noticeKind:'eot_notice',
      eventCategories:[variant===2?'late_access':'late_information'],
      noticePeriodDays:7+variant,
      state:'official',
      clauseIdentifiers:['20.'+variant],
      evidenceRefs:[{sourceType:'contract',sourceId:'CONTRACT-'+variant,locator:'clause:20.'+variant}],
    }],
    diagnostics:[],
  };
}

test('Batch J anti-overfit: schedule rules work across unrelated project IDs, WBS shapes and languages',async()=>{
  const cases=[
    {id:'GEN-A-001',wbs:'Major Equipment Procurement',code:'P-100',name:'Transformer manufacture',date:'2036-08-11',finish:'2036-09-15',float:0},
    {id:'GEN-B-947',wbs:'الأعمال المدنية',code:'CIV-X7',name:'تنفيذ القواعد',date:'2036-07-03',finish:'2036-10-01',float:24},
    {id:'GEN-C-Z99',wbs:'Zone 12 / Testing',code:'T&C-42',name:'System energisation',date:'2036-06-19',finish:'2036-12-20',float:-16},
  ];
  for(const c of cases){
    await ingest(c.id,'Programme-'+c.id+'.xer',xer(c.wbs,c.code,c.name,c.date,c.finish,c.float),'text/plain');
    const result:any=moduleForProject(c.id,'schedule-analytics');
    assert.notEqual(result.status,'blocked',c.id);
    assert.equal(result.data.result.projectId,c.id);
    assert.equal(result.data.result.activityCount,1);
    assert.equal(result.data.result.float.coveragePercent,100,c.id);
    assert.equal(result.data.result.float.negativeFloatCount,c.float<0?1:0,c.id);
    assert.equal(result.data.result.float.zeroFloatCount,c.float===0?1:0,c.id);
  }
});

test('Batch J anti-overfit: BOQ-only usefulness comes from source structure, not a known project template',async()=>{
  const cases=[
    {id:'BOQ-GEN-A',rows:['A-1,AHU,No.,2,1000,2000,AED','A-2,Ductwork,m2,50,10,500,AED']},
    {id:'BOQ-GEN-B',rows:['Z-77,لوحة كهربائية,No.,4,2500,10000,SAR']},
    {id:'BOQ-GEN-C',rows:['X9,Testing package,Lot,1,45000,45000,USD','X10,Cable,m,300,5,1500,USD']},
  ];
  for(const c of cases){
    const csv='Item No,Description,Unit,Quantity,Rate,Amount,Currency\n'+c.rows.join('\n');
    await ingest(c.id,'BOQ-'+c.id+'.csv',csv,'text/csv');
    const state=runtimeProjects.get(c.id)!;
    assert.equal(state.schedules.length,0,c.id+' fixture must remain BOQ-only');
    const scope:any=boqScopeIntelligence(state);
    assert.equal(scope.itemCount,c.rows.length,c.id);
    assert.equal(scope.rows.length,c.rows.length,c.id);
    const page:any=moduleForProject(c.id,'material-tracking');
    assert.notEqual(page.status,'blocked',c.id);
    assert.ok((page.data.rows?.length??0)>0,c.id);
  }
});

test('Batch J anti-overfit: claims-only behavior is invariant across IDs, dates, labels and linkage shapes',()=>{
  for(const variant of [1,2,3]){
    const id='CLAIMS-GENERIC-'+variant+'-X';
    runtimeProjects.getOrCreate(id);
    runtimeProjects.updateControls(id,{delayClaims:claimModel(id,variant)});
    const stored=runtimeProjects.get(id)!;
    assert.equal(stored.schedules.length,0);
    const delay:any=moduleForProject(id,'delay-claims');
    assert.notEqual(delay.status,'blocked',id);
    assert.equal(delay.data.eventCount,1,id);
    assert.equal(delay.data.claimCount,1,id);
    assert.equal(delay.data.programmeEvidenceState,'not_established',id);
    assert.equal(delay.data.windowCount,null,id);
    assert.equal(delay.data.independentScheduleMovementAvailable,false,id);
    const notices:any=moduleForProject(id,'notices-claims');
    assert.notEqual(notices.status,'blocked',id);
    assert.equal(notices.data.claimCount,1,id);
    assert.equal(notices.data.programmeEvidenceState,'not_established',id);
  }
});

test('Batch J anti-overfit: Commercial facts remain usable without schedule and across currencies',()=>{
  const cases=[
    {id:'COMM-GENERIC-A',currency:'AED',contract:1250000,certified:400000,paid:350000},
    {id:'COMM-GENERIC-B',currency:'SAR',contract:8700000,certified:1200000,paid:1200000},
    {id:'COMM-GENERIC-C',currency:'USD',contract:920000,certified:110000,paid:75000},
  ];
  for(const c of cases){
    runtimeProjects.getOrCreate(c.id);
    runtimeProjects.updateControls(c.id,{
      contractValue:{amount:c.contract,currency:c.currency,sourceRefs:['generic-contract:'+c.id]},
      invoices:[{invoiceId:'IPC-'+c.id,currency:c.currency,certifiedAmount:c.certified,paidAmount:c.paid,certificateDateIso:'2036-08-15',paymentDateIso:'2036-08-20',sourceRefs:['generic-payment:'+c.id]} as any],
    });
    const state=runtimeProjects.get(c.id)!;
    assert.equal(state.schedules.length,0);
    const page:any=moduleForProject(c.id,'commercial-overview');
    assert.notEqual(page.status,'blocked',c.id);
    const row=page.data.position.currencies.find((x:any)=>x.currency===c.currency);
    assert.equal(row.originalContractValue.value,c.contract,c.id);
    assert.equal(row.grossCertifiedAmount.value,c.certified,c.id);
    assert.equal(row.paidAmount.value,c.paid,c.id);
  }
});

test('Batch J anti-overfit: production packages contain no known real-project literals',()=>{
  const forbidden=[
    'ORBIT-JED-PLH-P3','JAZ-RTR-T3','RYD-MC-HTA','RUH-TB-P5','JED-DWT-S1',
  ];
  const roots=['packages'];
  const files:string[]=[];
  const walk=(path:string)=>{
    for(const name of readdirSync(path)){
      const target=join(path,name),s=statSync(target);
      if(s.isDirectory())walk(target);
      else if(/\.(?:ts|js|json)$/.test(name))files.push(target);
    }
  };
  roots.forEach(walk);
  const hits:Array<{file:string;project:string}>=[];
  for(const file of files){
    const text=readFileSync(file,'utf8');
    for(const project of forbidden)if(text.includes(project))hits.push({file,project});
  }
  assert.deepEqual(hits,[],
    'Real project identifiers may appear in test/acceptance ordering, never in production packages.');
});
