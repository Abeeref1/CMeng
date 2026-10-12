import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {projectDiagnosisScript} from '../packages/runtime-api/src/ui-project-diagnosis';
import {experienceScript} from '../packages/runtime-api/src/ui-experience';

const plain=(value:unknown)=>String(value??'');
const ctx={
 fmt:(n:unknown)=>typeof n==='number'?new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n):plain(n),
 escapeHtml:plain,
 planningShortDate:(v:unknown)=>v?String(v).slice(0,10):'Not established',
 planningKpis:(rows:any[])=>'<div class="kpis">'+rows.map(row=>'<div><b>'+plain(row[0])+':</b> '+plain(row[1])+' <small>'+plain(row[2]||'')+'</small></div>').join('')+'</div>',
 readerReference:(id:unknown)=>String(id)==='C02'?'C02_Amendment_01.pdf':plain(id),
 readerText:plain,
 renderCompletionPosition:()=>'<div id="full-completion-evidence">Original completion evidence retained</div>',
 managementModuleLink:(key:string,label:string)=>'<a data-module="'+key+'">'+label+'</a>'
};
function fixture(){
 const d:any={
  projectId:'ABB-100',dataDateIso:'2026-09-30',executionActivityCount:9500,criticalityBasis:'source_total_float',criticalityBasisLabel:'Submitted source float',
  network:{state:'unavailable'},completion:{independentFinishIso:null,submittedFinishIso:'2029-01-02',contractualFinishIso:'2029-03-01'},
  counts:{critical:{value:3974,knownCount:3974},negativeFloat:{value:3922,knownCount:3922},nearCritical:{value:null,knownCount:null}},
  summary:'Submitted float pressure; independent finish-driving network is unavailable.',
  wbsRows:[{wbs:'TITAN / Biologics / Package 05',pressureCount:56,drivingCount:0,criticalCount:38,negativeFloatCount:38,worstFloatHours:-730}],
  milestoneRows:[],
  revision:{state:'available',modified:8506,added:300,removed:1,finishMovementCalendarDays:1},
  actionRegister:{total:11,actions:[
   {actionId:'team-procurement',recordKey:'procurement|P01',issue:'Procurement packages requiring attention (898 records)',consequence:'Required deliveries need recovery.',requiredAction:'Obtain revised vendor dates.',owner:'Procurement Manager',dueIso:'2025-12-11'},
   {actionId:'team-planning',recordKey:'schedule|X01',issue:'Programme activities under pressure (4094 records)',consequence:'Unverified dependencies may affect work.',owner:'Planning Manager',dueIso:'2025-12-20'},
   {actionId:'team-design',recordKey:'rfi|R01',issue:'Design records requiring attention (61 records)',consequence:'Overdue design clarification.',owner:'Design Manager'},
   {actionId:'review-notice',recordKey:'review|matter:notice-term-versions',issue:'Confirm claim notice period',owner:'Contracts Manager'},
   {actionId:'team-quality',recordKey:'ncr|N01',issue:'Quality records requiring attention',owner:'Quality Manager'}
  ]}
 };
 const data:any={progress:{durationWeightedProgressPercent:24.48},projectFacts:{
  time:{
   contractualCompletionIso:{value:'2029-03-01',complete:true},
   awardedEotDays:{value:null},
   extendedContractCompletionIso:{value:null,complete:false},
   submittedDaysAfterOriginalCompletion:{value:-58},
   submittedDaysAfterExtendedCompletion:{value:null},
   amendmentEotStatements:[{documentId:'C02',statement:'Amendment states: "Extension of Time 60 calendar days"',basis:'Extracted contract wording'}]
  },
  schedule:{submittedProgrammeCompletionIso:{value:'2029-01-02'}}
 }};
 return {d,data};
}
function rendered(d:any,data:any){
 return runInNewContext(projectDiagnosisScript+'\nrenderProjectBrief(d,data)',{...ctx,d,data}) as string;
}
test('Management Brief states original-date headroom without claiming a governing extended deadline',()=>{
 const {d,data}=fixture(),before=JSON.stringify({d,data});
 const html=rendered(d,data);
 assert.match(html,/58 calendar days before the original contractual completion/);
 assert.match(html,/2029-03-01/);
 assert.match(html,/2029-01-02/);
 assert.match(html,/60 calendar days/);
 assert.match(html,/Not independently established from the determination evidence/);
 assert.match(html,/The governing completion date after extension is not established/);
 assert.match(html,/No contractual lateness figure can be concluded/);
 assert.equal(JSON.stringify({d,data}),before,'presenting the brief must not mutate any source values');
});
test('When independent CPM fails, source pressure is shown but zero is not passed off as a driving-network result',()=>{
 const {d,data}=fixture();
 const html=rendered(d,data);
 assert.match(html,/3,974 reported/);
 assert.match(html,/3,922 reported/);
 assert.match(html,/24.48%/);
 assert.match(html,/independent finish-driving path/);
 assert.match(html,/Confirmed driving activities/);
 assert.match(html,/Not established/);
 assert.doesNotMatch(html,/<td>0<\/td><\/tr>/,'unavailable driving network must not be shown as a verified zero');
 assert.match(html,/Milestone exposure cannot be cleared or ranked/);
 assert.match(html,/8,506 activities changed/);
 assert.match(html,/300 were added/);
 assert.match(html,/Full completion calculations and evidence qualifications/);
 assert.match(html,/full-completion-evidence/,'the complete evidence remains available on this same page');
});
test('Manager gets decisions separately from a short, accountable team follow-up summary',()=>{
 const {d,data}=fixture();
 const html=rendered(d,data);
 assert.match(html,/Open Project Review/);
 assert.match(html,/data-module="cross-domain-accountability"/);
 assert.match(html,/Highest-ranked delegated follow-ups/);
 assert.match(html,/1 other ranked groups/); // four team groups with three shown leaves one
 assert.doesNotMatch(html,/same ranking as Command Center|11 project actions/);
 assert.equal((html.match(/Earliest reported due/g)||[]).length,2);
});
test('Verified contract adjustment and available CPM are distinguished from qualified source warnings',()=>{
 const {d,data}=fixture();
 d.network.state='calculated';
 d.completion.independentFinishIso='2029-01-15';
 d.criticalityBasis='independent_cpm';
 data.projectFacts.time.awardedEotDays.value=60;
 data.projectFacts.time.extendedContractCompletionIso={value:'2029-04-30',complete:true};
 data.projectFacts.time.submittedDaysAfterExtendedCompletion={value:-118};
 const html=rendered(d,data);
 assert.match(html,/2029-04-30/);
 assert.match(html,/60 days in the dated determination basis/);
 assert.match(html,/Against the independently established adjusted contract date/);
 assert.match(html,/calendar days early/);
 assert.match(html,/CMeng has a reconciled independent finish calculation/);
 assert.doesNotMatch(html,/Milestone exposure cannot be cleared or ranked/);
});
test('Role lenses retain the same management brief instead of replacing it with unrelated detailed analysis',()=>{
 assert.match(experienceScript,/key==='pmo-analysis'\?\(role==='overall'\?analysis:roleContext\+analysis\)/);
 assert.match(experienceScript,/key==='pmo-analysis'\?'':experienceManagementReading\(key,brief\)/);
});
