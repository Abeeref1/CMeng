import {
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  type CanonicalScheduleActivity,
  type CanonicalScheduleModel,
  type ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import type {
  MilestoneCriticality,
  MilestoneDueState,
  MilestoneManagementFlag,
  MilestoneManagementPriority,
  MilestoneRow,
  MilestonesProjection,
} from "./types";

function dateMs(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function currentDate(
  activity: CanonicalScheduleActivity,
): string | null {
  if (
    activity.status === "completed" &&
    activity.actualFinishIso
  ) {
    return activity.actualFinishIso;
  }
  return (
    activity.forecastFinishIso ??
    activity.currentFinishIso ??
    activity.currentStartIso
  );
}

function daysBetween(
  from: string | null,
  to: string | null,
): number | null {
  const fromMs = dateMs(from);
  const toMs = dateMs(to);
  if (fromMs === null || toMs === null) {
    return null;
  }
  return Number(
    ((toMs - fromMs) / 86_400_000).toFixed(6),
  );
}

function coverage(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

function dueState(
  status: MilestoneRow["status"],
  daysFromDataDate: number | null,
): MilestoneDueState {
  if (status === "completed") return "completed";
  if (daysFromDataDate === null) return "unknown";
  if (daysFromDataDate < 0) return "overdue";
  if (daysFromDataDate <= 30) return "due_30_days";
  if (daysFromDataDate <= 90) return "due_90_days";
  return "future";
}

function criticality(
  totalFloatHours: number | null,
  config: ScheduleAnalysisConfig,
): MilestoneCriticality {
  if (totalFloatHours === null) return "unknown";
  if (
    totalFloatHours <=
    config.criticalFloatThresholdHours
  ) {
    return "critical";
  }
  if (
    totalFloatHours <=
    config.nearCriticalFloatThresholdHours
  ) {
    return "near_critical";
  }
  return "positive_float";
}

function managementFlags(
  row: MilestoneRow,
): MilestoneManagementFlag[] {
  const flags: MilestoneManagementFlag[] = [];

  if (row.status !== "completed") {
    if (row.criticality === "critical") {
      flags.push("CRITICAL_PATH");
    }
    if (row.negativeFloat) {
      flags.push("NEGATIVE_FLOAT");
    }
    if (row.criticality === "near_critical") {
      flags.push("NEAR_CRITICAL");
    }
    if (row.dueState === "overdue") {
      flags.push("OVERDUE");
    }
    if (row.dueState === "due_30_days") {
      flags.push("DUE_WITHIN_30_DAYS");
    }
    if (row.dueState === "due_90_days") {
      flags.push("DUE_WITHIN_90_DAYS");
    }
    if (
      row.criticality === "critical" &&
      row.terminalMilestone
    ) {
      flags.push("TERMINAL_CRITICAL_MILESTONE");
    }
  }

  if (
    row.status !== "completed" &&
    typeof row.varianceDays === "number" &&
    row.varianceDays > 0
  ) {
    flags.push("LATER_THAN_BASELINE");
  }

  if (
    row.status !== "completed" &&
    row.totalFloatHours === null
  ) {
    flags.push("FLOAT_NOT_ESTABLISHED");
  }

  return flags;
}

function managementPriority(
  row: MilestoneRow,
): MilestoneManagementPriority {
  if (row.status === "completed") return "normal";

  if (
    row.negativeFloat ||
    row.criticality === "critical" ||
    row.dueState === "overdue"
  ) {
    return "critical";
  }

  if (
    row.criticality === "near_critical" ||
    row.dueState === "due_30_days"
  ) {
    return "high";
  }

  if (
    row.dueState === "due_90_days" ||
    (
      typeof row.varianceDays === "number" &&
      row.varianceDays > 0
    )
  ) {
    return "watch";
  }

  return "normal";
}

function managementAction(
  row: MilestoneRow,
): string {
  if (row.status === "completed") {
    return (
      typeof row.varianceDays === "number" &&
      row.varianceDays > 0
    )
      ? "Record the late completion and confirm any downstream consequence."
      : "No immediate recovery action. Retain as completed evidence.";
  }

  if (row.negativeFloat) {
    return "Immediate recovery required: validate driving logic, remove constraints, recover time and protect downstream milestones.";
  }

  if (row.criticality === "critical") {
    return (
      typeof row.varianceDays === "number" &&
      row.varianceDays > 0
    )
      ? "Critical-path recovery: validate the driving cause, recover lost time and confirm downstream milestone protection."
      : "Protect the critical path: confirm predecessors, resources, interfaces and approvals before the milestone date.";
  }

  if (row.dueState === "overdue") {
    return "Escalate the overdue milestone: confirm actual status, recovery date, accountable owner and downstream impact.";
  }

  if (row.criticality === "near_critical") {
    return "Protect remaining float: clear constraints and closely monitor driving predecessors and successors.";
  }

  if (row.dueState === "due_30_days") {
    return "Complete a near-term readiness check covering owner, predecessors, approvals, materials, access and resources.";
  }

  if (
    typeof row.varianceDays === "number" &&
    row.varianceDays > 0
  ) {
    return "Validate the slippage cause and confirm mitigation against the controlled baseline.";
  }

  if (row.dueState === "due_90_days") {
    return "Monitor readiness and confirm the milestone remains achievable before it enters the 30-day action window.";
  }

  return "Monitor against the current programme and controlled baseline.";
}

export function refreshMilestoneManagementControl(
  row: MilestoneRow,
): MilestoneRow {
  const withFlags: MilestoneRow = {
    ...row,
    managementPriority: "normal",
    managementFlags: [],
    managementAction:
      "Monitor against the current programme and controlled baseline.",
  };
  withFlags.managementFlags =
    managementFlags(withFlags);
  withFlags.managementPriority =
    managementPriority(withFlags);
  withFlags.managementAction =
    managementAction(withFlags);
  return withFlags;
}

export function buildMilestonesProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    config?: ScheduleAnalysisConfig;
  },
): MilestonesProjection {
  const config =
    input.config ??
    DEFAULT_SCHEDULE_ANALYSIS_CONFIG;

  const milestoneTypes = new Set([
    "milestone",
    "start_milestone",
    "finish_milestone",
  ]);

  const wbsById = new Map(
    model.wbs.map((node) => [
      node.wbsId,
      node.name,
    ]),
  );

  const criticalActivityIds = new Set(
    model.activities
      .filter(
        (activity) =>
          activity.totalFloatHours !== null &&
          activity.totalFloatHours <=
            config.criticalFloatThresholdHours,
      )
      .map((activity) => activity.activityId),
  );

  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();

  for (const relationship of model.relationships) {
    if (relationship.external) continue;
    const pred =
      relationship.predecessorActivityId;
    const succ =
      relationship.successorActivityId;
    predecessors.set(
      succ,
      [
        ...(predecessors.get(succ) ?? []),
        pred,
      ],
    );
    successors.set(
      pred,
      [
        ...(successors.get(pred) ?? []),
        succ,
      ],
    );
  }

  const rows: MilestoneRow[] =
    model.activities
      .filter((activity) =>
        milestoneTypes.has(
          activity.activityType,
        ),
      )
      .map((activity) => {
        const current = currentDate(activity);
        const daysFromDataDate = daysBetween(
          model.dataDateIso,
          current,
        );
        const activityCriticality = criticality(
          activity.totalFloatHours,
          config,
        );
        const predecessorIds =
          predecessors.get(activity.activityId) ?? [];
        const successorIds =
          successors.get(activity.activityId) ?? [];

        const base: MilestoneRow = {
          activityId: activity.activityId,
          name: activity.name,
          wbsId: activity.wbsId,
          wbsName: activity.wbsId
            ? wbsById.get(activity.wbsId) ?? null
            : null,
          activityType:
            activity.activityType,
          status: activity.status,
          baselineDateIso:
            activity.baselineFinishIso ??
            activity.baselineStartIso,
          currentDateIso: current,
          actualDateIso:
            activity.actualFinishIso ??
            activity.actualStartIso,
          totalFloatHours:
            activity.totalFloatHours,
          varianceDays: daysBetween(
            activity.baselineFinishIso ??
              activity.baselineStartIso,
            current,
          ),
          daysFromDataDate,
          dueState: dueState(
            activity.status,
            daysFromDataDate,
          ),
          criticality:
            activityCriticality,
          negativeFloat:
            activity.totalFloatHours !== null &&
            activity.totalFloatHours < 0,
          predecessorCount:
            predecessorIds.length,
          successorCount:
            successorIds.length,
          criticalPredecessorCount:
            predecessorIds.filter((id) =>
              criticalActivityIds.has(id),
            ).length,
          criticalSuccessorCount:
            successorIds.filter((id) =>
              criticalActivityIds.has(id),
            ).length,
          terminalMilestone:
            successorIds.length === 0,
          managementPriority: "normal",
          managementFlags: [],
          managementAction:
            "Monitor against the current programme and controlled baseline.",
        };

        return refreshMilestoneManagementControl(
          base,
        );
      })
      .sort((a, b) =>
        (a.currentDateIso ?? "9999").localeCompare(
          b.currentDateIso ?? "9999",
        ),
      );

  const completed = rows.filter(
    (row) => row.status === "completed",
  );
  const open = rows.filter(
    (row) => row.status !== "completed",
  );
  const knownFloat = rows.filter(
    (row) => row.totalFloatHours !== null,
  ).length;
  const floatCoveragePercent = coverage(
    knownFloat,
    rows.length,
  );
  const criticalPathState =
    knownFloat === 0
      ? "not_established"
      : knownFloat === rows.length
        ? "source_float_established"
        : "source_float_partial";

  const criticalPathRows = open
    .filter(
      (row) => row.criticality === "critical",
    )
    .sort((a, b) => {
      const ad =
        dateMs(a.currentDateIso) ??
        Number.MAX_SAFE_INTEGER;
      const bd =
        dateMs(b.currentDateIso) ??
        Number.MAX_SAFE_INTEGER;
      return ad - bd ||
        a.activityId.localeCompare(
          b.activityId,
          undefined,
          { numeric: true },
        );
    });

  return {
    schemaVersion: "1.0",
    projectionKey: "milestones",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    dataDateIso: model.dataDateIso,
    criticalityBasis:
      "submitted_total_float",
    criticalFloatThresholdHours:
      config.criticalFloatThresholdHours,
    nearCriticalFloatThresholdHours:
      config.nearCriticalFloatThresholdHours,
    floatCoveragePercent,
    criticalPathState,
    milestoneCount: rows.length,
    completedCount: completed.length,
    openCount: open.length,
    lateOpenCount: open.filter(
      (row) =>
        row.daysFromDataDate !== null &&
        row.daysFromDataDate < 0,
    ).length,
    criticalMilestoneCount:
      criticalPathRows.length,
    nearCriticalMilestoneCount:
      open.filter(
        (row) =>
          row.criticality === "near_critical",
      ).length,
    negativeFloatMilestoneCount:
      open.filter(
        (row) => row.negativeFloat,
      ).length,
    due30Count:
      open.filter(
        (row) =>
          row.dueState === "due_30_days",
      ).length,
    due90Count:
      open.filter(
        (row) =>
          row.dueState === "due_90_days",
      ).length,
    criticalPriorityCount:
      open.filter(
        (row) =>
          row.managementPriority === "critical",
      ).length,
    highPriorityCount:
      open.filter(
        (row) =>
          row.managementPriority === "high",
      ).length,
    criticalPathMilestoneIds:
      criticalPathRows.map(
        (row) => row.activityId,
      ),
    terminalCriticalMilestoneIds:
      criticalPathRows
        .filter(
          (row) => row.terminalMilestone,
        )
        .map(
          (row) => row.activityId,
        ),
    rows,
  };
}
