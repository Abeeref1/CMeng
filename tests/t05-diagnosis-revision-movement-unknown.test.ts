import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {buildProjectDiagnosis} from '../packages/runtime-api/src/project-diagnosis';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {ModuleRuntimeResult} from '../packages/runtime-api/src/project-state-types';

let sequence=0;

function fixture(previousCount:number, movementValues:readonly [string,unknown][]) {
  const projectId='REVISION-UNKNOWN-SOURCE-'+(++sequence);
  const calendar={...ELAPSED_24H_CALENDAR,calendarId:'CAL-SOURCE',semanticComplete:true,standardDayHours:8};
  const makeModel=(revisionId:string,size:number,dataDateIso:string)=>({
    projectId,source:'xer' as const,sourceRevisionId:revisionId,dataDateIso,
    activities:Array.from({length:size},(_,i)=>({
      projectId,activityId:'ACT-'+i,nativeId:String(i+1),name:'Original task '+i,
      activityType:'task' as const,status:'not_started' as const,wbsId:'WORK',
      calendarId:'CAL-SOURCE',baselineStartIso:'2031-05-03',baselineFinishIso:'2031-05-04',
      currentStartIso:'2031-05-03',currentFinishIso:'2031-05-04',
      actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
      originalDurationHours:8,remainingDurationHours:8,totalFloatHours:16,
      freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[],
    })),
    relationships:[],wbs:[{wbsId:'WORK',name:'Source work',parentWbsId:null,sourceRefs:[]}],
    calendars:[calendar],diagnostics:[],
  });
  const oldId='REV-OLD-'+projectId,nowId='REV-NEW-'+projectId;
  // Distinct source reporting dates are required before an unadopted revision
  // can be uniquely selected for analytical comparison. This is test-source
  // evidence, not formal programme adoption or a production fallback.
  const before=makeModel(oldId,previousCount,'2031-05-01');
  const after=makeModel(nowId,7,'2031-05-02');
  const state=runtimeProjects.getOrCreate(projectId);
  for(const [model,revisionId,sequenceNumber] of [[before,oldId,1],[after,nowId,2]] as const){
    state.schedules.push({role:'update',format:'xer',sourceFilename:'original-'+sequenceNumber+'.xer',
      sourceHashSha256:'source-hash-'+projectId+'-'+sequenceNumber,
      uploadedAt:'2031-05-0'+sequenceNumber,
      revision:{revisionId,label:'Source revision '+sequenceNumber,sequence:sequenceNumber,
        effectiveAt:'2031-05-0'+sequenceNumber,model}});
  }
  runtimeProjects.touch(state);
  const sourceSnapshot=JSON.stringify(state.schedules);
  const analytics=moduleForProject(projectId,'activity-analytics');
  assert.equal((analytics.data as any)?.rows?.length,7,'genuine full source activity analytics must exist');
  const changedActivities=movementValues.map(([id,value])=>({
    toActivityId:id,activityId:id,changeKind:'modified',finishShiftDays:value,
  }));
  const comparison:ModuleRuntimeResult={
    key:'schedule-change-report',status:'ready',reason:null,dependencies:[],
    data:{state:'ready',fromRevisionId:oldId,toRevisionId:nowId,changedActivities},
  };
  const modules=new Map<string,ModuleRuntimeResult>([
    ['activity-analytics',analytics],['schedule-change-report',comparison],
  ]);
  const diagnosis=()=>buildProjectDiagnosis(state,modules);
  return {projectId,state,sourceSnapshot,diagnosis};
}

test('T05/T06 missing, nonfinite, genuine zero and absent earlier source are distinct in management diagnosis',()=>{
  const a=fixture(6,[
    ['ACT-0',undefined],['ACT-1',Number.NaN],['ACT-2',4],
    ['ACT-3',0],['ACT-4',-2],
  ]);
  const b=fixture(7,[
    ['ACT-0',1],['ACT-1',0],['ACT-2',-1],
    ['ACT-3',0],['ACT-4',0],['ACT-5',0],['ACT-6',0],
  ]);
  // Conflicting report rows with the same activity identity must not
  // arbitrarily select the last source movement or fabricate a zero.
  const c=fixture(7,[
    ['ACT-0',1],['ACT-0',-2],['ACT-1',0],['ACT-2',0],
    ['ACT-3',0],['ACT-4',0],['ACT-5',0],['ACT-6',0],
  ]);
  const first=a.diagnosis(),other=b.diagnosis(),conflict=c.diagnosis();
  assert.ok(first&&other,'source-backed management diagnosis must remain available');

  // Expected denominators are independently defined by the source revisions:
  // A: three unknowns (missing movement, invalid movement, no earlier row),
  // one genuine positive movement, three known non-positive rows.
  assert.deepEqual(first.counts.previousUpdateSlippage,{
    knownCount:1,value:null,unresolvedCount:3,population:7,
  });
  assert.equal(first.actions.some((row:any)=>row.activityId==='ACT-0'&&row.previousFinishMovementCalendarDays===0),false,
    'an absent movement must never become a fabricated zero in management actions');
  assert.equal(first.wbsRows[0]?.previousSlippageCount,1,
    'known actual slipping activities remain counted without inventing missing movements');

  // B has all seven source movements established, including true zeros.
  assert.deepEqual(other.counts.previousUpdateSlippage,{
    knownCount:1,value:1,unresolvedCount:0,population:7,
  });
  assert.equal(b.diagnosis()?.counts.previousUpdateSlippage.value,1);
  assert.equal(a.diagnosis()?.counts.previousUpdateSlippage.value,null,
    'a second project must not fill the first project\'s missing evidence');

  assert.ok(conflict,'a source with contradictory movement rows still yields a diagnosis');
  assert.deepEqual(conflict.counts.previousUpdateSlippage,{
    knownCount:0,value:null,unresolvedCount:1,population:7,
  },'duplicate source movements are unresolved instead of last-row wins');
  assert.equal(conflict.wbsRows[0]?.previousSlippageCount,0,
    'contradictory source movements must not inflate a WBS total');
  assert.equal(c.diagnosis()?.counts.previousUpdateSlippage.value,null,
    'ambiguous source cannot become a known no-slippage total on repeat');
  assert.equal(JSON.stringify(c.state.schedules),c.sourceSnapshot,
    'conflicting evidence cannot rewrite the original source revisions');
  assert.equal(JSON.stringify(a.state.schedules),a.sourceSnapshot,
    'the original submitted source history must not be modified');
  assert.equal(JSON.stringify(b.state.schedules),b.sourceSnapshot);
});
