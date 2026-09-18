import type {
  AnalysisProjectionKey,
  ProjectionDefinition,
} from "./types";

export const DEFAULT_ANALYSIS_PLAN: readonly ProjectionDefinition[] = [
  { key: "pmo_analysis", dependencies: [], requiredForPublish: true },
  { key: "schedule_analytics", dependencies: [], requiredForPublish: true },
  { key: "challenge_contract", dependencies: [], requiredForPublish: true },
  { key: "quantity_scurve", dependencies: ["schedule_analytics"], requiredForPublish: true },

  { key: "activity_analytics", dependencies: ["schedule_analytics"], requiredForPublish: true },
  { key: "resource_utilization", dependencies: ["schedule_analytics"], requiredForPublish: true },
  { key: "lookahead_schedule", dependencies: ["schedule_analytics"], requiredForPublish: true },
  { key: "schedule_change_report", dependencies: ["schedule_analytics"], requiredForPublish: true },
  { key: "variance_trends", dependencies: ["schedule_analytics"], requiredForPublish: true },
  { key: "progress_scurve", dependencies: ["schedule_analytics"], requiredForPublish: true },
  { key: "progress_breakdown", dependencies: ["schedule_analytics"], requiredForPublish: true },
  { key: "milestones", dependencies: ["schedule_analytics"], requiredForPublish: true },
  { key: "near_critical", dependencies: ["schedule_analytics"], requiredForPublish: true },
  { key: "independent_forecast", dependencies: ["schedule_analytics"], requiredForPublish: true },

  { key: "progress_report", dependencies: ["schedule_analytics", "milestones", "lookahead_schedule", "progress_scurve", "independent_forecast"], requiredForPublish: true },
  { key: "revision_trend", dependencies: ["schedule_change_report"], requiredForPublish: true },
  { key: "manhour_scurve", dependencies: ["resource_utilization"], requiredForPublish: true },
  { key: "forecast_history", dependencies: ["independent_forecast"], requiredForPublish: true },
  { key: "notices_claims", dependencies: ["challenge_contract"], requiredForPublish: true },
  { key: "windows_analysis", dependencies: ["schedule_change_report", "independent_forecast"], requiredForPublish: true },
  { key: "delay_claims", dependencies: ["windows_analysis", "notices_claims", "challenge_contract"], requiredForPublish: true },
  { key: "eot_assessment", dependencies: ["windows_analysis", "delay_claims", "notices_claims", "challenge_contract"], requiredForPublish: true },
] as const;

export function projectionKeys(
  plan: readonly ProjectionDefinition[] = DEFAULT_ANALYSIS_PLAN,
): AnalysisProjectionKey[] {
  return plan.map((definition) => definition.key);
}

export function projectionDefinition(
  key: AnalysisProjectionKey,
  plan: readonly ProjectionDefinition[] = DEFAULT_ANALYSIS_PLAN,
): ProjectionDefinition {
  const definition = plan.find((item) => item.key === key);
  if (!definition) {
    throw new Error("Unknown analysis projection: " + key);
  }
  return definition;
}
