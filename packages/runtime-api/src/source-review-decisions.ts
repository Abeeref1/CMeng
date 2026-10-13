import {createHash} from 'node:crypto';
import {extractContractValue} from '../../contract-commercial/src';
import type {ContractTimeBasis} from '../../eot-assessment/src';
import type {ProjectRuntimeState} from './project-state-types';

const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function isSourceDerivedTimeBasis(basis:ContractTimeBasis|null|undefined){
  return !!basis?.sourceRefs.length&&basis.sourceRefs.every(ref=>ref.startsWith('evidence-document:')||ref.startsWith('user-confirmation:eot-overlap:'));
}

/** Decisions qualify derived reporting only; the retained source is immutable. */
export function riskReviewBasis(state:ProjectRuntimeState){
  const sourceFingerprint=fingerprint({
    documents:state.evidenceDocuments.filter(d=>d.documentType==='risk_register').map(d=>[d.documentId,d.sourceHashSha256,d.basisState,d.tableConfirmations??[]]),
    manual:(state.controls.risks??[]).filter(r=>!r.sourceRefs.some(ref=>ref.startsWith('evidence-document:'))),
  });
  const rating=state.controls.reviewDecisions?.['risk-rating-rule'];
  const snapshot=state.controls.reviewDecisions?.['risk-status-snapshot'];
  return {sourceFingerprint,rating:rating?.sourceFingerprint===sourceFingerprint?rating:null,
    snapshot:snapshot?.sourceFingerprint===sourceFingerprint&&snapshot.choice==='confirm_snapshot'?snapshot:null};
}

export function eotOverlapReview(state:ProjectRuntimeState,basis:ContractTimeBasis|null){
  const sourceFingerprint=fingerprint({
    sources:state.evidenceDocuments.filter(d=>/contract|amendment|claim|determination/.test(d.documentType+' '+d.category)).map(d=>[d.documentId,d.sourceHashSha256,d.basisState,d.tableConfirmations??[]]),
    completion:basis?.contractualCompletionIso,incorporated:basis?.incorporatedEotDays,
    register:basis?.registerDeterminationDays,effective:basis?.officialApprovedEotDays,refs:basis?.sourceRefs.filter(r=>!r.startsWith('user-confirmation:')),
  });
  const saved=state.controls.reviewDecisions?.['eot-overlap'];
  return {sourceFingerprint,decision:saved?.sourceFingerprint===sourceFingerprint&&saved.choice==='confirm_additional_days'&&saved.reference?.trim()?saved:null};
}

export function applyEotOverlapDecision(state:ProjectRuntimeState,basis:ContractTimeBasis|null){
  if(basis?.overlapResolution!=='unresolved')return basis;
  const review=eotOverlapReview(state,basis),days=review.decision?.additionalDays;
  if(typeof days!=='number'||!Number.isFinite(days)||days<0||basis.officialApprovedEotDays===null||days>basis.officialApprovedEotDays)return basis;
  return {...basis,additionalApprovedEotDays:days,overlapResolution:'resolved' as const,
    sourceRefs:[...basis.sourceRefs,'user-confirmation:eot-overlap:'+review.sourceFingerprint]};
}

export function reportingTimeBasis(state:ProjectRuntimeState,canonical:ContractTimeBasis|null){
  const stored=state.controls.contractTimeBasis;
  return applyEotOverlapDecision(state,stored&&!isSourceDerivedTimeBasis(stored)?stored:canonical??stored);
}

export function contractValueReview(state:ProjectRuntimeState){
  const candidates=state.contract?extractContractValue(state.contract).candidates:[];
  const unique=candidates;
  const sourceFingerprint=fingerprint({candidates:unique,documents:state.evidenceDocuments.filter(d=>/contract|amendment/.test(d.documentType+' '+d.category)).map(d=>[d.documentId,d.sourceHashSha256,d.basisState])});
  const saved=state.controls.reviewDecisions?.['contract-value'];
  const selected=saved?.sourceFingerprint===sourceFingerprint?unique.find(c=>'value:'+c.currency+':'+c.amount===saved.choice):undefined;
  return {sourceFingerprint,candidates:unique,selected:selected??null,decision:selected?saved:null};
}

export function reportingContractValue(state:ProjectRuntimeState){
  if(state.controls.contractValue)return state.controls.contractValue;
  const review=contractValueReview(state),selected=review.selected;
  return selected?{amount:selected.amount,currency:selected.currency,sourceRefs:[...selected.sourceRefs,'user-confirmation:contract-value:'+review.sourceFingerprint]}:null;
}
