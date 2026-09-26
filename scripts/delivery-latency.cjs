// Deterministic large Delivery fixture; no production data. Source preparation is
// outside the measured interval. Run after npm run build, without other benchmarks.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'delivery-latency-'));
process.env.CMENG_DATA_DIR=root;process.env.CMENG_OCR_ENABLED='0';
const {RuntimeProjectStore}=require('../dist/packages/runtime-api/src/project-state');
const {deliveryRecords}=require('../dist/packages/runtime-api/src/delivery-records');
const {deliveryModule}=require('../dist/packages/runtime-api/src/delivery-projections');
const {deliveryScript}=require('../dist/packages/runtime-api/src/ui-delivery');
const {createHash}=require('node:crypto');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
(async()=>{
 const store=new RuntimeProjectStore({dataDir:root,durable:false}),state=store.getOrCreate('DELIVERY-LARGE');
 const upload=(name,rows)=>store.ingestEvidenceFile({projectId:state.projectId,sourceFilename:name,mediaType:'text/csv',uploadedAt:'2031-09-01',bytes:Buffer.from(rows.join('\n'))});
 const specs=[
  ['Procurement.csv','Package ID,Description,Unit,Ordered Quantity,Ordered Date',1200,i=>'PK'+i+',Equipment '+i+',No.,2,2031-08-20'],
  ['Submittals.csv','Submittal ID,Description,Raised Date,Approval Date',2600,i=>'SUB'+i+',Drawing '+i+',2031-08-01,2031-08-20'],
  ['RFI.csv','RFI ID,Description,Raised Date,Status',4200,i=>'RFI'+i+',Design query '+i+',2031-08-01,Open'],
  ['Assets.csv','Asset ID,Description,Installation Date,System',12000,i=>'ASSET'+i+',Asset '+i+',2031-08-10,System '+i%30],
  ['Commissioning.csv','Test ID,Description,Planned Date,Actual Date',1200,i=>'TEST'+i+',Test '+i+',2031-08-20,2031-08-25'],
  ['BOQ.csv','Item No,Description,Unit,Quantity,Rate,Amount,Currency',30000,i=>'ITEM'+i+',Concrete '+i+',m3,100,20,2000,SAR'],
  ['Risk.csv','Risk ID,Description,Status,Identified Date,Probability,Impact,Rating',500,i=>'RISK'+i+',Risk '+i+',Open,2031-08-01,0.4,3,Medium']
 ];
 for(const [name,header,count,row] of specs)await upload(name,[header,...Array.from({length:count},(_,i)=>row(i))]);
 let session;
 if(process.env.CMENG_DELIVERY_PROFILE){const {Session}=require('node:inspector');session=new Session();session.connect();await new Promise((r,j)=>session.post('Profiler.enable',e=>e?j(e):r()));await new Promise((r,j)=>session.post('Profiler.start',e=>e?j(e):r()));}
 const start=performance.now(),module=deliveryModule(state,'delivery-risks'),firstProjectionMs=performance.now()-start;
 const recordReads=[];let records;
 for(let i=0;i<3;i++){const t=performance.now();records=deliveryRecords(state);recordReads.push(performance.now()-t);}
 const context={escapeHtml:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
 vm.runInNewContext(deliveryScript(),context);
 const before=performance.now(),html=context.deliveryObjectDetail(module.data.riskBasis),evidenceRenderMs=performance.now()-before;
 assert.equal(records.records.length,21200);
 const result={scope:'Synthetic 21,200 Delivery candidates, 30,000 BOQ items and 500 risks; source preparation excluded',sourceRows:specs.reduce((n,s)=>n+s[2],0),firstProjectionMs,recordReadsMs:recordReads,evidenceRenderMs,evidenceHtmlBytes:Buffer.byteLength(html),recordCount:records.records.length,recordFingerprint:hash(records),canonicalFingerprint:hash(module),peakRssMiB:process.resourceUsage().maxRSS/1024,targetMs:5000};
 if(session){const profile=await new Promise((r,j)=>session.post('Profiler.stop',(e,p)=>e?j(e):r(p.profile)));fs.writeFileSync(process.env.CMENG_DELIVERY_PROFILE,JSON.stringify(profile));session.disconnect();}
 console.log(JSON.stringify(result,null,2));if(process.env.CMENG_DELIVERY_BENCHMARK_OUTPUT)fs.writeFileSync(process.env.CMENG_DELIVERY_BENCHMARK_OUTPUT,JSON.stringify(result,null,2));
 assert.ok(firstProjectionMs<=result.targetMs&&recordReads.every(ms=>ms<=result.targetMs),'Large Delivery calculation or record read exceeded five seconds');
 assert.ok(result.evidenceHtmlBytes<50000,'Collapsed evidence must not render the full source population');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
