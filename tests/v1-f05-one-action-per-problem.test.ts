import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeControlIssues,controlIssueField,controlIssueMemberId,type ControlIssue} from '../packages/truth-kernel/src';
import {projectActions} from '../packages/runtime-api/src/project-actions';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject,projectActionRegisterForState} from '../packages/runtime-api/src/project-projections';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';

// F05 (D-038, D-042, D-131): one problem = one action. The same raw field
// identity (kind, code, raw field, owner) reported by two pages with their own
// prose is one request in one matter, and each page's own text is kept.
const finding=(moduleKey:string,detail:string,action:string):ControlIssue=>({
  kind:'missing_information',code:'MISSING_SOURCE_VALUE',summary:'Planned quantity · information missing',detail,action,
  owner:'Project evidence owner',field:'position.plannedQty',moduleKeys:[moduleKey],evidencePaths:['data.position.plannedQty'],
  sourceRefs:['boq:row:12'],checkIds:[]});
const progress=finding('progress-breakdown','Planned quantity is needed for the progress curve.','Upload the BOQ with planned quantities.');
const quantity=finding('quantity-scurve','The quantity S-curve has no planned quantity.','Supply the planned quantity for the quantity curve.');

test('F05: one raw field problem reported by two pages with different wording is one request, both texts kept',()=>{
  const assessed=summarizeControlIssues([progress,quantity]);
  assert.equal(assessed.issues.length,1,'prose differences never split one problem into two requests');
  assert.equal(assessed.counts.missing_information,1);
  const merged=assessed.issues[0]!;
  assert.deepEqual(merged.moduleKeys.sort(),['progress-breakdown','quantity-scurve']);
  for(const issue of [progress,quantity]){
    const member=merged.members?.find(m=>m.id===controlIssueMemberId(issue));
    assert.ok(member,'each original is kept as a member');
    assert.equal(member.action,issue.action,'its own action text is kept');
    assert.equal(member.detail,issue.detail,'its own detail text is kept');
  }
});

test('F05: the action register lists that problem in exactly one matter with one request',()=>{
  const state=runtimeProjects.getOrCreate('V1-F05-ONE-ACTION');
  const combined=projectActions(state,summarizeControlIssues([progress,quantity]));
  const matters=[...combined.actions,...combined.information].filter(a=>(a.findings??[]).some(f=>f.code==='MISSING_SOURCE_VALUE'));
  assert.equal(matters.length,1,'one matter');
  assert.equal(matters[0]!.requestCount,1,'one request');
  assert.deepEqual([...(matters[0]!.affectedPages??[])].sort(),['progress-breakdown','quantity-scurve'],'both pages point to the same action');
});

test('F05: different raw fields stay separate even with identical wording',()=>{
  const other={...quantity,field:'position.installedQty',evidencePaths:['data.position.installedQty']};
  assert.equal(summarizeControlIssues([progress,other]).issues.length,2);
});

// Whole-project proof: no raw field identity appears twice anywhere in the
// shared action register, and the pages read that same register.
test('F05: on a project, no raw field identity appears in two actions or twice in one action',()=>{
  const projectId='V1-F05-PROJECT';
  const state:any=runtimeProjects.getOrCreate(projectId);
  const N=60;
  const activities=Array.from({length:N},(_,i)=>({projectId,activityId:'F05-'+i,nativeId:String(i),name:'Zone '+Math.floor(i/20),
   wbsId:'AW'+Math.floor(i/20),calendarId:'C'+i%2,activityType:'task',status:'not_started',baselineStartIso:'2031-01-01',
   baselineFinishIso:'2031-02-01',currentStartIso:'2031-01-01',currentFinishIso:'2031-03-01',actualStartIso:null,actualFinishIso:null,
   forecastStartIso:null,forecastFinishIso:null,originalDurationHours:24,remainingDurationHours:24,totalFloatHours:i%7===0?-8:i%5,
   freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]}));
  const relationships:any[]=[];
  for(let i=1;i<N;i++)if(i%20!==0)relationships.push({relationshipId:'R'+i,predecessorActivityId:activities[i-1]!.activityId,
   successorActivityId:activities[i]!.activityId,type:'FS',lagHours:0,sourceRefs:[],diagnostics:[]});
  const model:any={projectId,source:'xer',sourceRevisionId:'F05-REV',dataDateIso:'2031-04-01',activities,relationships,
   wbs:[0,1,2].map(i=>({wbsId:'AW'+i,name:'Area '+i,parentWbsId:null,sourceRefs:[]})),
   calendars:[0,1].map(i=>({...ELAPSED_24H_CALENDAR,calendarId:'C'+i})),diagnostics:[]};
  state.schedules.push({role:'baseline',format:'xer',sourceFilename:'F05.xer',sourceHashSha256:'F05',uploadedAt:'2031-04-01',
   revision:{revisionId:'F05-REV',label:'F05-REV',sequence:1,effectiveAt:'2031-04-01',model}});
  state.testProject=true;
  runtimeProjects.touch(state);
  const register=projectActionRegisterForState(runtimeProjects.getOrCreate(projectId));
  // Every list of review matters the register carries (decisions, information,
  // follow-ups). The same matter listed in two views is one action, not two.
  const matters=(Object.values(register.workflow) as unknown[]).filter(Array.isArray).flat()
    .filter((a:any)=>a&&typeof a.id==='string'&&Array.isArray(a.findings)) as Array<{id:string;findings:ControlIssue[]}>;
  assert.ok(matters.length>0,'the project raises review matters');
  const seen=new Map<string,string>();
  for(const action of matters){
    const inThis=new Set<string>();
    for(const f of action.findings){
      const identity=JSON.stringify([f.kind,f.code,f.kind==='source_conflict'&&f.sourceFactKey&&f.sourceRefs.length
        ?[f.sourceFactKey,[...new Set(f.sourceRefs)].sort()]:controlIssueField(f),f.owner]);
      assert.ok(!inThis.has(identity),'raw identity '+identity+' appears twice in '+action.id);
      inThis.add(identity);
      const other=seen.get(identity);
      assert.ok(other===undefined||other===action.id,'raw identity '+identity+' appears in '+other+' and '+action.id);
      seen.set(identity,action.id);
    }
  }
  const accountability=moduleForProject(projectId,'cross-domain-accountability').data as any;
  assert.equal(accountability.actionCount,register.actions.length,'Accountability counts the same register');
});
