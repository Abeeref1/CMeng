import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {completionPosition} from '../packages/runtime-api/src/completion-position';
import {positionVerdict} from '../packages/runtime-api/src/position-review';
import {projectActions} from '../packages/runtime-api/src/project-actions';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {summarizeControlIssues,type ControlIssue} from '../packages/truth-kernel/src';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {moduleRegistry} from '../packages/runtime-api/src/registry';
import {answerFirstScript} from '../packages/runtime-api/src/ui-answer-first';
import {projectActionsScript} from '../packages/runtime-api/src/ui-project-actions';

const issue=(module:string,path='data.contractualCompletionIso'):ControlIssue=>({code:'MISSING_SOURCE_VALUE',kind:'missing_information',summary:'Missing contractual completion date',detail:'Confirm the applicable contractual completion date.',action:'Confirm the contract completion date.',owner:'Project evidence owner',moduleKeys:[module],sourceRefs:[],checkIds:[],evidencePaths:[path]});
const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
const functions=(names:string[])=>source.statements.filter(isFunctionDeclaration).filter(n=>n.name&&names.includes(n.name.text)).map(n=>n.getText(source)).join('\n');

test('completion distinguishes an available scenario from missing contract and unrelated quantities, preserving exact fractional difference',()=>{
 const forecast={sourceForecastCompletionIso:'2030-01-12T14:00:00',independentForecastCompletionIso:'2030-01-13T08:12:00.000Z',forecastVarianceDays:.758333,complete:true,origin:'scenario_with_assumptions',calculatedActivityCount:100,activityCoveragePercent:100,assumptions:['SOURCE_CONSTRAINTS_RETAINED_NOT_APPLIED_TO_UNCONSTRAINED_NETWORK:2'],activities:[{activityId:'A',sourceFinishIso:'2030-01-12',independentEarlyFinishIso:'2030-01-13',finishVarianceDays:1}]};
 const p=completionPosition({quantities:{state:'missing'},sourceProductivityForecast:{state:'missing'}},forecast,new Map([['A','Foundation work']]));
 assert.equal(p.independentFinishIso,forecast.independentForecastCompletionIso);assert.equal(p.differenceElapsedDays,.758333);assert.equal(p.contractualFinishIso,null);assert.equal(p.calculationState,'scenario');assert.equal(p.differenceRows[0]?.name,'Foundation work');assert.match(p.contractNote,/does not prevent programme forecasting/);
 const confirmed=completionPosition({contractualCompletionIso:'2030-02-01',quantities:{state:'established'}},forecast);
 assert.equal(confirmed.independentFinishIso,p.independentFinishIso);assert.equal(confirmed.differenceElapsedDays,p.differenceElapsedDays);assert.equal(confirmed.contractualFinishIso,'2030-02-01');
 const incomplete=completionPosition({}, {...forecast,complete:false});assert.equal(incomplete.independentFinishIso,null);assert.equal(incomplete.submittedFinishIso,forecast.sourceForecastCompletionIso);assert.equal(incomplete.differenceElapsedDays,null);
});

test('one missing contract date across six pages is one coverage matter with all findings retained',()=>{
 const state=runtimeProjects.getOrCreate('UX-GROUPS');const findings=['pmo-analysis','milestones','independent-forecast','eot-assessment','master-dashboard','contract-particulars-bonds'].map(k=>issue(k));
 const result=projectActions(state,summarizeControlIssues(findings));
 const matter=result.actions.find(a=>a.id==='matter:contract-completion')!;assert.equal(matter.requestCount,1);assert.equal(matter.findings?.length,1);assert.equal(matter.affectedPages?.length,6);assert.equal(matter.target.type,'inline');assert.equal(matter.target.kind,'contract-completion');
 assert.ok(!result.information.some(a=>a.id==='matter:contract-completion'),'missing contractual completion is one direct confirmation action, not passive information or six page jobs');
 assert.equal(result.actionCount,result.actions.length);assert.ok(!JSON.stringify(result).includes('Open relevant page'));
 const isolated=projectActions(runtimeProjects.getOrCreate('UX-OTHER'),summarizeControlIssues([]));assert.ok(!JSON.stringify(isolated).includes('contract-completion'));
 const baseline=projectActions(state,summarizeControlIssues([{...issue('schedule-analytics','data.result.completionBases[basis=programme]'),summary:'Programme completion basis missing',detail:'The source completion basis is unavailable.'}]));
 assert.ok(baseline.information.some(a=>a.id==='matter:programme-comparison'));
 const conflict=projectActions(state,summarizeControlIssues([{...issue('delivery-risks','risk.reportingDate'),summary:'Risk reporting date missing'}, {...issue('delivery-risks','risk.rating'),kind:'source_conflict',summary:'Risk ratings disagree',detail:'The supplied register has conflicting ratings.'}]));
 assert.ok(conflict.actions.some(a=>a.id==='matter:risks'),'a genuine record conflict remains actionable even without a specifically typed risk document');
});

test('Management Brief cannot promote an unrelated first finding into its answer',()=>{
 const findings=summarizeControlIssues([{...issue('pmo-analysis','data.quantities'),summary:'Quantities missing'}]);
 const verdict=positionVerdict({key:'pmo-analysis',status:'partial',reason:null,dependencies:[],data:{forecast:{sourceCompletionIso:'2030-01-12'}},issueAssessment:findings});
 assert.doesNotMatch(verdict.text,/Quantities missing/);assert.equal(verdict.specific,false);
});

test('every analytical page renders its available answer before review and source administration',()=>{
 new Function(script);
 for(const descriptor of moduleRegistry.filter(m=>m.area!=='delivery'&&m.key!=='source-quality'&&m.key!=='challenge-contract')){
  const nodes=new Map<string,any>();const el=(id:string)=>{if(!nodes.has(id))nodes.set(id,{style:{},classList:{remove(){}},innerHTML:''});return nodes.get(id);};
  const ctx:any={el,names:{[descriptor.key]:descriptor.title},descriptions:{},managementSurfaceKeysForApi:new Set(['master-dashboard','command-center','master-control-programme']),selectedRoleView:'overall',roleViews:{overall:{label:'Overall'}},appView:'project',renderRoleViewSelector(){},renderDelivery:()=>false,renderPositionVerdict:()=>'<p>ADMINISTRATION</p>',renderModuleBasis:()=>'<div class="module-basis">REPORTING-DATE</div>',renderRegisterScope:()=>'<p>POPULATION-DETAIL</p>',renderUniversalChallenge:()=>'',renderSpecializedModule:()=>'<section>PROJECT-ANSWER</section>',scalarPairs:()=>[],renderStructuredSections:()=>'',renderBasisReviews:()=>'<p>SOURCE-REVIEW</p>',findProjectionRoot:(d:any)=>d,renderClaimsReporting:()=>'',renderRoleContent:(_k:any,_d:any,v:string)=>v,experienceDisclosure:(_t:string,b:string)=>'<details>'+b+'</details>',experienceReviewSummary:()=>'',renderModuleReadiness:()=>'',userFacingModuleReason:()=>'',escapeHtml:String,formatDocumentTime:String};
  runInNewContext(functions(['renderModuleResultBody']),ctx);ctx.renderModuleResultBody({key:descriptor.key,status:'partial',data:{}});
  const html=el('moduleContent').innerHTML;assert.ok(html.indexOf('PROJECT-ANSWER')>=0,descriptor.key);assert.ok(html.indexOf('PROJECT-ANSWER')<html.indexOf('ADMINISTRATION'),descriptor.key);assert.ok(html.indexOf('PROJECT-ANSWER')<html.indexOf('SOURCE-REVIEW'),descriptor.key);
 }
});

test('completion calculation differences stay as inline information and never become user actions',async()=>{
 const values=completionPosition({}, {sourceForecastCompletionIso:'2030-01-12',independentForecastCompletionIso:'2030-01-13',complete:true,origin:'deterministic_source_calendar',forecastVarianceDays:1,assumptions:[]});
 const ctx:any={fmt:String,escapeHtml:String,planningShortDate:String,planningKpis:(rows:any[])=>rows.map(r=>r.join(' ')).join('\n'),basisTable:()=>'',project:()=> 'UX',overview:{},projectRequestSeq:1,projectRequestIsCurrent:()=>true,formatDocumentTime:String,names:{},readerIssue:(i:any)=>({title:i.summary,action:i.action}),el:()=>null,api:async()=>({projectId:'UX',projectVersion:1,checkedAt:'2030-01-01',actionCount:0,actions:[],information:[{id:'matter:schedule-calculation',title:'Programme calculation and date differences',reason:'The submitted and calculated positions differ.',category:'information',resolution:{kind:'information',requiresUserAction:false,instruction:'No user action is required.',completionRule:'Updates automatically.'},target:{type:'inline',label:'Why this is not an action'},completionPosition:values,findings:[]}]})};
 runInNewContext(answerFirstScript+'\n'+projectActionsScript,ctx);await ctx.loadProjectActions();const html=ctx.renderProjectActionList();
 assert.match(html,/Additional information/);assert.match(html,/2030-01-12/);assert.match(html,/2030-01-13/);
 assert.match(html,/0 actions require your input/);assert.doesNotMatch(html,/Review difference|data-resolve-|Open relevant page/);
});


test('Actions required completes schedule confirmation, document choice, upload and population confirmation inline',async()=>{
 const calls:any[]=[],messages:Record<string,{textContent:string}>={},file={name:'evidence.pdf',webkitRelativePath:''};
 const control=(id:string,selector:string)=>{
  if(selector==='.action-inline-message')return messages[id]??=( {textContent:''} );
  if(id==='document'&&selector==='.action-document-kind')return {value:'new_record'};
  if(id==='document'&&selector==='.action-document-target')return {value:''};
  if(id==='upload'&&selector==='.action-upload-file')return {files:[file]};
  return null;
 };
 const nodes:Record<string,any>={};
 for(const id of ['schedule','document','upload','population'])nodes[id]={querySelector:(s:string)=>control(id,s),querySelectorAll:()=>[]};
 const document={querySelector:(selector:string)=>{const match=/data-action-id="([^"]+)"/.exec(selector);return match?nodes[match[1]!]:null;}};
 let refreshes=0;
 const ctx:any={document,CSS:{escape:String},fmt:String,escapeHtml:String,planningShortDate:String,planningKpis:()=>'',basisTable:()=>'',project:()=> 'UX-INLINE',overview:{},projectRequestSeq:1,projectRequestIsCurrent:()=>true,formatDocumentTime:String,names:{},readerIssue:(i:any)=>({title:i.summary,action:i.action}),el:()=>null,fileType:()=> 'application/pdf',refresh:async()=>{refreshes++;},api:async(path:string,options:any)=>{calls.push({path,options});return {}},encodeURIComponent};
 ctx.seed={projectId:'UX-INLINE',status:'ready',data:{projectVersion:7,actions:[
  {id:'schedule',target:{type:'schedule',needsPurpose:false},category:'confirmation'},
  {id:'document',target:{type:'document',documentId:'DOC-1',sourceHash:'hash',relationshipOptions:[],relationshipTargets:[]},category:'confirmation'},
  {id:'upload',target:{type:'upload',uploadMode:'evidence'},category:'review'},
  {id:'population',target:{type:'delivery',population:true,kind:'risk'},category:'confirmation'}
 ]}};
 runInNewContext(projectActionsScript+'\nprojectActionState=seed;',ctx);
 await ctx.resolveScheduleAction('schedule');await ctx.resolveDocumentAction('document');await ctx.resolveUploadAction('upload');await ctx.resolvePopulationAction('population');
 assert.deepEqual(calls.map((c:any)=>c.path),[
  '/api/projects/UX-INLINE/actions/confirm-schedule',
  '/api/projects/UX-INLINE/evidence/documents/DOC-1/relationship',
  '/api/projects/UX-INLINE/evidence/uploads',
  '/api/projects/UX-INLINE/delivery/records'
 ]);
 assert.equal(JSON.parse(calls[0].options.body).expectedVersion,7);
 assert.equal(JSON.parse(calls[1].options.body).kind,'new_record');
 assert.equal(calls[2].options.body,file);assert.equal(calls[2].options.headers['x-rerun-after-upload'],'true');
 assert.equal(JSON.parse(calls[3].options.body).action,'confirm_population');
 assert.equal(refreshes,4);
 assert.ok(Object.values(messages).every(m=>!m.textContent.includes('Open')));
});

test('a fresh adopted schedule with no quantities or contract still publishes its management and forecast position',async()=>{
 const id='UX-SCHEDULE-ONLY',calendar='(0||CalendarData()((0||DaysOfWeek()('+[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()((0||0(s|08:00|f|16:00)())))').join('')+'))))';
 const xer=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tUX\t2030-01-01 08:00','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\t1\tEight hour calendar\t8\t56\t'+calendar,'%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttask_type\tstatus_code\tclndr_id\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tearly_start_date\tearly_end_date','%R\t1\t1\tA\tFoundation work\tTT_Task\tTK_NotStart\t1\t16\t16\t0\t2030-01-01 08:00\t2030-01-02 16:00','%E'].join('\n');
 await runtimeProjects.ingestSchedule({projectId:id,sourceFilename:'arbitrary-name.xer',bytes:Buffer.from(xer),mediaType:'text/plain',uploadedAt:'2030-01-01',role:'update',uploadIntent:'replace_current_basis'});
 const pmo:any=moduleForProject(id,'pmo-analysis').data,forecast:any=moduleForProject(id,'independent-forecast').data;
 assert.equal(pmo.completionPosition.submittedFinishIso,'2030-01-02T16:00:00');assert.equal(pmo.completionPosition.independentFinishIso,'2030-01-02T16:00:00.000Z');assert.deepEqual(pmo.completionPosition,forecast.completionPosition);assert.equal(pmo.completionPosition.contractualFinishIso,null);assert.equal(pmo.knownScheduleCounts.critical,1);assert.doesNotMatch(pmo.positionVerdict.text,/quantit/i);
});

test('native schedule table labels and IDs do not become narrative KPI assertions',async()=>{
 const {extractDocumentAssertions}=await import('../packages/module-challenge/src');
 const raw='ERMHDR\t23.12\n%T\tPROJWBS\n%F\twbs_id\twbs_name\n%R\t550408\tMilestones 550408\n%T\tTASK\n%F\ttask_id\ttask_name\n%R\t1\tcritical activities 99999';
 assert.deepEqual(extractDocumentAssertions(raw,'renamed-source.dat'),[]);
 assert.ok(extractDocumentAssertions('Critical activities: 12','review-report.txt').some(a=>a.value===12),'a genuine report assertion remains reviewable');
 const state=runtimeProjects.get('UX-SCHEDULE-ONLY')!;
 const document=state.evidenceDocuments.find(d=>d.category==='schedule')!;
 document.assertions=extractDocumentAssertions('Critical activities: 99999\nCritical activities: 55555','evidence:old-native-import');state.version++;
 const assessment=moduleForProject(state.projectId,'schedule-analytics').issueAssessment;
 assert.ok(!assessment?.issues.some(i=>i.code==='COMPARABLE_SOURCE_CONFLICT'),'historical raw-table matches are retained but not treated as a source KPI');
 assert.equal(document.assertions.length,2,'original extraction history is not deleted');
});
