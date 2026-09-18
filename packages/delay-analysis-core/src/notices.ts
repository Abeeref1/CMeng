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

function applicableRequirement(
  event: CanonicalDelayEvent,
  requirements: readonly NoticeRequirement[],
): NoticeRequirement | null {
  const applicable = requirements
    .filter((requirement) =>
      requirement.eventCategories.length === 0 ||
      requirement.eventCategories.includes(event.category),
    )
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
        rank(a.state) - rank(b.state) ||
        a.noticePeriodDays - b.noticePeriodDays
      );
    });

  return applicable[0] ?? null;
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

  if (!requirement) {
    return {
      eventId: event.eventId,
      requirementId: null,
      requiredNoticeDays: null,
      eventStartIso: event.startIso,
      noticeId: notice?.noticeId ?? null,
      noticeIssuedAt:
        notice?.actualIssuedAt ?? null,
      elapsedDays: null,
      timeliness: "requirement_missing",
      requirementState: null,
    };
  }

  const eventStart = ms(event.startIso);
  if (eventStart === null) {
    return {
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

  const elapsedDays = Number(
    (
      (issued - eventStart) /
      86_400_000
    ).toFixed(6),
  );

  return {
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
  return model.events.map((event) =>
    assessEventNotice(
      event,
      model.notices,
      model.noticeRequirements,
    ),
  );
}
