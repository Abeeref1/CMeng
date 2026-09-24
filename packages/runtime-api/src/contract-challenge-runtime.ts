import {buildChallengeContractProjection} from '../../challenge-contract/src';
import type {ProjectRuntimeState} from './project-state-types';
import {contractNoticeRules} from './contract-notice-rules';

/** Review the retained contract family with each document's authority intact.
 * Topic occurrences and notice candidates are source analysis, never awards or
 * an automatically promoted obligation register. */
export function contractChallengeForState(state:ProjectRuntimeState,generatedAt:string) {
  const documents=state.contractDocuments.filter(doc=>{
    const evidence=state.evidenceDocuments.find(d=>d.documentId===doc.documentId);
    return !evidence||['active','additive','candidate'].includes(evidence.basisState);
  });
  if(!documents.length)return state.contract?buildChallengeContractProjection(state.contract,{generatedAt,producerVersion:'contract-family-review-v2'}):null;
  const analyzed=documents.map(doc=>({doc,basis:state.evidenceDocuments.find(d=>d.documentId===doc.documentId)?.basisState??'candidate',
    review:buildChallengeContractProjection(doc.result,{generatedAt,producerVersion:'contract-family-review-v2'})}));
  const initialClaimRules=contractNoticeRules(state);
  const signals=analyzed.flatMap(({doc,basis,review})=>review.signals.map(s=>({...s,signalId:doc.documentId+':'+s.signalId,documentId:doc.documentId,
    documentRole:doc.role,sourceFilename:doc.sourceFilename,basisState:basis,sourceRefs:s.sourceRefs.map(ref=>'evidence-document:'+doc.documentId+':'+ref)})));
  const notices=analyzed.flatMap(({doc,basis,review})=>review.noticeRequirementCandidates.map(n=>({...n,candidateId:doc.documentId+':'+n.candidateId,
    documentId:doc.documentId,documentRole:doc.role,sourceFilename:doc.sourceFilename,basisState:basis,sourceRefs:n.sourceRefs.map(ref=>'evidence-document:'+doc.documentId+':'+ref)})));
  const wordingGroups=analyzed.flatMap(({doc,review})=>(review.wordingGroups??[]).map(g=>({...g,groupId:doc.documentId+':'+g.groupId,
    sourceRefs:g.sourceRefs.map(ref=>'evidence-document:'+doc.documentId+':'+ref)})));
  return {...analyzed[0]!.review,physicalComplete:analyzed.every(a=>a.review.physicalComplete),semanticComplete:analyzed.every(a=>a.review.semanticComplete),
    sectionCount:analyzed.reduce((n,a)=>n+a.review.sectionCount,0),clauseCount:analyzed.reduce((n,a)=>n+a.review.clauseCount,0),
    signalCount:signals.length,signals,uniqueWordingSignalCount:wordingGroups.length,repeatedSignalOccurrenceCount:signals.length-wordingGroups.length,wordingGroups,noticeRequirementCandidates:notices,categoriesPresent:[...new Set(signals.map(s=>s.category))].sort(),
    initialClaimRules,countingBasis:'Topic occurrences count topic matches at source locations. Notice candidates count extracted notice-pattern matches, potentially several per clause. Neither is a count of distinct enforceable notice rules; explicit initial-claim periods are listed separately by contract version.',
    sourceDocuments:analyzed.map(({doc,basis,review})=>({documentId:doc.documentId,sourceFilename:doc.sourceFilename,role:doc.role,basisState:basis,
      clauseCount:review.clauseCount,signalCount:review.signalCount,noticeCandidateCount:review.noticeRequirementCandidates.length,
      initialClaimPeriods:initialClaimRules.filter(r=>r.evidenceRefs.some(ref=>ref.sourceId===doc.documentId)).map(r=>r.noticePeriodDays)})),
    diagnostics:[...new Set(analyzed.flatMap(a=>a.review.diagnostics)),'CONTRACT_FAMILY_SOURCE_ROLES_RETAINED_NOT_MERGED_AUTHORITY']};
}
