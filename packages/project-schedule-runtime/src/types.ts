import type {
  ScheduleRevision,
} from "../../schedule-revision-core/src";
import type {
  CanonicalResourceModel,
} from "../../schedule-resource-core/src";
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

export interface ProjectScheduleRuntimeContext {
  generatedAt: string;
  producerVersion: string;
  revisions: ScheduleRevision[];
  resourceModel?: CanonicalResourceModel;
  quantityModel?: CanonicalQuantityProgressModel;
  delayClaimsModel?: DelayClaimsModel;
  contract?: ContractDocumentResult;
  eotContractContext?: EotContractContext;
  progressSnapshots?: ActualProgressSnapshot[];
  progressEvidence?: {
    physical?: ExternalProgressEvidence;
    contractorReported?: ExternalProgressEvidence;
    certified?: ExternalProgressEvidence;
  };
  readinessEvidence?: Record<
    string,
    Partial<
      Record<
        ReadinessDimensionKey,
        ReadinessEvidence
      >
    >
  >;
}

export interface EvidenceRequiredResult {
  status: "evidence_required";
  moduleKey: string;
  missingEvidence: string[];
  message: string;
}

export interface AvailableModuleResult {
  status: "available";
  moduleKey: string;
  projection: unknown;
}

export type ProjectModuleResult =
  | EvidenceRequiredResult
  | AvailableModuleResult;

import type {
  BondRecord,
  BoardEvidenceRecord,
  ClaimCommercialRecord,
  HseIncidentRecord,
  InvoiceRecord,
  MoneyValue,
  NcrRecord,
  PermitRecord,
  ProjectDirectorPosition,
  RetentionRecord,
  RfiRecord,
  VariationRecord,
} from "../../project-director/src";

export interface ProjectDirectorRuntimeEvidence {
  contractValue?: MoneyValue;
  variations: VariationRecord[];
  invoices: InvoiceRecord[];
  retentions: RetentionRecord[];
  bonds: BondRecord[];
  claimCommercials: ClaimCommercialRecord[];
  hseIncidents: HseIncidentRecord[];
  ncrs: NcrRecord[];
  rfis: RfiRecord[];
  permits: PermitRecord[];
  boardEvidence: BoardEvidenceRecord | null;
}

export interface ProjectDirectorRuntimeResult {
  status: "available" | "evidence_required";
  missingEvidence: string[];
  position: ProjectDirectorPosition | null;
}
