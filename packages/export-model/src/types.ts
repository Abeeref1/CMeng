export interface ExportCoverageReceipt {
  exportId: string;
  analysisRunId: string;
  evidenceRevisionId: string;
  projectionKey: string;
  sourcePopulationCount: number;
  eligiblePopulationCount: number;
  exportedPopulationCount: number;
  omittedPopulationCount: number;
  unresolvedPopulationCount: number;
  generatedAt: string;
}

export interface InteractiveSliceMetadata {
  sortBy: string;
  limit: number;
  returnedCount: number;
  totalAvailableCount: number;
  filterSummary: string | null;
}
