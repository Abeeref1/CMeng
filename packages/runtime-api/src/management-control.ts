import {
  directorForProject,
  overviewForProject,
} from "./project-projections";
import {
  commercialPositionForState,
} from "./commercial-runtime";
import {
  runtimeProjects,
} from "./project-state";

export type ManagementAuthority =
  | "source_current"
  | "calculated"
  | "provisional"
  | "governed"
  | "stale"
  | "partial"
  | "conflicted"
  | "unavailable";

export interface ManagementMetric {
  key: string;
  label: string;
  value: string | number | null;
  unit: string | null;
  authority: ManagementAuthority;
  owningModule: string;
  sourceRefs: string[];
  consequence: string | null;
}

export interface ManagementControlSurfaces {
  schemaVersion: "1.0";
  projectId: string;
  generatedAt: string;
  evidenceVersion: number;
  dashboard: {
    purpose: "executive_kpi_position";
    metrics: ManagementMetric[];
    moduleStatus: Array<{
      key: string;
      status: "ready" | "partial" | "blocked";
      reason: string | null;
    }>;
  };
  commandCenter: {
    purpose: "operational_priority_control";
    programme: ManagementMetric[];
    commercialByCurrency: Array<{
      currency: string;
      pendingVariationAmount: number;
      approvedVariationAmount: number;
      certifiedUnpaidAmount: number;
      retentionHeldAmount: number;
      activeBondAmount: number;
      claimClaimedAmount: number;
      claimAssessedAmount: number;
      ldScenarioAmount: number | null;
    }>;
    priorities: Array<{
      priority: "critical" | "high" | "normal";
      action: string;
      owningModule: string;
      approvalRequired: boolean;
    }>;
    evidenceGaps: Array<{
      domain: string;
      state: ManagementAuthority;
      correctionPath: string;
    }>;
  };
  masterControlProgramme: {
    purpose: "integrated_governance_control";
    revisionAuthority: {
      latestRevisionId: string | null;
      latestRevisionLabel: string | null;
      dataDateIso: string | null;
      baselineRevisionCount: number;
      updateRevisionCount: number;
      recoveryRevisionCount: number;
    };
    evidenceBasis: unknown;
    specialistPositions: Array<{
      key: string;
      health: "ready" | "partial" | "blocked";
      authority: ManagementAuthority;
      owningModule: string;
      correctionPath: string;
    }>;
    boardPublication: {
      state: "none" | "current" | "stale";
      publicationId: string | null;
      finalizedAt: string | null;
    };
    invariants: {
      aiCandidateIsNeverOfficial: true;
      observedWbsIsNeverApprovedWorkPackageByInference: true;
      scheduleForecastDoesNotChangeContractCompletion: true;
      claimedEotIsNotAwardedEot: true;
      missingIsNotZero: true;
      owningModuleRemainsSourceOfCorrection: true;
    };
  };
}

function metric(
  key: string,
  label: string,
  value: string | number | null,
  unit: string | null,
  authority: ManagementAuthority,
  owningModule: string,
  sourceRefs: string[] = [],
  consequence: string | null = null,
): ManagementMetric {
  return {
    key,
    label,
    value,
    unit,
    authority,
    owningModule,
    sourceRefs: [...new Set(sourceRefs)],
    consequence,
  };
}

function evidenceAuthority(
  state: "established" | "submitted_unparsed" | "not_submitted",
): ManagementAuthority {
  if (state === "established") return "governed";
  if (state === "submitted_unparsed") return "partial";
  return "unavailable";
}

export function managementControlForProject(
  projectId: string,
): ManagementControlSurfaces | null {
  const state = runtimeProjects.get(projectId);
  if (!state) return null;

  const overview = overviewForProject(projectId);
  const director = directorForProject(projectId);
  if (!overview || !director) return null;

  const commercial = commercialPositionForState(state);
  const publication =
    overview.boardPublicationHistory.at(-1) ?? null;

  const programme = [
    metric(
      "data_date",
      "Data date",
      director.schedule.dataDateIso,
      null,
      director.schedule.dataDateIso ? "source_current" : "unavailable",
      "Programme Review",
    ),
    metric(
      "contractual_completion",
      "Contractual completion",
      director.schedule.contractualCompletionIso,
      null,
      director.schedule.contractualCompletionIso ? "governed" : "unavailable",
      "Contract Particulars & Bonds",
    ),
    metric(
      "adjusted_completion",
      "Official adjusted completion",
      director.schedule.officialAdjustedCompletionIso,
      null,
      director.schedule.officialAdjustedCompletionIso ? "governed" : "unavailable",
      "EOT Position",
    ),
    metric(
      "independent_forecast",
      "CMeng completion forecast",
      director.schedule.independentForecastCompletionIso,
      null,
      director.schedule.independentForecastAuthority === "deterministic"
        ? "calculated"
        : director.schedule.independentForecastAuthority === "scenario"
          ? "provisional"
          : "unavailable",
      "Independent Forecast",
    ),
    metric(
      "critical_count",
      "Critical activities",
      director.schedule.criticalCount,
      "activities",
      "calculated",
      "Programme Review",
    ),
    metric(
      "near_critical_count",
      "Near-critical activities",
      director.schedule.nearCriticalCount,
      "activities",
      "calculated",
      "Near-Critical & Float Risk",
    ),
    metric(
      "overdue_lookahead",
      "Overdue look-ahead activities",
      director.schedule.overdueLookAheadCount,
      "activities",
      "calculated",
      "Look-Ahead",
    ),
    metric(
      "approved_eot",
      "Approved EOT",
      director.claims.officialApprovedEotDays,
      "days",
      director.claims.officialApprovedEotDays === null
        ? "unavailable"
        : "governed",
      "EOT Position",
    ),
  ];

  const evidenceGaps = [
    ["Claims", director.claims.evidenceState, "Claims & Notices"],
    ["Risk", director.controls.riskEvidenceState, "Risk Register"],
    ["HSE", director.controls.hseEvidenceState, "HSE"],
    ["Quality", director.controls.qualityEvidenceState, "Quality / NCR"],
    ["RFI", director.controls.rfiEvidenceState, "RFI Register"],
    ["Permits", director.controls.permitEvidenceState, "Permits"],
    ["Bonds", director.controls.bondEvidenceState, "Contract Particulars & Bonds"],
  ] as const;

  const priorities = director.managementActions.map((action) => ({
    priority:
      /critical|overdue|expired|unattributed|claim/i.test(action)
        ? "high" as const
        : "normal" as const,
    action,
    owningModule:
      /claim|eot|delay/i.test(action)
        ? "Claims / EOT"
        : /rfi/i.test(action)
          ? "RFI"
          : /permit/i.test(action)
            ? "Permits"
            : /ncr/i.test(action)
              ? "Quality / NCR"
              : /board report/i.test(action)
                ? "Board Reporting"
                : "Project Controls",
    approvalRequired: false,
  }));

  const moduleStatus = overview.moduleStates.map((item) => ({
    key: item.key,
    status: item.status,
    reason: item.reason ?? null,
  }));

  const dashboardMetrics: ManagementMetric[] = [
    ...programme,
    metric(
      "open_risks",
      "Open risks",
      director.controls.openRiskCount,
      "risks",
      evidenceAuthority(director.controls.riskEvidenceState),
      "Risk Register",
    ),
    metric(
      "claim_count",
      "Claims",
      director.claims.claimCount,
      "claims",
      evidenceAuthority(director.claims.evidenceState),
      "Claims & Notices",
    ),
    metric(
      "unlinked_claims",
      "Unlinked claims",
      director.claims.evidenceState === "established"
        ? director.claims.unlinkedClaimIds.length
        : null,
      "claims",
      evidenceAuthority(director.claims.evidenceState),
      "Delay Events & Claims",
    ),
  ];

  for (const currency of commercial.currencies) {
    dashboardMetrics.push(
      metric(
        "current_contract_value_" + currency.currency,
        "Current contract value (" + currency.currency + ")",
        currency.currentContractValue.value,
        currency.currency,
        currency.currentContractValue.state === "established"
          ? "governed"
          : currency.currentContractValue.state === "candidate"
            ? "provisional"
            : "unavailable",
        "Commercial Overview",
        currency.currentContractValue.sourceRefs,
      ),
      metric(
        "certified_unpaid_" + currency.currency,
        "Certified unpaid (" + currency.currency + ")",
        currency.certifiedUnpaidAmount.value,
        currency.currency,
        currency.certifiedUnpaidAmount.state === "established"
          ? "calculated"
          : currency.certifiedUnpaidAmount.state === "submitted_unparsed"
            ? "partial"
            : "unavailable",
        "Payments",
        currency.certifiedUnpaidAmount.sourceRefs,
      ),
    );
  }

  return {
    schemaVersion: "1.0",
    projectId,
    generatedAt: new Date().toISOString(),
    evidenceVersion: state.version,
    dashboard: {
      purpose: "executive_kpi_position",
      metrics: dashboardMetrics,
      moduleStatus,
    },
    commandCenter: {
      purpose: "operational_priority_control",
      programme,
      commercialByCurrency: director.commercialByCurrency.map((row) => ({
        ...row,
      })),
      priorities,
      evidenceGaps: evidenceGaps
        .filter(([, evidenceState]) => evidenceState !== "established")
        .map(([domain, evidenceState, correctionPath]) => ({
          domain,
          state: evidenceAuthority(evidenceState),
          correctionPath,
        })),
    },
    masterControlProgramme: {
      purpose: "integrated_governance_control",
      revisionAuthority: {
        latestRevisionId: overview.latestRevisionId,
        latestRevisionLabel: overview.latestRevisionLabel ?? null,
        dataDateIso: overview.latestDataDateIso,
        baselineRevisionCount: overview.baselineRevisionCount,
        updateRevisionCount: overview.updateRevisionCount,
        recoveryRevisionCount: overview.recoveryRevisionCount,
      },
      evidenceBasis: JSON.parse(JSON.stringify(overview.activeEvidenceBasis)),
      specialistPositions: moduleStatus.map((item) => ({
        key: item.key,
        health: item.status,
        authority:
          item.status === "ready"
            ? "governed"
            : item.status === "partial"
              ? "partial"
              : "unavailable",
        owningModule: item.key,
        correctionPath: item.key,
      })),
      boardPublication: {
        state:
          publication === null
            ? "none"
            : publication.stale
              ? "stale"
              : "current",
        publicationId: publication?.publicationId ?? null,
        finalizedAt: publication?.finalizedAt ?? null,
      },
      invariants: {
        aiCandidateIsNeverOfficial: true,
        observedWbsIsNeverApprovedWorkPackageByInference: true,
        scheduleForecastDoesNotChangeContractCompletion: true,
        claimedEotIsNotAwardedEot: true,
        missingIsNotZero: true,
        owningModuleRemainsSourceOfCorrection: true,
      },
    },
  };
}
