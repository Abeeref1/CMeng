import type {
  DelayActivityCorrespondence,
  DelayActivityCorrespondenceCandidate,
  DelayEvidenceRef,
} from "../../delay-analysis-core/src";
import type {
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";

export interface ClaimActivityAiScore {
  activityId: string;
  score: number;
  rationale: string;
}

export interface ClaimActivityCorrespondenceInput {
  claimId: string;
  eventId: string;
  narrative: string;
  claimEvidenceRefs: DelayEvidenceRef[];
  schedule: CanonicalScheduleModel;
  explicitActivityIds?: string[];
  aiScores?: ClaimActivityAiScore[] | null;
  maxCandidates?: number;
  diagnosticSource?: {
    tableDocumentId: string | null;
    tableSourceFilename: string | null;
    sourceLocator: string | null;
    columns: string[];
    rawFragments: Array<{ column: string; value: string }>;
  };
}

export interface ClaimActivityCorrespondenceResolution
  extends DelayActivityCorrespondence {
  candidates: DelayActivityCorrespondenceCandidate[];
}
