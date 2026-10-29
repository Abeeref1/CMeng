import type {ControlIssue} from '../../truth-kernel/src';
import type {ProjectRuntimeState,ProjectControlState} from './project-state-types';
import {canonicalTimeClaims} from './canonical-time-claims';
import {reportingContractValue,reportingTimeBasis,contractValueReview} from './source-review-decisions';
import {commencementDatePosition,contractStatesPeriodFromCommencement} from './contract-time-reader';

/** T04 / C2: missing contract values a user can supply directly in Actions
 * required. Each is entered once, stored with a 'user-confirmation:' source
 * reference (as the confirmed contractual completion date is), and never
 * replaces a value that a source or an earlier confirmation already holds. */
export type MissingValueInputKind='contract-value'|'approved-eot-days'|'commencement-date';
export const missingValueInputKinds:readonly MissingValueInputKind[]=['contract-value','approved-eot-days','commencement-date'];
export const isMissingValueInputKind=(kind:unknown):kind is MissingValueInputKind=>missingValueInputKinds.includes(kind as MissingValueInputKind);

/** Raw field names (machine data, never display wording) of the findings that
 * one entered value answers. */
const inputFields:Record<MissingValueInputKind,RegExp>={
  'contract-value':/(?:^|\.)(?:contractValue|contractValueEvidence|contractSum|contractCurrency)$/,
  'approved-eot-days':/(?:^|\.)(?:approvedEotDays|officialApprovedEotDays)$/,
  'commencement-date':/(?:^|\.)commencementDateIso$/,
};
export function missingValueInputKind(issue:ControlIssue):MissingValueInputKind|null{
  if(issue.kind!=='missing_information')return null;
  const fields=[issue.field??'',...issue.evidencePaths];
  return missingValueInputKinds.find(kind=>fields.some(field=>inputFields[kind].test(field)))??null;
}

/** The value every page already reads for this field, or null when unknown. */
export function heldMissingValue(state:ProjectRuntimeState,kind:MissingValueInputKind):unknown{
  if(kind==='contract-value')return reportingContractValue(state);
  if(kind==='commencement-date')return commencementDatePosition(state).dateIso;
  const basis=reportingTimeBasis(state,canonicalTimeClaims(state).contractTimeBasis);
  // C9 / M7.1: when the register holds determinations, the days come from it (and
  // any amendment overlap is the one decision); a typed entry is not asked as well.
  return basis?.officialApprovedEotDays??(basis?.registerDeterminationCount?(basis.registerDeterminationDays??basis.overlapProposal?.inEffectDays??basis.registerDeterminationCount):null);
}
/** A field is open for input only while nothing holds it. Read contract value
 * candidates keep their own source review decision instead of a free entry. */
export function openMissingValueInputs(state:ProjectRuntimeState):Set<MissingValueInputKind>{
  const open=new Set<MissingValueInputKind>();
  if(heldMissingValue(state,'contract-value')===null&&!contractValueReview(state).candidates.length)open.add('contract-value');
  if(heldMissingValue(state,'approved-eot-days')===null)open.add('approved-eot-days');
  // F34: the Commencement Date is asked for only when the contract states a Time
  // for Completion as a period counted from it and no source states it (or the
  // sources disagree).
  if(heldMissingValue(state,'commencement-date')===null&&contractStatesPeriodFromCommencement(state))open.add('commencement-date');
  return open;
}

/** The governed reporting group for a finding the user can answer here. */
export function missingValueInputGroup(kind:MissingValueInputKind){
  if(kind==='commencement-date')return {key:'commencement-date-entry',title:'Commencement Date',available:true,note:'The contract states a Time for Completion as a period counted from the Commencement Date, but no Commencement Date is established from the project sources. Enter it here if you hold it; the completion dates stay unknown until then.'};
  return kind==='contract-value'
    ?{key:'contract-value-entry',title:'Contract value and currency',available:true,note:'No contract value is established from the project sources. Enter it here if you hold it; measures that need it stay unavailable until then.'}
    :{key:'approved-eot-days-entry',title:'Approved EOT days',available:true,note:'No approved extension of time is established from the project sources. Enter the approved days here if you hold them; they stay unknown until then, never zero.'};
}

/** Validated controls change for one entered value. Throws when the input is
 * invalid or when any value is already held, so nothing is overwritten. */
export function missingValueInputPatch(state:ProjectRuntimeState,kind:MissingValueInputKind,input:{amount?:unknown;currency?:unknown;days?:unknown;dateIso?:unknown}):Partial<ProjectControlState>{
  if(!openMissingValueInputs(state).has(kind))throw new Error('This value is already established and is not replaced here. Refresh Actions required.');
  if(kind==='commencement-date'){
    const dateIso=String(input.dateIso??'').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)||!Number.isFinite(Date.parse(dateIso+'T00:00:00Z'))||new Date(dateIso+'T00:00:00Z').toISOString().slice(0,10)!==dateIso)throw new Error('Enter the Commencement Date as a valid date.');
    return {commencementDate:{dateIso,confirmedAt:new Date().toISOString(),sourceRefs:['user-confirmation:commencement-date:'+dateIso]}};
  }
  if(kind==='contract-value'){
    const rawAmount=String(input.amount??'').replaceAll(',','').trim(),amount=Number(rawAmount);
    if(!rawAmount||!Number.isFinite(amount)||amount<=0)throw new Error('Enter the contract value as a positive amount.');
    const currency=String(input.currency??'').trim().toUpperCase();
    if(!/^[A-Z]{3}$/.test(currency))throw new Error('Enter the contract currency as a three-letter code, for example SAR.');
    return {contractValue:{amount,currency,sourceRefs:['user-confirmation:contract-value:'+currency+':'+amount]}};
  }
  const rawDays=String(input.days??'').trim(),days=Number(rawDays);
  if(!rawDays||!Number.isInteger(days)||days<0||days>36500)throw new Error('Enter the approved EOT as whole days, including zero when none is approved.');
  const current=state.controls.contractTimeBasis;
  return {contractTimeBasis:{
    ...(current??{}),
    contractualCompletionIso:current?.contractualCompletionIso??null,
    contractualCompletionState:current?.contractualCompletionState??'missing',
    officialApprovedEotDays:days,
    officialApprovedEotState:'official',
    eotDayBasis:current?.eotDayBasis??'unknown',
    eotDayBasisState:current?.eotDayBasisState??'missing',
    sourceRefs:[...new Set([...(current?.sourceRefs??[]),'user-confirmation:approved-eot-days:'+days])],
  }};
}
/** True when the stored award was entered by the user (not read from a source). */
export const userEnteredApprovedEot=(basis:{sourceRefs:string[]}|null|undefined)=>Boolean(basis?.sourceRefs.some(ref=>ref.startsWith('user-confirmation:approved-eot-days:')));
