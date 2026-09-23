import type {
  BoqIngestionResult,
} from "../../boq-ingestion/src";
import type {
  SubmittedManpowerPlan,
} from "../../delivery-challenge/src";
import type {
  DocumentAssertion,
} from "../../module-challenge/src";
import type {
  ContractDocumentResult,
  ContractFamilyResult,
} from "../../contract-parser/src";
import type {
  DelayClaimsModel,
} from "../../delay-analysis-core/src";
import type {
  ContractTimeBasis,
} from "../../eot-assessment/src";
import type {
  ExternalProgressEvidence,
} from "../../progress-report/src";
import type {
  CanonicalQuantityProgressModel,
} from "../../quantity-progress-core/src";
import type {
  CanonicalResourceModel,
} from "../../schedule-resource-core/src";
import type {
  ScheduleRevision,
} from "../../schedule-revision-core/src";
import type {
  ReadinessDimensionKey,
  ReadinessEvidence,
} from "../../lookahead-schedule/src";
import type {
  BoardReportPublicationInput,
  BoardReadyReport,
} from "../../board-report/src";
import type {
  BondRecord,
  ClaimCommercialRecord,
  HseIncidentRecord,
  InvoiceRecord,
  NcrRecord,
  PermitRecord,
  RetentionRecord,
  RfiRecord,
  VariationRecord,
  MoneyValue,
} from "../../project-director/src";

export type EvidenceCategory =
  | "schedule"
  | "schedule_control"
  | "contract"
  | "boq_cost"
  | "risk_claims_procurement"
  | "correspondence"
  | "engineering"
  | "hse_quality_fm"
  | "tender_commissioning"
  | "other";

export type EvidenceParserState =
  | "stored"
  | "identified"
  | "ocr_pending"
  | "parsed"
  | "partial"
  | "unsupported"
  | "error";

export type EvidenceUploadIntent =
  | "add_update"
  | "replace_current_basis";

export type EvidenceBasisState =
  | "active"
  | "superseded"
  | "additive"
  | "scenario"
  | "candidate"
  | "historical";

export type EvidenceFamilyBehavior =
  | "schedule_special"
  | "boq_special"
  | "contract_delta"
  | "contract_replacement"
  | "snapshot"
  | "additive"
  | "reference";

export interface EvidenceBasisRecord {
  familyKey: string;
  behavior: EvidenceFamilyBehavior;
  activeDocumentId: string | null;
  activeArtifactId: string | null;
  updatedAt: string;
  reason: string;
  previousDocumentIds: string[];
}

export interface EvidenceBasisEffect {
  familyKey: string;
  behavior: EvidenceFamilyBehavior;
  intent: EvidenceUploadIntent;
  logicalDocumentKey: string;
  basisState: EvidenceBasisState;
  previousActiveDocumentId: string | null;
  activeDocumentId: string | null;
  changedActiveBasis: boolean;
  reason: string;
}

export interface EvidenceRerunReceipt {
  receiptId: string;
  projectId: string;
  generatedAt: string;
  projectVersion: number;
  evidenceFingerprint: string;
  activeBasis: Record<string, EvidenceBasisRecord>;
  evidenceChanges:
    EvidenceBasisEffect[];
  moduleCount: number;
  moduleResults: Array<{
    key: string;
    status: "ready" | "partial" | "blocked";
  }>;
  pmoRecalculated: boolean;
  directorRecalculated: boolean;
  boardPublicationState:
    | "none"
    | "current"
    | "stale";
  certification: {
    state: "pass" | "fail";
    checkCount: number;
    failedCheckIds: string[];
    checks: Array<{
      checkId: string;
      state:
        | "pass"
        | "fail"
        | "not_applicable";
      detail: string;
      values: Array<{
        source: string;
        value: unknown;
      }>;
    }>;
  };
  diagnostics: string[];
}

export interface PublishedBoardReportRecord {
  publicationId: string;
  basisVersion: number;
  sourceManifestId: string | null;
  evidenceReceiptIds: string[];
  finalizedAt: string;
  stale: boolean;
  staleAt: string | null;
  reportSnapshot:
    BoardReadyReport | null;
}

export interface DelayEventVersionRecord {
  eventId: string;
  version: number;
  fingerprint: string;
  effectiveAt: string;
  supersedesVersion: number | null;
  evidenceRevisionId: string;
  snapshot: unknown;
}

export type EvidenceIdentificationMethod =
  | "signature"
  | "native_text"
  | "ocr_sample"
  | "tabular_content"
  | "office_xml"
  | "metadata_fallback"
  | "unreadable";

export interface EvidenceIdentification {
  verifiedMediaType: string;
  detectedCategory: EvidenceCategory;
  detectedDocumentType: string;
  confidence: number;
  method: EvidenceIdentificationMethod;
  ocrUsed: boolean;
  ocrConfidence: number | null;
  pageCount: number | null;
  extractedCharacterCount: number;
  detectedTitle: string | null;
  filenameHintCategory: EvidenceCategory;
  filenameHintDocumentType: string;
  declaredCategory: string | null;
  declaredDocumentType: string | null;
  classificationConflict: boolean;
  needsReview: boolean;
  signals: string[];
  diagnostics: string[];
}

export type EvidenceChangeEffect =
  | "original"
  | "delta_amendment"
  | "variation_order"
  | "full_replacement"
  | "revision_snapshot"
  | "supplement"
  | "unknown";

export interface EvidenceLineage {
  effect: EvidenceChangeEffect;
  predecessorDocumentIds: string[];
  replacesEntireBasis: boolean;
  appliesAsDelta: boolean;
  inferred: boolean;
  confidence: number;
  needsReview: boolean;
  diagnostics: string[];
}

export interface EvidenceMappingSummary {
  method:
    | "explicit_column"
    | "exact_text_reference";
  rowCount: number | null;
  linkedActivityField: string | null;
  linkedActivityCount: number | null;
  mappedActivityCount: number | null;
  unmappedActivityCount: number | null;
  coveragePercent: number | null;
}

export interface EvidenceTextSegment {
  segmentId: string;
  producerVersion: string;
  kind: "linked_correspondence_context";
  anchor: string;
  pageNumber: number | null;
  text: string;
  locator: string;
  method: "native_pdf_text" | "ocr_text";
  sourceHashSha256: string;
}

export interface CorrespondenceNarrativeRefreshReceipt {
  producerVersion: string;
  sourceHashSha256: string;
  anchorSetHashSha256: string;
  totalPages: number;
  nativePages: number;
  ocrPages: number;
  ocrFailedPages: number;
  unresolvedAnchorCount: number;
  completedAt: string;
}

export interface StoredEvidenceDocument {
  documentId: string;
  category: EvidenceCategory;
  documentType: string;
  sourceFilename: string;
  sourceRelativePath: string | null;
  mediaType: string;
  sourceHashSha256: string;
  sizeBytes: number;
  uploadedAt: string;
  authority: "candidate_only";
  parserState: EvidenceParserState;
  storedPath: string;
  linkedArtifactId: string | null;
  scheduleRole: StoredScheduleRevision["role"] | null;
  mapping: EvidenceMappingSummary | null;
  identification: EvidenceIdentification;
  lineage: EvidenceLineage;
  assertions: DocumentAssertion[];
  textSegments?: EvidenceTextSegment[];
  hseSummary?: import("./hse-report-evidence").HseReportSummary;
  correspondenceNarrativeRefresh?: CorrespondenceNarrativeRefreshReceipt;
  uploadIntent: EvidenceUploadIntent;
  familyKey: string;
  logicalDocumentKey: string;
  basisState: EvidenceBasisState;
  supersededByDocumentId: string | null;
  supersedesDocumentIds: string[];
  diagnostics: string[];
}

export interface EvidenceUploadSummary {
  documentId: string;
  category: EvidenceCategory;
  documentType: string;
  sourceFilename: string;
  parserState: EvidenceParserState;
  linkedArtifactId: string | null;
  scheduleRole: StoredScheduleRevision["role"] | null;
  mapping: EvidenceMappingSummary | null;
  identification: EvidenceIdentification;
  lineage: EvidenceLineage;
  assertionCount: number;
  basisEffect: EvidenceBasisEffect;
  diagnostics: string[];
}

export type ScheduleUploadFormat =
  | "xer"
  | "primavera_xml"
  | "schedule_xlsx"
  | "schedule_csv";

export interface StoredScheduleRevision {
  revision: ScheduleRevision;
  format: ScheduleUploadFormat;
  sourceFilename: string | null;
  sourceHashSha256: string;
  uploadedAt: string;
  role:
    | "baseline"
    | "update"
    | "recovery"
    | "revised_baseline"
    | "other";
}

export interface StoredContractDocument {
  documentId: string;
  role:
    | "main"
    | "amendment"
    | "appendix"
    | "tender"
    | "replacement"
    | "other";
  lineage: EvidenceLineage;
  sourceFilename: string | null;
  sourceHashSha256: string;
  uploadedAt: string;
  result: ContractDocumentResult;
}

export interface RiskControlRecord {
  riskId: string;
  raisedIso?: string | null;
  closedIso?: string | null;
  statusAsOfIso?: string | null;
  sourceStatus?: string;
  status:
    | "open"
    | "closed"
    | "unknown";
  rating: string | null;
  owner: string | null;
  dueIso: string | null;
  sourceRefs: string[];
}

export interface DerivedControlEvidence {
  variations?: VariationRecord[];
  invoices?: InvoiceRecord[];
  retentions?: RetentionRecord[];
  bonds?: BondRecord[];
  claimCommercials?: ClaimCommercialRecord[];
  ncrs?: NcrRecord[];
  rfis?: RfiRecord[];
  risks?: RiskControlRecord[];
  delayClaims?: DelayClaimsModel;
  contractTimeBasis?: ContractTimeBasis;
}

export interface ProjectControlState {
  delayClaims: DelayClaimsModel | null;
  contractTimeBasis: ContractTimeBasis | null;
  readinessEvidence: Record<
    string,
    Partial<
      Record<
        ReadinessDimensionKey,
        ReadinessEvidence
      >
    >
  >;
  progressEvidence: {
    physical?: ExternalProgressEvidence;
    contractorReported?: ExternalProgressEvidence;
    certified?: ExternalProgressEvidence;
  };
  contractValue: MoneyValue | null;
  variations: VariationRecord[];
  invoices: InvoiceRecord[];
  retentions: RetentionRecord[];
  bonds: BondRecord[];
  claimCommercials: ClaimCommercialRecord[];
  hseIncidents: HseIncidentRecord[];
  ncrs: NcrRecord[];
  rfis: RfiRecord[];
  permits: PermitRecord[];
  risks: RiskControlRecord[];
  boardPublication:
    | BoardReportPublicationInput
    | null;
}

export interface ProjectRuntimeState {
  sourceIntegrationVersion?: string;
  projectId: string;
  version: number;
  demo: boolean;
  schedules: StoredScheduleRevision[];
  evidenceDocuments: StoredEvidenceDocument[];
  resourcesByRevision: Map<
    string,
    CanonicalResourceModel
  >;
  boq: BoqIngestionResult | null;
  boqRevisions: BoqIngestionResult[];
  quantities:
    CanonicalQuantityProgressModel | null;
  contract: ContractDocumentResult | null;
  contractDocuments: StoredContractDocument[];
  contractFamily: ContractFamilyResult | null;
  submittedManpowerPlan:
    SubmittedManpowerPlan | null;
  activeEvidenceBasis:
    Record<string, EvidenceBasisRecord>;
  boardPublicationHistory:
    PublishedBoardReportRecord[];
  delayEventHistory:
    DelayEventVersionRecord[];
  derivedControlsByDocument:
    Record<
      string,
      DerivedControlEvidence
    >;
  derivedReadinessByDocument:
    Record<
      string,
      Record<
        string,
        Partial<
          Record<
            ReadinessDimensionKey,
            ReadinessEvidence
          >
        >
      >
    >;
  lastRerunReceipt:
    EvidenceRerunReceipt | null;
  controls: ProjectControlState;
}

export interface ScheduleUploadSummary {
  projectId: string;
  revisionId: string;
  sequence: number;
  role: StoredScheduleRevision["role"];
  format: ScheduleUploadFormat;
  sourceFilename: string | null;
  sourceHashSha256: string;
  uploadedAt: string;
  dataDateIso: string | null;
  activityCount: number;
  relationshipCount: number;
  resourceAssignmentCount: number | null;
  diagnosticCount: number;
}

export interface ModuleRuntimeResult {
  issueAssessment?: import('../../truth-kernel/src').ControlIssueAssessment | undefined;
  key: string;
  /** Compatibility status derived from professional defensibility. */
  status:
    | "ready"
    | "partial"
    | "blocked";
  engineState?:
    | "ready"
    | "blocked"
    | "failed";
  evidenceState?:
    | "established"
    | "partial"
    | "missing"
    | "conflicted";
  professionalState?:
    | "defensible"
    | "review_required"
    | "not_defensible";
  reason: string | null;
  dependencies: string[];
  data: unknown | null;
}

export interface ProjectRuntimeOverview {
  projectId: string;
  releaseCommitSha?: string | null;
  version: number;
  demo: boolean;
  revisionCount: number;
  baselineRevisionCount: number;
  updateRevisionCount: number;
  recoveryRevisionCount: number;
  evidenceDocumentCount: number;
  evidenceCategoryCounts: Record<string, number>;
  latestRevisionId: string | null;
  latestRevisionLabel?: string | null;
  latestDataDateIso: string | null;
  boqState: string | null;
  contractLoaded: boolean;
  delayClaimsLoaded: boolean;
  minimumEvidenceBasis: {
    schedule: {
      required: true;
      established: boolean;
      revisionCount: number;
      latestRevisionId: string | null;
      latestDataDateIso: string | null;
    };
    boq: {
      required: true;
      established: boolean;
      revisionCount: number;
      currentIngestionId: string | null;
    };
    ready: boolean;
  };
  optionalEvidence: Array<{
    documentType: string;
    count: number;
    latestUploadedAt: string;
  }>;
  activeEvidenceBasis:
    Record<
      string,
      EvidenceBasisRecord
    >;
  lastRerunReceipt:
    EvidenceRerunReceipt | null;
  boardPublicationHistory:
    PublishedBoardReportRecord[];
  managementStates: Array<{
    issueAssessment?: import('../../truth-kernel/src').ControlIssueAssessment | undefined;
    key: string;
    status: "ready" | "partial" | "blocked";
    reason: string | null;
  }>;
  moduleStates: Array<{
    issueAssessment?: import('../../truth-kernel/src').ControlIssueAssessment | undefined;
    key: string;
    status:
      | "ready"
      | "partial"
      | "blocked";
    reason: string | null;
  }>;
}
