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
  key: string;
  label: string;
  group: string;
  status:
    | "ready"
    | "partial"
    | "blocked";
  reason: string | null;
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
  };
  commercialByCurrency:
    ProjectDirectorPosition["commercialByCurrency"];
  evidenceDocumentCount: number;
  diagnostics: string[];
}

export interface CommandCenterProjection {
  schemaVersion: "1.0";
  projectionKey: "command_center";
  generatedAt: string;
  projectId: string;
  programmePosition: ManagementMetric[];
  alerts: ManagementAlert[];
  decisions: ManagementDecision[];
  evidenceGaps: ManagementEvidenceGapInput[];
  commercialByCurrency:
    ProjectDirectorPosition["commercialByCurrency"];
  controls:
    ProjectDirectorPosition["controls"] | null;
  diagnostics: string[];
}

export interface MasterControlProgrammeProjection {
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
