import {
  analysisRunIdentity,
  type AnalysisInputSnapshot,
  type AnalysisRunRecord,
} from "../../analysis-runtime/src";
import {
  AnalysisCoordinator,
} from "../../analysis-runtime/src";
import type {
  MutableProjectAnalysisContextStore,
  ProjectAnalysisContextInput,
} from "./types";

export class ProjectAnalysisOrchestrator {
  constructor(
    private readonly contexts:
      MutableProjectAnalysisContextStore,
    private readonly coordinator:
      AnalysisCoordinator,
  ) {}

  async ensure(
    snapshot: AnalysisInputSnapshot,
    input: ProjectAnalysisContextInput,
    now?: string,
  ): Promise<AnalysisRunRecord> {
    const identity =
      analysisRunIdentity(snapshot);

    await this.contexts.put({
      ...input,
      runId: identity.runId,
      projectId: snapshot.projectId,
      evidenceRevisionId:
        snapshot.evidenceRevisionId,
    });

    return this.coordinator.ensureProjectAnalysis(
      snapshot,
      now,
    );
  }
}
