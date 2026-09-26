import test from 'node:test';
import assert from 'node:assert/strict';
import {assessModuleIssues} from '../packages/runtime-api/src/module-issues';
import {summarizeControlIssues} from '../packages/truth-kernel/src';
import type {ModuleRuntimeResult} from '../packages/runtime-api/src/project-state-types';
import {enforceModuleReadiness} from '../packages/runtime-api/src/module-readiness';

const pass={state:'pass' as const,failedCheckIds:[],checkCount:8};
test('source review pages can be ready without an advisory comparison while real conflicts still block',()=>{
 const activity={...input({challenge:{reconciliationState:'submitted_missing',items:[{metric:'activity_count'}]}}),key:'activity-analytics'};
 const result=enforceModuleReadiness(activity,pass);
 assert.equal(result.status,'ready');
 assert.equal((result.data as any).moduleReadiness.comparisonRequired,false);
 assert.ok(!result.issueAssessment?.issues.some(i=>i.code==='COMPARABLE_ASSERTION_MISSING'));
 const conflict=enforceModuleReadiness({...activity,data:{...(activity.data as any),challenge:{reconciliationState:'conflicting_evidence'}}},pass);
 assert.equal(conflict.status,'partial');assert.equal(conflict.issueAssessment?.counts.source_conflict,1);
 assert.equal(enforceModuleReadiness({...activity,key:'independent-forecast'},pass).status,'partial');
});
function input(data:Record<string,unknown>={}):ModuleRuntimeResult {
 return {key:'arbitrary-control',status:'ready',engineState:'ready',evidenceState:'established',professionalState:'defensible',reason:null,dependencies:[],
  data:{systemEvidenceContract:{state:'verified_for_checked_metrics',checks:[{metric:'population',passed:true}]},challenge:{reconciliationState:'within_tolerance'},...data}};
}
test('classification keeps failed software checks separate from missing, invalid, conflicting and differing source positions',()=>{
 const cases=[
  ['system_defect',input({systemEvidenceContract:{state:'failed',checks:[{metric:'count',expected:3,actual:4,passed:false}]}})],
  ['source_conflict',input({focus:{amount:{state:'conflicted',value:null,sourceRefs:['DOC-A:row:1','DOC-B:row:2']}}})],
  ['data_quality',input({focus:{date:{state:'invalid',value:null,diagnostics:['INVALID_DATE'],sourceRefs:['DOC-C:row:3']}}})],
  ['missing_information',input({focus:{permit:{state:'missing',value:null}}})],
  ['comparison_difference',input({challenge:{reconciliationState:'material_difference'}})],
  ['governance_review',input({focus:{amendment:{state:'candidate',value:'2035-12-31'}}})],
  ['verification_pending',input({focus:{payment:{state:'submitted_unparsed',value:null,sourceRefs:['DOC-D:page:1']}}})],
 ] as const;
 for (const [kind,result] of cases){
  const assessment=assessModuleIssues(result,pass); assert.equal(assessment.primaryKind,kind);
  assert.equal(assessment.counts.system_defect,kind==='system_defect'?1:0,kind+' must not invent a system defect');
  assert.ok(assessment.issues.every(i=>i.owner&&i.action&&i.evidencePaths.length));
 }
 assert.equal(assessModuleIssues(input(),pass).primaryKind,'checked');
});
test('submitted but uninterpreted sources and missing CMeng comparisons belong to CMeng, not the contractor',()=>{
 const r=assessModuleIssues(input({focus:{register:{state:'submitted_unparsed',value:null}},challenge:{reconciliationState:'independent_unavailable'}}),pass);
 assert.equal(r.counts.missing_information,0);assert.equal(r.counts.system_defect,0);
 assert.ok(r.issues.every(i=>i.owner==='CMeng'));
 assert.ok(r.issues.some(i=>i.summary==='Independent comparison not established'));
 assert.equal(r.systemCheckState,'unverified');
});
test('explicit delivery evidence gaps reach shared issue totals and retain their distinct topics and correction evidence',()=>{
 const r=assessModuleIssues(input({deliveryChallenge:{findings:[
  {topic:'mapping',state:'missing_evidence',consequence:'Quantity denominator lacks links.',action:'Establish source links.',evidenceRefs:['source-one']},
  {topic:'productivity',state:'missing_evidence',consequence:'Measured output is absent.',action:'Provide measured output.',evidenceRefs:['source-two']}
 ]}}),pass);
 assert.equal(r.counts.missing_information,2);assert.equal(r.counts.system_defect,0);
 assert.ok(r.issues.some(i=>i.summary.includes('mapping')&&i.sourceRefs.includes('source-one')&&i.action==='Establish source links.'));
 assert.ok(r.issues.some(i=>i.summary.includes('productivity')&&i.sourceRefs.includes('source-two')));
});
test('cross-module contradictions retain failed check IDs, independent of source quality findings',()=>{
 const r=assessModuleIssues(input({focus:{bond:{state:'missing'}}}),{state:'fail',checkCount:2,failedCheckIds:['SAME_POPULATION_DIFFERENT_TOTAL']});
 assert.equal(r.primaryKind,'system_defect');assert.equal(r.counts.system_defect,1);assert.equal(r.counts.missing_information,1);
 assert.deepEqual(r.issues.find(i=>i.kind==='system_defect')!.checkIds,['SAME_POPULATION_DIFFERENT_TOTAL']);
});
test('management counts affected views without treating multiple findings in a view as distinct software defects',()=>{
 const a=assessModuleIssues(input({focus:{a:{state:'missing'},b:{state:'missing'}}}),pass);
 const b=assessModuleIssues({...input({focus:{register:{state:'conflicted'}}}),key:'another-control'},pass);
 const m=summarizeControlIssues([...a.issues,...a.issues,...b.issues]);
 assert.equal(m.counts.missing_information,2);assert.equal(m.affectedModuleCounts.missing_information,1);
 assert.equal(m.counts.source_conflict,1);assert.equal(m.counts.system_defect,0);
});
test('missing inputs and absent links are distinct from malformed supplied dates and unparsed documents',()=>{
 const r=assessModuleIssues(input({focus:{paid:{state:'missing_information',diagnostics:['DATED_PAYMENT_RECEIPT_AND_ALLOCATION_REQUIRED']},
  notices:{population:{dateBasis:'notice',exclusions:[{reason:'record_date_missing'},{reason:'record_date_invalid'}]}}},activityEvidenceInsufficientEventCount:2}),pass);
 assert.equal(r.counts.verification_pending,0);
 assert.equal(r.counts.data_quality,1);
 assert.equal(r.counts.missing_information,3);
 assert.ok(r.issues.find(i=>i.kind==='data_quality')?.summary.includes('invalid event dates'));
});
test('known notice applicability and causal evidence gaps are not hidden behind calculation verification',()=>{
 const r=assessModuleIssues(input({noticeRequirementMissingCount:3,eligibleCausalEventEvidenceEstablished:false,challenge:{reconciliationState:'independent_unavailable'}}),pass);
 assert.equal(r.counts.missing_information,2);assert.equal(r.counts.verification_pending,1);assert.equal(r.counts.system_defect,0);
});
test('identical source requests retain every record reference across pages without inflating the counter',()=>{
 const a=assessModuleIssues(input({focus:{paid:{state:'missing',sourceRefs:['DOC:row:1']}}}),pass);
 const b=assessModuleIssues({...input({focus:{paid:{state:'missing',sourceRefs:['DOC:row:2']}}}),key:'second-page'},pass);
 const summary=summarizeControlIssues([...a.issues,...b.issues]);
 assert.equal(summary.counts.missing_information,1);
 assert.deepEqual(summary.issues[0]?.sourceRefs,['DOC:row:1','DOC:row:2']);
 assert.deepEqual(summary.issues[0]?.moduleKeys,['arbitrary-control','second-page']);
});
test('explicit comparison input dependencies are source requests, while unexplained missing calculations stay with CMeng',()=>{
 const item={metric:'independent_hours',label:'Independent hours',reconciliationState:'independent_unavailable',consequence:'Quantity links are absent.',action:'Provide quantity links.',independent:{diagnostics:['COMPARISON_INPUT_REQUIRED:Quantity links are absent.'],sourceRefs:['SCHEDULE']}};
 const r=assessModuleIssues(input({challenge:{reconciliationState:'independent_unavailable',items:[item]}}),pass);
 assert.equal(r.counts.verification_pending,0);assert.equal(r.counts.missing_information,1);assert.match(r.issues[0]!.detail,/Quantity links/);
 const unknown=assessModuleIssues(input({challenge:{reconciliationState:'independent_unavailable',items:[{...item,independent:{diagnostics:[]}}]}}),pass);
 assert.equal(unknown.counts.verification_pending,1);assert.equal(unknown.issues[0]!.owner,'CMeng');
});

test('one source conflict keeps all projection paths; different documents and rows remain separate',()=>{
 const fact={state:'conflicted',sourceFactKey:'RISK_RATING_SCORE_CONFLICT',diagnostics:['RISK_RATING_SCORE_CONFLICT'],sourceRefs:['evidence-document:risk-a:row:2','evidence-document:risk-a:row:3']};
 const a=assessModuleIssues(input({risk:{validation:fact},sourceInterpretation:{riskValidation:{...fact,sourceRefs:[...fact.sourceRefs].reverse()}}}),pass);
 assert.equal(a.counts.source_conflict,1);
 assert.deepEqual(a.issues[0]!.evidencePaths,['data.risk.validation','data.sourceInterpretation.riskValidation']);
 const b=assessModuleIssues({...input({risk:{validation:{...fact}}}),key:'another-page'},pass);
 const c=assessModuleIssues(input({risk:{validation:{...fact,sourceRefs:['evidence-document:risk-b:row:2']}}}),pass);
 const summary=summarizeControlIssues([...a.issues,...b.issues,...c.issues]);
 assert.equal(summary.counts.source_conflict,2);
 assert.equal(summary.issues[0]!.moduleKeys.length,2);
 assert.equal(summary.issues[0]!.sourceRefs.length,2);
 const distinct=assessModuleIssues(input({amount:{state:'conflicted',sourceRefs:['document:row:1']},currency:{state:'conflicted',sourceRefs:['document:row:1']}}),pass);
 assert.equal(distinct.counts.source_conflict,2,'same row does not establish that different unresolved facts have the same cause');
});
