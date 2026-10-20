import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {changeDelivery,deliveryBatchReview,deliveryRecords,deliveryPopulationFingerprint,deliveryCurrentRecord} from '../packages/runtime-api/src/delivery-records';
import {deliveryModule} from '../packages/runtime-api/src/delivery-projections';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {runInNewContext} from 'node:vm';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';

async function fixture(t:any,rows:string[]){
 const root=mkdtempSync(join(tmpdir(),'asset-batch-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false}),state=store.getOrCreate('ASSET-BATCH');
 await store.ingestEvidenceFile({projectId:state.projectId,sourceFilename:'Assets.csv',mediaType:'text/csv',bytes:Buffer.from('Asset ID,Description,Tag Installed,Commissioned,Linked Activity\n'+rows.join('\n')),uploadedAt:'2031-08-31'});
 const doc=state.evidenceDocuments[0]!,source={documentId:doc.documentId,sourceHash:doc.sourceHashSha256,kind:'asset'};
 const change=(input:any)=>{const r=changeDelivery(state,{expectedVersion:state.version,...input});store.touch(state);return r;};
 return {root,store,state,doc,source,change};
}
test('15,000 asset source records can be reviewed atomically with original fields and completeness authority retained',async t=>{
 const f=await fixture(t,Array.from({length:15000},(_,i)=>'AS-'+i+',Pump '+i+','+(i%2?'No':'Yes')+','+(i%3?'No':'Unclear')+','));
 const sourceBytes=readFileSync(f.doc.storedPath),original=deliveryRecords(f.state).records.map(r=>({id:r.recordId,fields:r.fields,receipts:r.receipts,revision:r.revision}));
 f.change({action:'confirm_population',kind:'asset',note:'Complete asset source list checked'});
 const population=structuredClone(f.state.delivery!.populations.at(-1)!);
 const preview=deliveryBatchReview(f.state,f.source);assert.equal(preview.total,15000);assert.equal(preview.eligibleCount,15000);
 const result=f.change({action:'review_source_batch',...f.source,previewFingerprint:preview.previewFingerprint,note:'ASSET-SOURCE-CHECK'});assert.equal(result.reviewedRecordCount,15000);
 let records=deliveryRecords(f.state).records;assert.ok(records.every(r=>r.state==='governed'));assert.deepEqual(records.map(r=>({id:r.recordId,fields:r.fields,receipts:r.receipts,revision:r.revision})),original);
 assert.equal(new Set(f.state.delivery!.decisions.map(d=>d.batchId)).size,1);assert.ok(f.state.delivery!.decisions.every(d=>d.state==='governed'&&d.note==='ASSET-SOURCE-CHECK'));
 assert.deepEqual(readFileSync(f.doc.storedPath),sourceBytes);
 const current=f.state.delivery!.populations.at(-1)!;assert.equal(current.fingerprint,deliveryPopulationFingerprint(records.filter(deliveryCurrentRecord)));assert.equal(current.note,population.note);assert.equal(current.actorId,population.actorId);assert.equal(current.recordedAt,population.recordedAt);assert.equal(current.sourceReviewBatchId,result.batchId);
 assert.equal((deliveryModule(f.state,'handover-readiness').data as any).handover.readinessPercent,null);assert.equal(deliveryBatchReview(f.state,f.source).eligibleCount,0);
 const restored=new RuntimeProjectStore({dataDir:f.root,durable:false}).get(f.state.projectId)!;records=deliveryRecords(restored).records;assert.equal(records.length,15000);assert.ok(records.every(r=>r.state==='governed'));assert.equal(restored.delivery!.decisions.at(-1)!.batchId,result.batchId);
});
test('batch review preserves individual decisions and exceptions, and cannot edit or verify source records',async t=>{
 const f=await fixture(t,['A0,Reviewed,Yes,No,','A1,Unknown flags,Unclear,Unclear,','A2,Link unresolved,Yes,No,FOREIGN','DUP,One,Yes,No,','DUP,Two,Yes,No,',',No reference,Yes,No,']);
 let all=deliveryRecords(f.state).records;const first=all.find(r=>r.reference==='A0')!;
 f.change({action:'review',recordId:first.recordId,sourceRevision:first.revision,state:'working',fields:{description:'Individually retained'},note:'Individual review'});
 const before=JSON.stringify(f.state.delivery),preview=deliveryBatchReview(f.state,f.source);assert.equal(preview.eligibleCount,1);assert.equal(preview.retainedCount,5);
 assert.match(preview.rows.find(r=>r.reference==='A2')!.reason,/Activity link/);assert.equal(preview.rows.filter(r=>r.state==='conflicted').length,2);
 const input={action:'review_source_batch',...f.source,previewFingerprint:preview.previewFingerprint,note:'BATCH'};
 for(const invalid of [{note:''},{previewFingerprint:'old'},{sourceHash:'wrong'},{state:'verified'},{fields:{commissioned:'Yes'}},{recordIds:[first.recordId]},{expectedVersion:f.state.version-1}])assert.throws(()=>f.change({...input,...invalid}));
 const bytes=readFileSync(f.doc.storedPath);writeFileSync(f.doc.storedPath,'changed');assert.throws(()=>f.change(input),/bytes/);writeFileSync(f.doc.storedPath,bytes);assert.equal(JSON.stringify(f.state.delivery),before);
 f.change(input);all=deliveryRecords(f.state).records;assert.equal(all.find(r=>r.reference==='A0')!.state,'working');assert.equal(all.find(r=>r.reference==='A0')!.fields.description,'Individually retained');assert.equal(all.find(r=>r.reference==='A1')!.fields.commissioned,'Unclear');assert.equal(all.find(r=>r.reference==='A1')!.state,'governed');assert.equal(all.filter(r=>r.state==='conflicted').length,2);assert.equal(f.state.delivery!.populations.length,0);
 assert.equal(deliveryBatchReview(f.state,f.source).eligibleCount,0);assert.throws(()=>f.change(input),/source records for this review changed/);
});
test('incomplete physical reading leaves all asset records for individual attention',async t=>{
 const f=await fixture(t,['A1,Pump,Yes,No,']);f.doc.fullTextRead={result:{complete:false}} as any;f.store.touch(f.state);
 const preview=deliveryBatchReview(f.state,f.source);assert.equal(preview.eligibleCount,0);assert.match(preview.rows[0]!.reason,/reading is incomplete/);
 assert.throws(()=>f.change({action:'review_source_batch',...f.source,previewFingerprint:preview.previewFingerprint,note:'CHECK'}),/No source records/);
});
test('HTTP batch preview pages the complete source, binds the exact source and survives restart',async t=>{
 const root=mkdtempSync(join(tmpdir(),'asset-batch-http-'));let g=await createProjectGateway(root,{maxWorkers:1}),base='';t.after(async()=>{await g.close();rmSync(root,{recursive:true,force:true});});
 const start=async()=>{await new Promise<void>(r=>g.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(g.server.address() as any).port;};await start();
 const post=(path:string,input:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
 for(const projectId of ['BATCH-A','BATCH-B'])assert.equal((await post('/api/projects',{projectId})).status,201);
 const body='Asset ID,Description,Tag Installed,Commissioned\n'+Array.from({length:63},(_,i)=>'AS-'+i+',Pump,Yes,No').join('\n');
 assert.equal((await fetch(base+'/api/projects/BATCH-A/evidence/uploads',{method:'POST',headers:{'content-type':'text/csv','x-source-filename':'Assets.csv'},body})).status,201);
 const sources=await (await fetch(base+'/api/projects/BATCH-A/delivery/sources')).json() as any,doc=sources.documents.find((d:any)=>d.filename==='Assets.csv');
 const query=new URLSearchParams({kind:'asset',documentId:doc.documentId,sourceHash:doc.sourceHash}),path='/api/projects/BATCH-A/delivery/batch-review?'+query;
 let preview:any;for(const [offset,count] of [[0,25],[25,25],[50,13]]){const response=await fetch(base+path+'&offset='+offset);assert.equal(response.status,200);preview=await response.json();assert.equal(preview.total,63);assert.equal(preview.eligibleCount,63);assert.equal(preview.rows.length,count);assert.equal(preview.rows[0].reference,'AS-'+offset);}
 assert.equal((await fetch(base+path.replace('BATCH-A','BATCH-B'))).status,400);
 const input={action:'review_source_batch',expectedVersion:preview.projectVersion,kind:'asset',documentId:doc.documentId,sourceHash:doc.sourceHash,previewFingerprint:preview.previewFingerprint,note:'HTTP-REVIEW'};
 assert.equal((await post('/api/projects/BATCH-A/delivery/records',{...input,expectedVersion:preview.projectVersion-1})).status,409);assert.equal((await post('/api/projects/BATCH-A/delivery/records',input)).status,200);
 await g.close();g=await createProjectGateway(root,{maxWorkers:1});await start();preview=await (await fetch(base+path)).json();assert.equal(preview.eligibleCount,0);assert.equal(preview.retainedCount,63);
 const record=await (await fetch(base+'/api/projects/BATCH-A/delivery/records/'+encodeURIComponent(preview.rows[0].recordId))).json() as any;assert.equal(record.record.state,'governed');assert.equal(record.history[0].note,'HTTP-REVIEW');assert.ok(record.history[0].batchId);
 const filtered=await (await fetch(base+path+'&filter=eligible')).json() as any;assert.equal(filtered.matchedCount,0);assert.equal(filtered.total,63);
});
test('batch UI displays eligible and retained counts and submits only the previewed source after explicit confirmation',async()=>{
 const nodes:Record<string,any>={},el=(id:string)=>nodes[id]??={hidden:false,innerHTML:'',value:'',checked:false,disabled:false},sent:any[]=[];
 const p={projectId:'P',projectVersion:8,documentId:'D',sourceHash:'HASH',previewFingerprint:'POP',filename:'Assets.csv',total:63,eligibleCount:62,retainedCount:1,matchedCount:63,offset:25,limit:25,rows:[{recordId:'R',reference:'AS-25',eligible:true,fields:{commissioned:'Unclear'},sourceRefs:[]}],basis:'No acceptance or verification is established.'};
 const detail={innerHTML:''};const html=runInNewContext(deliveryScript()+`;const html=deliveryBatchPreviewHtml(p);deliveryExpandEvidence({target:{open:true,dataset:{deliveryLazy:'deliveryEvidence1'},querySelector:()=>detail}});html`,{p,detail,fmt:String,escapeHtml:String,humanizeKey:String});assert.match(html,/62 eligible/);assert.match(html,/1 retained/);assert.match(detail.innerHTML,/Unclear/);assert.match(html,/26–26 of 63/);assert.match(html,/No acceptance/);
 const ctx={p,el,project:()=> 'P',api:async(_url:string,r:any)=>sent.push(JSON.parse(r.body)),loadModule:async()=>{},selected:'delivery-assets'};
 el('deliveryBatchNote').value='SOURCE-CHECK';
 await runInNewContext(deliveryScript()+`;deliveryBatchContext={projectId:'P',target:el('deliveryEditor'),preview:p};deliverySaveBatchReview()`,{...ctx});assert.equal(sent.length,0);
 el('deliveryBatchConfirm').checked=true;
 await runInNewContext(deliveryScript()+`;deliveryBatchContext={projectId:'P',target:el('deliveryEditor'),preview:p};deliverySaveBatchReview()`,{...ctx});assert.equal(sent.length,1);assert.equal(sent[0].previewFingerprint,'POP');assert.equal(sent[0].expectedVersion,8);assert.equal(sent[0].note,'SOURCE-CHECK');assert.equal(sent[0].state,undefined);assert.equal(sent[0].recordIds,undefined);
});

test('a changed batch preview clears prior confirmation and the record browser covers every API page',async()=>{
 const nodes:Record<string,any>={},el=(id:string)=>nodes[id]??={hidden:false,innerHTML:'',value:'',checked:true,disabled:false,addEventListener:()=>{},removeEventListener:()=>{}};
 const p={projectId:'P',projectVersion:9,documentId:'D',sourceHash:'H',previewFingerprint:'NEW',filename:'Assets.csv',eligibleCount:63,retainedCount:0,total:63,matchedCount:63,offset:0,limit:25,rows:[],basis:'Source review only.'};
 const common={el,p,URLSearchParams,project:()=> 'P',fmt:String,escapeHtml:String,humanizeKey:String,currentModuleResult:{data:{kind:'asset'}}};
 await runInNewContext(deliveryScript()+`;deliveryBatchContext={projectId:'P',target:el('deliveryEditor'),request:0,document:{documentId:'D',sourceHash:'H'},preview:{projectVersion:8,previewFingerprint:'OLD'}};deliveryLoadBatchPreview(0)`,{...common,api:async()=>p});assert.equal(el('deliveryBatchConfirm').checked,false);
 const bound=runInNewContext(deliveryScript()+`;bindDelivery();el('deliveryBatchReview').onclick===deliveryOpenBatchReview`,{...common});assert.equal(bound,true);
 el('deliveryKind').value='asset';const seen:string[]=[];
 const context={...common,api:async(url:string)=>{const offset=Number(new URL(url,'http://test').searchParams.get('offset'));const rows=Array.from({length:Math.min(25,63-offset)},(_,i)=>({reference:'AS-'+(offset+i),recordId:'R'+(offset+i),state:'extracted_candidate'}));seen.push(...rows.map(r=>r.reference));return {projectVersion:9,total:63,rows};}};
 let offset=0;for(let i=0;i<3;i++){await runInNewContext(deliveryScript()+`;deliveryBrowseRecords(${offset})`,{...context});const matches=[...el('deliveryOtherRecords').innerHTML.matchAll(/data-delivery-browse-page="(\d+)"/g)];offset=Number(matches.at(-1)![1]);}
 assert.equal(seen.length,63);assert.equal(new Set(seen).size,63);assert.equal(seen.at(-1),'AS-62');
});
