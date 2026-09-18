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
import type {
  CanonicalQuantityProgressModel,
} from "../../quantity-progress-core/src";
import type {
  CanonicalResourceModel,
} from "../../schedule-resource-core/src";
import type {
  EvidenceCategory,
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
  inferDocumentType,
  inferEvidenceCategory,
  inferMediaType,
  inferScheduleRole,
} from "./evidence";

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

function hydrateProject(
  state: SerializedProjectState,
): ProjectRuntimeState {
  const legacy = state as SerializedProjectState &
    Partial<ProjectRuntimeState>;
  return {
    ...state,
    evidenceDocuments:
      legacy.evidenceDocuments ?? [],
    boqRevisions:
      legacy.boqRevisions ??
      (legacy.boq ? [legacy.boq] : []),
    contractDocuments:
      legacy.contractDocuments ?? [],
    contractFamily:
      legacy.contractFamily ?? null,
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

    const official = state.schedules.filter(
      (item) =>
        item.role === "update" ||
        item.role === "revised_baseline",
    );
    const baseline = state.schedules.filter(
      (item) => item.role === "baseline",
    );
    const candidates =
      official.length > 0
        ? official
        : baseline.length > 0
          ? baseline
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
    },
  ): Promise<EvidenceUploadSummary> {
    const relativePath =
      input.sourceRelativePath?.trim() ||
      input.sourceFilename;
    const category =
      inferEvidenceCategory(
        relativePath,
        input.category,
      );
    const documentType =
      inferDocumentType(
        relativePath,
        input.documentType,
      );
    const media =
      inferMediaType(
        relativePath,
        input.mediaType,
      );

    if (category === "schedule") {
      const result =
        await this.ingestSchedule({
          projectId: input.projectId,
          bytes: input.bytes,
          mediaType: media,
          sourceFilename:
            input.sourceFilename,
          sourceRelativePath:
            relativePath,
          role:
            inferScheduleRole(
              relativePath,
              input.scheduleRole,
            ),
          label:
            input.sourceFilename,
          uploadedAt:
            input.uploadedAt,
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
        diagnostics: [
          ...document.diagnostics,
        ],
      };
    }

    if (
      category === "boq_cost" &&
      documentType === "boq" &&
      (
        media.includes("csv") ||
        media.includes("spreadsheet") ||
        media.includes("excel") ||
        media.includes("pdf")
      )
    ) {
      const result = await ingestBoq({
        projectId:
          input.projectId,
        bytes: input.bytes,
        verifiedMediaType: media,
        receivedAt:
          input.uploadedAt,
        sourceFilename:
          input.sourceFilename,
      });
      result.persistence =
        this.persistenceMode();
      this.attachBoq(
        result,
        input.bytes,
        input.sourceFilename,
        relativePath,
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
        diagnostics: [
          ...document.diagnostics,
        ],
      };
    }

    if (
      category === "contract" &&
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
        diagnostics: [
          ...document.diagnostics,
        ],
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
        bytes: input.bytes,
        sourceFilename:
          input.sourceFilename,
      });
    const mapping =
      media.includes("csv")
        ? analyzeCsvEvidence(
            input.bytes,
            this.activityIds(
              input.projectId,
            ),
          )
        : null;
    const documentId =
      this.evidenceDocumentId(
        hash,
        relativePath,
      );
    const document:
      StoredEvidenceDocument = {
      documentId,
      category:
        category as EvidenceCategory,
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
      parserState:
        mapping
          ? "parsed"
          : "stored",
      storedPath,
      linkedArtifactId: null,
      scheduleRole: null,
      mapping,
      diagnostics: [],
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
      diagnostics: [],
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
    },
  ): Promise<ScheduleUploadSummary> {
    const state =
      this.getOrCreate(
        input.projectId,
      );
    const hash =
      hashBytes(input.bytes);

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
          input.mediaType,
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
        diagnostics: [
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
  ): void {
    const state =
      this.getOrCreate(
        result.projectId,
      );
    const latest =
      this.latestSchedule(
        result.projectId,
      );

    state.boq = result;
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
    state.quantities =
      quantityModelFromBoq(
        result,
        latest?.revision
          .revisionId ?? "",
        state.quantities,
      );

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
          diagnostics: [
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
        | "other";
      uploadedAt?: string;
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

    const parsed = isPdf
      ? await parseContractPdf(
          input.bytes,
        )
      : await parseContractDocx(
          input.bytes,
        );

    const state =
      this.getOrCreate(
        input.projectId,
      );
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
            item.role === "main",
        )
        .sort((a, b) =>
          a.uploadedAt.localeCompare(
            b.uploadedAt,
          ),
        )
        .at(-1) ??
      state.contractDocuments.find(
        (item) =>
          item.role !== "amendment",
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
                  : "contract_supporting_document",
        sourceFilename:
          input.sourceFilename?.trim() ||
          "contract",
        sourceRelativePath:
          input.sourceRelativePath?.trim() ||
          input.sourceFilename?.trim() ||
          null,
        mediaType:
          input.mediaType,
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
        diagnostics: [
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
