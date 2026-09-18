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
    url.pathname === "/"
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
      boqUpload:
        "/api/projects/:projectId/boq/uploads",
      projectDirector:
        "/api/projects/:projectId/director-position",
      boardReport:
        "/api/projects/:projectId/board-report",
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
