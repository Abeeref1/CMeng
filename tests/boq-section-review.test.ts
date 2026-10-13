import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {boqSectionContext,boqSectionDecisionInput} from '../packages/runtime-api/src/boq-section-review';
import {quantityMappingForState} from '../packages/runtime-api/src/quantity-mapping-runtime';
import {boqProgrammeLinks} from '../packages/runtime-api/src/boq-programme-links';
import {boqSectionReviewScript} from '../packages/runtime-api/src/ui-boq-section-review';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

function fixture(t:any){
 const root=mkdtempSync(join(tmpdir(),'section-review-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false}),state=store.getOrCreate('SECTION');
 const activity=(id:string,wbsId:string)=>({projectId:'SECTION',activityId:id,nativeId:id,name:'Work '+id,wbsId,calendarId:null,activityType:'task',status:'not_started',originalDurationHours:8,remainingDurationHours:8,baselineStartIso:null,baselineFinishIso:null,currentStartIso:'2031-08-01',currentFinishIso:'2031-09-01',actualStartIso:null,actualFinishIso:null,totalFloatHours:null,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]});
 const model:any={projectId:'SECTION',source:'xer',sourceRevisionId:'R1',dataDateIso:'2031-08-01',activities:[activity('AM','ML'),activity('AE','EL')],wbs:[{wbsId:'M',code:'MECH',name:'Mechanical Systems',parentWbsId:null,sourceRefs:[]},{wbsId:'ML',name:'Mechanical work',parentWbsId:'M',sourceRefs:[]},{wbsId:'E',code:'ELEC',name:'Electrical',parentWbsId:null,sourceRefs:[]},{wbsId:'EL',name:'Electrical work',parentWbsId:'E',sourceRefs:[]}],calendars:[],relationships:[],diagnostics:[]};
 state.schedules.push({role:'update',format:'xer',sourceFilename:'Current.xer',sourceHashSha256:'schedule-hash',uploadedAt:'2031-08-01',revision:{revisionId:'R1',sequence:1,label:'Current',effectiveAt:'2031-08-01',model}});
 state.quantities={projectId:'SECTION',boqRevisionId:'BQ1',scheduleRevisionId:'R1',items:Array.from({length:300},(_,i)=>({quantityItemId:'Q'+i,itemNumber:String(i),description:'Supply '+i,section:i<270?'Mechanical':'Electrical',unit:i%2?'m':'m3',contractQuantity:i,sourceRefs:[],diagnostics:[],...(i===0?{wbsCode:'ELEC'}:{})})),allocations:[{allocationId:'allocation',quantityItemId:'Q1',activityId:'AE',allocatedQuantity:1,sourceRefs:[]}],installedSnapshots:[],diagnostics:[]};
 return {root,store,state,model};
}
test('one reviewed section links its full population while source codes and recorded allocations retain priority',t=>{
 const {store,state,model}=fixture(t),source=JSON.stringify([model,state.quantities]);
 const context=boqSectionContext(state)!;assert.equal(context.rows.find(r=>r.section==='Mechanical')!.itemCount,270);assert.deepEqual(context.rows.find(r=>r.section==='Mechanical')!.suggestions.map(w=>w.wbsId),['M']);
 assert.equal(boqProgrammeLinks(state,model).linkedItemCount,32,'only exact source Electrical section, explicit code and allocation linked initially');
 const save=(section:string,decision:string,wbsId:string|null)=>{state.controls.boqSectionReview=boqSectionDecisionInput(state,{sourceFingerprint:boqSectionContext(state)!.sourceFingerprint,section,decision,wbsId,reference:'SCOPE REVIEW'});store.touch(state);};
 save('Mechanical','confirm','M');const mapping=quantityMappingForState(state,model)!;
 assert.equal(mapping.sourceWbsLinks!.find(r=>r.quantityItemId==='Q0')!.wbsId,'E');assert.equal(mapping.sourceWbsLinks!.find(r=>r.quantityItemId==='Q1')!.sectionReview,undefined);
 assert.equal(mapping.sourceWbsLinks!.filter(r=>r.sectionReview?.decision==='confirm').length,268);assert.equal(boqProgrammeLinks(state,model).linkedItemCount,300);assert.equal(boqProgrammeLinks(state,model).approvedAllocatedItemCount,1);
 assert.equal(mapping.sourceWbsLinks!.find(r=>r.quantityItemId==='Q269')!.wbsId,'M');assert.deepEqual(mapping.sourceWbsLinks!.find(r=>r.quantityItemId==='Q269')!.activityIds,['AM']);assert.match(mapping.sourceWbsLinks!.find(r=>r.quantityItemId==='Q269')!.basis,/SCOPE REVIEW/);
 save('Electrical','reject',null);assert.equal(boqProgrammeLinks(state,model).linkedItemCount,270);assert.equal(boqProgrammeLinks(state,model).rows.find((r:any)=>r.itemId==='Q0').activityIds[0],'AE');
 save('Electrical','remove_review',null);assert.equal(boqProgrammeLinks(state,model).linkedItemCount,300);assert.equal(state.controls.boqSectionReview!.lastChange.decision,'remove_review');
 assert.equal(JSON.stringify([model,state.quantities]),source);assert.equal(state.quantities!.items[0]!.contractQuantity,0);assert.equal(state.quantities!.allocations.length,1);
 state.quantities!.items.push({...state.quantities!.items[2]!,quantityItemId:'ADDED'});store.touch(state);assert.equal(boqSectionContext(state)!.previousReviewNeedsRefresh,true);assert.equal(boqSectionContext(state)!.review,null);assert.equal(quantityMappingForState(state,model)!.sourceWbsLinks!.filter(r=>r.sectionReview).length,0);
});
test('section choices reject invalid identities, cycles, duplicate WBS nodes, missing references and stale fingerprints',t=>{
 const {store,state,model}=fixture(t),valid={sourceFingerprint:boqSectionContext(state)!.sourceFingerprint,section:'Mechanical',decision:'confirm',wbsId:'M',reference:'CHECK'};
 for(const changes of [{sourceFingerprint:'wrong'},{section:'mechanical'},{reference:''},{wbsId:'missing'},{decision:'approve_quantity'},{decision:'reject'},{section:'missing'}])assert.throws(()=>boqSectionDecisionInput(state,{...valid,...changes}));
 model.wbs.push({...model.wbs[0]});store.touch(state);assert.throws(()=>boqSectionDecisionInput(state,{...valid,sourceFingerprint:boqSectionContext(state)!.sourceFingerprint}));
 model.wbs.pop();model.wbs[0].parentWbsId='ML';store.touch(state);assert.throws(()=>boqSectionDecisionInput(state,{...valid,sourceFingerprint:boqSectionContext(state)!.sourceFingerprint}));
 assert.equal(state.controls.boqSectionReview,undefined);
});
test('source WBS disagreements cannot be bypassed by a section confirmation',t=>{
 const {state,store,model}=fixture(t);Object.assign(state.quantities!.items[2]!,{wbsId:'MECH',wbsCode:'ELEC'});store.touch(state);
 state.controls.boqSectionReview=boqSectionDecisionInput(state,{sourceFingerprint:boqSectionContext(state)!.sourceFingerprint,section:'Mechanical',decision:'confirm',wbsId:'M',reference:'REVIEW'});store.touch(state);
 const row=quantityMappingForState(state,model)!.sourceWbsLinks!.find(r=>r.quantityItemId==='Q2')!;assert.equal(row.wbsId,null);assert.equal(row.sectionReview,undefined);assert.match(row.basis,/Conflicting source WBS/);
});
test('gateway pages every section and WBS, persists review after restart and rejects changed source bytes',async t=>{
 const root=mkdtempSync(join(tmpdir(),'section-api-'));let gateway=await createProjectGateway(root,{maxWorkers:1}),base='';
 t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
 const listen=async()=>{await new Promise<void>(r=>gateway.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
 const post=(path:string,body:any,method='POST')=>fetch(base+path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)}),path='/api/projects/SECTION-API';
 assert.equal((await post('/api/projects',{projectId:'SECTION-API'})).status,201);
 const xer=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tSECTION-API\t2031-08-01','%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name',...Array.from({length:31},(_,i)=>'%R\t'+(i+10)+'\t1\t\tW'+i+'\tSection '+i+' Works'),'%T\tTASK','%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt',...Array.from({length:31},(_,i)=>'%R\t'+(i+100)+'\t1\t'+(i+10)+'\tA'+i+'\tWork\t2031-01-01\t2031-12-31\t80\t80'),'%E'].join('\n');
 assert.equal((await fetch(base+path+'/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current.xer','x-upload-intent':'replace_current_basis'},body:xer})).status,201);
 const csv='Item No,Section,Cost Code,Description,Unit,Quantity,Rate,Amount\n'+Array.from({length:62},(_,i)=>[i+1,'Section '+(i%31),'COST-'+i,'Item '+i,'m',10,2,20].join(',')).join('\n');
 assert.equal((await fetch(base+path+'/evidence/uploads',{method:'POST',headers:{'content-type':'text/csv','x-source-filename':'Priced BOQ.csv','x-evidence-category':'boq','x-upload-intent':'replace_current_basis'},body:csv})).status,201);
 const get=async(suffix='')=>{const r=await fetch(base+path+'/boq/section-links'+suffix);assert.equal(r.status,200);return await r.json() as any;};
 let view=await get();assert.equal(view.sectionCount,31);assert.equal(view.itemCount,62);assert.equal(view.rows.length,25);assert.equal((await get('?offset=25')).rows.length,6);assert.equal((await get('?kind=wbs')).options.length,25);const last=await get('?kind=wbs&offset=25');assert.equal(last.options.length,6);
 const target=(await get('?kind=wbs&q=W30')).options[0];assert.ok(target);const request={section:'Section 30',decision:'confirm',wbsId:target.wbsId,reference:'SECTION MAP REVIEW'};
 const save=(changes:any={})=>post(path+'/boq/section-links',{...request,expectedVersion:view.projectVersion,sourceFingerprint:view.sourceFingerprint,...changes});
 for(const bad of [{sourceFingerprint:'bad'},{expectedVersion:view.projectVersion-1},{wbsId:'wrong'},{reference:''}])assert.equal((await save(bad)).status,409);
 let r=await save();assert.equal(r.status,200,await r.clone().text());view=await r.json();assert.equal(view.reviewedSectionCount,1);
 await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:1});await listen();view=await get();assert.equal(view.reviewedSectionCount,1);const reviewed=(await get('?q=Section%2030')).rows[0];assert.equal(reviewed.itemCount,2);assert.equal(reviewed.review.wbsId,target.wbsId);
 const page=await (await fetch(base+path+'/schedule/modules/challenge-contract')).json() as any;assert.equal(page.data.boqProgrammeLinks.linkedItemCount,2);assert.equal(page.data.boqProgrammeLinks.approvedAllocatedItemCount,0);
 r=await save({decision:'reject',wbsId:null,reference:'WRONG SCOPE'});assert.equal(r.status,200);view=await r.json();assert.equal((await get('?q=Section%2030')).rows[0].review.decision,'reject');
 assert.equal((await post(path+'/controls',{boqSectionReview:{decisions:[]}},'PUT')).status,409);
 await gateway.close();
 // Locate the retained BOQ through its stored project state, then alter bytes without altering its declared hash.
 const {readdirSync,readFileSync}=await import('node:fs');
 const files=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);
 const source=files(root).find(file=>{try{return readFileSync(file).equals(Buffer.from(csv));}catch{return false;}});assert.ok(source);writeFileSync(source,Buffer.from(csv+'\n999,Injected,COST-X,Changed,m,1,1,1'));
 gateway=await createProjectGateway(root,{maxWorkers:1});await listen();view=await get();assert.equal((await save()).status,409);
});
test('section browser submits exact selection and reference, retains off-page drafts and blocks project switches',async()=>{
 const sent:any[]=[],reference={value:'REVIEW REF'},input={value:'W30'},feedback={textContent:''},node={isConnected:true,dataset:{boqSectionRow:'0'},querySelector:(selector:string)=>selector==='[data-section-wbs]'?input:selector==='[data-section-reference]'?reference:feedback};
 const panel={isConnected:true,querySelectorAll:()=>[node],querySelector:()=>node},view={projectVersion:4,sourceFingerprint:'scope-hash',offset:25,rows:[{section:'Section 30'}]};
 const context:any={view,panel,project:()=> 'P',projectRequestSeq:8,api:async(url:string,request:any)=>{sent.push({url,...JSON.parse(request.body)});return view;}};
 await runInNewContext(boqSectionReviewScript+`;renderBoqSectionReview=()=>{};boqSectionReviewState={owner:'P',seq:8,panel,view,q:'',drafts:new Map([['Section 0',{wbsId:'W0',reference:'Earlier draft'}]])};saveBoqSection(0,'confirm')`,context);
 assert.equal(sent.length,1);assert.equal(sent[0].section,'Section 30');assert.equal(sent[0].wbsId,'W30');assert.equal(sent[0].reference,'REVIEW REF');assert.match(sent[0].url,/offset=25/);
 const saved=runInNewContext(`boqSectionReviewState.drafts.get('Section 0')`,context);assert.equal(saved.reference,'Earlier draft');
 await runInNewContext(`boqSectionReviewState.owner='OTHER';saveBoqSection(0,'confirm')`,context);assert.equal(sent.length,1);
 assert.match(cmengUatHtml(),/onclick="openBoqSectionReview\(\)">Review section-to-WBS scope suggestions/);
});
