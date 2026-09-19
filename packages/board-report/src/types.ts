import type {
  ProjectDirectorPosition,
} from "../../project-director/src";

export interface BoardReportPublicationInput {
  sourceManifestId: string | null;
  evidenceReceiptIds: string[];
  finalizedAt: string | null;
}

export interface BoardReadyReport {
  schemaVersion: "1.0";
  reportId: string;
  projectId: string;
  generatedAt: string;
  state: "board_ready" | "blocked";
  sourceManifestId: string | null;
  evidenceReceiptIds: string[];
  sections: {
    executivePosition: {
      dataDateIso: string | null;
      independentForecastCompletionIso: string | null;
      independentForecastBasisRevisionId: string;
      independentForecastCoveragePercent: number | null;
      independentForecastAuthority:
        | "deterministic"
        | "scenario"
        | "unresolved";
      officialAdjustedCompletionIso: string | null;
      varianceDays: number | null;
      managementActions: string[];
    };
    progress: ProjectDirectorPosition["schedule"]["progressBases"];
    commercialByCurrency: ProjectDirectorPosition["commercialByCurrency"];
    claims: ProjectDirectorPosition["claims"];
    ld: ProjectDirectorPosition["ld"];
    controls: ProjectDirectorPosition["controls"];
  };
  evidenceRefs: string[];
  publicationReceipt: {
    sourceFingerprint: string;
    finalizedAt: string | null;
  };
  diagnostics: string[];
}
