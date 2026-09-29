import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';

import {tenderReadinessForState} from '../packages/runtime-api/src/tender-readiness';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
const functions=(names:string[])=>source.statements
  .filter(isFunctionDeclaration)
  .filter(node=>node.name&&names.includes(node.name.text))
  .map(node=>node.getText(source))
  .join('\n');

test('Tender Readiness is a real evidence capability and never invents a weighted score',()=>{
  const state=runtimeProjects.getOrCreate('TENDER-CAPABILITY');
  const empty:any=tenderReadinessForState(state);
  assert.equal(empty.key,'tender-readiness');
  assert.equal(empty.status,'partial');
  assert.equal(empty.data.projectionKey,'tender_readiness');
  assert.equal(empty.data.criterionCount,8);
  assert.equal(empty.data.establishedCount,0);
  assert.equal(empty.data.readinessScore,null);
  assert.equal(empty.data.readinessScoreState,'not_calculated_without_governed_weights');
  assert.ok(empty.data.criteria.every((row:any)=>row.weight===null));
  assert.match(empty.data.basis,/not a bid\/no-bid score/i);

  state.contractDocuments.push({
    documentId:'TENDER-1',role:'tender',lineage:{} as any,sourceFilename:'Employer Requirements.pdf',
    sourceHashSha256:'hash',uploadedAt:'2030-01-01',result:{} as any
  });
  state.evidenceDocuments.push({
    documentId:'RISK-1',category:'risk_claims_procurement',documentType:'risk_register',
    sourceFilename:'Risk Register.csv',sourceRelativePath:null,mediaType:'text/csv',sourceHashSha256:'risk',
    sizeBytes:10,uploadedAt:'2030-01-01',authority:'candidate_only',parserState:'parsed',storedPath:'',
    linkedArtifactId:null,scheduleRole:null,mapping:null,
    identification:{verifiedMediaType:'text/csv',detectedCategory:'risk_claims_procurement',detectedDocumentType:'risk_register',confidence:1,method:'tabular_content',ocrUsed:false,ocrConfidence:null,pageCount:null,extractedCharacterCount:10,detectedTitle:null,filenameHintCategory:'risk_claims_procurement',filenameHintDocumentType:'risk_register',declaredCategory:null,declaredDocumentType:null,classificationConflict:false,needsReview:false,signals:[],diagnostics:[]},
    lineage:{effect:'original',predecessorDocumentIds:[],replacesEntireBasis:false,appliesAsDelta:false,inferred:false,confidence:1,needsReview:false,diagnostics:[]},
    assertions:[],uploadIntent:'add_update',familyKey:'risk:register',logicalDocumentKey:'risk',basisState:'active',supersededByDocumentId:null,supersedesDocumentIds:[],diagnostics:[]
  } as any);
  state.controls.risks.push({riskId:'R1',status:'open',rating:'High',owner:'Risk',dueIso:null,sourceRefs:['RISK-1']} as any);

  const partial:any=tenderReadinessForState(state);
  assert.ok(partial.data.establishedCount>=2);
  assert.ok(partial.data.criteria.find((row:any)=>row.key==='employer-requirements')?.satisfied);
  assert.ok(partial.data.criteria.find((row:any)=>row.key==='risk-basis')?.satisfied);
  assert.equal(partial.data.readinessScore,null);
});

test('shared KPI presentation shows known facts first and never drops unresolved measures',()=>{
  const html=runInNewContext(
    functions(['planningKpis'])+';planningKpis(items)',
    {
      items:[
        ['Known A',12,'Established source'],
        ['Missing B','Unresolved','Contract not supplied'],
        ['Known C',0,'Established zero'],
        ['Missing D',null,'Risk population not supplied'],
      ],
      escapeHtml:String,
      fmt:(value:any)=>value==null?'Unresolved':String(value)
    }
  );
  assert.ok(html.indexOf('Known A')<html.indexOf('Missing B'));
  assert.match(html,/2 additional measures need more information/);
  assert.match(html,/Missing B/);
  assert.match(html,/Missing D/);
  assert.match(html,/Known C/);

  const allMissing=runInNewContext(
    functions(['planningKpis'])+';planningKpis(items)',
    {
      items:Array.from({length:7},(_,i)=>['Missing '+(i+1),'Unresolved','Needed '+(i+1)]),
      escapeHtml:String,
      fmt:String
    }
  );
  for(let i=1;i<=7;i++)assert.match(allMissing,new RegExp('Missing '+i));
  assert.match(allMissing,/3 additional measures need more information/);
});

test('schedule-only Delay Events presents missing event populations as unresolved, not zero',()=>{
  const data:any={
    projectionKey:'delay_claims',eventCount:0,claimCount:0,windowCount:0,events:[],
    contractorClaimEvidenceSubmitted:false,claimPopulationIntegrity:null,
    activityLinkedEventCount:0,windowLinkedEventCount:0,noticeLinkedEventCount:0,determinationLinkedEventCount:0,
    observedPositiveIndependentMovementDays:null,observedPositiveProgrammeMovementDays:null,projectCompletionMovementDays:null,
    claimsReporting:null
  };
  const html=runInNewContext(
    functions(['planningKpis','delayClaimsProjectionFor','renderDelayClaimsVisual'])+';renderDelayClaimsVisual(data)',
    {
      data,
      escapeHtml:String,
      fmt:(v:any)=>v==null?'Unresolved':String(v),
      humanizeKey:String,
      planningStatusBand:()=>'<div>band</div>',
      renderVisualBars:()=>'<div>bars</div>',
      renderWaterfallChart:()=>'<div>waterfall</div>',
      renderVisualPanel:(title:string,_note:string,body:string)=>'<section>'+title+body+'</section>',
      claimStateCounts:()=>[],
      moduleBarList:()=>'<div>classes</div>',
      readableWindow:String,
      planningShortDate:String
    }
  );
  for(const label of ['Current delay events','Source delay-event rows','After Data Date','Event date missing'])assert.match(html,new RegExp(label));
  assert.match(html,/No delay-event \/ claim source population is established/);
  assert.doesNotMatch(html,/Current delay events<\/span><strong>0<\/strong>/);
  assert.doesNotMatch(html,/Events linked to activities<\/span><strong>0<\/strong>/);
});

test('CMeng UI exposes Tender Readiness under Commercial advanced controls',()=>{
  assert.match(script,/"tender-readiness","Tender Readiness"/);
});
