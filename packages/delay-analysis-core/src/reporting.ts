import { partitionAsOf, reportingScope } from '../../truth-kernel/src';
import type { CanonicalClaimRecord, ClaimRegisterSnapshot, DelayClaimsModel } from './types';

export function reportedClaim(claim: CanonicalClaimRecord): ClaimRegisterSnapshot {
  return claim.sourceRegister ?? {
    state: claim.state, sourceStatus: claim.state, claimedDays: claim.claimedDays,
    assessedDays: claim.assessedDays, claimedAmount: claim.claimedAmount, assessedAmount: claim.assessedAmount,
    employerDelayDays: null, contractorDelayDays: null,
    evidenceRefs: [...claim.evidenceRefs], diagnostics: [...claim.diagnostics],
  };
}

export function reportedClaimSummary(claims: readonly CanonicalClaimRecord[]) {
  const rows=claims.map(claim=>({claimId:claim.claimId,...reportedClaim(claim)}));
  const sum=(key:'claimedDays'|'assessedDays'|'employerDelayDays'|'contractorDelayDays')=>{
    const known=rows.map(r=>r[key]).filter((n):n is number=>n!==null);
    return {value:known.length?known.reduce((a,b)=>a+b,0):null,knownCount:known.length,recordCount:rows.length};
  };
  return {recordCount:rows.length,claimedDays:sum('claimedDays'),assessedDays:sum('assessedDays'),
    employerDelayDays:sum('employerDelayDays'),contractorDelayDays:sum('contractorDelayDays'),
    states:[...new Set(rows.map(r=>r.sourceStatus))].map(status=>({status,count:rows.filter(r=>r.sourceStatus===status).length})),
    conflictingRows:rows.filter(r=>r.diagnostics.some(d=>/CONFLICT|DIFFER|NOT_IN_DETERMINATION_REGISTER/.test(d))),
    rows,basis:'Source register values for claim identities known by the Data Date. Undated values and statuses are not confirmed historical decisions; claim-day sums are not project delay or EOT.'};
}

/** Reconstruct only what the dated evidence establishes at the reporting cutoff.
 * Notice dates establish that an item was known, never its event start or causation.
 * The original model is retained unchanged in source; later/undated records remain auditable.
 */
export function delayClaimsAsOf(source: DelayClaimsModel, dataDateIso: string | null) {
  const earliest = (dates: Array<string | null | undefined>) => dates.filter((v): v is string=>!!v).sort()[0]??null;
  const notices = partitionAsOf(source.notices,{name:'Notices issued by Data Date',entity:'notice',dataDateIso,
    dateBasis:'actualIssuedAt',sourceRevisionId:source.evidenceRevisionId,id:r=>r.noticeId,date:r=>r.actualIssuedAt});
  const events = partitionAsOf(source.events,{name:'Delay events evidenced by Data Date',entity:'delay_event',dataDateIso,
    dateBasis:'event start; otherwise earliest linked actual notice (existence only)',sourceRevisionId:source.evidenceRevisionId,id:r=>r.eventId,
    date:r=>r.startIso??earliest(source.notices.filter(n=>n.eventId===r.eventId).map(n=>n.actualIssuedAt))});
  const claims = partitionAsOf(source.claims,{name:'Claim identities evidenced by Data Date',entity:'claim',dataDateIso,
    dateBasis:'earliest submission or linked actual notice; not a determination date',sourceRevisionId:source.evidenceRevisionId,id:r=>r.claimId,
    date:r=>earliest([r.submittedAt,...source.notices.filter(n=>n.claimId===r.claimId&&n.kind!=='determination').map(n=>n.actualIssuedAt)])});
  const current: DelayClaimsModel = {...source,dataDateIso,
    events:events.asOf.map(r=>({...r,endIso:reportingScope(r.endIso,dataDateIso)==='as_of'?r.endIso:null})),
    claims:claims.asOf.map(r=>({...r,sourceRegister:reportedClaim(r),submittedAt:reportingScope(r.submittedAt,dataDateIso)==='as_of'?r.submittedAt:null,
      state:reportingScope(r.submittedAt,dataDateIso)==='as_of'?'submitted':'unknown',
      claimedDays:reportingScope(r.submittedAt,dataDateIso)==='as_of'?r.claimedDays:null,
      claimedAmount:reportingScope(r.submittedAt,dataDateIso)==='as_of'?r.claimedAmount:null,
      assessedDays:null,assessedDaysState:'missing',assessedAmount:null,assessedAmountState:'missing',
      diagnostics:[...r.diagnostics,'SOURCE_FINAL_STATUS_NOT_HISTORICAL_AUTHORITY']})),
    notices:notices.asOf,
    diagnostics:[...source.diagnostics,'POST_DATA_DATE_AND_UNDATED_RECORDS_RETAINED_OUTSIDE_CURRENT_POSITION'],
  };
  return {current,source,events,claims,notices,reported:reportedClaimSummary(claims.asOf)};
}
