import { reportingScope } from "../../truth-kernel/src";
import { eventFromEventSource } from "./event-population";
import type {
  CanonicalDelayEvent,
  CanonicalNoticeRecord,
  DelayClaimsModel,
  EventNoticeAssessment,
  NoticeRequirement,
} from "./types";

function ms(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** UTC midnight of the civil date written at the start of an ISO value. */
function civilDayMs(value: string | null): number | null {
  if (!value || ms(value) === null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
}

function applicableRequirement(
  event: CanonicalDelayEvent,
  requirements: readonly NoticeRequirement[],
): NoticeRequirement | null {
  const applicable = requirements
    .filter(requirement=>requirement.applicabilityState!=='unresolved'&&requirement.sourceDayBasis!=='working')
    .filter((requirement) =>
      requirement.eventCategories.length === 0 ||
      requirement.eventCategories.includes(event.category),
    )
    .filter(requirement=>{
      if(requirement.triggerBasis==='not_stated')return false;
      const trigger=requirement.triggerBasis==='awareness'?event.awarenessIso:event.startIso;
      // Missing trigger dates cannot choose between dated contract versions.
      if(!trigger)return !requirement.effectiveFromIso&&!requirement.effectiveToIso;
      const date=trigger.slice(0,10);
      return (!requirement.effectiveFromIso||date>=requirement.effectiveFromIso)&&
        (!requirement.effectiveToIso||date<requirement.effectiveToIso);
    })
    .sort((a, b) => {
      const rank = (state: string) =>
        state === "official"
          ? 0
          : state === "provisional"
            ? 1
            : state === "candidate"
              ? 2
              : 3;
      return (
        rank(a.state) - rank(b.state)
      );
    });

  const first=applicable[0];
  if(!first)return null;
  const peers=applicable.filter(r=>r.state===first.state);
  return new Set(peers.map(r=>[r.noticePeriodDays,r.triggerBasis??'event_start'].join(':'))).size===1?first:null;
}

function eventNotices(
  eventId: string,
  notices: readonly CanonicalNoticeRecord[],
): CanonicalNoticeRecord[] {
  return notices
    .filter(
      (notice) =>
        notice.eventId === eventId &&
        [
          "notice",
          "eot_notice",
          "claim_notice",
          "early_warning",
        ].includes(notice.kind),
    )
    .sort((a, b) => {
      const aMs = ms(a.actualIssuedAt);
      const bMs = ms(b.actualIssuedAt);

      if (aMs === null && bMs === null) return 0;
      if (aMs === null) return 1;
      if (bMs === null) return -1;
      return aMs - bMs;
    });
}

export function assessEventNotice(
  event: CanonicalDelayEvent,
  notices: readonly CanonicalNoticeRecord[],
  requirements: readonly NoticeRequirement[],
): EventNoticeAssessment {
  const requirement =
    applicableRequirement(event, requirements);
  const notice =
    eventNotices(event.eventId, notices)[0] ?? null;

  const candidateRules=requirements.filter(r=>r.eventCategories.length===0||r.eventCategories.includes(event.category));
  const triggerDatesMissing=candidateRules.length>0&&candidateRules.every(r=>ms(r.triggerBasis==='awareness'?event.awarenessIso??null:event.startIso)===null);
  const evidenceGaps = {
    requirementMissing: candidateRules.length === 0,
    eventDateMissing: candidateRules.length > 0 ? triggerDatesMissing : ms(event.startIso) === null,
    noticeDateMissing: ms(notice?.actualIssuedAt ?? null) === null,
  };

  if(triggerDatesMissing){
    return {evidenceGaps,eventId:event.eventId,requirementId:requirement?.requirementId??null,
      requiredNoticeDays:requirement?.noticePeriodDays??null,eventStartIso:event.startIso,
      noticeId:notice?.noticeId??null,noticeIssuedAt:notice?.actualIssuedAt??null,elapsedDays:null,
      timeliness:'event_date_missing',requirementState:requirement?.state??null,
      applicabilityNote:'Contract notice rules are present. Supply the event/awareness date and confirm which contract version applies; a notice date does not establish its trigger.'};
  }

  if (!requirement) {
    return {
      evidenceGaps,
      eventId: event.eventId,
      requirementId: null,
      requiredNoticeDays: null,
      eventStartIso: event.startIso,
      noticeId: notice?.noticeId ?? null,
      noticeIssuedAt:
        notice?.actualIssuedAt ?? null,
      elapsedDays: null,
      timeliness: candidateRules.length?'requirement_conflicted':"requirement_missing",
      requirementState: null,
      applicabilityNote:candidateRules.length?'No single applicable contract rule is confirmed for this trigger date. Reconcile effective dates and conflicting rules.':'No applicable notice rule has been read from the evidence.',
    };
  }

  const eventStart = ms(requirement.triggerBasis==='awareness'?event.awarenessIso??null:event.startIso);
  if (eventStart === null) {
    return {
      evidenceGaps,
      eventId: event.eventId,
      requirementId:
        requirement.requirementId,
      requiredNoticeDays:
        requirement.noticePeriodDays,
      eventStartIso: event.startIso,
      noticeId: notice?.noticeId ?? null,
      noticeIssuedAt:
        notice?.actualIssuedAt ?? null,
      elapsedDays: null,
      timeliness: "event_date_missing",
      requirementState:
        requirement.state,
    };
  }

  if (!notice) {
    return {
      evidenceGaps,
      eventId: event.eventId,
      requirementId:
        requirement.requirementId,
      requiredNoticeDays:
        requirement.noticePeriodDays,
      eventStartIso: event.startIso,
      noticeId: null,
      noticeIssuedAt: null,
      elapsedDays: null,
      timeliness: "not_issued",
      requirementState:
        requirement.state,
    };
  }

  const issued = ms(notice.actualIssuedAt);
  if (issued === null) {
    return {
      evidenceGaps,
      eventId: event.eventId,
      requirementId:
        requirement.requirementId,
      requiredNoticeDays:
        requirement.noticePeriodDays,
      eventStartIso: event.startIso,
      noticeId: notice.noticeId,
      noticeIssuedAt:
        notice.actualIssuedAt,
      elapsedDays: null,
      timeliness: "notice_date_missing",
      requirementState:
        requirement.state,
    };
  }

  // Contract notice periods count civil days: a notice issued at any time on
  // the last allowed day is within the period. Measure from the stated dates,
  // not from milliseconds, so the time of day never turns a timely notice late.
  const triggerCivil = civilDayMs(requirement.triggerBasis==='awareness'?event.awarenessIso??null:event.startIso);
  const issuedCivil = civilDayMs(notice.actualIssuedAt);
  const elapsedDays = Number(
    (
      (issuedCivil !== null && triggerCivil !== null ? issuedCivil - triggerCivil : issued - eventStart) /
      86_400_000
    ).toFixed(6),
  );

  return {
    evidenceGaps,
    eventId: event.eventId,
    requirementId:
      requirement.requirementId,
    requiredNoticeDays:
      requirement.noticePeriodDays,
    eventStartIso: event.startIso,
    noticeId: notice.noticeId,
    noticeIssuedAt:
      notice.actualIssuedAt,
    elapsedDays,
    elapsedFromIso:requirement.triggerBasis==='awareness'?event.awarenessIso??null:event.startIso,
    elapsedFromBasis:requirement.triggerBasis==='awareness'?'awareness':'event_start',
    timeliness:
      elapsedDays <=
      requirement.noticePeriodDays
        ? "timely"
        : "late",
    requirementState:
      requirement.state,
  };
}

export function assessAllEventNotices(
  model: DelayClaimsModel,
): EventNoticeAssessment[] {
  // SW-15: an event date (and awareness date) comes only from an event source.
  // A claim row that cites an event gives no event date, so its timing is not assessed.
  // The notices known by the Data Date are the same for every event: select
  // them once. Each event reads only the notices that name it, so group them
  // once by event id in source order; assessEventNotice then sees exactly the
  // rows its own event-id filter would keep, in the same order.
  const asOf = model.dataDateIso ? model.notices.filter(n=>reportingScope(n.actualIssuedAt,model.dataDateIso)==='as_of') : model.notices;
  const byEvent = new Map<string | null, CanonicalNoticeRecord[]>();
  for (const notice of asOf) {
    const group = byEvent.get(notice.eventId);
    if (group) group.push(notice); else byEvent.set(notice.eventId, [notice]);
  }
  return model.events.map((event) =>
    assessEventNotice(
      eventFromEventSource(event, model) ? event : { ...event, startIso: null, awarenessIso: null, endIso: null },
      byEvent.get(event.eventId) ?? [],
      model.noticeRequirements,
    ),
  );
}
