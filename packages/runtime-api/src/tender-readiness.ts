import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {quarantineUnconfirmedBoqNumerics} from '../../boq-ingestion/src';
import type {ModuleRuntimeResult,ProjectRuntimeState} from './project-state-types';

type TenderCriterionState='established'|'partial'|'missing';

interface TenderCriterion {
  key:string;
  criterion:string;
  required:boolean;
  satisfied:boolean|null;
  weight:number|null;
  criteriaVersion:string;
  criteriaAuthority:string;
  evidenceCoverage:number;
  state:TenderCriterionState;
  availableEvidence:string;
  owner:string;
  gap:string|null;
  sourceRefs:string[];
}

const VERSION='cmeng-tender-readiness-v1';
const AUTHORITY='CMeng default evidence checklist';

const activeDocument=(state:ProjectRuntimeState)=>
  state.evidenceDocuments.filter(document=>!['superseded','historical','scenario'].includes(document.basisState));

const refs=(rows:Array<{documentId?:string|null;sourceFilename?:string|null}>)=>
  rows.map(row=>row.documentId?'evidence-document:'+row.documentId:'source:'+String(row.sourceFilename??'record'));

function tenderCriterion(input:{
  key:string;criterion:string;owner:string;established:boolean;partial?:boolean;
  availableEvidence:string;gap:string;sourceRefs?:string[];
}):TenderCriterion{
  const state:TenderCriterionState=input.established?'established':input.partial?'partial':'missing';
  return {
    key:input.key,
    criterion:input.criterion,
    required:true,
    satisfied:state==='established'?true:null,
    weight:null,
    criteriaVersion:VERSION,
    criteriaAuthority:AUTHORITY,
    evidenceCoverage:state==='established'?100:state==='partial'?50:0,
    state,
    availableEvidence:input.availableEvidence,
    owner:input.owner,
    gap:state==='established'?null:input.gap,
    sourceRefs:[...new Set(input.sourceRefs??[])],
  };
}

export function tenderReadinessForState(state:ProjectRuntimeState):ModuleRuntimeResult{
  const documents=activeDocument(state);
  const matching=(pattern:RegExp)=>documents.filter(document=>pattern.test(
    [document.documentType,document.sourceFilename,document.familyKey,document.category].filter(Boolean).join(' ')
  ));
  const parsed=(rows:typeof documents)=>rows.some(document=>document.parserState==='parsed'&&['active','additive'].includes(document.basisState));

  const tenderContracts=state.contractDocuments.filter(document=>document.role==='tender');
  const tenderSources=matching(/tender|employer.?requirements|request for proposal|\brfp\b|invitation to tender|\bitt\b/i);

  const boqSources=matching(/\bboq\b|bill of quantities|scope of work|scope register|pricing schedule/i);
  const boqItems=(state.boq?quarantineUnconfirmedBoqNumerics(state.boq).canonicalItems:[]) as Array<any>;
  const pricedItemCount=boqItems.filter(item=>
    (typeof item.rate==='number'&&Number.isFinite(item.rate)) ||
    (typeof item.amount==='number'&&Number.isFinite(item.amount))
  ).length;

  const programme=projectControlSchedule(state);
  const programmeSources=matching(/programme|schedule|primavera|\bxer\b/i);

  const contractSources=matching(/contract|commercial terms|conditions of contract|particular conditions/i);
  const commercialEstablished=Boolean(state.contract||state.contractDocuments.some(document=>['main','replacement','tender'].includes(document.role)));

  const resourceSources=matching(/resource|manpower|man-hour|manhour|labour|labor|staffing/i);
  const resourceEstablished=Boolean(state.submittedManpowerPlan)||parsed(resourceSources);

  const procurementSources=matching(/procurement|subcontract|supplier|vendor|purchase order|\bpo\b|material register/i);
  const deliveryRecords=((state.delivery as any)?.records??[]) as Array<any>;
  const procurementEstablished=parsed(procurementSources)||deliveryRecords.some(row=>['package','supplier'].includes(String(row.kind??'')));

  const riskSources=matching(/risk register|risk assessment|quantitative risk|risk report/i);
  const riskEstablished=state.controls.risks.length>0||parsed(riskSources);

  const criteria:TenderCriterion[]=[
    tenderCriterion({
      key:'employer-requirements',criterion:'Tender / Employer Requirements basis',owner:'Bid / Contracts',
      established:tenderContracts.length>0||parsed(tenderSources),partial:tenderSources.length>0,
      availableEvidence:tenderContracts.length
        ? tenderContracts.length+' tender contract document(s) retained'
        : tenderSources.length?tenderSources.length+' candidate tender / Employer Requirements source(s) retained':'No tender / Employer Requirements source is established',
      gap:'Provide or confirm the governing tender / Employer Requirements documents.',
      sourceRefs:[...tenderContracts.map(document=>'contract-document:'+document.documentId),...refs(tenderSources)]
    }),
    tenderCriterion({
      key:'scope-boq',criterion:'Scope / BOQ basis',owner:'Commercial / Estimating',
      established:boqItems.length>0,partial:boqSources.length>0,
      availableEvidence:boqItems.length?boqItems.length+' BOQ item(s) read':boqSources.length?boqSources.length+' BOQ/scope source(s) supplied but a governed item population is not established':'No BOQ/scope item population is established',
      gap:'Establish the tender scope/BOQ population before calling the commercial scope complete.',
      sourceRefs:refs(boqSources)
    }),
    tenderCriterion({
      key:'pricing-basis',criterion:'Pricing / cost build-up basis',owner:'Commercial / Estimating',
      established:pricedItemCount>0,partial:boqItems.length>0||boqSources.length>0,
      availableEvidence:pricedItemCount?pricedItemCount+' BOQ item(s) carry a source rate or amount':boqItems.length?'BOQ quantities are available but source pricing is incomplete':'No governed tender pricing basis is established',
      gap:'Provide governed rates/amounts or the approved cost build-up basis. CMeng does not infer missing prices.',
      sourceRefs:refs(boqSources)
    }),
    tenderCriterion({
      key:'programme-basis',criterion:'Tender programme / delivery-time basis',owner:'Planning',
      established:Boolean(programme),partial:state.schedules.length>0||programmeSources.length>0,
      availableEvidence:programme
        ? 'Current programme established · '+programme.revision.model.activities.length+' activities · Data Date '+(programme.revision.model.dataDateIso??'not supplied')
        : state.schedules.length?state.schedules.length+' programme revision(s) supplied but no reporting programme is established':'No reporting programme is established',
      gap:'Establish the tender/current programme before relying on programme-dependent readiness.',
      sourceRefs:refs(programmeSources)
    }),
    tenderCriterion({
      key:'commercial-terms',criterion:'Commercial terms / contract basis',owner:'Contracts / Commercial',
      established:commercialEstablished,partial:contractSources.length>0,
      availableEvidence:commercialEstablished?'Contract/tender terms are available to the governed commercial position':contractSources.length?contractSources.length+' commercial/contract source(s) supplied but the governed terms are incomplete':'No commercial terms basis is established',
      gap:'Establish the applicable commercial terms, amendments and tender conditions.',
      sourceRefs:refs(contractSources)
    }),
    tenderCriterion({
      key:'resources-manpower',criterion:'Resource / manpower basis',owner:'Planning / Operations',
      established:resourceEstablished,partial:resourceSources.length>0,
      availableEvidence:resourceEstablished?'Resource/manpower evidence is available':resourceSources.length?resourceSources.length+' resource/manpower source(s) supplied but not fully established':'No resource/manpower basis is established',
      gap:'Provide the manpower/resource basis where tender deliverability depends on capacity.',
      sourceRefs:refs(resourceSources)
    }),
    tenderCriterion({
      key:'procurement-subcontract',criterion:'Procurement / subcontract strategy basis',owner:'Procurement',
      established:procurementEstablished,partial:procurementSources.length>0,
      availableEvidence:procurementEstablished?'Procurement/package/supplier evidence is available':procurementSources.length?procurementSources.length+' procurement/subcontract source(s) supplied but not fully established':'No procurement/subcontract strategy evidence is established',
      gap:'Establish the applicable procurement, supplier and subcontract strategy/long-lead basis.',
      sourceRefs:refs(procurementSources)
    }),
    tenderCriterion({
      key:'risk-basis',criterion:'Tender risk basis',owner:'Project Controls / Risk',
      established:riskEstablished,partial:riskSources.length>0,
      availableEvidence:riskEstablished?state.controls.risks.length+' governed/current risk record(s) available':riskSources.length?riskSources.length+' risk source(s) supplied but no governed risk population is established':'No tender/project risk population is established',
      gap:'Provide or establish the applicable risk register and rating basis.',
      sourceRefs:refs(riskSources)
    }),
  ];

  const establishedCount=criteria.filter(row=>row.state==='established').length;
  const partialCount=criteria.filter(row=>row.state==='partial').length;
  const unresolvedCount=criteria.length-establishedCount;
  const evidenceCoveragePercent=Number(((establishedCount/criteria.length)*100).toFixed(1));
  const ready=establishedCount===criteria.length;

  return {
    key:'tender-readiness',
    status:ready?'ready':'partial',
    engineState:'ready',
    evidenceState:ready?'established':'partial',
    professionalState:ready?'defensible':'review_required',
    reason:ready?null:establishedCount+' of '+criteria.length+' default tender-readiness evidence criteria are established; '+unresolvedCount+' remain partial or unresolved.',
    dependencies:['tender / Employer Requirements','scope / BOQ','pricing basis','programme','commercial terms','resources','procurement strategy','risk basis'],
    data:{
      projectionKey:'tender_readiness',
      schemaVersion:'1.0',
      projectId:state.projectId,
      dataDateIso:projectDataDate(state),
      criteriaVersion:VERSION,
      criteriaAuthority:AUTHORITY,
      establishedCount,
      partialCount,
      unresolvedCount,
      criterionCount:criteria.length,
      evidenceCoveragePercent,
      readinessScore:null,
      readinessScoreState:'not_calculated_without_governed_weights',
      criteria,
      basis:'Tender Readiness is an evidence-coverage capability, not a bid/no-bid score. The default checklist shows what is established and what is missing. CMeng does not invent criterion weights, threshold scores or an award recommendation when no governed tender scoring model has been supplied.'
    }
  };
}
