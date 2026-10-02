import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';

import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {moduleRegistry,type ModuleDescriptor} from '../packages/runtime-api/src/registry';
import {
  defaultBlindSeed,
  generateMixedWorkbookBlindRound,
  generateLifecycleMixedWorkbookBlindRound,
  generateScheduleLifecycleBlindRound,
  generateDeliveryFeatureBlindRound,
  generateCommercialFeatureBlindRound,
  generateDelayFeatureBlindRound,
  generateProgressFeatureBlindRound,
  generateForecastFeatureBlindRound,
  type BlindDocument,
} from './blind-project-generator';

type BatchProject={
  projectId:string;
  dataDateIso:string;
  documents:BlindDocument[];
};

const pageBatches=[
  {id:'F1-MANAGEMENT',keys:['master-dashboard','command-center','cross-domain-accountability','master-control-programme','source-quality']},
  {id:'F2-PROGRAMME-PLANNING',keys:['pmo-analysis','schedule-analytics','activity-analytics','lookahead-schedule','schedule-change-report','revision-trend','milestones','near-critical']},
  {id:'F3-PROGRESS-RESOURCES',keys:['resource-utilization','progress-report','variance-trends','progress-scurve','quantity-scurve','progress-breakdown','manhour-scurve']},
  {id:'F4-FORECAST-RECOVERY',keys:['forecast-history','independent-forecast','challenge-contract','recovery-acceleration']},
  {id:'F5-DELAY-CLAIMS',keys:['delay-claims','notices-claims','windows-analysis','eot-assessment']},
  {id:'F6-COMMERCIAL',keys:['commercial-overview','cost-forecast','variations-change','payments','cash-flow','commercial-claims-notices','contract-particulars-bonds']},
  {id:'F7-DELIVERY',keys:moduleRegistry.filter(page=>page.area==='delivery').map(page=>page.key)},
] as const;

const roles=['overall','planning-engineer','project-controls-manager','project-director','program-director','executive'] as const;
const batchPages=(keys:readonly string[])=>keys.map(key=>{
  const page=moduleRegistry.find(row=>row.key===key);
  assert.ok(page,'Unknown feature page '+key);
  return page!;
});
function pagePath(projectId:string,page:ModuleDescriptor){
  return '/api/projects/'+encodeURIComponent(projectId)+(page.area==='management'?'/management/'+page.key:'/'+page.area+'/modules/'+page.key);
}
function reportPath(projectId:string,page:ModuleDescriptor,format:'json'|'xlsx',view?:unknown){
  const base='/api/projects/'+encodeURIComponent(projectId)+(page.area==='management'?'/management/'+page.key:'/ '+page.area+'/modules/'+page.key).replace('/ ','/')+'/report.'+format;
  return view===undefined?base:base+'?view='+Buffer.from(JSON.stringify(view)).toString('base64url');
}
async function listen(gateway:Awaited<ReturnType<typeof createProjectGateway>>){
  await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
  return 'http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
}
function parseBody(text:string){try{return text?JSON.parse(text):null;}catch{return text;}}
async function request(base:string,path:string,init?:RequestInit){
  const response=await fetch(base+path,init),text=await response.text();
  return {status:response.status,headers:response.headers,body:parseBody(text),text};
}
async function requestBytes(base:string,path:string){
  const response=await fetch(base+path),bytes=Buffer.from(await response.arrayBuffer());
  return {status:response.status,headers:response.headers,bytes};
}
async function createAndUpload(base:string,project:BatchProject,prefix:string){
  const created=await request(base,'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:project.projectId})});
  assert.equal(created.status,201,project.projectId+' creation failed: '+created.text);
  for(const [index,document] of project.documents.entries()){
    const uploaded=await request(base,'/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/uploads',{
      method:'POST',
      headers:{
        'content-type':document.mediaType,
        'x-source-filename-encoded':encodeURIComponent(document.filename),
        'x-source-relative-path-encoded':encodeURIComponent(document.filename),
        'x-upload-intent':'add_update',
        'x-upload-id':prefix+'-'+index,
      },
      body:Buffer.from(document.bytes),
    });
    assert.equal(uploaded.status,201,project.projectId+' / '+document.filename+' upload failed: '+uploaded.text.slice(0,800));
  }
}
async function ordinaryProjects(seed:string):Promise<BatchProject[]>{
  return (await generateMixedWorkbookBlindRound(seed,10)).projects;
}
async function lifecycleProjects(seed:string):Promise<BatchProject[]>{
  return (await generateLifecycleMixedWorkbookBlindRound(seed,10)).projects.map(project=>({
    projectId:project.projectId,dataDateIso:project.dataDateIso,documents:project.documents,
  }));
}
async function programmeProjects(seed:string):Promise<BatchProject[]>{
  const round=await generateScheduleLifecycleBlindRound(seed,10);
  return round.projects.map(project=>({
    projectId:project.projectId,
    dataDateIso:project.laterDataDateIso,
    documents:[
      project.stages.current,
      project.stages.earlier,
      project.stages.later,
      project.stages.recovery,
      project.stages.draft,
      project.stages.undated,
      project.stages.baseline,
      project.stages.revised_baseline,
    ],
  }));
}
function materialFeatureLeaves(value:any,key='root'):number{
  if(value===null||value===undefined)return 0;
  if(typeof value==='number')return Number.isFinite(value)?1:0;
  if(typeof value==='boolean')return 1;
  if(typeof value==='string')return value.trim()&&!["schemaVersion","projectionKey","producerVersion","generatedAt","projectId","projectVersion","sourceRevisionId","dataDateIso","reason","basis","method","authority"].includes(key)?1:0;
  if(Array.isArray(value))return value.length+value.reduce((n,row)=>n+materialFeatureLeaves(row,key),0);
  if(typeof value==='object')return Object.entries(value).reduce((n,[childKey,child])=>
    ["featureAvailability","diagnostics","dependencies","sourceRefs","receipts"].includes(childKey)?n:n+materialFeatureLeaves(child,childKey),0);
  return 0;
}
function assertFeatureSubstance(batchId:string,page:ModuleDescriptor,body:any,projectId:string){
  const data=body?.data??body;
  assert.ok(data&&typeof data==='object',batchId+' '+page.key+' has no feature result object for '+projectId);
  assert.ok(materialFeatureLeaves(data)>0,batchId+' '+page.key+' returned an empty feature shell for '+projectId);
  const availability=data.featureAvailability;
  if(availability)assert.ok(!['blocked','not_applicable'].includes(availability.state),
    batchId+' '+page.key+' has no usable feature basis for '+projectId+': '+availability.reason);
  if(batchId==='F2-PROGRAMME-PLANNING'&&['schedule-change-report','revision-trend'].includes(page.key))
    assert.equal(availability?.state,'active',batchId+' '+page.key+' requires a real controlled revision comparison for '+projectId);
  if(batchId==='F3-PROGRESS-RESOURCES'){
    if(page.key==='resource-utilization')assert.equal(body.status,'ready','F3 Resources must establish the weekly resource basis for '+projectId);
    if(page.key==='manhour-scurve')assert.ok(Array.isArray(data.points)&&data.points.length>0,'F3 Man-Hour must contain a real source weekly curve for '+projectId);
    if(['variance-trends','quantity-scurve'].includes(page.key))assert.equal(availability?.state,'active','F3 '+page.key+' must establish its real feature basis for '+projectId);
  }
  if(batchId==='F4-FORECAST-RECOVERY'){
    if(page.key==='forecast-history')assert.equal(availability?.state,'active','F4 Completion History requires multiple comparable revisions for '+projectId);
    if(page.key==='challenge-contract'){
      assert.equal(availability?.state,'active','F4 Challenge the Contract did not establish all six prerequisites for '+projectId+': '+availability?.reason);
      assert.ok((availability?.establishedResultCount??0)>0,'F4 Challenge produced no calculated feasibility result for '+projectId);
      assert.ok(Array.isArray(availability?.prerequisites)&&availability.prerequisites.every((row:any)=>row.established),
        'F4 Challenge has an unestablished prerequisite for '+projectId);
    }
    if(page.key==='recovery-acceleration')assert.ok((data.calculatedScenarioCount??0)>0,
      'F4 Recovery & Acceleration produced no calculated scenario for '+projectId);
  }
  if(batchId==='F5-DELAY-CLAIMS'&&page.key==='windows-analysis')
    assert.equal(availability?.state,'active','F5 Delay Windows requires a real revision-to-revision window for '+projectId);
  if(batchId==='F6-COMMERCIAL')assert.equal(body.status,'ready',
    'F6 '+page.key+' must be established, not merely visible, for '+projectId+'; reason: '+String(body.reason??''));
  if(batchId==='F7-DELIVERY')assert.ok(body.status==='ready'||body.status==='partial',
    'F7 '+page.key+' did not produce a Delivery feature result for '+projectId);
}

async function projectsFor(batchId:string,seed:string){
  if(batchId==='F2-PROGRAMME-PLANNING')return programmeProjects(seed);
  if(batchId==='F4-FORECAST-RECOVERY')return (await generateForecastFeatureBlindRound(seed,10)).projects;
  if(batchId==='F3-PROGRESS-RESOURCES')return (await generateProgressFeatureBlindRound(seed,10)).projects;
  if(batchId==='F5-DELAY-CLAIMS')return (await generateDelayFeatureBlindRound(seed,10)).projects;
  if(batchId==='F6-COMMERCIAL')return (await generateCommercialFeatureBlindRound(seed,10)).projects;
  if(batchId==='F7-DELIVERY')return (await generateDeliveryFeatureBlindRound(seed,10)).projects.map(project=>({
    projectId:project.projectId,dataDateIso:project.dataDateIso,documents:project.documents,
  }));
  return ordinaryProjects(seed);
}
async function governForecastQuantities(base:string,project:any){
  const result=await request(base,pagePath(project.projectId,moduleRegistry.find(row=>row.key==='quantity-scurve')!));
  assert.equal(result.status,200,'F4 quantity source review unavailable '+project.projectId+': '+result.text.slice(0,700));
  const data=result.body?.data??{},supplied=data.suppliedBoq??{},rows=Array.isArray(supplied.rows)?supplied.rows:[];
  assert.equal(rows.length,project.featureTruth.items.length,'F4 supplied BOQ population mismatch '+project.projectId);
  const items=project.featureTruth.items.map((truth:any)=>{
    const source=rows.find((row:any)=>String(row.itemNumber??'')===truth.itemNumber);
    assert.ok(source?.itemId,'F4 BOQ item identity missing '+truth.itemNumber+' / '+project.projectId);
    return {quantityItemId:source.itemId,itemNumber:source.itemNumber??truth.itemNumber,section:source.section??null,
      description:source.description??truth.description,unit:source.unit??truth.unit,contractQuantity:source.quantity??truth.quantity,
      sourceRefs:[{source:'boq_csv',locator:'blind-source:'+source.itemId}],diagnostics:[]};
  });
  const model={
    projectId:project.projectId,
    boqRevisionId:String(data.boqRevisionId??supplied.revisionId??''),
    scheduleRevisionId:String(data.scheduleRevisionId??''),
    items,
    allocations:items.map((item:any,i:number)=>({
      allocationId:'blind-governed-'+(i+1),quantityItemId:item.quantityItemId,activityId:project.featureTruth.items[i]!.activityId,
      allocatedQuantity:item.contractQuantity,sourceRefs:[{source:'governed_mapping',locator:'blind-feature-certification'}],
    })),
    installedSnapshots:items.map((item:any,i:number)=>({
      snapshotId:'blind-installed-'+(i+1),asOfIso:project.dataDateIso,quantityItemId:item.quantityItemId,
      installedQuantity:project.featureTruth.items[i]!.installed,sourceRefs:[{source:'progress_record',locator:'blind-measurement:'+project.featureTruth.items[i]!.itemNumber}],
    })),
    measurementReview:{measuredItemCount:items.length,boqItemCount:items.length,sourceRowCount:items.length,matchedRowCount:items.length,futureRowCount:0,unresolvedRowCount:0,currentUnresolvedRowCount:0,complete:true,
      unresolvedRows:[],diagnostics:[],basis:'Fresh blind source measurements reviewed against the current BOQ before feature certification.'},
    diagnostics:[],
  };
  assert.ok(model.boqRevisionId,'F4 BOQ revision missing '+project.projectId);
  assert.ok(model.scheduleRevisionId,'F4 schedule revision missing '+project.projectId);
  const saved=await request(base,'/api/projects/'+encodeURIComponent(project.projectId)+'/quantities',{
    method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(model),
  });
  assert.equal(saved.status,200,'F4 governed quantity mapping failed '+project.projectId+': '+saved.text.slice(0,700));
  assert.equal(saved.body?.allocationCount,items.length,'F4 governed mapping lost allocations '+project.projectId);
  const checked=await request(base,pagePath(project.projectId,moduleRegistry.find(row=>row.key==='quantity-scurve')!));
  assert.equal(checked.status,200);
  assert.equal(checked.body?.data?.mappingBasis,'governed','F4 mapping was not retained as governed '+project.projectId);
  assert.equal(checked.body?.data?.allocationState,'complete','F4 governed allocation is incomplete '+project.projectId);
}

const deliveryKinds=['package','supplier','submittal','design','workfront','interface','quality','permit','hse','commissioning','asset','snag','spare','handover','weather','location','lifecycle','gate'] as const;
const blankDeliveryLinks=()=>({activityIds:[] as string[],boqItemIds:[] as string[],packageIds:[] as string[],supplierIds:[] as string[],locationIds:[] as string[],assetIds:[] as string[],recordIds:[] as string[],riskIds:[] as string[],claimIds:[] as string[],noticeIds:[] as string[],variationIds:[] as string[],boqAllocations:[] as Array<{boqItemId:string;quantity:number;unit:string}>});
async function governDeliveryProject(base:string,projectId:string){
  const endpoint='/api/projects/'+encodeURIComponent(projectId)+'/delivery/records';
  let listed=await request(base,endpoint+'?limit=100');
  assert.equal(listed.status,200,'F7 Delivery records unavailable '+projectId);
  const seenKinds=new Set((listed.body?.rows??[]).map((row:any)=>row.kind));
  for(const kind of deliveryKinds)assert.ok(seenKinds.has(kind),'F7 blind source did not produce Delivery kind '+kind+' for '+projectId);
  let version=Number(listed.body?.projectVersion);
  assert.ok(Number.isInteger(version),'F7 project version missing '+projectId);

  for(const row of listed.body.rows as any[]){
    const links=blankDeliveryLinks();
    links.activityIds=(row.links?.activityIds??[]).filter((id:any)=>id==='1000');
    const verification=String(row.fields?.['verification date']??'').trim();
    const state=(verification&&['quality','snag','handover'].includes(row.kind))?'verified':'governed';
    const reviewed=await request(base,endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      action:'review',expectedVersion:version,recordId:row.recordId,sourceRevision:row.revision,state,
      note:'Fresh blind feature certification: source row reviewed against retained evidence.',fields:{},links,
    })});
    assert.equal(reviewed.status,200,'F7 could not govern '+row.kind+' '+projectId+': '+reviewed.text.slice(0,700));
    version=Number(reviewed.body?.projectVersion);
  }

  listed=await request(base,endpoint+'?limit=100');
  assert.equal(listed.status,200);
  const rows=listed.body.rows as any[],byKind=new Map<string,any>();
  for(const row of rows)if(['governed','verified'].includes(row.state)&&!byKind.has(row.kind))byKind.set(row.kind,row);
  for(const kind of deliveryKinds)assert.ok(byKind.has(kind),'F7 governed Delivery kind missing '+kind+' for '+projectId);

  const packageRow=byKind.get('package'),supplier=byKind.get('supplier'),submittal=byKind.get('submittal'),workfront=byKind.get('workfront'),
    location=byKind.get('location'),asset=byKind.get('asset'),spare=byKind.get('spare'),handover=byKind.get('handover'),
    commissioning=byKind.get('commissioning'),lifecycle=byKind.get('lifecycle');
  const relationshipRows=[
    [packageRow,{fields:{'lifecycle id':lifecycle.recordId},links:{...blankDeliveryLinks(),activityIds:['1000']}}],
    [supplier,{fields:{},links:{...blankDeliveryLinks(),packageIds:[packageRow.recordId]}}],
    [submittal,{fields:{},links:{...blankDeliveryLinks(),activityIds:['1000'],packageIds:[packageRow.recordId]}}],
    [workfront,{fields:{},links:{...blankDeliveryLinks(),activityIds:['1000'],locationIds:[location.recordId]}}],
    [spare,{fields:{},links:{...blankDeliveryLinks(),assetIds:[asset.recordId]}}],
    [handover,{fields:{},links:{...blankDeliveryLinks(),assetIds:[asset.recordId],activityIds:['1000']}}],
  ] as const;
  for(const [row,change] of relationshipRows){
    const reviewed=await request(base,endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      action:'review',expectedVersion:version,recordId:row.recordId,sourceRevision:row.revision,state:row.state,
      note:'Fresh blind feature certification: project relationships reconciled after source review.',fields:change.fields,links:change.links,
    })});
    assert.equal(reviewed.status,200,'F7 relationship governance failed '+row.kind+' '+projectId+': '+reviewed.text.slice(0,700));
    version=Number(reviewed.body?.projectVersion);
  }

  listed=await request(base,endpoint+'?limit=100');version=Number(listed.body?.projectVersion);
  const refreshed=listed.body.rows as any[],targetByKind=new Map<string,any>();
  for(const row of refreshed)if(['governed','verified'].includes(row.state)&&!targetByKind.has(row.kind))targetByKind.set(row.kind,row);
  for(const gate of refreshed.filter((row:any)=>row.kind==='gate')){
    const ref=String(gate.reference??''),target=ref.startsWith('G-PKG-')?targetByKind.get('package'):
      ref.startsWith('G-WF-')?targetByKind.get('workfront'):ref.startsWith('G-COM-')?targetByKind.get('commissioning'):targetByKind.get('asset');
    assert.ok(target,'F7 gate target missing '+ref);
    const reviewed=await request(base,endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      action:'review',expectedVersion:version,recordId:gate.recordId,sourceRevision:gate.revision,state:'governed',
      note:'Fresh blind feature certification: readiness gate linked to governed scope.',fields:{},links:{...blankDeliveryLinks(),recordIds:[target.recordId]},
    })});
    assert.equal(reviewed.status,200,'F7 gate governance failed '+ref+' '+projectId+': '+reviewed.text.slice(0,700));
    version=Number(reviewed.body?.projectVersion);
  }

  for(const kind of deliveryKinds){
    const confirmed=await request(base,endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      action:'confirm_population',expectedVersion:version,kind,note:'Fresh blind feature certification: complete applicable '+kind+' population for this generated source pack.',
    })});
    assert.equal(confirmed.status,200,'F7 population confirmation failed '+kind+' '+projectId+': '+confirmed.text.slice(0,700));
    version=Number(confirmed.body?.projectVersion);
  }
  for(const kind of ['package','workfront','commissioning','asset'] as const){
    const target=targetByKind.get(kind);
    const confirmed=await request(base,endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      action:'confirm_population',expectedVersion:version,kind:'gate',scopeId:target.recordId,
      note:'Fresh blind feature certification: complete readiness-gate population for '+kind+'.',
    })});
    assert.equal(confirmed.status,200,'F7 scoped gate population failed '+kind+' '+projectId+': '+confirmed.text.slice(0,700));
    version=Number(confirmed.body?.projectVersion);
  }
}

test('J8 feature-batch manifest covers every registered page exactly once',()=>{
  const listed=pageBatches.flatMap(batch=>batch.keys);
  assert.equal(listed.length,moduleRegistry.length,'feature batches must cover the complete current page registry');
  assert.equal(new Set(listed).size,listed.length,'a page is assigned to more than one feature batch');
  assert.deepEqual([...listed].sort(),moduleRegistry.map(page=>page.key).sort(),'feature-batch page inventory drift');
});

for(const batch of pageBatches){
  test('J8 '+batch.id+' blind feature certification: each feature is exercised on 10 unseen projects with page/report/filter parity',{timeout:420000},async()=>{
    const seed=defaultBlindSeed()+'::J8-'+batch.id+'-FEATURE-CERTIFICATION';
    process.stdout.write('\nCMENG_'+batch.id.replaceAll('-','_')+'_BLIND_SEED='+seed+'\n');
    const projects=await projectsFor(batch.id,seed);
    assert.equal(projects.length,10,batch.id+' requires at least 10 fresh blind projects');
    assert.equal(new Set(projects.map(project=>project.projectId)).size,10,batch.id+' project identities must be unique');
    const pages=batchPages(batch.keys),root=await mkdtemp(join(tmpdir(),'cmeng-'+batch.id.toLowerCase()+'-'));
    let gateway=await createProjectGateway(root,{maxWorkers:4}),base=await listen(gateway);
    const activeByPage=new Map(pages.map(page=>[page.key,0]));
    let pageChecks=0,jsonReports=0,xlsxReports=0,viewReports=0;
    try{
      for(const project of projects)await createAndUpload(base,project,batch.id);
      if(batch.id==='F4-FORECAST-RECOVERY')for(const project of projects)await governForecastQuantities(base,project as any);
      if(batch.id==='F7-DELIVERY')for(const project of projects)await governDeliveryProject(base,project.projectId);
      const allIds=projects.map(project=>project.projectId);
      for(const [projectIndex,project] of projects.entries()){
        for(const [pageIndex,page] of pages.entries()){
          const result=await request(base,pagePath(project.projectId,page));
          assert.ok(result.status===200||result.status===409,
            batch.id+' '+project.projectId+' / '+page.key+' returned '+result.status+': '+result.text.slice(0,600));
          assert.ok(!/\b(?:NaN|Infinity|-Infinity)\b/.test(result.text),batch.id+' non-finite output '+project.projectId+' / '+page.key);
          for(const otherId of allIds)if(otherId!==project.projectId)assert.ok(!result.text.includes(otherId),
            batch.id+' cross-project disclosure '+project.projectId+' / '+page.key+' contains '+otherId);
          if(result.status===409){
            assert.equal(result.body?.status,'blocked',batch.id+' non-governed 409 '+project.projectId+' / '+page.key);
            assert.ok(typeof result.body?.reason==='string'&&result.body.reason.trim(),batch.id+' blocked feature lacks reason '+page.key);
            assert.ok(Array.isArray(result.body?.dependencies),batch.id+' blocked feature lacks dependencies '+page.key);
            assert.fail(batch.id+' '+page.key+' is not feature-certified on '+project.projectId+
              ': every feature must produce a substantive result on all 10 fresh blind projects. Block reason: '+result.body.reason);
          }
          activeByPage.set(page.key,(activeByPage.get(page.key)??0)+1);
          assertFeatureSubstance(batch.id,page,result.body,project.projectId);
          if(result.body&&typeof result.body==='object'&&typeof result.body.projectId==='string')
            assert.equal(result.body.projectId,project.projectId,batch.id+' page project drift '+page.key);

          const jsonReport=await request(base,reportPath(project.projectId,page,'json'));
          assert.equal(jsonReport.status,200,batch.id+' JSON report failed '+project.projectId+' / '+page.key+': '+jsonReport.text.slice(0,500));
          assert.equal(jsonReport.body?.report?.projectId,project.projectId,batch.id+' JSON report project drift '+page.key);
          assert.ok(!/\b(?:NaN|Infinity|-Infinity)\b/.test(jsonReport.text),batch.id+' report emitted non-finite value '+page.key);
          for(const otherId of allIds)if(otherId!==project.projectId)assert.ok(!jsonReport.text.includes(otherId),
            batch.id+' report cross-project disclosure '+project.projectId+' / '+page.key);
          jsonReports++;

          const view={
            filters:{search:'__CMENG_BLIND_NO_MATCH__'},
            selectedRole:roles[(projectIndex+pageIndex)%roles.length],
            detailLevel:'detailed',
            topN:20,
            sort:{field:'status',direction:'desc'},
          };
          const viewReport=await request(base,reportPath(project.projectId,page,'json',view));
          assert.equal(viewReport.status,200,batch.id+' filtered/lens report failed '+project.projectId+' / '+page.key+': '+viewReport.text.slice(0,500));
          assert.equal(viewReport.body?.scope?.projectId,project.projectId,batch.id+' filtered report project drift '+page.key);
          assert.equal(viewReport.body?.providerStatus,'not_needed',batch.id+' deterministic feature report invoked provider '+page.key);
          assert.deepEqual(viewReport.body?.scope?.pageContext?.filters,view.filters,batch.id+' report lost applied filters '+page.key);
          viewReports++;

          const xlsx=await requestBytes(base,reportPath(project.projectId,page,'xlsx'));
          assert.equal(xlsx.status,200,batch.id+' XLSX report failed '+project.projectId+' / '+page.key);
          assert.ok((xlsx.headers.get('content-type')??'').includes('spreadsheetml'),batch.id+' wrong XLSX content type '+page.key);
          assert.ok(xlsx.bytes.length>1000&&xlsx.bytes[0]===0x50&&xlsx.bytes[1]===0x4b,batch.id+' XLSX output is not a real workbook '+page.key);
          xlsxReports++;pageChecks++;
        }
      }
      for(const page of pages)assert.equal(activeByPage.get(page.key)??0,projects.length,
        batch.id+' '+page.key+' was not substantively exercised on all '+projects.length+' fresh blind projects');
      process.stdout.write('\nCMENG_'+batch.id.replaceAll('-','_')+'_RESULT='+JSON.stringify({
        projects:projects.length,features:pages.length,pageChecks,jsonReports,viewReports,xlsxReports,
        activeByPage:Object.fromEntries(activeByPage),
      })+'\n');
    }finally{
      await gateway.close();
      await rm(root,{recursive:true,force:true});
    }
  });
}

test('J8 F8 platform blind certification: uploads, document lifecycle, Ask, rerun, isolation and restart use 10 new projects',{timeout:420000},async()=>{
  const seed=defaultBlindSeed()+'::J8-F8-PLATFORM-FEATURE-CERTIFICATION';
  process.stdout.write('\nCMENG_F8_PLATFORM_BLIND_SEED='+seed+'\n');
  const projects=await ordinaryProjects(seed);
  assert.equal(projects.length,10);
  const root=await mkdtemp(join(tmpdir(),'cmeng-f8-platform-'));
  let gateway=await createProjectGateway(root,{maxWorkers:4}),base=await listen(gateway);
  const req=(path:string,init?:RequestInit)=>request(base,path,init);
  try{
    for(const project of projects)await createAndUpload(base,project,'F8');
    for(const project of projects){
      const docs=await req('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/documents');
      assert.equal(docs.status,200);
      assert.equal(docs.body?.documentCount,project.documents.length,'F8 retained document count mismatch '+project.projectId);

      const progress=await req('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/upload-progress/F8-0');
      assert.equal(progress.status,200,'F8 upload progress missing '+project.projectId);
      assert.equal(progress.body?.projectId,project.projectId,'F8 upload progress crossed project');
      assert.equal(progress.body?.state,'complete');

      for(const question of ['What is the Data Date?','What is current completion?','List delayed activities','What is the critical path?']){
        const ask=await req('/api/projects/'+encodeURIComponent(project.projectId)+'/intelligence/ask',{
          method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question}),
        });
        assert.ok(ask.status>=200&&ask.status<300,'F8 Ask failed '+project.projectId+' / '+question+': '+ask.text.slice(0,500));
        assert.equal(ask.body?.projectId,project.projectId,'F8 Ask crossed project '+question);
        assert.equal(ask.body?.telemetry?.aiInvoked,false,'F8 deterministic Ask invoked paid AI '+question);
        assert.ok(!/\b(?:NaN|Infinity|-Infinity)\b/.test(ask.text),'F8 Ask emitted non-finite value '+question);
      }

      const rerun=await req('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/rerun',{method:'POST'});
      assert.ok(rerun.status===200||rerun.status===409,'F8 rerun returned unexpected status '+rerun.status);
      assert.equal(rerun.body?.projectId,project.projectId,'F8 rerun crossed project');
      assert.ok(rerun.body?.certification&&typeof rerun.body.certification.state==='string','F8 rerun lacks certification');

      const removableIndex=project.documents.findIndex(document=>document.domain!=='schedule');
      if(removableIndex>=0){
        const before=await req('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/documents');
        const document=before.body?.documents?.find((row:any)=>row.sourceFilename===project.documents[removableIndex]!.filename);
        assert.ok(document?.documentId,'F8 removable document not retained '+project.projectId);
        const deleted=await req('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/documents/'+encodeURIComponent(document.documentId),{method:'DELETE'});
        assert.equal(deleted.status,200,'F8 document delete failed '+project.projectId);
        const afterDelete=await req('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/documents');
        assert.equal(afterDelete.body?.documentCount,project.documents.length-1,'F8 delete did not change register '+project.projectId);
        const source=project.documents[removableIndex]!;
        const restored=await req('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/uploads',{
          method:'POST',
          headers:{'content-type':source.mediaType,'x-source-filename-encoded':encodeURIComponent(source.filename),'x-source-relative-path-encoded':encodeURIComponent(source.filename),'x-upload-intent':'add_update','x-upload-id':'F8-RESTORE'},
          body:Buffer.from(source.bytes),
        });
        assert.equal(restored.status,201,'F8 document restore failed '+project.projectId+': '+restored.text.slice(0,500));
        const afterRestore=await req('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/documents');
        assert.equal(afterRestore.body?.documentCount,project.documents.length,'F8 restore did not recover register '+project.projectId);
      }
    }

    const first=projects[0]!,second=projects[1]!;
    const mismatch=await req('/api/projects/'+encodeURIComponent(first.projectId)+'/intelligence/ask',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        question:'What is the Data Date?',
        pageContext:{projectId:second.projectId,page:'master-dashboard',filters:{},selectedActivity:null,selectedWbs:null,selectedLocation:null,selectedPackage:null},
      }),
    });
    assert.equal(mismatch.status,409,'F8 Ask accepted another project page context');

    await gateway.close();
    gateway=await createProjectGateway(root,{maxWorkers:4});base=await listen(gateway);
    for(const project of projects){
      const overview=await req('/api/projects/'+encodeURIComponent(project.projectId)+'/overview');
      assert.equal(overview.status,200,'F8 restart overview failed '+project.projectId);
      assert.equal(overview.body?.projectId,project.projectId,'F8 restart crossed project');
      assert.equal(overview.body?.latestDataDateIso,project.dataDateIso,'F8 restart Data Date drift '+project.projectId);
    }
    process.stdout.write('\nCMENG_F8_PLATFORM_RESULT='+JSON.stringify({projects:projects.length,askChecks:projects.length*4,restartChecks:projects.length})+'\n');
  }finally{
    await gateway.close();
    await rm(root,{recursive:true,force:true});
  }
});
