import type {
  MutableProjectAnalysisContextStore,
  ProjectAnalysisContext,
} from "./types";

export class InMemoryProjectAnalysisContextStore
  implements MutableProjectAnalysisContextStore
{
  private readonly contexts =
    new Map<string, ProjectAnalysisContext>();

  async put(
    context: ProjectAnalysisContext,
  ): Promise<void> {
    if (this.contexts.has(context.runId)) {
      const existing =
        this.contexts.get(context.runId)!;

      if (
        existing.evidenceRevisionId !==
          context.evidenceRevisionId ||
        existing.projectId !==
          context.projectId
      ) {
        throw new Error(
          "Analysis context run identity cannot be replaced with different inputs",
        );
      }

      return;
    }

    this.contexts.set(
      context.runId,
      context,
    );
  }

  async get(
    runId: string,
  ): Promise<ProjectAnalysisContext | null> {
    return this.contexts.get(runId) ?? null;
  }
}
