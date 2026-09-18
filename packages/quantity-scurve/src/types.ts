export type QuantityActualHistoryMode =
  | "snapshot_history"
  | "current_snapshot_only"
  | "missing";

export interface QuantityScurvePoint {
  dateIso: string;
  baselinePlannedQuantity: number | null;
  currentForecastQuantity: number | null;
  actualInstalledQuantity: number | null;
}

export interface QuantityScurveSeries {
  unit: string | null;
  itemCount: number;
  knownContractQuantity: number;
  mappingCoveragePercent: number | null;
  baselineTimePhasingCoveragePercent: number | null;
  currentTimePhasingCoveragePercent: number | null;
  actualSnapshotItemCoveragePercent: number | null;
  actualHistoryMode: QuantityActualHistoryMode;
  overInstalledItemIds: string[];
  points: QuantityScurvePoint[];
}

export interface QuantityScurveProjection {
  schemaVersion: "1.0";
  projectionKey: "quantity_scurve";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  boqRevisionId: string;
  scheduleRevisionId: string;
  dataDateIso: string | null;
  allocationState:
    | "complete"
    | "partial"
    | "conflicted"
    | "missing";
  series: QuantityScurveSeries[];
  unmappedItemIds: string[];
  partiallyAllocatedItemIds: string[];
  overAllocatedItemIds: string[];
  diagnostics: string[];
}
