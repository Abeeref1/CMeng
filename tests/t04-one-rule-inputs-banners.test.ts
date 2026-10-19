import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {governedTables} from '../packages/truth-kernel/src';
import {analyticalOperationalDocuments} from '../packages/runtime-api/src/operational-reporting';
import {weeklyResourceCapacityEvidence} from '../packages/runtime-api/src/resource-support-evidence';
import {deliveryRecords,deliveryCurrentRecord} from '../packages/runtime-api/src/delivery-records';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';

// A stored document as the store records it: parser and review state are
// always present. Each test changes only the one property it is about.
function stored(dir:string,id:string,body:string,extra:Record<string,unknown>={}){
 const bytes=Buffer.from(body),storedPath=join(dir,id+'.csv');writeFileSync(storedPath,bytes);
 return {documentId:id,sourceHashSha256:createHash('sha256').update(bytes).digest('hex'),storedPath,
  sourceFilename:id+'.csv',mediaType:'text/csv',basisState:'candidate',linkedArtifactId:null,
  uploadedAt:'2031-04-01',familyKey:'family-'+id,documentType:'payment_register',parserState:'parsed',
  identification:{needsReview:false},lineage:{needsReview:false},supersededByDocumentId:null,...extra} as any;
}
const payment=(id:string,amount:number)=>'invoice id,amount,currency,status\n'+id+','+amount+',SAR,open\n';

test('T04 one rule: governedTables holds a unique candidate that is not fully parsed or needs review, exactly as analysis does',()=>{
 const dir=mkdtempSync(join(tmpdir(),'t04-one-rule-'));
 try{
  const clean=stored(dir,'clean',payment('clean',100));
  const partial=stored(dir,'partial',payment('partial',200),{parserState:'partial'});
  const ocr=stored(dir,'ocr',payment('ocr',250),{parserState:'ocr_pending'});
  const idReview=stored(dir,'idreview',payment('idreview',300),{identification:{needsReview:true}});
  const lineReview=stored(dir,'linereview',payment('linereview',400),{lineage:{needsReview:true}});
  const replaced=stored(dir,'replaced',payment('replaced',500),{supersededByDocumentId:'newer'});
  const adopted=stored(dir,'adopted',payment('adopted',600),{basisState:'active'});
  const docs=[clean,partial,ocr,idReview,lineReview,replaced,adopted];
  const diagnostics:string[]=[];
  const used=governedTables(docs,diagnostics).map(t=>t.document.documentId).sort();
  assert.deepEqual(used,['adopted','clean'],'only the adopted and the clean, fully read unique candidate are used');
  assert.ok(diagnostics.includes('CANDIDATE_NOT_FULLY_READ:partial:partial'));
  assert.ok(diagnostics.includes('CANDIDATE_NOT_FULLY_READ:ocr:ocr_pending'));
  assert.ok(diagnostics.includes('CANDIDATE_REVIEW_REQUIRED:idreview'));
  assert.ok(diagnostics.includes('CANDIDATE_REVIEW_REQUIRED:linereview'));
  assert.ok(diagnostics.includes('CANDIDATE_SUPERSEDED:replaced'));
  // Same single rule as the operational analysis selection.
  assert.deepEqual(analyticalOperationalDocuments(docs).map(d=>d.documentId).sort(),used);
  // A candidate whose parse state was never recorded is not proven read.
  const unrecorded={...stored(dir,'unrecorded',payment('unrecorded',700))};delete unrecorded.parserState;
  const held:string[]=[];
  assert.deepEqual(governedTables([unrecorded],held),[]);
  assert.ok(held.includes('CANDIDATE_NOT_FULLY_READ:unrecorded:unrecorded'));
  for(const d of docs)assert.ok(['candidate','active'].includes(d.basisState),'no stored authority is changed');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

const resourceCsv=(rows:string[])=>'resource id,resource name,week start,available capacity,planned demand,unit\n'+rows.join('\n')+'\n';
const resourceDoc=(dir:string,id:string,rows:string[],extra:Record<string,unknown>={})=>
 stored(dir,id,resourceCsv(rows),{documentType:'resource_register',sourceFilename:'resource_capacity_'+id+'.csv',...extra});

test('T04 resource capacity: adopted wins per resource and week, a differing candidate is shown as a disagreement, held candidates are not used',()=>{
 const dir=mkdtempSync(join(tmpdir(),'t04-resource-one-rule-'));
 try{
  const adopted=resourceDoc(dir,'adopted',['R1,Crane,2031-01-06,40,30,H'],{basisState:'active',familyKey:'resource-adopted'});
  const extra=resourceDoc(dir,'extra',['R1,Crane,2031-01-06,60,50,H','R2,Welder,2031-01-06,10,5,H'],{familyKey:'resource-extra'});
  const summary=weeklyResourceCapacityEvidence([adopted,extra]);
  const r1=summary.points.find(p=>p.resourceId==='R1')!;
  assert.equal(r1.availableCapacity,40,'adopted capacity is used');
  assert.equal(r1.plannedDemand,30,'adopted demand is used');
  assert.equal(r1.sourceRef,'evidence-document:adopted:row:2','candidate row is not merged into the adopted point');
  assert.equal(summary.points.find(p=>p.resourceId==='R2')?.availableCapacity,10,'candidate-only resource remains usable');
  const fields=(summary.basisDisagreements??[]).map(d=>d.field+':'+d.adoptedValue+':'+d.candidateValue).sort();
  assert.deepEqual(fields,['availableCapacity:40:60','plannedDemand:30:50'],'the disagreement is shown with both values');
  assert.ok(summary.diagnostics.includes('RESOURCE_CANDIDATE_DISAGREES_WITH_ADOPTED:R1:2031-01-06T00:00:00.000Z:availableCapacity'));
  // Competing and review-needed candidates never enter capacity totals.
  const first=resourceDoc(dir,'first',['R3,Pump,2031-01-06,8,4,H'],{familyKey:'resource-competing'});
  const second=resourceDoc(dir,'second',['R3,Pump,2031-01-06,12,6,H'],{familyKey:'resource-competing'});
  const review=resourceDoc(dir,'review',['R4,Loader,2031-01-06,9,3,H'],{familyKey:'resource-review',identification:{needsReview:true}});
  const partial=resourceDoc(dir,'partial',['R5,Truck,2031-01-06,7,2,H'],{familyKey:'resource-partial',parserState:'partial'});
  const held=weeklyResourceCapacityEvidence([first,second,review,partial]);
  assert.equal(held.state,'not_found');
  assert.equal(held.points.length,0,'no held candidate is used');
  for(const id of ['first','second','review','partial'])
   assert.ok(held.diagnostics.some(d=>d.startsWith('RESOURCE_SUPPORT_CANDIDATE_HELD:')&&d.includes(id)),'hold for '+id+' is reported');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('T04 delivery: procurement records from a candidate are current only under the shared rule (look-ahead blockers)',t=>{
 const root=mkdtempSync(join(tmpdir(),'t04-delivery-one-rule-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false});
 const csv=(id:string)=>'package id,package name,status\nPKG-'+id+',Package '+id+',open\n';
 const doc=(id:string,extra:Record<string,unknown>={})=>stored(root,id,csv(id),{documentType:'procurement_register',familyKey:'procurement-'+id,...extra});
 const current=(name:string,docs:any[])=>{
  const state=store.getOrCreate('T04-DEL-'+name);
  state.evidenceDocuments.push(...docs);store.touch(state);
  return deliveryRecords(state).records.filter(r=>r.kind==='package').map(r=>[r.reference,deliveryCurrentRecord(r),r.diagnostics.join(' ')] as const);
 };
 const clean=current('CLEAN',[doc('clean')]);
 assert.deepEqual(clean.map(r=>[r[0],r[1]]),[['PKG-clean',true]],'clean unique candidate is used without adoption');
 const partial=current('PARTIAL',[doc('partial',{parserState:'partial'})]);
 assert.equal(partial[0]?.[1],false,'partly read candidate is not a current procurement record');
 assert.match(partial[0]?.[2]??'',/held for review \(not_fully_read\)/);
 const review=current('REVIEW',[doc('review',{lineage:{needsReview:true}})]);
 assert.equal(review[0]?.[1],false,'lineage-review candidate is not current');
 const competing=current('COMPETING',[doc('a',{familyKey:'procurement-shared'}),doc('b',{familyKey:'procurement-shared'})]);
 assert.deepEqual(competing.map(r=>r[1]),[false,false],'competing candidates of one family are never both current');
 assert.ok(competing.every(r=>/family_conflict/.test(r[2])));
});
