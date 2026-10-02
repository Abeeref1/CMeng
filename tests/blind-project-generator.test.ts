import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {RuntimeProjectStore,runtimeProjects} from '../packages/runtime-api/src/project-state';
import {sourceTables} from '../packages/truth-kernel/src';
import {defaultBlindSeed,generateBlindRound,generateMixedWorkbookBlindRound,generateLifecycleMixedWorkbookBlindRound,generateSemanticAiBlindRound,generateScheduleLifecycleBlindRound} from './blind-project-generator';
import {deliveryRecords} from '../packages/runtime-api/src/delivery-records';
import {hseReportPosition} from '../packages/runtime-api/src/hse-report-evidence';
import {weeklyResourceCapacityEvidence} from '../packages/runtime-api/src/canonical-resource-evidence';
import {withInstalledMeasurements} from '../packages/runtime-api/src/installed-measurements';
import {GroundedTableSemanticAiResolver} from '../packages/runtime-api/src/evidence-semantic-ai';
import type {StructuredModel,AskModel} from '../packages/project-ask/src/provider';
import {scheduleAuthorityReview} from '../packages/runtime-api/src/schedule-authority';
import {projectDataDate} from '../packages/runtime-api/src/canonical-time-claims';
import {reportingData} from '../packages/runtime-api/src/reporting-contract';
import {moduleRegistry} from '../packages/runtime-api/src/registry';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {ProjectAskEngine} from '../packages/runtime-api/src/ask-engine';
import {AskStore} from '../packages/runtime-api/src/ask-store';
import type {AskSession} from '../packages/project-ask/src/types';

test('Batch J blind round: fresh generated projects survive real ingestion and shared table intelligence',async t=>{
  const seed=defaultBlindSeed();
  process.stdout.write('\nCMENG_BLIND_GENERATOR_SEED='+seed+'\n');
  const {projects}=await generateBlindRound(seed,24);

  assert.equal(new Set(projects.map(p=>p.projectId)).size,24,'project IDs must be unique');
  assert.equal(new Set(projects.map(p=>p.scenario)).size,8,'every evidence scenario must be exercised each round');
  assert.equal(new Set(projects.map(p=>p.language)).size,3,'English, Arabic and mixed evidence must all be exercised');
  assert.ok(new Set(projects.map(p=>p.currency)).size>=7,'currency coverage');
  assert.ok(projects.some(p=>p.documents.some(d=>d.kind==='csv')),'CSV evidence required');
  assert.ok(projects.some(p=>p.documents.some(d=>d.kind==='xlsx')),'Excel evidence required');
  assert.ok(projects.every(p=>p.documents.some(d=>d.kind==='xer')),'every project must have an independently generated XER');

  const dir=mkdtempSync(join(tmpdir(),'cmeng-blind-round-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false});

  let generatedTabular=0,readableTabular=0,opaquePreserved=0;
  const failures:Array<Record<string,unknown>>=[];

  for(const project of projects){
    for(const document of project.documents){
      try{
        await store.ingestEvidenceFile({
          projectId:project.projectId,
          sourceFilename:document.filename,
          sourceRelativePath:document.filename,
          bytes:document.bytes,
          mediaType:document.mediaType,
          uploadedAt:'2036-12-31T00:00:00.000Z',
          uploadIntent:'add_update',
        });
      }catch(error){
        failures.push({projectId:project.projectId,scenario:project.scenario,domain:document.domain,filename:document.filename,error:error instanceof Error?error.message:String(error)});
      }
    }
    await store.refreshSpreadsheetRegisters(project.projectId);
    const state=store.get(project.projectId);
    assert.ok(state,'project retained: '+project.projectId);
    assert.ok((state?.schedules.length??0)>0,'generated XER must create schedule evidence: '+project.projectId);

    const diagnostics:string[]=[];
    const tables=sourceTables(state!.evidenceDocuments,diagnostics,{includeHistorical:true});
    assert.ok(!diagnostics.some(x=>x.startsWith('SOURCE_HASH_MISMATCH')||x.startsWith('SOURCE_READ_FAILURE')),
      project.projectId+' source preservation: '+diagnostics.join(','));

    for(const document of project.documents.filter(d=>d.kind==='csv'||d.kind==='xlsx')){
      generatedTabular++;
      const matched=tables.filter(table=>table.document.sourceFilename===document.filename);
      const ingestFailure=failures.find(f=>f.projectId===project.projectId&&f.filename===document.filename);
      const retained=state!.evidenceDocuments.filter(d=>d.sourceFilename===document.filename).map(d=>({
        documentId:d.documentId,documentType:d.documentType,category:d.category,basisState:d.basisState,
        parserState:d.parserState,sourceHashSha256:d.sourceHashSha256,storedPath:d.storedPath,
        derivedRegisterRead:d.derivedRegisterRead??null,diagnostics:d.diagnostics,
      }));
      assert.ok(matched.length>0,'tabular evidence disappeared: '+project.projectId+' / '+document.filename+
        '; ingestFailure='+JSON.stringify(ingestFailure??null)+'; retained='+JSON.stringify(retained)+
        '; sourceDiagnostics='+JSON.stringify(diagnostics));
      if(document.truth.rows>0){
        if(matched.some(table=>table.intelligence.structurallyReadable&&table.intelligence.dataRowCount>0))readableTabular++;
        else failures.push({projectId:project.projectId,scenario:project.scenario,domain:document.domain,filename:document.filename,error:'TABLE_NOT_STRUCTURALLY_READABLE',intelligence:matched.map(t=>t.intelligence)});
      }
      if(matched.some(table=>table.recognition?.recognized===false&&table.intelligence.structurallyReadable))opaquePreserved++;
      for(const table of matched){
        assert.equal(table.intelligence.producerVersion,'evidence-table-intelligence-v1');
        assert.ok(table.intelligence.columnCount>=0);
        assert.doesNotMatch(JSON.stringify(table.intelligence),/NaN|Infinity/);
      }
    }
  }

  assert.equal(failures.filter(f=>String(f.error)!=='TABLE_NOT_STRUCTURALLY_READABLE').length,0,
    'blind ingestion failures seed='+seed+' '+JSON.stringify(failures.slice(0,8)));
  assert.ok(generatedTabular>=40,'round must exercise many independent tables');
  assert.ok(readableTabular>=Math.floor(generatedTabular*0.70),'most non-empty generated tables must be structurally readable seed='+seed);
  assert.ok(opaquePreserved>0,'at least one readable but legacy-unrecognised table must remain preserved; proves unknown schema is not discarded');
});

test('J2 fresh blind project set: mixed workbooks route each sheet by content and survive reread/restart',async t=>{
  const seed=defaultBlindSeed()+'::J2-MIXED-REGISTER';
  process.stdout.write('\nCMENG_J2_BLIND_PROJECT_SET_SEED='+seed+'\n');
  const {projects}=await generateMixedWorkbookBlindRound(seed,16);
  assert.equal(new Set(projects.map(project=>project.projectId)).size,16,'J2 requires 16 fresh project identities');
  const dir=mkdtempSync(join(tmpdir(),'cmeng-j2-mixed-blind-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let store=new RuntimeProjectStore({dataDir:dir,durable:false});
  const beforeRestart=new Map<string,{types:string[];counts:{payments:number;variations:number;risks:number;quality:number;claims:number;procurement:number}}>();

  for(const project of projects){
    for(const document of project.documents)await store.ingestEvidenceFile({
      projectId:project.projectId,sourceFilename:document.filename,sourceRelativePath:document.filename,
      bytes:document.bytes,mediaType:document.mediaType,uploadedAt:'2037-12-31T00:00:00.000Z',uploadIntent:'add_update',
    });
    const state=store.get(project.projectId)!;
    const workbook=state.evidenceDocuments.find(document=>document.sourceFilename.endsWith('.xlsx'))!;
    assert.ok(workbook,'mixed workbook retained: '+project.projectId);
    assert.equal(workbook.documentType,'mixed_register_workbook','mixed workbook identity: '+project.projectId);
    assert.equal(workbook.basisState,'active','first mixed workbook must be a governed current snapshot: '+project.projectId);
    const semanticTypes=[...new Set((workbook.tabularRead?.sheets??[]).map(sheet=>sheet.semantic?.documentType).filter((value):value is string=>!!value))].sort();
    assert.ok(semanticTypes.length>=3,'at least three independent sheet meanings required: '+project.projectId+' '+JSON.stringify(semanticTypes));
    const diagnostics:string[]=[];
    const routed=sourceTables([workbook],diagnostics,{includeHistorical:true});
    const routedTypes=[...new Set(routed.map(table=>table.document.documentType))].sort();
    for(const type of semanticTypes)assert.ok(routedTypes.includes(type),'sheet meaning did not reach sourceTables: '+project.projectId+' '+type);

    const expected=project.truth;
    const expectedTypes:Record<string,string>={payments:'payment_certificates',variations:'variation_register',risks:'risk_register',
      claims:'delay_eot_claims_register',procurement:'procurement_register',quality:'quality_ncr_register'};
    for(const domain of expected.expectedDomains.filter(domain=>domain!=='schedule')){
      const type=expectedTypes[domain];if(type)assert.ok(semanticTypes.includes(type),'expected worksheet role missing: '+project.projectId+' '+domain+' -> '+type+'; got '+JSON.stringify(semanticTypes));
    }
    const derived=state.derivedControlsByDocument[workbook.documentId]??{};
    const claimCount=state.controls.delayClaims?.claims.length??0;
    const procurementEvidence=Object.values(state.controls.readinessEvidence)
      .flatMap(dimensions=>dimensions.procurement_material?[dimensions.procurement_material]:[]);
    const procurementCount=procurementEvidence.length;
    const context=()=>JSON.stringify({semanticTypes,derivedKeys:Object.keys(derived),
      counts:{payments:state.controls.invoices.length,variations:state.controls.variations.length,risks:state.controls.risks.length,
        quality:state.controls.ncrs.length,claims:claimCount,procurement:procurementCount}});
    if((expected.payments??0)>0)assert.ok(state.controls.invoices.length>0,'payment sheet did not reach existing payment controls: '+project.projectId+' '+context());
    if((expected.variations??0)>0)assert.ok(state.controls.variations.length>0,'variation sheet did not reach existing variation controls: '+project.projectId+' '+context());
    if((expected.risks??0)>0)assert.ok(state.controls.risks.length>0,'risk sheet did not reach existing risk controls: '+project.projectId+' '+context());
    if((expected.quality??0)>0)assert.ok(state.controls.ncrs.length>0,'quality sheet did not reach existing quality controls: '+project.projectId+' '+context());
    if((expected.claims??0)>0)assert.ok(claimCount>0,'claims sheet did not reach existing claims controls: '+project.projectId+' '+context());
    if((expected.procurement??0)>0)assert.ok(procurementCount>0,'procurement sheet did not reach existing readiness controls: '+project.projectId+' '+context());

    const sheetDerived=[...state.controls.invoices,...state.controls.variations,...state.controls.risks,...state.controls.ncrs]
      .filter(row=>row.sourceRefs.some(ref=>ref.startsWith('evidence-document:'+workbook.documentId)));
    const expectedDirect=(expected.payments??0)+(expected.variations??0)+(expected.risks??0)+(expected.quality??0);
    if(expectedDirect>0){
      assert.ok(sheetDerived.length>0,'mixed workbook produced no traceable control rows: '+project.projectId+' '+context());
      assert.ok(sheetDerived.every(row=>row.sourceRefs.filter(ref=>ref.startsWith('evidence-document:'+workbook.documentId)).every(ref=>ref.includes(':sheet:'))),
        'mixed workbook control provenance must include worksheet: '+project.projectId+' '+JSON.stringify(sheetDerived.map(row=>row.sourceRefs)));
    } else {
      assert.equal(sheetDerived.length,0,'genuine zero source must not invent direct control rows: '+project.projectId+' '+context());
    }
    if((expected.procurement??0)>0)assert.ok(procurementEvidence.every(item=>item.sourceRefs.every(ref=>!ref.startsWith('evidence-document:'+workbook.documentId)||ref.includes(':sheet:'))),
      'procurement readiness provenance must include worksheet: '+project.projectId);

    const counts={payments:state.controls.invoices.length,variations:state.controls.variations.length,risks:state.controls.risks.length,quality:state.controls.ncrs.length,
      claims:claimCount,procurement:procurementCount};
    beforeRestart.set(project.projectId,{types:semanticTypes,counts});
    await store.refreshSpreadsheetRegisters(project.projectId);
    const refreshed=store.get(project.projectId)!;
    const refreshedWorkbook=refreshed.evidenceDocuments.find(document=>document.documentId===workbook.documentId)!;
    assert.deepEqual([...new Set((refreshedWorkbook.tabularRead?.sheets??[]).map(sheet=>sheet.semantic?.documentType).filter((value):value is string=>!!value))].sort(),semanticTypes,
      'reread changed sheet meaning: '+project.projectId);
    const refreshedProcurement=Object.values(refreshed.controls.readinessEvidence).filter(dimensions=>dimensions.procurement_material).length;
    assert.deepEqual({payments:refreshed.controls.invoices.length,variations:refreshed.controls.variations.length,risks:refreshed.controls.risks.length,
      quality:refreshed.controls.ncrs.length,claims:refreshed.controls.delayClaims?.claims.length??0,procurement:refreshedProcurement},counts,
      'reread changed routed facts: '+project.projectId);
  }

  store=new RuntimeProjectStore({dataDir:dir,durable:false});
  for(const project of projects){
    const state=store.get(project.projectId)!;assert.ok(state,'restart retained project: '+project.projectId);
    const workbook=state.evidenceDocuments.find(document=>document.sourceFilename.endsWith('.xlsx'))!;
    const expected=beforeRestart.get(project.projectId)!;
    assert.deepEqual([...new Set((workbook.tabularRead?.sheets??[]).map(sheet=>sheet.semantic?.documentType).filter((value):value is string=>!!value))].sort(),expected.types,
      'restart changed sheet meaning: '+project.projectId);
    const restartedProcurement=Object.values(state.controls.readinessEvidence).filter(dimensions=>dimensions.procurement_material).length;
    assert.deepEqual({payments:state.controls.invoices.length,variations:state.controls.variations.length,risks:state.controls.risks.length,
      quality:state.controls.ncrs.length,claims:state.controls.delayClaims?.claims.length??0,procurement:restartedProcurement},expected.counts,
      'restart changed routed facts: '+project.projectId);
  }
});

test('J2 fresh lifecycle blind project set: mixed source packs reach Delivery, HSE, Resources and installed quantities',async t=>{
  const seed=defaultBlindSeed()+'::J2-LIFECYCLE-CONTROLS';
  process.stdout.write('\nCMENG_J2_LIFECYCLE_BLIND_PROJECT_SET_SEED='+seed+'\n');
  const {projects}=await generateLifecycleMixedWorkbookBlindRound(seed,16);
  assert.equal(new Set(projects.map(project=>project.projectId)).size,16,'J2 lifecycle blind set requires 16 fresh project identities');
  const covered=new Set(projects.flatMap(project=>project.expectedDomains));
  for(const domain of ['interfaces','submittals','assets','commissioning','hse','resources','measurements','evm'])assert.ok(covered.has(domain as any),'J2 lifecycle blind set must cover '+domain);
  const dir=mkdtempSync(join(tmpdir(),'cmeng-j2-lifecycle-blind-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false});

  for(const project of projects){
    for(const document of project.documents)await store.ingestEvidenceFile({
      projectId:project.projectId,sourceFilename:document.filename,sourceRelativePath:document.filename,
      bytes:document.bytes,mediaType:document.mediaType,uploadedAt:'2038-12-31T00:00:00.000Z',uploadIntent:'add_update',
    });
    const state=store.get(project.projectId)!;
    const workbook=state.evidenceDocuments.find(document=>document.sourceFilename.endsWith('.xlsx'))!;
    assert.ok(workbook,'lifecycle workbook retained: '+project.projectId);
    assert.equal(workbook.documentType,'mixed_register_workbook','lifecycle workbook must be governed as mixed registers: '+project.projectId);
    const diagnostics:string[]=[];
    const tables=sourceTables([workbook],diagnostics,{includeHistorical:true});
    const routedTypes=new Set(tables.map(table=>table.document.documentType));
    for(const type of project.expectedTypes)assert.ok(routedTypes.has(type),
      'lifecycle sheet did not route by content: '+project.projectId+' expected='+type+' got='+JSON.stringify([...routedTypes])+' diagnostics='+JSON.stringify(diagnostics));

    const delivery=deliveryRecords(state).records.filter(record=>record.receipts.some(receipt=>receipt.documentId===workbook.documentId));
    if(project.expectedDomains.includes('interfaces'))assert.ok(delivery.some(record=>record.kind==='interface'),'interface sheet did not reach Delivery: '+project.projectId);
    if(project.expectedDomains.includes('submittals'))assert.ok(delivery.some(record=>record.kind==='submittal'),'submittal sheet did not reach Delivery: '+project.projectId);
    if(project.expectedDomains.includes('assets'))assert.ok(delivery.some(record=>record.kind==='asset'),'asset sheet did not reach Delivery: '+project.projectId);
    if(project.expectedDomains.includes('commissioning'))assert.ok(delivery.some(record=>record.kind==='commissioning'),'commissioning sheet did not reach Delivery: '+project.projectId);

    if(project.expectedDomains.includes('hse')){
      assert.ok(workbook.hseSummary,'HSE sheet did not create the existing HSE summary: '+project.projectId);
      assert.notEqual(hseReportPosition(state,project.dataDateIso).state,'not_established','HSE sheet did not reach HSE position: '+project.projectId);
    }
    if(project.expectedDomains.includes('resources')){
      const resources=weeklyResourceCapacityEvidence(state.evidenceDocuments,project.dataDateIso);
      assert.ok(resources.points.length>0,'resource sheet did not reach resource capacity: '+project.projectId+' '+JSON.stringify(resources.diagnostics));
    }
    if(project.expectedDomains.includes('measurements')){
      assert.ok(state.quantities,'measurement blind project must retain its BOQ: '+project.projectId);
      const measured=withInstalledMeasurements(state,state.quantities,project.dataDateIso);
      assert.ok(measured?.measurementReview?.sourceRowCount&&measured.measurementReview.sourceRowCount>0,
        'installed-measurement sheet did not reach quantity progress: '+project.projectId+' '+JSON.stringify(measured?.measurementReview??null));
    }
    if(project.expectedDomains.includes('evm')){
      const evm=tables.find(table=>table.document.documentType==='cost_evm_report');
      assert.ok(evm&&evm.rows.some(row=>row.cells.metric==='EV')&&evm.rows.some(row=>row.cells.metric==='AC'),
        'EVM sheet did not retain EV/AC source facts: '+project.projectId);
    }
  }
});


function j3BlindStructuredModel(onCall:()=>void):StructuredModel{
  const isDate=(value:string)=>/^20\d{2}-\d{2}-\d{2}$/.test(value);
  const isStatus=(value:string)=>/^(?:Paid|Certified|Approved|Pending|Open|High|Submitted|Under Review|Ordered|Late|Closed)$/i.test(value);
  return {structured:async(_name,_schema,_prompt,input:any)=>{
    onCall();
    const rows=(input.table?.rows??[]) as string[][];
    const header=rows[0]??[],data=rows.slice(1).filter(row=>row.some(value=>String(value??'').trim()));
    const columnValues=(index:number)=>data.map(row=>String(row[index]??'').trim()).filter(Boolean);
    const find=(predicate:(values:string[])=>boolean)=>header.findIndex((_,index)=>{const values=columnValues(index);return values.length>0&&predicate(values);});
    const idIndex=find(values=>values.some(value=>/^(?:PC|VO|R|C|PK|NCR)-/i.test(value)));
    if(idIndex<0)return {sourceHashSha256:input.sourceHashSha256,sheetName:input.sheetName,documentType:'unresolved',confidence:0,columns:[]};
    const idSample=columnValues(idIndex)[0]??'';
    const type=/^PC-/i.test(idSample)?'payment_certificates':
      /^VO-/i.test(idSample)?'variation_register':
      /^NCR-/i.test(idSample)?'quality_ncr_register':
      /^PK-/i.test(idSample)?'procurement_register':
      /^C-/i.test(idSample)?'delay_eot_claims_register':'risk_register';
    const meanings:Array<{columnIndex:number;rawHeader:string;meaning:string;confidence:number}>=[];
    const add=(columnIndex:number,meaning:string)=>{if(columnIndex>=0)meanings.push({columnIndex,rawHeader:header[columnIndex]!,meaning,confidence:0.98});};
    const statusIndex=find(values=>values.every(isStatus));
    const currencyIndex=find(values=>values.every(value=>/^[A-Z]{3}$/.test(value)));
    const numericIndexes=header.map((_,index)=>index).filter(index=>{const values=columnValues(index);return values.length>0&&values.every(value=>/^-?\d+(?:\.\d+)?$/.test(value));});
    const narrativeIndex=find(values=>values.every(value=>!isDate(value)&&!isStatus(value)&&!/^[A-Z]{3}$/.test(value)&&!/^(?:PC|VO|R|C|PK|NCR)-/i.test(value)&&!/^-?\d+(?:\.\d+)?$/.test(value)&&value.length>3));
    if(type==='payment_certificates'){
      add(idIndex,'certificate no');add(numericIndexes[0]??-1,'net certified');add(currencyIndex,'currency');add(statusIndex,'status');
    }else if(type==='variation_register'){
      add(idIndex,'variation id');add(narrativeIndex,'description');add(numericIndexes[0]??-1,'approved amount');add(currencyIndex,'currency');add(statusIndex,'status');
    }else if(type==='risk_register'){
      add(idIndex,'risk id');add(narrativeIndex,'description');add(statusIndex,'status');
    }else if(type==='delay_eot_claims_register'){
      add(idIndex,'claim id');add(narrativeIndex,'event');add(numericIndexes[0]??-1,'days claimed');add(statusIndex,'status');
    }else if(type==='procurement_register'){
      add(idIndex,'package id');add(narrativeIndex,'description');add(statusIndex,'status');
      const activityIndex=numericIndexes.find(index=>columnValues(index).every(value=>value==='1000'))??-1;add(activityIndex,'linked activity');
    }else{
      add(idIndex,'ncr id');add(narrativeIndex,'description');add(statusIndex,'status');
    }
    return {sourceHashSha256:input.sourceHashSha256,sheetName:input.sheetName,documentType:type,confidence:0.98,columns:meanings};
  }};
}

test('J3 fresh blind project set: opaque sources require grounded semantic AI, retain provenance and never pay twice for the same hash',async t=>{
  const seed=defaultBlindSeed()+'::J3-GROUNDED-SEMANTIC-AI';
  process.stdout.write('\nCMENG_J3_BLIND_PROJECT_SET_SEED='+seed+'\n');
  const {projects}=await generateSemanticAiBlindRound(seed,18);
  assert.equal(new Set(projects.map(project=>project.projectId)).size,18,'J3 requires 18 fresh project identities');
  assert.equal(new Set(projects.map(project=>project.domain)).size,6,'J3 must cover all six opaque register domains');
  const dir=mkdtempSync(join(tmpdir(),'cmeng-j3-ai-blind-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let calls=0;
  const resolver=new GroundedTableSemanticAiResolver(j3BlindStructuredModel(()=>calls++));
  let store=new RuntimeProjectStore({dataDir:dir,durable:false,semanticAiResolver:resolver});
  const counts=new Map<string,number>();

  const controlCount=(project:any,state:ReturnType<RuntimeProjectStore['get']>)=>{
    assert.ok(state);
    if(project.domain==='payments')return state!.controls.invoices.length;
    if(project.domain==='variations')return state!.controls.variations.length;
    if(project.domain==='risks')return state!.controls.risks.length;
    if(project.domain==='claims')return state!.controls.delayClaims?.claims.length??0;
    if(project.domain==='quality')return state!.controls.ncrs.length;
    return Object.values(state!.controls.readinessEvidence).filter(dimensions=>dimensions.procurement_material).length;
  };

  for(const project of projects){
    for(const document of project.documents){
      await store.ingestEvidenceFile({
        projectId:project.projectId,sourceFilename:document.filename,sourceRelativePath:document.filename,
        bytes:document.bytes,mediaType:document.mediaType,uploadedAt:'2039-12-31T00:00:00.000Z',uploadIntent:'add_update',
        allowSemanticAi:document.kind==='csv',
      });
    }
    const state=store.get(project.projectId)!;
    const source=state.evidenceDocuments.find(document=>document.sourceFilename.endsWith('.csv'))!;
    assert.ok(source,'opaque source retained: '+project.projectId);
    assert.equal(source.csvSemantic?.method,'ai_grounded','opaque table must require grounded AI: '+project.projectId);
    assert.equal(source.documentType,project.expectedDocumentType,'AI role mismatch: '+project.projectId);
    assert.ok(source.csvSemantic?.columnMeanings?.length,'grounded column mappings required: '+project.projectId);
    const diagnostics:string[]=[];
    const routed=sourceTables([source],diagnostics,{includeHistorical:true});
    assert.ok(routed.some(table=>table.document.documentType===project.expectedDocumentType),
      'AI semantic role did not reach canonical source table: '+project.projectId+' '+JSON.stringify(diagnostics));
    const count=controlCount(project,state);
    assert.ok(count>0,'AI-mapped source did not reach existing specialist controls: '+project.projectId+' / '+project.domain);
    counts.set(project.projectId,count);
  }
  assert.equal(calls,projects.length,'each previously unseen opaque source should require exactly one semantic AI call');

  const firstCalls=calls;
  store=new RuntimeProjectStore({dataDir:dir,durable:false,semanticAiResolver:resolver});
  for(const project of projects){
    const sourceDocument=project.documents.find(document=>document.kind==='csv')!;
    await store.ingestEvidenceFile({
      projectId:project.projectId,sourceFilename:sourceDocument.filename,sourceRelativePath:sourceDocument.filename,
      bytes:sourceDocument.bytes,mediaType:sourceDocument.mediaType,uploadedAt:'2040-01-01T00:00:00.000Z',uploadIntent:'add_update',allowSemanticAi:true,
    });
    const state=store.get(project.projectId)!;
    assert.equal(controlCount(project,state),counts.get(project.projectId),'cached semantic mapping changed specialist population: '+project.projectId);
  }
  assert.equal(calls,firstCalls,'restart/re-upload of the same source hash must not spend AI again');
});


test('J4 fresh blind project set: routine updates advance submitted analytics while baseline and scenario authority stay separate',async t=>{
  const seed=defaultBlindSeed()+'::J4-SCHEDULE-LIFECYCLE';
  process.stdout.write('\nCMENG_J4_BLIND_PROJECT_SET_SEED='+seed+'\n');
  const {projects}=await generateScheduleLifecycleBlindRound(seed,18);
  assert.equal(new Set(projects.map(project=>project.projectId)).size,18,'J4 requires 18 fresh lifecycle projects');
  assert.equal(new Set(projects.map(project=>project.language)).size,3,'J4 must rotate English, Arabic and mixed programmes');
  const activityCounts=projects.map(project=>project.stages.current.truth.rows);
  assert.ok(activityCounts.every(count=>count>=35&&count<=160),'J4 fresh cohort must use realistic non-toy programme sizes');
  assert.ok(new Set(activityCounts).size>=6,'J4 fresh cohort must materially vary programme size rather than clone one fixture');
  assert.ok(new Set(projects.map(project=>project.baseDataDateIso)).size>=6,'J4 fresh cohort must materially vary Data Dates');
  const dir=mkdtempSync(join(tmpdir(),'cmeng-j4-schedule-lifecycle-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let store=new RuntimeProjectStore({dataDir:dir,durable:false});
  const expected=new Map<string,{currentRevisionId:string;baselineRevisionId:string;dataDateIso:string}>();

  for(const [index,project] of projects.entries()){
    const ingest=(stage:keyof typeof project.stages)=>{const document=project.stages[stage];return store.ingestEvidenceFile({
      projectId:project.projectId,sourceFilename:document.filename,sourceRelativePath:document.filename,
      bytes:document.bytes,mediaType:document.mediaType,uploadedAt:'2040-12-31T00:00:00.000Z',uploadIntent:'add_update',
    });};

    const baseline=await ingest('baseline');
    let state=store.get(project.projectId)!;
    assert.equal(projectDataDate(state),null,'unapproved baseline must not become the analytical current: '+project.projectId);
    assert.equal(state.activeEvidenceBasis['schedule:baseline']?.activeArtifactId??null,null,'baseline authority must remain unapproved');

    const current=await ingest('current');
    state=store.get(project.projectId)!;
    let review=scheduleAuthorityReview(state);
    assert.equal(projectDataDate(state),project.baseDataDateIso,'first ordinary programme must become current submitted analytics');
    assert.equal(review.state,'submitted_current');assert.equal(review.method,'submitted_update');assert.equal(review.authority,'submitted');
    assert.equal(review.currentRevisionId,current.linkedArtifactId);
    const currentDoc=state.evidenceDocuments.find(document=>document.linkedArtifactId===current.linkedArtifactId)!;
    assert.equal(currentDoc.basisState,'active');assert.equal(currentDoc.scheduleAdoption?.method,'submitted_update');
    assert.equal(state.schedules.find(item=>item.revision.revisionId===current.linkedArtifactId)?.role,'update');

    await ingest('same');await ingest('earlier');
    state=store.get(project.projectId)!;
    assert.equal(projectDataDate(state),project.baseDataDateIso,'same/earlier updates cannot displace current submitted analytics');

    const recovery=await ingest('recovery'),draft=await ingest('draft'),revised=await ingest('revised_baseline');
    state=store.get(project.projectId)!;
    {const document=state.evidenceDocuments.find(document=>document.linkedArtifactId===recovery.linkedArtifactId);assert.equal(document?.basisState,'scenario','recovery must stay scenario: '+project.projectId+' / '+project.stages.recovery.filename+' / role='+String(document?.scheduleRole));}
    {const document=state.evidenceDocuments.find(document=>document.linkedArtifactId===draft.linkedArtifactId);assert.equal(document?.basisState,'scenario','draft must stay scenario: '+project.projectId+' / '+project.stages.draft.filename+' / role='+String(document?.scheduleRole));}
    {const document=state.evidenceDocuments.find(document=>document.linkedArtifactId===revised.linkedArtifactId);assert.equal(document?.basisState,'candidate','revised baseline must stay candidate: '+project.projectId+' / '+project.stages.revised_baseline.filename+' / role='+String(document?.scheduleRole));}
    assert.throws(()=>store.adoptSchedule(project.projectId,revised.linkedArtifactId!),/BASELINE_APPROVAL_REFERENCE_REQUIRED/);
    assert.equal(projectDataDate(state),project.baseDataDateIso,'scenario or unapproved revised baseline cannot displace current analytics');

    const later=await ingest('later');
    state=store.get(project.projectId)!;review=scheduleAuthorityReview(state);
    assert.equal(projectDataDate(state),project.laterDataDateIso,'later ordinary update must advance the current submitted position');
    assert.equal(review.currentRevisionId,later.linkedArtifactId);assert.equal(review.state,'submitted_current');assert.equal(review.authority,'submitted');
    assert.equal(state.evidenceDocuments.find(document=>document.linkedArtifactId===current.linkedArtifactId)?.basisState,'superseded');
    assert.equal(state.evidenceDocuments.find(document=>document.linkedArtifactId===later.linkedArtifactId)?.scheduleAdoption?.method,'submitted_update');

    await ingest('undated');
    state=store.get(project.projectId)!;
    assert.equal(projectDataDate(state),project.laterDataDateIso,'undated update cannot displace a dated current position');
    assert.ok(scheduleAuthorityReview(state).pendingSchedules.some(item=>item.dateRelationship==='date_missing'));

    const baselineRevisionId=baseline.linkedArtifactId!,baselineDocument=state.evidenceDocuments.find(document=>document.linkedArtifactId===baselineRevisionId)!;
    store.reviewSchedulePurpose(project.projectId,baselineRevisionId,{
      expectedVersion:state.version,sourceHash:baselineDocument.sourceHashSha256,role:'baseline',approvalReference:'APP-'+index,
    });
    store.adoptSchedule(project.projectId,baselineRevisionId);
    state=store.get(project.projectId)!;review=scheduleAuthorityReview(state);
    assert.equal(state.activeEvidenceBasis['schedule:baseline']?.activeArtifactId,baselineRevisionId,'approved baseline must remain a separate governed basis');
    assert.equal(projectDataDate(state),project.laterDataDateIso,'formal baseline adoption must not roll back current submitted analytics');
    assert.equal(review.currentRevisionId,later.linkedArtifactId);assert.equal(review.authority,'submitted');
    assert.equal(state.evidenceDocuments.find(document=>document.linkedArtifactId===revised.linkedArtifactId)?.basisState,'candidate');

    const reported=reportingData(state,'j4-blind',{check:true}) as any;
    const contract=reported.reportingContract;
    assert.equal(contract.programmeRevisionId,later.linkedArtifactId);
    assert.equal(contract.programmeAuthority.authority,'submitted');
    assert.equal(reported.baselineComparison.revisionId,baselineRevisionId,'candidate revised baseline must not replace the approved baseline comparison');
    expected.set(project.projectId,{currentRevisionId:later.linkedArtifactId!,baselineRevisionId,dataDateIso:project.laterDataDateIso});
  }

  store=new RuntimeProjectStore({dataDir:dir,durable:false});
  for(const project of projects){
    const state=store.get(project.projectId)!;assert.ok(state,'J4 project must survive restart: '+project.projectId);
    const expectedState=expected.get(project.projectId)!;
    const review=scheduleAuthorityReview(state);
    assert.equal(projectDataDate(state),expectedState.dataDateIso,'restart changed current Data Date: '+project.projectId);
    assert.equal(review.currentRevisionId,expectedState.currentRevisionId);assert.equal(review.state,'submitted_current');assert.equal(review.authority,'submitted');
    assert.equal(state.activeEvidenceBasis['schedule:baseline']?.activeArtifactId,expectedState.baselineRevisionId);
    const reported=reportingData(state,'j4-blind-restart',{check:true}) as any;
    const contract=reported.reportingContract;
    assert.equal(contract.programmeRevisionId,expectedState.currentRevisionId);assert.equal(reported.baselineComparison.revisionId,expectedState.baselineRevisionId);
  }
});


test('J5 fresh blind project set: all 58 pages and Ask CMeng use one project truth',async t=>{
  const seed=defaultBlindSeed()+'::J5-ONE-TRUTH-58-PAGES-ASK';
  process.stdout.write('\nCMENG_J5_BLIND_PROJECT_SET_SEED='+seed+'\n');
  const {projects}=await generateBlindRound(seed,20);
  assert.equal(moduleRegistry.length,58,'J5 must cover the complete current 58-page registry');
  assert.equal(new Set(projects.map(project=>project.projectId)).size,20,'J5 requires 20 fresh project identities');
  assert.equal(new Set(projects.map(project=>project.scenario)).size,8,'J5 must cover all eight truth states');
  assert.equal(new Set(projects.map(project=>project.language)).size,3,'J5 must cover English, Arabic and mixed projects');

  const dir=mkdtempSync(join(tmpdir(),'cmeng-j5-one-truth-'));
  const askDir=mkdtempSync(join(tmpdir(),'cmeng-j5-ask-'));
  t.after(()=>{rmSync(dir,{recursive:true,force:true});rmSync(askDir,{recursive:true,force:true});});
  const store=new RuntimeProjectStore({dataDir:dir,durable:false});
  const user:AskSession={userId:'j5-blind-reader',workspaceId:'cmeng-projects',name:null,title:'Project Controls',company:null,allowModel:true};
  let modelCalls=0;
  const model:AskModel={
    plan:async()=>{modelCalls++;throw new Error('J5 deterministic truth question invoked paid AI planning');},
    explain:async()=>{modelCalls++;throw new Error('J5 deterministic truth question invoked paid AI explanation');},
  };
  const basePopulationKeys=['schedule_actual_events','source_records','execution_control','milestones','duration_weighted_progress','relationships','revisions'] as const;
  let pageChecks=0,askChecks=0;

  for(const project of projects){
    for(const document of project.documents){
      await store.ingestEvidenceFile({
        projectId:project.projectId,sourceFilename:document.filename,sourceRelativePath:document.filename,
        bytes:document.bytes,mediaType:document.mediaType,uploadedAt:'2041-12-31T00:00:00.000Z',uploadIntent:'add_update',
      });
    }
    await store.refreshSpreadsheetRegisters(project.projectId);
    const state=store.get(project.projectId)!;
    assert.ok(state,'J5 project retained: '+project.projectId);
    runtimeProjects.replace(state);

    const dataDate=projectDataDate(state),authority=scheduleAuthorityReview(state);
    assert.equal(dataDate,project.dataDateIso,'J5 canonical Data Date mismatch: '+project.projectId);
    assert.ok(authority.currentRevisionId,'J5 current programme must be established: '+project.projectId);
    assert.equal(authority.authority,'submitted','J5 ordinary generated programme must remain submitted authority: '+project.projectId);

    let referenceContract:any=null,referenceBaseline:any=null;
    for(const page of moduleRegistry){
      const result=moduleForProject(project.projectId,page.key),data=result.data as any;
      const contract=data?.reportingContract;
      assert.ok(contract,'J5 page missing reporting contract: '+project.projectId+' / '+page.key);
      assert.equal(contract.dataDateIso,dataDate,'J5 Data Date drift: '+project.projectId+' / '+page.key);
      assert.equal(contract.projectVersion,state.version,'J5 project-version drift: '+project.projectId+' / '+page.key);
      assert.equal(contract.programmeRevisionId,authority.currentRevisionId,'J5 programme-revision drift: '+project.projectId+' / '+page.key);
      assert.equal(contract.programmeAuthority?.authority,authority.authority,'J5 programme-authority drift: '+project.projectId+' / '+page.key);
      assert.equal(data?.scheduleAuthorityReview?.currentRevisionId,authority.currentRevisionId,'J5 page authority-review drift: '+project.projectId+' / '+page.key);
      const baseline=data?.baselineComparison??{state:'unresolved',revisionId:null};
      if(referenceBaseline===null)referenceBaseline={state:baseline.state,revisionId:baseline.revisionId??null};
      else assert.deepEqual({state:baseline.state,revisionId:baseline.revisionId??null},referenceBaseline,'J5 baseline truth drift: '+project.projectId+' / '+page.key);

      if(referenceContract===null){
        referenceContract=contract;
      }else{
        assert.equal(contract.configurationId,referenceContract.configurationId,'J5 analysis configuration drift: '+project.projectId+' / '+page.key);
        assert.deepEqual(contract.calendarResolution,referenceContract.calendarResolution,'J5 calendar resolution drift: '+project.projectId+' / '+page.key);
        assert.deepEqual(contract.completionAuthority,referenceContract.completionAuthority,'J5 completion authority drift: '+project.projectId+' / '+page.key);
        for(const key of basePopulationKeys){
          assert.deepEqual(contract.populations?.[key],referenceContract.populations?.[key],
            'J5 shared population drift: '+project.projectId+' / '+page.key+' / '+key);
        }
      }
      pageChecks++;
    }

    const engine=new ProjectAskEngine(new AskStore(join(askDir,project.projectId)),model);
    const dataDateAnswer=await engine.ask(project.projectId,user,{question:'What is the Data Date?'});
    const dateMetric=dataDateAnswer.sections.flatMap(section=>section.metrics).find(metric=>metric.id==='programme.dataDate');
    assert.equal(dataDateAnswer.providerStatus,'not_needed','J5 Data Date must stay deterministic: '+project.projectId);
    assert.equal(dataDateAnswer.telemetry?.aiInvoked,false,'J5 Data Date must not invoke AI: '+project.projectId);
    assert.equal(dataDateAnswer.scope.projectId,project.projectId,'J5 Ask project contamination: '+project.projectId);
    assert.equal(dataDateAnswer.scope.dataDate,dataDate,'J5 Ask Data Date scope drift: '+project.projectId);
    assert.equal(dataDateAnswer.scope.programmeRevision,authority.currentRevisionId,'J5 Ask programme revision drift: '+project.projectId);
    assert.equal(dateMetric?.value,dataDate,'J5 Ask Data Date value drift: '+project.projectId);
    askChecks++;

    const forecastPage:any=moduleForProject(project.projectId,'independent-forecast').data;
    const forecastAnswer=await engine.ask(project.projectId,user,{question:'What is current completion?'});
    assert.equal(forecastAnswer.providerStatus,'not_needed','J5 completion answer must stay deterministic: '+project.projectId);
    assert.equal(forecastAnswer.telemetry?.aiInvoked,false,'J5 completion answer must not invoke AI: '+project.projectId);
    const forecastSection=forecastAnswer.sections.find(section=>section.authorityId==='forecast');
    const forecastRow=forecastSection?.tables.find(table=>table.id==='forecast.position')?.rows[0];
    assert.equal(forecastRow?.submittedFinish,forecastPage.completionPosition?.submittedFinishIso??null,
      'J5 Ask/page submitted completion drift: '+project.projectId);
    assert.equal(forecastAnswer.scope.dataDate,dataDate,'J5 completion answer Data Date drift: '+project.projectId);
    assert.equal(forecastAnswer.scope.programmeRevision,authority.currentRevisionId,'J5 completion answer revision drift: '+project.projectId);
    askChecks++;
  }

  assert.equal(pageChecks,20*58,'J5 must inspect every page for every blind project');
  assert.equal(askChecks,20*2,'J5 must compare both deterministic Ask truths for every blind project');
  assert.equal(modelCalls,0,'J5 blind acceptance cannot be rescued by paid AI');
});

test('Batch J blind generator: same seed reproduces exact project truth, different seed changes it',async()=>{
  const a=await generateBlindRound('replay-seed-A',6);
  const b=await generateBlindRound('replay-seed-A',6);
  const c=await generateBlindRound('replay-seed-B',6);
  const manifest=(round:typeof a)=>round.projects.map(p=>({
    projectId:p.projectId,projectName:p.projectName,language:p.language,currency:p.currency,dataDateIso:p.dataDateIso,scenario:p.scenario,
    docs:p.documents.map(d=>({filename:d.filename,kind:d.kind,domain:d.domain,truth:d.truth})),truth:p.truth,
  }));
  assert.deepEqual(manifest(a),manifest(b),'same seed must reproduce the same blind round');
  assert.notDeepEqual(manifest(a),manifest(c),'different seed must produce a different blind round');
});
