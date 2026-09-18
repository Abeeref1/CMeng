export interface ScheduleModuleDescriptor {
  key: string;
  title: string;
  category: "analysis" | "progress" | "forecast" | "claims" | "contract";
}

export const scheduleModules: ScheduleModuleDescriptor[] = [
  { key: "pmo-analysis", title: "PMO Analysis", category: "analysis" },
  { key: "schedule-analytics", title: "Schedule Analytics", category: "analysis" },
  { key: "activity-analytics", title: "Activity Analytics", category: "analysis" },
  { key: "resource-utilization", title: "Resource Utilization", category: "progress" },
  { key: "lookahead-schedule", title: "Look-Ahead Schedule", category: "analysis" },
  { key: "progress-report", title: "Progress Report", category: "progress" },
  { key: "schedule-change-report", title: "Schedule Change Report", category: "analysis" },
  { key: "revision-trend", title: "Revision Trend", category: "analysis" },
  { key: "variance-trends", title: "Variance Trends", category: "progress" },
  { key: "progress-scurve", title: "Progress S-Curve", category: "progress" },
  { key: "quantity-scurve", title: "Quantity Installed S-Curve", category: "progress" },
  { key: "progress-breakdown", title: "Progress Breakdown", category: "progress" },
  { key: "milestones", title: "Milestones", category: "analysis" },
  { key: "near-critical", title: "Near-Critical Activities", category: "analysis" },
  { key: "manhour-scurve", title: "Man-Hour S-Curve", category: "progress" },
  { key: "forecast-history", title: "Forecast History", category: "forecast" },
  { key: "independent-forecast", title: "Independent Forecast", category: "forecast" },
  { key: "delay-claims", title: "Delay & Claims", category: "claims" },
  { key: "notices-claims", title: "Notices, EOT & Claims", category: "claims" },
  { key: "windows-analysis", title: "Windows Analysis", category: "claims" },
  { key: "eot-assessment", title: "EOT Assessment", category: "claims" },
  { key: "challenge-contract", title: "Challenge the Contract", category: "contract" }
];

export function scheduleModuleSummary() {
  return {
    total: scheduleModules.length,
    keys: scheduleModules.map((module) => module.key)
  };
}
