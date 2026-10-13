import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runInNewContext} from 'node:vm';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {changeDelivery,deliveryRecords} from '../packages/runtime-api/src/delivery-records';
import {deliveryModule} from '../packages/runtime-api/src/delivery-projections';
import {handoverSourceComparison} from '../packages/runtime-api/src/handover-source-review';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';

async function fixture(t:any){
 const root=mkdtempSync(join(tmpdir(),'asset-values-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const store=new RuntimeProjectStore({dataDir:root,durable:false}),state=store.getOrCreate('FLAGS');
 const body='Asset ID,Installed Flag,Commission Flag\nA0,Fitted,Running\nA1,Not installed,Not run\nA2,Undecided,Unknown\nA3,,';
 const upload=(source=body)=>store.ingestEvidenceFile({projectId:state.projectId,sourceFilename:'Assets.csv',mediaType:'text/csv',bytes:Buffer.from(source),uploadIntent:'replace_current_basis',uploadedAt:'2031-08-31'});await upload();
 const doc=state.evidenceDocuments[0]!,input={action:'map_document',documentId:doc.documentId,sourceHash:doc.sourceHashSha256,kind:'asset',columns:{'tag installed':'installed flag',commissioned:'commission flag'},valueMappings:{'tag installed':{Fitted:'Yes','Not installed':'No',Undecided:null},commissioned:{Running:'Yes','Not run':'No',Unknown:null}},reference:'SOURCE-LEGEND'};
 const change=(values:any)=>{const result=changeDelivery(state,{expectedVersion:state.version,...values});store.touch(state);return result;};return {root,store,state,doc,body,input,upload,change};
}
test('source flag interpretations retain raw values and shared unknowns without creating commissioning acceptance',async t=>{
 const f=await fixture(t),bytes=readFileSync(f.doc.storedPath),original=deliveryRecords(f.state).records.map(r=>r.fields);f.change(f.input);
 let records=deliveryRecords(f.state).records;assert.deepEqual(records.map(r=>r.sourceFields),original);assert.deepEqual(records.map(r=>r.fields.commissioned),['Yes','No','','']);assert.equal(records[0]!.sourceValueReview!.originalValues.commissioned,'Running');assert.equal(records[0]!.sourceValueReview!.reference,'SOURCE-LEGEND');assert.deepEqual(readFileSync(f.doc.storedPath),bytes);
 const comparison=handoverSourceComparison(f.state)!;for(const key of ['installed','commissioned']){const row=comparison.rows.find(r=>r.key===key)!;assert.equal(row.numerator,1);assert.equal(row.denominator,4);assert.equal(row.unknownCount,2);assert.equal(row.percent,null);assert.match(row.basis,/SOURCE-LEGEND/);}
 const page=deliveryModule(f.state,'delivery-assets').data as any;assert.equal(page.rows[0].originalSourceFlags.commissioned,'Running');assert.match(page.rows[0].sourceStatusBasis,/SOURCE-LEGEND/);assert.equal((deliveryModule(f.state,'handover-readiness').data as any).handover.readinessPercent,null);
 let restored=new RuntimeProjectStore({dataDir:f.root,durable:false}).get(f.state.projectId)!;assert.equal(restored.delivery!.mappings!.at(-1)!.reference,'SOURCE-LEGEND');assert.deepEqual(deliveryRecords(restored).records.map(r=>r.sourceFields),original);
 f.change({...f.input,valueMappings:{},reference:'REVERT-TO-SOURCE'});records=deliveryRecords(f.state).records;assert.equal(records[0]!.fields.commissioned,'Running');assert.equal(records[0]!.sourceValueReview,undefined);assert.equal(f.state.delivery!.mappings!.length,2);
 f.change(f.input);await f.upload(f.body.replace('Running','Different code'));records=deliveryRecords(f.state).records.filter(r=>r.sourceActive);assert.equal(records[0]!.sourceValueReview,undefined);assert.ok(records.every(r=>r.fields.commissioned===undefined));
});
test('invalid mappings and changed source bytes cannot mutate stored interpretation history',async t=>{
 const f=await fixture(t),before=JSON.stringify(f.state.delivery);
 for(const invalid of [{reference:''},{sourceHash:'old'},{valueMappings:{commissioned:{Invented:'Yes'}}},{valueMappings:{commissioned:{Running:true}}},{valueMappings:{commissioned:{'':'Yes'}}},{valueMappings:{status:{Running:'Yes'}}},{kind:'commissioning'},{columns:{commissioned:'missing column'}},{expectedVersion:f.state.version-1}])assert.throws(()=>f.change({...f.input,...invalid}));
 assert.equal(JSON.stringify(f.state.delivery),before);
 const bytes=readFileSync(f.doc.storedPath);writeFileSync(f.doc.storedPath,'changed');assert.throws(()=>f.change(f.input),/bytes/);writeFileSync(f.doc.storedPath,bytes);f.change(f.input);
 assert.throws(()=>f.change({...f.input,valueMappings:{},reference:''}),/reference/);
 const first=deliveryRecords(f.state).records[0]!;f.change({action:'review',recordId:first.recordId,sourceRevision:first.revision,state:'governed',fields:{},note:'Reviewed mapped flag'});
 f.change({...f.input,valueMappings:{commissioned:{Running:'No'}},reference:'CORRECTED-LEGEND'});const revised=deliveryRecords(f.state).records.find(r=>r.recordId===first.recordId)!;assert.equal(revised.state,'stale');assert.equal(revised.sourceFields!['commission flag'],'Running');assert.equal(revised.fields.commissioned,'No');assert.equal(f.state.delivery!.decisions[0]!.note,'Reviewed mapped flag');
});
test('asset value interpretation cannot reclassify explicit non-asset rows in a mixed register',async t=>{
 const f=await fixture(t);await f.upload('Delivery Record Type,Record Reference,Commission Flag\nasset,A1,Running\ncommissioning,T1,Running');const doc=f.state.evidenceDocuments.at(-1)!;
 f.change({...f.input,documentId:doc.documentId,sourceHash:doc.sourceHashSha256,columns:{commissioned:'commission flag'},valueMappings:{commissioned:{Running:'Yes'}}});
 const rows=deliveryRecords(f.state).records.filter(r=>r.sourceActive&&r.receipts.some(receipt=>receipt.documentId===doc.documentId));assert.equal(rows.find(r=>r.reference==='A1')!.fields.commissioned,'Yes');assert.equal(rows.find(r=>r.reference==='T1')!.kind,'commissioning');assert.equal(rows.find(r=>r.reference==='T1')!.sourceValueReview,undefined);assert.equal(rows.find(r=>r.reference==='T1')!.fields.commissioned,'Running');
});
test('source value pages and editable saved mappings remain complete through gateway restart',async t=>{
 const root=mkdtempSync(join(tmpdir(),'value-map-http-'));let g=await createProjectGateway(root,{maxWorkers:1}),base='';t.after(async()=>{await g.close();rmSync(root,{recursive:true,force:true});});
 const start=async()=>{await new Promise<void>(r=>g.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(g.server.address() as any).port;};await start();
 const post=(path:string,input:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});assert.equal((await post('/api/projects',{projectId:'VALUE-MAP'})).status,201);
 const body='Asset ID,Flag\n'+Array.from({length:130},(_,i)=>'AS-'+i+',Flag-'+i).join('\n');assert.equal((await fetch(base+'/api/projects/VALUE-MAP/evidence/uploads',{method:'POST',headers:{'content-type':'text/csv','x-source-filename':'Assets.csv'},body})).status,201);
 const source=await (await fetch(base+'/api/projects/VALUE-MAP/delivery/sources')).json() as any,doc=source.documents.find((d:any)=>d.filename==='Assets.csv'),query=new URLSearchParams({documentId:doc.documentId,sourceHash:doc.sourceHash,column:'flag'}),seen:string[]=[];
 for(let offset=0;offset<130;offset+=25){const response=await fetch(base+'/api/projects/VALUE-MAP/delivery/source-values?'+query+'&offset='+offset);assert.equal(response.status,200);const p=await response.json() as any;assert.equal(p.total,130);assert.equal(p.sourceRowCount,130);seen.push(...p.rows.map((r:any)=>r.value));}assert.equal(new Set(seen).size,130);
 const values=Object.fromEntries(seen.map((v,i)=>[v,i%2?'No':'Yes'])),reference='SOURCE-LEGEND '.repeat(400);
 const input={action:'map_document',expectedVersion:source.projectVersion,documentId:doc.documentId,sourceHash:doc.sourceHash,kind:'asset',columns:{commissioned:'flag'},valueMappings:{commissioned:values},reference};assert.equal((await post('/api/projects/VALUE-MAP/delivery/records',input)).status,200);
 await g.close();g=await createProjectGateway(root,{maxWorkers:1});await start();const response=await fetch(base+'/api/projects/VALUE-MAP/delivery/sources/'+encodeURIComponent(doc.documentId)+'?sourceHash='+doc.sourceHash);assert.equal(response.status,200);const detail=await response.json() as any;assert.deepEqual(detail.document.mapping.valueMappings.commissioned,values);assert.equal(detail.document.mapping.reference,reference.trim());
 assert.equal((await post('/api/projects/VALUE-MAP/delivery/records',{...input,expectedVersion:detail.projectVersion,sourceHash:'changed'})).status,400);
 for(let i=0;i<26;i++)assert.equal((await fetch(base+'/api/projects/VALUE-MAP/evidence/uploads',{method:'POST',headers:{'content-type':'text/csv','x-source-filename':'Source-'+i+'.csv'},body:'Asset ID,Flag\nOTHER-'+i+',Pending'})).status,201);
 const picker=await (await fetch(base+'/api/projects/VALUE-MAP/delivery/sources?view=picker')).json() as any;assert.equal(picker.documents.length,27);assert.ok(picker.documents.some((d:any)=>d.filename==='Source-25.csv'));assert.equal(picker.responsePaging,undefined);
 const last=picker.documents.find((d:any)=>d.filename==='Source-25.csv'),lastDetail=await (await fetch(base+'/api/projects/VALUE-MAP/delivery/sources/'+last.documentId+'?sourceHash='+last.sourceHash)).json() as any;assert.deepEqual(lastDetail.document.kinds,['asset']);assert.ok(lastDetail.document.headers.includes('flag'));
});
test('value mapping editor displays actual value counts and preserves choices outside the displayed page',async()=>{
 const nodes:Record<string,any>={},valueNodes=[{dataset:{index:'0'},value:'Yes',onchange:()=>{}},{dataset:{index:'1'},value:'unknown',onchange:()=>{}}];
 const columnRow={querySelector:(selector:string)=>({value:selector==='.delivery-map-target'?'commissioned':'flag'})};
 const el=(id:string)=>nodes[id]??={innerHTML:'',value:id==='deliveryMapFlag'?'commissioned':id==='deliveryMapKind'?'asset':id==='deliveryMapReference'?'LEGEND':'',querySelectorAll:()=>id==='deliveryMapRows'?[columnRow]:valueNodes};
 const p={projectVersion:4,column:'flag',total:3,sourceRowCount:40,offset:0,limit:2,rows:[{value:'Installed code',count:20},{value:'',count:10}]},sent:any[]=[];
 const api=async(url:string,request?:any)=>{if(request){sent.push(JSON.parse(request.body));return {};}return p;};
 const context={p,el,api,URLSearchParams,project:()=> 'P',fmt:String,escapeHtml:String,humanizeKey:String,loadModule:async()=>{},selected:'delivery-assets'};
 await runInNewContext(deliveryScript()+`;deliverySourceContext={projectId:'P',mapping:{projectVersion:4,doc:{documentId:'D',sourceHash:'H'},valueRequest:0,valueMappings:{commissioned:{'Later page value':'No'}}}}; (async()=>{await deliveryLoadFlagValues(0);for(const node of el('deliveryMapValueRows').querySelectorAll())node.onchange();await deliverySaveSourceMapping();})()`,context);
 assert.match(el('deliveryMapValueRows').innerHTML,/40 retained rows/);assert.match(el('deliveryMapValueRows').innerHTML,/Installed code/);assert.match(el('deliveryMapValueRows').innerHTML,/value="Yes" disabled/);assert.equal(sent.length,1);assert.deepEqual(sent[0].valueMappings.commissioned,{'Later page value':'No','Installed code':'Yes','':null});assert.equal(sent[0].reference,'LEGEND');assert.equal(sent[0].sourceHash,'H');
 assert.match(deliveryScript(),/list="deliveryMapFields"/);assert.match(deliveryScript(),/deliveryCommonFields,\.\.\.deliveryFieldDefinitions\[kind\]/);
});
