import test from 'node:test';
import assert from 'node:assert/strict';
import {variationBasisReview,costBasisReview,amendmentAmounts} from '../packages/runtime-api/src/commercial-basis-review';
import {reconcilePaymentEvidence} from '../packages/runtime-api/src/payment-reconciliation';
import {certificateProfile} from '../packages/runtime-api/src/certificate-profile';
import {contractNoticeRules} from '../packages/runtime-api/src/contract-notice-rules';
import {buildCommercialFoundation,type CommercialFoundationInput} from '../packages/commercial-foundation/src';
import {buildCommercialPerformance} from '../packages/commercial-performance/src';
import {assessModuleIssues} from '../packages/runtime-api/src/module-issues';
import type {CommercialMoney,CanonicalCommercialModel,CommercialVariation,PaymentStageRecord} from '../packages/runtime-api/src/commercial-canonical';
import type {ProjectRuntimeState,ModuleRuntimeResult} from '../packages/runtime-api/src/project-state-types';
import type {SourceRow} from '../packages/truth-kernel/src';
import {buildCommercialControlPosition, type CommercialControlInput} from '../packages/commercial-control/src';
import {assessEventNotice, type CanonicalDelayEvent, type NoticeRequirement} from '../packages/delay-analysis-core/src';
import {commercialIntegrityChecks} from '../packages/runtime-api/src/commercial-integrity';

const receipt={documentId:'new-project-register',sourceHash:'hash',revision:'R',locator:'row:2',basisState:'active',authority:'source_record'} as const;
const money=(value:number|null,currency='AED'):CommercialMoney=>({value,currency,taxBasis:'exclusive',amountBasis:'source',state:value===null?'missing':'official',asOf:'2028-04-30',receipts:[receipt]});
const ledger=(overrides:Partial<CanonicalCommercialModel>={}):CanonicalCommercialModel=>({schemaVersion:'1.0',producerVersion:'commercial-canonical-v1',dataDateIso:'2028-04-30',costMetrics:[],payments:[],variations:[],siteInstructions:[],insurances:[],obligations:[],retentions:[],costPosition:[],diagnostics:[],populations:{} as CanonicalCommercialModel['populations'],...overrides});
const variation=(id:string,value:number|null,date:string|null,currency='AED'):CommercialVariation=>({variationId:id,description:id,approvalDate:date,status:'Approved',authority:'Change deed',instructionId:null,instructionDate:null,submittedDate:null,quotationDate:null,assessedDate:null,agreedDate:null,scheduleImpactDays:null,claimId:null,paymentId:null,activityIds:[],clauseIdentifiers:[],claimedAmount:money(null,currency),assessedAmount:money(null,currency),agreedAmount:money(null,currency),approvedAmount:money(value,currency),receipt});
const foundationInput=(sections:CommercialFoundationInput['contractSections']=[]):CommercialFoundationInput=>({projectId:'NEW-PORT',generatedAt:'2028-04-30',dataDateIso:'2028-04-30',contractValue:null,contractValueCandidates:[],variations:[],contractTimeBasis:null,ldTerms:null,contractSections:sections,amendments:[],costMetrics:[],payments:[]});
const amounts=():PaymentStageRecord['amounts']=>({applicationAmount:money(null),engineerAssessedAmount:money(null),employerCertifiedAmount:money(null),grossWork:money(800),variations:money(200),retentionDeduction:money(70),advanceRecovery:money(100),otherDeduction:money(null),taxAmount:money(null),netCertifiedAmount:money(830),paidAmount:money(null),outstandingAmount:money(null)});
const sourceRow={receipt,cells:{},raw:{}} as unknown as SourceRow;

test('source read status survives missing fields, currency partitions and reporting exclusions in every project',()=>{
  const input:CommercialControlInput={projectId:'UNRELATED-HARBOUR',generatedAt:'2028-04-30',contractValue:{amount:900,currency:'AED',sourceRefs:[]},variations:[],invoices:[],retentions:[],bonds:[],claimCommercials:[],contractTimeBasis:null,commercialEvidenceSubmitted:true,paymentEvidenceSubmitted:true,variationEvidenceSubmitted:true,bondEvidenceSubmitted:true,claimEvidenceSubmitted:true};
  const unread=buildCommercialControlPosition(input);
  for(const metric of ['pendingVariationAmount','advanceBalance','claimedAmount','activeBondAmount'] as const)assert.equal(unread.currencies[0]![metric].state,'submitted_unparsed');
  const read=buildCommercialControlPosition({...input,sourceRead:{payments:true,variations:true,claims:true,bonds:true}});
  for(const metric of ['pendingVariationAmount','advanceBalance','claimedAmount','activeBondAmount'] as const){assert.equal(read.currencies[0]![metric].state,'missing_information');assert.equal(read.currencies[0]![metric].value,null);}
  const mixed=buildCommercialControlPosition({...input,variations:[{variationId:'V-new',state:'approved',amount:25,currency:'USD',sourceRefs:[]}],claimCommercials:[{claimId:'C-new',currency:'AED',claimedAmount:12,assessedAmount:null,sourceRefs:[]} ]});
  assert.equal(mixed.currencies.find(p=>p.currency==='AED')!.approvedVariationAmount.state,'missing_information');
  assert.equal(mixed.currencies.find(p=>p.currency==='USD')!.approvedVariationAmount.value,25);
  assert.equal(mixed.currencies.find(p=>p.currency==='AED')!.assessedClaimAmount.state,'missing_information');
  const issues=(metric:unknown)=>assessModuleIssues({key:'payments',data:{focus:metric,systemEvidenceContract:{state:'verified_for_checked_metrics'},challenge:{reconciliationState:'within_tolerance'}}} as ModuleRuntimeResult,{state:'pass',failedCheckIds:[],checkCount:1});
  assert.equal(issues(read.currencies[0]!.advanceBalance).issues[0]!.owner,'Project evidence owner');
  assert.equal(issues(unread.currencies[0]!.advanceBalance).issues[0]!.owner,'CMeng');
});

test('notice rules present but awaiting trigger dates are not counted as missing requirements',()=>{
  const event={eventId:'E-new',category:'late_access',startIso:null,awarenessIso:null} as CanonicalDelayEvent;
  const rules:NoticeRequirement[]=[{requirementId:'old',noticeKind:'claim_notice',eventCategories:[],noticePeriodDays:32,effectiveFromIso:null,effectiveToIso:'2028-03-20',triggerBasis:'awareness',state:'official',clauseIdentifiers:[],evidenceRefs:[]},{requirementId:'new',noticeKind:'claim_notice',eventCategories:[],noticePeriodDays:14,effectiveFromIso:'2028-03-20',triggerBasis:'awareness',state:'official',clauseIdentifiers:[],evidenceRefs:[]}];
  const missingTrigger=assessEventNotice(event,[],rules);
  assert.equal(missingTrigger.requirementId,null);assert.equal(missingTrigger.timeliness,'event_date_missing');
  assert.deepEqual(missingTrigger.evidenceGaps,{requirementMissing:false,eventDateMissing:true,noticeDateMissing:true});
  assert.equal(assessEventNotice(event,[],[]).evidenceGaps.requirementMissing,true);
  const awareness=assessEventNotice({...event,awarenessIso:'2028-04-01'},[],rules);
  assert.equal(awareness.requiredNoticeDays,14);assert.equal(awareness.evidenceGaps.eventDateMissing,false);
  const conflict=assessEventNotice({...event,awarenessIso:'2028-04-01'},[],[rules[1]!,{...rules[1]!,requirementId:'conflict',noticePeriodDays:19}]);
  assert.equal(conflict.timeliness,'requirement_conflicted');assert.equal(conflict.evidenceGaps.requirementMissing,false);
});

test('variation exceptions use arbitrary amounts, dated cutoffs and isolated currencies',()=>{
  const rows=[variation('alpha',10,'2028-03-01'),variation('beta',11,'2028-03-15'),variation('gamma',12,'2028-04-02'),variation('delta',13,'2028-04-03'),variation('large',1000,'2028-05-02'),variation('dollar',5000,'2028-03-01','USD')];
  const r=variationBasisReview(ledger({variations:rows}),[{documentId:'deed',effectiveDate:'2028-03-20',amount:1046,currency:'AED',taxBasis:'exclusive',sourceRefs:[]}]);
  const a=r.groups.find(g=>g.currency==='AED')!;
  assert.deepEqual(a.current,{count:4,amount:46});assert.deepEqual(a.future,{count:1,amount:1000});assert.equal(a.fullAmount,1046);
  assert.deepEqual(a.amendments[0]!.atEffectiveDate,{count:2,amount:21});assert.deepEqual(a.amendments[0]!.afterEffectiveThroughDataDate,{count:2,amount:25});
  assert.equal(a.exceptions[0]!.id,'large');assert.equal(a.exceptions[0]!.otherRecordsAmount,46);assert.equal(a.exceptions[0]!.scope,'future');
  assert.equal(r.groups.find(g=>g.currency==='USD')!.amendments.length,0);
  const missing=variationBasisReview(ledger({variations:[...rows,variation('unknown',null,null)]}),[]).groups[0]!;
  assert.equal(missing.fullAmount,null);assert.equal(missing.undatedCount,1);assert.equal(missing.unknownAmountCount,1);
});

test('stated certificate arithmetic does not invent optional deductions or cash',()=>{
  const a=amounts(),r=reconcilePaymentEvidence(sourceRow,a,'2028-04-30');
  assert.equal(r.componentArithmetic!.state,'matched');assert.equal(r.componentArithmetic!.difference,0);
  assert.deepEqual(r.componentArithmetic!.omittedComponents,['other deductions']);assert.equal(r.reconciliation,'unresolved');
  assert.equal(r.calculatedOutstandingAmount.value,null);assert.equal(a.otherDeduction.value,null);
  a.otherDeduction=money(8);assert.equal(reconcilePaymentEvidence(sourceRow,a,'2028-04-30').componentArithmetic!.state,'conflicted');
  a.netCertifiedAmount=money(822);assert.equal(reconcilePaymentEvidence(sourceRow,a,'2028-04-30').reconciliation,'matched');
  a.grossWork.currency='USD';assert.equal(reconcilePaymentEvidence(sourceRow,a,'2028-04-30').componentArithmetic!.state,'unresolved');
});

test('certificate source sums and observed rate are separate from certification and contract terms',()=>{
  const a=amounts(),r=reconcilePaymentEvidence(sourceRow,a,'2028-04-30');
  const payment={paymentId:'CERT-X',periodEnd:'2028-04-15',sourceStatus:'Certified',certifiedAmountBasis:'unknown',paidAmountBasis:'unknown',amounts:a,certificationDate:null,receipt,...r} as PaymentStageRecord;
  const l=ledger({payments:[payment,{...payment,paymentId:'CERT-Y',periodEnd:'2028-06-15'}]});
  const g=certificateProfile(l).groups[0]!;
  assert.equal(g.totals!.netCertifiedAmount,830);assert.equal(g.futureTotals!.netCertifiedAmount,830);
  assert.deepEqual(g.observedRetentionRates,[7]);assert.deepEqual(g.certificationUnconfirmedIds,['CERT-X']);assert.equal(g.cumulativeBasis,'source_row_sum_only');
  assert.deepEqual(g.arithmetic,{matched:1,total:1,allMatched:2,allTotal:2});
  const position=buildCommercialControlPosition({projectId:'NEW-PORT',generatedAt:'2028-04-30',sourceLedger:l,contractValue:null,variations:[],invoices:[],retentions:[],bonds:[],claimCommercials:[],contractTimeBasis:null,commercialEvidenceSubmitted:true,paymentEvidenceSubmitted:true,variationEvidenceSubmitted:false,bondEvidenceSubmitted:false,claimEvidenceSubmitted:false});
  position.certificateProfile=certificateProfile(l);
  assert.equal(position.currencies[0]!.sourceCertificatePeriodCount!.value,1);
  assert.equal(position.currencies[0]!.interimCertificateCount.value,null,'Period dates do not become certification dates');
  assert.ok(commercialIntegrityChecks('payments',position).every(c=>c.passed));
  position.certificateProfile.groups[0]!.totals!.netCertifiedAmount=831;
  assert.deepEqual(commercialIntegrityChecks('payments',position).filter(c=>!c.passed).map(c=>c.metric),['certificate_component_sum:AED:exclusive:netCertifiedAmount']);
  position.certificateProfile.groups[0]!.as_of.push(position.certificateProfile.groups[0]!.future[0]!);
  assert.ok(commercialIntegrityChecks('payments',position).some(c=>!c.passed&&c.metric==='certificate_current_cutoff:AED:exclusive'));
  const snapshots=[{currency:'AED',taxBasis:'exclusive',asOf:'2028-04-30',state:'official' as const,values:{bac:10000,pv:3000,ev:2700,ac:2500},receipts:[receipt],diagnostics:[]}];
  const review=costBasisReview(ledger({payments:l.payments,costPosition:snapshots}),certificateProfile(l))[0]!;
  assert.equal(review.earnedPercentOfBudget,27);assert.equal(review.spi,.9);assert.equal(review.actualCostToCertificateRatio,2500/830);
  assert.equal(costBasisReview(ledger({costPosition:[{...snapshots[0]!,asOf:'2028-03-31'}]}),certificateProfile(l))[0]!.actualCostToCertificateRatio,null);
});

test('section locators never become clause numbers and grouping preserves full wording and references',()=>{
  const body='Clause 9.6 is amended. The supplier shall submit complete evidence. '+('Long supporting wording. '.repeat(30));
  const sections=[1,2].map(n=>({documentId:'deed',documentRole:'amendment' as const,basisState:'additive',revision:'v1',sourceHash:'hash',sectionKey:'s'+n,identifier:String(n),parentIdentifier:null,heading:null,text:'Section '+n+'\n'+body,startPage:n,sourceMode:'deterministic' as const,sectionStatus:'verified' as const}));
  const p=buildCommercialFoundation(foundationInput(sections));
  assert.equal(p.commercialTerms.clauses.length,1);const c=p.commercialTerms.clauses[0]!;
  assert.equal(c.identifier,null);assert.deepEqual(c.referencedClauseIdentifiers,['9.6']);assert.equal(c.occurrenceCount,2);assert.equal(c.sourceRefs!.length,2);assert.ok(c.textPreview.length>360);assert.ok(c.textPreview.endsWith('supporting wording.'));
  const different=buildCommercialFoundation(foundationInput([...sections,{...sections[0]!,documentId:'other-deed'}]));assert.equal(different.commercialTerms.clauses.length,2);
});

test('original and amended initial and detailed-claim periods use new project terms',()=>{
  const documents=[{id:'first',role:'main',text:'Initial Claim Notice 32 days\nFully Detailed Claim 99 days'},
    {id:'change',role:'amendment',text:'Effective Date 2028-03-20\nCurrent Initial Claim Notice 14 days\nFully Detailed Claim 70 days\nAmendment Value AED 1046 excluding VAT'}];
  const state={contractDocuments:documents.map(d=>({documentId:d.id,role:d.role,result:{sections:[{sectionKey:'one',sourceMode:'deterministic',text:d.text,startPage:1}],pdf:{pages:[{text:d.text,pageNumber:1}]}}})),evidenceDocuments:documents.map(d=>({documentId:d.id,basisState:d.role==='main'?'active':'additive'}))} as unknown as ProjectRuntimeState;
  assert.deepEqual(contractNoticeRules(state).map(r=>r.noticePeriodDays),[32,14]);
  assert.deepEqual(contractNoticeRules(state,'detailed_claim').map(r=>r.noticePeriodDays),[99,70]);
  assert.equal(contractNoticeRules(state)[0]!.effectiveToIso,'2028-03-20');assert.equal(contractNoticeRules(state,'detailed_claim')[1]!.triggerBasis,'not_stated');
  assert.equal(amendmentAmounts(state)[0]!.amount,1046);assert.equal(amendmentAmounts(state)[0]!.sourceRefs.length,1);
});

test('equal EAC outcomes retain methods but produce one range value and no invented estimating method',()=>{
  const p=buildCommercialPerformance({projectId:'NEW-PORT',generatedAt:'2028-04-30',dataDateIso:'2028-04-30',foundation:buildCommercialFoundation(foundationInput()),costSnapshots:[{currency:'AED',taxBasis:'exclusive',asOf:'2028-04-30',state:'official',values:{bac:10000,pv:3000,ev:2700,ac:2500,eac:10500,etc:8000},sourceRefs:[],diagnostics:[]}],costMetrics:[],payments:[]}).costControl.positions[0]!;
  assert.equal(p.spi.validationScope,'arithmetic_only');
  const check=p.eacScenarios.find(s=>s.method==='ac_plus_source_etc')!;assert.equal(check.sameValueAs,'source_reported');assert.equal(check.value.value,10500);
  assert.equal(p.eacScenarios.filter(s=>!s.sameValueAs&&s.value.value!==null).length,3);
  assert.doesNotMatch(check.methodology,/bottom.up/i);
});

test('one dated variation conflict does not become one conflict per propagated cost metric',()=>{
  const l=ledger({variations:[variation('known',40,'2028-03-01'),variation('future',60,'2028-05-01')],costPosition:[{currency:'AED',taxBasis:'exclusive',asOf:'2028-04-30',state:'partial',values:{'approved variations':100},receipts:[receipt],diagnostics:['DATED_VARIATION_LEDGER_VS_SOURCE_AGGREGATE_CONFLICT']}]});
  const result={key:'cost-forecast',status:'partial',evidenceState:'partial',dependencies:[],data:{focus:{a:{state:'partial',diagnostics:l.costPosition[0]!.diagnostics},b:{state:'candidate',diagnostics:l.costPosition[0]!.diagnostics}},position:{variationBasisReview:variationBasisReview(l,[])}}} as unknown as ModuleRuntimeResult;
  const r=assessModuleIssues(result,{state:'pass',failedCheckIds:[],checkCount:0});
  assert.equal(r.counts.source_conflict,1);assert.match(r.issues.find(i=>i.kind==='source_conflict')!.detail,/difference 60/);
  assert.ok(r.issues.find(i=>i.kind==='source_conflict')!.evidencePaths.length>1);
});
