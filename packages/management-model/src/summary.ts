import {
  stableFingerprint,
} from "../../analysis-runtime/src";
import type {
  CanonicalManagementSummary,
  DomainManagementState,
  DomainSummary,
  ManagementDto,
  RawModelEnvelope,
  ValidatedProjectionEnvelope,
  CompletionDateRecord,
} from "./types";

function overallState(
  domains: readonly DomainSummary[],
): DomainManagementState {
  if (
    domains.length > 0 &&
    domains.every((domain) => domain.state === "ready")
  ) {
    return "ready";
  }

  if (domains.some((domain) => domain.state === "failed")) {
    return domains.some(
      (domain) =>
        domain.state === "ready" ||
        domain.state === "partial",
    )
      ? "partial"
      : "failed";
  }

  if (
    domains.some(
      (domain) =>
        domain.state === "ready" ||
        domain.state === "partial",
    )
  ) {
    return "partial";
  }

  return "pending";
}

export function buildCanonicalManagementSummary(input: {
  projectId: string;
  analysisRunId: string;
  evidenceRevisionId: string;
  generatedAt: string;
  domains: DomainSummary[];
  completionDates: CompletionDateRecord[];
}): CanonicalManagementSummary {
  const summaryId =
    "summary_" +
    stableFingerprint({
      projectId: input.projectId,
      analysisRunId: input.analysisRunId,
      evidenceRevisionId: input.evidenceRevisionId,
      domains: input.domains,
      completionDates: input.completionDates,
    }).slice(0, 24);

  return {
    summaryId,
    projectId: input.projectId,
    analysisRunId: input.analysisRunId,
    evidenceRevisionId: input.evidenceRevisionId,
    generatedAt: input.generatedAt,
    overallState: overallState(input.domains),
    domains: input.domains.map((domain) => ({ ...domain })),
    completionDates: input.completionDates.map(
      (date) => ({
        ...date,
        sourceRefs: [...date.sourceRefs],
        evidenceRevisionIds: [
          ...date.evidenceRevisionIds,
        ],
      }),
    ),
  };
}

export function managementDto<T>(
  summary: CanonicalManagementSummary,
  projection: ValidatedProjectionEnvelope<T>,
): ManagementDto<T> {
  if (
    projection.projectId !== summary.projectId ||
    projection.analysisRunId !== summary.analysisRunId ||
    projection.evidenceRevisionId !==
      summary.evidenceRevisionId
  ) {
    throw new Error(
      "Projection does not belong to the canonical management summary",
    );
  }

  const domain = summary.domains.find(
    (item) =>
      item.key === projection.projectionKey,
  );

  if (!domain) {
    throw new Error(
      "Projection is not registered in the canonical management summary",
    );
  }

  const state = domain.state;

  return {
    projectId: summary.projectId,
    analysisRunId: summary.analysisRunId,
    evidenceRevisionId: summary.evidenceRevisionId,
    projectionKey: projection.projectionKey,
    state,
    summaryId: summary.summaryId,
    data:
      projection.validatedData !== null
        ? projection.validatedData
        : null,
    readableEvidence: projection.readableEvidence,
    processingMessage:
      state === "ready"
        ? null
        : projection.readableEvidence
          ? "Additional analysis is still processing."
          : "Preparing current project analysis.",
  };
}

export function rejectRawModelEnvelope(
  value: unknown,
): asserts value is never {
  const envelope = value as RawModelEnvelope;
  if (
    envelope &&
    typeof envelope === "object" &&
    "rawModelOutput" in envelope
  ) {
    throw new Error(
      "Raw model output cannot be exposed as a management DTO",
    );
  }
  throw new Error(
    "Only validated projection envelopes may be presented to management",
  );
}
