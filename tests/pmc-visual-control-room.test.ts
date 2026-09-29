import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';

import {managementSourceInventory} from '../packages/runtime-api/src/management-source-inventory';
import {deliveryDashboard,deliveryModule} from '../packages/runtime-api/src/delivery-projections';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';

function procurementDocument(){
  return {
    documentId:'PROC-1',category:'risk_claims_procurement',documentType:'procurement_register',
    sourceFilename:'Procurement Register.csv',sourceRelativePath:null,mediaType:'text/csv',sourceHashSha256:'proc-hash',
    sizeBytes:100,uploadedAt:'2030-01-01',authority:'candidate_only',parserState:'parsed',storedPath:'/tmp/not-used',
    linkedArtifactId:null,scheduleRole:null,mapping:null,
    identification:{} as any,lineage:{} as any,assertions:[],uploadIntent:'add_update',familyKey:'procurement',
    logicalDocumentKey:'procurement',basisState:'active',supersededByDocumentId:null,supersedesDocumentIds:[],diagnostics:[],
    tabularRead:{producerVersion:'test',sourceHashSha256:'proc-hash',sheets:[{name:'Sheet1',rows:[
      ['Package ID','Description','Status','Long Lead','Required On Site','Forecast Delivery'],
      ['PKG-001','Main transformers','Ordered','Yes','2030-05-01','2030-06-15'],
      ['PKG-002','Internal paint','Open','No','',''],
    ]}]}
  } as any;
}

test('management source inventory preserves readable procurement evidence and explicit long-lead marks',()=>{
  const state={version:1,evidenceDocuments:[procurementDocument()]} as any;
  const inventory=managementSourceInventory(state);
  const procurement=inventory.domains.find(row=>row.domain==='procurement')!;
  assert.equal(procurement.state,'source_rows_available');
  assert.equal(procurement.documentCount,1);
  assert.equal(procurement.readableRowCount,2);
  assert.equal(procurement.recognisedRowCount,2);
  assert.equal(procurement.signals.longLeadMarkedCount,1);
  assert.equal(procurement.signals.longLeadSamples[0]?.reference,'PKG-001');
  assert.equal(procurement.signals.longLeadSamples[0]?.forecastDelivery,'2030-06-15');
});

test('delivery dashboard shows source evidence when no governed Delivery review exists',()=>{
  const state=runtimeProjects.getOrCreate('PMC-VISUAL-SOURCE-FALLBACK');
  state.evidenceDocuments.push(procurementDocument());
  runtimeProjects.touch(state);
  const dashboard:any=deliveryDashboard(state);
  assert.equal(dashboard.mode,'source_available');
  assert.equal(dashboard.sourceAvailability.procurement.readableRowCount,2);
  assert.equal(dashboard.sourceAvailability.procurement.signals.longLeadMarkedCount,1);
  assert.equal(dashboard.latePackageKnownCount,null,'source presence must not fabricate lateness');
  assert.equal(dashboard.confirmedPackageCount,null,'source presence must not fabricate a confirmed package population');
});

const html=cmengUatHtml();
const script=html.match(/<script>([\s\S]*?)<\/script>/)![1]!;
const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
function functions(names:string[]){
  return source.statements.filter(isFunctionDeclaration).filter(node=>node.name&&names.includes(node.name.text)).map(node=>node.getText(source)).join('\n');
}

test('PMC control room shows best available contract and procurement evidence instead of blanking the domain',()=>{
  const data:any={
    metrics:[
      {key:'contract-finish',value:null},
      {key:'submitted-programme-finish',value:'2030-06-30'},
      {key:'independent-forecast-finish',value:null},
      {key:'submitted-vs-contract',value:null},
      {key:'independent-vs-contract',value:null},
      {key:'progress-position',value:null},
      {key:'schedule-spi',value:null},
    ],
    visualControl:{
      progress:{scopeComparison:null,progressBases:null},
      commercial:{positions:[{currency:'AED',originalContractValue:{value:7800000000,state:'candidate'},currentContractValue:{value:null,state:'missing_information'}}],cost:[]},
      sourceInventory:{domains:[{domain:'procurement',documentCount:1,readableRowCount:2400,recognisedRowCount:2400,state:'source_rows_available',basis:'source rows',signals:{longLeadMarkedCount:120,longLeadSamples:[]}}]},
      claims:{},boqScope:{candidateLongLeadCount:120}
    },
    delivery:{confirmedPackageCount:null,knownPackageRecordCount:null,candidatePackageCount:null,candidateLongLeadCount:120,latePackageKnownCount:null,handoverReadinessPercent:null,
      sourceAvailability:{procurement:{documentCount:1,readableRowCount:2400,basis:'source rows',signals:{longLeadMarkedCount:120,longLeadSamples:[]}}}},
    operationalReporting:{counts:{}},
    sourceInterpretation:{hse:{metrics:{}}},
    variationReconciliation:[],
    reportingContract:{dataDateIso:'2026-08-31'}
  };
  const code=functions(['pmcDefined','pmcFirst','pmcMetric','pmcSource','pmcMoney','pmcDays','pmcCard','pmcSourceValue','renderPmcControlRoom']);
  const output=runInNewContext(code+';renderPmcControlRoom(data)',{
    data,
    fmtExecutive:(value:any)=>String(value),
    fmt:(value:any)=>value==null?'Unresolved':String(value),
    planningShortDate:(value:any)=>value==null?'Unresolved':String(value),
    managementModuleLink:(key:string,label:string)=>'<button data-module="'+key+'">'+label+'</button>',
    escapeHtml:(value:any)=>String(value??''),
    overview:{latestDataDateIso:'2026-08-31'}
  });
  assert.match(output,/7800000000 AED source contract/);
  assert.match(output,/120 source-marked long-lead items/);
  assert.match(output,/2400/);
  assert.match(output,/Procurement \/ Long Lead/);
});

test('Delivery UI explicitly presents source availability before unresolved mapping conclusions',()=>{
  const delivery=deliveryScript();
  assert.match(delivery,/Source evidence available/);
  assert.match(delivery,/source availability is shown now/i);
  assert.match(delivery,/governed lifecycle and schedule-impact conclusions stay separate/i);
});

test('management UI includes the visual control room and integrated MCP matrix',()=>{
  assert.match(script,/PMC Control Room/);
  assert.match(script,/Integrated MCP governance matrix/);
  assert.match(script,/Current driving network/);
  assert.match(script,/Long-lead scope to protect/);
  assert.match(script,/What changed in the programme/);
});


test('PMC control room preserves source claim population when current Data Date count is zero',()=>{
  const data:any={
    metrics:[
      {key:'contract-finish',value:null},{key:'submitted-programme-finish',value:null},{key:'independent-forecast-finish',value:null},
      {key:'submitted-vs-contract',value:null},{key:'independent-vs-contract',value:null},{key:'progress-position',value:null},{key:'schedule-spi',value:null},
    ],
    visualControl:{
      progress:{scopeComparison:null,progressBases:null},commercial:{positions:[],cost:[]},
      sourceInventory:{domains:[{domain:'claims',documentCount:4,readableRowCount:350,recognisedRowCount:350,state:'source_rows_available',basis:'source rows',signals:{longLeadMarkedCount:null,longLeadSamples:[]}}]},
      claims:{currentClaimCount:0,sourceClaimCount:350,currentEventCount:0,sourceEventCount:350,officialApprovedEotDays:null,incompleteChainCount:null},
      boqScope:{candidateLongLeadCount:null}
    },
    delivery:{sourceAvailability:{}},operationalReporting:{counts:{}},sourceInterpretation:{hse:{metrics:{}}},variationReconciliation:[],reportingContract:{dataDateIso:'2026-08-31'}
  };
  const code=functions(['pmcDefined','pmcFirst','pmcMetric','pmcSource','pmcMoney','pmcDays','pmcCard','pmcSourceValue','renderPmcControlRoom']);
  const output=runInNewContext(code+';renderPmcControlRoom(data)',{
    data,fmtExecutive:String,fmt:(value:any)=>value==null?'Unresolved':String(value),planningShortDate:String,
    managementModuleLink:(key:string,label:string)=>'<button data-module="'+key+'">'+label+'</button>',escapeHtml:(value:any)=>String(value??''),overview:{latestDataDateIso:'2026-08-31'}
  });
  assert.match(output,/350 source claims · 0 current by DD/);
  assert.match(output,/Source claims<\/em><b>350<\/b>/);
});


test('claims card does not present zero canonical source claims when claim evidence documents exist',()=>{
  const data:any={
    metrics:[
      {key:'contract-finish',value:null},{key:'submitted-programme-finish',value:null},{key:'independent-forecast-finish',value:null},
      {key:'submitted-vs-contract',value:null},{key:'independent-vs-contract',value:null},{key:'progress-position',value:null},{key:'schedule-spi',value:null},
    ],
    visualControl:{
      progress:{scopeComparison:null,progressBases:null},commercial:{positions:[],cost:[]},
      sourceInventory:{domains:[{domain:'claims',documentCount:8,readableRowCount:null,recognisedRowCount:null,state:'source_file_available',basis:'source files',signals:{longLeadMarkedCount:null,longLeadSamples:[]}}]},
      claims:{currentClaimCount:0,sourceClaimCount:0,currentEventCount:0,sourceEventCount:0,officialApprovedEotDays:null,incompleteChainCount:null},
      boqScope:{candidateLongLeadCount:null}
    },
    delivery:{sourceAvailability:{}},operationalReporting:{counts:{}},sourceInterpretation:{hse:{metrics:{}}},variationReconciliation:[],reportingContract:{dataDateIso:'2026-08-31'}
  };
  const code=functions(['pmcDefined','pmcFirst','pmcMetric','pmcSource','pmcMoney','pmcDays','pmcCard','pmcSourceValue','renderPmcControlRoom']);
  const output=runInNewContext(code+';renderPmcControlRoom(data)',{
    data,fmtExecutive:String,fmt:(value:any)=>value==null?'Unresolved':String(value),planningShortDate:String,
    managementModuleLink:(key:string,label:string)=>'<button data-module="'+key+'">'+label+'</button>',escapeHtml:(value:any)=>String(value??''),overview:{latestDataDateIso:'2026-08-31'}
  });
  assert.match(output,/8 source documents/);
  assert.match(output,/Canonical source claims<\/em><b>Not established<\/b>/);
  assert.match(output,/Canonical source events<\/em><b>Not established<\/b>/);
  assert.match(output,/Current claims<\/em><b>0<\/b>/);
});

test('Long Lead page surfaces explicit source long-lead marks before governed mapping exists',()=>{
  const state=runtimeProjects.getOrCreate('PMC-LONG-LEAD-SOURCE-FALLBACK');
  state.evidenceDocuments.push(procurementDocument());
  runtimeProjects.touch(state);
  const result:any=deliveryModule(state,'long-lead');
  assert.equal(result.status,'partial');
  const byLabel=new Map<string,any>(result.data.metrics.map((row:any)=>[row.label,row]));
  assert.equal(byLabel.get('Source-marked long lead')?.value,1);
  assert.equal(byLabel.get('Readable source rows')?.value,2);
  assert.equal(byLabel.get('Governed procurement status')?.value,null);
});
