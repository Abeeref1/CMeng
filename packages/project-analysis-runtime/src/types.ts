import type {
  CanonicalScheduleModel,
  ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import type {
  ScheduleRevision,
} from "../../schedule-revision-core/src";
import type {
  CanonicalResourceModel,
} from "../../schedule-resource-core/src";
import type {
  CanonicalQuantityProgressModel,
} from "../../quantity-progress-core/src";
import type {
  ForecastHistorySnapshot,
} from "../../forecast-history/src";
import type {
  ContractDocumentResult,
} from "../../contract-parser/src";
import type {
  DelayClaimsModel,
} from "../../delay-analysis-core/src";
import type {
  ContractTimeBasis,
} from "../../eot-assessment/src";
import type {
  CpmConfig,
} from "../../schedule-cpm/src";

export interface ProjectAnalysisContext {
  runId: string;
  projectId: string;
  evidenceRevisionId: string;
  generatedAt: string;
  analysisEngineVersion: string;

  currentSchedule: CanonicalScheduleModel | null;
  scheduleRevisions: ScheduleRevision[];

  resources: CanonicalResourceModel | null;
  quantities: CanonicalQuantityProgressModel | null;

  forecastHistory: ForecastHistorySnapshot[];

  contract: ContractDocumentResult | null;
  delayClaims: DelayClaimsModel | null;
  contractTimeBasis: ContractTimeBasis | null;

  scheduleConfig?: ScheduleAnalysisConfig;
  cpmConfig?: Partial<CpmConfig>;
}

export interface ProjectAnalysisContextStore {
  get(
    runId: string,
  ): Promise<ProjectAnalysisContext | null>;
}

export interface MutableProjectAnalysisContextStore
  extends ProjectAnalysisContextStore {
  put(
    context: ProjectAnalysisContext,
  ): Promise<void>;
}
