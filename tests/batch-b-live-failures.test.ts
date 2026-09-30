import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {checkProjectionIntegrity} from '../packages/runtime-api/src/projection-integrity';
import {buildScheduleChangeReportProjection} from '../packages/schedule-change-report/src';
import {DEFAULT_SCHEDULE_ANALYSIS_CONFIG,type CanonicalScheduleActivity,type CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const parsed=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
const loader=parsed.statements.filter(isFunctionDeclaration).filter(n=>n.name&&['loadModule','projectRequestIsCurrent'].includes(n.name.text)).map(n=>n.getText(parsed)).join('\n');
async function loadFailure(body:any,httpStatus:number,key='cross-domain-accountability') {
  const nodes=new Map<string,any>(),rendered:any[]=[];
  const el=(id:string)=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',classList:{remove(){}},onclick:null});return nodes.get(id);};
  const context=createContext({document:{body:{classList:{remove(){}}},querySelectorAll:()=>[]},el,renderModuleResult:(r:any)=>rendered.push(r),
    project:()=> 'SPARSE-OTHER-PROJECT',projectLoadState:'ready',projectRequestSeq:0,moduleRequestSeq:0,
    overview:{projectId:'SPARSE-OTHER-PROJECT'},currentModuleResult:{key:'old'},appView:'project',
    names:{[key]:'Accountability'},descriptions:{},apiKeys:{[key]:'accountability'},moduleRegistry:[],managementSurfaceKeysForApi:new Set([key]),
    escapeHtml:String,setBusy(){},api:async()=>{throw Object.assign(new Error('Request blocked'),{status:httpStatus,data:body});},key});
  await runInContext(loader+';loadModule(key)',context);
  return {nodes,rendered,context};
}
const sparse=()=>({key:'accountability',legacyKey:'cross-domain-accountability',status:'blocked',
  reason:'No actionable ownership chain is established from the current open/overdue records.',
  dependencies:['dated open records with owner/contractor/scope information'],
  data:{projectionKey:'cross_domain_accountability',projectId:'SPARSE-OTHER-PROJECT',actions:[],rows:[],details:[],
    managementPosition:'No actionable ownership chain is established from the current open/overdue records.'}});

test('Batch B: valid sparse Accountability response renders its available position rather than a loading failure',async()=>{
  const body=sparse();const h=await loadFailure(body,409);
  assert.equal(h.rendered.length,1,'HTTP 409 is a governed blocked projection, not a network failure');
  assert.equal(h.rendered[0],body);
  assert.doesNotMatch(h.nodes.get('moduleContent').innerHTML,/Unable to load|Try again/);
});
test('Batch B: genuine server errors must not be relabelled as valid sparse positions',async()=>{
  for(const status of [401,404,500,503]){
    const h=await loadFailure({...sparse(),issueAssessment:{counts:{missing_information:1}}},status);
    assert.equal(h.rendered.length,0,'HTTP '+status+' must remain a request failure');
    assert.match(h.nodes.get('moduleContent').innerHTML,/Unable to load/);
    assert.equal(h.nodes.get('moduleBadge').textContent,'Not loaded');
  }
});
test('Batch B: wrong-page and malformed blocked responses remain retryable errors',async()=>{
  for(const body of [{...sparse(),legacyKey:'wrong-page'},{...sparse(),data:null},{...sparse(),data:{arbitrary:true}},{...sparse(),data:{...sparse().data,projectId:'FOREIGN-PROJECT'}},{...sparse(),data:{projectionKey:''}}]){
    const h=await loadFailure(body,409);
    assert.equal(h.rendered.length,0);
    assert.match(h.nodes.get('moduleContent').innerHTML,/Unable to load/);
  }
});
function activity(id:string,nativeId:string|null=null):CanonicalScheduleActivity {
  return {projectId:'IDENTITY-PARTITION',activityId:id,nativeId,name:id,wbsId:'W1',calendarId:null,activityType:'task',status:'not_started',
    baselineStartIso:null,baselineFinishIso:null,currentStartIso:'2031-01-01',currentFinishIso:'2031-02-01',actualStartIso:null,actualFinishIso:null,
    forecastStartIso:null,forecastFinishIso:null,originalDurationHours:80,remainingDurationHours:80,totalFloatHours:8,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]};
}
function model(id:string,activities:CanonicalScheduleActivity[]):CanonicalScheduleModel {
  return {projectId:'IDENTITY-PARTITION',source:'schedule_xlsx',sourceRevisionId:id,dataDateIso:'2031-01-01',activities,relationships:[],wbs:[],calendars:[],diagnostics:[]};
}
function comparison(fromRows:CanonicalScheduleActivity[],toRows:CanonicalScheduleActivity[]) {
  const from=model('R1',fromRows),to=model('R2',toRows);
  const projection=buildScheduleChangeReportProjection({revisionId:'R1',label:'Before',sequence:1,effectiveAt:'2030-12-01',model:from},
    {revisionId:'R2',label:'After',sequence:2,effectiveAt:'2031-01-01',model:to},{generatedAt:'2031-01-01',producerVersion:'acceptance'});
  const result:any={key:'schedule-change-report',status:'partial',dependencies:[],data:projection};
  return {projection,to,result,checked:checkProjectionIntegrity(result,to,DEFAULT_SCHEDULE_ANALYSIS_CONFIG) as any};
}
test('Batch B/C: added duplicate source rows retain both records and reconcile separately from distinct activity identities',()=>{
  const x=comparison([activity('A')],[activity('A'),activity('NEW-DUP','10'),activity('NEW-DUP','20')]);
  assert.equal(x.projection.toActivityCount,3);
  assert.equal(x.projection.matchedActivityCount,1);
  assert.equal(x.projection.addedActivityCount,2,'both supplied rows must remain visible');
  assert.deepEqual(x.projection.ambiguousToActivityIds,['NEW-DUP'],'duplicate identity remains a source qualification');
  const checks=x.checked.data.systemEvidenceContract.checks;
  assert.ok(checks.every((r:any)=>r.passed),JSON.stringify(checks.filter((r:any)=>!r.passed)));
  assert.ok(checks.some((r:any)=>r.metric==='current_source_row_partition'&&r.actual===3&&r.passed));
});
test('Batch B/C: ordinary matched and added activity populations keep their strict arithmetic checks',()=>{
  const x=comparison([activity('A')],[activity('A'),activity('B')]);
  assert.equal(x.projection.addedActivityCount,1);
  assert.ok(x.checked.data.systemEvidenceContract.checks.every((r:any)=>r.passed));
});
test('Batch B/C: removing or inventing an added row still fails certification',()=>{
  const x=comparison([activity('A')],[activity('A'),activity('NEW-DUP','10'),activity('NEW-DUP','20')]);
  for(const mutate of [
    (p:any)=>{p.addedActivityCount=1;p.changedActivities.pop();},
    (p:any)=>{p.changedActivities[0].activityId='INVENTED';},
    (p:any)=>{p.matchedActivityCount=2;p.unchangedActivityCount=2;},
  ]){
    const changed=structuredClone(x.result);mutate(changed.data);
    const checked:any=checkProjectionIntegrity(changed,x.to,DEFAULT_SCHEDULE_ANALYSIS_CONFIG);
    assert.equal(checked.data.systemEvidenceContract.state,'failed','wrong arithmetic/membership must not be hidden');
  }
});
