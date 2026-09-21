import { synchronizeCanonicalTimeClaims } from "./canonical-time-claims";
import { migrateTypedEvidenceFamilies } from "./typed-evidence-families";
import {
  createHash,
  randomUUID,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import {
  extname,
  join,
} from "node:path";
import { PDFParse } from "pdf-parse";

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
  EvidenceTextSegment,
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
  cell,
  governedTables,
} from "../../truth-kernel/src";
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
  rebuildEvidenceFamily,
} from "./evidence-control";
import {
  deriveReadinessFromCsv,
  rebuildReadinessEvidence,
} from "./evidence-readiness";
import {
  deriveControlsFromCsv,
  rebuildDerivedControls,
} from "./evidence-control-adapters";

function completionDateFromText(
  text: string,
): string | null {
  if (
    !/(?:revised\s+)?(?:date\s+for\s+)?completion|time\s+for\s+completion/i.test(
      text,
    )
  ) {
    return null;
  }

  const isoMatch =
    /\b(20\d{2})[-\/.](0?[1-9]|1[0-2])[-\/.](0?[1-9]|[12]\d|3[01])\b/.exec(
      text,
    );
  if (isoMatch) {
    const [, year, month, day] =
      isoMatch;
    return [
      year,
      month!.padStart(2, "0"),
      day!.padStart(2, "0"),
    ].join("-");
  }

  const dayMonthYear =
    /\b(0?[1-9]|[12]\d|3[01])\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i.exec(
      text,
    );
  if (dayMonthYear) {
    const parsed = Date.parse(
      dayMonthYear[0],
    );
    if (Number.isFinite(parsed)) {
      return new Date(parsed)
        .toISOString()
        .slice(0, 10);
    }
  }

  const monthDayYear =
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(0?[1-9]|[12]\d|3[01]),?\s+(20\d{2})\b/i.exec(
      text,
    );
  if (monthDayYear) {
    const parsed = Date.parse(
      monthDayYear[0],
    );
    if (Number.isFinite(parsed)) {
      return new Date(parsed)
        .toISOString()
        .slice(0, 10);
    }
  }

  const numeric =
    /\b(0?[1-9]|[12]\d|3[01])[\/-](0?[1-9]|1[0-2])[\/-](20\d{2})\b/.exec(
      text,
    );
  if (numeric) {
    const [, day, month, year] =
      numeric;
    return [
      year,
      month!.padStart(2, "0"),
      day!.padStart(2, "0"),
    ].join("-");
  }

  return null;
}

function promoteContractTimeBasis(
  state: ProjectRuntimeState,
): void {
  const candidates =
    state.contractDocuments
      .filter((document) => {
        const evidence =
          state.evidenceDocuments.find(
            (item) =>
              item.documentId ===
              document.documentId,
          );
        return (
          evidence?.basisState ===
            "active" ||
          evidence?.basisState ===
            "additive"
        );
      })
      .flatMap((document) =>
        document.result.sections.flatMap(
          (section) => {
            const date =
              completionDateFromText(
                [
                  section.heading ?? "",
                  section.text,
                ].join("\n"),
              );
            return date
              ? [
                  {
                    date,
                    documentId:
                      document.documentId,
                    sectionKey:
                      section.sectionKey,
                    uploadedAt:
                      document.uploadedAt,
                    role:
                      document.role,
                  },
                ]
              : [];
          },
        ),
      )
      .sort((a, b) => {
        const priority = (
          role:
            ProjectRuntimeState["contractDocuments"][number]["role"],
        ) =>
          role === "amendment"
            ? 3
            : role === "replacement"
              ? 2
              : role === "main"
                ? 1
                : 0;
        return (
          priority(a.role) -
            priority(b.role) ||
          a.uploadedAt.localeCompare(
            b.uploadedAt,
          )
        );
      });

  const selected =
    candidates.at(-1);
  if (!selected) return;

  const current =
    state.controls
      .contractTimeBasis;

  state.controls
    .contractTimeBasis = {
    contractualCompletionIso:
      selected.date,
    contractualCompletionState:
      "official",
    officialApprovedEotDays:
      current
        ?.officialApprovedEotDays ??
      null,
    officialApprovedEotState:
      current
        ?.officialApprovedEotState ??
      "missing",
    eotDayBasis:
      current
        ?.eotDayBasis ??
      "unknown",
    eotDayBasisState:
      current
        ?.eotDayBasisState ??
      "missing",
    sourceRefs: [
      ...new Set([
        ...(
          current
            ?.sourceRefs ??
          []
        ).filter(
          (ref) =>
            !ref.includes(
              ":contract-completion:",
            ),
        ),
        "evidence-document:" +
          selected.documentId +
          ":contract-completion:" +
          selected.sectionKey,
      ]),
    ],
  };
}

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
    risks: [],
    boardPublication: null,
  };
}

function normalizeControls(
  controls:
    | Partial<ProjectControlState>
    | null
    | undefined,
): ProjectControlState {
  const base = emptyControls();
  const value = controls ?? {};
  return {
    ...base,
    ...value,
    delayClaims:
      value.delayClaims ?? null,
    contractTimeBasis:
      value.contractTimeBasis ?? null,
    readinessEvidence:
      value.readinessEvidence ?? {},
    progressEvidence:
      value.progressEvidence ?? {},
    contractValue:
      value.contractValue ?? null,
    variations:
      Array.isArray(value.variations)
        ? value.variations
        : [],
    invoices:
      Array.isArray(value.invoices)
        ? value.invoices
        : [],
    retentions:
      Array.isArray(value.retentions)
        ? value.retentions
        : [],
    bonds:
      Array.isArray(value.bonds)
        ? value.bonds
        : [],
    claimCommercials:
      Array.isArray(
        value.claimCommercials,
      )
        ? value.claimCommercials
        : [],
    hseIncidents:
      Array.isArray(value.hseIncidents)
        ? value.hseIncidents
        : [],
    ncrs:
      Array.isArray(value.ncrs)
        ? value.ncrs
        : [],
    rfis:
      Array.isArray(value.rfis)
        ? value.rfis
        : [],
    permits:
      Array.isArray(value.permits)
        ? value.permits
        : [],
    risks:
      Array.isArray(value.risks)
        ? value.risks
        : [],
    boardPublication:
      value.boardPublication ?? null,
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
  const legacy =
    state as SerializedProjectState &
      Partial<ProjectRuntimeState>;

  const affectedFamilies =
    new Set<string>();
  const legacySupportScheduleArtifactIds =
    new Set<string>();
  const scheduleSupportTypes =
    new Set([
      "schedule_control_basis",
      "schedule_metric_register",
      "schedule_activity_comparison",
      "longest_path_register",
      "resource_register",
      "wbs_dictionary",
      "obs_responsibility_matrix",
      "project_data_book",
    ]);

  const evidenceDocuments:
    StoredEvidenceDocument[] =
    (
      legacy.evidenceDocuments ??
      []
    ).map((document) => {
      const baseFamily =
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
        });

      const hydrated:
        StoredEvidenceDocument = {
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
        textSegments:
          document.textSegments ??
          [],
        uploadIntent:
          document.uploadIntent ??
          "add_update",
        familyKey:
          document.familyKey ??
          baseFamily.familyKey,
        logicalDocumentKey:
          document.logicalDocumentKey ??
          baseFamily
            .logicalDocumentKey,
        basisState:
          document.basisState ??
          "historical",
        supersededByDocumentId:
          document
            .supersededByDocumentId ??
          null,
        supersedesDocumentIds:
          document
            .supersedesDocumentIds ??
          [],
      };

      const sourcePath =
        hydrated
          .sourceRelativePath ??
        hydrated.sourceFilename;
      const inferredCategory =
        inferEvidenceCategory(
          sourcePath,
          null,
        );
      const inferredDocumentType =
        inferDocumentType(
          sourcePath,
          null,
        );

      const legacyScheduleSupport =
        hydrated.category ===
          "schedule" &&
        inferredCategory ===
          "schedule_control" &&
        scheduleSupportTypes.has(
          inferredDocumentType,
        );

      if (!legacyScheduleSupport) {
        return hydrated;
      }

      affectedFamilies.add(
        hydrated.familyKey,
      );
      if (
        hydrated.linkedArtifactId
      ) {
        legacySupportScheduleArtifactIds.add(
          hydrated.linkedArtifactId,
        );
      }

      const migratedFamily =
        evidenceFamily({
          category:
            "schedule_control",
          documentType:
            inferredDocumentType,
          scheduleRole: null,
          textSample: "",
          sourceFilename:
            hydrated
              .sourceFilename,
        });
      affectedFamilies.add(
        migratedFamily.familyKey,
      );

      return {
        ...hydrated,
        category:
          "schedule_control",
        documentType:
          inferredDocumentType,
        linkedArtifactId: null,
        scheduleRole: null,
        familyKey:
          migratedFamily.familyKey,
        logicalDocumentKey:
          migratedFamily
            .logicalDocumentKey,
        basisState: "candidate",
        supersededByDocumentId:
          null,
        supersedesDocumentIds: [],
        identification: {
          ...hydrated
            .identification,
          detectedCategory:
            "schedule_control",
          detectedDocumentType:
            inferredDocumentType,
          filenameHintCategory:
            "schedule_control",
          filenameHintDocumentType:
            inferredDocumentType,
          classificationConflict:
            false,
        },
        lineage: {
          ...hydrated.lineage,
          effect:
            "revision_snapshot",
          replacesEntireBasis:
            false,
          appliesAsDelta:
            false,
          inferred: true,
          confidence:
            Math.max(
              hydrated.lineage
                .confidence,
              0.8,
            ),
          diagnostics: [
            ...new Set([
              ...hydrated
                .lineage
                .diagnostics,
              "LEGACY_SCHEDULE_SUPPORT_RECLASSIFIED",
            ]),
          ],
        },
        diagnostics: [
          ...new Set([
            ...hydrated
              .diagnostics,
            "LEGACY_SCHEDULE_SUPPORT_RECLASSIFIED",
          ]),
        ],
      };
    });

  const resourcesByRevision =
    new Map(
      state.resourcesByRevision ??
        [],
    );
  for (
    const artifactId of
      legacySupportScheduleArtifactIds
  ) {
    resourcesByRevision.delete(
      artifactId,
    );
  }

  const hydrated:
    ProjectRuntimeState = {
    ...state,
    schedules:
      (
        legacy.schedules ??
        []
      ).filter(
        (item) =>
          !legacySupportScheduleArtifactIds.has(
            item.revision
              .revisionId,
          ),
      ),
    evidenceDocuments,
    boqRevisions:
      legacy.boqRevisions ??
      (
        legacy.boq
          ? [legacy.boq]
          : []
      ),
    contractDocuments:
      legacy.contractDocuments ??
      [],
    contractFamily:
      legacy.contractFamily ??
      null,
    submittedManpowerPlan:
      legacy.submittedManpowerPlan ??
      null,
    activeEvidenceBasis: {
      ...(
        legacy.activeEvidenceBasis ??
        {}
      ),
    },
    boardPublicationHistory:
      (
        legacy
          .boardPublicationHistory ??
        []
      ).map(
        (item) => ({
          ...item,
          reportSnapshot:
            item.reportSnapshot ??
            null,
        }),
      ),
    delayEventHistory:
      legacy.delayEventHistory ??
      [],
    derivedControlsByDocument:
      legacy
        .derivedControlsByDocument ??
      {},
    derivedReadinessByDocument:
      legacy
        .derivedReadinessByDocument ??
      {},
    lastRerunReceipt:
      legacy.lastRerunReceipt ??
      null,
    controls:
      normalizeControls(
        legacy.controls,
      ),
    resourcesByRevision,
  };

  for (
    const familyKey of
      affectedFamilies
  ) {
    rebuildEvidenceFamily(
      hydrated,
      familyKey,
    );
  }

  return hydrated;
}

export function normalizeProjectCode(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function isProgrammeScheduleRevision(
  item: StoredScheduleRevision,
): boolean {
  if (
    item.revision.model
      .activities.length === 0
  ) {
    return false;
  }

  const filename =
    (
      item.sourceFilename ??
      ""
    ).toLowerCase();

  if (
    /^(?:rel\d*|res\d*|sch\d*|wbs\d*|obs\d*|pdb\d*)[_-]/i.test(
      filename,
    ) ||
    /(?:longest[_ -]?path|baseline[_ -]?to[_ -]?current|schedule[_ -]?comparison|resource[_ -]?register|wbs[_ -]?dictionary)/i.test(
      filename,
    )
  ) {
    return false;
  }

  if (
    item.role === "baseline" ||
    item.role === "update" ||
    item.role ===
      "revised_baseline" ||
    item.role === "recovery"
  ) {
    return true;
  }

  return (
    item.format === "xer" ||
    item.format ===
      "primavera_xml" ||
    item.revision.model
      .dataDateIso !== null ||
    item.revision.model
      .relationships.length > 0
  );
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
        const migrated = migrateTypedEvidenceFamilies(state, applyEvidenceBasis);
        let controlBasisMigrated = false;
        const requiresV5GovernanceMigration =
          state.sourceIntegrationVersion !==
          "canonical-source-v5";

        if (requiresV5GovernanceMigration) {
          const controlFamily =
            "schedule_control:schedule_control_basis";
          const sch01Documents =
            state.evidenceDocuments.filter(
              (document) => {
                const sourcePath =
                  document.sourceRelativePath ??
                  document.sourceFilename;
                return (
                  document.documentType ===
                    "schedule_control_basis" ||
                  inferDocumentType(
                    sourcePath,
                    null,
                  ) ===
                    "schedule_control_basis"
                );
              },
            );

          for (const document of sch01Documents) {
            const sourcePath =
              document.sourceRelativePath ??
              document.sourceFilename;
            const inferredCategory =
              inferEvidenceCategory(
                sourcePath,
                null,
              );
            const inferredType =
              inferDocumentType(
                sourcePath,
                null,
              );

            if (
              document.category !==
                "schedule_control" ||
              document.documentType !==
                "schedule_control_basis" ||
              document.familyKey !==
                controlFamily ||
              document.logicalDocumentKey !==
                controlFamily
            ) {
              document.category =
                "schedule_control";
              document.documentType =
                "schedule_control_basis";
              document.familyKey =
                controlFamily;
              document.logicalDocumentKey =
                controlFamily;
              document.scheduleRole =
                null;
              document.linkedArtifactId =
                null;
              document.identification = {
                ...document.identification,
                detectedCategory:
                  "schedule_control",
                detectedDocumentType:
                  "schedule_control_basis",
                filenameHintCategory:
                  inferredCategory ===
                  "schedule_control"
                    ? inferredCategory
                    : "schedule_control",
                filenameHintDocumentType:
                  inferredType ===
                  "schedule_control_basis"
                    ? inferredType
                    : "schedule_control_basis",
                classificationConflict:
                  false,
              };
              if (
                !document.diagnostics.includes(
                  "SCHEDULE_CONTROL_BASIS_METADATA_MIGRATION_V5",
                )
              ) {
                document.diagnostics.push(
                  "SCHEDULE_CONTROL_BASIS_METADATA_MIGRATION_V5",
                );
              }
              controlBasisMigrated =
                true;
            }
          }

          if (sch01Documents.length > 0) {
            const currentActive =
              state.activeEvidenceBasis[
                controlFamily
              ]?.activeDocumentId ??
              null;
            const hasGovernedActive =
              sch01Documents.some(
                (document) =>
                  document.documentId ===
                    currentActive &&
                  document.basisState ===
                    "active",
              );

            if (!hasGovernedActive) {
              rebuildEvidenceFamily(
                state,
                controlFamily,
              );
              controlBasisMigrated =
                true;
            }

            for (const document of sch01Documents) {
              if (
                !document.diagnostics.includes(
                  "SCHEDULE_CONTROL_BASIS_GOVERNANCE_MIGRATION_V5",
                )
              ) {
                document.diagnostics.push(
                  "SCHEDULE_CONTROL_BASIS_GOVERNANCE_MIGRATION_V5",
                );
              }
            }
          }
        }

        if (
          migrated ||
          controlBasisMigrated ||
          requiresV5GovernanceMigration
        ) {
          state.sourceIntegrationVersion =
            "canonical-source-v5";
          state.version += 1;
          this.staleFinalizedBoardPublications(state);
          state.lastRerunReceipt = null;
        }
        synchronizeCanonicalTimeClaims(state, true);
        this.projects.set(
          state.projectId,
          state,
        );
      }
      this.persistSnapshot();
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
      this.stateFile +
      "." +
      process.pid +
      "." +
      randomUUID() +
      ".tmp";

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

  listProjectIds(): string[] {
    return [
      ...this.projects.keys(),
    ].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  findProjectIdByCode(
    projectId: string,
  ): string | null {
    const normalized =
      normalizeProjectCode(
        projectId,
      );
    if (!normalized) return null;

    return (
      [...this.projects.keys()]
        .find(
          (existingId) =>
            normalizeProjectCode(
              existingId,
            ) === normalized,
        ) ??
      null
    );
  }

  get(
    projectId: string,
  ): ProjectRuntimeState | null {
    const resolved =
      this.findProjectIdByCode(
        projectId,
      );
    return resolved
      ? this.projects.get(
          resolved,
        ) ?? null
      : null;
  }

  getOrCreate(
    projectId: string,
  ): ProjectRuntimeState {
    const normalized =
      normalizeProjectCode(
        projectId,
      );
    const existingId =
      this.findProjectIdByCode(
        normalized,
      );
    if (existingId) {
      return this.projects.get(
        existingId,
      )!;
    }

    const state:
      ProjectRuntimeState = {
        projectId: normalized,
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
        derivedControlsByDocument: {},
        derivedReadinessByDocument: {},
        lastRerunReceipt: null,
        controls:
          emptyControls(),
      };

    this.projects.set(
      state.projectId,
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

  private staleFinalizedBoardPublications(
    state: ProjectRuntimeState,
  ): void {
    const now =
      new Date().toISOString();
    for (
      const publication of
        state.boardPublicationHistory
    ) {
      if (!publication.stale) {
        publication.stale = true;
        publication.staleAt = now;
      }
    }
  }

  private captureDelayEventHistory(
    state: ProjectRuntimeState,
    model:
      NonNullable<
        ProjectControlState["delayClaims"]
      >,
  ): void {
    const now =
      new Date().toISOString();

    for (const event of model.events) {
      const fingerprint =
        createHash("sha256")
          .update(
            JSON.stringify(event),
          )
          .digest("hex");
      const versions =
        state.delayEventHistory
          .filter(
            (item) =>
              item.eventId ===
              event.eventId,
          )
          .sort(
            (a, b) =>
              a.version -
              b.version,
          );
      const latest =
        versions.at(-1) ??
        null;
      if (
        latest?.fingerprint ===
        fingerprint
      ) {
        continue;
      }
      state.delayEventHistory.push({
        eventId:
          event.eventId,
        version:
          (latest?.version ?? 0) +
          1,
        fingerprint,
        effectiveAt: now,
        supersedesVersion:
          latest?.version ?? null,
        evidenceRevisionId:
          model.evidenceRevisionId,
        snapshot:
          JSON.parse(
            JSON.stringify(event),
          ),
      });
    }
  }

  private async extractFullScheduleControlAssertions(
    bytes: Uint8Array,
    sourceRef: string,
    controlMetrics: ReadonlySet<string>,
    requiredMetrics: ReadonlySet<string> = controlMetrics,
  ): Promise<{
    assertions: DocumentAssertion[];
    diagnostics: string[];
  }> {
    const diagnostics: string[] = [];
    const parser =
      new PDFParse({
        data:
          Buffer.from(bytes) as any,
      });

    const relevant = (
      text: string,
    ): DocumentAssertion[] =>
      extractDocumentAssertions(
        text,
        sourceRef,
      ).filter((assertion) =>
        controlMetrics.has(
          assertion.metric,
        ),
      );

    const hasRequiredMetric = (
      assertions:
        readonly DocumentAssertion[],
    ): boolean =>
      assertions.some(
        (assertion) =>
          requiredMetrics.has(
            assertion.metric,
          ),
      );

    const mergeAssertions = (
      ...sets:
        readonly DocumentAssertion[][]
    ): DocumentAssertion[] => {
      const byKey =
        new Map<
          string,
          DocumentAssertion
        >();
      for (
        const assertion of
          sets.flat()
      ) {
        const key =
          assertion.metric +
          "|" +
          String(assertion.value) +
          "|" +
          String(
            assertion.unit ??
            "",
          );
        const prior =
          byKey.get(key);
        if (
          !prior ||
          assertion.confidence >
            prior.confidence
        ) {
          byKey.set(
            key,
            assertion,
          );
        }
      }
      return [
        ...byKey.values(),
      ];
    };

    try {
      const full =
        await parser.getText();
      const pages =
        [
          ...(full.pages ?? []),
        ].sort(
          (a, b) =>
            (a.num ?? 0) -
            (b.num ?? 0),
        );
      const nativeText =
        pages
          .map(
            (page) =>
              page.text ??
              "",
          )
          .join("\n");
      let assertions =
        relevant(nativeText);

      if (
        hasRequiredMetric(
          assertions,
        )
      ) {
        diagnostics.push(
          "SCHEDULE_CONTROL_BASIS_FULL_NATIVE_TEXT_USED",
        );
        return {
          assertions,
          diagnostics,
        };
      }

      if (
        process.env
          .CMENG_OCR_ENABLED
          ?.trim() === "0"
      ) {
        diagnostics.push(
          "SCHEDULE_CONTROL_BASIS_FULL_OCR_DISABLED",
        );
        return {
          assertions,
          diagnostics,
        };
      }

      const pageCount =
        Number.isFinite(
          full.total,
        )
          ? Number(full.total)
          : pages.length;
      const maxOcrPages =
        Math.max(
          1,
          Number.parseInt(
            process.env
              .CMENG_SCHEDULE_CONTROL_OCR_MAX_PAGES ??
              "16",
            10,
          ) || 16,
        );

      const allPageNumbers =
        Array.from(
          {
            length:
              Math.max(
                0,
                pageCount,
              ),
          },
          (
            _,
            index,
          ) =>
            index + 1,
        );
      const selected =
        allPageNumbers.length <=
        maxOcrPages
          ? allPageNumbers
          : [
              ...new Set(
                Array.from(
                  {
                    length:
                      maxOcrPages,
                  },
                  (
                    _,
                    index,
                  ) =>
                    Math.max(
                      1,
                      Math.min(
                        pageCount,
                        Math.round(
                          1 +
                            (
                              index /
                              Math.max(
                                1,
                                maxOcrPages -
                                  1,
                              )
                            ) *
                              (
                                pageCount -
                                1
                              ),
                        ),
                      ),
                    ),
                ),
              ),
            ];

      if (
        selected.length ===
        0
      ) {
        diagnostics.push(
          "SCHEDULE_CONTROL_BASIS_PDF_HAS_NO_PAGES",
        );
        return {
          assertions,
          diagnostics,
        };
      }

      const screenshots:
        any =
        await parser.getScreenshot({
          partial:
            selected,
          scale: 1.75,
          imageBuffer: true,
          imageDataUrl: false,
        });
      const provider =
        this.createOcrProvider();
      const texts:
        string[] = [];

      try {
        for (
          let index = 0;
          index <
          (
            screenshots.pages ??
            []
          ).length;
          index += 1
        ) {
          const page =
            screenshots.pages[
              index
            ];
          const image =
            page?.data;
          if (!image) {
            continue;
          }
          const ocr =
            await provider.recognize(
              image instanceof
                Uint8Array
                ? image
                : Buffer.from(
                    image,
                  ),
              selected[
                index
              ] ??
                index + 1,
            );
          if (
            ocr.text?.trim()
          ) {
            texts.push(
              ocr.text,
            );
          }
          diagnostics.push(
            ...ocr.diagnostics.map(
              (item) =>
                "SCHEDULE_CONTROL_OCR:" +
                item,
            ),
          );
        }
      } finally {
        if (
          provider.close
        ) {
          await provider.close();
        }
      }

      const ocrAssertions =
        relevant(
          texts.join(
            "\n",
          ),
        );
      assertions =
        mergeAssertions(
          assertions,
          ocrAssertions,
        );

      if (
        hasRequiredMetric(
          assertions,
        )
      ) {
        diagnostics.push(
          "SCHEDULE_CONTROL_BASIS_FULL_OCR_USED",
        );
      } else {
        diagnostics.push(
          "SCHEDULE_CONTROL_BASIS_FULL_DOCUMENT_THRESHOLD_NOT_FOUND",
        );
      }

      return {
        assertions,
        diagnostics,
      };
    } catch (error) {
      diagnostics.push(
        "SCHEDULE_CONTROL_BASIS_FULL_DOCUMENT_PARSE_ERROR:" +
          (
            error instanceof
              Error
              ? error.message
              : String(
                  error,
                )
          ),
      );
      return {
        assertions: [],
        diagnostics,
      };
    } finally {
      await parser.destroy();
    }
  }

  async refreshCorrespondenceNarratives(
    projectId?: string,
  ): Promise<{
    refreshedDocumentCount: number;
    segmentCount: number;
    unresolvedAnchorCount: number;
    diagnostics: string[];
  }> {
    const diagnostics: string[] = [];
    const correspondenceSegmentProducerVersion =
      "correspondence-linked-context-v3";
    let refreshedDocumentCount = 0;
    let segmentCount = 0;
    let unresolvedAnchorCount = 0;
    let changed = false;

    const targetStates =
      projectId
        ? [
            this.get(
              projectId,
            ),
          ].filter(
            (
              state,
            ): state is ProjectRuntimeState =>
              state !== null,
          )
        : [
            ...this.projects.values(),
          ];

    const normalizeAnchor = (
      value: string,
    ): string =>
      value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "");

    const escapeRegex = (
      value: string,
    ): string =>
      value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );
    const anchorPattern = (
      value: string,
    ): RegExp | null => {
      const runs =
        value
          .normalize("NFKC")
          .match(/[\p{L}\p{N}]+/gu)
          ?.map((run) =>
            escapeRegex(
              run.toLowerCase(),
            ),
          ) ?? [];
      if (runs.length === 0) {
        return null;
      }
      return new RegExp(
        runs.join(
          "[^\\p{L}\\p{N}]+",
        ),
        "giu",
      );
    };

    for (const state of targetStates) {
      const tableDiagnostics:
        string[] = [];
      const tables =
        governedTables(
          state.evidenceDocuments,
          tableDiagnostics,
        );
      diagnostics.push(
        ...tableDiagnostics.map(
          (item) =>
            "CORRESPONDENCE_TABLE:" +
            item,
        ),
      );

      const anchors =
        new Set<string>();
      for (const table of tables) {
        for (const row of table.rows) {
          for (
            const value of [
              cell(
                row,
                "linked letter",
              ),
              cell(
                row,
                "source letter",
              ),
              cell(
                row,
                "letter reference",
              ),
            ]
          ) {
            const trimmed =
              value.trim();
            if (trimmed) {
              anchors.add(
                trimmed,
              );
            }
          }
        }
      }

      if (
        anchors.size === 0
      ) {
        continue;
      }

      const anchorSetHashSha256 =
        createHash("sha256")
          .update(
            [...anchors]
              .map(normalizeAnchor)
              .filter(Boolean)
              .sort()
              .join("\n"),
          )
          .digest("hex");

      let projectChanged = false;

      const documents =
        state.evidenceDocuments.filter(
          (document) =>
            document.documentType ===
              "letters_notices" &&
            ["active", "additive"].includes(
              document.basisState,
            ) &&
            /pdf/i.test(
              document.mediaType +
                " " +
                document.sourceFilename,
            ),
        );

      for (const document of documents) {
        if (
          !document.storedPath ||
          !existsSync(
            document.storedPath,
          )
        ) {
          diagnostics.push(
            "CORRESPONDENCE_SOURCE_UNAVAILABLE:" +
              document.documentId,
          );
          continue;
        }

        const existing =
          document.textSegments ??
          [];
        const currentExisting =
          existing.filter(
            (segment) =>
              segment.kind ===
                "linked_correspondence_context" &&
              segment.sourceHashSha256 ===
                document.sourceHashSha256 &&
              segment.producerVersion ===
                correspondenceSegmentProducerVersion,
          );
        if (
          existing.length >
          currentExisting.length
        ) {
          diagnostics.push(
            "CORRESPONDENCE_SEGMENTS_STALE_PRODUCER:" +
              document.documentId,
          );
        }

        const refreshReceipt =
          document.correspondenceNarrativeRefresh;
        if (
          refreshReceipt?.producerVersion ===
            correspondenceSegmentProducerVersion &&
          refreshReceipt.sourceHashSha256 ===
            document.sourceHashSha256 &&
          refreshReceipt.anchorSetHashSha256 ===
            anchorSetHashSha256
        ) {
          segmentCount +=
            currentExisting.length;
          unresolvedAnchorCount +=
            refreshReceipt.unresolvedAnchorCount;
          diagnostics.push(
            "CORRESPONDENCE_REFRESH_RECEIPT_REUSED:" +
              document.documentId,
          );
          continue;
        }

        const existingAnchors =
          new Set(
            currentExisting
              .map(
                (segment) =>
                  normalizeAnchor(
                    segment.anchor,
                  ),
              ),
          );
        const allAnchorsCovered =
          [...anchors].every(
            (anchor) =>
              existingAnchors.has(
                normalizeAnchor(
                  anchor,
                ),
              ),
          );
        if (
          allAnchorsCovered &&
          currentExisting.length > 0
        ) {
          segmentCount +=
            currentExisting.length;
          continue;
        }

        const bytes =
          readFileSync(
            document.storedPath,
          );
        if (
          hashBytes(bytes) !==
          document.sourceHashSha256
        ) {
          diagnostics.push(
            "CORRESPONDENCE_REFRESH_HASH_MISMATCH:" +
              document.documentId,
          );
          continue;
        }

        const parser =
          new PDFParse({
            data:
              Buffer.from(
                bytes,
              ) as any,
          });
        try {
          const parsed =
            await parser.getText();
          const pages =
            [
              ...(parsed.pages ?? []),
            ].sort(
              (a, b) =>
                (a.num ?? 0) -
                (b.num ?? 0),
            );
          const totalPages =
            typeof parsed.total ===
            "number"
              ? parsed.total
              : pages.length;
          const meaningfulCount = (
            value: string,
          ): number =>
            [...value].filter(
              (character) =>
                /[\p{L}\p{N}]/u.test(
                  character,
                ),
            ).length;
          const nativeTextByPage =
            new Map<number, string>(
              pages
                .filter(
                  (page) =>
                    typeof page.num ===
                    "number",
                )
                .map(
                  (page) => [
                    page.num!,
                    page.text ?? "",
                  ],
                ),
            );
          const effectiveTextByPage =
            new Map<number, string>();
          const methodByPage =
            new Map<
              number,
              EvidenceTextSegment["method"]
            >();
          const lowNativePages:
            number[] = [];

          for (
            let pageNumber = 1;
            pageNumber <= totalPages;
            pageNumber += 1
          ) {
            const nativeText =
              nativeTextByPage.get(
                pageNumber,
              ) ?? "";
            effectiveTextByPage.set(
              pageNumber,
              nativeText,
            );
            methodByPage.set(
              pageNumber,
              "native_pdf_text",
            );
            if (
              meaningfulCount(
                nativeText,
              ) < 12
            ) {
              lowNativePages.push(
                pageNumber,
              );
            }
          }

          let ocrPageCount = 0;
          if (
            lowNativePages.length >
            0
          ) {
            const provider =
              this.createOcrProvider();
            const batchSize = 8;
            try {
              for (
                let offset = 0;
                offset <
                lowNativePages.length;
                offset += batchSize
              ) {
                const selected =
                  lowNativePages.slice(
                    offset,
                    offset +
                      batchSize,
                  );
                const screenshots:
                  any =
                  await parser.getScreenshot({
                    partial:
                      selected,
                    scale: 1.75,
                    imageBuffer:
                      true,
                    imageDataUrl:
                      false,
                  });
                for (
                  let index = 0;
                  index <
                  (
                    screenshots.pages ??
                    []
                  ).length;
                  index += 1
                ) {
                  const screenshot =
                    screenshots.pages[
                      index
                    ];
                  const image =
                    screenshot?.data;
                  const pageNumber =
                    selected[
                      index
                    ] ??
                    null;
                  if (
                    !image ||
                    pageNumber ===
                      null
                  ) {
                    diagnostics.push(
                      "CORRESPONDENCE_OCR_SCREENSHOT_MISSING:" +
                        document.documentId +
                        ":" +
                        String(
                          pageNumber ??
                            "unknown",
                        ),
                    );
                    continue;
                  }
                  try {
                    const ocr =
                      await provider.recognize(
                        image instanceof
                          Uint8Array
                          ? image
                          : Buffer.from(
                              image,
                            ),
                        pageNumber,
                      );
                    const ocrText =
                      ocr.text ??
                      "";
                    diagnostics.push(
                      ...ocr.diagnostics.map(
                        (item) =>
                          "CORRESPONDENCE_OCR:" +
                          document.documentId +
                          ":" +
                          String(
                            pageNumber,
                          ) +
                          ":" +
                          item,
                      ),
                    );
                    if (
                      meaningfulCount(
                        ocrText,
                      ) >
                      meaningfulCount(
                        effectiveTextByPage.get(
                          pageNumber,
                        ) ?? "",
                      )
                    ) {
                      effectiveTextByPage.set(
                        pageNumber,
                        ocrText,
                      );
                      methodByPage.set(
                        pageNumber,
                        "ocr_text",
                      );
                      ocrPageCount +=
                        1;
                    }

                    if (
                      process.env
                        .CMENG_CORRESPONDENCE_OCR_DIAGNOSTICS ===
                      "1" &&
                      offset === 0 &&
                      index < 4
                    ) {
                      const rawText =
                        ocrText;
                      process.stdout.write(
                        JSON.stringify({
                          event:
                            "correspondence_ocr_diagnostic",
                          part:
                            "ocr_sample",
                          documentId:
                            document.documentId,
                          pageNumber,
                          ocrConfidence:
                            ocr.confidence,
                          rawTextLength:
                            [...rawText]
                              .length,
                          rawTextHexFirst64:
                            Buffer.from(
                              [...rawText]
                                .slice(
                                  0,
                                  64,
                                )
                                .join(
                                  "",
                                ),
                              "utf8",
                            ).toString(
                              "hex",
                            ),
                          rawText:
                            [...rawText]
                              .slice(
                                0,
                                1400,
                              )
                              .join(
                                "",
                              ),
                        }) +
                          "\n",
                      );
                    }
                  } catch (error) {
                    diagnostics.push(
                      "CORRESPONDENCE_OCR_FAILURE:" +
                        document.documentId +
                        ":" +
                        String(
                          pageNumber,
                        ) +
                        ":" +
                        (
                          error instanceof
                            Error
                            ? error.message
                            : String(
                                error,
                              )
                        ),
                    );
                  }
                }
              }
            } finally {
              if (
                provider.close
              ) {
                await provider.close();
              }
            }
          }

          const nativePageCount =
            Array.from(
              {
                length:
                  totalPages,
              },
              (_, index) =>
                index + 1,
            ).filter(
              (pageNumber) =>
                methodByPage.get(
                  pageNumber,
                ) ===
                "native_pdf_text" &&
                meaningfulCount(
                  effectiveTextByPage.get(
                    pageNumber,
                  ) ?? "",
                ) >= 12,
            ).length;

          diagnostics.push(
            "CORRESPONDENCE_TEXT_COVERAGE:" +
              document.documentId +
              ":native=" +
              nativePageCount +
              ":ocr=" +
              ocrPageCount +
              ":total=" +
              totalPages,
          );

          if (
            process.env
              .CMENG_CORRESPONDENCE_OCR_DIAGNOSTICS ===
            "1"
          ) {
            process.stdout.write(
              JSON.stringify({
                event:
                  "correspondence_ocr_diagnostic",
                part:
                  "native_coverage",
                documentId:
                  document.documentId,
                totalPages,
                nativePageCount,
                lowNativePageCount:
                  lowNativePages.length,
                ocrPageCount,
                sampleLowNativePages:
                  lowNativePages.slice(
                    0,
                    12,
                  ),
              }) + "\n",
            );
          }

          const segments:
            EvidenceTextSegment[] =
            [];
          const foundAnchors =
            new Set<string>();
          let documentUnresolvedAnchorCount =
            0;

          for (
            let pageNumber = 1;
            pageNumber <= totalPages;
            pageNumber += 1
          ) {
            const pageText =
              effectiveTextByPage.get(
                pageNumber,
              ) ??
              "";
            if (!pageText) {
              continue;
            }
            const searchablePageText =
              pageText.normalize("NFKC");

            const occurrences:
              Array<{
                anchor: string;
                index: number;
                end: number;
              }> = [];

            for (const anchor of anchors) {
              const matcher =
                anchorPattern(anchor);
              if (!matcher) {
                continue;
              }
              matcher.lastIndex = 0;
              for (
                let match =
                  matcher.exec(
                    searchablePageText,
                  );
                match;
                match =
                  matcher.exec(
                    searchablePageText,
                  )
              ) {
                occurrences.push({
                  anchor,
                  index:
                    match.index,
                  end:
                    match.index +
                    match[0].length,
                });
                if (match[0].length === 0) {
                  matcher.lastIndex += 1;
                }
              }
            }

            occurrences.sort(
              (a, b) =>
                a.index -
                b.index ||
                a.anchor.localeCompare(
                  b.anchor,
                ),
            );

            for (
              let occurrenceIndex = 0;
              occurrenceIndex <
              occurrences.length;
              occurrenceIndex += 1
            ) {
              const occurrence =
                occurrences[
                  occurrenceIndex
                ]!;
              const previous =
                occurrences[
                  occurrenceIndex -
                    1
                ] ??
                null;
              const next =
                occurrences[
                  occurrenceIndex +
                    1
                ] ??
                null;

              const previousBoundary =
                previous
                  ? Math.floor(
                      (
                        previous.end +
                        occurrence.index
                      ) /
                        2,
                    )
                  : 0;
              const nextBoundary =
                next
                  ? Math.ceil(
                      (
                        occurrence.end +
                        next.index
                      ) /
                        2,
                    )
                  : pageText.length;

              const start =
                Math.max(
                  previousBoundary,
                  occurrence.index -
                    1800,
                );
              const end =
                Math.min(
                  nextBoundary,
                  occurrence.end +
                    2400,
                );
              const text =
                searchablePageText
                  .slice(
                    start,
                    end,
                  )
                  .replace(
                    /[\t\r]+/g,
                    " ",
                  )
                  .replace(
                    /[ ]{2,}/g,
                    " ",
                  )
                  .trim();
              if (!text) {
                continue;
              }

              const locator =
                "page:" +
                String(
                  pageNumber,
                ) +
                ":anchor:" +
                occurrence.anchor;
              const segmentId =
                "corrseg_" +
                createHash(
                  "sha256",
                )
                  .update(
                    document.documentId,
                  )
                  .update("|")
                  .update(
                    document.sourceHashSha256,
                  )
                  .update("|")
                  .update(
                    locator,
                  )
                  .update("|")
                  .update(text)
                  .digest(
                    "hex",
                  )
                  .slice(
                    0,
                    24,
                  );

              segments.push({
                segmentId,
                producerVersion:
                  correspondenceSegmentProducerVersion,
                kind:
                  "linked_correspondence_context",
                anchor:
                  occurrence.anchor,
                pageNumber,
                text,
                locator,
                method:
                  methodByPage.get(
                    pageNumber,
                  ) ??
                  "native_pdf_text",
                sourceHashSha256:
                  document.sourceHashSha256,
              });
              foundAnchors.add(
                normalizeAnchor(
                  occurrence.anchor,
                ),
              );
            }
          }

          for (const anchor of anchors) {
            if (
              !foundAnchors.has(
                normalizeAnchor(
                  anchor,
                ),
              )
            ) {
              documentUnresolvedAnchorCount +=
                1;
              diagnostics.push(
                "CORRESPONDENCE_ANCHOR_NOT_FOUND:" +
                  document.documentId +
                  ":" +
                  anchor,
              );
            }
          }

          unresolvedAnchorCount +=
            documentUnresolvedAnchorCount;

          const deduped = [
            ...new Map(
              segments.map(
                (segment) => [
                  segment.segmentId,
                  segment,
                ],
              ),
            ).values(),
          ].sort(
            (a, b) =>
              (
                a.pageNumber ??
                Number.MAX_SAFE_INTEGER
              ) -
                (
                  b.pageNumber ??
                  Number.MAX_SAFE_INTEGER
                ) ||
              a.anchor.localeCompare(
                b.anchor,
              ) ||
              a.segmentId.localeCompare(
                b.segmentId,
              ),
          );

          const previousFingerprint =
            createHash(
              "sha256",
            )
              .update(
                JSON.stringify(
                  existing,
                ),
              )
              .digest(
                "hex",
              );
          const nextFingerprint =
            createHash(
              "sha256",
            )
              .update(
                JSON.stringify(
                  deduped,
                ),
              )
              .digest(
                "hex",
              );
          const nextRefreshReceipt = {
            producerVersion:
              correspondenceSegmentProducerVersion,
            sourceHashSha256:
              document.sourceHashSha256,
            anchorSetHashSha256,
            totalPages,
            nativePages:
              nativePageCount,
            ocrPages:
              ocrPageCount,
            unresolvedAnchorCount:
              documentUnresolvedAnchorCount,
            completedAt:
              new Date()
                .toISOString(),
          };
          const previousReceiptFingerprint =
            createHash("sha256")
              .update(
                JSON.stringify(
                  document.correspondenceNarrativeRefresh ??
                    null,
                ),
              )
              .digest("hex");
          const nextReceiptFingerprint =
            createHash("sha256")
              .update(
                JSON.stringify(
                  nextRefreshReceipt,
                ),
              )
              .digest("hex");

          if (
            previousFingerprint !==
              nextFingerprint ||
            previousReceiptFingerprint !==
              nextReceiptFingerprint
          ) {
            document.textSegments =
              deduped;
            document.correspondenceNarrativeRefresh =
              nextRefreshReceipt;
            if (
              !document.diagnostics.includes(
                "CORRESPONDENCE_LINKED_CONTEXT_REFRESH_V2",
              )
            ) {
              document.diagnostics.push(
                "CORRESPONDENCE_LINKED_CONTEXT_REFRESH_V2",
              );
            }
            refreshedDocumentCount +=
              1;
            projectChanged =
              true;
          }
          segmentCount +=
            deduped.length;
        } catch (error) {
          diagnostics.push(
            "CORRESPONDENCE_FULL_DOCUMENT_PARSE_ERROR:" +
              document.documentId +
              ":" +
              (
                error instanceof
                  Error
                  ? error.message
                  : String(
                      error,
                    )
              ),
          );
        } finally {
          await parser.destroy();
        }
      }

      if (projectChanged) {
        state.version += 1;
        this.staleFinalizedBoardPublications(
          state,
        );
        state.lastRerunReceipt =
          null;
        synchronizeCanonicalTimeClaims(
          state,
          true,
        );
        changed = true;
      }
    }

    if (changed) {
      this.persistSnapshot();
    }

    return {
      refreshedDocumentCount,
      segmentCount,
      unresolvedAnchorCount,
      diagnostics,
    };
  }

  async refreshScheduleControlBasisAssertions(): Promise<{
    refreshedDocumentCount: number;
    diagnostics: string[];
  }> {
    const controlMetrics = new Set([
      "near_critical_working_days",
      "near_critical_threshold_hours",
      "near_critical_count",
      "critical_float_threshold_hours",
      "schedule_control_data_date",
    ]);
    const thresholdMetrics = new Set([
      "near_critical_working_days",
      "near_critical_threshold_hours",
    ]);
    const productivityMetrics = new Set([
      "source_productivity_forecast_completion",
      "completion_date",
      "schedule_control_data_date",
    ]);
    const diagnostics: string[] = [];
    let refreshedDocumentCount = 0;
    let changed = false;

    for (const state of this.projects.values()) {
      let projectChanged = false;
      let projectReadyForV5 = true;
      const basisDocuments =
        state.evidenceDocuments.filter(
          (document) =>
            document.documentType === "schedule_control_basis" &&
            ["active", "additive", "candidate"].includes(
              document.basisState,
            ),
        );

      for (const document of basisDocuments) {
        if (
          /csv/i.test(
            document.mediaType +
              " " +
              document.sourceFilename,
          )
        ) {
          continue;
        }

        const alreadyEstablished =
          document.assertions.some(
            (assertion) =>
              assertion.metric ===
                "near_critical_working_days" ||
              assertion.metric ===
                "near_critical_threshold_hours",
          );
        if (alreadyEstablished) {
          continue;
        }

        if (
          !/pdf/i.test(document.mediaType) ||
          !document.storedPath ||
          !existsSync(document.storedPath)
        ) {
          projectReadyForV5 = false;
          diagnostics.push(
            "SCHEDULE_CONTROL_BASIS_REFRESH_SOURCE_UNAVAILABLE:" +
              document.documentId,
          );
          continue;
        }

        const bytes =
          readFileSync(document.storedPath);
        const verifiedHash =
          hashBytes(bytes);
        if (
          verifiedHash !==
          document.sourceHashSha256
        ) {
          projectReadyForV5 = false;
          diagnostics.push(
            "SCHEDULE_CONTROL_BASIS_REFRESH_HASH_MISMATCH:" +
              document.documentId,
          );
          continue;
        }

        const identified =
          await identifyEvidenceDocument({
            bytes,
            sourceFilename:
              document.sourceFilename,
            sourceRelativePath:
              document.sourceRelativePath ??
              document.sourceFilename,
            declaredMediaType:
              document.mediaType,
            declaredCategory:
              "schedule_control",
            declaredDocumentType:
              "schedule_control_basis",
          });

        let extracted =
          extractDocumentAssertions(
            identified.textSample,
            "evidence:" +
              document.sourceFilename,
          ).filter((assertion) =>
            controlMetrics.has(
              assertion.metric,
            ),
          );

        let establishesThreshold =
          extracted.some(
            (assertion) =>
              assertion.metric ===
                "near_critical_working_days" ||
              assertion.metric ===
                "near_critical_threshold_hours",
          );

        if (!establishesThreshold) {
          const fullDocument =
            await this.extractFullScheduleControlAssertions(
              bytes,
              "evidence:" +
                document.sourceFilename +
                ":full-document",
              controlMetrics,
              thresholdMetrics,
            );
          diagnostics.push(
            ...fullDocument.diagnostics.map(
              (item) =>
                item +
                ":" +
                document.documentId,
            ),
          );

          const merged =
            new Map<
              string,
              DocumentAssertion
            >();
          for (
            const assertion of [
              ...extracted,
              ...fullDocument.assertions,
            ]
          ) {
            const key =
              assertion.metric +
              "|" +
              String(
                assertion.value,
              ) +
              "|" +
              String(
                assertion.unit ??
                "",
              );
            const prior =
              merged.get(key);
            if (
              !prior ||
              assertion.confidence >
                prior.confidence
            ) {
              merged.set(
                key,
                assertion,
              );
            }
          }
          extracted = [
            ...merged.values(),
          ];
          establishesThreshold =
            extracted.some(
              (assertion) =>
                assertion.metric ===
                  "near_critical_working_days" ||
                assertion.metric ===
                  "near_critical_threshold_hours",
            );
        }

        if (!establishesThreshold) {
          projectReadyForV5 = false;
          diagnostics.push(
            "SCHEDULE_CONTROL_BASIS_THRESHOLD_NOT_EXTRACTED:" +
              document.documentId,
          );
          continue;
        }

        const retained =
          document.assertions.filter(
            (assertion) =>
              !controlMetrics.has(
                assertion.metric,
              ),
          );
        document.assertions = [
          ...retained,
          ...extracted,
        ];
        if (
          !document.diagnostics.includes(
            "SCHEDULE_CONTROL_BASIS_ASSERTION_REFRESH_V4",
          )
        ) {
          document.diagnostics.push(
            "SCHEDULE_CONTROL_BASIS_ASSERTION_REFRESH_V4",
          );
        }
        refreshedDocumentCount += 1;
        projectChanged = true;
      }

      const productivityDocuments =
        state.evidenceDocuments.filter(
          (document) =>
            (
              document.documentType === "project_data_book" ||
              document.documentType === "schedule_control_basis"
            ) &&
            ["active", "additive", "candidate"].includes(
              document.basisState,
            ),
        );

      for (const document of productivityDocuments) {
        if (
          document.assertions.some(
            (assertion) =>
              assertion.metric ===
              "source_productivity_forecast_completion",
          )
        ) {
          continue;
        }
        if (
          !/pdf/i.test(
            document.mediaType +
              " " +
              document.sourceFilename,
          ) ||
          !document.storedPath ||
          !existsSync(document.storedPath)
        ) {
          continue;
        }

        const bytes =
          readFileSync(document.storedPath);
        if (
          hashBytes(bytes) !==
          document.sourceHashSha256
        ) {
          diagnostics.push(
            "PROJECT_CONTROL_PRODUCTIVITY_REFRESH_HASH_MISMATCH:" +
              document.documentId,
          );
          continue;
        }

        const identified =
          await identifyEvidenceDocument({
            bytes,
            sourceFilename:
              document.sourceFilename,
            sourceRelativePath:
              document.sourceRelativePath ??
              document.sourceFilename,
            declaredMediaType:
              document.mediaType,
            declaredCategory:
              "schedule_control",
            declaredDocumentType:
              document.documentType,
          });

        let extracted =
          extractDocumentAssertions(
            identified.textSample,
            "evidence:" +
              document.sourceFilename,
          ).filter(
            (assertion) =>
              productivityMetrics.has(
                assertion.metric,
              ),
          );

        if (
          !extracted.some(
            (assertion) =>
              assertion.metric ===
                "source_productivity_forecast_completion" ||
              (
                assertion.metric === "completion_date" &&
                /productivity/i.test(assertion.sourceText ?? "")
              ),
          )
        ) {
          const fullDocument =
            await this.extractFullScheduleControlAssertions(
              bytes,
              "evidence:" +
                document.sourceFilename +
                ":full-document",
              productivityMetrics,
              new Set([
                "source_productivity_forecast_completion",
              ]),
            );
          diagnostics.push(
            ...fullDocument.diagnostics.map(
              (item) =>
                "PROJECT_CONTROL_PRODUCTIVITY:" +
                item +
                ":" +
                document.documentId,
            ),
          );
          extracted = [
            ...extracted,
            ...fullDocument.assertions,
          ];
        }

        const productivityAssertions =
          extracted.filter(
            (assertion) =>
              productivityMetrics.has(
                assertion.metric,
              ),
          );
        if (
          !productivityAssertions.some(
            (assertion) =>
              assertion.metric ===
                "source_productivity_forecast_completion" ||
              (
                assertion.metric === "completion_date" &&
                /productivity/i.test(assertion.sourceText ?? "")
              ),
          )
        ) {
          continue;
        }

        const retained =
          document.assertions.filter(
            (assertion) =>
              !productivityMetrics.has(
                assertion.metric,
              ),
          );
        const merged =
          new Map<string, DocumentAssertion>();
        for (
          const assertion of [
            ...retained,
            ...productivityAssertions,
          ]
        ) {
          const key =
            assertion.metric +
            "|" +
            String(assertion.value) +
            "|" +
            String(assertion.unit ?? "");
          const prior = merged.get(key);
          if (
            !prior ||
            assertion.confidence >
              prior.confidence
          ) {
            merged.set(key, assertion);
          }
        }
        document.assertions = [
          ...merged.values(),
        ];
        if (
          !document.diagnostics.includes(
            "PROJECT_CONTROL_PRODUCTIVITY_ASSERTION_REFRESH_V1",
          )
        ) {
          document.diagnostics.push(
            "PROJECT_CONTROL_PRODUCTIVITY_ASSERTION_REFRESH_V1",
          );
        }
        refreshedDocumentCount += 1;
        projectChanged = true;
      }

      if (
        basisDocuments.length === 0 ||
        projectReadyForV5
      ) {
        if (
          state.sourceIntegrationVersion !==
          "canonical-source-v5"
        ) {
          state.sourceIntegrationVersion =
            "canonical-source-v5";
          projectChanged = true;
        }
      }

      if (projectChanged) {
        state.version += 1;
        this.staleFinalizedBoardPublications(
          state,
        );
        state.lastRerunReceipt =
          null;
        synchronizeCanonicalTimeClaims(
          state,
          true,
        );
        changed = true;
      }
    }

    if (changed) {
      this.persistSnapshot();
    }

    return {
      refreshedDocumentCount,
      diagnostics,
    };
  }

  touch(
    state: ProjectRuntimeState,
  ): void {
    state.version += 1;
    this.persistSnapshot();
  }

  touchEvidence(
    state: ProjectRuntimeState,
  ): void {
    state.sourceIntegrationVersion = "canonical-source-v3";
    synchronizeCanonicalTimeClaims(state, true);
    this.staleFinalizedBoardPublications(
      state,
    );
    state.lastRerunReceipt =
      null;
    this.touch(state);
  }

  attachPublishedBoardReport(
    projectId: string,
    publicationId: string,
    report:
      NonNullable<
        ProjectRuntimeState["boardPublicationHistory"][number]["reportSnapshot"]
      >,
  ): void {
    const state =
      this.getOrCreate(
        projectId,
      );
    const publication =
      state.boardPublicationHistory
        .find(
          (item) =>
            item.publicationId ===
            publicationId,
        );
    if (!publication) {
      return;
    }
    publication.reportSnapshot =
      JSON.parse(
        JSON.stringify(
          report,
        ),
      );
    this.persistSnapshot();
  }

  recordRerunReceipt(
    projectId: string,
    receipt:
      ProjectRuntimeState["lastRerunReceipt"],
  ): void {
    const state =
      this.getOrCreate(projectId);
    state.lastRerunReceipt =
      receipt;
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

    const programmeSchedules =
      state.schedules.filter(
        isProgrammeScheduleRevision,
      );
    if (
      programmeSchedules.length ===
      0
    ) {
      return null;
    }

    const governedActive =
      state.activeEvidenceBasis[
        "schedule:control"
      ]?.activeArtifactId ??
      null;
    if (governedActive) {
      const active =
        programmeSchedules.find(
          (item) =>
            item.revision
              .revisionId ===
            governedActive,
        );
      if (active) {
        return active;
      }
    }

    const updates =
      programmeSchedules.filter(
        (item) =>
          item.role === "update",
      );
    const revisedBaselines =
      programmeSchedules.filter(
        (item) =>
          item.role ===
          "revised_baseline",
      );
    const baselines =
      programmeSchedules.filter(
        (item) =>
          item.role === "baseline",
      );
    const nonRecovery =
      programmeSchedules.filter(
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
              : programmeSchedules;

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


  deleteEvidenceDocuments(
    projectId: string,
    documentIds: string[],
  ): Array<{
    documentId: string;
    sourceFilename: string;
    familyKey: string;
    wasActive: boolean;
    replacementDocumentId:
      string | null;
  }> {
    const state =
      this.projects.get(projectId);
    if (!state) return [];

    const requested =
      new Set(
        documentIds
          .map((id) => id.trim())
          .filter(Boolean),
      );
    if (requested.size === 0) {
      return [];
    }

    const documents =
      state.evidenceDocuments.filter(
        (item) =>
          requested.has(
            item.documentId,
          ),
      );
    if (documents.length === 0) {
      return [];
    }

    const affectedFamilies =
      new Set<string>();
    const scheduleArtifacts =
      new Set<string>();
    const boqArtifacts =
      new Set<string>();
    const contractIds =
      new Set<string>();
    const removedIds =
      new Set<string>(
        documents.map(
          (item) =>
            item.documentId,
        ),
      );
    const storedPaths =
      new Set<string>();
    const wasActive =
      new Map<string, boolean>();

    for (const document of documents) {
      affectedFamilies.add(
        document.familyKey,
      );
      if (document.storedPath) {
        storedPaths.add(
          document.storedPath,
        );
      }
      wasActive.set(
        document.documentId,
        state.activeEvidenceBasis[
          document.familyKey
        ]?.activeDocumentId ===
          document.documentId,
      );

      if (
        document.category ===
          "schedule" &&
        document.linkedArtifactId
      ) {
        scheduleArtifacts.add(
          document.linkedArtifactId,
        );
      }
      if (
        document.category ===
          "boq_cost" &&
        document.documentType ===
          "boq" &&
        document.linkedArtifactId
      ) {
        boqArtifacts.add(
          document.linkedArtifactId,
        );
      }
      if (
        document.category ===
        "contract"
      ) {
        contractIds.add(
          document.documentId,
        );
      }

      if (
        document.documentType ===
          "contractor_manpower_plan" &&
        document.linkedArtifactId &&
        state.submittedManpowerPlan
          ?.planId ===
          document.linkedArtifactId
      ) {
        state.submittedManpowerPlan =
          null;
      }

      delete state
        .derivedControlsByDocument[
          document.documentId
        ];
      delete state
        .derivedReadinessByDocument[
          document.documentId
        ];
    }

    state.evidenceDocuments =
      state.evidenceDocuments.filter(
        (item) =>
          !removedIds.has(
            item.documentId,
          ),
      );

    for (
      const remaining of
        state.evidenceDocuments
    ) {
      if (
        remaining
          .supersededByDocumentId &&
        removedIds.has(
          remaining
            .supersededByDocumentId,
        )
      ) {
        remaining
          .supersededByDocumentId =
          null;
      }
      remaining.supersedesDocumentIds =
        remaining
          .supersedesDocumentIds
          .filter(
            (id) =>
              !removedIds.has(id),
          );
    }

    if (
      scheduleArtifacts.size > 0
    ) {
      state.schedules =
        state.schedules.filter(
          (item) =>
            !scheduleArtifacts.has(
              item.revision
                .revisionId,
            ),
        );
      for (
        const artifactId of
          scheduleArtifacts
      ) {
        state.resourcesByRevision.delete(
          artifactId,
        );
      }
    }

    if (boqArtifacts.size > 0) {
      state.boqRevisions =
        state.boqRevisions.filter(
          (item) =>
            !boqArtifacts.has(
              item.ingestionId,
            ),
        );
    }

    if (contractIds.size > 0) {
      state.contractDocuments =
        state.contractDocuments.filter(
          (item) =>
            !contractIds.has(
              item.documentId,
            ),
        );
    }

    for (
      const familyKey of
        affectedFamilies
    ) {
      rebuildEvidenceFamily(
        state,
        familyKey,
      );
    }

    const activeBoqArtifactId =
      state.activeEvidenceBasis[
        "boq:quantity"
      ]?.activeArtifactId ??
      null;
    state.boq =
      activeBoqArtifactId
        ? state.boqRevisions.find(
            (item) =>
              item.ingestionId ===
              activeBoqArtifactId,
          ) ?? null
        : null;

    const latestSchedule =
      this.latestSchedule(projectId);
    if (state.boq) {
      state.quantities =
        quantityModelFromBoq(
          state.boq,
          latestSchedule
            ?.revision.revisionId ??
            "",
          state.quantities,
        );
    } else {
      state.quantities = null;
    }

    if (contractIds.size > 0) {
      const activeBaseId =
        state.activeEvidenceBasis[
          "contract:base"
        ]?.activeDocumentId ??
        null;
      const base =
        activeBaseId
          ? state.contractDocuments.find(
              (item) =>
                item.documentId ===
                activeBaseId,
            ) ?? null
          : null;

      state.contract =
        base?.result ?? null;

      if (base) {
        const amendments =
          state.contractDocuments
            .filter(
              (item) => {
                if (
                  item.role !==
                  "amendment"
                ) {
                  return false;
                }
                const evidence =
                  state.evidenceDocuments
                    .find(
                      (candidate) =>
                        candidate
                          .documentId ===
                        item.documentId,
                    );
                return (
                  evidence
                    ?.basisState !==
                  "superseded"
                );
              },
            )
            .map(
              (item) =>
                item.result,
            );
        state.contractFamily =
          linkContractFamily(
            base.result,
            amendments,
          );
        promoteContractTimeBasis(
          state,
        );
      } else {
        state.contractFamily =
          null;
      }
    }

    rebuildReadinessEvidence(
      state,
    );
    rebuildDerivedControls(
      state,
    );

    for (
      const storedPath of
        storedPaths
    ) {
      if (
        !state.evidenceDocuments.some(
          (item) =>
            item.storedPath ===
            storedPath,
        ) &&
        existsSync(storedPath)
      ) {
        try {
          unlinkSync(storedPath);
        } catch {
          // Project record deletion remains
          // authoritative even if orphan
          // file cleanup cannot complete.
        }
      }
    }

    this.touchEvidence(state);

    return documents.map(
      (document) => ({
        documentId:
          document.documentId,
        sourceFilename:
          document.sourceFilename,
        familyKey:
          document.familyKey,
        wasActive:
          wasActive.get(
            document.documentId,
          ) ?? false,
        replacementDocumentId:
          state.activeEvidenceBasis[
            document.familyKey
          ]?.activeDocumentId ??
          null,
      }),
    );
  }

  deleteEvidenceDocument(
    projectId: string,
    documentId: string,
  ): {
    documentId: string;
    sourceFilename: string;
    familyKey: string;
    wasActive: boolean;
    replacementDocumentId:
      string | null;
  } | null {
    return (
      this.deleteEvidenceDocuments(
        projectId,
        [documentId],
      )[0] ??
      null
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

  private summaryBasisEffect(
    state: ProjectRuntimeState,
    document: StoredEvidenceDocument,
    intent: EvidenceUploadIntent,
  ): EvidenceBasisEffect {
    const family =
      evidenceFamily({
        category:
          document.category,
        documentType:
          document.documentType,
        scheduleRole:
          document.scheduleRole,
        textSample:
          document.assertions
            .map(
              (assertion) =>
                assertion.sourceText,
            )
            .join("\n"),
        sourceFilename:
          document.sourceFilename,
      });
    const active =
      state.activeEvidenceBasis[
        document.familyKey
      ]?.activeDocumentId ??
      null;
    return {
      familyKey:
        document.familyKey,
      behavior:
        family.behavior,
      intent,
      logicalDocumentKey:
        document.logicalDocumentKey,
      basisState:
        document.basisState,
      previousActiveDocumentId:
        document
          .supersedesDocumentIds
          .at(-1) ??
        null,
      activeDocumentId: active,
      changedActiveBasis:
        active ===
        document.documentId,
      reason:
        document.basisState ===
          "active"
          ? "Document is the active evidence basis for its family."
          : document.basisState ===
              "scenario"
            ? "Document is retained as a scenario and does not replace the active basis."
            : document.basisState ===
                "additive"
              ? "Document is additive evidence in a cumulative family."
              : document.basisState ===
                  "superseded"
                ? "Document remains historical and has been superseded."
                : "Document is retained without changing the active basis.",
    };
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
      uploadIntent?:
        EvidenceUploadIntent;
      preidentified?:
        EvidenceIdentificationResult;
    },
  ): Promise<EvidenceUploadSummary> {
    const relativePath =
      input.sourceRelativePath?.trim() ||
      input.sourceFilename;
    const uploadIntent:
      EvidenceUploadIntent =
      input.uploadIntent ??
      "add_update";

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
    let assertions =
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

    if (
      category === "schedule_control" &&
      media.includes("pdf") &&
      (
        documentType === "schedule_control_basis" ||
        documentType === "project_data_book"
      )
    ) {
      const targetMetrics =
        documentType === "schedule_control_basis"
          ? new Set([
              "near_critical_working_days",
              "near_critical_threshold_hours",
              "near_critical_count",
              "critical_float_threshold_hours",
              "schedule_control_data_date",
              "source_productivity_forecast_completion",
              "completion_date",
            ])
          : new Set([
              "source_productivity_forecast_completion",
              "completion_date",
              "schedule_control_data_date",
            ]);
      const requiredMetrics =
        documentType === "schedule_control_basis"
          ? new Set([
              "near_critical_working_days",
              "near_critical_threshold_hours",
            ])
          : new Set([
              "source_productivity_forecast_completion",
            ]);

      const deep =
        await this.extractFullScheduleControlAssertions(
          input.bytes,
          "evidence:" +
            input.sourceFilename +
            ":full-document",
          targetMetrics,
          requiredMetrics,
        );

      let deepAssertions = [
        ...deep.assertions,
      ];
      const hasProductivity =
        [...assertions, ...deepAssertions].some(
          (assertion) =>
            assertion.metric ===
              "source_productivity_forecast_completion" ||
            (
              assertion.metric ===
                "completion_date" &&
              /productivity/i.test(
                assertion.sourceText ??
                  "",
              )
            ),
        );

      if (
        documentType ===
          "schedule_control_basis" &&
        !hasProductivity
      ) {
        const productivityDeep =
          await this.extractFullScheduleControlAssertions(
            input.bytes,
            "evidence:" +
              input.sourceFilename +
              ":full-document:productivity",
            new Set([
              "source_productivity_forecast_completion",
              "completion_date",
              "schedule_control_data_date",
            ]),
            new Set([
              "source_productivity_forecast_completion",
            ]),
          );
        deepAssertions = [
          ...deepAssertions,
          ...productivityDeep.assertions,
        ];
        deep.diagnostics.push(
          ...productivityDeep.diagnostics.map(
            (item) =>
              "PRODUCTIVITY_PASS:" +
              item,
          ),
        );
      }

      const merged =
        new Map<string, DocumentAssertion>();
      for (
        const assertion of [
          ...assertions,
          ...deepAssertions,
        ]
      ) {
        const key =
          assertion.metric +
          "|" +
          String(assertion.value) +
          "|" +
          String(assertion.unit ?? "");
        const prior = merged.get(key);
        if (
          !prior ||
          assertion.confidence >
            prior.confidence
        ) {
          merged.set(key, assertion);
        }
      }
      assertions = [
        ...merged.values(),
      ];
      identification.diagnostics.push(
        ...deep.diagnostics.map(
          (item) =>
            "PROJECT_CONTROL_DEEP_EXTRACTION:" +
            item,
        ),
      );
    }

    const programmeDocumentTypes =
      new Set([
        "schedule_file",
        "schedule_baseline",
        "schedule_update",
        "schedule_revised_baseline",
        "schedule_recovery",
      ]);

    if (
      category === "schedule" &&
      programmeDocumentTypes.has(
        documentType,
      )
    ) {
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
          uploadIntent,
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
        basisEffect:
          this.summaryBasisEffect(
            this.getOrCreate(
              input.projectId,
            ),
            document,
            uploadIntent,
          ),
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
        uploadIntent,
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
        basisEffect:
          this.summaryBasisEffect(
            this.getOrCreate(
              input.projectId,
            ),
            document,
            uploadIntent,
          ),
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
        uploadIntent,
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
        basisEffect:
          this.summaryBasisEffect(
            this.getOrCreate(
              input.projectId,
            ),
            document,
            uploadIntent,
          ),
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
      const family =
        evidenceFamily({
          category:
            "schedule_control",
          documentType:
            "contractor_manpower_plan",
          scheduleRole: null,
          textSample:
            identified.textSample,
          sourceFilename:
            input.sourceFilename,
        });
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
        uploadIntent,
        familyKey:
          family.familyKey,
        logicalDocumentKey:
          family.logicalDocumentKey,
        basisState: "candidate",
        supersededByDocumentId:
          null,
        supersedesDocumentIds:
          [],
        diagnostics,
      };
      this.upsertEvidence(
        existingState,
        document,
      );
      applyEvidenceBasis(
        existingState,
        document,
        uploadIntent,
      );
      this.touchEvidence(
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
        basisEffect:
          this.summaryBasisEffect(
            existingState,
            document,
            uploadIntent,
          ),
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
    const family =
      evidenceFamily({
        category,
        documentType,
        scheduleRole: null,
        textSample:
          identified.textSample,
        sourceFilename:
          input.sourceFilename,
      });
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
      uploadIntent,
      familyKey:
        family.familyKey,
      logicalDocumentKey:
        family.logicalDocumentKey,
      basisState: "candidate",
      supersededByDocumentId:
        null,
      supersedesDocumentIds:
        [],
      diagnostics,
    };
    this.upsertEvidence(
      state,
      document,
    );
    applyEvidenceBasis(
      state,
      document,
      uploadIntent,
    );
    if (
      media.includes("csv")
    ) {
      const derived =
        deriveReadinessFromCsv({
          state,
          document,
          bytes:
            input.bytes,
        });
      if (
        Object.keys(
          derived,
        ).length > 0
      ) {
        state
          .derivedReadinessByDocument[
            document.documentId
          ] = derived;
      }

      const derivedControls =
        deriveControlsFromCsv({
          state,
          document,
          bytes:
            input.bytes,
        });
      if (
        Object.keys(
          derivedControls,
        ).length > 0
      ) {
        state
          .derivedControlsByDocument[
            document.documentId
          ] = derivedControls;
      }

      rebuildReadinessEvidence(
        state,
      );
      rebuildDerivedControls(
        state,
      );

      if (
        state.controls
          .delayClaims
      ) {
        this.captureDelayEventHistory(
          state,
          state.controls
            .delayClaims,
        );
      }
    }
    this.touchEvidence(state);
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
      basisEffect:
        this.summaryBasisEffect(
          state,
          document,
          uploadIntent,
        ),
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
      uploadIntent?:
        EvidenceUploadIntent;
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
    const uploadIntent:
      EvidenceUploadIntent =
      input.uploadIntent ??
      "add_update";

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

    const documentId =
      this.evidenceDocumentId(
        hash,
        input.sourceRelativePath ??
          input.sourceFilename ??
          null,
      );
    const family =
      evidenceFamily({
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
        scheduleRole:
          stored.role,
        textSample:
          assertions
            .map(
              (assertion) =>
                assertion.sourceText,
            )
            .join("\n"),
        sourceFilename:
          input.sourceFilename ??
          "schedule",
      });
    const document:
      StoredEvidenceDocument = {
      documentId,
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
      uploadIntent,
      familyKey:
        family.familyKey,
      logicalDocumentKey:
        family.logicalDocumentKey,
      basisState: "candidate",
      supersededByDocumentId:
        null,
      supersedesDocumentIds:
        [],
      diagnostics: [
        ...identification
          .diagnostics,
        ...model.diagnostics,
      ],
    };
    this.upsertEvidence(
      state,
      document,
    );
    applyEvidenceBasis(
      state,
      document,
      uploadIntent,
    );

    const activeSchedule =
      this.latestSchedule(
        input.projectId,
      );
    if (
      state.quantities &&
      activeSchedule
    ) {
      state.quantities = {
        ...state.quantities,
        scheduleRevisionId:
          activeSchedule.revision
            .revisionId,
      };
    }

    this.touchEvidence(state);

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
    uploadIntent:
      EvidenceUploadIntent =
        "add_update",
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
      const documentId =
        this.evidenceDocumentId(
          result.sourceHashSha256,
          sourceRelativePath ??
            sourceFilename ??
            result.sourceFilename,
        );
      const family =
        evidenceFamily({
          category: "boq_cost",
          documentType: "boq",
          scheduleRole: null,
          textSample:
            assertions
              .map(
                (assertion) =>
                  assertion.sourceText,
              )
              .join("\n"),
          sourceFilename:
            sourceFilename ??
            result.sourceFilename ??
            "boq",
        });
      const document:
        StoredEvidenceDocument = {
        documentId,
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
        uploadIntent,
        familyKey:
          family.familyKey,
        logicalDocumentKey:
          family.logicalDocumentKey,
        basisState: "candidate",
        supersededByDocumentId:
          null,
        supersedesDocumentIds:
          [],
        diagnostics: [
          ...(identification
            ?.diagnostics ?? []),
          ...boqLineage.diagnostics,
          ...result.diagnostics,
        ],
      };
      this.upsertEvidence(
        state,
        document,
      );
      applyEvidenceBasis(
        state,
        document,
        uploadIntent,
      );

      const activeBoqDocumentId =
        state.activeEvidenceBasis[
          "boq:quantity"
        ]?.activeDocumentId ??
        null;
      if (
        activeBoqDocumentId ===
        document.documentId
      ) {
        state.boq = result;
        state.quantities =
          quantityModelFromBoq(
            result,
            latest?.revision
              .revisionId ?? "",
            state.quantities,
          );
      }
    }

    if (
      !bytes &&
      !state.boq
    ) {
      state.boq = result;
      state.quantities =
        quantityModelFromBoq(
          result,
          latest?.revision
            .revisionId ?? "",
          state.quantities,
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
    this.touchEvidence(state);
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
      uploadIntent?:
        EvidenceUploadIntent;
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
    const uploadIntent:
      EvidenceUploadIntent =
      input.uploadIntent ??
      "add_update";

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

    const documentType =
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
                : "contract_supporting_document";
    const family =
      evidenceFamily({
        category: "contract",
        documentType,
        scheduleRole: null,
        textSample:
          assertions
            .map(
              (assertion) =>
                assertion.sourceText,
            )
            .join("\n"),
        sourceFilename:
          input.sourceFilename ??
          "contract",
      });
    const document:
      StoredEvidenceDocument = {
      documentId,
      category: "contract",
      documentType,
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
      uploadIntent,
      familyKey:
        family.familyKey,
      logicalDocumentKey:
        family.logicalDocumentKey,
      basisState: "candidate",
      supersededByDocumentId:
        null,
      supersedesDocumentIds:
        [],
      diagnostics: [
        ...identification
          .diagnostics,
        ...lineage.diagnostics,
        ...parsed.diagnostics,
      ],
    };
    this.upsertEvidence(
      state,
      document,
    );
    applyEvidenceBasis(
      state,
      document,
      uploadIntent,
    );

    const activeBaseId =
      state.activeEvidenceBasis[
        "contract:base"
      ]?.activeDocumentId ??
      null;
    const base =
      (
        activeBaseId
          ? state.contractDocuments.find(
              (item) =>
                item.documentId ===
                activeBaseId,
            ) ?? null
          : null
      ) ??
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
      storedContract;

    state.contract =
      base.result;

    const amendments =
      state.contractDocuments
        .filter(
          (item) => {
            if (
              item.role !==
              "amendment"
            ) return false;
            const evidence =
              state.evidenceDocuments.find(
                (document) =>
                  document.documentId ===
                  item.documentId,
              );
            return (
              evidence?.basisState !==
              "superseded"
            );
          },
        )
        .map(
          (item) => item.result,
        );

    state.contractFamily =
      linkContractFamily(
        base.result,
        amendments,
      );
    promoteContractTimeBasis(
      state,
    );

    document.diagnostics = [
      ...document.diagnostics,
      ...(
        state.contractFamily
          ?.diagnostics ??
        []
      ),
    ];

    this.touchEvidence(state);
    return parsed;
  }

  updateControls(
    projectId: string,
    update:
      Partial<ProjectControlState>,
  ): ProjectControlState {
    const state =
      this.getOrCreate(projectId);

    if (
      update.delayClaims
    ) {
      this.captureDelayEventHistory(
        state,
        update.delayClaims,
      );
    }

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
      risks:
        update.risks ??
        state.controls.risks,
    };

    this.touch(state);

    if (
      update.boardPublication
        ?.finalizedAt
    ) {
      const publicationId =
        "board-pub-" +
        createHash("sha256")
          .update(
            JSON.stringify({
              projectId,
              basisVersion:
                state.version,
              sourceManifestId:
                update
                  .boardPublication
                  .sourceManifestId,
              evidenceReceiptIds:
                update
                  .boardPublication
                  .evidenceReceiptIds,
              finalizedAt:
                update
                  .boardPublication
                  .finalizedAt,
            }),
          )
          .digest("hex")
          .slice(0, 20);
      if (
        !state.boardPublicationHistory
          .some(
            (item) =>
              item.publicationId ===
              publicationId,
          )
      ) {
        state.boardPublicationHistory.push({
          publicationId,
          basisVersion:
            state.version,
          sourceManifestId:
            update
              .boardPublication
              .sourceManifestId,
          evidenceReceiptIds: [
            ...update
              .boardPublication
              .evidenceReceiptIds,
          ],
          finalizedAt:
            update
              .boardPublication
              .finalizedAt,
          stale: false,
          staleAt: null,
          reportSnapshot:
            null,
        });
        this.persistSnapshot();
      }
    }

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
