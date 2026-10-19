/** F45: one shared lump-sum quantity rule. A lump sum is one whole item: its
 * contract quantity is 1 and its installed or certified quantity is 0 or 1.
 * Any other value means the BOQ unit or the quantity is wrong, so the item is
 * queried, never corrected, and its quantity is never added to other items or
 * units. The same regular expression as the original Quantity S-Curve rule. */
export const LUMP_SUM_UNIT=/^(ls|l\.?s\.?|lump\s*sum)$/i;
export function isLumpSumUnit(unit:string|null|undefined):boolean{return LUMP_SUM_UNIT.test(String(unit??'').trim());}
export type LumpSumQueryReason='contract_quantity_not_1'|'installed_quantity_not_0_or_1'|'certified_quantity_not_0_or_1';
export const LUMP_SUM_QUERY_TEXT:Record<LumpSumQueryReason,string>={
 contract_quantity_not_1:'Lump-sum quantity differs from 1. Confirm the unit or the contract quantity against the BOQ.',
 installed_quantity_not_0_or_1:'Installed lump-sum quantity is not 0 or 1. Confirm the unit or the measured quantity.',
 certified_quantity_not_0_or_1:'Certified lump-sum quantity is not 0 or 1. Confirm the unit or the certified quantity.',
};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function lumpSumQuantityQuery(item:{unit:string|null;contractQuantity:number|null},measured:{installedQuantity?:number|null;certifiedQuantity?:number|null}={}){
 const reasons:LumpSumQueryReason[]=[];
 if(isLumpSumUnit(item.unit)){
  if(item.contractQuantity!==null&&item.contractQuantity!==1)reasons.push('contract_quantity_not_1');
  if(finite(measured.installedQuantity)&&measured.installedQuantity!==0&&measured.installedQuantity!==1)reasons.push('installed_quantity_not_0_or_1');
  if(finite(measured.certifiedQuantity)&&measured.certifiedQuantity!==0&&measured.certifiedQuantity!==1)reasons.push('certified_quantity_not_0_or_1');
 }
 return {reasons,reason:reasons.map(r=>LUMP_SUM_QUERY_TEXT[r]).join(' ')};
}
