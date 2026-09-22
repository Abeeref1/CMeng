import type {
  QuantityScheduleMappingResult,
} from "../../cross-domain-mapping/src";
import type {
  SharedFindingContract,
} from "../../module-challenge/src";

export type DeliveryChallengePosition =
  | "supportable"
  | "challenged"
  | "not_yet_supportable"
  | "scenario_only"
  | "material_delivery_gap";

export interface SubmittedManpowerPeriod {
  periodId: string;
  startIso: string;
  endIso: string;
  plannedManpower: number;
  trade: string | null;
  workFront: string | null;
  sourceRefs: string[];
}

export interface SubmittedManpowerPlan {
  planId: string;
  periods: SubmittedManpowerPeriod[];
  sourceRefs: string[];
  diagnostics: string[];
}

export interface QuantityUnitChallengeRow {
  unit: string;
  contractQuantity: number;
  mappedContractQuantity: number;
  installedQuantity: number | null;
  remainingQuantity: number | null;
  requiredPerDayToContract: number | null;
  requiredPerDayToContractorForecast:
    number | null;
  mappingCoveragePercent:
    number | null;
}

export interface ProductivityUnitChallengeRow {
  unit: string;
  measuredInstalledQuantity:
    number | null;
  actualLaborHours: number | null;
  plannedQuantity: number | null;
  plannedLaborHours: number | null;
  actualMeasuredQuantityPerLaborHour:
    number | null;
  plannedQuantityPerLaborHour:
    number | null;
  requiredQuantityPerLaborHour:
    number | null;
  requiredProductivityVsActualPercent:
    number | null;
  evidenceState:
    | "measured"
    | "planned_only"
    | "scenario_only"
    | "missing";
}

export interface CrewScenario {
  crewSize: number;
  averageManpower: number | null;
  peakManpower: number | null;
  authority:
    "schedule_derived_scenario";
}

export interface DeliveryChallengeFinding
  extends SharedFindingContract {
  topic:
    | "manpower"
    | "productivity"
    | "quantity"
    | "programme"
    | "milestone"
    | "mapping"
    | "workfront";
  state:
    | "supported"
    | "challenged"
    | "missing_evidence"
    | "scenario";
  contractorAssumption:
    string | null;
  independentCalculation:
    string | null;
  difference:
    string | null;
  evidenceBasis: string[];
  milestoneConsequence:
    string | null;
  requiredResponse:
    string | null;
}

export interface DeliveryChallengeProjection {
  schemaVersion: "1.0";
  projectionKey:
    "delivery_challenge";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  sourceRevisionId: string;
  position:
    DeliveryChallengePosition;
  authority:
    "analytical_challenge_not_replacement_programme";
  disclaimer: string;

  scheduleChallenge: {
    contractorSubmittedCompletionIso:
      string | null;
    independentCompletionIso:
      string | null;
    contractualCompletionIso:
      string | null;
    contractorVsIndependentDays:
      number | null;
    independentVsContractualDays:
      number | null;
    remainingDurationDays:
      number | null;
    averageConcurrentWorkFronts:
      number | null;
    peakConcurrentWorkFronts:
      number | null;
    workFrontActivityCount:
      number;
  };

  quantityChallenge: {
    mappingPopulationEstablished: boolean;
    totalKnownQuantity: number | null;
    mappedQuantity: number | null;
    mappingCoveragePercent:
      number | null;
    knownRemainingQuantity:
      number | null;
    measuredInstalledQuantity:
      number | null;
    requiredQuantityPerDayToContract:
      number | null;
    requiredQuantityPerDayToContractorForecast:
      number | null;
    ambiguousMappingItemCount:
      number;
    unmappedItemCount: number;
    byUnit: QuantityUnitChallengeRow[];
  };

  productivityChallenge: {
    actualMeasuredQuantityPerLaborHour:
      number | null;
    plannedQuantityPerLaborHour:
      number | null;
    requiredQuantityPerLaborHour:
      number | null;
    requiredProductivityVsActualPercent:
      number | null;
    productivityEvidenceState:
      | "measured"
      | "planned_only"
      | "scenario_only"
      | "missing";
    byUnit:
      ProductivityUnitChallengeRow[];
  };

  manpowerChallenge: {
    submittedPlanAvailable: boolean;
    submittedAverageManpower:
      number | null;
    submittedPeakManpower:
      number | null;
    evidenceRemainingLaborHours:
      number | null;
    requiredAverageManpowerToContract:
      number | null;
    requiredAverageManpowerToContractorForecast:
      number | null;
    submittedVsRequiredToContract:
      number | null;
    scheduleDerivedScenarios:
      CrewScenario[];
    averageConcurrentWorkFronts:
      number | null;
    peakConcurrentWorkFronts:
      number | null;
  };

  mapping:
    QuantityScheduleMappingResult | null;

  findings:
    DeliveryChallengeFinding[];
  assumptions: string[];
  diagnostics: string[];
}
