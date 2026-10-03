import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import JSZip from 'jszip';

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

const roles=['overall','planning','controls','project-director','program-director','executive'] as const;
const audienceForRole=(role:(typeof roles)[number])=>role==='planning'?'planner':role==='project-director'||role==='program-director'?'director':role==='executive'?'executive':'project';
const featureProjectionKey:Record<string,string>={
  'master-dashboard':'master_dashboard','command-center':'command_center',
  'cross-domain-accountability':'cross_domain_accountability','master-control-programme':'master_control_programme',
  'source-quality':'source_quality',
  'pmo-analysis':'pmo_analysis','schedule-analytics':'schedule_analytics','activity-analytics':'activity_analytics',
  'lookahead-schedule':'lookahead_schedule','schedule-change-report':'schedule_change_report','revision-trend':'revision_trend',
  milestones:'milestones','near-critical':'near_critical','resource-utilization':'resource_utilization','progress-report':'progress_report',
  'variance-trends':'variance_trends','progress-scurve':'progress_scurve','quantity-scurve':'quantity_scurve',
  'progress-breakdown':'progress_breakdown','manhour-scurve':'manhour_scurve','forecast-history':'forecast_history',
  'independent-forecast':'independent_forecast','challenge-contract':'challenge_contract','recovery-acceleration':'recovery_acceleration',
  'delay-claims':'delay_claims','notices-claims':'notices_claims','windows-analysis':'windows_analysis','eot-assessment':'eot_assessment',
  'commercial-overview':'commercial_overview','cost-forecast':'cost_forecast','variations-change':'variations_change',
  payments:'payments','cash-flow':'cash_flow','commercial-claims-notices':'commercial_claims_notices',
  'contract-particulars-bonds':'contract_particulars_bonds',
};
const batchPages=(keys:readonly string[])=>keys.map(key=>{
  const page=moduleRegistry.find(row=>row.key===key);
  assert.ok(page,'Unknown feature page '+key);
  return page!;
});
function pagePath(projectId:string,page:ModuleDescriptor){
  return '/api/projects/'+encodeURIComponent(projectId)+(page.area==='management'?'/management/'+page.key:'/'+page.area+'/modules/'+page.key);
}
function reportPath(projectId:string,page:ModuleDescriptor,format:'json'|'xlsx'|'pdf'|'docx'|'csv'|'powerbi',view?:unknown){
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
async function assertBinaryExport(base:string,projectId:string,page:ModuleDescriptor,format:'pdf'|'docx'|'csv'|'powerbi',otherIds:string[]){
  const exported=await requestBytes(base,reportPath(projectId,page,format));
  assert.equal(exported.status,200,format.toUpperCase()+' export failed '+projectId+' / '+page.key);
  const type=exported.headers.get('content-type')??'',disposition=exported.headers.get('content-disposition')??'';
  assert.ok(exported.bytes.length>500,format.toUpperCase()+' export is empty '+projectId+' / '+page.key);
  assert.ok(disposition.toLowerCase().includes('attachment'),format.toUpperCase()+' export lacks attachment disposition '+page.key);
  if(format==='pdf'){
    assert.ok(type.includes('application/pdf'),'PDF content type wrong '+page.key);
    assert.equal(exported.bytes.subarray(0,5).toString('ascii'),'%PDF-','PDF signature wrong '+page.key);
    return;
  }
  assert.equal(exported.bytes[0],0x50,format.toUpperCase()+' export is not a ZIP container '+page.key);
  assert.equal(exported.bytes[1],0x4b,format.toUpperCase()+' export is not a ZIP container '+page.key);
  const zip=await JSZip.loadAsync(exported.bytes);
  if(format==='docx'){
    assert.ok(type.includes('wordprocessingml'),'DOCX content type wrong '+page.key);
    assert.ok(zip.file('word/document.xml'),'DOCX document.xml missing '+page.key);
    const xml=await zip.file('word/document.xml')!.async('string');
    assert.ok(xml.includes(projectId),'DOCX lost project identity '+projectId+' / '+page.key);
    for(const otherId of otherIds)assert.ok(!xml.includes(otherId),'DOCX cross-project disclosure '+projectId+' / '+page.key+' contains '+otherId);
    return;
  }
  assert.ok(type.includes('application/zip'),format.toUpperCase()+' package content type wrong '+page.key);
  for(const name of ['analysis.json','project.csv','dataset-schema.json','README.txt'])
    assert.ok(zip.file(name),format.toUpperCase()+' package missing '+name+' '+page.key);
  const analysisText=await zip.file('analysis.json')!.async('string'),analysis=JSON.parse(analysisText);
  assert.equal(analysis.scope?.projectId,projectId,format.toUpperCase()+' package project drift '+page.key);
  const textEntries=await Promise.all(Object.values(zip.files).filter(entry=>!entry.dir&&/\.(?:json|csv|txt)$/i.test(entry.name)).map(entry=>entry.async('string')));
  const joined=textEntries.join('\n');
  assert.ok(joined.includes(projectId),format.toUpperCase()+' package lost project identity '+page.key);
  for(const otherId of otherIds)assert.ok(!joined.includes(otherId),format.toUpperCase()+' package cross-project disclosure '+projectId+' / '+page.key+' contains '+otherId);
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
  const expectedProjection=page.area==='delivery'?'delivery':featureProjectionKey[page.key];
  if(expectedProjection)assert.equal(data.projectionKey,expectedProjection,
    batchId+' '+page.key+' returned the wrong calculation producer for '+projectId);
  if(page.key==='master-dashboard'){
    assert.ok(Array.isArray(data.metrics)&&data.metrics.length>0,batchId+' Master Dashboard produced no management metrics '+projectId);
    assert.ok(data.consistency&&typeof data.consistency==='object',batchId+' Master Dashboard lost consistency control '+projectId);
    assert.ok(data.visualControl&&typeof data.visualControl==='object',batchId+' Master Dashboard lost visual control position '+projectId);
  }
  if(page.key==='command-center'){
    assert.ok(Array.isArray(data.actions),batchId+' Command Center lost action register '+projectId);
    assert.ok(Array.isArray(data.alerts)&&Array.isArray(data.decisions),batchId+' Command Center lost alerts/decisions '+projectId);
    assert.ok(data.accountability&&typeof data.accountability==='object',batchId+' Command Center lost accountability analysis '+projectId);
  }
  if(page.key==='cross-domain-accountability'){
    assert.ok(Array.isArray(data.rows)&&Array.isArray(data.actions),batchId+' Accountability lost rows/actions '+projectId);
  }
  if(page.key==='master-control-programme'){
    assert.ok(data.revisionAuthority&&data.wbsControl,batchId+' Master Control Programme lost revision/WBS authority '+projectId);
    assert.ok(Array.isArray(data.specialistPositions)&&Array.isArray(data.controlHistory),batchId+' MCP lost specialist/history controls '+projectId);
  }
  if(page.key==='source-quality'){
    assert.ok(Array.isArray(data.systemFailures)&&Array.isArray(data.reviewActions),batchId+' Actions required lost failure/review populations '+projectId);
    assert.ok(data.issueAssessment&&typeof data.issueAssessment==='object',batchId+' Actions required lost issue assessment '+projectId);
  }
  if(page.area==='delivery'){
    assert.equal(data.deliveryPage,page.key,batchId+' Delivery payload belongs to a different feature page: '+projectId+' / '+page.key);
    assert.ok(Array.isArray(data.rows)&&data.rows.length>0,batchId+' '+page.key+' has no substantive Delivery feature rows for '+projectId);
    if(page.key==='delivery-control'){
      assert.ok(Array.isArray(data.readiness),batchId+' Delivery Control lost readiness feature '+projectId);
      assert.ok(Array.isArray(data.managementActions),batchId+' Delivery Control lost management actions '+projectId);
    }
    if(['procurement-scurves','delivery-submittals','material-tracking'].includes(page.key))
      assert.ok(Array.isArray(data.curves)&&data.curves.length>0,batchId+' '+page.key+' produced no real feature curves '+projectId);
    if(page.key==='long-lead')assert.ok(Array.isArray(data.scheduleLongLeadCandidates),batchId+' Long Lead lost schedule/WBS candidate analysis '+projectId);
    if(page.key==='construction-locations')assert.ok(Array.isArray(data.locations),batchId+' Location feature lost governed hierarchy '+projectId);
    if(page.key==='delivery-hse')assert.ok(data.hsePosition&&typeof data.hsePosition==='object',batchId+' HSE feature lost exposure/rate position '+projectId);
    if(page.key==='delivery-commissioning')assert.ok(Array.isArray(data.systems),batchId+' Commissioning feature lost system analysis '+projectId);
    if(page.key==='delivery-risks')assert.ok(data.riskBasis&&typeof data.riskBasis==='object',batchId+' Delivery Risks lost source authority basis '+projectId);
    if(page.key==='handover-readiness')assert.ok(data.handover&&typeof data.handover==='object',batchId+' Handover feature lost readiness position '+projectId);
  }
  if(page.key==='activity-analytics'||page.key==='milestones'||page.key==='near-critical'||page.key==='resource-utilization'||page.key==='progress-breakdown')
    assert.ok(Array.isArray(data.rows)&&data.rows.length>0,batchId+' '+page.key+' produced no substantive feature rows '+projectId);
  if(['revision-trend','variance-trends','progress-scurve','manhour-scurve','forecast-history'].includes(page.key))
    assert.ok(Array.isArray(data.points)&&data.points.length>0,batchId+' '+page.key+' produced no substantive feature points '+projectId);
  if(page.key==='lookahead-schedule'){
    assert.ok(Array.isArray(data.forwardWindowRows)&&Array.isArray(data.overdueBacklogRows),batchId+' Look-Ahead lost forward/backlog separation '+projectId);
  }
  if(page.key==='schedule-change-report')assert.ok(Array.isArray(data.changedActivities),batchId+' Programme Changes lost changed-activity population '+projectId);
  if(page.key==='quantity-scurve')assert.ok(Array.isArray(data.series)&&data.series.length>0,batchId+' Installed Quantities produced no unit series '+projectId);
  if(page.key==='progress-report')assert.ok(data.progress&&data.forecast,batchId+' Progress Status lost progress/forecast separation '+projectId);
  if(page.key==='independent-forecast')assert.ok(typeof data.calculatedActivityCount==='number'&&data.calculatedActivityCount>0,batchId+' Completion Forecast calculated no activities '+projectId);
  if(page.key==='delay-claims')assert.ok(Array.isArray(data.events)&&data.events.length>0,batchId+' Delay Event Register produced no event assessments '+projectId);
  if(page.key==='notices-claims')assert.ok(Array.isArray(data.events)&&Array.isArray(data.claims),batchId+' Notice Compliance lost event/claim populations '+projectId);
  if(page.key==='windows-analysis')assert.ok(Array.isArray(data.windows)&&data.windows.length>0,batchId+' Delay Windows produced no real windows '+projectId);
  if(page.key==='eot-assessment')assert.ok(Array.isArray(data.windowCandidates),batchId+' EOT Assessment lost window candidates '+projectId);
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
    'F6 '+page.key+' must be established, not merely visible, for '+projectId+'; reason: '+String(body.reason??'')+
    '; blockers: '+JSON.stringify((body.issueAssessment?.issues??body.data?.issueAssessment?.issues??[]).map((issue:any)=>({code:issue.code,path:issue.evidencePaths?.[0],summary:issue.summary,detail:issue.detail}))));
  if(batchId==='F7-DELIVERY')assert.ok(body.status==='ready'||body.status==='partial',
    'F7 '+page.key+' did not produce a Delivery feature result for '+projectId);
}

async function projectsFor(batchId:string,seed:string){
  if(batchId==='F2-PROGRAMME-PLANNING')return programmeProjects(seed);
  if(batchId==='F4-FORECAST-RECOVERY')return (await generateForecastFeatureBlindRound(seed,10)).projects;
  if(batchId==='F3-PROGRESS-RESOURCES')return (await generateProgressFeatureBlindRound(seed,10)).projects;
  if(batchId==='F5-DELAY-CLAIMS')return (await generateDelayFeatureBlindRound(seed,10)).projects;
  if(batchId==='F6-COMMERCIAL')return (await generateCommercialFeatureBlindRound(seed,10)).projects;
  if(batchId==='F7-DELIVERY')return (await generateDeliveryFeatureBlindRound(seed,10)).projects;
  return ordinaryProjects(seed);
}
async function governBlindQuantities(base:string,project:any){
  const quantityResult=await request(base,pagePath(project.projectId,moduleRegistry.find(row=>row.key==='quantity-scurve')!));
  assert.equal(quantityResult.status,200,'Blind quantity position unavailable '+project.projectId+': '+quantityResult.text.slice(0,700));
  const sourceResult=await request(base,pagePath(project.projectId,moduleRegistry.find(row=>row.key==='challenge-contract')!));
  assert.equal(sourceResult.status,200,'Blind BOQ source review unavailable '+project.projectId+': '+sourceResult.text.slice(0,700));
  const data=quantityResult.body?.data??{},supplied=sourceResult.body?.data?.suppliedBoq??{},rows=Array.isArray(supplied.rows)?supplied.rows:[];
  assert.equal(rows.length,project.featureTruth.items.length,'Blind supplied BOQ population mismatch '+project.projectId);
  const items=project.featureTruth.items.map((truth:any)=>{
    const source=rows.find((row:any)=>String(row.itemNumber??'')===truth.itemNumber);
    assert.ok(source?.itemId,'Blind BOQ item identity missing '+truth.itemNumber+' / '+project.projectId);
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
  assert.ok(model.boqRevisionId,'Blind BOQ revision missing '+project.projectId);
  assert.ok(model.scheduleRevisionId,'Blind schedule revision missing '+project.projectId);
  const saved=await request(base,'/api/projects/'+encodeURIComponent(project.projectId)+'/quantities',{
    method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(model),
  });
  assert.equal(saved.status,200,'Blind governed quantity mapping failed '+project.projectId+': '+saved.text.slice(0,700));
  assert.equal(saved.body?.allocationCount,items.length,'Blind governed mapping lost allocations '+project.projectId);
  const checked=await request(base,pagePath(project.projectId,moduleRegistry.find(row=>row.key==='quantity-scurve')!));
  assert.equal(checked.status,200);
  assert.equal(checked.body?.data?.mappingBasis,'governed','Blind mapping was not retained as governed '+project.projectId);
  assert.equal(checked.body?.data?.allocationState,'complete','Blind governed allocation is incomplete '+project.projectId);
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
  const catalogBase='/api/projects/'+encodeURIComponent(projectId)+'/delivery/catalog';
  const boqCatalog=await request(base,catalogBase+'?kind=boq&limit=100');
  assert.equal(boqCatalog.status,200,'F7 BOQ catalog unavailable '+projectId);
  const boqRows=boqCatalog.body?.rows??[];
  const equipmentBoq=boqRows.find((row:any)=>/equipment/i.test(String(row.label??'')))??boqRows.at(-1);
  const concreteBoq=boqRows.find((row:any)=>/concrete/i.test(String(row.label??'')))??boqRows[0];
  assert.ok(equipmentBoq?.id&&concreteBoq?.id,'F7 governed BOQ identities missing '+projectId);
  const riskCatalog=await request(base,catalogBase+'?kind=risk&limit=100');
  assert.equal(riskCatalog.status,200,'F7 Risk catalog unavailable '+projectId);
  const riskId=riskCatalog.body?.rows?.[0]?.id;
  assert.ok(riskId,'F7 blind Risk Register did not establish a Delivery-linkable risk '+projectId);
  const relationshipRows=[
    [packageRow,{fields:{'lifecycle id':lifecycle.recordId},links:{...blankDeliveryLinks(),activityIds:['1000'],boqItemIds:[equipmentBoq.id],riskIds:[riskId]}}],
    [supplier,{fields:{},links:{...blankDeliveryLinks(),packageIds:[packageRow.recordId]}}],
    [submittal,{fields:{},links:{...blankDeliveryLinks(),activityIds:['1000'],packageIds:[packageRow.recordId]}}],
    [workfront,{fields:{},links:{...blankDeliveryLinks(),activityIds:['1000'],locationIds:[location.recordId],boqItemIds:[concreteBoq.id],riskIds:[riskId]}}],
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
  test('J8 '+batch.id+' blind feature certification: each feature is exercised on 10 unseen projects with page/report/filter parity',{timeout:900000},async()=>{
    const seed=defaultBlindSeed()+'::J8-'+batch.id+'-FEATURE-CERTIFICATION';
    process.stdout.write('\nCMENG_'+batch.id.replaceAll('-','_')+'_BLIND_SEED='+seed+'\n');
    const projects=await projectsFor(batch.id,seed);
    assert.equal(projects.length,10,batch.id+' requires at least 10 fresh blind projects');
    assert.equal(new Set(projects.map(project=>project.projectId)).size,10,batch.id+' project identities must be unique');
    const pages=batchPages(batch.keys),root=await mkdtemp(join(tmpdir(),'cmeng-'+batch.id.toLowerCase()+'-'));
    let gateway=await createProjectGateway(root,{maxWorkers:4}),base=await listen(gateway);
    const activeByPage=new Map(pages.map(page=>[page.key,0]));
    let pageChecks=0,jsonReports=0,xlsxReports=0,viewReports=0,binaryReports=0;
    try{
      for(const project of projects)await createAndUpload(base,project,batch.id);
      if(batch.id==='F4-FORECAST-RECOVERY'||batch.id==='F7-DELIVERY')
        for(const project of projects)await governBlindQuantities(base,project as any);
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
          assert.deepEqual(jsonReport.body?.result?.data,result.body?.data,batch.id+' JSON report data drift from live page '+project.projectId+' / '+page.key);
          assert.equal(jsonReport.body?.result?.status,result.body?.status,batch.id+' JSON report status drift '+project.projectId+' / '+page.key);
          assert.ok(!/\b(?:NaN|Infinity|-Infinity)\b/.test(jsonReport.text),batch.id+' report emitted non-finite value '+page.key);
          for(const otherId of allIds)if(otherId!==project.projectId)assert.ok(!jsonReport.text.includes(otherId),
            batch.id+' report cross-project disclosure '+project.projectId+' / '+page.key);
          jsonReports++;

          const selectedRole=roles[(projectIndex+pageIndex)%roles.length]??'overall';
          const view={
            filters:{search:'__CMENG_BLIND_NO_MATCH__'},
            selectedRole,
            detailLevel:'detailed',
            topN:20,
            sort:{field:'status',direction:'desc'},
          };
          const viewReport=await request(base,reportPath(project.projectId,page,'json',view));
          assert.equal(viewReport.status,200,batch.id+' filtered/lens report failed '+project.projectId+' / '+page.key+': '+viewReport.text.slice(0,500));
          assert.equal(viewReport.body?.scope?.projectId,project.projectId,batch.id+' filtered report project drift '+page.key);
          assert.equal(viewReport.body?.providerStatus,'not_needed',batch.id+' deterministic feature report invoked provider '+page.key);
          assert.deepEqual(viewReport.body?.scope?.pageContext?.filters,view.filters,batch.id+' report lost applied filters '+page.key);
          assert.equal(viewReport.body?.presentation?.reviewLens,selectedRole,batch.id+' report lost selected review lens '+page.key);
          assert.equal(viewReport.body?.presentation?.audience,audienceForRole(selectedRole),batch.id+' report audience does not match selected lens '+page.key);
          assert.equal(viewReport.body?.presentation?.detail,'detailed',batch.id+' report lost requested detail level '+page.key);
          const filteredRows=(viewReport.body?.sections??[]).flatMap((section:any)=>section.tables??[]).reduce((sum:number,table:any)=>sum+(Array.isArray(table.rows)?table.rows.length:0),0);
          const liveObjectRows=(function count(value:any,depth=0):number{
            if(depth>8||value===null||value===undefined)return 0;
            if(Array.isArray(value))return value.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)).length+
              value.reduce((sum,row)=>sum+count(row,depth+1),0);
            if(typeof value==='object')return Object.values(value).reduce((sum:number,child:any)=>sum+count(child,depth+1),0);
            return 0;
          })(result.body?.data);
          if(liveObjectRows>0)assert.equal(filteredRows,0,batch.id+' no-match report filter did not remove feature rows '+project.projectId+' / '+page.key);
          viewReports++;

          const xlsx=await requestBytes(base,reportPath(project.projectId,page,'xlsx'));
          assert.equal(xlsx.status,200,batch.id+' XLSX report failed '+project.projectId+' / '+page.key);
          assert.ok((xlsx.headers.get('content-type')??'').includes('spreadsheetml'),batch.id+' wrong XLSX content type '+page.key);
          assert.ok(xlsx.bytes.length>1000&&xlsx.bytes[0]===0x50&&xlsx.bytes[1]===0x4b,batch.id+' XLSX output is not a real workbook '+page.key);
          const xlsxZip=await JSZip.loadAsync(xlsx.bytes);
          assert.ok(xlsxZip.file('xl/workbook.xml'),batch.id+' XLSX workbook structure missing '+page.key);
          xlsxReports++;
          const otherIds=allIds.filter(id=>id!==project.projectId);
          for(const format of ['pdf','docx','csv','powerbi'] as const){
            await assertBinaryExport(base,project.projectId,page,format,otherIds);
            binaryReports++;
          }
          pageChecks++;
        }
      }
      for(const page of pages)assert.equal(activeByPage.get(page.key)??0,projects.length,
        batch.id+' '+page.key+' was not substantively exercised on all '+projects.length+' fresh blind projects');
      process.stdout.write('\nCMENG_'+batch.id.replaceAll('-','_')+'_RESULT='+JSON.stringify({
        projects:projects.length,features:pages.length,pageChecks,jsonReports,viewReports,xlsxReports,binaryReports,
        activeByPage:Object.fromEntries(activeByPage),
      })+'\n');
    }finally{
      await gateway.close();
      await rm(root,{recursive:true,force:true});
    }
  });
}

test('J8 F8 platform blind certification: uploads, document lifecycle, Ask, rerun, isolation and restart use 10 new projects',{timeout:900000},async()=>{
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
