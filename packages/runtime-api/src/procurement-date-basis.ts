import {createHash} from 'node:crypto';
import type {ProjectRuntimeState} from './project-state-types';

export type ProcurementDateChoice='programme'|'register';
/** Source-bound reporting choice. No dates or source rows are rewritten. */
export function procurementDateBasis(state:ProjectRuntimeState){
 const sourceFingerprint=createHash('sha256').update(JSON.stringify({
  schedules:state.schedules.map(s=>[s.revision.revisionId,s.sourceHashSha256,s.role,s.revision.model.dataDateIso]),
  adoption:Object.fromEntries(Object.entries(state.activeEvidenceBasis??{}).filter(([key])=>/schedule|procurement/.test(key))),
  delivery:{manual:state.delivery?.manual.filter(row=>row.kind==='package')??[],decisions:state.delivery?.decisions??[],mappings:state.delivery?.mappings??[]},
  documents:state.evidenceDocuments.filter(d=>d.documentType==='procurement_register').map(d=>[d.documentId,d.sourceHashSha256,d.basisState,d.tableConfirmations??[]]),
 })).digest('hex');
 const saved=state.controls.reviewDecisions?.['procurement-date-basis'];
 const choice=saved?.sourceFingerprint===sourceFingerprint&&['programme','register'].includes(saved.choice)?saved.choice as ProcurementDateChoice:null;
 return {sourceFingerprint,choice,confirmedAt:choice?saved!.confirmedAt:null};
}
