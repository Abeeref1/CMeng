export interface SourceProductivityForecastRef {
  sourceId: string;
  locator: string;
}

export interface SourceProductivityForecastRow {
  workPackageId: string;
  description: string | null;
  discipline: string | null;
  remainingQuantity: number | null;
  unit: string | null;
  recentAchievedRatePerDay: number | null;
  conservativeAchievableRatePerDay: number | null;
  availableStartIso: string | null;
  productiveDays: number | null;
  interfaceAllowanceDays: number | null;
  independentForecastFinishIso: string | null;
  status: string | null;
  sourceRefs: SourceProductivityForecastRef[];
}

export interface SourceProductivityForecastModel {
  projectId: string;
  sourceDocumentId: string;
  authority: "source_productivity_model";
  method:
    "remaining_quantity_over_conservative_rate_plus_interface_allowance";
  workPackageCount: number;
  forecastCoveragePercent: number | null;
  independentForecastCompletionIso: string | null;
  drivingWorkPackageIds: string[];
  rows: SourceProductivityForecastRow[];
  diagnostics: string[];
}
