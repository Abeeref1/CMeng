import {parentPort} from 'node:worker_threads';
import {projectResultMap} from './project-api-results';
import {analyzeEvidenceRows} from './evidence';
import {resolveModuleKey,publicModuleResult} from './registry';
import {COLD_DASHBOARD_TARGET_MS} from './release-latency';
import {withRequestAudit} from './audit-context';
import {managementForecastPosition} from '../../management-surfaces/src';
import {documentReadReview} from './document-read-review';
import JSZip from "jszip";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import {
  ingestBoq,
  type BoqIngestionResult,
} from "../../boq-ingestion/src";
import {
  commercialModules,
  commercialModuleSummary,
  scheduleModules,
  scheduleModuleSummary,
} from "./registry";
import {
  buildProjectDirectorPosition,
  type DirectorPositionInput,
  type ProjectDirectorPosition,
} from "../../project-director/src";
import {
  buildBoardReadyReport,
  type BoardReadyReport,
  type BoardReportPublicationInput,
} from "../../board-report/src";
import {
  isProgrammeScheduleRevision,
  normalizeProjectCode,
  runtimeProjects,
} from "./project-state";
import {
  boardReportForProject,
  directorForProject,
  invalidateProject,
  managementSurfaceForProject,
  managementSurfacesForProject,
  moduleForProject,
  overviewForProject,
  rerunProject,
} from "./project-projections";
import {
  canonicalCommercialModule,
  commercialPositionForState,
} from "./commercial-runtime";
import {
  commercialFoundationCapabilities,
  commercialFoundationCapabilityForState,
} from "./commercial-foundation-runtime";
import {
  commercialPerformanceCapabilities,
  commercialPerformanceCapabilityForState,
} from "./commercial-performance-runtime";
import {
  commercialContractControlCapabilities,
  commercialContractControlCapabilityForState,
} from "./commercial-contract-controls-runtime";
import {
  loadCertifiedDemoProject,
} from "./demo-project";
import type {
  ProjectControlState,
} from "./project-state-types";
import type {
  CanonicalQuantityProgressModel,
} from "../../quantity-progress-core/src";
import {
  cmengUatHtml,
} from "./ui";
import {
  answerProjectQuestion,
} from "./project-intelligence";
import {
  identifyEvidenceDocument,
  documentClassificationForReview,
  type EvidenceIdentificationResult,
} from "./document-identification";
import {
  buildModuleJsonDownload,
  buildModuleWorkbook,
  moduleReportFilename,
} from "./module-report";
import {
  governedTables,
} from "../../truth-kernel/src";
import {
  projectScheduleControlBasis,
} from "./schedule-control-basis";

export function projectDocumentRegister(projectId:string){
  const state=runtimeProjects.get(projectId);if(!state)return null;
    const schemaDiagnostics: string[] = [];
    const schemaByDocument =
      new Map(
        governedTables(
          state.evidenceDocuments,
          schemaDiagnostics,
        ).map((table) => [
          table.document.documentId,
            table,
        ]),
      );
    return {
      projectId,
      documentCount:
        state.evidenceDocuments
          .length,
      documents:
        runtimeProjects
          .evidence(projectId)
          .map((document) => ({
            ...document,
            mapping:schemaByDocument.has(document.documentId)?analyzeEvidenceRows(
              [schemaByDocument.get(document.documentId)!.headers,...schemaByDocument.get(document.documentId)!.rows.map(r=>schemaByDocument.get(document.documentId)!.headers.map(h=>r.cells[h]??''))],
              new Set(runtimeProjects.latestSchedule(projectId)?.revision.model.activities.map(a=>a.activityId)??[])):document.mapping,
            classificationReview: documentClassificationForReview(document),
            readReview:documentReadReview(document,state,schemaByDocument.get(document.documentId)),
            schemaHeaders:
              schemaByDocument.get(
                document.documentId,
              )?.headers ?? [],
          })),
    };

}

const port = Number.parseInt(
  process.env.PORT ?? "3000",
  10,
);
const host = process.env.HOST ?? "0.0.0.0";
// The workspace HTML is static for a release. Building the large string on every
// GET / costs tens of milliseconds on the cold path without changing content.
const CMENG_UAT_HTML = cmengUatHtml();
const MAX_UPLOAD_BYTES = Number.parseInt(
  process.env.CMENG_MAX_UPLOAD_BYTES ??
    String(50 * 1024 * 1024),
  10,
);

const boqIngestions =
  new Map<string, BoqIngestionResult>();
const resultDirectory=process.env.CMENG_PROJECT_WORKER==='1'?runtimeProjects.persistenceStatus().dataDir:undefined;
const directorPositions = projectResultMap<ProjectDirectorPosition>('director-results',resultDirectory);
const boardReports = projectResultMap<BoardReadyReport>('board-results',resultDirectory);

type EvidenceUploadProgress = {
  uploadId: string;
  projectId: string;
  filename: string;
  state:
    | "receiving"
    | "reading_package"
    | "identifying"
    | "processing"
    | "updating_project"
    | "complete"
    | "failed";
  percent: number;
  receivedBytes: number;
  totalBytes: number | null;
  documentTotal: number | null;
  identifiedDocuments: number;
  processedDocuments: number;
  currentDocument: string | null;
  message: string | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
};

const evidenceUploadProgress =
  new Map<string, EvidenceUploadProgress>();

function evidenceUploadProgressKey(
  projectId: string,
  uploadId: string,
): string {
  return projectId + "::" + uploadId;
}

function cleanupUploadProgress(): void {
  const cutoff =
    Date.now() -
    6 * 60 * 60 * 1000;
  for (
    const [key, progress] of
      evidenceUploadProgress
  ) {
    if (
      Date.parse(
        progress.updatedAt,
      ) < cutoff
    ) {
      evidenceUploadProgress.delete(
        key,
      );
    }
  }
}

function setEvidenceUploadProgress(
  projectId: string,
  uploadId: string,
  update:
    Partial<EvidenceUploadProgress> &
    Pick<
      EvidenceUploadProgress,
      "state" | "percent"
    >,
): EvidenceUploadProgress {
  cleanupUploadProgress();
  const key =
    evidenceUploadProgressKey(
      projectId,
      uploadId,
    );
  const now =
    new Date().toISOString();
  const existing =
    evidenceUploadProgress.get(
      key,
    );
  const progress:
    EvidenceUploadProgress = {
      uploadId,
      projectId,
      filename:
        update.filename ??
        existing?.filename ??
        "project package",
      state: update.state,
      percent: Math.max(
        0,
        Math.min(
          100,
          Math.round(
            update.percent,
          ),
        ),
      ),
      receivedBytes:
        update.receivedBytes ??
        existing?.receivedBytes ??
        0,
      totalBytes:
        update.totalBytes ??
        existing?.totalBytes ??
        null,
      documentTotal:
        update.documentTotal ??
        existing?.documentTotal ??
        null,
      identifiedDocuments:
        update.identifiedDocuments ??
        existing?.identifiedDocuments ??
        0,
      processedDocuments:
        update.processedDocuments ??
        existing?.processedDocuments ??
        0,
      currentDocument:
        update.currentDocument ??
        existing?.currentDocument ??
        null,
      message:
        update.message ??
        existing?.message ??
        null,
      startedAt:
        existing?.startedAt ??
        now,
      updatedAt: now,
      completedAt:
        update.completedAt ??
        existing?.completedAt ??
        null,
    };
  evidenceUploadProgress.set(
    key,
    progress,
  );
  if(process.env.CMENG_PROJECT_WORKER==="1")parentPort?.postMessage({type:"progress",progress});
  return progress;
}

function itemNameForProgress(
  value: string,
): string {
  return (
    value
      .split("/")
      .filter(Boolean)
      .at(-1) ??
    value
  );
}

function json(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type":
      "application/json; charset=utf-8",
    "content-length":
      Buffer.byteLength(payload),
  });
  res.end(payload);
}

function attachment(
  res: ServerResponse,
  statusCode: number,
  body: Buffer,
  contentType: string,
  filename: string,
): void {
  res.writeHead(statusCode, {
    "content-type":
      contentType,
    "content-length":
      body.length,
    "content-disposition":
      'attachment; filename="' +
      filename
        .replace(/[\r\n"]/g, "_") +
      '"',
    "cache-control":
      "no-store",
  });
  res.end(body);
}

function html(
  res: ServerResponse,
  statusCode: number,
  body: string,
): void {
  res.writeHead(statusCode, {
    "content-type":
      "text/html; charset=utf-8",
    "content-length":
      Buffer.byteLength(body),
    "cache-control":
      "no-store",
  });
  res.end(body);
}

function uploadIntent(
  req: IncomingMessage,
):
  | "add_update"
  | "replace_current_basis" {
  const value =
    header(
      req,
      "x-upload-intent",
    )
      ?.trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  return value ===
    "replace_current_basis"
    ? "replace_current_basis"
    : "add_update";
}

function rerunRequested(
  req: IncomingMessage,
): boolean {
  const value =
    header(
      req,
      "x-rerun-after-upload",
    )
      ?.trim()
      .toLowerCase();
  return (
    value === "1" ||
    value === "true" ||
    value === "yes"
  );
}

function mediaType(req: IncomingMessage): string {
  return String(
    req.headers["content-type"] ?? "",
  )
    .split(";")[0]!
    .trim();
}

function header(
  req: IncomingMessage,
  name: string,
): string | null {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }
  return typeof value === "string"
    ? value.trim() || null
    : null;
}

async function readBody(
  req: IncomingMessage,
  onProgress?: (
    receivedBytes: number,
    totalBytes: number | null,
  ) => void,
): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let total = 0;
  const declaredTotal =
    Number.parseInt(
      String(
        req.headers[
          "content-length"
        ] ?? "",
      ),
      10,
    );
  const totalBytes =
    Number.isFinite(
      declaredTotal,
    ) &&
    declaredTotal > 0
      ? declaredTotal
      : null;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk);
    total += buffer.length;

    if (total > MAX_UPLOAD_BYTES) {
      const error =
        new Error("UPLOAD_TOO_LARGE");
      (error as Error & {
        statusCode?: number;
      }).statusCode = 413;
      throw error;
    }

    chunks.push(buffer);
    onProgress?.(
      total,
      totalBytes,
    );
  }

  return Buffer.concat(chunks);
}


async function readJsonBody<T>(
  req: IncomingMessage,
): Promise<T> {
  const bytes = await readBody(req);
  if (bytes.length === 0) {
    throw new Error("JSON_BODY_REQUIRED");
  }
  try {
    return JSON.parse(
      Buffer.from(bytes).toString("utf8"),
    ) as T;
  } catch {
    throw new Error("JSON_BODY_INVALID");
  }
}

function uploadSummary(
  result: BoqIngestionResult,
) {
  return {
    ingestionId: result.ingestionId,
    projectId: result.projectId,
    sourceFormat: result.sourceFormat,
    mediaType: result.mediaType,
    sourceFilename: result.sourceFilename,
    sourceHashSha256:
      result.sourceHashSha256,
    sourceManifestId:
      result.sourceManifest.manifestId,
    evidenceReceiptId:
      result.evidenceReceipt.receiptId,
    authority: result.authority,
    persistence: result.persistence,
    state: result.state,
    candidateRows: result.candidateRows,
    verifiedRows: result.verifiedRows,
    unresolvedRows: result.unresolvedRows,
    coveragePercent:
      result.coveragePercent,
    complete: result.complete,
    canonicalItemCount:
      result.canonicalItems.length,
    diagnostics: result.diagnostics,
    receivedAt: result.receivedAt,
  };
}

async function route(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );

  if (
    req.method === "GET" &&
    url.pathname === "/health"
  ) {
    json(res, 200, {
      status: "ok",
      service: "cmeng",
      release:
        process.env.RAILWAY_GIT_COMMIT_SHA ??
        process.env.GIT_COMMIT_SHA ??
        null,
      scheduleModules:
        scheduleModuleSummary(),
      commercialModules:
        commercialModuleSummary(),
      boqIngestion: {
        acceptedFormats: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel.sheet.macroEnabled.12",
          "application/pdf",
          "text/csv",
        ],
        persistence:
          runtimeProjects
            .persistenceMode(),
        authority: "candidate_only",
      },
    });
    return;
  }

  if (
    req.method === "GET" &&
    url.pathname ===
      "/api/portfolio"
  ) {
    const projects =
      runtimeProjects
        .listProjectIds()
        .map((projectId) => {
          const state =
            runtimeProjects.get(
              projectId,
            );
          if (!state) {
            return null;
          }

          if (
            state.demo === true ||
            projectId
              .toUpperCase()
              .startsWith(
                "PERSISTENCE-SMOKE-",
              )
          ) {
            return null;
          }

          const programmeSchedules =
            state.schedules.filter(
              isProgrammeScheduleRevision,
            );
          const latest =
            runtimeProjects.latestSchedule(
              projectId,
            );
          const resolvedModules =
            new Map(
              [
                ...scheduleModules,
                ...commercialModules,
              ].map(
                (module) => [
                  module.key,
                  moduleForProject(
                    projectId,
                    module.key,
                  ),
                ] as const,
              ),
            );
          const moduleStatuses = [
            ...resolvedModules,
          ].map(
            ([key, resolved]) => ({
              key,
              status: resolved.status,
            }),
          );
          const readyModules =
            moduleStatuses.filter(
              (module) =>
                module.status ===
                "ready",
            ).length;
          const partialModules =
            moduleStatuses.filter(
              (module) =>
                module.status ===
                "partial",
            ).length;
          const blockedModules =
            moduleStatuses.filter(
              (module) =>
                module.status ===
                "blocked",
            ).length;

          // Reuse the canonical Commercial Overview projection already resolved
          // above instead of rebuilding the same commercial position again.
          const commercialOverviewData =
            resolvedModules.get(
              "commercial-overview",
            )?.data as
              | {
                  position?: ReturnType<
                    typeof commercialPositionForState
                  >;
                }
              | null
              | undefined;
          const commercialPosition =
            commercialOverviewData
              ?.position ??
            commercialPositionForState(
              state,
            );

          const minimumEvidenceReady =
            programmeSchedules.length >
              0 &&
            state.boqRevisions.length >
              0;
          const lastRerunState =
            state.lastRerunReceipt
              ?.certification
              .state ??
            null;

          const director =
            directorForProject(
              projectId,
            );
          const forecastPosition =
            managementForecastPosition(
              director,
            );
          const windowsResult =
            resolvedModules.get(
              "windows-analysis",
            ) ??
            moduleForProject(
              projectId,
              "windows-analysis",
            );
          const windowsData =
            windowsResult.data &&
            typeof windowsResult.data ===
              "object"
              ? windowsResult.data as {
                  projectCompletionMovementDays?:
                    number | null;
                }
              : null;

          return {
            projectId,
            demo: false,
            version:
              state.version,
            latestDataDateIso:
              latest?.revision.model
                .dataDateIso ??
              null,
            evidenceDocumentCount:
              state.evidenceDocuments
                .length,
            revisionCount:
              programmeSchedules.length,
            minimumEvidenceReady,
            moduleCount:
              moduleStatuses.length,
            scheduleModuleCount:
              scheduleModules.length,
            commercialModuleCount:
              commercialModules.length,
            readyModules,
            partialModules,
            blockedModules,
            lastRerunState,
            positionState:
              !minimumEvidenceReady
                ? "needs_information"
                : lastRerunState ===
                    "pass" && readyModules === moduleStatuses.length
                  ? "current"
                  : "needs_review",
            forecastCompletionIso:
              forecastPosition.completionIso,
            forecastAuthority:
              forecastPosition.authority,
            forecastLabel:
              forecastPosition.label,
            calendarRecalculationIso:
              forecastPosition.calendarRecalculationIso,
            officialCompletionIso:
              director?.schedule
                .contractualCompletionIso ??
              null,
            contractualCompletionState: commercialPosition.foundation.commercialTerms.contractualCompletionDate.state,
            furtherAdjustedCompletionIso: director?.schedule.officialAdjustedCompletionIso ?? null,
            programmeMovementDays:
              windowsData
                ?.projectCompletionMovementDays ??
              null,
            approvedEotDays:
              director?.claims
                .officialApprovedEotDays ??
              null,
            approvedEotBasis: 'Gross source-approved determinations through the Data Date; overlap and further contractual adjustment require reconciliation.',
            claimCount:
              director?.claims
                .claimCount ??
              null,
            fullyLinkedClaimCount:
              director?.claims
                .fullyLinkedClaimCount ??
              null,
            managementActionCount:
              director
                ? director
                    .managementActions
                    .length
                : null,
            managementActions:
              director
                ?.managementActions ??
              [],
            commercialCurrencyCount:
              commercialPosition
                .currencies.length,
            analysisError: null,
          };
        })
        .filter(
          (
            value,
          ): value is NonNullable<
            typeof value
          > => value !== null,
        );

    json(res, 200, {
      portfolioId:
        "default",
      generatedAt:
        new Date().toISOString(),
      projectCount:
        projects.length,
      projects,
    });
    return;
  }

  if (
    req.method === "POST" &&
    url.pathname ===
      "/api/projects"
  ) {
    const body =
      await readJsonBody<{
        projectId?: string;
      }>(req);
    const projectId =
      normalizeProjectCode(
        body.projectId ??
          "",
      );
    if (!projectId) {
      json(res, 400, {
        error:
          "project_id_required",
        message:
          "Enter a project code.",
      });
      return;
    }

    const existingId =
      runtimeProjects
        .findProjectIdByCode(
          projectId,
        );
    if (existingId) {
      json(res, 409, {
        error:
          "project_code_already_exists",
        message:
          "Project code " +
          existingId +
          " already exists. Open the existing project instead.",
        projectId:
          existingId,
      });
      return;
    }

    const state =
      runtimeProjects.getOrCreate(
        projectId,
      );
    json(
      res,
      201,
      {
        projectId:
          state.projectId,
        created: true,
        version:
          state.version,
      },
    );
    return;
  }

  const intelligenceMatch =
    /^\/api\/projects\/([^/]+)\/intelligence\/ask$/.exec(
      url.pathname,
    );

  if (
    req.method === "POST" &&
    intelligenceMatch
  ) {
    const projectId =
      decodeURIComponent(
        intelligenceMatch[1]!,
      );
    const body =
      await readJsonBody<{
        question?: string;
      }>(req);
    const question =
      (
        body.question ??
        ""
      ).trim();
    if (!question) {
      json(res, 400, {
        error:
          "question_required",
      });
      return;
    }
    const answer =
      answerProjectQuestion(
        projectId,
        question,
      );
    if (!answer) {
      json(res, 404, {
        error:
          "project_not_found",
      });
      return;
    }
    json(res, 200, answer);
    return;
  }

  if (
    req.method === "GET" &&
    url.pathname ===
      "/api/schedule/modules"
  ) {
    json(res, 200, {
      moduleCount: scheduleModules.length,
      modules: scheduleModules,
    });
    return;
  }


  if (
    req.method === "GET" &&
    url.pathname ===
      "/api/commercial/modules"
  ) {
    json(res, 200, {
      moduleCount:
        commercialModules.length,
      modules:
        commercialModules,
      invariants: {
        missingEvidenceIsNotZero:
          true,
        currenciesAreNotCrossSummed:
          true,
        currentContractValueUsesApprovedVariationsOnly:
          true,
        advanceBalanceIsNotInferredFromBondValue:
          true,
        contractAmendmentsSetTimeBasisBeforeEotDays:
          true,
      },
    });
    return;
  }

  if (
    req.method === "GET" &&
    url.pathname ===
      "/api/commercial/capabilities"
  ) {
    json(res, 200, {
      capabilityCount:
        commercialFoundationCapabilities.length +
        commercialPerformanceCapabilities.length +
        commercialContractControlCapabilities.length,
      capabilities: [
        ...commercialFoundationCapabilities,
        ...commercialPerformanceCapabilities,
        ...commercialContractControlCapabilities,
      ],
      phase: "C2B2",
      invariants: {
        universalCommercialFindingContract:
          true,
        missingEvidenceIsNotZero:
          true,
        currenciesAreNotCrossSummed:
          true,
        candidateTermsAreNotAutomaticallyApproved:
          true,
        appliedAssessedCertifiedPaidStaySeparate:
          true,
      },
    });
    return;
  }

  if (
    req.method === "GET" &&
    url.pathname ===
      "/api/schedule/certification"
  ) {
    json(res, 200, {
      release:
        process.env.RAILWAY_GIT_COMMIT_SHA ??
        process.env.GIT_COMMIT_SHA ??
        null,
      scope: "schedule-22-final",
      moduleCount: scheduleModules.length,
      modules: scheduleModules,
      invariants: {
        missingEvidenceIsNotZero: true,
        candidateExtractionIsNotOfficial: true,
        currenciesAreNotCrossSummed: true,
        deterministicCpmRemainsCanonical: true,
        probabilisticForecastIsNonOfficial: true,
        claimsRequireDelayEventAndScheduleLinkage: true,
        boardReportRequiresEvidenceReceipts: true,
      },
      managementOutputs: {
        projectDirector:
          "/api/projects/:projectId/director-position",
        boardReport:
          "/api/projects/:projectId/board-report",
      },
    });
    return;
  }


  const evidenceMatch =
    /^\/api\/projects\/([^/]+)\/evidence\/documents$/.exec(
      url.pathname,
    );

  if (
    req.method === "GET" &&
    evidenceMatch
  ) {
    const projectId =
      decodeURIComponent(
        evidenceMatch[1]!,
      );
    const state =
      runtimeProjects.get(
        projectId,
      );
    if (!state) {
      json(res, 404, {
        error:
          "project_not_found",
      });
      return;
    }
    json(res,200,projectDocumentRegister(projectId));
    return;
  }

  const evidenceDocumentsBulkDeleteMatch =
    /^\/api\/projects\/([^/]+)\/evidence\/documents\/delete$/.exec(
      url.pathname,
    );

  if (
    req.method === "POST" &&
    evidenceDocumentsBulkDeleteMatch
  ) {
    const projectId =
      decodeURIComponent(
        evidenceDocumentsBulkDeleteMatch[1]!,
      );
    const body =
      await readJsonBody<{
        documentIds?: string[];
      }>(req);
    const documentIds =
      Array.isArray(
        body.documentIds,
      )
        ? body.documentIds
        : [];

    if (documentIds.length === 0) {
      json(res, 400, {
        error:
          "document_ids_required",
      });
      return;
    }

    const deleted =
      runtimeProjects
        .deleteEvidenceDocuments(
          projectId,
          documentIds,
        );

    if (deleted.length === 0) {
      json(res, 404, {
        error:
          "documents_not_found",
      });
      return;
    }

    invalidateProject(projectId);

    json(res, 200, {
      projectId,
      deletedCount:
        deleted.length,
      deleted,
      positionRefreshRequired:
        true,
    });
    return;
  }

  const evidenceDocumentDeleteMatch =
    /^\/api\/projects\/([^/]+)\/evidence\/documents\/([^/]+)$/.exec(
      url.pathname,
    );

  if (
    req.method === "DELETE" &&
    evidenceDocumentDeleteMatch
  ) {
    const projectId =
      decodeURIComponent(
        evidenceDocumentDeleteMatch[1]!,
      );
    const documentId =
      decodeURIComponent(
        evidenceDocumentDeleteMatch[2]!,
      );
    const deleted =
      runtimeProjects
        .deleteEvidenceDocument(
          projectId,
          documentId,
        );
    if (!deleted) {
      json(res, 404, {
        error:
          "document_not_found",
      });
      return;
    }

    invalidateProject(projectId);

    json(res, 200, {
      projectId,
      deleted,
      positionRefreshRequired:
        true,
    });
    return;
  }

  const evidenceRerunMatch =
    /^\/api\/projects\/([^/]+)\/evidence\/rerun$/.exec(
      url.pathname,
    );

  if (
    req.method === "POST" &&
    evidenceRerunMatch
  ) {
    const projectId =
      decodeURIComponent(
        evidenceRerunMatch[1]!,
      );
    const receipt =
      rerunProject(projectId);
    if (!receipt) {
      json(res, 404, {
        error:
          "project_not_found",
      });
      return;
    }
    json(
      res,
      receipt.certification
        .state === "pass"
        ? 200
        : 409,
      receipt,
    );
    return;
  }

  const evidenceUploadProgressMatch =
    /^\/api\/projects\/([^/]+)\/evidence\/upload-progress\/([^/]+)$/.exec(
      url.pathname,
    );

  if (
    req.method === "GET" &&
    evidenceUploadProgressMatch
  ) {
    const projectId =
      decodeURIComponent(
        evidenceUploadProgressMatch[1]!,
      );
    const uploadId =
      decodeURIComponent(
        evidenceUploadProgressMatch[2]!,
      );
    cleanupUploadProgress();
    const progress =
      evidenceUploadProgress.get(
        evidenceUploadProgressKey(
          projectId,
          uploadId,
        ),
      );
    if (!progress) {
      json(res, 404, {
        error:
          "upload_progress_not_found",
      });
      return;
    }
    json(res, 200, progress);
    return;
  }

  const evidenceUploadMatch =
    /^\/api\/projects\/([^/]+)\/evidence\/uploads$/.exec(
      url.pathname,
    );

  if (
    req.method === "POST" &&
    evidenceUploadMatch
  ) {
    const projectId =
      decodeURIComponent(
        evidenceUploadMatch[1]!,
      );
    const intent =
      uploadIntent(req);
    const filename =
      header(
        req,
        "x-source-filename",
      ) ?? "evidence";
    const relativePath =
      header(
        req,
        "x-source-relative-path",
      ) ?? filename;
    const uploadId =
      header(
        req,
        "x-upload-id",
      );
    const declaredTotal =
      Number.parseInt(
        String(
          req.headers[
            "content-length"
          ] ?? "",
        ),
        10,
      );
    const totalBytes =
      Number.isFinite(
        declaredTotal,
      ) &&
      declaredTotal > 0
        ? declaredTotal
        : null;

    if (uploadId) {
      setEvidenceUploadProgress(
        projectId,
        uploadId,
        {
          state: "receiving",
          percent: 0,
          filename,
          totalBytes,
          receivedBytes: 0,
          documentTotal: null,
          identifiedDocuments: 0,
          processedDocuments: 0,
          currentDocument: null,
          message:
            "Receiving project package",
        },
      );
    }

    const body =
      await readBody(
        req,
        uploadId
          ? (
              receivedBytes,
              bodyTotalBytes,
            ) => {
              const percent =
                bodyTotalBytes
                  ? Math.min(
                      24,
                      Math.round(
                        (
                          receivedBytes /
                          bodyTotalBytes
                        ) * 24,
                      ),
                    )
                  : 12;
              setEvidenceUploadProgress(
                projectId,
                uploadId,
                {
                  state:
                    "receiving",
                  percent,
                  filename,
                  receivedBytes,
                  totalBytes:
                    bodyTotalBytes,
                  message:
                    "Receiving project package",
                },
              );
            }
          : undefined,
      );
    const type =
      mediaType(req).toLowerCase();
    const isZip =
      type.includes("zip") ||
      filename
        .toLowerCase()
        .endsWith(".zip");

    if (uploadId) {
      setEvidenceUploadProgress(
        projectId,
        uploadId,
        {
          state:
            isZip
              ? "reading_package"
              : "processing",
          percent:
            isZip ? 25 : 55,
          filename,
          receivedBytes:
            body.length,
          totalBytes:
            totalBytes ??
            body.length,
          message:
            isZip
              ? "Opening project package"
              : "Processing document",
        },
      );
    }

    if (isZip) {
      const archive =
        await JSZip.loadAsync(
          Buffer.from(body),
        );
      const entries =
        Object.values(
          archive.files,
        )
          .filter(
            (entry) =>
              !entry.dir &&
              !entry.name.includes(
                "__MACOSX/",
              ),
          );

      if (uploadId) {
        setEvidenceUploadProgress(
          projectId,
          uploadId,
          {
            state:
              "identifying",
            percent: 30,
            documentTotal:
              entries.length,
            identifiedDocuments: 0,
            processedDocuments: 0,
            currentDocument:
              null,
            message:
              "Identifying project documents",
          },
        );
      }

      const maxExtracted =
        Number.parseInt(
          process.env
            .CMENG_MAX_PACK_EXTRACTED_BYTES ??
            String(
              500 *
                1024 *
                1024,
            ),
          10,
        );
      let extractedBytes = 0;

      const identifiedEntries:
        Array<{
          entry:
            (typeof entries)[number];
          leaf: string;
          identification:
            EvidenceIdentificationResult;
          sizeBytes: number;
        }> = [];

      for (const entry of entries) {
        const bytes =
          new Uint8Array(
            await entry.async(
              "uint8array",
            ),
          );
        extractedBytes +=
          bytes.length;
        if (
          extractedBytes >
          maxExtracted
        ) {
          throw new Error(
            "EVIDENCE_PACK_EXTRACTED_TOO_LARGE",
          );
        }
        const leaf =
          entry.name
            .split("/")
            .filter(Boolean)
            .at(-1) ??
          entry.name;

        const identification =
          await identifyEvidenceDocument({
            bytes,
            sourceFilename:
              leaf,
            sourceRelativePath:
              entry.name,
            declaredMediaType:
              null,
            declaredCategory:
              null,
            declaredDocumentType:
              null,
          });

        identifiedEntries.push({
          entry,
          leaf,
          identification,
          sizeBytes:
            bytes.length,
        });
        if (uploadId) {
          const identifiedCount =
            identifiedEntries.length;
          const totalDocuments =
            Math.max(
              1,
              entries.length,
            );
          setEvidenceUploadProgress(
            projectId,
            uploadId,
            {
              state:
                "identifying",
              percent:
                30 +
                Math.round(
                  (
                    identifiedCount /
                    totalDocuments
                  ) * 30,
                ),
              documentTotal:
                entries.length,
              identifiedDocuments:
                identifiedCount,
              processedDocuments: 0,
              currentDocument:
                itemNameForProgress(
                  entry.name,
                ),
              message:
                "Identifying " +
                identifiedCount +
                " of " +
                entries.length +
                " documents",
            },
          );
        }
      }

      const categoryPriority = (
        identified:
          EvidenceIdentificationResult,
      ): number => {
        const id =
          identified.identification;
        if (
          id.detectedCategory ===
          "schedule"
        ) return 10;
        if (
          id.detectedCategory ===
          "contract"
        ) {
          if (
            id.detectedDocumentType ===
            "main_contract"
          ) return 20;
          if (
            id.detectedDocumentType ===
            "contract_amendment"
          ) return 21;
          return 22;
        }
        if (
          id.detectedCategory ===
          "boq_cost" &&
          id.detectedDocumentType ===
          "boq"
        ) return 30;
        if (
          id.detectedCategory ===
          "schedule_control"
        ) return 35;
        if (
          id.detectedCategory ===
          "risk_claims_procurement"
        ) return 40;
        if (
          id.detectedCategory ===
          "engineering"
        ) return 45;
        return 50;
      };

      identifiedEntries.sort(
        (a, b) => {
          const byCategory =
            categoryPriority(
              a.identification,
            ) -
            categoryPriority(
              b.identification,
            );
          return byCategory !== 0
            ? byCategory
            : a.entry.name.localeCompare(
                b.entry.name,
              );
        },
      );

      const results = [];
      let processedCount = 0;
      if (uploadId) {
        setEvidenceUploadProgress(
          projectId,
          uploadId,
          {
            state:
              "processing",
            percent: 62,
            documentTotal:
              identifiedEntries.length,
            identifiedDocuments:
              identifiedEntries.length,
            processedDocuments: 0,
            currentDocument:
              identifiedEntries[0]
                ?.leaf ??
              null,
            message:
              "Processing project documents",
          },
        );
      }
      for (
        const item of
          identifiedEntries
      ) {
        const bytes =
          new Uint8Array(
            await item.entry.async(
              "uint8array",
            ),
          );
        const result =
          await runtimeProjects
            .ingestEvidenceFile({
              projectId,
              bytes,
              mediaType: null,
              sourceFilename:
                item.leaf,
              sourceRelativePath:
                item.entry.name,
              category: null,
              documentType: null,
              scheduleRole: null,
              uploadedAt:
                new Date()
                  .toISOString(),
              uploadIntent:
                intent,
              preidentified:
                item.identification,
            });
        results.push(result);
        processedCount += 1;
        if (uploadId) {
          const totalDocuments =
            Math.max(
              1,
              identifiedEntries
                .length,
            );
          setEvidenceUploadProgress(
            projectId,
            uploadId,
            {
              state:
                "processing",
              percent:
                62 +
                Math.round(
                  (
                    processedCount /
                    totalDocuments
                  ) * 33,
                ),
              documentTotal:
                identifiedEntries
                  .length,
              identifiedDocuments:
                identifiedEntries
                  .length,
              processedDocuments:
                processedCount,
              currentDocument:
                item.leaf,
              message:
                "Processing " +
                processedCount +
                " of " +
                identifiedEntries
                  .length +
                " documents",
            },
          );
        }
      }

      await runtimeProjects.refreshDeferredPdfReads(projectId);
      await runtimeProjects.refreshSpreadsheetRegisters(projectId);
      await runtimeProjects.refreshHseReports(projectId);
      await runtimeProjects
        .refreshCorrespondenceNarratives(
          projectId,
        );
      invalidateProject(
        projectId,
      );
      if (
        uploadId &&
        rerunRequested(req)
      ) {
        setEvidenceUploadProgress(
          projectId,
          uploadId,
          {
            state:
              "updating_project",
            percent: 96,
            message:
              "Updating project position",
          },
        );
      }
      const rerun =
        rerunRequested(req)
          ? rerunProject(
              projectId,
              results.map(
                (result) =>
                  result.basisEffect,
              ),
            )
          : null;
      if (uploadId) {
        setEvidenceUploadProgress(
          projectId,
          uploadId,
          {
            state: "complete",
            percent: 100,
            documentTotal:
              results.length,
            identifiedDocuments:
              results.length,
            processedDocuments:
              results.length,
            currentDocument:
              null,
            completedAt:
              new Date()
                .toISOString(),
            message:
              results.length +
              " documents loaded",
          },
        );
      }
      json(res, 201, {
        projectId,
        uploadIntent:
          intent,
        packFilename:
          filename,
        documentCount:
          results.length,
        extractedBytes,
        documents: results,
        rerun,
      });
      return;
    }

    if (uploadId) {
      setEvidenceUploadProgress(
        projectId,
        uploadId,
        {
          state:
            "processing",
          percent: 70,
          documentTotal: 1,
          identifiedDocuments: 1,
          processedDocuments: 0,
          currentDocument:
            filename,
          message:
            "Processing document",
        },
      );
    }

    const result =
      await runtimeProjects
        .ingestEvidenceFile({
          projectId,
          bytes: body,
          mediaType:
            mediaType(req),
          sourceFilename:
            filename,
          sourceRelativePath:
            relativePath,
          category:
            header(
              req,
              "x-evidence-category",
            ),
          documentType:
            header(
              req,
              "x-document-type",
            ),
          scheduleRole:
            header(
              req,
              "x-schedule-role",
            ),
          uploadedAt:
            new Date().toISOString(),
          uploadIntent:
            intent,
        });
    await runtimeProjects.refreshDeferredPdfReads(projectId);
    await runtimeProjects.refreshSpreadsheetRegisters(projectId);
      await runtimeProjects.refreshHseReports(projectId);
    await runtimeProjects
      .refreshCorrespondenceNarratives(
        projectId,
      );
    invalidateProject(
      projectId,
    );
    if (
      uploadId &&
      rerunRequested(req)
    ) {
      setEvidenceUploadProgress(
        projectId,
        uploadId,
        {
          state:
            "updating_project",
          percent: 96,
          message:
            "Updating project position",
        },
      );
    }
    const rerun =
      rerunRequested(req)
        ? rerunProject(
            projectId,
            [
              result.basisEffect,
            ],
          )
        : null;
    if (uploadId) {
      setEvidenceUploadProgress(
        projectId,
        uploadId,
        {
          state: "complete",
          percent: 100,
          documentTotal: 1,
          identifiedDocuments: 1,
          processedDocuments: 1,
          currentDocument: null,
          completedAt:
            new Date()
              .toISOString(),
          message:
            "1 document loaded",
        },
      );
    }
    json(res, 201, {
      ...result,
      uploadIntent:
        intent,
      rerun,
    });
    return;
  }


  const demoMatch =
    /^\/api\/projects\/([^/]+)\/demo$/.exec(
      url.pathname,
    );

  if (
    req.method === "POST" &&
    demoMatch
  ) {
    const projectId =
      decodeURIComponent(
        demoMatch[1]!,
      );

    if (
      projectId !==
        "UAT-DEMO" &&
      !projectId.startsWith(
        "DEMO-",
      )
    ) {
      json(res, 409, {
        error:
          "demo_project_id_must_use_demo_namespace",
        message:
          "Certified demo data can only be loaded into UAT-DEMO or a DEMO-* project. Existing user projects are never replaced by demo data.",
      });
      return;
    }

    const existing =
      runtimeProjects.get(
        projectId,
      );
    if (
      existing &&
      !existing.demo &&
      (
        existing.schedules.length >
          0 ||
        existing.evidenceDocuments
          .length > 0
      )
    ) {
      json(res, 409, {
        error:
          "demo_would_overwrite_user_project",
        message:
          "UAT-DEMO currently contains user evidence and was not created as a demo. Demo loading is refused to preserve the project.",
      });
      return;
    }

    const state =
      loadCertifiedDemoProject(
        projectId,
      );
    json(res, 201, {
      projectId,
      demo: true,
      revisionCount:
        state.schedules.length,
      message:
        "Certified demo project loaded in the isolated UAT-DEMO namespace.",
    });
    return;
  }

  const overviewMatch =
    /^\/api\/projects\/([^/]+)\/overview$/.exec(
      url.pathname,
    );

  if (
    req.method === "GET" &&
    overviewMatch
  ) {
    const projectId =
      decodeURIComponent(
        overviewMatch[1]!,
      );
    const overview =
      overviewForProject(
        projectId,
      );
    if (!overview) {
      json(res, 404, {
        error:
          "project_not_found",
      });
      return;
    }
    json(res, 200, overview);
    return;
  }

  const scheduleUploadMatch =
    /^\/api\/projects\/([^/]+)\/schedule\/uploads$/.exec(
      url.pathname,
    );

  if (
    req.method === "POST" &&
    scheduleUploadMatch
  ) {
    const projectId =
      decodeURIComponent(
        scheduleUploadMatch[1]!,
      );
    const body =
      await readBody(req);
    const result =
      await runtimeProjects
        .ingestSchedule({
          projectId,
          bytes: body,
          mediaType:
            mediaType(req),
          sourceFilename:
            header(
              req,
              "x-source-filename",
            ),
          sourceRelativePath:
            header(
              req,
              "x-source-relative-path",
            ),
          role:
            header(
              req,
              "x-schedule-role",
            ),
          label:
            header(
              req,
              "x-revision-label",
            ),
          uploadedAt:
            new Date().toISOString(),
        });
    invalidateProject(
      projectId,
    );
    json(res, 201, result);
    return;
  }

  const revisionsMatch =
    /^\/api\/projects\/([^/]+)\/schedule\/revisions$/.exec(
      url.pathname,
    );

  if (
    req.method === "GET" &&
    revisionsMatch
  ) {
    const projectId =
      decodeURIComponent(
        revisionsMatch[1]!,
      );
    const state =
      runtimeProjects.get(
        projectId,
      );
    if (!state) {
      json(res, 404, {
        error:
          "project_not_found",
      });
      return;
    }
    json(
      res,
      200,
      state.schedules
        .filter(
          isProgrammeScheduleRevision,
        )
        .map((item) => ({
          revisionId:
            item.revision
              .revisionId,
          label:
            item.revision.label,
          sequence:
            item.revision
              .sequence,
          effectiveAt:
            item.revision
              .effectiveAt,
          dataDateIso:
            item.revision.model
              .dataDateIso,
          role: item.role,
          format: item.format,
          sourceFilename:
            item.sourceFilename,
          sourceHashSha256:
            item.sourceHashSha256,
          activityCount:
            item.revision.model
              .activities.length,
          relationshipCount:
            item.revision.model
              .relationships.length,
        }))
        .sort(
          (a, b) => {
            const ad =
              a.dataDateIso ??
              a.effectiveAt ??
              "";
            const bd =
              b.dataDateIso ??
              b.effectiveAt ??
              "";
            const byDate =
              ad.localeCompare(bd);
            return byDate !== 0
              ? byDate
              : a.sequence -
                  b.sequence;
          },
        ),
    );
    return;
  }

  const commercialCapabilityMatch =
    /^\/api\/projects\/([^/]+)\/commercial\/capabilities\/([^/]+)$/.exec(
      url.pathname,
    );

  if (
    req.method === "GET" &&
    commercialCapabilityMatch
  ) {
    const projectId =
      decodeURIComponent(
        commercialCapabilityMatch[1]!,
      );
    const key =
      decodeURIComponent(
        commercialCapabilityMatch[2]!,
      );
    const state =
      runtimeProjects.get(
        projectId,
      );
    if (!state) {
      json(res, 404, {
        error:
          "project_not_found",
      });
      return;
    }
    const result =
      commercialFoundationCapabilityForState(
        state,
        key,
      ) ??
      commercialPerformanceCapabilityForState(
        state,
        key,
      ) ??
      commercialContractControlCapabilityForState(
        state,
        key,
      );
    if (!result) {
      json(res, 404, {
        error:
          "commercial_capability_not_found",
        capabilityKey: key,
      });
      return;
    }
    json(
      res,
      result.status ===
        "blocked"
        ? 409
        : 200,
      result,
    );
    return;
  }

  const managementReportMatch =
    /^\/api\/projects\/([^/]+)\/management\/([^/]+)\/report\.(xlsx|json)$/.exec(
      url.pathname,
    );

  if (
    req.method === "GET" &&
    managementReportMatch
  ) {
    const projectId =
      decodeURIComponent(
        managementReportMatch[1]!,
      );
    const key =
      decodeURIComponent(
        managementReportMatch[2]!,
      );
    const format =
      managementReportMatch[3] as
        | "xlsx"
        | "json";
    const result =
      managementSurfaceForProject(
        projectId,
        key,
      );
    if (!result) {
      json(res, 404, {
        error:
          "management_surface_not_found",
        moduleKey: key,
      });
      return;
    }
    if (
      result.status ===
      "blocked"
    ) {
      json(res, 409, {
        error:
          "module_report_blocked",
        moduleKey: key,
        reason:
          result.reason,
        dependencies:
          result.dependencies,
      });
      return;
    }

    if (format === "xlsx") {
      const workbook =
        await buildModuleWorkbook(
          projectId,
          key,
          result,
        );
      attachment(
        res,
        200,
        workbook,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        moduleReportFilename(
          projectId,
          key,
          "xlsx",
        ),
      );
      return;
    }

    const payload =
      buildModuleJsonDownload(
        projectId,
        key,
        result,
      );
    attachment(
      res,
      200,
      payload,
      "application/json; charset=utf-8",
      moduleReportFilename(
        projectId,
        key,
        "json",
      ),
    );
    return;
  }

  const moduleReportMatch =
    /^\/api\/projects\/([^/]+)\/(schedule|commercial)\/modules\/([^/]+)\/report\.(xlsx|json)$/.exec(
      url.pathname,
    );

  if (
    req.method === "GET" &&
    moduleReportMatch
  ) {
    const projectId =
      decodeURIComponent(
        moduleReportMatch[1]!,
      );
    const moduleArea =
      moduleReportMatch[2]!;
    const key =
      decodeURIComponent(
        moduleReportMatch[3]!,
      );
    const format =
      moduleReportMatch[4] as
        | "xlsx"
        | "json";

    if (
      moduleArea ===
        "commercial" &&
      !commercialModules.some(
        (module) =>
          module.key === resolveModuleKey(key),
      )
    ) {
      json(res, 404, {
        error:
          "commercial_module_not_found",
        moduleKey: key,
      });
      return;
    }

    const result =
      moduleForProject(
        projectId,
        key,
      );

    if (
      result.status ===
      "blocked"
    ) {
      json(res, 409, {
        error:
          "module_report_blocked",
        moduleKey: key,
        reason:
          result.reason,
        dependencies:
          result.dependencies,
      });
      return;
    }

    if (format === "xlsx") {
      const workbook =
        await buildModuleWorkbook(
          projectId,
          key,
          result,
        );
      attachment(
        res,
        200,
        workbook,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        moduleReportFilename(
          projectId,
          key,
          "xlsx",
        ),
      );
      return;
    }

    const payload =
      buildModuleJsonDownload(
        projectId,
        key,
        result,
      );
    attachment(
      res,
      200,
      payload,
      "application/json; charset=utf-8",
      moduleReportFilename(
        projectId,
        key,
        "json",
      ),
    );
    return;
  }

  const moduleMatch =
    /^\/api\/projects\/([^/]+)\/(schedule|commercial)\/modules\/([^/]+)$/.exec(
      url.pathname,
    );

  if (
    req.method === "GET" &&
    moduleMatch
  ) {
    const projectId =
      decodeURIComponent(
        moduleMatch[1]!,
      );
    const moduleArea =
      moduleMatch[2]!;
    const key =
      decodeURIComponent(
        moduleMatch[3]!,
      );
    if (
      moduleArea ===
        "commercial" &&
      !commercialModules.some(
        (module) =>
          module.key === resolveModuleKey(key),
      )
    ) {
      json(res, 404, {
        error:
          "commercial_module_not_found",
        moduleKey: key,
      });
      return;
    }
    const result =
      moduleForProject(
        projectId,
        key,
      );
    json(
      res,
      result.status ===
        "blocked"
        ? 409
        : 200,
      publicModuleResult(result,key),
    );
    return;
  }

  const contractUploadMatch =
    /^\/api\/projects\/([^/]+)\/contract\/uploads$/.exec(
      url.pathname,
    );

  if (
    req.method === "POST" &&
    contractUploadMatch
  ) {
    const projectId =
      decodeURIComponent(
        contractUploadMatch[1]!,
      );
    const result =
      await runtimeProjects
        .ingestContract({
          projectId,
          bytes:
            await readBody(req),
          mediaType:
            mediaType(req),
          sourceFilename:
            header(
              req,
              "x-source-filename",
            ),
          sourceRelativePath:
            header(
              req,
              "x-source-relative-path",
            ),
          role:
            (header(
              req,
              "x-contract-role",
            ) as
              | "main"
              | "amendment"
              | "appendix"
              | "tender"
              | "other"
              | null) ??
            "other",
          uploadedAt:
            new Date().toISOString(),
        });
    invalidateProject(
      projectId,
    );
    json(res, 201, {
      projectId,
      sourceType:
        result.sourceType,
      complete:
        result.complete,
      physicalComplete:
        result.physicalComplete,
      semanticComplete:
        result.semanticComplete,
      sectionCount:
        result.sections.length,
      clauseCount:
        result.clauses.length,
      diagnostics:
        result.diagnostics,
    });
    return;
  }

  const controlsMatch =
    /^\/api\/projects\/([^/]+)\/controls$/.exec(
      url.pathname,
    );

  if (
    req.method === "PUT" &&
    controlsMatch
  ) {
    const projectId =
      decodeURIComponent(
        controlsMatch[1]!,
      );
    const update =
      await readJsonBody<
        Partial<ProjectControlState>
      >(req);
    const controls =
      runtimeProjects
        .updateControls(
          projectId,
          update,
        );
    invalidateProject(
      projectId,
    );
    json(res, 200, controls);
    return;
  }

  const quantitiesMatch =
    /^\/api\/projects\/([^/]+)\/quantities$/.exec(
      url.pathname,
    );

  if (
    req.method === "PUT" &&
    quantitiesMatch
  ) {
    const projectId =
      decodeURIComponent(
        quantitiesMatch[1]!,
      );
    const quantities =
      await readJsonBody<
        CanonicalQuantityProgressModel
      >(req);
    runtimeProjects
      .setQuantityModel(
        projectId,
        quantities,
      );
    invalidateProject(
      projectId,
    );
    json(res, 200, {
      projectId,
      itemCount:
        quantities.items.length,
      allocationCount:
        quantities.allocations
          .length,
      snapshotCount:
        quantities
          .installedSnapshots
          .length,
    });
    return;
  }


  const managementSurfaceMatch =
    /^\/api\/projects\/([^/]+)\/management\/([^/]+)$/.exec(
      url.pathname,
    );

  if (
    req.method === "GET" &&
    managementSurfaceMatch
  ) {
    const projectId =
      decodeURIComponent(
        managementSurfaceMatch[1]!,
      );
    const key =
      decodeURIComponent(
        managementSurfaceMatch[2]!,
      );
    const result =
      managementSurfaceForProject(
        projectId,
        key,
      );
    if (!result) {
      json(res, 404, {
        error:
          "management_surface_not_found",
        moduleKey: key,
      });
      return;
    }
    json(
      res,
      result.status ===
        "blocked"
        ? 409
        : 200,
      publicModuleResult(result,key),
    );
    return;
  }

  const managementSurfacesMatch =
    /^\/api\/projects\/([^/]+)\/management-surfaces$/.exec(
      url.pathname,
    );

  if (
    req.method === "GET" &&
    managementSurfacesMatch
  ) {
    const projectId =
      decodeURIComponent(
        managementSurfacesMatch[1]!,
      );
    const surfaces =
      managementSurfacesForProject(
        projectId,
      );
    if (!surfaces) {
      json(res, 404, {
        error:
          "management_surfaces_not_found",
      });
      return;
    }
    // The bundle is a transport convenience only. Reuse the exact first-class
    // management page projections so bundle consumers can never observe a
    // different governed position from the individual page endpoints.
    const canonicalManagementPages = {
      masterDashboard:
        managementSurfaceForProject(
          projectId,
          "master-dashboard",
        )?.data ??
        surfaces.masterDashboard,
      commandCenter:
        managementSurfaceForProject(
          projectId,
          "command-center",
        )?.data ??
        surfaces.commandCenter,
      masterControlProgramme:
        managementSurfaceForProject(
          projectId,
          "master-control-programme",
        )?.data ??
        surfaces.masterControlProgramme,
    };
    json(
      res,
      200,
      {
        ...surfaces,
        ...canonicalManagementPages,
      },
    );
    return;
  }

  const directorMatch =
    /^\/api\/projects\/([^/]+)\/director-position$/.exec(
      url.pathname,
    );

  if (
    req.method === "POST" &&
    directorMatch
  ) {
    const projectId =
      decodeURIComponent(
        directorMatch[1]!,
      );
    const input =
      await readJsonBody<
        Omit<
          DirectorPositionInput,
          "projectId"
        >
      >(req);
    const position =
      buildProjectDirectorPosition({
        ...input,
        projectId,
      });
    directorPositions.set(
      projectId,
      position,
    );
    json(res, 201, position);
    return;
  }

  if (
    req.method === "GET" &&
    directorMatch
  ) {
    const projectId =
      decodeURIComponent(
        directorMatch[1]!,
      );
    const position =
      directorForProject(projectId) ??
      directorPositions.get(projectId);
    if (!position) {
      json(res, 404, {
        error:
          "director_position_not_found",
        persistence:
          runtimeProjects
            .persistenceMode(),
      });
      return;
    }
    json(res, 200, position);
    return;
  }

  const boardHistoryMatch =
    /^\/api\/projects\/([^/]+)\/board-report\/history$/.exec(
      url.pathname,
    );

  if (
    req.method === "GET" &&
    boardHistoryMatch
  ) {
    const projectId =
      decodeURIComponent(
        boardHistoryMatch[1]!,
      );
    const state =
      runtimeProjects.get(
        projectId,
      );
    if (!state) {
      json(res, 404, {
        error:
          "project_not_found",
      });
      return;
    }
    const includeReport =
      url.searchParams.get(
        "includeReport",
      ) === "true";
    json(res, 200, {
      projectId,
      publicationCount:
        state
          .boardPublicationHistory
          .length,
      publications:
        state
          .boardPublicationHistory
          .map(
            (item) => ({
              publicationId:
                item.publicationId,
              basisVersion:
                item.basisVersion,
              sourceManifestId:
                item.sourceManifestId,
              evidenceReceiptIds: [
                ...item.evidenceReceiptIds,
              ],
              finalizedAt:
                item.finalizedAt,
              stale:
                item.stale,
              staleAt:
                item.staleAt,
              reportSnapshot:
                includeReport
                  ? item
                      .reportSnapshot
                  : undefined,
            }),
          )
          .sort(
            (a, b) =>
              a.finalizedAt
                .localeCompare(
                  b.finalizedAt,
                ),
          ),
    });
    return;
  }

  const boardMatch =
    /^\/api\/projects\/([^/]+)\/board-report$/.exec(
      url.pathname,
    );

  if (
    req.method === "POST" &&
    boardMatch
  ) {
    const projectId =
      decodeURIComponent(
        boardMatch[1]!,
      );
    const position =
      directorPositions.get(projectId);
    if (!position) {
      json(res, 409, {
        error:
          "director_position_required_before_board_report",
      });
      return;
    }
    const publication =
      await readJsonBody<
        BoardReportPublicationInput
      >(req);
    const report =
      buildBoardReadyReport(
        position,
        publication,
      );
    boardReports.set(
      projectId,
      report,
    );
    json(res, 201, report);
    return;
  }

  if (
    req.method === "GET" &&
    boardMatch
  ) {
    const projectId =
      decodeURIComponent(
        boardMatch[1]!,
      );
    const report =
      boardReportForProject(
        projectId,
      ) ??
      boardReports.get(projectId);
    if (!report) {
      json(res, 404, {
        error:
          "board_report_not_found",
        persistence:
          runtimeProjects
            .persistenceMode(),
      });
      return;
    }
    json(res, 200, report);
    return;
  }

  const uploadMatch =
    /^\/api\/projects\/([^/]+)\/boq\/uploads$/.exec(
      url.pathname,
    );

  if (
    req.method === "POST" &&
    uploadMatch
  ) {
    const projectId =
      decodeURIComponent(uploadMatch[1]!);
    const body = await readBody(req);

    const result = await ingestBoq({
      projectId,
      bytes: body,
      verifiedMediaType: mediaType(req),
      receivedAt:
        new Date().toISOString(),
      sourceFilename:
        header(req, "x-source-filename"),
      documentId:
        header(req, "x-document-id"),
      revisionId:
        header(req, "x-revision-id"),
      objectId:
        header(req, "x-object-id"),
    });

    result.persistence =
      runtimeProjects
        .persistenceMode();

    boqIngestions.set(
      result.ingestionId,
      result,
    );
    runtimeProjects.attachBoq(
      result,
      body,
      header(
        req,
        "x-source-filename",
      ),
    );
    invalidateProject(
      projectId,
    );

    json(res, 201, uploadSummary(result));
    return;
  }

  const statusMatch =
    /^\/api\/projects\/([^/]+)\/boq\/uploads\/([^/]+)$/.exec(
      url.pathname,
    );

  if (
    req.method === "GET" &&
    statusMatch
  ) {
    const projectId =
      decodeURIComponent(statusMatch[1]!);
    const ingestionId =
      decodeURIComponent(statusMatch[2]!);
    const result =
      boqIngestions.get(ingestionId) ??
      runtimeProjects.get(projectId)?.boqRevisions.find(item=>item.ingestionId===ingestionId);

    if (
      !result ||
      result.projectId !== projectId
    ) {
      json(res, 404, {
        error: "boq_ingestion_not_found",
      });
      return;
    }

    if (
      url.searchParams.get("includeItems") ===
      "true"
    ) {
      json(res, 200, result);
      return;
    }

    json(res, 200, uploadSummary(result));
    return;
  }

  if (
    req.method === "GET" &&
    url.pathname === "/"
  ) {
    html(
      res,
      200,
      CMENG_UAT_HTML,
    );
    return;
  }

  if (
    req.method === "GET" &&
    url.pathname === "/api"
  ) {
    json(res, 200, {
      name: "CMeng",
      description:
        "Controlled construction/project evidence and intelligence platform",
      health: "/health",
      scheduleModules:
        "/api/schedule/modules",
      commercialModules:
        "/api/commercial/modules",
      scheduleCertification:
        "/api/schedule/certification",
      boqUpload:
        "/api/projects/:projectId/boq/uploads",
      portfolio:
        "/api/portfolio",
      createProject:
        "/api/projects",
      projectOverview:
        "/api/projects/:projectId/overview",
      projectIntelligence:
        "/api/projects/:projectId/intelligence/ask",
      evidenceUpload:
        "/api/projects/:projectId/evidence/uploads",
      evidenceUploadProgress:
        "/api/projects/:projectId/evidence/upload-progress/:uploadId",
      evidenceBulkDelete:
        "/api/projects/:projectId/evidence/documents/delete",
      evidenceDelete:
        "/api/projects/:projectId/evidence/documents/:documentId",
      evidenceRerun:
        "/api/projects/:projectId/evidence/rerun",
      scheduleUpload:
        "/api/projects/:projectId/schedule/uploads",
      scheduleRevisions:
        "/api/projects/:projectId/schedule/revisions",
      scheduleModule:
        "/api/projects/:projectId/schedule/modules/:moduleKey",
      moduleReportExcel:
        "/api/projects/:projectId/schedule/modules/:moduleKey/report.xlsx",
      moduleReportJson:
        "/api/projects/:projectId/schedule/modules/:moduleKey/report.json",
      commercialModule:
        "/api/projects/:projectId/commercial/modules/:moduleKey",
      commercialModuleReportExcel:
        "/api/projects/:projectId/commercial/modules/:moduleKey/report.xlsx",
      commercialModuleReportJson:
        "/api/projects/:projectId/commercial/modules/:moduleKey/report.json",
      commercialCapability:
        "/api/projects/:projectId/commercial/capabilities/:capabilityKey",
      contractUpload:
        "/api/projects/:projectId/contract/uploads",
      projectControls:
        "/api/projects/:projectId/controls",
      demoProject:
        "/api/projects/:projectId/demo",
      projectDirector:
        "/api/projects/:projectId/director-position",
      managementSurfaces:
        "/api/projects/:projectId/management-surfaces",
      managementSurface:
        "/api/projects/:projectId/management/:surfaceKey",
      managementSurfaceReportExcel:
        "/api/projects/:projectId/management/:surfaceKey/report.xlsx",
      managementSurfaceReportJson:
        "/api/projects/:projectId/management/:surfaceKey/report.json",
      boardReport:
        "/api/projects/:projectId/board-report",
      boardReportHistory:
        "/api/projects/:projectId/board-report/history",
    });
    return;
  }

  json(res, 404, {
    error: "not_found",
    path: url.pathname,
  });
}




export function createCmengServer(): Server {
  return createServer((req, res) => {
    void withRequestAudit(req,res,()=>route(req, res)).catch((error) => {
      const uploadId =
        header(
          req,
          "x-upload-id",
        );
      const progressMatch =
        /^\/api\/projects\/([^/]+)\/evidence\/uploads$/.exec(
          new URL(
            req.url ?? "/",
            `http://${req.headers.host ?? "localhost"}`,
          ).pathname,
        );
      if (
        uploadId &&
        progressMatch
      ) {
        const projectId =
          decodeURIComponent(
            progressMatch[1]!,
          );
        setEvidenceUploadProgress(
          projectId,
          uploadId,
          {
            state: "failed",
            percent:
              evidenceUploadProgress
                .get(
                  evidenceUploadProgressKey(
                    projectId,
                    uploadId,
                  ),
                )
                ?.percent ??
              0,
            completedAt:
              new Date()
                .toISOString(),
            message:
              error instanceof Error
                ? error.message
                : String(error),
          },
        );
      }

      const statusCode =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof (
          error as {
            statusCode?: unknown;
          }
        ).statusCode === "number"
          ? (
              error as {
                statusCode: number;
              }
            ).statusCode
          : 400;

      json(res, statusCode, {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    });
  });
}

if (require.main === module) {
  void (async () => {
    const refresh =
      await runtimeProjects
        .refreshScheduleControlBasisAssertions();
    if (
      refresh.refreshedDocumentCount > 0 ||
      refresh.diagnostics.length > 0
    ) {
      process.stdout.write(
        JSON.stringify({
          event:
            "schedule_control_basis_refresh",
          refreshedDocumentCount:
            refresh.refreshedDocumentCount,
          diagnosticCodes:
            refresh.diagnostics.map(
              (item) =>
                item.split(":")[0],
            ),
        }) + "\n",
      );
    }

    await runtimeProjects.refreshSpreadsheetRegisters();
    const hseRefresh = await runtimeProjects.refreshHseReports();
    if(hseRefresh.refreshedDocumentCount || hseRefresh.diagnostics.length) process.stdout.write(JSON.stringify({event:"hse_summary_refresh",...hseRefresh})+"\n");

    const correspondenceRefresh =
      await runtimeProjects
        .refreshCorrespondenceNarratives();
    if (
      correspondenceRefresh.refreshedDocumentCount > 0 ||
      correspondenceRefresh.diagnostics.length > 0
    ) {
      process.stdout.write(
        JSON.stringify({
          event:
            "correspondence_narrative_refresh",
          refreshedDocumentCount:
            correspondenceRefresh.refreshedDocumentCount,
          segmentCount:
            correspondenceRefresh.segmentCount,
          unresolvedAnchorCount:
            correspondenceRefresh.unresolvedAnchorCount,
          diagnosticCodes:
            correspondenceRefresh.diagnostics.map(
              (item) =>
                item.split(":")[0],
            ),
        }) + "\n",
      );
    }

    for (const projectId of runtimeProjects.listProjectIds()) {
      const state = runtimeProjects.get(projectId);
      if (!state) continue;
      const diagnostics: string[] = [];
      const catalog = governedTables(
        state.evidenceDocuments,
        diagnostics,
      )
        .map((table) => {
          const evidenceDocument =
            state.evidenceDocuments.find(
              (document) =>
                document.documentId ===
                table.document.documentId,
            );
          return {
          documentType:
            evidenceDocument?.documentType ??
            "unknown",
          category:
            evidenceDocument?.category ??
            "other",
          basisState:
            table.document.basisState,
          rows: table.rows
            .map((row) => ({
              metric:
                row.cells["metric"] ??
                row.cells["parameter"] ??
                row.cells["measure"] ??
                row.cells["name"] ??
                row.cells["indicator"] ??
                "",
              value:
                row.cells["value"] ??
                row.cells["result"] ??
                "",
              unit:
                row.cells["unit"] ??
                row.cells["uom"] ??
                "",
              source:
                row.cells["source"] ??
                row.cells["forecast basis"] ??
                row.cells["basis"] ??
                "",
            }))
            .filter((row) =>
              row.metric ||
              row.source
            ),
          };
        })
        .filter((item) =>
          item.category ===
            "schedule_control" &&
          item.rows.length > 0
        );

      const controlBasis =
        projectScheduleControlBasis(
          state,
        );
      process.stdout.write(
        JSON.stringify({
          event:
            "project_control_basis_trace",
          projectFingerprint:
            projectId.length,
          state:
            controlBasis.state,
          nearCriticalWorkingDays:
            controlBasis.nearCriticalWorkingDays,
          nearCriticalExplicitHours:
            controlBasis.nearCriticalExplicitHours,
          nearCriticalSourceCount:
            controlBasis.nearCriticalSourceCount,
          thresholdMethod:
            controlBasis.nearCriticalThresholdMethod,
          diagnosticCodes:
            controlBasis.diagnostics.map(
              (item) =>
                item.split(":")[0],
            ),
        }) + "\n",
      );

      if (catalog.length > 0) {
        process.stdout.write(
          JSON.stringify({
            event:
              "project_control_metric_catalog",
            projectFingerprint:
              projectId.length,
            catalog,
          }) + "\n",
        );
      }
    }

    const deferred=await runtimeProjects.refreshDeferredPdfReads();
    for(const projectId of deferred.changedProjects)invalidateProject(projectId);

    // Start serving immediately. Project positions are versioned and cached
    // on first real use; do not consume the single Node process by precomputing
    // the full retained portfolio during service startup.
    const projectCount=runtimeProjects.listProjectIds().length;
    const server = createCmengServer();
    server.listen(port, host, () => {
      process.stdout.write(
        `CMeng runtime listening on ${host}:${port}\n`,
      );
      process.stdout.write(JSON.stringify({
        event:'positions_lazy_ready',
        coldDashboardTargetMs:COLD_DASHBOARD_TARGET_MS,
        projectCount,
      })+'\n');
    });
  })().catch((error) => {
    process.stderr.write(
      "CMENG_STARTUP_FAILED:" +
        (
          error instanceof Error
            ? error.message
            : String(error)
        ) +
        "\n",
    );
    process.exitCode = 1;
  });
}
