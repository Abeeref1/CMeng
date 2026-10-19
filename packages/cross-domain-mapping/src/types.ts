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
  userCandidateLinks?:Array<{quantityItemId:string;activityId:string;state:'candidate';reason:string;sourceRef:string;proposedBy:string}>;
  sourceWbsLinks?:Array<{quantityItemId:string;wbsCode:string|null;wbsId:string|null;activityIds:string[];basis:string;sourceRefs:string[];sectionReview?:{decision:'confirm'|'reject';reference:string}}>;
  sourceWbsCoveragePercent?:number|null;
  schemaVersion: "1.0";
  projectId: string | null;
  boqRevisionId: string;
  scheduleRevisionId: string;
  candidateCount: number;
  governedLinkCount: number;
  scenarioLinkCount: number;
  knownQuantityItemCount: number;
  mappedKnownQuantityItemCount: number;
  /** Null when the known quantities use more than one unit (never summed across units). */
  mappedQuantity: number | null;
  totalKnownQuantity: number | null;
  quantityCoveragePercent: number | null;
  itemCoveragePercent: number | null;
  mixedQuantityUnits: boolean;
  ambiguousItemIds: string[];
  unmappedItemIds: string[];
  candidates: QuantityActivityMappingCandidate[];
  selectedScenarioLinks: QuantityActivityMappingCandidate[];
  diagnostics: string[];
}
