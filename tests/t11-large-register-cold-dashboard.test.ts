import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import {createCmengServer} from '../packages/runtime-api/src/server';
import {partitionAsOf,reportingScope} from '../packages/truth-kernel/src';
import {assessAllEventNotices,assessEventNotice,eventFromEventSource,delayEventPopulation,
 type CanonicalClaimRecord,type CanonicalDelayEvent,type CanonicalNoticeRecord,type DelayClaimsModel,type NoticeKind} from '../packages/delay-analysis-core/src';
import {delayClaimsAsOf,reportedClaimSummary} from '../packages/delay-analysis-core/src/reporting';

// T11 / owner requirement: the first (cold) Dashboard of a project with large
// registers opens within 10 seconds. Before this repair the F61 adversarial
// project (8,900 activities, 38,000 register rows) took about 38 to 46 s on
// the CI runner: every delay event re-read the whole notice register (and
// re-dated every notice), every claim re-scanned it, identical findings were
// re-copied once per finding, and per-row lookups scanned whole registers.
const OWNER_COLD_DASHBOARD_LIMIT_MS=10_000;

// ---- Shared delay notice reading: same answer as reading every notice per row.
const day=(offset:number)=>new Date(Date.UTC(2031,4,1)+offset*86400000).toISOString().slice(0,10);
function generator(seed:number){let s=seed>>>0;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function delayModel(seed:number,size:number):DelayClaimsModel{
 const r=generator(seed),pick=<T>(values:readonly T[])=>values[Math.floor(r()*values.length)]!;
 const kinds:NoticeKind[]=['notice','early_warning','eot_notice','claim_notice','detailed_claim','response','determination'];
 const maybeDate=()=>{const x=r();return x<0.15?null:x<0.2?'not a date':x<0.25?day(Math.floor(r()*40))+'T10:30:00Z':day(Math.floor(r()*200)-150);};
 const events:CanonicalDelayEvent[]=Array.from({length:size},(_,i)=>({eventId:'E'+i,title:'Event '+i,category:pick(['change','weather','design','other'] as const),
  startIso:r()<0.4?null:day(Math.floor(r()*200)-160),...(r()<0.3?{awarenessIso:r()<0.5?null:day(Math.floor(r()*200)-160)}:{}),endIso:r()<0.5?null:day(Math.floor(r()*200)-100),
  responsibility:'unknown',responsibilityState:'missing',describedImpactDays:null,describedImpactState:'missing',relatedActivityIds:[],relatedClauseIdentifiers:[],evidenceRefs:[],diagnostics:[],
  ...(r()<0.7?{identitySource:pick(['event_register','notice','claims_register_row'] as const)}:{})}));
 // Repeated event ids model registers that cite the same event twice.
 if(size>3)events.push({...events[1]!,title:'Repeated id'});
 const notices:CanonicalNoticeRecord[]=Array.from({length:size*2},(_,i)=>({noticeId:'N'+i,kind:pick(kinds),eventId:r()<0.15?null:'E'+Math.floor(r()*(size+5)),
  claimId:r()<0.3?null:'C'+Math.floor(r()*(size+5)),actualIssuedAt:maybeDate(),actualReceivedAt:null,plannedAt:null,subject:null,clauseIdentifiers:[],evidenceRefs:[],diagnostics:[]}));
 const claims:CanonicalClaimRecord[]=Array.from({length:size},(_,i)=>({claimId:'C'+i,title:'Claim '+i,state:pick(['submitted','under_review','draft'] as const),eventIds:['E'+i],
  submittedAt:r()<0.5?null:day(Math.floor(r()*200)-150),assessedAt:r()<0.7?null:day(Math.floor(r()*200)-150),claimedDays:r()<0.2?null:Math.floor(r()*30),claimedAmount:null,
  assessedDays:r()<0.5?null:5,assessedDaysState:pick(['official','missing'] as const),assessedAmount:null,assessedAmountState:'missing',clauseIdentifiers:[],evidenceRefs:[],diagnostics:[]}));
 return {projectId:'P',evidenceRevisionId:'REV',dataDateIso:r()<0.1?null:day(0),events,notices,claims,diagnostics:r()<0.2?['DELAY_EVENTS_GOVERNED_FROM_CLAIMS_REGISTER_FIELDS']:[],
  noticeRequirements:[{requirementId:'R1',noticeKind:'notice',eventCategories:[],noticePeriodDays:28,triggerBasis:pick(['event_start','awareness'] as const),state:'official',clauseIdentifiers:['20.1'],evidenceRefs:[]}]};
}
/** The notice readings as they stood before the T11 grouping, kept as the reference. */
function referenceEventNotices(model:DelayClaimsModel){
 return model.events.map(event=>assessEventNotice(eventFromEventSource(event,model)?event:{...event,startIso:null,awarenessIso:null,endIso:null},
  model.dataDateIso?model.notices.filter(n=>reportingScope(n.actualIssuedAt,model.dataDateIso)==='as_of'):model.notices,model.noticeRequirements));
}
function referenceClaimsAsOf(source:DelayClaimsModel,dataDateIso:string|null){
 const earliest=(dates:Array<string|null|undefined>)=>dates.filter((v):v is string=>!!v).sort()[0]??null;
 const notices=partitionAsOf(source.notices,{name:'Notices issued by Data Date',entity:'notice',dataDateIso,dateBasis:'actualIssuedAt',sourceRevisionId:source.evidenceRevisionId,id:r=>r.noticeId,date:r=>r.actualIssuedAt});
 const eventPartition=(rows:DelayClaimsModel['events'])=>partitionAsOf(rows,{name:'Delay events evidenced by Data Date',entity:'delay_event',dataDateIso,
  dateBasis:'event start; otherwise earliest linked actual notice (existence only)',sourceRevisionId:source.evidenceRevisionId,id:r=>r.eventId,
  date:r=>r.startIso??earliest(source.notices.filter(n=>n.eventId===r.eventId).map(n=>n.actualIssuedAt))});
 const eventPopulation=delayEventPopulation(source);
 const allEvents=eventPartition(source.events);
 const events=eventPartition(source.events.filter((_,index)=>eventPopulation.fromEventSource[index]));
 const claims=partitionAsOf(source.claims,{name:'Claim identities evidenced by Data Date',entity:'claim',dataDateIso,
  dateBasis:'earliest submission or linked actual notice; not a determination date',sourceRevisionId:source.evidenceRevisionId,id:r=>r.claimId,
  date:r=>earliest([r.submittedAt,...source.notices.filter(n=>n.claimId===r.claimId&&n.kind!=='determination').map(n=>n.actualIssuedAt)])});
 return {allEvents,events,claims,notices,reported:reportedClaimSummary(claims.asOf),current:allEvents.asOf.map(r=>r.eventId)};
}

test('T11 event notice timing reads each event\'s own notices: same assessment as reading every notice per event',()=>{
 for(let seed=1;seed<=60;seed++){
  const model=delayModel(seed,40+seed*3);
  assert.deepEqual(assessAllEventNotices(model),referenceEventNotices(model),'seed '+seed);
 }
});

test('T11 claim and event Data Date populations read each record\'s own notices: same partitions as a full scan per row',()=>{
 for(let seed=1;seed<=60;seed++){
  const model=delayModel(1000+seed,40+seed*3),date=model.dataDateIso??null;
  const actual=delayClaimsAsOf(model,date),expected=referenceClaimsAsOf(model,date);
  assert.deepEqual(actual.events,expected.events,'events seed '+seed);
  assert.deepEqual(actual.claims,expected.claims,'claims seed '+seed);
  assert.deepEqual(actual.notices,expected.notices,'notices seed '+seed);
  assert.deepEqual(actual.reported,expected.reported,'reported seed '+seed);
  assert.deepEqual(actual.current.events.map(e=>e.eventId),expected.current,'current events seed '+seed);
 }
});

test('T11 12,000 events, 24,000 notices and 12,000 claims are read in linear time',()=>{
 const model=delayModel(7,12_000),started=performance.now();
 const assessments=assessAllEventNotices(model),reporting=delayClaimsAsOf(model,model.dataDateIso??null);
 const ms=performance.now()-started;
 console.log('T11 delay notice reading at 12,000 events / 24,000 notices / 12,000 claims: '+ms.toFixed(0)+' ms');
 assert.equal(assessments.length,model.events.length);
 assert.equal(reporting.claims.population.sourceCount,12_000);
 // Before the repair this re-read 24,000 notices for each of 12,000 events (and
 // again per claim): hundreds of millions of date readings, minutes of CPU.
 assert.ok(ms<5_000,'delay notice reading took '+ms.toFixed(0)+' ms');
});

// ---- The owner requirement on the F61 adversarial project, through the real upload path.
const N=8900,DATA_DATE='2031-05-01';
const csv=(headers:string[],rows:string[][])=>Buffer.from([headers,...rows].map(row=>row.join(',')).join('\r\n'));
const registers:Array<{file:string;headers:string[];rows:(i:number)=>string[];count:number}>=[
 {file:'rfi_register.csv',headers:['RFI ID','Subject','Status','Raised Date','Due Date','Response Date','Owner','Linked Activity'],count:6000,
  rows:i=>['RFI-'+i,'Design clarification '+i,i%3?'Open':'Answered',day(-60+i%50),day(-20+i%40),i%3?'':day(-5),'Design Engineer '+(i%3000),'A'+(i*7%N)]},
 {file:'ncr_register.csv',headers:['NCR ID','Description','Owner','Closed Date','Status'],count:3000,
  rows:i=>['NCR-'+i,'Quality issue '+i,'QA Inspector '+(i%1500),i%4?'':day(-3),i%4?'Open':'Closed']},
 {file:'risk_register.csv',headers:['Risk ID','Description','Owner','Due Date','Status'],count:3000,
  rows:i=>['RSK-'+i,'Delivery risk '+i,'Risk Owner '+(i%1500),day(-30+i%90),i%5?'Open':'Closed']},
 {file:'variation_register.csv',headers:['Variation ID','Description','Approved Amount','Period End','Status','Currency'],count:3000,
  rows:i=>['VO-'+i,'Scope change '+i,String(1000+i),day(-200+i%180),i%3===0?'Approved':i%3===1?'Pending':'Rejected','SAR']},
 {file:'claim_register.csv',headers:['Claim ID','Event','Days Claimed','Notice Date','Status'],count:8000,
  rows:i=>['CLM-'+i,'Delay event '+i,String(1+i%30),i%6?day(-100+i%90):'',i%2?'Submitted':'Under Review']},
 {file:'procurement_register.csv',headers:['Package ID','Description','Required On Site','Forecast Delivery','Status','Linked Activity'],count:2000,
  rows:i=>['PKG-'+i,'Equipment package '+i,day(10+i%120),day(20+i%150),i%2?'Ordered':'Not Ordered','A'+(i*11%N)]},
 {file:'submittal_register.csv',headers:['Submittal ID','Submitted Date','Approval Date','Status','Procurement Package','Linked Activity'],count:2000,
  rows:i=>['SUB-'+i,day(-40+i%30),i%3?'':day(-2),i%3?'Under Review':'Approved','PKG-'+(i%2000),'A'+(i*13%N)]},
 {file:'interface_register.csv',headers:['Interface ID','Giving Party','Receiving Party','Required Deliverable','Status','Linked Activity'],count:2000,
  rows:i=>['IF-'+i,'Contractor '+(i%90),'Designer '+(i%70),'Approved drawing '+i,i%2?'Open':'Closed','A'+(i*17%N)]},
 {file:'payment_register.csv',headers:['Certificate No','Period End','Net Certified','Paid Amount','Retention','Currency','Status'],count:300,
  rows:i=>['IPC-'+i,day(-900+i*3),String(50000+i),i%4?String(50000+i):'','2500','SAR',i%4?'Paid':'Certified']},
];
async function largeRegisterProject(){
 const state=runtimeProjects.getOrCreate('T11-REG-'+randomUUID().slice(0,8).toUpperCase()),id=state.projectId;
 const activities=Array.from({length:N},(_,i)=>({projectId:id,activityId:'A'+i,nativeId:String(i),name:'Installation Zone '+Math.floor(i/100)+' item '+i,wbsId:'W'+Math.floor(i/100),calendarId:'C',activityType:'task',
  status:i%7===0?'in_progress':'not_started',baselineStartIso:day(-120),baselineFinishIso:day(-10+i%60),currentStartIso:i%7===0?day(-30):day(5),currentFinishIso:day(30+i%200),
  actualStartIso:i%7===0?day(-30):null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:240,remainingDurationHours:240,
  totalFloatHours:i%11===0?-48:i%13,freeFloatHours:null,percentComplete:i%7===0?20:0,
  sourceConstraints:i%4===0?[{type:i%8===0?'mandatory_finish':'start_on',dateIso:day(15+i%30)}]:[],sourceRefs:[],diagnostics:[]}));
 const relationships:any[]=[];
 for(let i=1;i<N;i++)if(i%3&&(i-1)%5)relationships.push({relationshipId:'R'+i,predecessorActivityId:'A'+(i-1),successorActivityId:'A'+i,type:'FS',lagHours:i%2?-16:24,sourceRefs:[],diagnostics:[]});
 const wbs=Array.from({length:89},(_,i)=>({wbsId:'W'+i,name:'Area '+i,parentWbsId:null,sourceRefs:[]}));
 for(let r=0;r<3;r++){
  const revisionId='T11-REV-'+r,model={projectId:id,source:'xer',sourceRevisionId:revisionId,dataDateIso:r===2?DATA_DATE:day(-30*(2-r)),activities:activities.map(a=>({...a,currentFinishIso:day(30+(a.nativeId as any)%200+r)})),relationships,wbs,calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[]};
  state.schedules.push({role:r?'update':'baseline',format:'xer',sourceFilename:revisionId+'.xer',sourceHashSha256:revisionId,uploadedAt:model.dataDateIso,revision:{revisionId,label:revisionId,sequence:r+1,effectiveAt:model.dataDateIso,model}} as any);
 }
 (state as any).testProject=true;runtimeProjects.touch(state);
 for(const register of registers){
  await runtimeProjects.ingestEvidenceFile({projectId:id,sourceFilename:register.file,sourceRelativePath:register.file,mediaType:'text/csv',
   bytes:csv(register.headers,Array.from({length:register.count},(_,i)=>register.rows(i))),uploadedAt:DATA_DATE+'T00:00:00.000Z',uploadIntent:'add_update'});
 }
 await runtimeProjects.refreshSpreadsheetRegisters(id);
 return id;
}

test('T11 owner requirement: cold Dashboard within 10 s at 8,900 activities and 38,300 register rows',async t=>{
 const id=await largeRegisterProject();
 const server=createCmengServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const url='http://127.0.0.1:'+(server.address() as any).port+'/api/projects/'+encodeURIComponent(id)+'/management/master-dashboard';
 const started=performance.now(),response=await fetch(url),text=await response.text(),cold=performance.now()-started;
 const warmStarted=performance.now(),warm=await fetch(url);await warm.text();const warmMs=performance.now()-warmStarted;
 console.log('T11 large-register cold Dashboard: '+cold.toFixed(0)+' ms, warm '+warmMs.toFixed(0)+' ms, '+Buffer.byteLength(text)+' bytes');
 assert.equal(response.status,200,text.slice(0,300));
 assert.equal(warm.status,200);
 const body=JSON.parse(text);
 assert.equal(body.key,'master-dashboard');
 assert.ok(cold<OWNER_COLD_DASHBOARD_LIMIT_MS,'cold Dashboard took '+cold.toFixed(0)+' ms (owner limit '+OWNER_COLD_DASHBOARD_LIMIT_MS+' ms)');
});
