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
  ingestScheduleXer,
  type ScheduleIngestionResult,
} from "../../schedule-ingestion/src";
import {
  buildProjectScheduleModule,
  buildProjectDirectorFromRuntime,
  type ProjectDirectorRuntimeEvidence,
  type ProjectScheduleRuntimeContext,
} from "../../project-schedule-runtime/src";
import {
  parseContractPdf,
  parseContractDocx,
  type ContractDocumentResult,
} from "../../contract-parser/src";
import {
  extractContractLdTerms,
} from "../../contract-commercial/src";
import type {
  CanonicalQuantityProgressModel,
} from "../../quantity-progress-core/src";
import type {
  DelayClaimsModel,
  EotContractContext,
} from "../../delay-analysis-core/src";
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
import {
  projectState,
  projectSummary,
  touchProject,
} from "./project-store";
import { uatPage } from "../../runtime-ui/src/page";

const port = Number.parseInt(
  process.env.PORT ?? "3000",
  10,
);
const host = process.env.HOST ?? "0.0.0.0";
const MAX_UPLOAD_BYTES = Number.parseInt(
  process.env.CMENG_MAX_UPLOAD_BYTES ??
    String(50 * 1024 * 1024),
  10,
);

const boqIngestions =
  new Map<string, BoqIngestionResult>();
const directorPositions =
  new Map<string, ProjectDirectorPosition>();
const boardReports =
  new Map<string, BoardReadyReport>();

function json(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type":
      "application/json; charset=utf-8",
    "content-length":
      Buffer.byteLength(payload),
  });
  res.end(payload);
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
): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let total = 0;

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

function scheduleUploadSummary(
  result: ScheduleIngestionResult,
) {
  return {
    ingestionId: result.ingestionId,
    projectId: result.projectId,
    sourceFormat: result.sourceFormat,
    sourceFilename: result.sourceFilename,
    sourceHashSha256:
      result.sourceHashSha256,
    sourceManifestId:
      result.sourceManifest.manifestId,
    evidenceReceiptId:
      result.evidenceReceipt.receiptId,
    authority: result.authority,
    persistence: result.persistence,
    revision: {
      revisionId:
        result.revision.revisionId,
      label: result.revision.label,
      sequence:
        result.revision.sequence,
      effectiveAt:
        result.revision.effectiveAt,
      dataDateIso:
        result.schedule.dataDateIso,
    },
    activityCount:
      result.schedule.activities.length,
    relationshipCount:
      result.schedule.relationships.length,
    resourceCount:
      result.resources.resources.length,
    resourceAssignmentCount:
      result.resources.assignments.length,
    diagnostics: result.diagnostics,
  };
}

function runtimeContext(
  projectId: string,
): ProjectScheduleRuntimeContext {
  const project = projectState(projectId);
  const ordered = [
    ...project.scheduleIngestions,
  ].sort(
    (a, b) =>
      a.revision.sequence -
      b.revision.sequence,
  );
  const latest = ordered.at(-1);

  return {
    generatedAt:
      new Date().toISOString(),
    producerVersion:
      "cmeng-runtime-uat-v1",
    revisions: ordered.map(
      (item) => item.revision,
    ),
    ...(latest
      ? {
          resourceModel:
            latest.resources,
        }
      : {}),
    ...(project.quantityModel
      ? {
          quantityModel:
            project.quantityModel,
        }
      : {}),
    ...(project.delayClaimsModel
      ? {
          delayClaimsModel:
            project.delayClaimsModel,
        }
      : {}),
    ...(project.contract
      ? {
          contract: project.contract,
        }
      : {}),
    ...(project.eotContractContext
      ? {
          eotContractContext:
            project.eotContractContext,
        }
      : {}),
    ...(project.progressSnapshots.length > 0
      ? {
          progressSnapshots: [
            ...project.progressSnapshots,
          ],
        }
      : {}),
    ...(Object.keys(
      project.progressEvidence,
    ).length > 0
      ? {
          progressEvidence: {
            ...project.progressEvidence,
          },
        }
      : {}),
    ...(Object.keys(
      project.readinessEvidence,
    ).length > 0
      ? {
          readinessEvidence:
            project.readinessEvidence,
        }
      : {}),
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
      boqIngestion: {
        acceptedFormats: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel.sheet.macroEnabled.12",
          "application/pdf",
        ],
        persistence: "runtime_local",
        authority: "candidate_only",
      },
    });
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


  const projectSummaryMatch =
    /^\/api\/projects\/([^/]+)$/.exec(
      url.pathname,
    );

  if (
    req.method === "GET" &&
    projectSummaryMatch
  ) {
    const projectId =
      decodeURIComponent(
        projectSummaryMatch[1]!,
      );
    json(
      res,
      200,
      projectSummary(
        projectState(projectId),
      ),
    );
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
    const project =
      projectState(projectId);
    const bytes = await readBody(req);
    const sequenceHeader =
      header(
        req,
        "x-revision-sequence",
      );
    const sequence =
      sequenceHeader === null
        ? project.scheduleIngestions
            .length + 1
        : Number(sequenceHeader);

    const result =
      await ingestScheduleXer({
        projectId,
        bytes,
        verifiedMediaType:
          mediaType(req),
        receivedAt:
          new Date().toISOString(),
        sourceFilename:
          header(
            req,
            "x-source-filename",
          ),
        documentId:
          header(
            req,
            "x-document-id",
          ),
        revisionId:
          header(
            req,
            "x-revision-id",
          ),
        revisionLabel:
          header(
            req,
            "x-revision-label",
          ),
        revisionSequence:
          sequence,
        effectiveAt:
          header(
            req,
            "x-effective-at",
          ),
      });

    const existingIndex =
      project.scheduleIngestions
        .findIndex(
          (item) =>
            item.revision.revisionId ===
            result.revision.revisionId,
        );
    if (existingIndex >= 0) {
      project.scheduleIngestions[
        existingIndex
      ] = result;
    } else {
      project.scheduleIngestions.push(
        result,
      );
    }
    project.scheduleIngestions.sort(
      (a, b) =>
        a.revision.sequence -
        b.revision.sequence,
    );
    touchProject(project);

    json(
      res,
      201,
      scheduleUploadSummary(result),
    );
    return;
  }

  if (
    req.method === "GET" &&
    scheduleUploadMatch
  ) {
    const projectId =
      decodeURIComponent(
        scheduleUploadMatch[1]!,
      );
    const project =
      projectState(projectId);
    json(res, 200, {
      projectId,
      persistence:
        "runtime_local",
      uploads:
        project.scheduleIngestions
          .map(
            scheduleUploadSummary,
          ),
    });
    return;
  }

  const scheduleModuleMatch =
    /^\/api\/projects\/([^/]+)\/schedule\/modules\/([^/]+)$/.exec(
      url.pathname,
    );

  if (
    req.method === "GET" &&
    scheduleModuleMatch
  ) {
    const projectId =
      decodeURIComponent(
        scheduleModuleMatch[1]!,
      );
    const moduleKey =
      decodeURIComponent(
        scheduleModuleMatch[2]!,
      );

    if (
      !scheduleModules.some(
        (module) =>
          module.key === moduleKey,
      )
    ) {
      json(res, 404, {
        error:
          "schedule_module_not_found",
        moduleKey,
      });
      return;
    }

    const result =
      buildProjectScheduleModule(
        moduleKey,
        runtimeContext(projectId),
      );

    json(res, 200, result);
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
    const project =
      projectState(projectId);
    const bytes = await readBody(req);
    const type =
      mediaType(req).toLowerCase();
    const filename =
      header(
        req,
        "x-source-filename",
      )?.toLowerCase() ?? "";

    let contract:
      ContractDocumentResult;

    if (
      type === "application/pdf" ||
      filename.endsWith(".pdf")
    ) {
      contract =
        await parseContractPdf(
          bytes,
        );
    } else if (
      type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      filename.endsWith(".docx")
    ) {
      contract =
        await parseContractDocx(
          bytes,
        );
    } else {
      throw new Error(
        "CONTRACT_FORMAT_UNSUPPORTED",
      );
    }

    project.contract = contract;
    touchProject(project);

    const ldTerms =
      extractContractLdTerms(
        contract,
      );

    json(res, 201, {
      projectId,
      persistence:
        "runtime_local",
      sourceType:
        contract.sourceType,
      physicalComplete:
        contract.physicalComplete,
      semanticComplete:
        contract.semanticComplete,
      complete: contract.complete,
      sectionCount:
        contract.sections.length,
      clauseCount:
        contract.clauses.length,
      semanticCoveragePercent:
        contract.semanticCoveragePercent,
      ldTerms,
      diagnostics:
        contract.diagnostics,
    });
    return;
  }

  const evidenceMatch =
    /^\/api\/projects\/([^/]+)\/evidence\/(quantity-progress|delay-claims|eot-context|progress-snapshots|progress-evidence|readiness|director-controls)$/.exec(
      url.pathname,
    );

  if (
    req.method === "POST" &&
    evidenceMatch
  ) {
    const projectId =
      decodeURIComponent(
        evidenceMatch[1]!,
      );
    const kind =
      evidenceMatch[2]!;
    const project =
      projectState(projectId);

    if (kind === "quantity-progress") {
      const value =
        await readJsonBody<
          CanonicalQuantityProgressModel
        >(req);
      if (
        value.projectId !== null &&
        value.projectId !== projectId
      ) {
        throw new Error(
          "QUANTITY_MODEL_PROJECT_MISMATCH",
        );
      }
      const currentRevision =
        project.scheduleIngestions
          .at(-1)
          ?.revision.revisionId;
      if (
        currentRevision &&
        value.scheduleRevisionId !==
          currentRevision
      ) {
        throw new Error(
          "QUANTITY_MODEL_SCHEDULE_REVISION_MISMATCH",
        );
      }
      project.quantityModel =
        value;
    } else if (
      kind === "delay-claims"
    ) {
      const value =
        await readJsonBody<
          DelayClaimsModel
        >(req);
      if (
        value.projectId !== projectId
      ) {
        throw new Error(
          "DELAY_CLAIMS_PROJECT_MISMATCH",
        );
      }
      project.delayClaimsModel =
        value;
    } else if (
      kind === "eot-context"
    ) {
      project.eotContractContext =
        await readJsonBody<
          EotContractContext
        >(req);
    } else if (
      kind === "progress-snapshots"
    ) {
      project.progressSnapshots =
        await readJsonBody<
          ActualProgressSnapshot[]
        >(req);
    } else if (
      kind === "progress-evidence"
    ) {
      project.progressEvidence =
        await readJsonBody<{
          physical?: ExternalProgressEvidence;
          contractorReported?: ExternalProgressEvidence;
          certified?: ExternalProgressEvidence;
        }>(req);
    } else if (
      kind === "readiness"
    ) {
      project.readinessEvidence =
        await readJsonBody<
          Record<
            string,
            Partial<
              Record<
                ReadinessDimensionKey,
                ReadinessEvidence
              >
            >
          >
        >(req);
    } else if (
      kind === "director-controls"
    ) {
      project.directorEvidence =
        await readJsonBody<
          ProjectDirectorRuntimeEvidence
        >(req);
    }

    touchProject(project);
    json(
      res,
      201,
      projectSummary(project),
    );
    return;
  }

  const computeDirectorMatch =
    /^\/api\/projects\/([^/]+)\/director-position\/compute$/.exec(
      url.pathname,
    );

  if (
    req.method === "POST" &&
    computeDirectorMatch
  ) {
    const projectId =
      decodeURIComponent(
        computeDirectorMatch[1]!,
      );
    const project =
      projectState(projectId);

    const evidence =
      project.directorEvidence ??
      await readJsonBody<
        ProjectDirectorRuntimeEvidence
      >(req);

    project.directorEvidence =
      evidence;

    const built =
      buildProjectDirectorFromRuntime(
        projectId,
        runtimeContext(projectId),
        evidence,
      );

    if (
      built.status !==
        "available" ||
      !built.position
    ) {
      json(res, 409, built);
      return;
    }

    project.directorPosition =
      built.position;
    directorPositions.set(
      projectId,
      built.position,
    );
    touchProject(project);
    json(
      res,
      201,
      built.position,
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
    const project =
      projectState(projectId);
    project.directorPosition =
      position;
    touchProject(project);
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
      directorPositions.get(projectId);
    if (!position) {
      json(res, 404, {
        error:
          "director_position_not_found",
        persistence: "runtime_local",
      });
      return;
    }
    json(res, 200, position);
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
    const project =
      projectState(projectId);
    project.boardReport =
      report;
    touchProject(project);
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
      boardReports.get(projectId);
    if (!report) {
      json(res, 404, {
        error:
          "board_report_not_found",
        persistence: "runtime_local",
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

    boqIngestions.set(
      result.ingestionId,
      result,
    );
    const project =
      projectState(projectId);
    project.boqIngestions.push(
      result,
    );
    touchProject(project);

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
      boqIngestions.get(ingestionId);

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
    (
      url.pathname === "/" ||
      url.pathname === "/app"
    )
  ) {
    html(
      res,
      200,
      uatPage(),
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
      scheduleCertification:
        "/api/schedule/certification",
      scheduleUpload:
        "/api/projects/:projectId/schedule/uploads",
      boqUpload:
        "/api/projects/:projectId/boq/uploads",
      contractUpload:
        "/api/projects/:projectId/contract/uploads",
      projectDirector:
        "/api/projects/:projectId/director-position",
      boardReport:
        "/api/projects/:projectId/board-report",
      uat: "/app",
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
    void route(req, res).catch((error) => {
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
  const server = createCmengServer();
  server.listen(port, host, () => {
    process.stdout.write(
      `CMeng runtime listening on ${host}:${port}\n`,
    );
  });
}
