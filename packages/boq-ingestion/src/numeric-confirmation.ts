import {createHash} from 'node:crypto';
import type {BoqIngestionResult,CanonicalBoqCommercialItem} from './types';

export const numericFields=['quantity','rate','amount'] as const;
export type BoqNumericValues=Record<typeof numericFields[number],number|null>;
export interface BoqNumericConfirmation {
  decisionId:string;projectId:string;sourceHash:string;revisionId:string;itemId:string;
  fingerprint:string;values:BoqNumericValues;confirmedAt:string;confirmedBy:string;
}
/** Bind a decision to the exact retained reading and item meaning, not its row number. */
export function boqNumericFingerprint(item:CanonicalBoqCommercialItem):string {
  return createHash('sha256').update(JSON.stringify([
    item.itemNumber,item.section,item.description,item.unit,item.currency,
    item.sourceNumericReadings??{quantity:item.quantity,rate:item.rate,amount:item.amount},
    item.sourceRefs,item.sourceCellEvidence??null,
  ])).digest('hex');
}
export function confirmedBoqNumerics(result:BoqIngestionResult,item:CanonicalBoqCommercialItem):BoqNumericConfirmation|null {
  const c=item.numericConfirmation;
  return c&&c.projectId===result.projectId&&c.sourceHash===result.sourceHashSha256&&
    c.revisionId===result.evidenceReceipt.revisionId&&c.itemId===item.itemId&&
    c.fingerprint===boqNumericFingerprint(item)&&c.decisionId&&c.confirmedBy&&Number.isFinite(Date.parse(c.confirmedAt))&&
    numericFields.every(field=>c.values[field]===null||typeof c.values[field]==='number'&&Number.isFinite(c.values[field]))?c:null;
}
