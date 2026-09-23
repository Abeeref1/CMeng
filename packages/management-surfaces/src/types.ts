import type {
  ProjectDirectorPosition,
} from "../../project-director/src";

export type ManagementSurfaceKey =
  | "master-dashboard"
  | "command-center"
  | "master-control-programme";

export type ManagementHealth =
  | "good"
  | "attention"
  | "critical"
  | "unavailable";

export type ManagementAuthority =
  | "source"
  | "submitted"
  | "official"
  | "calculated"
  | "governed"
  | "provisional"
  | "unavailable";

export type ManagementValueState =
  | "source_current"
  | "calculated"
  | "provisional"
  | "governed"
  | "stale"
  | "partial"
  | "conflicted"
  | "unavailable";

export interface ManagementModuleInput {
  issueAssessment?: import('../../truth-kernel/src').ControlIssueAssessment | undefined;
  key: string;
  label: string;
  group: string;
  status:
    | "ready"
    | "partial"
    | "blocked";
  reason: string | null;
  calculationState?: "checked" | "pending" | "failed";
  evidenceState?: string;
  consistencyState?: "pass" | "fail" | "pending";
  professionalState?: string;
}

export interface ManagementConsistency {
  state: "pass" | "fail" | "pending";
  checkCount: number;
  failedCheckIds: string[];
  scope: string;
}

export interface ManagementEvidenceGapInput {
  key: string;
  label: string;
  state:
    | "established"
    | "partial"
    | "missing"
    | "stale"
    | "conflicted";
  action: string;
  owningModule: string | null;
}

export interface ManagementCandidateInput {
  candidateId: string;
  type: string;
  label: string;
  sourceRef: string;
  status:
    | "pending_review"
    | "promoted"
    | "rejected"
    | "deferred";
  owningModule: string | null;
  classification?: { recordedDocumentType: string; reviewRequired: boolean; reason: string | null };
}

export interface ManagementHistoryInput {
  eventId: string;
  occurredAt: string;
  entity: string;
  action: string;
  actor: string | null;
  state: string;
  sourceRef: string | null;
}

export interface RevisionAuthorityInput {
  baselineRevisionId: string | null;
  baselineLabel: string | null;
  currentRevisionId: string | null;
  currentLabel: string | null;
  currentDataDateIso: string | null;
  governedRevisionCount: number;
  recoveryScenarioCount: number;
  correctionModule: string;
}

export interface WbsControlInput {
  observedWbsCount: number;
  observedWbsLabels: string[];
  activityCount: number;
  activitiesWithWbs: number;
  observedCoveragePercent: number | null;
  officialWorkPackageCoveragePercent: number | null;
  officialWorkPackageState:
    | "established"
    | "not_established";
}

export interface CommercialManagementInput {
  variationReconciliation?: Array<{
    currency: string;
    taxBasis: string;
    sourceAggregate: number | null;
    sourceState: string;
    datedApprovedAmount: number | null;
    datedApprovedCount: number;
    futureCount: number;
    undatedCount: number;
    state: "consistent" | "conflicted" | "not_established";
  }>;
  overdueUnpaidPayments: number | null;
  paidLatePayments: number | null;
  lateNotices: number | null;
  notIssuedNotices: number | null;
  evmByCurrency: Array<{
    currency: string;
    cv: number | null;
    spi: number | null;
    cpi: number | null;
    state:
      | "established"
      | "partial"
      | "missing";
  }>;
}

export interface ManagementSurfacesInput {
  schemaVersion: "1.0";
  projectId: string;
  generatedAt: string;
  director: ProjectDirectorPosition | null;
  modules: ManagementModuleInput[];
  consistency?: ManagementConsistency;
  negativeFloatCount?: number | null;
  contractualCompletionAuthority?: "official" | "source" | "provisional";
  evidenceDocumentCount: number;
  evidenceGaps: ManagementEvidenceGapInput[];
  candidates: ManagementCandidateInput[];
  history: ManagementHistoryInput[];
  revisionAuthority: RevisionAuthorityInput;
  wbsControl: WbsControlInput;
  commercial: CommercialManagementInput;
  boardPublicationState:
    | "current"
    | "stale"
    | "none";
}

export interface ManagementMetric {
  key: string;
  label: string;
  value:
    | string
    | number
    | null;
  unit: string | null;
  state: ManagementValueState;
  authority: ManagementAuthority;
  health: ManagementHealth;
  basis: string;
  consequence: string | null;
  action: string | null;
  owningModule: string | null;
}

export interface ManagementAlert {
  alertId: string;
  severity:
    | "critical"
    | "high"
    | "medium"
    | "information";
  title: string;
  consequence: string;
  action: string;
  owningModule: string | null;
  state:
    | "open"
    | "evidence_gap";
}

export interface ManagementDecision {
  decisionId: string;
  description: string;
  accountableOwner: string | null;
  dueDate: string | null;
  requiredAuthority: string | null;
  dependencyParty: string | null;
  state:
    | "open"
    | "not_assigned";
  source: "project_director";
}

export interface MasterDashboardProjection {
  issueAssessment?: import('../../truth-kernel/src').ControlIssueAssessment | undefined;
  schemaVersion: "1.0";
  projectionKey: "master_dashboard";
  generatedAt: string;
  projectId: string;
  metrics: ManagementMetric[];
  readiness: {
    ready: number;
    partial: number;
    blocked: number;
    total: number;
    calculationAvailable: number;
    evidenceGapCount: number;
    governanceGapCount: number;
  };
  consistency: ManagementConsistency;
  variationReconciliation: NonNullable<CommercialManagementInput["variationReconciliation"]>;
  commercialByCurrency:
    ProjectDirectorPosition["commercialByCurrency"];
  evidenceDocumentCount: number;
  diagnostics: string[];
}

export interface CommandCenterProjection {
  issueAssessment?: import('../../truth-kernel/src').ControlIssueAssessment | undefined;
  schemaVersion: "1.0";
  projectionKey: "command_center";
  generatedAt: string;
  projectId: string;
  programmePosition: ManagementMetric[];
  alerts: ManagementAlert[];
  decisions: ManagementDecision[];
  evidenceGaps: ManagementEvidenceGapInput[];
  governanceGaps: ManagementEvidenceGapInput[];
  evidenceCoverage: ManagementEvidenceGapInput[];
  consistency: ManagementConsistency;
  variationReconciliation: NonNullable<CommercialManagementInput["variationReconciliation"]>;
  commercialByCurrency:
    ProjectDirectorPosition["commercialByCurrency"];
  controls:
    ProjectDirectorPosition["controls"] | null;
  diagnostics: string[];
}

export interface MasterControlProgrammeProjection {
  issueAssessment?: import('../../truth-kernel/src').ControlIssueAssessment | undefined;
  schemaVersion: "1.0";
  projectionKey:
    "master_control_programme";
  generatedAt: string;
  projectId: string;
  scope: {
    programme: string | null;
    project: string;
    selectedPackage: string | null;
    programmeMembershipState:
      | "established"
      | "not_established";
    projectClassification:
      string | null;
  };
  revisionAuthority:
    RevisionAuthorityInput;
  wbsControl: WbsControlInput;
  specialistPositions:
    ManagementModuleInput[];
  alerts: ManagementAlert[];
  candidateInbox:
    ManagementCandidateInput[];
  controlHistory:
    ManagementHistoryInput[];
  evidenceGaps:
    ManagementEvidenceGapInput[];
  governanceGaps: ManagementEvidenceGapInput[];
  evidenceCoverage: ManagementEvidenceGapInput[];
  consistency: ManagementConsistency;
  diagnostics: string[];
}

export interface ManagementSurfacesProjection {
  schemaVersion: "1.0";
  projectionKey:
    "management_surfaces";
  generatedAt: string;
  projectId: string;
  masterDashboard:
    MasterDashboardProjection;
  commandCenter:
    CommandCenterProjection;
  masterControlProgramme:
    MasterControlProgrammeProjection;
}
