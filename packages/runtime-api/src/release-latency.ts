import {performance} from 'node:perf_hooks';
import {runtimeProjects} from './project-state';
import {managementSurfaceForProject} from './project-projections';
export const COLD_DASHBOARD_TARGET_MS=5_000;
/** Build versioned positions before accepting traffic. Request latency and
 * startup analysis time are reported separately; neither is a warmed browser. */
export function prepareRuntimePositions() {
  return runtimeProjects.listProjectIds().map(projectId=>{
    const start=performance.now();managementSurfaceForProject(projectId,'master-dashboard');
    return {projectId,version:runtimeProjects.get(projectId)?.version,preparationMs:performance.now()-start};
  });
}
