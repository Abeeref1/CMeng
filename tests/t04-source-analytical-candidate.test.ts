import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {analyticalOperationalDocuments,operationalControlsAsOf} from '../packages/runtime-api/src/operational-reporting';

const makeDoc=(dir:string,projectId:string,name:string,body:string,basisState:'active'|'candidate'|'superseded',status:'parsed'|'partial'='parsed')=>{
  const raw=Buffer.from(body),hash=createHash('sha256').update(raw).digest('hex');
  const path=join(dir,projectId+'-'+name+'.csv');
  writeFileSync(path,raw);
  return {
    documentId:projectId+':'+name,category:'construction',documentType:'quality_ncr_register',
    sourceFilename:name+'.csv',sourceRelativePath:name+'.csv',mediaType:'text/csv',
    storedPath:path,sourceHashSha256:hash,sizeBytes:raw.length,uploadedAt:'2031-04-30T00:00:00Z',
    authority:'candidate_only',parserState:status,basisState,familyKey:'quality:ncr',
    logicalDocumentKey:name,supersededByDocumentId:null,
    identification:{needsReview:false},lineage:{needsReview:false},sourceRefs:[],
  } as any;
};
const row=(id:string,status='open')=>['ncr id,severity,status,raised date,due date',id+',major,'+status+',2031-04-01,2031-04-25'].join('\n')+'\n';

test('T04 unique clean source candidate is read into qualified current analysis without silently adopting it',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-t04-'));
  try{
    const store=new RuntimeProjectStore({durable:false});
    const state=store.getOrCreate('T04-SOURCE-READ-A');
    const source=makeDoc(dir,state.projectId,'sole-candidate',row('NCR-123'),'candidate');
    state.evidenceDocuments.push(source);
    const snapshot=JSON.stringify(state.evidenceDocuments);
    const eligible=analyticalOperationalDocuments(state.evidenceDocuments);
    assert.deepEqual(eligible.map(d=>d.documentId),[source.documentId]);
    const report=operationalControlsAsOf(state,'2031-04-30');
    assert.equal(report.quality.sourceRecordCount,1,'one original NCR row read');
    assert.equal(report.quality.currentRecordCount,1,'dated source contributes to as-of analytical population');
    assert.equal(report.quality.current[0]?.ncrId,'NCR-123');
    assert.equal(report.knownCounts.openNcrCount,1,'known active NCR must not disappear behind confirmation');
    assert.equal(report.quality.sourceAnalyticalOnly,true,'source analytical use is NOT formal adoption');
    assert.equal(report.quality.state,'partial','an unadopted source never certifies a complete register');
    assert.equal(report.quality.complete,false);
    assert.equal(report.counts.openNcrCount,null,'no false zero or unapproved complete-population claim');
    assert.equal(JSON.stringify(state.evidenceDocuments),snapshot,'persistent source authority and rows unchanged');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('T04 conflicting candidate revisions stay withheld; an existing active source is not displaced',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-t04-'));
  try{
    const make=(id:string,names:string[])=>{
      const store=new RuntimeProjectStore({durable:false});
      const state=store.getOrCreate(id);
      state.evidenceDocuments.push(...names.map((n,i)=>makeDoc(dir,id,n,row(n,i%2?'closed':'open'),'candidate')));
      return state;
    };
    const conflicting=make('T04-AMBIGUOUS',['v1','v2']);
    assert.equal(analyticalOperationalDocuments(conflicting.evidenceDocuments).length,0,
      'two unadopted same-family candidates cannot be merged or arbitrarily selected');
    const report=operationalControlsAsOf(conflicting,'2031-04-30');
    assert.equal(report.quality.state,'missing');
    assert.equal(report.counts.openNcrCount,null,'conflict cannot become a zero');
    const active=make('T04-EXISTING',['older','pending']);
    active.evidenceDocuments[0]!.basisState='active';
    assert.deepEqual(analyticalOperationalDocuments(active.evidenceDocuments).map(d=>d.sourceFilename),['older.csv']);
    const current=operationalControlsAsOf(active,'2031-04-30');
    assert.equal(current.quality.sourceRecordCount,1);
    assert.equal(current.quality.current[0]?.ncrId,'older');
    assert.equal(current.quality.sourceAnalyticalOnly,false);
    assert.equal(current.counts.openNcrCount,1,'actual clean active status remains established');
    const incomplete=make('T04-INCOMPLETE',['bad']);
    incomplete.evidenceDocuments[0]!.parserState='partial';
    assert.equal(analyticalOperationalDocuments(incomplete.evidenceDocuments).length,0);
    incomplete.evidenceDocuments[0]!.parserState='parsed';
    incomplete.evidenceDocuments[0]!.identification.needsReview=true;
    assert.equal(analyticalOperationalDocuments(incomplete.evidenceDocuments).length,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
