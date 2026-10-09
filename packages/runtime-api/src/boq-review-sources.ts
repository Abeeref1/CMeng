import type {BoqIngestionResult} from '../../boq-ingestion/src';
import type {ProjectRuntimeState} from './project-state-types';
import {normalizeProjectCode} from './project-identity';
export function reviewableBoqs(state:ProjectRuntimeState):BoqIngestionResult[]{
 const sources=[...state.boqRevisions,...state.boq?[state.boq]:[]];
 return [...new Map(sources.filter(b=>normalizeProjectCode(b.projectId)===state.projectId).filter(b=>{
   const documents=state.evidenceDocuments.filter(d=>d.sourceHashSha256===b.sourceHashSha256&&(d.linkedArtifactId===b.ingestionId||d.boqTableRead?.ingestionId===b.ingestionId));
   return !documents.length||documents.some(d=>['candidate','active','additive'].includes(d.basisState));
 }).map(b=>[b.ingestionId,b])).values()];
}
