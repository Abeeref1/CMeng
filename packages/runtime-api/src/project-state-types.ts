import type {
  BoqIngestionResult,
} from "../../boq-ingestion/src";
import type {
  ContractDocumentResult,
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
  boardPublication:
    | BoardReportPublicationInput
    | null;
}

export interface ProjectRuntimeState {
  projectId: string;
  version: number;
  demo: boolean;
  schedules: StoredScheduleRevision[];
  resourcesByRevision: Map<
    string,
    CanonicalResourceModel
  >;
  boq: BoqIngestionResult | null;
  quantities:
    CanonicalQuantityProgressModel | null;
  contract: ContractDocumentResult | null;
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
  key: string;
  status:
    | "ready"
    | "partial"
    | "blocked";
  reason: string | null;
  dependencies: string[];
  data: unknown | null;
}

export interface ProjectRuntimeOverview {
  projectId: string;
  version: number;
  demo: boolean;
  revisionCount: number;
  latestRevisionId: string | null;
  latestDataDateIso: string | null;
  boqState: string | null;
  contractLoaded: boolean;
  delayClaimsLoaded: boolean;
  moduleStates: Array<{
    key: string;
    status:
      | "ready"
      | "partial"
      | "blocked";
    reason: string | null;
  }>;
}
