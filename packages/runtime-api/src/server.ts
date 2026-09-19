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
  runtimeProjects,
} from "./project-state";
import {
  boardReportForProject,
  directorForProject,
  invalidateProject,
  moduleForProject,
  overviewForProject,
} from "./project-projections";
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
  identifyEvidenceDocument,
  type EvidenceIdentificationResult,
} from "./document-identification";

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
    json(res, 200, {
      projectId,
      documentCount:
        state.evidenceDocuments
          .length,
      documents:
        runtimeProjects
          .evidence(projectId),
    });
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
    const body =
      await readBody(req);
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
    const type =
      mediaType(req).toLowerCase();
    const isZip =
      type.includes("zip") ||
      filename
        .toLowerCase()
        .endsWith(".zip");

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
              preidentified:
                item.identification,
            });
        results.push(result);
      }

      invalidateProject(
        projectId,
      );
      json(res, 201, {
        projectId,
        packFilename:
          filename,
        documentCount:
          results.length,
        extractedBytes,
        documents: results,
      });
      return;
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
        });
    invalidateProject(
      projectId,
    );
    json(res, 201, result);
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
        "Certified demo project loaded. Demo evidence is isolated from user uploads.",
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
          (a, b) =>
            a.sequence -
            b.sequence,
        ),
    );
    return;
  }

  const moduleMatch =
    /^\/api\/projects\/([^/]+)\/schedule\/modules\/([^/]+)$/.exec(
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
    const key =
      decodeURIComponent(
        moduleMatch[2]!,
      );
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
      result,
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
    html(
      res,
      200,
      cmengUatHtml(),
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
      boqUpload:
        "/api/projects/:projectId/boq/uploads",
      projectOverview:
        "/api/projects/:projectId/overview",
      scheduleUpload:
        "/api/projects/:projectId/schedule/uploads",
      scheduleRevisions:
        "/api/projects/:projectId/schedule/revisions",
      scheduleModule:
        "/api/projects/:projectId/schedule/modules/:moduleKey",
      contractUpload:
        "/api/projects/:projectId/contract/uploads",
      projectControls:
        "/api/projects/:projectId/controls",
      demoProject:
        "/api/projects/:projectId/demo",
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
