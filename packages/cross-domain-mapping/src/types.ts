import type {
  QuantitySourceRef,
} from "../../quantity-progress-core/src";

export type MappingAuthority =
  | "governed"
  | "candidate_scenario";

export type MappingMethod =
  | "governed_allocation"
  | "explicit_activity_id"
  | "composite_similarity"
  | "multi_activity_scenario";

export interface QuantityActivityMappingSignal {
  key:
    | "explicit_activity_id"
    | "activity_name"
    | "wbs"
    | "section"
    | "code_token"
    | "description";
  score: number;
  detail: string;
}

export interface QuantityActivityMappingCandidate {
  candidateId: string;
  quantityItemId: string;
  activityId: string;
  confidence: number;
  method: MappingMethod;
  authority: MappingAuthority;
  ambiguous: boolean;
  allocatedQuantity: number | null;
  allocationShare: number | null;
  signals: QuantityActivityMappingSignal[];
  sourceRefs: QuantitySourceRef[];
  diagnostics: string[];
}

export interface QuantityScheduleMappingResult {
  schemaVersion: "1.0";
  projectId: string | null;
  boqRevisionId: string;
  scheduleRevisionId: string;
  candidateCount: number;
  governedLinkCount: number;
  scenarioLinkCount: number;
  knownQuantityItemCount: number;
  mappedKnownQuantityItemCount: number;
  mappedQuantity: number;
  totalKnownQuantity: number;
  quantityCoveragePercent: number | null;
  ambiguousItemIds: string[];
  unmappedItemIds: string[];
  candidates: QuantityActivityMappingCandidate[];
  selectedScenarioLinks: QuantityActivityMappingCandidate[];
  diagnostics: string[];
}
