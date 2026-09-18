export interface QuantitySourceRef {
  source:
    | "boq_xlsx"
    | "boq_csv"
    | "boq_pdf"
    | "governed_mapping"
    | "progress_record";
  locator: string;
}

export interface CanonicalQuantityItem {
  quantityItemId: string;
  itemNumber: string | null;
  section: string | null;
  description: string;
  unit: string | null;
  contractQuantity: number | null;
  sourceRefs: QuantitySourceRef[];
  diagnostics: string[];
}

export interface QuantityScheduleAllocation {
  allocationId: string;
  quantityItemId: string;
  activityId: string;
  allocatedQuantity: number;
  sourceRefs: QuantitySourceRef[];
}

export interface InstalledQuantitySnapshot {
  snapshotId: string;
  asOfIso: string;
  quantityItemId: string;
  installedQuantity: number;
  sourceRefs: QuantitySourceRef[];
}

export interface CanonicalQuantityProgressModel {
  projectId: string | null;
  boqRevisionId: string;
  scheduleRevisionId: string;
  items: CanonicalQuantityItem[];
  allocations: QuantityScheduleAllocation[];
  installedSnapshots: InstalledQuantitySnapshot[];
  diagnostics: string[];
}

export interface QuantityMappingAssessment {
  totalKnownContractQuantity: number;
  mappedQuantity: number;
  mappedItemCount: number;
  knownQuantityItemCount: number;
  mappingCoveragePercent: number | null;
  overAllocatedItemIds: string[];
  partiallyAllocatedItemIds: string[];
  unmappedItemIds: string[];
  complete: boolean;
  diagnostics: string[];
}
