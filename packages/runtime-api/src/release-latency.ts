import {performance} from 'node:perf_hooks';
import {runtimeProjects} from './project-state';
import {managementSurfaceForProject} from './project-projections';
export const COLD_DASHBOARD_TARGET_MS=5_000;
/** Build one versioned dashboard position. Keeping this operation project-scoped
 * lets production warm a real portfolio incrementally instead of blocking the
 * listening port until every persisted project has been calculated. */
export function prepareRuntimePosition(projectId:string) {
  const start=performance.now();
  managementSurfaceForProject(projectId,'master-dashboard');
  return {projectId,version:runtimeProjects.get(projectId)?.version,preparationMs:performance.now()-start};
}

/** Batch helper retained for isolated release tests and explicit maintenance
 * jobs. Production startup deliberately warms projects one at a time. */
export function prepareRuntimePositions(projectIds=runtimeProjects.listProjectIds()) {
  return projectIds.map(prepareRuntimePosition);
}
