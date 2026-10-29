import test from 'node:test';
import assert from 'node:assert/strict';
import {identifyEvidenceDocument,documentClassificationForReview} from '../packages/runtime-api/src/document-identification';

// K1 invariant: content that establishes a document type is the type, under any
// file name, and the name raises no review. The name is used only when the
// content cannot establish a type, and the review then says so.

const stored=async(name:string,text:string)=>{
  const read=await identifyEvidenceDocument({bytes:Buffer.from(text),sourceFilename:name,sourceRelativePath:null});
  return {read,document:{documentId:name,sourceFilename:name,sourceRelativePath:null,mediaType:'text/csv',category:read.identification.detectedCategory,documentType:read.identification.detectedDocumentType,
    identification:read.identification,basisState:'active',assertions:[],diagnostics:[]} as any};
};
const EVM='CBS ID,Description,As Of,PV,EV,AC,BAC,EAC,Currency\nC-01,Structure,2026-08-31,1000,900,950,5000,5200,SAR\nC-02,MEP,2026-08-31,800,700,720,4000,4100,SAR';

test('K1: established content gives the same type and no review under a dataset prefix name or a neutral name',async()=>{
  const types=new Set<string>();
  for(const name of ['COST01_Latest_EVM.csv','Monthly_Figures.csv','S02_update_latest.csv']){
    const {read,document}=await stored(name,EVM);
    types.add(read.identification.detectedDocumentType);
    const review=documentClassificationForReview(document,EVM.split('\n').map(l=>l.split(',')));
    assert.equal(review.reviewRequired,false,name+': content establishes the type; the name raises no review ('+review.reason+')');
    assert.doesNotMatch(String(review.reason??''),/file name suggests/,name);
  }
  assert.deepEqual([...types],['cost_evm_report'],'one type from content whatever the name');
});

test('K1: content that cannot establish a type falls back to the name, and the review says so',async()=>{
  const {read,document}=await stored('RFI_Register.csv','Notes\nPlease call back\nThanks');
  if(read.identification.method==='metadata_fallback'){
    const review=documentClassificationForReview(document);
    assert.equal(review.reviewRequired,true);
    assert.match(String(review.reason),/taken from the file name/,'the review names the file name as the only basis');
  }else assert.ok(read.identification.needsReview,'weak content is reviewed: '+read.identification.method);
});
