import type {
  BoqIngestionResult,
} from "../../boq-ingestion/src";
import type {
  ScheduleIngestionResult,
} from "../../schedule-ingestion/src";
import type {
  CanonicalQuantityProgressModel,
} from "../../quantity-progress-core/src";
import type {
  DelayClaimsModel,
  EotContractContext,
} from "../../delay-analysis-core/src";
import type {
  ContractDocumentResult,
} from "../../contract-parser/src";
import type {
  ActualProgressSnapshot,
} from "../../progress-scurve/src";
import type {
  ExternalProgressEvidence,
} from "../../progress-report/src";
import type {
  ReadinessDimensionKey,
  ReadinessEvidence,
} from "../../lookahead-schedule/src";
import type {
  ProjectDirectorRuntimeEvidence,
} from "../../project-schedule-runtime/src";
import type {
  ProjectDirectorPosition,
} from "../../project-director/src";
import type {
  BoardReadyReport,
} from "../../board-report/src";

export interface ProjectRuntimeState {
  projectId: string;
  scheduleIngestions:
    ScheduleIngestionResult[];
  boqIngestions:
    BoqIngestionResult[];
  quantityModel:
    CanonicalQuantityProgressModel | null;
  delayClaimsModel:
    DelayClaimsModel | null;
  eotContractContext:
    EotContractContext | null;
  contract:
    ContractDocumentResult | null;
  progressSnapshots:
    ActualProgressSnapshot[];
  progressEvidence: {
    physical?: ExternalProgressEvidence;
    contractorReported?: ExternalProgressEvidence;
    certified?: ExternalProgressEvidence;
  };
  readinessEvidence: Record<
    string,
    Partial<
      Record<
        ReadinessDimensionKey,
        ReadinessEvidence
      >
    >
  >;
  directorEvidence:
    ProjectDirectorRuntimeEvidence | null;
  directorPosition:
    ProjectDirectorPosition | null;
  boardReport:
    BoardReadyReport | null;
  updatedAt: string;
}

const projects =
  new Map<string, ProjectRuntimeState>();

export function projectState(
  projectId: string,
): ProjectRuntimeState {
  const existing =
    projects.get(projectId);
  if (existing) return existing;

  const created: ProjectRuntimeState = {
    projectId,
    scheduleIngestions: [],
    boqIngestions: [],
    quantityModel: null,
    delayClaimsModel: null,
    eotContractContext: null,
    contract: null,
    progressSnapshots: [],
    progressEvidence: {},
    readinessEvidence: {},
    directorEvidence: null,
    directorPosition: null,
    boardReport: null,
    updatedAt:
      new Date().toISOString(),
  };
  projects.set(projectId, created);
  return created;
}

export function touchProject(
  project: ProjectRuntimeState,
): void {
  project.updatedAt =
    new Date().toISOString();
}

export function projectSummary(
  project: ProjectRuntimeState,
) {
  const revisions =
    project.scheduleIngestions
      .map((item) => item.revision)
      .sort(
        (a, b) =>
          a.sequence - b.sequence,
      );

  const latest =
    project.scheduleIngestions
      .slice()
      .sort(
        (a, b) =>
          a.revision.sequence -
          b.revision.sequence,
      )
      .at(-1);

  return {
    projectId: project.projectId,
    persistence: "runtime_local",
    scheduleRevisionCount:
      revisions.length,
    scheduleRevisions:
      revisions.map((revision) => ({
        revisionId:
          revision.revisionId,
        label: revision.label,
        sequence:
          revision.sequence,
        effectiveAt:
          revision.effectiveAt,
        dataDateIso:
          revision.model.dataDateIso,
        activityCount:
          revision.model.activities
            .length,
      })),
    currentScheduleRevisionId:
      latest?.revision
        .revisionId ?? null,
    currentActivityCount:
      latest?.schedule.activities
        .length ?? 0,
    resourceCount:
      latest?.resources.resources
        .length ?? 0,
    resourceAssignmentCount:
      latest?.resources.assignments
        .length ?? 0,
    boqUploadCount:
      project.boqIngestions.length,
    latestBoq:
      project.boqIngestions
        .at(-1)
        ? {
            ingestionId:
              project.boqIngestions
                .at(-1)!
                .ingestionId,
            candidateRows:
              project.boqIngestions
                .at(-1)!
                .candidateRows,
            verifiedRows:
              project.boqIngestions
                .at(-1)!
                .verifiedRows,
            currencies: [
              ...new Set(
                project.boqIngestions
                  .at(-1)!
                  .canonicalItems
                  .map(
                    (item) =>
                      item.currency,
                  )
                  .filter(
                    (
                      value,
                    ): value is string =>
                      Boolean(value),
                  ),
              ),
            ].sort(),
          }
        : null,
    hasQuantityModel:
      project.quantityModel !== null,
    hasDelayClaims:
      project.delayClaimsModel !==
      null,
    hasEotContext:
      project.eotContractContext !==
      null,
    hasContract:
      project.contract !== null,
    progressSnapshotCount:
      project.progressSnapshots
        .length,
    hasDirectorEvidence:
      project.directorEvidence !==
      null,
    hasDirectorPosition:
      project.directorPosition !==
      null,
    hasBoardReport:
      project.boardReport !== null,
    updatedAt: project.updatedAt,
  };
}
