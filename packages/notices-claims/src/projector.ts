import {
  assessAllEventNotices,
  delayEventPopulation,
  type DelayClaimsModel,
} from "../../delay-analysis-core/src";
import type {
  NoticesClaimsProjection,
} from "./types";
import {reportedClaim} from '../../delay-analysis-core/src/reporting';

function sumByState(
  values: Array<{
    value: number | null;
    state: string;
  }>,
  predicate: (state: string) => boolean,
): number | null {
  const known = values.filter(
    (item) =>
      item.value !== null &&
      predicate(item.state),
  );

  if (known.length === 0) return null;

  return Number(
    known
      .reduce(
        (sum, item) =>
          sum + item.value!,
        0,
      )
      .toFixed(6),
  );
}

export function noticeComplianceAssessable(projection:NoticesClaimsProjection):boolean {
  return projection.eventCount!==null&&projection.eventCount>0&&
    projection.events.length===projection.eventCount&&projection.events.every(event=>
      event.requirementState==='official'&&['timely','late','not_issued'].includes(event.noticeTimeliness));
}

export function buildNoticesClaimsProjection(
  model: DelayClaimsModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    populationEstablished?: boolean;
  },
): NoticesClaimsProjection {
  const noticeAssessments =
    assessAllEventNotices(model);
  const noticeAssessmentByEvent =
    new Map(
      noticeAssessments.map(
        (assessment) => [
          assessment.eventId,
          assessment,
        ],
      ),
    );

  const claimsByEvent =
    new Map<string, string[]>();

  for (const claim of model.claims) {
    for (const eventId of claim.eventIds) {
      const list =
        claimsByEvent.get(eventId) ?? [];
      list.push(claim.claimId);
      claimsByEvent.set(
        eventId,
        list,
      );
    }
  }

  const noticesByClaim =
    new Map<string, string[]>();

  for (const notice of model.notices) {
    if (!notice.claimId) continue;
    const list =
      noticesByClaim.get(
        notice.claimId,
      ) ?? [];
    list.push(notice.noticeId);
    noticesByClaim.set(
      notice.claimId,
      list,
    );
  }

  const events = model.events.map(
    (event) => {
      const assessment =
        noticeAssessmentByEvent.get(
          event.eventId,
        );

      return {
        eventId: event.eventId,
        title: event.title,
        responsibility:
          event.responsibility,
        responsibilityState:
          event.responsibilityState,
        eventStartIso: event.startIso,
        eventEndIso: event.endIso,
        noticeId:
          assessment?.noticeId ??
          null,
        noticeIssuedAt:
          assessment?.noticeIssuedAt ??
          null,
        requirementId:
          assessment?.requirementId ??
          null,
        requiredNoticeDays:
          assessment?.requiredNoticeDays ??
          null,
        elapsedNoticeDays:
          assessment?.elapsedDays ??
          null,
        noticeTimeliness:
          assessment?.timeliness ??
          "requirement_missing",
        requirementState:
          assessment?.requirementState ??
          null,
        linkedClaimIds: [
          ...new Set(
            claimsByEvent.get(
              event.eventId,
            ) ?? [],
          ),
        ].sort(),
      };
    },
  );

  const claims = model.claims.map(
    (claim) => ({
      claimId: claim.claimId,
      title: claim.title,
      state: claim.state,
      sourceRegister:reportedClaim(claim),
      submittedAt: claim.submittedAt,
      eventIds: [...claim.eventIds],
      claimedDays: claim.claimedDays,
      assessedDays:
        claim.assessedDays,
      assessedDaysState:
        claim.assessedDaysState,
      claimedAmount:
        claim.claimedAmount,
      assessedAmount:
        claim.assessedAmount,
      assessedAmountState:
        claim.assessedAmountState,
      noticeIds: [
        ...new Set(
          noticesByClaim.get(
            claim.claimId,
          ) ?? [],
        ),
      ].sort(),
    }),
  );

  const officialAssessedDaysTotal =
    sumByState(
      model.claims.map((claim) => ({
        value: claim.assessedDays,
        state:
          claim.assessedDaysState,
      })),
      (state) => state === "official",
    );

  const provisionalOrCandidateAssessedDaysTotal =
    sumByState(
      model.claims.map((claim) => ({
        value: claim.assessedDays,
        state:
          claim.assessedDaysState,
      })),
      (state) =>
        state === "provisional" ||
        state === "candidate",
    );

  const officialAssessedAmountTotal =
    sumByState(
      model.claims.map((claim) => ({
        value: claim.assessedAmount,
        state:
          claim.assessedAmountState,
      })),
      (state) => state === "official",
    );

  const provisionalOrCandidateAssessedAmountTotal =
    sumByState(
      model.claims.map((claim) => ({
        value: claim.assessedAmount,
        state:
          claim.assessedAmountState,
      })),
      (state) =>
        state === "provisional" ||
        state === "candidate",
    );

  // Delay events come only from event sources; claim rows stay claims (SW-15).
  const eventPopulation = delayEventPopulation(model);
  const sourceEvents = events.filter((_, index) => eventPopulation.fromEventSource[index]);

  const projection:NoticesClaimsProjection = {
    schemaVersion: "1.0",
    projectionKey: "notices_claims",
    generatedAt: input.generatedAt,
    producerVersion:
      input.producerVersion,
    projectId: model.projectId,
    evidenceRevisionId:
      model.evidenceRevisionId,

    eventCount: sourceEvents.length,
    claimCount: claims.length,
    noticeCount:
      model.notices.filter(n=>n.kind!=='determination').length,

    timelyNoticeCount:
      sourceEvents.filter(
        (event) =>
          event.noticeTimeliness ===
          "timely",
      ).length,
    lateNoticeCount:
      sourceEvents.filter(
        (event) =>
          event.noticeTimeliness ===
          "late",
      ).length,
    missingNoticeCount:
      sourceEvents.filter(
        (event) =>
          event.noticeTimeliness ===
          "not_issued" ||
          event.noticeTimeliness ===
          "notice_date_missing",
      ).length,
    noticeRequirementMissingCount:
      sourceEvents.filter(
        (event) =>
          event.noticeTimeliness ===
          "requirement_missing",
      ).length,

    officialAssessedDaysTotal,
    noticeEventDateMissingCount:sourceEvents.filter(e=>e.noticeTimeliness==='event_date_missing').length,
    noticeRequirementConflictCount:sourceEvents.filter(e=>e.noticeTimeliness==='requirement_conflicted').length,
    provisionalOrCandidateAssessedDaysTotal,
    officialAssessedAmountTotal,
    provisionalOrCandidateAssessedAmountTotal,

    eventPopulationState: eventPopulation.state,
    eventPopulationReason: eventPopulation.reason,
    events,
    claims,
    diagnostics: [
      ...model.diagnostics,
    ],
  };
  if(eventPopulation.state==="not_established")for(const key of NOTICE_EVENT_COUNT_KEYS)projection[key]=null;
  if(input.populationEstablished===false)for(const key of ["eventCount", "claimCount", "noticeCount", "timelyNoticeCount", "lateNoticeCount", "missingNoticeCount", "noticeRequirementMissingCount", "noticeEventDateMissingCount", "noticeRequirementConflictCount"] as const)projection[key]=null;
  return projection;
}

/** Counts of delay events (by notice timeliness). Not established without an event source; claim and notice counts stay. */
const NOTICE_EVENT_COUNT_KEYS = ["eventCount", "timelyNoticeCount", "lateNoticeCount", "missingNoticeCount", "noticeRequirementMissingCount", "noticeEventDateMissingCount", "noticeRequirementConflictCount"] as const;
