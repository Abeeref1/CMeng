import type {BondControlInput,ContractClauseCandidateInput} from './types';

/** Expiry at the reporting date and contract coverage are separate questions. */
export function performanceSecurityValidity(bond:BondControlInput,clauses:ContractClauseCandidateInput[],programmeFinishIso:string|null){
 if(bond.kind!=='performance'||bond.status==='released')return null;
 const requirements=clauses.filter(clause=>/performance\s+(?:security|bond|guarantee)/i.test(clause.textPreview)&&/(?:valid|maintain|remain).*?(?:defects|remedied|performance certificate)/i.test(clause.textPreview));
 if(!requirements.length)return null;
 const after=programmeFinishIso&&bond.expiryIso?(Date.parse(bond.expiryIso.slice(0,10))-Date.parse(programmeFinishIso.slice(0,10)))/86400000:null;
 return {state:'review_required' as const,programmeFinishIso,daysAfterProgrammeFinish:after,requiredReleaseDateIso:null,
  message:after===null?'Performance security must remain valid through the stated completion and defects obligations. Confirm the required release date and instrument expiry.':after<0?'Performance security expires '+(-after)+' calendar days before the programme finish. Obtain an extension covering completion and the stated defects obligations.':'Performance security expires '+after+' calendar days after the programme finish. The contract also requires coverage through the defects obligations; confirm the release date and extend the instrument if necessary.',
  basis:'Contract wording does not establish when all defects will be remedied. A forecast completion date alone cannot establish compliance with this requirement.',
  sourceRefs:[...new Set([...bond.sourceRefs,...requirements.flatMap(clause=>clause.sourceRefs??[clause.sourceRef])])]};
}
