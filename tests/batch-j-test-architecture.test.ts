import test from 'node:test';
import assert from 'node:assert/strict';

import {
  establishedPopulationCount,
  populationAuthority,
  populationCanAssertZero,
  type PopulationState,
} from '../packages/truth-kernel/src';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {boqScopeIntelligence} from '../packages/runtime-api/src/boq-scope-intelligence';
import {canonicalCommercialModule} from '../packages/runtime-api/src/commercial-runtime';
import {changeDelivery,deliveryRecords,deliveryStore} from '../packages/runtime-api/src/delivery-records';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {moduleRegistry} from '../packages/runtime-api/src/registry';

const truthStates:PopulationState[]=[
  'established','missing','partial','candidate','source_only','conflicted','not_applicable','quarantined',
];
const majorDomains=[
  'schedule','progress','commercial','claims','delivery','design','quality','risk','resources','interfaces',
] as const;

function clearNonSchedule(state:any){
  state.quantities=null;
  state.boq=null;
  state.boqRevisions=[];
  state.contract=null;
  state.contractDocuments=[];
  state.contractFamily=null;
  state.controls={
    ...state.controls,
    delayClaims:null,
    contractTimeBasis:null,
    readinessEvidence:{},
    progressEvidence:{},
    contractValue:null,
    variations:[],
    invoices:[],
    retentions:[],
    bonds:[],
    claimCommercials:[],
    hseIncidents:[],
    ncrs:[],
    rfis:[],
    permits:[],
    risks:[],
    boardPublication:null,
  };
}

function clearCommercialControls(state:any){
  state.controls={
    ...state.controls,
    contractValue:null,
    variations:[],
    invoices:[],
    retentions:[],
    bonds:[],
    claimCommercials:[],
  };
}

test('Batch J Task 59 truth-state matrix: zero is authoritative only for an established population in every major domain',()=>{
  for(const domain of majorDomains){
    for(const state of truthStates){
      const population=populationAuthority({
        state,
        sourceCount:state==='missing'?null:0,
        applicableCount:state==='established'?0:null,
        currentCount:state==='established'?0:null,
        excludedCount:0,
        coveragePercent:state==='established'?100:state==='partial'?50:null,
        basis:domain+' / '+state,
      });
      assert.equal(population.state,state,domain+' '+state);
      assert.equal(populationCanAssertZero(population),state==='established',domain+' '+state);
      assert.equal(establishedPopulationCount(0,population),state==='established'?0:null,domain+' '+state);
    }
  }
});

test('Batch J Task 60: schedule Long Lead evidence is acknowledged by the actual Long Lead page and management surface',()=>{
  const id='J-INVARIANT-LONG-LEAD';
  const state:any=loadCertifiedDemoProject(id);
  const current=state.schedules.at(-1)!.revision.model;
  current.wbs[0]!.name='Long Lead Materials';
  current.activities.find((row:any)=>row.activityId==='A200')!.name='Long Lead transformer procurement';

  const page:any=moduleForProject(id,'long-lead');
  assert.notEqual(page.status,'blocked');
  assert.ok(page.data.scheduleLongLeadCandidates.length>0);
  assert.ok(page.data.rows.some((row:any)=>row.candidateType==='schedule_wbs'||row.candidateType==='schedule_activity'));

  const dashboard:any=moduleForProject(id,'master-dashboard');
  assert.ok((dashboard.data.visualControl?.boqScope?.scheduleCandidateLongLeadCount??0)>0);
  assert.match(JSON.stringify(dashboard.data),/long[- ]lead/i);
});

test('Batch J Task 60: incomplete float coverage remains qualified across Activity, Near-Critical and Milestone views',()=>{
  const id='J-INVARIANT-FLOAT';
  const state:any=loadCertifiedDemoProject(id);
  const current=state.schedules.at(-1)!.revision.model;
  current.activities.find((row:any)=>row.activityId==='A200')!.totalFloatHours=null;
  current.activities.find((row:any)=>row.activityId==='M300')!.totalFloatHours=null;

  const activity:any=moduleForProject(id,'activity-analytics').data;
  const near:any=moduleForProject(id,'near-critical').data;
  const milestones:any=moduleForProject(id,'milestones').data;

  assert.ok(activity.floatCoveragePercent!==null&&activity.floatCoveragePercent<100);
  assert.ok((activity.counts?.critical?.unresolvedCount??0)>0);
  assert.ok(near.floatCoveragePercent!==null&&near.floatCoveragePercent<100);
  assert.ok((near.unknownFloatCount??0)>0);
  assert.ok(milestones.floatCoveragePercent!==null&&milestones.floatCoveragePercent<100);
  assert.equal(milestones.sourceFloatState,'not_established',
    'the only milestone has no source float, so milestone float must be explicitly not established rather than falsely partial');
  assert.equal(milestones.criticalMilestoneCount,null);
  assert.ok(milestones.rows.some((row:any)=>row.totalFloatHours===null&&row.managementFlags?.includes('FLOAT_NOT_ESTABLISHED')));
});

test('Batch J Task 60: schedule snapshot progress never becomes physical or certified progress',()=>{
  const id='J-INVARIANT-PROGRESS';
  const state:any=loadCertifiedDemoProject(id);
  state.controls.progressEvidence={};

  const report:any=moduleForProject(id,'progress-report').data;
  assert.equal(report.scheduleSnapshotOnly,true);
  assert.ok(report.progressBases.scheduleSnapshot?.valuePercent!==null);
  assert.equal(report.progressBases.physical.valuePercent,null);
  assert.equal(report.progressBases.physical.authority,'missing');
  assert.equal(report.progressBases.certified.valuePercent,null);
  assert.equal(report.progressBases.certified.authority,'missing');
  assert.equal(report.headlineProgress.key,'schedule_snapshot');
});

test('Batch J Task 60: all Commercial views consume one canonical certificate/payment position',()=>{
  const id='J-INVARIANT-COMMERCIAL';
  const state:any=loadCertifiedDemoProject(id);
  const overview:any=canonicalCommercialModule(state,'commercial-overview')!;
  const payments:any=canonicalCommercialModule(state,'payments')!;
  const cash:any=canonicalCommercialModule(state,'cash-flow')!;

  assert.deepEqual(payments.data.position,overview.data.position);
  assert.deepEqual(cash.data.position,overview.data.position);
  assert.deepEqual(payments.data.focus.paymentRegister,overview.data.position.foundation.paymentRegister);
  assert.deepEqual(cash.data.focus.paymentRegister,overview.data.position.foundation.paymentRegister);
  assert.deepEqual(
    cash.data.focus.transactions.map((row:any)=>({
      invoiceId:row.invoiceId,certifiedAmount:row.certifiedAmount,paidAmount:row.paidAmount,currency:row.currency,
    })),
    overview.data.position.registers.invoices
      .filter((row:any)=>row.certificateDateIso||row.paymentDateIso)
      .map((row:any)=>({
        invoiceId:row.invoiceId,certifiedAmount:row.certifiedAmount,paidAmount:row.paidAmount,currency:row.currency,
      })),
  );
});

test('Batch J Task 60: one programme revision is a current point, never a fabricated history trend',()=>{
  const id='J-INVARIANT-ONE-REV';
  const state:any=loadCertifiedDemoProject(id);
  state.schedules=[state.schedules.at(-1)!];

  const trend:any=moduleForProject(id,'revision-trend');
  assert.equal(trend.status,'partial');
  assert.equal(trend.data.points.length,1);
  assert.match(String(trend.reason),/one revision|one comparable programme revision|current completion position/i);
  assert.doesNotMatch(String(trend.reason),/trend established|improving trend|deteriorating trend/i);
});

test('Batch J Task 60: Interface Management accepts generic Status, Owner and Due Date fields without losing the interface',()=>{
  const id='J-INVARIANT-INTERFACE';
  const state:any=loadCertifiedDemoProject(id);
  changeDelivery(state,{
    expectedVersion:state.version,action:'create',kind:'interface',
    fields:{
      'record reference':'IF-001',
      description:'Design to construction release',
      status:'Open',
      owner:'Interface Manager',
      'due date':'2026-01-08',
      'giving party':'Designer',
      'receiving party':'Main Contractor',
    },
  } as any);
  runtimeProjects.touch(state);
  const created=deliveryRecords(state).records.find(
    (row:any)=>row.recordId===deliveryStore(state).manual.at(-1)!.recordId,
  )!;
  changeDelivery(state,{
    expectedVersion:state.version,action:'review',recordId:created.recordId,sourceRevision:created.revision,
    state:'governed',fields:{},note:'Batch J governed interface fixture.',
  } as any);
  runtimeProjects.touch(state);

  const page:any=moduleForProject(id,'delivery-interfaces');
  assert.notEqual(page.status,'blocked');
  const row=page.data.rows.find((value:any)=>value.interfaceId==='IF-001');
  assert.ok(row);
  assert.equal(row.currentStatus,'Open');
  assert.equal(row.responsibleParty,'Interface Manager');
  assert.equal(row.requiredDate,'2026-01-08');
  assert.equal(row.givingParty,'Designer');
  assert.equal(row.receivingParty,'Main Contractor');
});

test('Batch J Task 61: primary management surfaces are answer-first, impact/scope/action aware and keep gaps secondary',()=>{
  const id='J-MANAGEMENT-USEFULNESS';
  loadCertifiedDemoProject(id);

  const managementKeys=moduleRegistry.filter(row=>row.area==='management').map(row=>row.key);
  assert.deepEqual(managementKeys,[
    'master-dashboard','command-center','cross-domain-accountability','master-control-programme','source-quality',
  ]);
  const managementPages=Object.fromEntries(managementKeys.map(key=>[key,moduleForProject(id,key)])) as Record<string,any>;
  const dashboard:any=managementPages['master-dashboard'];
  const command:any=managementPages['command-center'];
  const accountability:any=managementPages['cross-domain-accountability'];
  const mcp:any=managementPages['master-control-programme'];
  const sourceQuality:any=managementPages['source-quality'];
  const pmo:any=moduleForProject(id,'pmo-analysis');

  for(const [name,page] of Object.entries({...managementPages,'pmo-analysis':pmo}) as Array<[string,any]>){
    assert.notEqual(page.status,'blocked',name);
    assert.ok(page.data&&typeof page.data==='object',name+' current answer');
    assert.ok(JSON.stringify(page.data).replace(/null|false|0|\[\]|\{\}/g,'').length>100,name+' usable content');
  }

  assert.ok(dashboard.data.completionPosition,'dashboard completion answer');
  assert.ok(Array.isArray(command.data.actions)&&command.data.actions.length>0,'management actions');
  assert.ok(command.data.actions.some((row:any)=>String(row.issue??'').trim()),'issue');
  assert.ok(command.data.actions.some((row:any)=>String(row.consequence??'').trim()),'impact');
  assert.ok(command.data.actions.some((row:any)=>(row.affectedScope?.length??0)>0||(row.affectedMilestones?.length??0)>0),'affected scope');
  assert.ok(command.data.actions.some((row:any)=>String(row.requiredAction??'').trim()),'next action');
  assert.match(JSON.stringify(command.data),/Project Director/,'known owner remains visible');
  assert.ok((accountability.data.actions?.length??0)>0,'accountability page must expose real actions');
  assert.ok(accountability.data.actions.some((row:any)=>String(row.consequence??'').trim()),'accountability impact');
  assert.ok(accountability.data.actions.some((row:any)=>String(row.requiredAction??'').trim()),'accountability next action');
  assert.ok(sourceQuality.data,'source-quality page remains available as secondary review information');
  assert.ok(mcp.data,'MCP current execution position remains available');

  const html=cmengUatHtml();
  assert.match(html,/Actions requiring management attention/);
  assert.match(html,/Issue & consequence/);
  assert.match(html,/renderMcpProgrammeControl\(data\)[\s\S]*experienceDisclosure\("Control authority & evidence"/);
  assert.match(html,/Control gaps/);
});

test('Batch J Task 62: schedule-only project remains useful',()=>{
  const id='J-SPARSE-SCHEDULE';
  const state:any=loadCertifiedDemoProject(id);
  clearNonSchedule(state);
  runtimeProjects.touch(state);
  const schedule:any=moduleForProject(id,'schedule-analytics');
  assert.notEqual(schedule.status,'blocked');
  assert.ok((schedule.data.result?.activityCount??0)>0);
  assert.ok(schedule.data.result?.population?.sourceActivityCount>0);
});

test('Batch J Task 62: BOQ-only project remains useful without a programme',()=>{
  const id='J-SPARSE-BOQ';
  const state:any=loadCertifiedDemoProject(id);
  state.schedules=[];
  state.resourcesByRevision.clear();
  state.contract=null;
  clearCommercialControls(state);
  state.controls.delayClaims=null;
  state.controls.contractTimeBasis=null;
  state.controls.progressEvidence={};
  runtimeProjects.touch(state);
  const boq:any=boqScopeIntelligence(state);
  assert.ok(boq.itemCount>0);
  assert.ok(boq.rows.length>0);
  const materials:any=moduleForProject(id,'material-tracking');
  assert.notEqual(materials.status,'blocked');
  assert.ok((materials.data.rows?.length??0)>0);
  assert.match(String(materials.data.managementPosition??materials.reason??''),/BOQ|scope|review/i);
});

test('Batch J Task 62: Commercial-only project retains known money without a programme',()=>{
  const id='J-SPARSE-COMMERCIAL';
  const state:any=loadCertifiedDemoProject(id);
  state.schedules=[];
  state.resourcesByRevision.clear();
  state.quantities=null;
  state.controls.delayClaims=null;
  state.controls.contractTimeBasis=null;
  state.controls.progressEvidence={};
  runtimeProjects.touch(state);
  const overview:any=canonicalCommercialModule(state,'commercial-overview')!;
  assert.notEqual(overview.status,'blocked');
  assert.ok(overview.data.position.currencies.length>0);
  assert.ok(overview.data.position.currencies.some((row:any)=>
    row.originalContractValue?.value!==null||row.currentContractValue?.value!==null||row.grossCertifiedAmount?.value!==null));
});

test('Batch J Task 62: claims-only project retains governed claim/event evidence without a programme',()=>{
  const id='J-SPARSE-CLAIMS';
  const state:any=loadCertifiedDemoProject(id);
  state.schedules=[];
  state.resourcesByRevision.clear();
  state.quantities=null;
  clearCommercialControls(state);
  runtimeProjects.touch(state);
  const storedClaimsOnly=runtimeProjects.get(id)!;
  assert.equal(storedClaimsOnly.schedules.length,0,'claims-only fixture must have no programme');
  assert.ok((storedClaimsOnly.controls.delayClaims?.events.length??0)>0,'governed event must survive sparse fixture mutation');
  assert.ok((storedClaimsOnly.controls.delayClaims?.claims.length??0)>0,'governed claim must survive sparse fixture mutation');
  assert.ok((state.controls.delayClaims?.events.length??0)>0);
  assert.ok((state.controls.delayClaims?.claims.length??0)>0);
  const delay:any=moduleForProject(id,'delay-claims');
  assert.notEqual(delay.status,'blocked');
  assert.equal(delay.data.contractorClaimEvidenceSubmitted,true);
  assert.ok((delay.data.eventCount??0)>0,
    'claims-only page lost governed events: '+JSON.stringify({
      rawEventCount:storedClaimsOnly.controls.delayClaims?.events.length??0,
      rawClaimCount:storedClaimsOnly.controls.delayClaims?.claims.length??0,
      status:delay.status,
      reason:delay.reason,
      eventCount:delay.data.eventCount,
      claimCount:delay.data.claimCount,
      programmeEvidenceState:delay.data.programmeEvidenceState,
      projectionKey:delay.data.projectionKey,
    }));
  assert.ok((delay.data.claimCount??0)>0);
  assert.equal(delay.data.independentScheduleMovementAvailable,false);
  assert.equal(delay.data.programmeEvidenceState,'not_established');
  assert.equal(delay.data.windowCount,null,'missing programme windows must not become zero');
  assert.equal(delay.data.activityLinkedEventCount,null,'activity validation needs a programme and must not become zero');
  assert.ok((delay.data.sourceActivityReferenceEventCount??0)>0,'source activity references remain visible without being promoted to validated schedule links');

  const notices:any=moduleForProject(id,'notices-claims');
  assert.notEqual(notices.status,'blocked');
  assert.equal(notices.data.contractorNoticeClaimEvidenceSubmitted,true);
  assert.equal(notices.data.programmeEvidenceState,'not_established');
  assert.ok((notices.data.claimCount??0)>0);
});

test('Batch J Task 62: schedule plus BOQ stays useful without Commercial or claims',()=>{
  const id='J-SPARSE-SCHEDULE-BOQ';
  const state:any=loadCertifiedDemoProject(id);
  clearCommercialControls(state);
  state.controls.delayClaims=null;
  state.controls.contractTimeBasis=null;
  runtimeProjects.touch(state);
  const schedule:any=moduleForProject(id,'schedule-analytics');
  const boq:any=boqScopeIntelligence(state);
  const materials:any=moduleForProject(id,'material-tracking');
  assert.notEqual(schedule.status,'blocked');
  assert.ok((schedule.data.result?.activityCount??0)>0);
  assert.ok(boq.itemCount>0);
  assert.notEqual(materials.status,'blocked');
  assert.ok((materials.data.rows?.length??0)>0);
});

test('Batch J Task 62: schedule plus claims stays useful without BOQ or Commercial',()=>{
  const id='J-SPARSE-SCHEDULE-CLAIMS';
  const state:any=loadCertifiedDemoProject(id);
  state.quantities=null;
  clearCommercialControls(state);
  runtimeProjects.touch(state);
  const schedule:any=moduleForProject(id,'schedule-analytics');
  const delay:any=moduleForProject(id,'delay-claims');
  assert.notEqual(schedule.status,'blocked');
  assert.ok((schedule.data.result?.activityCount??0)>0);
  assert.ok((state.controls.delayClaims?.events.length??0)>0);
  assert.ok((state.controls.delayClaims?.claims.length??0)>0);
  assert.notEqual(delay.status,'blocked');
  assert.equal(delay.data.contractorClaimEvidenceSubmitted,true);
  assert.ok((delay.data.eventCount??0)>0);
  assert.ok((delay.data.claimCount??0)>0);
});

test('Batch J Task 62: full project keeps all primary management surfaces useful',()=>{
  const id='J-SPARSE-FULL';
  loadCertifiedDemoProject(id);
  const pages=['master-dashboard','command-center','master-control-programme','pmo-analysis']
    .map(key=>moduleForProject(id,key) as any);
  assert.ok(pages.every(page=>page&&page.status!=='blocked'));
  assert.ok((pages[1]!.data.actions?.length??0)>0);
});
