import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {reportingReadinessEvidence} from '../packages/runtime-api/src/evidence-readiness';
import {securityValidityReview} from '../packages/runtime-api/src/security-validity';
import {analyticalOperationalDocuments} from '../packages/runtime-api/src/operational-reporting';
import {scheduleRiskMonteCarlo} from '../packages/runtime-api/src/schedule-risk-monte-carlo';

// T04: a clearly read, unique candidate source in a NON-site family is used in
// analysis through the same shared rule as the site registers, labelled as read
// from source and not formally adopted. Competing candidates stay held.
const doc=(dir:string,projectId:string,name:string,body:string,documentType:string,familyKey:string,category='procurement',basisState='candidate')=>{
  const raw=Buffer.from(body),hash=createHash('sha256').update(raw).digest('hex');
  const path=join(dir,projectId+'-'+name+'.csv');
  writeFileSync(path,raw);
  return {
    documentId:projectId+':'+name,category,documentType,
    sourceFilename:name+'.csv',sourceRelativePath:name+'.csv',mediaType:'text/csv',
    storedPath:path,sourceHashSha256:hash,sizeBytes:raw.length,uploadedAt:'2031-04-30T00:00:00Z',
    authority:'candidate_only',parserState:'parsed',basisState,familyKey,
    logicalDocumentKey:name,supersededByDocumentId:null,
    identification:{needsReview:false},lineage:{needsReview:false},sourceRefs:[],
  } as any;
};
const register=(pkg:string,delivered:string)=>[
  'package id,linked activity,status,required on site,actual delivery,raised date',
  pkg+',A100,delivered,2031-04-20,'+delivered+',2031-03-01',
].join('\n')+'\n';

test('T04 unique clearly read procurement register candidate is used in readiness analysis and labelled not formally adopted',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-t04-all-'));
  try{
    const store=new RuntimeProjectStore({durable:false});
    const state=store.getOrCreate('T04-ALL-FAMILIES-A');
    const source=doc(dir,state.projectId,'procurement',register('PKG-1','2031-04-10'),'procurement_register','procurement:register');
    state.evidenceDocuments.push(source);
    const snapshot=JSON.stringify(state.evidenceDocuments);
    const readiness=reportingReadinessEvidence(state,'2031-04-30');
    const material=readiness['A100']?.procurement_material;
    assert.ok(material,'clear source facts must not be held behind a formal-adoption step');
    assert.equal(material.state,'ready','dated actual delivery on or before the Data Date is used');
    assert.ok(material.sourceRefs.some(ref=>ref.startsWith('evidence-document:'+source.documentId+':')),'source reference retained');
    assert.ok((material.diagnostics??[]).includes('SOURCE_ANALYTICAL_NOT_ADOPTED:'+source.documentId),'labelled as read from source, not adopted');
    assert.match(material.note??'',/not formally adopted/);
    assert.ok((material.records??[]).every(r=>/not formally adopted/.test(r.note)),'every record keeps the qualification');
    assert.equal(JSON.stringify(state.evidenceDocuments),snapshot,'stored basisState and authority unchanged');
    assert.equal(state.evidenceDocuments[0]!.basisState,'candidate');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('T04 competing procurement register candidates stay held; an adopted source is not labelled as unadopted',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-t04-all-'));
  try{
    const store=new RuntimeProjectStore({durable:false});
    const state=store.getOrCreate('T04-ALL-FAMILIES-B');
    state.evidenceDocuments.push(
      doc(dir,state.projectId,'rev-a',register('PKG-1','2031-04-10'),'procurement_register','procurement:register'),
      doc(dir,state.projectId,'rev-b',register('PKG-1','2031-04-12'),'procurement_register','procurement:register'));
    assert.equal(analyticalOperationalDocuments(state.evidenceDocuments).length,0,'two competing candidates are not merged or picked');
    assert.equal(reportingReadinessEvidence(state,'2031-04-30')['A100']?.procurement_material,undefined,
      'competing revisions remain held for the existing decision');
    assert.ok(state.evidenceDocuments.every(d=>d.basisState==='candidate'),'held, not adopted or demoted');
    state.evidenceDocuments[0]!.basisState='active';
    const adopted=reportingReadinessEvidence(state,'2031-04-30')['A100']?.procurement_material;
    assert.equal(adopted?.state,'ready');
    assert.ok(!(adopted?.diagnostics??[]).some(d=>d.startsWith('SOURCE_ANALYTICAL_NOT_ADOPTED:')),'adopted source carries no unadopted label');
    const review=store.getOrCreate('T04-ALL-FAMILIES-C');
    const needsReview=doc(dir,review.projectId,'needs-review',register('PKG-1','2031-04-10'),'procurement_register','procurement:register');
    needsReview.lineage.needsReview=true;
    review.evidenceDocuments.push(needsReview);
    assert.equal(reportingReadinessEvidence(review,'2031-04-30')['A100']?.procurement_material,undefined,'a source needing review stays held');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('T04 unique clearly read contract candidate takes part in the security review, labelled not formally adopted',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-t04-all-'));
  try{
    const store=new RuntimeProjectStore({durable:false});
    const state=store.getOrCreate('T04-ALL-FAMILIES-D');
    const contract=doc(dir,state.projectId,'contract','contract text','contract_conditions','contract:main','contract');
    state.evidenceDocuments.push(contract);
    (state.contractDocuments as any[]).push({documentId:contract.documentId,role:'main',
      result:{sections:[{heading:'Performance Security',text:'The Performance Security shall remain valid until the Performance Certificate is issued.',startPage:4}]}});
    const bonds=[{bondId:'PB-1',kind:'performance',status:'active',expiryIso:'2031-12-01',sourceRefs:[]}] as any;
    const [row]=securityValidityReview(state,bonds,'2031-11-30');
    assert.equal(row?.state,'review_required','the read contract requirement is used, not withheld');
    assert.ok(row?.sourceRefs.some(ref=>ref.startsWith('evidence-document:'+contract.documentId+':')));
    assert.equal((row as any)?.sourceAnalyticalUse,'qualified_source_read','labelled as read from source, not adopted');
    assert.equal(state.evidenceDocuments[0]!.basisState,'candidate','contract authority unchanged');
    const second=doc(dir,state.projectId,'contract-b','contract text b','contract_conditions','contract:main','contract');
    state.evidenceDocuments.push(second);
    (state.contractDocuments as any[]).push({documentId:second.documentId,role:'main',
      result:{sections:[{heading:'Performance Security',text:'The Performance Security shall remain valid until the Performance Certificate is issued.',startPage:4}]}});
    const [held]=securityValidityReview(state,bonds,'2031-11-30');
    assert.equal(held?.state,'requirement_not_established','competing contract candidates stay held');
    assert.equal((held as any)?.sourceAnalyticalUse,undefined);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('T04 a package link read only from a candidate procurement register labels the adopted submittal readiness it drives',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-t04-all-'));
  try{
    const store=new RuntimeProjectStore({durable:false});
    const state=store.getOrCreate('T04-ALL-FAMILIES-S2');
    state.evidenceDocuments.push(
      doc(dir,state.projectId,'submittals','submittal id,package id,status,submitted date,approval date\nSUB-1,PKG-9,approved,2031-03-01,2031-03-20\n','submittal_register','design:submittal_register','design','active'),
      doc(dir,state.projectId,'procurement','package id,linked activity,status,required on site,raised date\nPKG-9,A900,ordered,2031-06-20,2031-03-01\n','procurement_register','procurement:procurement_register'));
    const submittal=reportingReadinessEvidence(state,'2031-04-30')['A900']?.design_submittal;
    assert.ok(submittal,'the clear candidate link is used');
    assert.ok((submittal.diagnostics??[]).includes('SOURCE_ANALYTICAL_NOT_ADOPTED:'+state.projectId+':procurement'),'result depending on the candidate link is labelled');
    assert.match(submittal.note??'',/not formally adopted/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('T04 an adopted readiness position is kept when a candidate disagrees, and the disagreement names the unadopted source',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-t04-all-'));
  try{
    const store=new RuntimeProjectStore({durable:false});
    const state=store.getOrCreate('T04-ALL-FAMILIES-S1');
    state.evidenceDocuments.push(
      doc(dir,state.projectId,'adopted',register('PKG-1','2031-04-10'),'procurement_register','procurement:register','procurement','active'),
      doc(dir,state.projectId,'other-family',['package id,linked activity,status,required on site,actual delivery,raised date','PKG-1,A100,on hold,2031-04-20,,2031-03-01'].join('\n')+'\n','procurement_register','procurement:other-register'));
    const material=reportingReadinessEvidence(state,'2031-04-30')['A100']?.procurement_material;
    assert.equal(material?.state,'ready','the adopted position is not replaced or worsened by a candidate');
    assert.ok((material?.diagnostics??[]).includes('UNADOPTED_SOURCE_READINESS_DIFFERS:'+state.projectId+':other-family'),'conflict names the unadopted source');
    assert.ok(!(material?.diagnostics??[]).some(d=>d.startsWith('SOURCE_ANALYTICAL_NOT_ADOPTED:')),'adopted value is not labelled as unadopted');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('T04 contract security review keeps the adopted defects period when a candidate states a different one',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-t04-all-'));
  try{
    const store=new RuntimeProjectStore({durable:false});
    const state=store.getOrCreate('T04-ALL-FAMILIES-SEC');
    const adopted=doc(dir,state.projectId,'contract','a','contract_conditions','contract:main','contract','active');
    const candidate=doc(dir,state.projectId,'particulars','b','contract_particulars','contract:particulars','contract');
    state.evidenceDocuments.push(adopted,candidate);
    (state.contractDocuments as any[]).push(
      {documentId:adopted.documentId,role:'main',result:{sections:[{heading:'Performance Security',text:'The Performance Security shall remain valid until the Performance Certificate is issued. Defects Notification Period is 12 months.',startPage:4}]}},
      {documentId:candidate.documentId,role:'amendment',result:{sections:[{heading:'Particulars',text:'Defects Notification Period is 24 months.',startPage:2}]}});
    const bonds=[{bondId:'PB-1',kind:'performance',status:'active',expiryIso:'2031-12-01',sourceRefs:[]}] as any;
    const [row]=securityValidityReview(state,bonds,'2031-06-30') as any[];
    assert.equal(row.assumedDefectsEndIso,'2032-06-30','adopted 12-month period kept, not nulled by the candidate');
    assert.ok(row.sourceConflicts.some((c:string)=>c.startsWith('UNADOPTED_SOURCE_DEFECTS_PERIOD_DIFFERS:24 month:evidence-document:'+candidate.documentId+':')));
    assert.equal(row.sourceAnalyticalUse,undefined,'the adopted requirement is not labelled as unadopted');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

function calendarXer(){
  const cal='(0||CalendarData()((0||DaysOfWeek()('+[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()((0||0(s|08:00|f|16:00)())))').join('')+'))))';
  return ['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tRISK\t2030-01-01 08:00',
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\t1\tSource calendar\t8\t56\t'+cal,
    '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttask_type\tstatus_code\tclndr_id\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tearly_start_date\tearly_end_date',
    '%R\t1\t1\tA\tFoundation work\tTT_Task\tTK_NotStart\t1\t160\t160\t0\t2030-01-01 08:00\t2030-01-20 16:00','%E'].join('\n');
}
test('T04 Monte Carlo uses a unique candidate range labelled, holds competing and superseded ones, and never lets a candidate erase an adopted range',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-t04-all-'));
  try{
    const store=new RuntimeProjectStore({durable:false});
    const range='activity id,min factor,most likely factor,max factor\nA,0.9,1.1,1.6\n',range2='activity id,min factor,most likely factor,max factor\nA,0.9,1.2,1.8\n';
    const run=async(id:string,docs:(id:string)=>any[])=>{
      await store.ingestSchedule({projectId:id,sourceFilename:'programme.xer',bytes:Buffer.from(calendarXer()),mediaType:'text/plain',uploadedAt:'2030-01-01',role:'update',uploadIntent:'replace_current_basis'} as any);
      const s=store.get(id)!;for(const d of docs(id))s.evidenceDocuments.push(d);s.version++;
      return (scheduleRiskMonteCarlo(s,{iterations:100,seed:7,minFactor:.8,modeFactor:1,maxFactor:1.3}).data as any).uncertainty;
    };
    const unique=await run('T04-MC-UNIQUE',id=>[doc(dir,id,'ranges',range,'schedule_metric_register','schedule:metrics','schedule')]);
    assert.equal(unique.sourceCoveredActivityCount,1,'clear candidate range is used');
    assert.equal(unique.sourceAnalyticalUse,'qualified_source_read');
    assert.deepEqual(unique.sourceAnalyticalDocumentIds,['T04-MC-UNIQUE:ranges']);
    const competing=await run('T04-MC-COMPETING',id=>[doc(dir,id,'ranges-a',range,'schedule_metric_register','schedule:metrics','schedule'),doc(dir,id,'ranges-b',range2,'schedule_metric_register','schedule:metrics','schedule')]);
    assert.equal(competing.sourceCoveredActivityCount,0,'competing candidates stay held');
    assert.equal(competing.sourceAnalyticalUse,undefined);
    const superseded=await run('T04-MC-SUPERSEDED',id=>[{...doc(dir,id,'ranges',range,'schedule_metric_register','schedule:metrics','schedule'),supersededByDocumentId:'later'}]);
    assert.equal(superseded.sourceCoveredActivityCount,0,'a superseded candidate stays held');
    const mixed=await run('T04-MC-MIXED',id=>[doc(dir,id,'ranges',range,'schedule_metric_register','schedule:metrics','schedule','active'),doc(dir,id,'risk-ranges',range2,'risk_register','risk:register','risk')]);
    assert.equal(mixed.authority,'source_ranges','adopted range kept');
    assert.equal(mixed.sourceCoveredActivityCount,1);
    assert.ok(mixed.conflicts.includes('UNADOPTED_SOURCE_RANGE_DIFFERS:A:T04-MC-MIXED:risk-ranges'),'candidate disagreement is shown, naming the unadopted source');
    assert.ok(!mixed.conflicts.includes('CONFLICTING_UNCERTAINTY_RANGE:A'),'the adopted range is not erased as a conflict');
    assert.equal(mixed.sourceAnalyticalUse,undefined,'adopted range not labelled as unadopted');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
