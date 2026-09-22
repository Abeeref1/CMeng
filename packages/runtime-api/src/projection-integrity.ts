import { activityPopulation, scheduleProgress, sourceFloatCriticality, type CanonicalScheduleModel, type ScheduleAnalysisConfig } from '../../schedule-analysis-core/src';
import type { ModuleRuntimeResult } from './project-state-types';

/** Certifies only the metrics actually checked, never the completeness of project evidence. */
export function checkProjectionIntegrity(result: ModuleRuntimeResult, model: CanonicalScheduleModel, config: ScheduleAnalysisConfig): ModuleRuntimeResult {
  if (!result.data || typeof result.data !== 'object') return result;
  const data = result.data as Record<string, any>;
  const execution = activityPopulation(model);
  const classifications = execution.activities.map(a => sourceFloatCriticality(model, a, config));
  const expectedCritical = classifications.filter(x => x === 'critical').length;
  const expectedNear = classifications.filter(x => x === 'near_critical').length;
  const progress = scheduleProgress(model.activities);
  const checks: Array<{ metric: string; expected: unknown; actual: unknown; passed: boolean }> = [];
  const compare = (metric: string, actual: unknown, expected: unknown, tolerance = 0.00001) => {
    const passed = typeof actual === 'number' && typeof expected === 'number'
      ? Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance : actual === expected;
    checks.push({ metric, expected, actual: actual ?? null, passed });
  };
  const totals = data.result ?? data;
  if (result.key === 'schedule-analytics') {
    compare('source_activity_count', totals.activityCount, model.activities.length);
    compare('execution_population', totals.population?.executableActivityCount, execution.activities.length);
    compare('source_float_critical_count', totals.float?.criticalCount, expectedCritical);
    compare('source_float_near_critical_count', totals.float?.nearCriticalCount, expectedNear);
    compare('duration_weighted_schedule_progress', totals.progress?.durationWeightedPercentComplete?.value, progress.value);
  } else if (result.key === 'activity-analytics') {
    compare('source_register_population', data.rows?.length, model.activities.length);
  } else if (result.key === 'near-critical') {
    compare('strict_near_critical_population', data.nearCriticalCount, expectedNear);
  } else if (result.key === 'progress-breakdown') {
    compare('execution_population', data.totalActivityCount, execution.activities.length);
    compare('direct_wbs_population_reconciliation', data.rows?.reduce((n: number, r: any) => n + r.activityCount, 0), execution.activities.length);
    compare('wbs_critical_reconciliation', data.rows?.reduce((n: number, r: any) => n + r.criticalCount, 0), expectedCritical);
    compare('wbs_near_critical_reconciliation', data.rows?.reduce((n: number, r: any) => n + r.nearCriticalCount, 0), expectedNear);
  } else if (result.key === 'progress-report' || result.key === 'pmo-analysis') {
    compare('source_float_critical_count', data.schedule?.criticalCount, expectedCritical);
    compare('source_float_near_critical_count', data.schedule?.nearCriticalCount, expectedNear);
    compare('duration_weighted_schedule_progress', data.progress?.durationWeightedProgressPercent, progress.value);
    if (result.key === 'progress-report') compare('physical_requires_own_evidence', data.progressBases?.physical?.valuePercent === null || data.progressBases?.physical?.authority === 'source_evidence', true);
  } else if (result.key === 'lookahead-schedule') {
    const allowed = new Set(execution.activities.map(a => a.activityId));
    compare('execution_only_lookahead', data.rows?.every((row: any) => allowed.has(row.activityId)), true);
    compare('unique_lookahead_rows', new Set(data.rows?.map((row: any) => row.activityId)).size, data.rows?.length);
    compare('ready_requires_complete_readiness', data.rows?.every((row: any) => row.readiness?.state !== 'ready' || Object.values(row.readiness?.dimensions ?? {}).every((dimension: any) => dimension.state === 'ready' || dimension.state === 'not_applicable')), true);
  }
  const cutoff = model.dataDateIso?.slice(0, 10) ?? null;
  if (result.key === 'progress-scurve') {
    compare('schedule_history_stops_at_data_date', data.points?.every((row: any) => row.actualProgressPercent === null || cutoff !== null && row.dateIso.slice(0, 10) <= cutoff), true);
    compare('schedule_snapshot_coverage', data.actualSnapshotCoveragePercent, progress.coveragePercent);
  }
  if (result.key === 'manhour-scurve' && Array.isArray(data.points)) compare('actual_hours_stop_at_data_date', data.points.every((row: any) => row.actualCumulativeHours === null || cutoff !== null && row.dateIso.slice(0, 10) <= cutoff), true);
  if (result.key === 'resource-utilization' && data.weeklyCapacityEvidence) compare('approved_usage_stops_at_data_date', data.weeklyCapacityEvidence.points.every((row: any) => row.actualApprovedUsage === null || cutoff !== null && row.weekStartIso !== null && row.weekStartIso <= cutoff), true);
  for (const item of data.challenge?.items ?? []) {
    if (item.independent?.value === null) compare('missing_independent_never_reconciled:' + item.metric, item.reconciliationState !== 'within_tolerance', true);
  }
  const failures = checks.filter(check => !check.passed);
  const contract = { schemaVersion: '1.0', state: failures.length ? 'failed' : checks.length ? 'verified_for_checked_metrics' : 'not_checked',
    sourceRevisionId: model.sourceRevisionId, dataDateIso: model.dataDateIso,
    population: execution.contract, checks, failureCount: failures.length,
    scope: 'Population, threshold, coverage and time-boundary checks listed here. Evidence completeness and causal or contractual conclusions are not certified.' };
  return { ...result, data: { ...data, systemEvidenceContract: contract },
    ...(failures.length ? { status: 'partial' as const, professionalState: 'review_required' as const,
      reason: 'Shared calculation consistency failed: ' + failures.map(x => x.metric).join(', ') } : {}) };
}
