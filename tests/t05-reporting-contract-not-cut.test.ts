import test from 'node:test';
import assert from 'node:assert/strict';
import {pageProjectResponse,recordDetailPage,PROJECT_SCREEN_MAX_BYTES} from '../packages/runtime-api/src/response-paging';

// Near-critical screen shape: display registers, plus a reporting contract whose
// metric map holds more than 150 entries. The boundary-audit contracts come last,
// as they do after the working-day fields were added to the earlier rows.
const ids=(n:number,prefix:string)=>Array.from({length:n},(_,i)=>prefix+i);
const population=(name:string,n:number)=>({populationId:'population:'+name,name,denominator:n,memberIds:ids(n,'ACT-'),
  exclusions:[],dateBasis:'programme snapshot; future planned finishes retained'});
const contract=(unit:string|null)=>({populationId:'population:execution_control',denominator:8900,excludedCount:0,
  exclusionsRef:'reportingContract.populations.execution_control.exclusions',dataDateIso:'2031-04-04',authority:'calculated',
  dateBasis:'programme snapshot; future planned finishes retained',unit,state:'established',
  qualification:'programme snapshot; future planned finishes retained'});
const boundaryAuditPaths=[
  ...['floatDifferenceHours','floatDifferenceWorkingDays','independentTotalFloatHours','independentTotalFloatWorkingDays',
    'submittedTotalFloatWorkingDays','workingDayHours'].map(f=>'boundaryAudit.criticalBoundary.above[*].'+f),
  ...['calendarWorkingDayHours','criticalThresholdHours','distanceFromCriticalThresholdHours','distanceFromNearCriticalUpperBoundaryHours',
    'distanceFromNearCriticalUpperBoundaryWorkingDays','floatDifferenceHours','floatDifferenceWorkingDays','independentTotalFloatHours',
    'independentTotalFloatWorkingDays','nearCriticalThresholdHours','nearCriticalThresholdWorkingDays','submittedTotalFloatHours',
    'submittedTotalFloatWorkingDays','totalFloatHours','totalFloatWorkingDays','workingDayHours'].map(f=>'boundaryAudit.nearCriticalUpperBoundary.inside[*].'+f),
  'boundaryAudit.nearCriticalUpperBoundary.thresholdWorkingDays','sourceReportedNearCriticalLabelCount',
];
const metricContracts:Record<string,unknown>={};
for(const table of ['rows','watchlistRows','criticalRows','negativeFloatRows'])
  for(let i=0;i<48;i++)metricContracts[table+'[*].metric'+i+'WorkingDays']=contract('working days');
for(const path of boundaryAuditPaths)metricContracts[path]=contract(/Hours$/.test(path)?'hours':null);
const contractCount=Object.keys(metricContracts).length;
// responseBytes is measured on the finished projection with its own figure at 0
// (the existing pager rule); the sent payload is that size plus the figure's digits.
const measuredBytes=(paged:any)=>Buffer.byteLength(JSON.stringify({...paged,responsePaging:{...paged.responsePaging,responseBytes:0}}),'utf8');
const row=(i:number)=>({activityId:'ACT-'+i,totalFloatHours:i%80,totalFloatWorkingDays:(i%80)/8,status:'not_started'});
const nearCritical=()=>({key:'near-critical',status:'partial',reason:null,projectVersion:2,data:{
  projectionKey:'near_critical',
  rows:Array.from({length:7732},(_,i)=>row(i)),
  watchlistRows:Array.from({length:8376},(_,i)=>row(i)),
  // A display object, not metadata: it stays subject to the screen key budget.
  floatGroups:Object.fromEntries(Array.from({length:180},(_,i)=>['group'+i,{count:i}])),
  reportingContract:{schemaVersion:'1.0',dataDateIso:'2031-04-04',projectVersion:2,
    populations:{execution_control:population('execution_control',8900),relationships:population('relationships',11776)},
    metricContracts},
}});

for(const route of ['/api/projects/P/schedule/modules/near-critical','/api/projects/P/management/near-critical']){
  test('T05: every metric contract reaches the near-critical screen ('+route+')',()=>{
    assert.ok(contractCount>150,'fixture must exceed the 150-key object budget');
    const body=nearCritical();
    const paged=pageProjectResponse(body,route) as any;
    const delivered=paged.data.reportingContract.metricContracts;
    assert.deepEqual(Object.keys(delivered),Object.keys(metricContracts),'every contract, in source order');
    for(const path of boundaryAuditPaths)assert.deepEqual(delivered[path],metricContracts[path],path);
    const tables=paged.responsePaging.tables as Array<{pointer:string;total:number;shown:number;kind:string}>;
    assert.equal(tables.some(t=>t.pointer==='/data/reportingContract/metricContracts'),false,'nothing cut, so no paged-table entry');
    // Long identity lists inside the contract stay paged with their true totals.
    const members=tables.find(t=>t.pointer==='/data/reportingContract/populations/relationships/memberIds');
    assert.deepEqual(members,{pointer:'/data/reportingContract/populations/relationships/memberIds',total:11776,shown:25,kind:'array'});
    assert.equal(paged.data.reportingContract.populations.relationships.denominator,11776);
    // Display registers and display objects keep their screen paging.
    assert.equal(paged.data.rows.length,25);
    assert.deepEqual(tables.find(t=>t.pointer==='/data/rows'),{pointer:'/data/rows',total:7732,shown:25,kind:'array'});
    assert.deepEqual(tables.find(t=>t.pointer==='/data/floatGroups'),{pointer:'/data/floatGroups',total:180,shown:150,kind:'object'});
    // The size budget still applies and records the bytes actually sent.
    const sent=Buffer.byteLength(JSON.stringify(paged),'utf8');
    assert.equal(paged.responsePaging.responseBytes,measuredBytes(paged));
    assert.ok(sent<=PROJECT_SCREEN_MAX_BYTES,'screen budget respected: '+sent);
    // The source payload itself is never modified by paging.
    assert.equal(Object.keys(body.data.reportingContract.metricContracts).length,contractCount);
  });
}

test('T05: the reporting contract stays complete at the tightest screen budget',()=>{
  const body=nearCritical();
  // Force the smallest page budget (55 keys per object, 1 row per register).
  const paged=pageProjectResponse(body,'/api/projects/P/management/near-critical',10_000) as any;
  assert.deepEqual(Object.keys(paged.data.reportingContract.metricContracts),Object.keys(metricContracts));
  assert.equal(paged.data.rows.length,1,'display registers are reduced first');
  assert.equal(paged.responsePaging.responseBytes,measuredBytes(paged),'oversize is recorded, not hidden');
  assert.ok(paged.responsePaging.responseBytes>10_000);
});

test('T05: the complete contract map stays reachable through the record-page route with its true total',()=>{
  const page=recordDetailPage(nearCritical(),'/data/reportingContract/metricContracts',150,50) as any;
  assert.equal(page.total,contractCount);
  assert.deepEqual(page.rows.map((r:any)=>r.field),Object.keys(metricContracts).slice(150,200));
});
