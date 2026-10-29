import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {crossDomainAccountability} from '../packages/runtime-api/src/accountability-intelligence';
import {ownersForActivity} from '../packages/runtime-api/src/activity-owners';
import {deliveryRecords,changeDelivery} from '../packages/runtime-api/src/delivery-records';
import type {ProjectRuntimeState,StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

// M12.1 invariant: the owner a register record names reaches the activity it is
// linked to (stated or confirmed in review), through the one link reader:
// Accountability, the activity's action owner and the readiness rows show it.
// A corrected link moves it; a record with no owner, or no link, assigns none.

const DATA_DATE='2031-04-15';
function project(t:{after(fn:()=>void):unknown}){
  const dir=mkdtempSync(join(tmpdir(),'m121-owners-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const state=runtimeProjects.getOrCreate('M121-OWN-'+randomUUID().slice(0,8).toUpperCase());
  const activity=(id:string,name:string,start:string,finish:string)=>({projectId:state.projectId,activityId:id,nativeId:id,name,wbsId:null,calendarId:'C',activityType:'task',status:'not_started',
    baselineStartIso:start,baselineFinishIso:finish,currentStartIso:start,currentFinishIso:finish,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
    originalDurationHours:40,remainingDurationHours:40,totalFloatHours:-16,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]});
  const model={projectId:state.projectId,source:'xer',sourceRevisionId:'CURRENT',dataDateIso:DATA_DATE+'T08:00:00',wbs:[],relationships:[],
    calendars:[{calendarId:'C',name:'Eight-hour day',standardDayHours:8,semanticComplete:true,sourceRefs:[]}],diagnostics:[],
    activities:[activity('A1','Steel erection level 3','2031-04-20','2031-04-27'),activity('A2','Facade panels level 3','2031-04-21','2031-04-28')]} as unknown as CanonicalScheduleModel;
  state.schedules.push({role:'update',format:'xer',sourceFilename:'u.xer',sourceHashSha256:'u',uploadedAt:'2031-05-01',revision:{revisionId:'CURRENT',label:'U',sequence:1,effectiveAt:DATA_DATE,model}} as ProjectRuntimeState['schedules'][number]);
  const text='NCR ID,Subject,Status,Raised Date,Responsible Party,Activity ID\nN1,Weld defect at grid C,Open,2031-04-01,Al Noor Steel,A1\nN2,Paint touch-up,Open,2031-04-01,,A2\nN3,Unlinked observation,Open,2031-04-01,Gulf Paint,';
  const path=join(dir,'ncr.csv');writeFileSync(path,text);
  state.evidenceDocuments.push({documentId:'NCR',sourceFilename:'NCR_Register.csv',storedPath:path,sourceHashSha256:createHash('sha256').update(text).digest('hex'),mediaType:'text/csv',basisState:'active',linkedArtifactId:null,category:'design_quality',documentType:'quality_ncr_register',familyKey:'ncr',uploadedAt:'2031-05-01',diagnostics:[],assertions:[]} as unknown as StoredEvidenceDocument);
  state.version++;
  return state;
}
const scheduleOwner=(state:ProjectRuntimeState,id:string)=>(crossDomainAccountability(state).recordActions as any[]).find(a=>String(a.recordKey).toLowerCase()==='schedule|'+id.toLowerCase())?.owner;
const lookRow=(state:ProjectRuntimeState,id:string)=>{const d=moduleForProject(state.projectId,'lookahead-schedule').data as any;const p=d?.result?.projectionKey==='lookahead_schedule'?d.result:d;return [...(p.forwardWindowRows??p.rows??[])].find((r:any)=>r.activityId===id);};

test('M12.1: a linked record\'s named owner reaches the activity on Accountability, its action and the Look-Ahead row; a corrected link moves it',t=>{
  const state=project(t);
  const owners=ownersForActivity(state);
  assert.deepEqual(owners.get('A1')?.map(o=>o.owner),['Al Noor Steel'],'the stated link carries the NCR owner');
  assert.ok(owners.get('A1')![0]!.sourceRefs.length>0,'with its source');
  assert.equal(owners.get('A2'),undefined,'a record that names no owner assigns none');
  assert.ok(![...owners.values()].flat().some(o=>o.owner==='Gulf Paint'),'an unlinked record assigns no owner');
  assert.equal(scheduleOwner(state,'A1'),'Al Noor Steel','the activity action is owned by the named party');
  assert.match(String(scheduleOwner(state,'A2')),/individual not designated/,'no owner named: the role, marked as not designated');
  assert.deepEqual(lookRow(state,'A1')?.linkedOwners?.map((o:any)=>o.owner),['Al Noor Steel'],'the Look-Ahead row shows it');
  const cr=moduleForProject(state.projectId,'construction-readiness').data as any;
  const crRow=(cr.rows??cr.result?.rows??[]).find((r:any)=>r.activityId==='A1');
  if(crRow)assert.deepEqual(crRow.linkedOwners?.map((o:any)=>o.owner),['Al Noor Steel'],'Construction Readiness shows the same owner');
  // Correct the link in review: N1 belongs to A2.
  const n1=deliveryRecords(state).records.find(r=>r.reference==='N1')!;
  changeDelivery(state,{action:'review',recordId:n1.recordId,sourceRevision:n1.revision,state:'governed',links:{...n1.links,activityIds:['A2']},note:'M121: corrected link',expectedVersion:state.version});state.version++;
  const moved=ownersForActivity(state);
  assert.equal(moved.get('A1'),undefined,'the owner leaves the old activity');
  assert.deepEqual(moved.get('A2')?.map(o=>[o.owner,o.link]),[['Al Noor Steel','reviewed']],'and reaches the corrected one');
  assert.equal(scheduleOwner(state,'A2'),'Al Noor Steel');
});
