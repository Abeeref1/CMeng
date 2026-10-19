/** F02: one shared rule for the state of a security (bond, guarantee) at the
 * Data Date. It is decided only from the instrument's own release and expiry
 * dates. A stored "active" status never overrides a passed expiry date. */
export type SecurityStateAtDataDate='active'|'expiring'|'expired'|'released'|'not_established';
/** Renewal window before expiry, counted from the Data Date (calendar days). */
export const SECURITY_EXPIRING_WINDOW_DAYS=30;
export interface SecurityStateResult{state:SecurityStateAtDataDate;daysToExpiry:number|null;windowDays:number;inForce:boolean;basis:string}
const day=(iso:string|null|undefined)=>{const d=iso?String(iso).slice(0,10):'';return /^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))?d:null;};
export function securityStateAtDataDate(row:{status?:string|null;expiryIso?:string|null;releaseIso?:string|null},dataDateIso:string|null|undefined,windowDays=SECURITY_EXPIRING_WINDOW_DAYS):SecurityStateResult{
 const dd=day(dataDateIso),expiry=day(row.expiryIso),release=day(row.releaseIso);
 const daysToExpiry=dd&&expiry?Math.round((Date.parse(expiry)-Date.parse(dd))/86400000):null;
 if(release&&(!dd||release<=dd))return {state:'released',daysToExpiry,windowDays,inForce:false,basis:'Release date '+release+' is on or before the Data Date.'};
 if(!release&&/released|returned|cancell?ed/i.test(String(row.status??'')))return {state:'released',daysToExpiry,windowDays,inForce:false,basis:'Recorded as released.'};
 if(daysToExpiry!==null)return daysToExpiry<0?{state:'expired',daysToExpiry,windowDays,inForce:false,basis:'Expiry '+expiry+' is before the Data Date '+dd+'.'}
  :daysToExpiry<=windowDays?{state:'expiring',daysToExpiry,windowDays,inForce:true,basis:'Expiry '+expiry+' is within '+windowDays+' days after the Data Date '+dd+'.'}
  :{state:'active',daysToExpiry,windowDays,inForce:true,basis:'Expiry '+expiry+' is more than '+windowDays+' days after the Data Date '+dd+'.'};
 // Without both dates the state is not decided by date; a recorded expiry is kept, nothing is assumed active.
 if(/expired/i.test(String(row.status??'')))return {state:'expired',daysToExpiry,windowDays,inForce:false,basis:'Recorded as expired; expiry or Data Date not established.'};
 return {state:'not_established',daysToExpiry,windowDays,inForce:false,basis:!dd?'Data Date not established.':'Expiry date not established.'};
}
/** Stored BondRecord.status at the Data Date (additive: the old three values). */
export function securityStatusAtDataDate(row:{status?:string|null;expiryIso?:string|null;releaseIso?:string|null},dataDateIso:string|null|undefined):'active'|'expired'|'released'{
 const s=securityStateAtDataDate(row,dataDateIso).state;
 return s==='released'?'released':s==='expired'?'expired':'active';
}
/** F35: does the instrument cover its required period? The required end is
 * only what the contract establishes (e.g. taking-over plus the defects
 * period). Without it the coverage is not established, never assumed met. */
export type SecurityCoverageState='gap'|'covered'|'not_established';
export interface SecurityCoverageResult{coverageState:SecurityCoverageState;requiredEndIso:string|null;daysShort:number|null;reason:string}
export function securityCoverage(input:{expiryIso:string|null|undefined;requiredEndIso:string|null|undefined;requirementEstablished:boolean;requiredEndBasis?:string|undefined}):SecurityCoverageResult{
 const expiry=day(input.expiryIso),end=day(input.requiredEndIso);
 if(!input.requirementEstablished)return {coverageState:'not_established',requiredEndIso:null,daysShort:null,reason:'The contract does not establish the period this security must cover.'};
 if(!end)return {coverageState:'not_established',requiredEndIso:null,daysShort:null,reason:'The required cover end date is not established (taking-over date or defects period not supplied).'};
 if(!expiry)return {coverageState:'not_established',requiredEndIso:end,daysShort:null,reason:'The instrument expiry date is not established.'};
 const short=Math.round((Date.parse(end)-Date.parse(expiry))/86400000);
 return short>0?{coverageState:'gap',requiredEndIso:end,daysShort:short,reason:'Security expires '+expiry+', '+short+' days before the required cover end '+end+(input.requiredEndBasis?' ('+input.requiredEndBasis+')':'')+'.'}
  :{coverageState:'covered',requiredEndIso:end,daysShort:0,reason:'Security expiry '+expiry+' is on or after the required cover end '+end+(input.requiredEndBasis?' ('+input.requiredEndBasis+')':'')+'.'};
}
/** Calendar end of a stated period after a date (month ends clamp). Null when either input is unknown. */
export function addStatedPeriodIso(startIso:string|null|undefined,count:number|null|undefined,unit:string|null|undefined):string|null{
 const start=day(startIso);if(!start||typeof count!=='number'||!Number.isFinite(count)||!unit)return null;
 const u=unit.toLowerCase().replace(/s$/,'');const end=new Date(start+'T00:00:00.000Z');
 if(u==='day')end.setUTCDate(end.getUTCDate()+count);
 else if(u==='month'||u==='year'){const d=end.getUTCDate();end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+count*(u==='year'?12:1));const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();end.setUTCDate(Math.min(d,last));}
 else return null;
 return end.toISOString().slice(0,10);
}
