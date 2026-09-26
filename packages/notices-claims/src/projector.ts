import {
  assessAllEventNotices,
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

  const projection:NoticesClaimsProjection = {
    schemaVersion: "1.0",
    projectionKey: "notices_claims",
    generatedAt: input.generatedAt,
    producerVersion:
      input.producerVersion,
    projectId: model.projectId,
    evidenceRevisionId:
      model.evidenceRevisionId,

    eventCount: events.length,
    claimCount: claims.length,
    noticeCount:
      model.notices.filter(n=>n.kind!=='determination').length,

    timelyNoticeCount:
      events.filter(
        (event) =>
          event.noticeTimeliness ===
          "timely",
      ).length,
    lateNoticeCount:
      events.filter(
        (event) =>
          event.noticeTimeliness ===
          "late",
      ).length,
    missingNoticeCount:
      events.filter(
        (event) =>
          event.noticeTimeliness ===
          "not_issued" ||
          event.noticeTimeliness ===
          "notice_date_missing",
      ).length,
    noticeRequirementMissingCount:
      events.filter(
        (event) =>
          event.noticeTimeliness ===
          "requirement_missing",
      ).length,

    officialAssessedDaysTotal,
    noticeEventDateMissingCount:events.filter(e=>e.noticeTimeliness==='event_date_missing').length,
    noticeRequirementConflictCount:events.filter(e=>e.noticeTimeliness==='requirement_conflicted').length,
    provisionalOrCandidateAssessedDaysTotal,
    officialAssessedAmountTotal,
    provisionalOrCandidateAssessedAmountTotal,

    events,
    claims,
    diagnostics: [
      ...model.diagnostics,
    ],
  };
  if(input.populationEstablished===false)for(const key of ["eventCount", "claimCount", "noticeCount", "timelyNoticeCount", "lateNoticeCount", "missingNoticeCount", "noticeRequirementMissingCount", "noticeEventDateMissingCount", "noticeRequirementConflictCount"] as const)projection[key]=null;
  return projection;
}
