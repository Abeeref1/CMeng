import type {ProjectRuntimeState} from './project-state-types';
import {analyticalOperationalDocuments,sourceAnalyticalCandidateIds,SOURCE_ANALYTICAL_USE} from './operational-reporting';

/** T04: contract documents (dates, terms, notices, sections, amendments) use the
 * one shared source-analytical rule. A unique, fully read contract candidate is
 * used in analysis and labelled; competing, review-needed and superseded
 * candidates stay held. Stored basisState and authority are never changed. */
export function contractSourceAnalysis(state:ProjectRuntimeState){
  const eligible=new Set(analyticalOperationalDocuments(state.evidenceDocuments).map(d=>d.documentId));
  const unadopted=sourceAnalyticalCandidateIds(state.evidenceDocuments);
  const known=new Set(state.evidenceDocuments.map(d=>d.documentId));
  return {
    /** A contract record without an evidence row keeps its existing treatment. */
    eligible:(documentId:string,allowUnregistered=false)=>eligible.has(documentId)||(allowUnregistered&&!known.has(documentId)),
    unadopted:(documentId:string)=>unadopted.has(documentId),
  };
}
export const CONTRACT_SOURCE_ANALYTICAL_NOTE='Read from source; not formally adopted.';
export {SOURCE_ANALYTICAL_USE};
