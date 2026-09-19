import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import {
  extname,
  join,
} from "node:path";

import {
  ingestBoq,
  type BoqIngestionResult,
} from "../../boq-ingestion/src";
import {
  linkContractFamily,
  parseContractDocx,
  parseContractPdf,
} from "../../contract-parser/src";
import type {
  ContractDocumentResult,
} from "../../contract-parser/src";
import {
  canonicalScheduleFromPrimaveraXml,
  canonicalScheduleFromTabular,
  canonicalScheduleFromXer,
} from "../../schedule-analysis-core/src";
import {
  canonicalResourcesFromXer,
} from "../../schedule-resource-core/src";
import {
  parsePrimaveraXml,
} from "../../primavera-xml-parser/src";
import {
  parseScheduleCsv,
  parseScheduleXlsx,
} from "../../schedule-tabular-parser/src";
import {
  parseXerBytes,
} from "../../xer-parser/src";
import {
  TesseractOcrProvider,
} from "../../pdf-document-parser/src";
import {
  parseSubmittedManpowerPlan,
} from "../../delivery-challenge/src";
import {
  extractDocumentAssertions,
  type DocumentAssertion,
} from "../../module-challenge/src";
import type {
  CanonicalQuantityProgressModel,
} from "../../quantity-progress-core/src";
import type {
  CanonicalResourceModel,
} from "../../schedule-resource-core/src";
import type {
  EvidenceCategory,
  EvidenceIdentification,
  EvidenceLineage,
  EvidenceUploadIntent,
  EvidenceBasisEffect,
  EvidenceUploadSummary,
  ProjectControlState,
  ProjectRuntimeState,
  ScheduleUploadFormat,
  ScheduleUploadSummary,
  StoredEvidenceDocument,
  StoredScheduleRevision,
} from "./project-state-types";
import {
  analyzeCsvEvidence,
  analyzeTextEvidence,
  inferDocumentType,
  inferEvidenceLineage,
  inferEvidenceCategory,
  inferMediaType,
  inferScheduleRole,
} from "./evidence";
import {
  identifyEvidenceDocument,
  type EvidenceIdentificationResult,
} from "./document-identification";
import {
  applyEvidenceBasis,
  evidenceFamily,
} from "./evidence-control";

function hashBytes(
  bytes: Uint8Array,
): string {
  return createHash("sha256")
    .update(bytes)
    .digest("hex");
}

function emptyControls():
  ProjectControlState {
  return {
    delayClaims: null,
    contractTimeBasis: null,
    readinessEvidence: {},
    progressEvidence: {},
    contractValue: null,
    variations: [],
    invoices: [],
    retentions: [],
    bonds: [],
    claimCommercials: [],
    hseIncidents: [],
    ncrs: [],
    rfis: [],
    permits: [],
    boardPublication: null,
  };
}

function normalizedFilename(
  filename: string | null | undefined,
): string {
  return (
    filename ??
    ""
  ).trim().toLowerCase();
}

function startsWith(
  bytes: Uint8Array,
  text: string,
): boolean {
  if (bytes.length < text.length) {
    return false;
  }
  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    if (
      bytes[index] !==
      text.charCodeAt(index)
    ) {
      return false;
    }
  }
  return true;
}

function scheduleFormat(
  bytes: Uint8Array,
  filename: string | null | undefined,
  mediaType: string,
): ScheduleUploadFormat {
  const name =
    normalizedFilename(filename);
  const lowerMedia =
    mediaType.toLowerCase();

  if (
    name.endsWith(".xer") ||
    startsWith(bytes, "ERMHDR")
  ) {
    return "xer";
  }

  if (
    name.endsWith(".xml") ||
    lowerMedia.includes("xml")
  ) {
    return "primavera_xml";
  }

  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xlsm") ||
    lowerMedia.includes(
      "spreadsheetml",
    )
  ) {
    return "schedule_xlsx";
  }

  if (
    name.endsWith(".csv") ||
    lowerMedia.includes("text/csv")
  ) {
    return "schedule_csv";
  }

  throw new Error(
    "SCHEDULE_MEDIA_UNSUPPORTED",
  );
}

function scheduleRole(
  value: string | null | undefined,
): StoredScheduleRevision["role"] {
  const normalized =
    (value ?? "update")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

  if (
    normalized === "baseline" ||
    normalized === "update" ||
    normalized === "recovery" ||
    normalized === "revised_baseline"
  ) {
    return normalized;
  }

  return "other";
}

function summary(
  stored: StoredScheduleRevision,
  resources:
    ProjectRuntimeState["resourcesByRevision"],
): ScheduleUploadSummary {
  return {
    projectId:
      stored.revision.model.projectId ??
      "",
    revisionId:
      stored.revision.revisionId,
    sequence:
      stored.revision.sequence,
    role: stored.role,
    format: stored.format,
    sourceFilename:
      stored.sourceFilename,
    sourceHashSha256:
      stored.sourceHashSha256,
    uploadedAt:
      stored.uploadedAt,
    dataDateIso:
      stored.revision.model.dataDateIso,
    activityCount:
      stored.revision.model
        .activities.length,
    relationshipCount:
      stored.revision.model
        .relationships.length,
    resourceAssignmentCount:
      resources.get(
        stored.revision.revisionId,
      )?.assignments.length ?? null,
    diagnosticCount:
      stored.revision.model
        .diagnostics.length,
  };
}

function quantityModelFromBoq(
  result: BoqIngestionResult,
  scheduleRevisionId: string,
  existing:
    CanonicalQuantityProgressModel | null,
): CanonicalQuantityProgressModel {
  const source =
    result.sourceFormat === "pdf"
      ? "boq_pdf" as const
      : result.sourceFormat ===
          "csv"
        ? "boq_csv" as const
        : "boq_xlsx" as const;

  const items = result.canonicalItems.map(
    (item) => ({
      quantityItemId: item.itemId,
      itemNumber: item.itemNumber,
      section: item.section,
      description: item.description,
      unit: item.unit,
      contractQuantity:
        item.quantity,
      sourceRefs: [{
        source,
        locator:
          item.sourceRefs[0] ??
          "evidence-receipt:" +
            result.evidenceReceipt
              .receiptId,
      }],
      diagnostics: [
        ...item.diagnostics,
        ...(item.status ===
        "unresolved"
          ? [
              "QUANTITY_ITEM_SOURCE_UNRESOLVED",
            ]
          : []),
      ],
    }),
  );

  const itemIds = new Set(
    items.map(
      (item) =>
        item.quantityItemId,
    ),
  );

  return {
    projectId: result.projectId,
    boqRevisionId:
      result.evidenceReceipt
        .revisionId,
    scheduleRevisionId,
    items,
    allocations:
      existing?.allocations.filter(
        (allocation) =>
          itemIds.has(
            allocation.quantityItemId,
          ),
      ) ?? [],
    installedSnapshots:
      existing?.installedSnapshots.filter(
        (snapshot) =>
          itemIds.has(
            snapshot.quantityItemId,
          ),
      ) ?? [],
    diagnostics: [
      ...result.diagnostics,
    ],
  };
}


interface SerializedProjectState
  extends Omit<
    ProjectRuntimeState,
    "resourcesByRevision"
  > {
  resourcesByRevision:
    Array<
      [string, CanonicalResourceModel]
    >;
}

interface RuntimeStateSnapshot {
  schemaVersion: 1;
  projects: SerializedProjectState[];
}

function serializeProject(
  state: ProjectRuntimeState,
): SerializedProjectState {
  return {
    ...state,
    resourcesByRevision: [
      ...state.resourcesByRevision
        .entries(),
    ],
  };
}

function specialistIdentification(
  input: {
    mediaType: string;
    category: EvidenceCategory;
    documentType: string;
    sourceFilename:
      | string
      | null;
    diagnostics?: string[];
  },
): EvidenceIdentification {
  const filename =
    input.sourceFilename ??
    "evidence";
  return {
    verifiedMediaType:
      input.mediaType,
    detectedCategory:
      input.category,
    detectedDocumentType:
      input.documentType,
    confidence: 0.98,
    method: "signature",
    ocrUsed: false,
    ocrConfidence: null,
    pageCount: null,
    extractedCharacterCount: 0,
    detectedTitle: null,
    filenameHintCategory:
      inferEvidenceCategory(
        filename,
        null,
      ),
    filenameHintDocumentType:
      inferDocumentType(
        filename,
        null,
      ),
    declaredCategory: null,
    declaredDocumentType: null,
    classificationConflict: false,
    needsReview: false,
    signals: [
      "specialist parser accepted document",
    ],
    diagnostics: [
      ...(input.diagnostics ?? []),
    ],
  };
}

function legacyLineage(
  document: StoredEvidenceDocument,
): EvidenceLineage {
  return {
    effect:
      "unknown",
    predecessorDocumentIds: [],
    replacesEntireBasis: false,
    appliesAsDelta: false,
    inferred: true,
    confidence: 0,
    needsReview: true,
    diagnostics: [
      "EVIDENCE_LINEAGE_LEGACY_UNKNOWN",
    ],
  };
}

function legacyIdentification(
  document: StoredEvidenceDocument,
): EvidenceIdentification {
  return {
    verifiedMediaType:
      document.mediaType,
    detectedCategory:
      document.category,
    detectedDocumentType:
      document.documentType,
    confidence: 0.4,
    method:
      "metadata_fallback",
    ocrUsed: false,
    ocrConfidence: null,
    pageCount: null,
    extractedCharacterCount: 0,
    detectedTitle: null,
    filenameHintCategory:
      document.category,
    filenameHintDocumentType:
      document.documentType,
    declaredCategory: null,
    declaredDocumentType: null,
    classificationConflict: false,
    needsReview: true,
    signals: [
      "legacy evidence metadata",
    ],
    diagnostics: [
      "DOCUMENT_IDENTIFICATION_LEGACY_FALLBACK",
    ],
  };
}

function hydrateProject(
  state: SerializedProjectState,
): ProjectRuntimeState {
  const legacy = state as SerializedProjectState &
    Partial<ProjectRuntimeState>;
  return {
    ...state,
    evidenceDocuments:
      (legacy.evidenceDocuments ?? [])
        .map((document) => ({
          ...document,
          mapping:
            document.mapping
              ? {
                  method:
                    document.mapping
                      .method ??
                    "explicit_column",
                  rowCount:
                    document.mapping
                      .rowCount,
                  linkedActivityField:
                    document.mapping
                      .linkedActivityField,
                  linkedActivityCount:
                    document.mapping
                      .linkedActivityCount,
                  mappedActivityCount:
                    document.mapping
                      .mappedActivityCount,
                  unmappedActivityCount:
                    document.mapping
                      .unmappedActivityCount,
                  coveragePercent:
                    document.mapping
                      .coveragePercent,
                }
              : null,
          identification:
            document.identification ??
            legacyIdentification(
              document,
            ),
          lineage:
            document.lineage ??
            legacyLineage(
              document,
            ),
          assertions:
            document.assertions ??
            [],
          uploadIntent:
            document.uploadIntent ??
            "add_update",
          familyKey:
            document.familyKey ??
            evidenceFamily({
              category:
                document.category,
              documentType:
                document.documentType,
              scheduleRole:
                document.scheduleRole,
              textSample: "",
              sourceFilename:
                document.sourceFilename,
            }).familyKey,
          logicalDocumentKey:
            document.logicalDocumentKey ??
            evidenceFamily({
              category:
                document.category,
              documentType:
                document.documentType,
              scheduleRole:
                document.scheduleRole,
              textSample: "",
              sourceFilename:
                document.sourceFilename,
            }).logicalDocumentKey,
          basisState:
            document.basisState ??
            "historical",
          supersededByDocumentId:
            document.supersededByDocumentId ??
            null,
          supersedesDocumentIds:
            document.supersedesDocumentIds ??
            [],
        })),
    boqRevisions:
      legacy.boqRevisions ??
      (legacy.boq ? [legacy.boq] : []),
    contractDocuments:
      legacy.contractDocuments ?? [],
    contractFamily:
      legacy.contractFamily ?? null,
    submittedManpowerPlan:
      legacy.submittedManpowerPlan ??
      null,
    activeEvidenceBasis:
      legacy.activeEvidenceBasis ??
      {},
    boardPublicationHistory:
      legacy.boardPublicationHistory ??
      [],
    delayEventHistory:
      legacy.delayEventHistory ??
      [],
    lastRerunReceipt:
      legacy.lastRerunReceipt ??
      null,
    resourcesByRevision:
      new Map(
        state.resourcesByRevision,
      ),
  };
}

function safeSegment(
  value: string,
): string {
  const cleaned = value
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return cleaned || "unknown";
}

function fileExtension(
  filename: string | null | undefined,
): string {
  const extension = extname(
    filename ?? "",
  )
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "");
  return extension.length <= 12
    ? extension
    : "";
}

export class RuntimeProjectStore {
  private readonly projects =
    new Map<
      string,
      ProjectRuntimeState
    >();

  private readonly dataDir: string;
  private readonly stateFile: string;
  private readonly durable: boolean;

  constructor(
    options: {
      dataDir?: string;
      durable?: boolean;
    } = {},
  ) {
    const testMode =
      process.env
        .CMENG_TEST_MODE
        ?.trim() === "1";
    const railwayMount =
      testMode
        ? undefined
        : process.env
            .RAILWAY_VOLUME_MOUNT_PATH
            ?.trim();
    const testDataDir =
      join(
        process.cwd(),
        ".cmeng-test-runtime",
        String(process.pid),
      );

    this.dataDir =
      options.dataDir ??
      (
        testMode
          ? testDataDir
          : railwayMount ??
            process.env
              .CMENG_DATA_DIR
              ?.trim() ??
            join(
              process.cwd(),
              ".cmeng-runtime",
            )
      );

    this.durable =
      options.durable ??
      (
        !testMode &&
        Boolean(railwayMount)
      );

    this.stateFile =
      join(
        this.dataDir,
        "cmeng-project-state.json",
      );

    mkdirSync(
      this.dataDir,
      { recursive: true },
    );
    this.loadSnapshot();
  }

  persistenceMode():
    | "railway_volume"
    | "runtime_local" {
    return this.durable
      ? "railway_volume"
      : "runtime_local";
  }

  persistenceStatus(): {
    mode:
      | "railway_volume"
      | "runtime_local";
    dataDir: string;
    stateFile: string;
  } {
    return {
      mode: this.durable
        ? "railway_volume"
        : "runtime_local",
      dataDir: this.dataDir,
      stateFile: this.stateFile,
    };
  }

  private loadSnapshot(): void {
    if (!existsSync(this.stateFile)) {
      return;
    }

    try {
      const parsed = JSON.parse(
        readFileSync(
          this.stateFile,
          "utf8",
        ),
      ) as RuntimeStateSnapshot;

      if (
        parsed.schemaVersion !== 1 ||
        !Array.isArray(
          parsed.projects,
        )
      ) {
        throw new Error(
          "CMENG_STATE_SCHEMA_UNSUPPORTED",
        );
      }

      for (
        const serialized of
          parsed.projects
      ) {
        const state =
          hydrateProject(
            serialized,
          );
        this.projects.set(
          state.projectId,
          state,
        );
      }
    } catch (error) {
      throw new Error(
        "CMENG_STATE_RESTORE_FAILED:" +
          (
            error instanceof Error
              ? error.message
              : String(error)
          ),
      );
    }
  }

  private persistSnapshot(): void {
    const snapshot:
      RuntimeStateSnapshot = {
      schemaVersion: 1,
      projects: [
        ...this.projects.values(),
      ].map(
        serializeProject,
      ),
    };

    const temporary =
      this.stateFile + ".tmp";

    writeFileSync(
      temporary,
      JSON.stringify(snapshot),
      "utf8",
    );
    renameSync(
      temporary,
      this.stateFile,
    );
  }

  private createOcrProvider():
    TesseractOcrProvider {
    const cachePath =
      join(
        this.dataDir,
        "ocr-cache",
      );
    mkdirSync(
      cachePath,
      { recursive: true },
    );
    const languages =
      (
        process.env
          .CMENG_OCR_LANGUAGES ??
        "eng,ara"
      )
        .split(/[,+]/)
        .map(
          (value) =>
            value.trim(),
        )
        .filter(Boolean);

    return new TesseractOcrProvider({
      languages,
      cachePath,
      ...(process.env
        .CMENG_OCR_LANG_PATH
        ?.trim()
        ? {
            langPath:
              process.env
                .CMENG_OCR_LANG_PATH!
                .trim(),
          }
        : {}),
    });
  }

  private persistRawUpload(
    input: {
      projectId: string;
      category: string;
      hash: string;
      bytes: Uint8Array;
      sourceFilename?:
        | string
        | null;
    },
  ): string {
    const directory = join(
      this.dataDir,
      "uploads",
      safeSegment(
        input.projectId,
      ),
      safeSegment(
        input.category,
      ),
    );
    mkdirSync(
      directory,
      { recursive: true },
    );

    const path = join(
      directory,
      input.hash +
        fileExtension(
          input.sourceFilename,
        ),
    );

    if (!existsSync(path)) {
      writeFileSync(
        path,
        Buffer.from(
          input.bytes,
        ),
      );
    }

    return path;
  }

  get(
    projectId: string,
  ): ProjectRuntimeState | null {
    return (
      this.projects.get(projectId) ??
      null
    );
  }

  getOrCreate(
    projectId: string,
  ): ProjectRuntimeState {
    const existing =
      this.projects.get(projectId);
    if (existing) {
      return existing;
    }

    const state:
      ProjectRuntimeState = {
        projectId,
        version: 1,
        demo: false,
        schedules: [],
        evidenceDocuments: [],
        resourcesByRevision:
          new Map(),
        boq: null,
        boqRevisions: [],
        quantities: null,
        contract: null,
        contractDocuments: [],
        contractFamily: null,
        submittedManpowerPlan:
          null,
        activeEvidenceBasis: {},
        boardPublicationHistory: [],
        delayEventHistory: [],
        lastRerunReceipt: null,
        controls:
          emptyControls(),
      };

    this.projects.set(
      projectId,
      state,
    );
    this.persistSnapshot();
    return state;
  }

  replace(
    state: ProjectRuntimeState,
  ): void {
    this.projects.set(
      state.projectId,
      state,
    );
    this.persistSnapshot();
  }

  touch(
    state: ProjectRuntimeState,
  ): void {
    state.version += 1;
    this.persistSnapshot();
  }

  latestSchedule(
    projectId: string,
  ): StoredScheduleRevision | null {
    const state =
      this.projects.get(projectId);
    if (
      !state ||
      state.schedules.length === 0
    ) {
      return null;
    }

    const updates =
      state.schedules.filter(
        (item) =>
          item.role === "update",
      );
    const revisedBaselines =
      state.schedules.filter(
        (item) =>
          item.role ===
          "revised_baseline",
      );
    const baselines =
      state.schedules.filter(
        (item) =>
          item.role === "baseline",
      );
    const nonRecovery =
      state.schedules.filter(
        (item) =>
          item.role !== "recovery",
      );
    const candidates =
      updates.length > 0
        ? updates
        : revisedBaselines.length > 0
          ? revisedBaselines
          : baselines.length > 0
            ? baselines
            : nonRecovery.length > 0
              ? nonRecovery
              : state.schedules;

    return [...candidates]
      .sort((a, b) => {
        const ad =
          a.revision.model.dataDateIso ??
          a.revision.effectiveAt ??
          "";
        const bd =
          b.revision.model.dataDateIso ??
          b.revision.effectiveAt ??
          "";
        const byDate = ad.localeCompare(bd);
        return byDate !== 0
          ? byDate
          : a.revision.sequence -
              b.revision.sequence;
      })
      .at(-1) ?? null;
  }

  evidence(
    projectId: string,
  ): StoredEvidenceDocument[] {
    return [
      ...(this.projects.get(projectId)
        ?.evidenceDocuments ?? []),
    ].sort((a, b) =>
      a.uploadedAt.localeCompare(b.uploadedAt),
    );
  }

  private upsertEvidence(
    state: ProjectRuntimeState,
    document: StoredEvidenceDocument,
  ): void {
    const index =
      state.evidenceDocuments.findIndex(
        (item) =>
          item.documentId ===
          document.documentId,
      );
    if (index >= 0) {
      state.evidenceDocuments[index] =
        document;
    } else {
      state.evidenceDocuments.push(
        document,
      );
    }
  }

  private evidenceDocumentId(
    hash: string,
    relativePath: string | null,
  ): string {
    return (
      "evidence_" +
      createHash("sha256")
        .update(hash)
        .update("|")
        .update(relativePath ?? "")
        .digest("hex")
        .slice(0, 24)
    );
  }

  private activityIds(
    projectId: string,
  ): Set<string> {
    return new Set(
      this.latestSchedule(projectId)
        ?.revision.model.activities.map(
          (activity) =>
            activity.activityId,
        ) ?? [],
    );
  }

  async ingestEvidenceFile(
    input: {
      projectId: string;
      bytes: Uint8Array;
      mediaType?: string | null;
      sourceFilename: string;
      sourceRelativePath?: string | null;
      category?: string | null;
      documentType?: string | null;
      scheduleRole?: string | null;
      uploadedAt: string;
      preidentified?:
        EvidenceIdentificationResult;
    },
  ): Promise<EvidenceUploadSummary> {
    const relativePath =
      input.sourceRelativePath?.trim() ||
      input.sourceFilename;

    const identified =
      input.preidentified ??
      await identifyEvidenceDocument({
        bytes: input.bytes,
        sourceFilename:
          input.sourceFilename,
        sourceRelativePath:
          relativePath,
        declaredMediaType:
          input.mediaType,
        declaredCategory:
          input.category,
        declaredDocumentType:
          input.documentType,
      });
    const identification =
      identified.identification;
    const assertions =
      extractDocumentAssertions(
        identified.textSample,
        "evidence:" +
          input.sourceFilename,
      );
    const existingState =
      this.getOrCreate(
        input.projectId,
      );
    const lineage =
      inferEvidenceLineage({
        category:
          identification
            .detectedCategory,
        documentType:
          identification
            .detectedDocumentType,
        textSample:
          identified.textSample,
        existingDocuments:
          existingState
            .evidenceDocuments,
      });
    const category =
      identification.detectedCategory;
    const documentType =
      identification.detectedDocumentType;
    const media =
      identification.verifiedMediaType;
    const activityIds =
      this.activityIds(
        input.projectId,
      );
    const textMapping =
      analyzeTextEvidence(
        identified.textSample,
        activityIds,
      );
    const syncOcrPageLimit =
      Math.max(
        1,
        Number.parseInt(
          process.env
            .CMENG_SYNC_OCR_MAX_PAGES ??
            "20",
          10,
        ) || 20,
      );
    const deferFullOcr =
      identification.ocrUsed &&
      (
        identification.pageCount ??
        1
      ) >
        syncOcrPageLimit;

    if (category === "schedule") {
      const result =
        await this.ingestSchedule({
          projectId:
            input.projectId,
          bytes: input.bytes,
          mediaType: media,
          sourceFilename:
            input.sourceFilename,
          sourceRelativePath:
            relativePath,
          role:
            input.scheduleRole?.trim()
              ? input.scheduleRole
              : inferScheduleRole(
                  relativePath,
                  null,
                ),
          label:
            input.sourceFilename,
          uploadedAt:
            input.uploadedAt,
          identification,
          lineage,
          assertions,
        });
      const document =
        this.evidence(
          input.projectId,
        ).find(
          (item) =>
            item.linkedArtifactId ===
            result.revisionId,
        );
      if (!document) {
        throw new Error(
          "EVIDENCE_SCHEDULE_REGISTRY_MISSING",
        );
      }
      return {
        documentId:
          document.documentId,
        category:
          document.category,
        documentType:
          document.documentType,
        sourceFilename:
          document.sourceFilename,
        parserState:
          document.parserState,
        linkedArtifactId:
          document.linkedArtifactId,
        scheduleRole:
          document.scheduleRole,
        mapping:
          document.mapping,
        identification:
          document.identification,
        lineage:
          document.lineage,
        assertionCount:
          document.assertions.length,
        diagnostics: [
          ...document.diagnostics,
        ],
      };
    }

    if (
      category === "boq_cost" &&
      documentType === "boq" &&
      !deferFullOcr &&
      (
        media.includes("csv") ||
        media.includes("spreadsheet") ||
        media.includes("excel") ||
        media.includes("pdf")
      )
    ) {
      const result =
        await ingestBoq(
          {
            projectId:
              input.projectId,
            bytes: input.bytes,
            verifiedMediaType:
              media,
            receivedAt:
              input.uploadedAt,
            sourceFilename:
              input.sourceFilename,
          },
          media.includes("pdf")
            ? {
                pdf: {
                  ocrProvider:
                    this.createOcrProvider(),
                },
              }
            : {},
        );
      result.persistence =
        this.persistenceMode();
      this.attachBoq(
        result,
        input.bytes,
        input.sourceFilename,
        relativePath,
        identification,
        lineage,
        assertions,
      );
      const document =
        this.evidence(
          input.projectId,
        ).find(
          (item) =>
            item.linkedArtifactId ===
            result.ingestionId,
        );
      if (!document) {
        throw new Error(
          "EVIDENCE_BOQ_REGISTRY_MISSING",
        );
      }
      return {
        documentId:
          document.documentId,
        category:
          document.category,
        documentType:
          document.documentType,
        sourceFilename:
          document.sourceFilename,
        parserState:
          document.parserState,
        linkedArtifactId:
          document.linkedArtifactId,
        scheduleRole: null,
        mapping:
          document.mapping,
        identification:
          document.identification,
        lineage:
          document.lineage,
        assertionCount:
          document.assertions.length,
        diagnostics: [
          ...document.diagnostics,
        ],
      };
    }

    if (
      category === "contract" &&
      !deferFullOcr &&
      (
        media.includes("pdf") ||
        media.includes(
          "wordprocessingml",
        )
      )
    ) {
      const role =
        documentType ===
        "main_contract"
          ? "main"
          : documentType ===
              "contract_amendment"
            ? "amendment"
            : documentType ===
                "contract_appendix"
              ? "appendix"
              : documentType ===
                  "contract_replacement"
                ? "replacement"
                : "other";
      await this.ingestContract({
        projectId:
          input.projectId,
        bytes: input.bytes,
        mediaType: media,
        sourceFilename:
          input.sourceFilename,
        sourceRelativePath:
          relativePath,
        role,
        uploadedAt:
          input.uploadedAt,
        identification,
        lineage,
        assertions,
      });
      const hash =
        hashBytes(input.bytes);
      const document =
        this.evidence(
          input.projectId,
        ).find(
          (item) =>
            item.sourceHashSha256 ===
              hash &&
            item.category ===
              "contract",
        );
      if (!document) {
        throw new Error(
          "EVIDENCE_CONTRACT_REGISTRY_MISSING",
        );
      }
      return {
        documentId:
          document.documentId,
        category:
          document.category,
        documentType:
          document.documentType,
        sourceFilename:
          document.sourceFilename,
        parserState:
          document.parserState,
        linkedArtifactId:
          document.linkedArtifactId,
        scheduleRole: null,
        mapping:
          document.mapping,
        identification:
          document.identification,
        lineage:
          document.lineage,
        assertionCount:
          document.assertions.length,
        diagnostics: [
          ...document.diagnostics,
        ],
      };
    }

    if (
      documentType ===
        "contractor_manpower_plan" &&
      (
        media.includes("csv") ||
        media.includes("spreadsheet") ||
        media.includes("excel")
      )
    ) {
      const plan =
        await parseSubmittedManpowerPlan({
          bytes: input.bytes,
          mediaType: media,
          sourceRef:
            "evidence:" +
            input.sourceFilename,
        });
      existingState
        .submittedManpowerPlan =
        plan;

      const hash =
        hashBytes(input.bytes);
      const storedPath =
        this.persistRawUpload({
          projectId:
            input.projectId,
          category:
            "schedule_control",
          hash,
          bytes: input.bytes,
          sourceFilename:
            input.sourceFilename,
        });
      const documentId =
        this.evidenceDocumentId(
          hash,
          relativePath,
        );
      const mapping =
        media.includes("csv")
          ? analyzeCsvEvidence(
              input.bytes,
              activityIds,
            )
          : textMapping;
      const diagnostics = [
        ...identification
          .diagnostics,
        ...lineage.diagnostics,
        ...plan.diagnostics,
      ];
      const document:
        StoredEvidenceDocument = {
        documentId,
        category:
          "schedule_control",
        documentType:
          "contractor_manpower_plan",
        sourceFilename:
          input.sourceFilename,
        sourceRelativePath:
          relativePath,
        mediaType: media,
        sourceHashSha256: hash,
        sizeBytes:
          input.bytes.length,
        uploadedAt:
          input.uploadedAt,
        authority:
          "candidate_only",
        parserState:
          plan.periods.length > 0
            ? plan.diagnostics.length >
                0
              ? "partial"
              : "parsed"
            : "partial",
        storedPath,
        linkedArtifactId:
          plan.planId,
        scheduleRole: null,
        mapping,
        identification,
        lineage,
        assertions,
        diagnostics,
      };
      this.upsertEvidence(
        existingState,
        document,
      );
      this.touch(
        existingState,
      );

      return {
        documentId,
        category:
          document.category,
        documentType:
          document.documentType,
        sourceFilename:
          document.sourceFilename,
        parserState:
          document.parserState,
        linkedArtifactId:
          document.linkedArtifactId,
        scheduleRole: null,
        mapping,
        identification,
        lineage,
        assertionCount:
          document.assertions.length,
        diagnostics,
      };
    }

    const state =
      this.getOrCreate(
        input.projectId,
      );
    const hash =
      hashBytes(input.bytes);
    const storedPath =
      this.persistRawUpload({
        projectId:
          input.projectId,
        category,
        hash,
        bytes:
          input.bytes,
        sourceFilename:
          input.sourceFilename,
      });
    const mapping =
      media.includes("csv")
        ? analyzeCsvEvidence(
            input.bytes,
            activityIds,
          )
        : textMapping;
    const documentId =
      this.evidenceDocumentId(
        hash,
        relativePath,
      );
    const diagnostics = [
      ...identification
        .diagnostics,
      ...(deferFullOcr
        ? [
            "DOCUMENT_FULL_OCR_DEFERRED:" +
              (
                identification
                  .pageCount ??
                "unknown"
              ) +
              "_PAGES",
          ]
        : []),
      ...(category ===
        "contract" &&
      media.startsWith(
        "image/",
      )
        ? [
            "CONTRACT_IMAGE_IDENTIFIED_FROM_OCR;SPECIALIST_CLAUSE_PARSE_PENDING",
          ]
        : []),
    ];
    const parserState =
      deferFullOcr
        ? "ocr_pending" as const
        : identification
            .method ===
          "unreadable"
          ? "error" as const
          : identification
              .needsReview
            ? "partial" as const
            : mapping
              ? "parsed" as const
              : "identified" as const;

    const document:
      StoredEvidenceDocument = {
      documentId,
      category,
      documentType,
      sourceFilename:
        input.sourceFilename,
      sourceRelativePath:
        relativePath,
      mediaType: media,
      sourceHashSha256: hash,
      sizeBytes:
        input.bytes.length,
      uploadedAt:
        input.uploadedAt,
      authority:
        "candidate_only",
      parserState,
      storedPath,
      linkedArtifactId: null,
      scheduleRole: null,
      mapping,
      identification,
      lineage,
      assertions,
      diagnostics,
    };
    this.upsertEvidence(
      state,
      document,
    );
    this.touch(state);
    return {
      documentId,
      category:
        document.category,
      documentType:
        document.documentType,
      sourceFilename:
        document.sourceFilename,
      parserState:
        document.parserState,
      linkedArtifactId: null,
      scheduleRole: null,
      mapping,
      identification:
        document.identification,
      lineage:
        document.lineage,
      assertionCount:
        document.assertions.length,
      diagnostics,
    };
  }

  async ingestSchedule(
    input: {
      projectId: string;
      bytes: Uint8Array;
      mediaType: string;
      sourceFilename?: string | null;
      sourceRelativePath?: string | null;
      role?: string | null;
      label?: string | null;
      uploadedAt: string;
      identification?:
        EvidenceIdentification;
      lineage?:
        EvidenceLineage;
      assertions?:
        DocumentAssertion[];
    },
  ): Promise<ScheduleUploadSummary> {
    const state =
      this.getOrCreate(
        input.projectId,
      );
    const hash =
      hashBytes(input.bytes);
    const identification =
      input.identification ??
      (
        await identifyEvidenceDocument({
          bytes:
            input.bytes,
          sourceFilename:
            input.sourceFilename ??
            "schedule",
          sourceRelativePath:
            input.sourceRelativePath ??
            input.sourceFilename ??
            null,
          declaredMediaType:
            input.mediaType,
          declaredCategory:
            "schedule",
          declaredDocumentType:
            null,
        })
      ).identification;

    const assertions =
      input.assertions ??
      [];

    const lineage =
      input.lineage ??
      inferEvidenceLineage({
        category: "schedule",
        documentType:
          input.role === "baseline"
            ? "schedule_baseline"
            : input.role === "recovery"
              ? "schedule_recovery"
              : input.role ===
                  "revised_baseline"
                ? "schedule_revised_baseline"
                : "schedule_update",
        textSample: "",
        existingDocuments:
          state.evidenceDocuments,
      });

    const existing =
      state.schedules.find(
        (item) =>
          item.sourceHashSha256 ===
          hash,
      );
    if (existing) {
      return summary(
        existing,
        state.resourcesByRevision,
      );
    }

    const format =
      scheduleFormat(
        input.bytes,
        input.sourceFilename,
        input.mediaType,
      );
    const revisionId =
      "schedrev_" +
      hash.slice(0, 24);
    const sequence =
      state.schedules.length === 0
        ? 1
        : Math.max(
            ...state.schedules.map(
              (item) =>
                item.revision
                  .sequence,
            ),
          ) + 1;

    let model;
    let resourceModel:
      ReturnType<
        typeof canonicalResourcesFromXer
      > | null = null;

    if (format === "xer") {
      const parsed =
        parseXerBytes(
          input.bytes,
        );
      model =
        canonicalScheduleFromXer(
          parsed,
          {
            sourceRevisionId:
              revisionId,
            projectId:
              input.projectId,
          },
        );
      resourceModel =
        canonicalResourcesFromXer(
          parsed,
          {
            sourceRevisionId:
              revisionId,
            projectId:
              input.projectId,
          },
        );
    } else if (
      format ===
      "primavera_xml"
    ) {
      model =
        canonicalScheduleFromPrimaveraXml(
          parsePrimaveraXml(
            input.bytes,
          ),
          {
            sourceRevisionId:
              revisionId,
            projectId:
              input.projectId,
          },
        );
    } else if (
      format ===
      "schedule_xlsx"
    ) {
      model =
        canonicalScheduleFromTabular(
          await parseScheduleXlsx(
            input.bytes,
          ),
          {
            sourceRevisionId:
              revisionId,
            projectId:
              input.projectId,
          },
        );
    } else {
      model =
        canonicalScheduleFromTabular(
          parseScheduleCsv(
            input.bytes,
          ),
          {
            sourceRevisionId:
              revisionId,
            projectId:
              input.projectId,
          },
        );
    }

    const stored:
      StoredScheduleRevision = {
      revision: {
        revisionId,
        label:
          input.label?.trim() ||
          input.sourceFilename?.trim() ||
          "Schedule revision " +
            sequence,
        sequence,
        effectiveAt:
          model.dataDateIso ??
          input.uploadedAt,
        model,
      },
      format,
      sourceFilename:
        input.sourceFilename?.trim() ||
        null,
      sourceHashSha256: hash,
      uploadedAt:
        input.uploadedAt,
      role:
        scheduleRole(
          input.role,
        ),
    };

    state.schedules.push(
      stored,
    );

    if (resourceModel) {
      state.resourcesByRevision.set(
        revisionId,
        resourceModel,
      );
    }

    if (state.quantities) {
      state.quantities = {
        ...state.quantities,
        scheduleRevisionId:
          revisionId,
      };
    }

    const storedPath =
      this.persistRawUpload({
        projectId:
          input.projectId,
        category: "schedule",
        hash,
        bytes: input.bytes,
        sourceFilename:
          input.sourceFilename ??
          null,
      });

    this.upsertEvidence(
      state,
      {
        documentId:
          this.evidenceDocumentId(
            hash,
            input.sourceRelativePath ??
              input.sourceFilename ??
              null,
          ),
        category: "schedule",
        documentType:
          stored.role === "baseline"
            ? "schedule_baseline"
            : stored.role === "recovery"
              ? "schedule_recovery"
              : stored.role ===
                  "revised_baseline"
                ? "schedule_revised_baseline"
                : "schedule_update",
        sourceFilename:
          input.sourceFilename?.trim() ||
          "schedule",
        sourceRelativePath:
          input.sourceRelativePath?.trim() ||
          input.sourceFilename?.trim() ||
          null,
        mediaType:
          identification
            .verifiedMediaType,
        sourceHashSha256: hash,
        sizeBytes:
          input.bytes.length,
        uploadedAt:
          input.uploadedAt,
        authority:
          "candidate_only",
        parserState:
          "parsed",
        storedPath,
        linkedArtifactId:
          revisionId,
        scheduleRole:
          stored.role,
        mapping: null,
        identification,
        lineage,
        assertions,
        diagnostics: [
          ...identification
            .diagnostics,
          ...model.diagnostics,
        ],
      },
    );

    this.touch(state);

    return summary(
      stored,
      state.resourcesByRevision,
    );
  }

  attachBoq(
    result: BoqIngestionResult,
    bytes?: Uint8Array,
    sourceFilename?:
      | string
      | null,
    sourceRelativePath?:
      | string
      | null,
    identification?:
      EvidenceIdentification,
    lineage?:
      EvidenceLineage,
    assertions:
      DocumentAssertion[] = [],
  ): void {
    const state =
      this.getOrCreate(
        result.projectId,
      );
    const latest =
      this.latestSchedule(
        result.projectId,
      );

    const boqLineage =
      lineage ??
      inferEvidenceLineage({
        category: "boq_cost",
        documentType: "boq",
        textSample: "",
        existingDocuments:
          state.evidenceDocuments,
      });

    // Preserve the established BOQ basis. Later revised or replacement
    // documents remain candidate evidence until explicitly promoted.
    if (!state.boq) {
      state.boq = result;
    }
    const existingBoqIndex =
      state.boqRevisions.findIndex(
        (item) =>
          item.ingestionId ===
          result.ingestionId,
      );
    if (existingBoqIndex >= 0) {
      state.boqRevisions[
        existingBoqIndex
      ] = result;
    } else {
      state.boqRevisions.push(
        result,
      );
    }
    if (
      state.boq?.ingestionId ===
      result.ingestionId
    ) {
      state.quantities =
        quantityModelFromBoq(
          result,
          latest?.revision
            .revisionId ?? "",
          state.quantities,
        );
    }

    if (bytes) {
      const storedPath =
        this.persistRawUpload({
          projectId:
            result.projectId,
          category: "boq_cost",
          hash:
            result.sourceHashSha256,
          bytes,
          sourceFilename:
            sourceFilename ??
            result.sourceFilename,
        });
      this.upsertEvidence(
        state,
        {
          documentId:
            this.evidenceDocumentId(
              result.sourceHashSha256,
              sourceRelativePath ??
                sourceFilename ??
                result.sourceFilename,
            ),
          category: "boq_cost",
          documentType: "boq",
          sourceFilename:
            sourceFilename ??
            result.sourceFilename ??
            "boq",
          sourceRelativePath:
            sourceRelativePath ??
            sourceFilename ??
            result.sourceFilename,
          mediaType:
            result.mediaType,
          sourceHashSha256:
            result.sourceHashSha256,
          sizeBytes:
            bytes.length,
          uploadedAt:
            result.receivedAt,
          authority:
            "candidate_only",
          parserState:
            result.complete
              ? "parsed"
              : "partial",
          storedPath,
          linkedArtifactId:
            result.ingestionId,
          scheduleRole: null,
          mapping: null,
          identification:
            identification ??
            specialistIdentification({
              mediaType:
                result.mediaType,
              category:
                "boq_cost",
              documentType:
                "boq",
              sourceFilename:
                sourceFilename ??
                result.sourceFilename,
              diagnostics:
                result.diagnostics,
            }),
          lineage:
            boqLineage,
          assertions,
          diagnostics: [
            ...(identification
              ?.diagnostics ?? []),
            ...boqLineage.diagnostics,
            ...result.diagnostics,
          ],
        },
      );
    }

    this.touch(state);
  }

  setQuantityModel(
    projectId: string,
    quantities:
      CanonicalQuantityProgressModel,
  ): void {
    const state =
      this.getOrCreate(projectId);
    state.quantities =
      quantities;
    this.touch(state);
  }

  async ingestContract(
    input: {
      projectId: string;
      bytes: Uint8Array;
      mediaType: string;
      sourceFilename?: string | null;
      sourceRelativePath?: string | null;
      role?:
        | "main"
        | "amendment"
        | "appendix"
        | "tender"
        | "replacement"
        | "other";
      uploadedAt?: string;
      identification?:
        EvidenceIdentification;
      lineage?:
        EvidenceLineage;
      assertions?:
        DocumentAssertion[];
    },
  ): Promise<ContractDocumentResult> {
    const name =
      normalizedFilename(
        input.sourceFilename,
      );
    const isPdf =
      name.endsWith(".pdf") ||
      input.mediaType
        .toLowerCase()
        .includes("pdf") ||
      startsWith(
        input.bytes,
        "%PDF-",
      );

    const isDocx =
      name.endsWith(".docx") ||
      input.mediaType
        .toLowerCase()
        .includes(
          "wordprocessingml",
        );

    if (!isPdf && !isDocx) {
      throw new Error(
        "CONTRACT_MEDIA_UNSUPPORTED",
      );
    }

    const identification =
      input.identification ??
      (
        await identifyEvidenceDocument({
          bytes:
            input.bytes,
          sourceFilename:
            input.sourceFilename ??
            "contract",
          sourceRelativePath:
            input.sourceRelativePath ??
            input.sourceFilename ??
            null,
          declaredMediaType:
            input.mediaType,
          declaredCategory:
            "contract",
          declaredDocumentType:
            null,
        })
      ).identification;

    const parsed = isPdf
      ? await parseContractPdf(
          input.bytes,
          {
            ocrProvider:
              this.createOcrProvider(),
          },
        )
      : await parseContractDocx(
          input.bytes,
        );

    const state =
      this.getOrCreate(
        input.projectId,
      );
    const assertions =
      input.assertions ??
      [];

    const lineage =
      input.lineage ??
      inferEvidenceLineage({
        category: "contract",
        documentType:
          input.role === "amendment"
            ? "contract_amendment"
            : input.role === "replacement"
              ? "contract_replacement"
              : input.role === "appendix"
                ? "contract_appendix"
                : "main_contract",
        textSample: "",
        existingDocuments:
          state.evidenceDocuments,
      });
    const hash =
      hashBytes(input.bytes);
    const role =
      input.role ?? "other";
    const documentId =
      this.evidenceDocumentId(
        hash,
        input.sourceRelativePath ??
          input.sourceFilename ??
          null,
      );
    const storedContract = {
      documentId,
      role,
      sourceFilename:
        input.sourceFilename?.trim() ||
        null,
      sourceHashSha256: hash,
      uploadedAt:
        input.uploadedAt ??
        new Date().toISOString(),
      lineage,
      result: parsed,
    };
    const contractIndex =
      state.contractDocuments.findIndex(
        (item) =>
          item.documentId ===
          documentId,
      );
    if (contractIndex >= 0) {
      state.contractDocuments[
        contractIndex
      ] = storedContract;
    } else {
      state.contractDocuments.push(
        storedContract,
      );
    }

    const base =
      [...state.contractDocuments]
        .filter(
          (item) =>
            item.role === "main" &&
            item.lineage.effect !==
              "full_replacement",
        )
        .sort((a, b) =>
          a.uploadedAt.localeCompare(
            b.uploadedAt,
          ),
        )
        .at(0) ??
      state.contractDocuments.find(
        (item) =>
          item.role !== "amendment" &&
          item.role !== "replacement",
      ) ??
      storedContract;
    state.contract =
      base.result;
    const amendments =
      state.contractDocuments
        .filter(
          (item) =>
            item.role ===
            "amendment",
        )
        .map(
          (item) => item.result,
        );
    state.contractFamily =
      base
        ? linkContractFamily(
            base.result,
            amendments,
          )
        : null;

    const storedPath =
      this.persistRawUpload({
        projectId:
          input.projectId,
        category: "contract",
        hash,
        bytes: input.bytes,
        sourceFilename:
          input.sourceFilename ??
          null,
      });

    this.upsertEvidence(
      state,
      {
        documentId,
        category: "contract",
        documentType:
          role === "main"
            ? "main_contract"
            : role === "amendment"
              ? "contract_amendment"
              : role === "appendix"
                ? "contract_appendix"
                : role === "tender"
                  ? "tender_contract_document"
                  : role === "replacement"
                    ? "contract_replacement"
                    : "contract_supporting_document",
        sourceFilename:
          input.sourceFilename?.trim() ||
          "contract",
        sourceRelativePath:
          input.sourceRelativePath?.trim() ||
          input.sourceFilename?.trim() ||
          null,
        mediaType:
          identification
            .verifiedMediaType,
        sourceHashSha256: hash,
        sizeBytes:
          input.bytes.length,
        uploadedAt:
          storedContract.uploadedAt,
        authority:
          "candidate_only",
        parserState:
          parsed.complete
            ? "parsed"
            : "partial",
        storedPath,
        linkedArtifactId:
          documentId,
        scheduleRole: null,
        mapping: null,
        identification,
        lineage,
        assertions,
        diagnostics: [
          ...identification
            .diagnostics,
          ...lineage.diagnostics,
          ...parsed.diagnostics,
          ...(state.contractFamily
            ?.diagnostics ?? []),
        ],
      },
    );

    this.touch(state);
    return parsed;
  }

  updateControls(
    projectId: string,
    update:
      Partial<ProjectControlState>,
  ): ProjectControlState {
    const state =
      this.getOrCreate(projectId);

    state.controls = {
      ...state.controls,
      ...update,
      readinessEvidence:
        update.readinessEvidence ??
        state.controls
          .readinessEvidence,
      progressEvidence:
        update.progressEvidence ??
        state.controls
          .progressEvidence,
      variations:
        update.variations ??
        state.controls.variations,
      invoices:
        update.invoices ??
        state.controls.invoices,
      retentions:
        update.retentions ??
        state.controls.retentions,
      bonds:
        update.bonds ??
        state.controls.bonds,
      claimCommercials:
        update.claimCommercials ??
        state.controls
          .claimCommercials,
      hseIncidents:
        update.hseIncidents ??
        state.controls
          .hseIncidents,
      ncrs:
        update.ncrs ??
        state.controls.ncrs,
      rfis:
        update.rfis ??
        state.controls.rfis,
      permits:
        update.permits ??
        state.controls.permits,
    };

    this.touch(state);
    return state.controls;
  }

  setDemo(
    projectId: string,
    demo: boolean,
  ): void {
    const state =
      this.getOrCreate(projectId);
    state.demo = demo;
    this.touch(state);
  }
}

export const runtimeProjects =
  new RuntimeProjectStore();
