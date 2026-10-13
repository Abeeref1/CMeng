import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runInNewContext} from 'node:vm';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {recoveryProgrammeBasis,recoveryScenarioInput,recoveryScenarioForState} from '../packages/runtime-api/src/recovery-scenario';
import {recoveryScenarioScript} from '../packages/runtime-api/src/ui-recovery-scenario';
import {basisReviewScript} from '../packages/runtime-api/src/ui-basis-review';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

const normRow={scope:'Civil / East',demandBasis:'quantity_norm',remainingHours:null,remainingQuantity:80,unit:'m3',laborHoursPerUnit:2,crewCount:1,peoplePerCrew:5,productiveHoursPerShift:8,shiftsPerWorkingDay:1,availableWorkingDays:2};
const hoursRow={...normRow,scope:'Steel / West',demandBasis:'hours',remainingHours:160,remainingQuantity:null,unit:'',laborHoursPerUnit:null,shiftsPerWorkingDay:2};
function fixture(t:any){
 const dir=mkdtempSync(join(tmpdir(),'recovery-input-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('RECOVERY');
 state.schedules.push({role:'update',format:'xer',sourceFilename:'Current.xer',sourceHashSha256:'source-hash',uploadedAt:'2031-08-01',revision:{revisionId:'R1',model:{sourceRevisionId:'R1',dataDateIso:'2031-08-01',activities:[],wbs:[],calendars:[],relationships:[]}}} as any);
 const input={action:'save',sourceFingerprint:recoveryProgrammeBasis(state)!.sourceFingerprint,reference:'Planner assumption REV-1',scopeCoverage:'East concrete and West steel only; exclude finishing',fromIso:'2031-08-01',targetIso:'2031-08-05',trades:[normRow,hoursRow]};
 return {state,store,input};
}
test('quantity norms and entered hours calculate separate conditional trade capacities without changing source facts',t=>{
 const {state,input}=fixture(t),source=JSON.stringify([state.schedules,state.quantities,state.resourcesByRevision,state.controls.contractTimeBasis]);
 state.controls.recoveryScenario=recoveryScenarioInput(state,input);
 const result=recoveryScenarioForState(state),[concrete,steel]=result.rows;
 assert.equal(result.authority,'user_assumption_scenario');assert.equal(result.state,'conditional_scenario');
 assert.equal(concrete!.requiredLaborHours,160);assert.equal(concrete!.availableLaborHours,80);assert.equal(concrete!.capacityGapHours,-80);assert.equal(concrete!.requiredWorkingDays,4);assert.equal(concrete!.requiredPeoplePerShift,10);assert.equal(concrete!.assumedProductionUnitsPerWorkingDay,20);assert.equal(concrete!.unit,'m3');assert.equal(concrete!.state,'conditional_shortfall');
 assert.equal(steel!.availableLaborHours,160);assert.equal(steel!.requiredWorkingDays,2);assert.equal(steel!.state,'conditional_capacity_covers_demand');assert.equal(steel!.assumedProductionUnitsPerWorkingDay,null);
 assert.match(result.qualification,/separate crews/);assert.match(result.qualification,/not an approved manpower plan/);assert.ok(!Object.hasOwn(result,'projectFinishIso'));
 assert.equal(JSON.stringify([state.schedules,state.quantities,state.resourcesByRevision,state.controls.contractTimeBasis]),source);
 state.schedules[0]!.sourceHashSha256='replacement-source';
 assert.equal(recoveryScenarioForState(state).state,'programme_changed');assert.deepEqual(recoveryScenarioForState(state).rows,[]);assert.equal(state.controls.recoveryScenario.trades.length,2);
});
test('blank inputs stay unknown, zero crew capacity stays zero and empty demand is not invented',t=>{
 const {state,input}=fixture(t);
 for(const [changes,demand,capacity,status] of [
  [{crewCount:null},160,null,'inputs_incomplete'],[{remainingQuantity:null},null,80,'inputs_incomplete'],[{crewCount:0},160,0,'conditional_shortfall'],[{crewCount:0,remainingQuantity:0},0,0,'conditional_capacity_covers_demand'],[{availableWorkingDays:0},160,0,'conditional_shortfall']
 ] as const){
  state.controls.recoveryScenario=recoveryScenarioInput(state,{...input,trades:[{...normRow,...changes}]});
  const row=recoveryScenarioForState(state).rows[0]!;assert.equal(row.requiredLaborHours,demand);assert.equal(row.availableLaborHours,capacity);assert.equal(row.state,status);
  if(changes.crewCount===0)assert.equal(row.requiredWorkingDays,demand===0?0:null);
 }
 state.controls.recoveryScenario=recoveryScenarioInput(state,{...input,action:'clear'});assert.equal(recoveryScenarioForState(state).state,'not_entered');
});
test('invalid dates, scopes, demand units, shifts, non-numbers, arithmetic overflow and stale sources are rejected',t=>{
 const {state,input}=fixture(t);
 for(const change of [{reference:''},{scopeCoverage:''},{sourceFingerprint:'foreign-project'},{targetIso:'2031-02-30'},{targetIso:input.fromIso},{action:'approve'},{trades:[]},{trades:[normRow,{...normRow,scope:'CIVIL / EAST'}]},...[{scope:''},{crewCount:-1},{peoplePerCrew:0},{crewCount:1.5},{productiveHoursPerShift:13,shiftsPerWorkingDay:2},{availableWorkingDays:5},{unit:''},{remainingHours:5},{remainingQuantity:-1},{laborHoursPerUnit:0},{laborHoursPerUnit:'2'},{crewCount:true},{peoplePerCrew:Infinity},{remainingQuantity:Number.MIN_VALUE,laborHoursPerUnit:Number.MIN_VALUE},{remainingQuantity:Number.MAX_SAFE_INTEGER,laborHoursPerUnit:Number.MAX_SAFE_INTEGER}].map(row=>({trades:[{...normRow,...row}]}))]){
  assert.throws(()=>recoveryScenarioInput(state,{...input,...change}),JSON.stringify(change));
 }
 assert.equal(state.controls.recoveryScenario,undefined);
});
test('real gateway preserves all editable trades, versions and history after restart; changed programme reopens assumptions',async t=>{
 const root=mkdtempSync(join(tmpdir(),'recovery-api-'));let gateway=await createProjectGateway(root,{maxWorkers:1}),base='';
 t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
 const listen=async()=>{await new Promise<void>(r=>gateway.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
 const post=(path:string,body:any,method='POST')=>fetch(base+path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post('/api/projects',{projectId:'RECOVERY-API'})).status,201);
 assert.equal((await post('/api/projects',{projectId:'RECOVERY-OTHER'})).status,201);
 const path='/api/projects/RECOVERY-API';
 const upload=(date:string)=>fetch(base+path+'/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current.xer','x-upload-intent':'replace_current_basis'},body:['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tRECOVERY-API\t'+date,'%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t1\t1\tA1\tConcrete work\t2031-01-01\t2031-12-31\t80\t80','%E'].join('\n')});
 assert.equal((await upload('2031-08-01')).status,201);
 const get=async(suffix='/recovery-scenario')=>{const r=await fetch(base+path+suffix);assert.equal(r.status,200);return await r.json() as any;};
 let view=await get();assert.equal(view.result.state,'not_entered');
 const request={action:'save',sourceFingerprint:view.programme.sourceFingerprint,reference:'RECOVERY REVIEW '.repeat(400),scopeCoverage:'31 distinct trade fronts; exclude access and interface constraints',fromIso:'2031-08-01',targetIso:'2031-08-05',trades:Array.from({length:31},(_,i)=>({...normRow,scope:'Trade '+i}))};
 const save=(changes:any={})=>post(path+'/recovery-scenario',{...request,expectedVersion:view.projectVersion,...changes});
 for(const invalid of [{expectedVersion:view.projectVersion-1},{sourceFingerprint:'stale'},{reference:''},{trades:[{...normRow,availableWorkingDays:100}]}])assert.equal((await save(invalid)).status,409);
 assert.equal((await post('/api/projects/RECOVERY-OTHER/recovery-scenario',{...request,expectedVersion:view.projectVersion})).status,409);
 let r=await save();assert.equal(r.status,200,await r.clone().text());view=await r.json();assert.equal(view.saved.trades.length,31);assert.equal(view.result.rows.length,31);assert.equal(view.result.rows[30].capacityGapHours,-80);
 const page=await get('/schedule/modules/challenge-contract');assert.equal(page.data.recoveryScenario.state,'conditional_scenario');assert.equal(page.data.recoveryScenario.rows[0].requiredLaborHours,160);assert.equal(page.data.deliveryChallenge.manpowerChallenge.workHoursPerPersonDay,null,'manual scenario is not promoted into the source manpower challenge');
 assert.equal((await post(path+'/controls',{recoveryScenario:{state:'saved'}},'PUT')).status,409);
 await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:1});await listen();view=await get();assert.equal(view.saved.trades.length,31);assert.equal(view.saved.reference,request.reference.trim());assert.equal(view.result.rows[30].capacityGapHours,-80);
 r=await save({trades:[hoursRow],reference:'EDITED'});assert.equal(r.status,200);view=await r.json();assert.equal(view.historyCount,1);assert.equal(view.result.rows[0].availableLaborHours,160);
 assert.equal((await upload('2031-09-01')).status,201);view=await get();assert.equal(view.result.state,'programme_changed');assert.equal(view.result.rows.length,0);assert.equal(view.saved.reference,'EDITED');assert.equal(view.saved.trades[0].remainingHours,160);
 assert.equal((await save()).status,409);r=await save({sourceFingerprint:view.programme.sourceFingerprint,trades:[hoursRow],reference:'REVIEWED NEW PROGRAMME'});assert.equal(r.status,200);view=await r.json();assert.equal(view.result.state,'conditional_scenario');
 r=await save({sourceFingerprint:view.programme.sourceFingerprint,action:'clear',reference:'WITHDRAWN'});assert.equal(r.status,200);view=await r.json();assert.equal(view.result.state,'not_entered');assert.equal(view.historyCount,3);
});
test('browser submits every visible trade and keeps unknown numbers null; changed project cannot save',async()=>{
 const fields:Record<string,any>={recoveryFrom:{value:'2031-08-01'},recoveryTarget:{value:'2031-08-05'},recoveryReference:{value:'USER ASSUMPTION'},recoveryScope:{value:'Defined scope'},recoveryFeedback:{textContent:''}};
 const rows=[normRow,{...hoursRow,crewCount:null}].map(row=>({querySelector:(s:string)=>{const key=/field="([^"]+)"/.exec(s)![1]!;return {value:String((row as any)[key]??''),disabled:row.demandBasis==='hours'?['remainingQuantity','laborHoursPerUnit'].includes(key):key==='remainingHours'};}}));
 const panel={isConnected:true,querySelector:(s:string)=>fields[s.slice(1)],querySelectorAll:()=>rows};
 const sent:any[]=[],view={projectVersion:9,programme:{sourceFingerprint:'basis'},result:{}},context:any={panel,view,project:()=> 'P',projectRequestSeq:3,el:()=>null,currentModuleResult:{data:{}},api:async(url:string,req:any)=>{sent.push({url,...JSON.parse(req.body)});return {...view,projectVersion:10,result:{rows:[]}};}};
 await runInNewContext(recoveryScenarioScript+`;fillRecoveryEditor=()=>{};recoveryEditorState={owner:'P',seq:3,panel,view};saveRecoveryScenario('save')`,context);
 assert.equal(sent.length,1);assert.equal(sent[0].expectedVersion,9);assert.equal(sent[0].trades.length,2);assert.equal(sent[0].trades[0].remainingHours,null);assert.equal(sent[0].trades[0].remainingQuantity,80);assert.equal(sent[0].trades[1].crewCount,null);assert.equal(sent[0].trades[1].remainingQuantity,null);
 await runInNewContext(recoveryScenarioScript+`;recoveryEditorState={owner:'OTHER',seq:3,panel,view};saveRecoveryScenario('save')`,{...context});assert.equal(sent.length,1);
 const html=runInNewContext(recoveryScenarioScript+';recoveryTradeHtml(row)',{row:normRow,escapeHtml:String});assert.match(html,/value="quantity_norm" selected/);assert.match(html,/Separate crews|separate crews/);
});
test('BOQ coverage review opens the existing source editor and relationship review instead of installed quantities',async()=>{
 const calls:string[]=[],panel={isConnected:true,querySelector:()=>({textContent:''}),insertAdjacentHTML:(_at:string,text:string)=>calls.push(text)};
 await runInNewContext(basisReviewScript+`;openBoqLinkEditor=async()=>calls.push('editor');openBoqScopeReview()`,{calls,project:()=> 'P',projectRequestSeq:1,currentModuleResult:{data:{boqProgrammeLinks:{linkedItemCount:0,itemCount:24000,basis:'Source WBS suggestions; no approved allocation'}}},el:(id:string)=>id==='boqLinkEditor'?panel:id==='link-candidate-review'?{}:null,fmt:String,escapeHtml:String,loadLinkCandidates:async(kind:string)=>calls.push(kind)});
 assert.equal(calls[0],'editor');assert.match(calls[1]!,/0 of 24000/);assert.match(calls[1]!,/no approved allocation/);assert.equal(calls[2],'boq_activity');
 const html=cmengUatHtml();assert.match(html,/onclick="openBoqScopeReview\(\)">Review scope links and source basis/);assert.doesNotMatch(html,/managementModuleLink\('quantity-scurve','Review scope links and source basis'\)/);
});
