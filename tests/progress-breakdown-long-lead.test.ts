import test from 'node:test';
import assert from 'node:assert/strict';
import {programmeLongLeadScope} from '../packages/progress-breakdown/src/long-lead-scope';
import {buildProgressBreakdownProjection} from '../packages/progress-breakdown/src/projector';
import {scheduleLongLeadEvidence} from '../packages/runtime-api/src/management-context';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';

const fixture=()=>{
  const wbs=[
    {wbsId:'M',name:'Manufacturing Building',parentWbsId:null,sourceRefs:[]},
    {wbsId:'MA',name:'Fabrication and Vendor Procurement',parentWbsId:'M',sourceRefs:[]},
    {wbsId:'L',name:'Long-Lead Systems',parentWbsId:null,sourceRefs:[]},
    {wbsId:'LC',name:'Mechanical Equipment',parentWbsId:'L',sourceRefs:[]},
    {wbsId:'C',name:'Civil and Electrical',parentWbsId:null,sourceRefs:[]},
  ];
  const specs=[['A1','MA','Procure materials for manufacturing facility'],
    ['A2','LC','Install chiller'],['A3','C','Long-lead switchgear design'],
    ['A4','C','Fabrication and vendor liaison'],['A5','C','Commission pumps'],
    ['A6','LC','Long Lead panel manufacture']] as const;
  const activities=specs.map(([activityId,wbsId,name],i)=>({
    projectId:'LONG-LEAD-SCOPE',activityId,nativeId:String(i+1),name,wbsId,
    calendarId:'C',activityType:'task',status:'not_started',
    baselineStartIso:'2026-07-01',baselineFinishIso:'2026-09-01',
    currentStartIso:'2026-07-01',currentFinishIso:'2026-09-01',
    forecastStartIso:null,forecastFinishIso:null,actualStartIso:null,actualFinishIso:null,
    originalDurationHours:40,remainingDurationHours:40,totalFloatHours:16,freeFloatHours:16,
    percentComplete:0,sourceRefs:[],diagnostics:[],
  }));
  return {projectId:'LONG-LEAD-SCOPE',source:'xer',sourceRevisionId:'REV1',dataDateIso:'2026-08-31',
    activities,wbs,relationships:[],calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[]};
};

test('ABB G4_PROGRESS-43: generic manufacturing WBS is not long-lead; explicitly identified ancestor and activity are',()=>{
  const model:any=fixture(),before=JSON.stringify(model),scope=programmeLongLeadScope(model);
  assert.deepEqual([...scope.activityIds].sort(),['A2','A3','A6']);
  assert.deepEqual(scope.roots.map(w=>w.wbsId),['L']);
  assert.deepEqual(scheduleLongLeadEvidence(model).map(r=>r.activityId).sort(),['A2','A3','A6'],
    'management and Delivery must use the shared explicit programme scope');
  assert.equal(JSON.stringify(model),before,'original WBS and activities must remain intact');
});

test('ABB G4_PROGRESS-43: linked long-lead evidence is separate, and overlap counts once across WBS and full population',()=>{
  const model:any=fixture(),before=JSON.stringify(model);
  const projection=buildProgressBreakdownProjection(model,{
    generatedAt:'2026-08-31T00:00:00Z',producerVersion:'g4-progress-43',
    readinessEvidence:{
      A2:{procurement_material:{state:'review',records:[{longLead:true}]}},
      A5:{procurement_material:{state:'review',records:[{longLead:true}]}},
    },
  });
  const rows=new Map(projection.rows.map(r=>[r.wbsId,r]));
  assert.equal(rows.get('MA')?.longLeadActivityCount,0);
  assert.equal(rows.get('LC')?.longLeadActivityCount,2);
  assert.equal(rows.get('LC')?.longLeadProgrammeCandidateCount,2);
  assert.equal(rows.get('LC')?.longLeadSourceLinkedCount,1);
  assert.equal(rows.get('C')?.longLeadActivityCount,2);
  assert.equal(rows.get('C')?.longLeadProgrammeCandidateCount,1);
  assert.equal(rows.get('C')?.longLeadSourceLinkedCount,1);
  assert.equal(projection.overallSummary?.longLeadActivityCount,4,'no overlap double-count');
  const dimension=new Map(projection.dimensionViews?.find(v=>v.dimension==='wbs')?.rows.map(r=>[r.groupKey,r])??[]);
  assert.equal(dimension.get('MA')?.longLeadActivityCount,0);
  assert.equal(dimension.get('LC')?.longLeadProgrammeCandidateCount,2);
  assert.equal(dimension.get('C')?.longLeadSourceLinkedCount,1);
  assert.equal(JSON.stringify(model),before,'no source mutation');
});
