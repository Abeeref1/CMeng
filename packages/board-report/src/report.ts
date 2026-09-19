import {
  stableFingerprint,
} from "../../analysis-runtime/src";
import type {
  ProjectDirectorPosition,
} from "../../project-director/src";
import type {
  BoardReadyReport,
  BoardReportPublicationInput,
} from "./types";

export function buildBoardReadyReport(
  position: ProjectDirectorPosition,
  publication: BoardReportPublicationInput,
): BoardReadyReport {
  const evidenceReceiptIds = [
    ...new Set(
      publication.evidenceReceiptIds,
    ),
  ].sort();

  const ready =
    publication.sourceManifestId !== null &&
    evidenceReceiptIds.length > 0 &&
    publication.finalizedAt !== null;

  const sourceFingerprint =
    stableFingerprint({
      projectId: position.projectId,
      generatedAt: position.generatedAt,
      sourceManifestId:
        publication.sourceManifestId,
      evidenceReceiptIds,
      directorEvidenceRefs:
        position.evidenceRefs,
      schedule: position.schedule,
      claims: position.claims,
      ld: position.ld,
      commercialByCurrency:
        position.commercialByCurrency,
      controls: position.controls,
    });

  return {
    schemaVersion: "1.0",
    reportId:
      "board-report-" +
      sourceFingerprint.slice(0, 24),
    projectId: position.projectId,
    generatedAt: position.generatedAt,
    state:
      ready
        ? "board_ready"
        : "blocked",
    sourceManifestId:
      publication.sourceManifestId,
    evidenceReceiptIds,
    sections: {
      executivePosition: {
        dataDateIso:
          position.schedule.dataDateIso,
        independentForecastCompletionIso:
          position.schedule
            .independentForecastCompletionIso,
        independentForecastBasisRevisionId:
          position.schedule
            .independentForecastBasisRevisionId,
        independentForecastCoveragePercent:
          position.schedule
            .independentForecastCoveragePercent,
        independentForecastAuthority:
          position.schedule
            .independentForecastAuthority,
        officialAdjustedCompletionIso:
          position.schedule
            .officialAdjustedCompletionIso,
        varianceDays:
          position.schedule
            .varianceDaysToOfficialAdjustedCompletion,
        managementActions: [
          ...position.managementActions,
        ],
      },
      progress:
        position.schedule.progressBases,
      commercialByCurrency:
        position.commercialByCurrency.map(
          (row) => ({ ...row }),
        ),
      claims: {
        ...position.claims,
        unlinkedClaimIds: [
          ...position.claims
            .unlinkedClaimIds,
        ],
      },
      ld: {
        ...position.ld,
        sourceRefs: [
          ...position.ld.sourceRefs,
        ],
        diagnostics: [
          ...position.ld.diagnostics,
        ],
      },
      controls: {
        ...position.controls,
      },
    },
    evidenceRefs: [
      ...new Set([
        ...position.evidenceRefs,
        ...(publication.sourceManifestId
          ? [
              "source-manifest:" +
                publication.sourceManifestId,
            ]
          : []),
        ...evidenceReceiptIds.map(
          (id) =>
            "evidence-receipt:" + id,
        ),
      ]),
    ].sort(),
    publicationReceipt: {
      sourceFingerprint,
      finalizedAt:
        publication.finalizedAt,
    },
    diagnostics: [
      ...position.diagnostics,
      ...(ready
        ? []
        : [
            "BOARD_REPORT_REQUIRES_SOURCE_MANIFEST_EVIDENCE_RECEIPTS_AND_FINALIZATION_TIMESTAMP",
          ]),
    ],
  };
}
