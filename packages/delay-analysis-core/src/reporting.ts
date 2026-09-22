import { partitionAsOf, reportingScope } from '../../truth-kernel/src';
import type { DelayClaimsModel } from './types';

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
    claims:claims.asOf.map(r=>({...r,submittedAt:reportingScope(r.submittedAt,dataDateIso)==='as_of'?r.submittedAt:null,
      state:reportingScope(r.submittedAt,dataDateIso)==='as_of'?'submitted':'unknown',
      claimedDays:reportingScope(r.submittedAt,dataDateIso)==='as_of'?r.claimedDays:null,
      claimedAmount:reportingScope(r.submittedAt,dataDateIso)==='as_of'?r.claimedAmount:null,
      assessedDays:null,assessedDaysState:'missing',assessedAmount:null,assessedAmountState:'missing',
      diagnostics:[...r.diagnostics,'SOURCE_FINAL_STATUS_NOT_HISTORICAL_AUTHORITY']})),
    notices:notices.asOf,
    diagnostics:[...source.diagnostics,'POST_DATA_DATE_AND_UNDATED_RECORDS_RETAINED_OUTSIDE_CURRENT_POSITION'],
  };
  return {current,source,events,claims,notices};
}
