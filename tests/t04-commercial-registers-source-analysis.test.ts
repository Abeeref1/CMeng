import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {rebuildDerivedControls,deriveControlsFromCsv,commercialSourceReadConflicts} from '../packages/runtime-api/src/evidence-control-adapters';
import {tenderReadinessForState} from '../packages/runtime-api/src/tender-readiness';
import {projectActions} from '../packages/runtime-api/src/project-actions';

// T04: commercial registers read clearly from ONE unique source that is not
// formally adopted are saved into project state through the shared rule
// (analyticalOperationalDocuments), labelled "read from source; not formally
// adopted". Adopted records always win; disagreements go to the existing
// document decision naming the unadopted source; competing sources stay held.
const doc=(projectId:string,name:string,documentType:string,familyKey:string,basisState='candidate',body='')=>({
  documentId:projectId+':'+name,category:'commercial',documentType,
  sourceFilename:name+'.csv',sourceRelativePath:name+'.csv',mediaType:'text/csv',
  storedPath:'/nonexistent/'+name+'.csv',sourceHashSha256:createHash('sha256').update(name+body).digest('hex'),sizeBytes:body.length,
  uploadedAt:'2031-04-30T00:00:00Z',authority:'candidate_only',parserState:'parsed',basisState,familyKey,
  logicalDocumentKey:name,supersededByDocumentId:null,identification:{needsReview:false},lineage:{needsReview:false},sourceRefs:[],diagnostics:[],
} as any);
const ref=(id:string,row:number)=>['evidence-document:'+id+':CSV:row:'+row];
const variationCsv=(amount:number)=>'variation id,currency,approved amount,status\nVO-1,SAR,'+amount+',approved\n';
const withVariations=(state:any,document:any,amount:number)=>{
  state.evidenceDocuments.push(document);
  const derived=deriveControlsFromCsv({state,document,bytes:Buffer.from(variationCsv(amount))});
  assert.equal(derived.variations?.length,1,'the real register reader produces the variation');
  state.derivedControlsByDocument[document.documentId]=derived;
  return derived;
};
const LABEL='qualified_source_read';

test('T04 every commercial register read from a unique unadopted source is saved into project state, labelled, without changing basisState',()=>{
  const state=new RuntimeProjectStore({durable:false}).getOrCreate('T04-COMMERCIAL-A') as any;
  const p=state.projectId;
  withVariations(state,doc(p,'variations','variation_register','commercial:variations'),250000);
  const pay=doc(p,'payments','payment_certificates','commercial:payments'),ret=doc(p,'retention','retention_register','commercial:retention'),
    bond=doc(p,'bonds','bond_register','commercial:bonds'),claim=doc(p,'claims','claim_register','commercial:claims'),
    delay=doc(p,'delay-claims','eot_claim_register','claims:delay');
  state.evidenceDocuments.push(pay,ret,bond,claim,delay);
  state.derivedControlsByDocument[pay.documentId]={invoices:[{invoiceId:'IPC-1',currency:'SAR',certifiedAmount:900000,paidAmount:800000,certificateDateIso:'2031-03-31',paymentDateIso:'2031-04-20',sourceRefs:ref(pay.documentId,1)}]};
  state.derivedControlsByDocument[ret.documentId]={retentions:[{retentionId:'RET-1',amount:90000,currency:'SAR',state:'held',sourceRefs:ref(ret.documentId,1)}]};
  state.derivedControlsByDocument[bond.documentId]={bonds:[{bondId:'PB-1',kind:'performance',status:'active',amount:1000000,currency:'SAR',expiryIso:'2032-01-31',sourceRefs:ref(bond.documentId,1)}]};
  state.derivedControlsByDocument[claim.documentId]={claimCommercials:[{claimId:'CL-1',currency:'SAR',claimedAmount:500000,assessedAmount:null,sourceRefs:ref(claim.documentId,1)}]};
  state.derivedControlsByDocument[delay.documentId]={delayClaims:{projectId:p,evidenceRevisionId:'evidence-document:'+delay.documentId,events:[],notices:[],noticeRequirements:[],diagnostics:[],
    claims:[{claimId:'CL-1',claimedDays:40,claimedAmount:500000,assessedDays:20,assessedDaysState:'official',assessedAmount:300000,assessedAmountState:'official'}]}};
  const snapshot=JSON.stringify(state.evidenceDocuments);
  rebuildDerivedControls(state);
  const c=state.controls;
  for(const [kind,rows] of Object.entries({variations:c.variations,invoices:c.invoices,retentions:c.retentions,bonds:c.bonds,claimCommercials:c.claimCommercials}) as Array<[string,any[]]>){
    assert.equal(rows.length,1,kind+': the clear unique source is used in analysis, not held for approval');
    assert.equal(rows[0].sourceAnalyticalUse,LABEL,kind+' keeps the not-adopted label');
    assert.match(rows[0].sourceAnalyticalNote,/^Read from source; not formally adopted$/);
    assert.ok(rows[0].sourceRefs.every((r:string)=>r.startsWith('evidence-document:')),kind+' keeps its source reference');
  }
  assert.equal(c.variations[0].amount,250000);assert.equal(c.invoices[0].certifiedAmount,900000);assert.equal(c.invoices[0].paidAmount,800000,'submitted/paid stays apart from certified');
  assert.equal(c.claimCommercials[0].claimedAmount,500000);assert.equal(c.claimCommercials[0].assessedAmount,null,'unknown assessment stays unknown, never 0');
  assert.ok(c.delayClaims,'delay/claim population read from source is used');
  assert.ok(c.delayClaims.diagnostics.includes('SOURCE_ANALYTICAL_NOT_ADOPTED:'+delay.documentId));
  assert.equal(c.delayClaims.claims[0].assessedAmountState,'candidate','a reading never shows as an official determination');
  assert.equal(c.delayClaims.claims[0].assessedDaysState,'candidate');
  assert.equal(c.delayClaims.claims[0].assessedAmount,300000,'the read figure is kept, only its authority is qualified');
  assert.equal(JSON.stringify(state.evidenceDocuments),snapshot,'stored basisState and authority unchanged');
  assert.deepEqual(commercialSourceReadConflicts(state),[],'no decision is raised for clear facts');
  // A rebuild is idempotent: labelled rows are re-derived, never kept as manual records.
  rebuildDerivedControls(state);
  assert.equal(state.controls.variations.length,1);assert.equal(state.controls.invoices.length,1);
});

test('T04 an adopted record is never overridden or erased by a candidate; the disagreement goes to the document decision naming the unadopted source',()=>{
  const state=new RuntimeProjectStore({durable:false}).getOrCreate('T04-COMMERCIAL-B') as any;
  const p=state.projectId;
  const adopted=doc(p,'vo-adopted','variation_register','commercial:variations','active');
  const unadopted=doc(p,'vo-site-copy','variation_register','commercial:variation-site');
  withVariations(state,adopted,100000);withVariations(state,unadopted,150000);
  rebuildDerivedControls(state);
  assert.equal(state.controls.variations.length,1);
  const vo=state.controls.variations[0];
  assert.equal(vo.amount,100000,'adopted value kept');
  assert.equal(vo.sourceAnalyticalUse,undefined,'adopted record carries no unadopted label');
  assert.ok(vo.sourceRefs.every((r:string)=>r.startsWith('evidence-document:'+adopted.documentId+':')));
  const conflicts=commercialSourceReadConflicts(state);
  assert.equal(conflicts.length,1);
  assert.equal(conflicts[0]!.documentId,unadopted.documentId,'names the unadopted source');
  assert.equal(conflicts[0]!.against,'adopted');assert.deepEqual(conflicts[0]!.againstDocumentIds,[adopted.documentId]);
  const action=projectActions(state,{issues:[]} as any).actions.find((a:any)=>a.id==='document:'+unadopted.documentId);
  assert.ok(action,'the existing document decision is the one decision place');
  assert.ok((action.evidenceSummary??[]).some((line:string)=>/Differs from adopted variations record VO-1 \(vo-adopted\.csv\); unadopted source vo-site-copy\.csv/.test(line)),
    'decision names the record, the adopted source and the unadopted source');
  // Same reading as the adopted record is not a conflict.
  state.derivedControlsByDocument[unadopted.documentId]=deriveControlsFromCsv({state,document:unadopted,bytes:Buffer.from(variationCsv(100000))});
  assert.deepEqual(commercialSourceReadConflicts(state),[]);
});

test('T04 competing unadopted commercial sources stay held: never merged, ranked or picked',()=>{
  const state=new RuntimeProjectStore({durable:false}).getOrCreate('T04-COMMERCIAL-C') as any;
  const p=state.projectId;
  // Two revisions of the same family are a competing pair (shared rule).
  withVariations(state,doc(p,'rev-a','variation_register','commercial:variations'),100000);
  withVariations(state,doc(p,'rev-b','variation_register','commercial:variations'),120000);
  rebuildDerivedControls(state);
  assert.equal(state.controls.variations.length,0,'competing revisions remain held');
  // Two unique sources of different families disagreeing on one record are both held.
  const a=doc(p,'pay-a','payment_certificates','commercial:payments-a'),b=doc(p,'pay-b','payment_certificates','commercial:payments-b');
  state.evidenceDocuments.push(a,b);
  state.derivedControlsByDocument[a.documentId]={invoices:[{invoiceId:'IPC-1',currency:'SAR',certifiedAmount:900000,paidAmount:null,sourceRefs:ref(a.documentId,1)}]};
  state.derivedControlsByDocument[b.documentId]={invoices:[{invoiceId:'IPC-1',currency:'SAR',certifiedAmount:950000,paidAmount:null,sourceRefs:ref(b.documentId,1)}]};
  rebuildDerivedControls(state);
  assert.equal(state.controls.invoices.length,0,'neither disagreeing reading is used');
  const conflicts=commercialSourceReadConflicts(state).filter(x=>x.kind==='invoices');
  assert.deepEqual(conflicts.map(x=>x.documentId).sort(),[a.documentId,b.documentId].sort());
  assert.ok(conflicts.every(x=>x.against==='source_read'));
  // A review-needed or superseded source stays held.
  const review=doc(p,'bond-review','bond_register','commercial:bonds');review.identification={needsReview:true};
  const old=doc(p,'ret-old','retention_register','commercial:retention');old.supersededByDocumentId='x';
  state.evidenceDocuments.push(review,old);
  state.derivedControlsByDocument[review.documentId]={bonds:[{bondId:'PB-1',kind:'performance',status:'active',amount:1,currency:'SAR',expiryIso:null,sourceRefs:ref(review.documentId,1)}]};
  state.derivedControlsByDocument[old.documentId]={retentions:[{retentionId:'RET-1',amount:1,currency:'SAR',state:'held',sourceRefs:ref(old.documentId,1)}]};
  rebuildDerivedControls(state);
  assert.equal(state.controls.bonds.length,0);assert.equal(state.controls.retentions.length,0);
  assert.ok(state.evidenceDocuments.every((d:any)=>d.basisState==='candidate'),'held, not adopted or demoted');
});

test('T04 tender readiness uses a clear unadopted source with its label; competing sources stay partial',()=>{
  const state=new RuntimeProjectStore({durable:false}).getOrCreate('T04-COMMERCIAL-D') as any;
  const p=state.projectId;
  state.evidenceDocuments.push(doc(p,'manpower-plan','resource_plan','resources:manpower'));
  const criterion=()=>(tenderReadinessForState(state).data as any).criteria.find((c:any)=>c.key==='resources-manpower');
  const used=criterion();
  assert.equal(used.state,'established','a clearly read resource source counts in the evidence checklist');
  assert.equal(used.sourceAnalyticalUse,LABEL);
  assert.match(used.availableEvidence,/read from source; not formally adopted/);
  state.evidenceDocuments.push(doc(p,'manpower-plan-rev','resource_plan','resources:manpower'));
  const held=criterion();
  assert.equal(held.state,'partial','competing resource sources stay held');
  assert.equal(held.sourceAnalyticalUse,undefined);
  state.evidenceDocuments[0].basisState='active';
  const adopted=criterion();
  assert.equal(adopted.state,'established');assert.equal(adopted.sourceAnalyticalUse,undefined,'adopted source is not labelled unadopted');
});
