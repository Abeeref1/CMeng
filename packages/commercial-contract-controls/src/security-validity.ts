import type {BondControlInput,ContractClauseCandidateInput} from './types';
import {securityCoverage,addStatedPeriodIso} from '../../truth-kernel/src';

/** Expiry at the reporting date and contract coverage are separate questions. */
export function performanceSecurityValidity(bond:BondControlInput,clauses:ContractClauseCandidateInput[],programmeFinishIso:string|null){
 if(bond.kind!=='performance'||bond.status==='released')return null;
 const requirements=clauses.filter(clause=>/performance\s+(?:security|bond|guarantee)/i.test(clause.textPreview)&&/(?:valid|maintain|remain).*?(?:defects|remedied|performance certificate)/i.test(clause.textPreview));
 if(!requirements.length)return null;
 const after=programmeFinishIso&&bond.expiryIso?(Date.parse(bond.expiryIso.slice(0,10))-Date.parse(programmeFinishIso.slice(0,10)))/86400000:null;
 // F35: the shared coverage rule. Required end = programme completion plus the
 // defects period stated in the contract; one distinct stated period only.
 const periods=new Map(clauses.flatMap(clause=>[...clause.textPreview.matchAll(/defects\s+(?:notification|liability)\s+period\s*(?:is|of|:|=)?\s*(\d+)\s*(days?|months?|years?)/gi)].map(m=>[m[1]+':'+m[2]!.toLowerCase().replace(/s$/,''),{count:Number(m[1]),unit:m[2]!.toLowerCase().replace(/s$/,'')}] as const)));
 const period=periods.size===1?[...periods.values()][0]!:null;
 const requiredEndIso=period?addStatedPeriodIso(programmeFinishIso,period.count,period.unit):null;
 const coverage=securityCoverage({expiryIso:bond.expiryIso,requiredEndIso,requirementEstablished:true,requiredEndBasis:period?'programme completion plus the '+period.count+'-'+period.unit+' defects period':undefined});
 return {state:'review_required' as const,programmeFinishIso,daysAfterProgrammeFinish:after,requiredReleaseDateIso:null,
  coverageState:coverage.coverageState,coverageGapDays:coverage.daysShort,requiredCoverEndIso:coverage.requiredEndIso,coverageReason:coverage.reason,
  message:coverage.coverageState==='gap'?coverage.reason+' Obtain an extension covering completion and the defects period.':after===null?'Performance security must remain valid through the stated completion and defects obligations. Confirm the required release date and instrument expiry.':after<0?'Performance security expires '+(-after)+' calendar days before the programme finish. Obtain an extension covering completion and the stated defects obligations.':'Performance security expires '+after+' calendar days after the programme finish. The contract also requires coverage through the defects obligations; confirm the release date and extend the instrument if necessary.',
  basis:'Contract wording does not establish when all defects will be remedied. A forecast completion date alone cannot establish compliance with this requirement.',
  sourceRefs:[...new Set([...bond.sourceRefs,...requirements.flatMap(clause=>clause.sourceRefs??[clause.sourceRef])])]};
}

/** Insurance class named in a policy or a contract clause; null = generic "insurance". */
// Abbreviations are matched case-sensitively as whole tokens ("CAR", never "car").
function insuranceClass(text:string):'works'|'third_party'|'professional'|'workers'|null{
 return /contractor.?s?\s+all\s+risks?|erection\s+all\s+risks?|works\s+insurance|insurance\s+of\s+(?:the\s+)?works/i.test(text)||/\b(?:CAR|EAR)\b/.test(text)?'works'
  :/third.party|public\s+liability/i.test(text)||/\bTPL\b/.test(text)?'third_party'
  :/professional\s+indemnity/i.test(text)||/\bPI\b/.test(text)?'professional'
  :/workm[ae]n.?s?\s+compensation|employer.?s\s+liability/i.test(text)||/\bWC\b/.test(text)?'workers':null;
}
/** F35: insurance cover against the period the contract states for it. Only
 * an explicit end condition in an insurance clause is used: until taking-over
 * (planned at programme completion) or until the end of the defects period
 * (programme completion plus the one stated defects period). Several end
 * conditions, or none, leave the required period not established. */
export function insuranceCoverValidity(policy:{policyId:string;kind:string;expiryDate:string|null;sourceRefs:string[]},clauses:ContractClauseCandidateInput[],programmeFinishIso:string|null){
 const policyClass=insuranceClass(policy.kind+' '+policy.policyId);
 const relevant=clauses.filter(clause=>/insurance|all\s+risks?/i.test(clause.textPreview)&&/(?:maintain|in\s+(?:full\s+)?force|remain\s+(?:valid|in\s+force)|valid|effect)[^.]{0,160}?\buntil\b/i.test(clause.textPreview)).filter(clause=>{const c=insuranceClass(clause.textPreview);return c===null||c===policyClass;});
 const ends=new Set<'taking_over'|'defects_end'>();
 for(const clause of relevant){const until=/\buntil\b([^.]{0,200})/i.exec(clause.textPreview)?.[1]??'';
  if(/defects\s+(?:notification|liability)\s+period|performance\s+certificate|defects\s+certificate/i.test(until))ends.add('defects_end');
  else if(/taking.?over|practical\s+completion|completion\s+of\s+the\s+works/i.test(until))ends.add('taking_over');}
 const periods=new Map(clauses.flatMap(clause=>[...clause.textPreview.matchAll(/defects\s+(?:notification|liability)\s+period\s*(?:is|of|:|=)?\s*(\d+)\s*(days?|months?|years?)/gi)].map(m=>[m[1]+':'+m[2]!.toLowerCase().replace(/s$/,''),{count:Number(m[1]),unit:m[2]!.toLowerCase().replace(/s$/,'')}] as const)));
 const period=periods.size===1?[...periods.values()][0]!:null;
 const end=ends.size===1?[...ends][0]!:null;
 const requiredEndIso=end==='taking_over'?(programmeFinishIso?.slice(0,10)??null):end==='defects_end'&&period?addStatedPeriodIso(programmeFinishIso,period.count,period.unit):null;
 const basis=end==='taking_over'?'until taking-over, planned at programme completion':end==='defects_end'&&period?'until the end of the '+period.count+'-'+period.unit+' defects period after programme completion':undefined;
 const coverage=securityCoverage({expiryIso:policy.expiryDate,requiredEndIso,requirementEstablished:end!==null,requiredEndBasis:basis});
 return {...coverage,requiredCoverEnd:end,
  reason:ends.size>1?'The contract states more than one insurance end condition for this policy; the required period is not established.':coverage.reason,
  basis:'Taking-over is planned at programme completion; actual certificates and later extensions remain separate.',
  sourceRefs:[...new Set([...policy.sourceRefs,...relevant.flatMap(clause=>clause.sourceRefs??[clause.sourceRef])])]};
}
