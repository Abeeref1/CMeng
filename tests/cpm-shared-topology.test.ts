import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomInt} from 'node:crypto';
import {analyzeScheduleGraph,type CanonicalScheduleModel,type CanonicalScheduleActivity} from '../packages/schedule-analysis-core/src';
import {calculateCpm} from '../packages/schedule-cpm/src';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';

test('ten new schedule populations preserve CPM values, exclusions and in-place topology changes after shared analysis',()=>{
  const start=Date.parse('2032-01-05T00:00:00Z');
  for(let project=0;project<10;project++){
    const projectId='TOPOLOGY-'+randomUUID(),count=randomInt(4,13),durations=Array.from({length:count},()=>randomInt(1,25));
    const activities:CanonicalScheduleActivity[]=durations.map((hours,i)=>({projectId,activityId:'A'+i,nativeId:String(i),name:'Work '+i,wbsId:null,calendarId:'C',activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:hours,remainingDurationHours:hours,totalFloatHours:null,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]}));
    const model:CanonicalScheduleModel={projectId,source:'xer',sourceRevisionId:randomUUID(),dataDateIso:'2032-01-05',activities,relationships:activities.slice(1).map((a,i)=>({relationshipId:'R'+i,predecessorActivityId:'A'+i,successorActivityId:a.activityId,type:'FS',lagHours:0,external:false,sourceRefs:[],diagnostics:[]})),wbs:[],calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[]};
    const config={projectStartIso:new Date(start).toISOString()};
    const graph=analyzeScheduleGraph(model);graph.topologicalOrder!.reverse();graph.cyclicActivityIds.push('invented');
    const first=calculateCpm(model,config);
    assert.equal(first.projectFinishIso,new Date(start+durations.reduce((a,b)=>a+b,0)*3600000).toISOString(),projectId);
    assert.equal(first.complete,true);
    assert.deepEqual(first,calculateCpm(structuredClone(model),config));
    model.relationships[0]!.lagHours=3;
    assert.equal(calculateCpm(model,config).projectFinishIso,new Date(start+(durations.reduce((a,b)=>a+b,0)+3)*3600000).toISOString());
    model.relationships.push({relationshipId:'cycle',predecessorActivityId:'A'+(count-1),successorActivityId:'A0',type:'FS',lagHours:0,external:false,sourceRefs:[],diagnostics:[]});
    assert.equal(calculateCpm(model,config).projectFinishIso,null);
    model.relationships.pop();model.activities[1]!.activityType='level_of_effort';
    const excluded=calculateCpm(model,config);
    assert.ok(excluded.activities.every(a=>a.activityId!=='A1'));
    assert.deepEqual(excluded,calculateCpm(structuredClone(model),config));
  }
});
