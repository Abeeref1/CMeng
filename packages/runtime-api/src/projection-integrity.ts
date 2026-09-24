import { activityPopulation, scheduleProgress, sourceFloatCriticality, type CanonicalScheduleModel, type ScheduleAnalysisConfig } from '../../schedule-analysis-core/src';
import type { ModuleRuntimeResult } from './project-state-types';
import {commercialIntegrityChecks} from './commercial-integrity';

/** Certifies only the metrics actually checked, never the completeness of project evidence. */
export function checkProjectionIntegrity(result: ModuleRuntimeResult, model: CanonicalScheduleModel, config: ScheduleAnalysisConfig, claimsSource?: import('../../delay-analysis-core/src').DelayClaimsModel | null): ModuleRuntimeResult {
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
  const days = (a:unknown,b:unknown) => typeof a==='string'&&typeof b==='string'&&Number.isFinite(Date.parse(a))&&Number.isFinite(Date.parse(b))?(Date.parse(b)-Date.parse(a))/86400000:null;
  if(result.key==='schedule-change-report') {
    const rows=data.changedActivities??[];
    for(const [kind,key] of [['added','addedActivityCount'],['removed','removedActivityCount'],['modified','modifiedActivityCount']])compare('changed_register_'+kind,data[key!],rows.filter((r:any)=>r.changeKind===kind).length);
    if(data.state==='ready'){
      compare('current_source_population',data.toActivityCount,model.activities.length);
      compare('matched_activity_partition',data.matchedActivityCount,data.modifiedActivityCount+data.unchangedActivityCount);
      compare('current_activity_partition',data.toActivityCount,data.matchedActivityCount+data.addedActivityCount);
    }
    compare('added_relationship_count',data.addedRelationshipCount,data.addedRelationships?.length);
    compare('removed_relationship_count',data.removedRelationshipCount,data.removedRelationships?.length);
  }
  if(result.key==='revision-trend'||result.key==='variance-trends') {
    const rows=data.points??[];
    compare('revision_count',data.revisionCount,rows.length);
    compare('unique_revision_ids',new Set(rows.map((r:any)=>r.revisionId)).size,rows.length);
    for(const row of rows){
      if(result.key==='revision-trend')compare('execution_status_partition:'+row.revisionId,row.completedCount+row.inProgressCount+row.notStartedCount+row.unknownStatusCount,row.executionActivityCount);
      else compare('variance_partition:'+row.revisionId,row.lateActivityCount+row.earlyActivityCount+row.onTimeActivityCount,row.comparableActivities);
      if(row.revisionId===model.sourceRevisionId){compare('current_revision_critical',row.criticalCount,expectedCritical);compare('current_revision_near_critical',row.nearCriticalCount,expectedNear);}
    }
  }
  if(result.key==='milestones'){
    const source=model.activities.filter(a=>['milestone','start_milestone','finish_milestone'].includes(a.activityType)),rows=data.rows??[];
    compare('source_milestone_ids',rows.map((r:any)=>r.activityId).sort().join('\n'),source.map(r=>r.activityId).sort().join('\n'));
    compare('milestone_count',data.milestoneCount,source.length);
    compare('completed_milestone_count',data.completedCount,source.filter(a=>a.status==='completed').length);
    compare('open_milestone_count',data.openCount,source.filter(a=>a.status!=='completed').length);
    for(const row of rows)compare('milestone_date_variance:'+row.activityId,row.varianceDays,days(row.baselineDateIso,row.currentDateIso));
  }
  if(result.key==='forecast-history'){
    const rows=data.points??[];
    compare('forecast_snapshot_count',data.snapshotCount,rows.length);
    compare('established_forecast_count',data.establishedForecastCount,rows.filter((r:any)=>r.independentForecastCompletionIso!==null).length);
    rows.forEach((r:any,i:number)=>{
      compare('movement_previous:'+r.snapshotId,r.movementDaysVsPrevious,i?days(rows[i-1].independentForecastCompletionIso,r.independentForecastCompletionIso):null);
      compare('movement_first:'+r.snapshotId,r.movementDaysVsFirst,days(rows.find((p:any)=>p.independentForecastCompletionIso&&Number.isFinite(Date.parse(p.independentForecastCompletionIso)))?.independentForecastCompletionIso,r.independentForecastCompletionIso));
    });
  }
  if(result.key==='independent-forecast'){
    const rows=data.activities??[];
    compare('calculated_activity_count',data.calculatedActivityCount,rows.filter((r:any)=>r.status==='calculated').length);
    compare('forecast_population_partition',data.calculatedActivityCount+data.unresolvedActivityCount,rows.length);
    compare('forecast_date_variance',data.forecastVarianceDays,days(data.sourceForecastCompletionIso,data.independentForecastCompletionIso));
    compare('required_finish_date_variance',data.requiredFinishVarianceDays,days(data.requiredFinishIso,data.independentForecastCompletionIso));
    compare('activity_forecast_date_variances',rows.every((r:any)=>{const expected=days(r.sourceFinishIso,r.independentEarlyFinishIso);return expected===null?r.finishVarianceDays===null:typeof r.finishVarianceDays==='number'&&Math.abs(r.finishVarianceDays-expected)<=.00001;}),true);
  }
  if(result.key==='quantity-scurve'){
    compare('quantities_separated_by_unit',data.unitKeyed,true);
    compare('unique_quantity_series',new Set((data.series??[]).map((r:any)=>r.seriesKey)).size,data.series?.length??0);
    compare('quantity_history_stops_at_data_date',(data.series??[]).every((s:any)=>(s.points??[]).every((p:any)=>p.actualInstalledQuantity===null||Boolean(model.dataDateIso&&p.dateIso.slice(0,10)<=model.dataDateIso.slice(0,10)))),true);
  }
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
  if (result.key === 'notices-claims') {
    const events = data.events ?? [], claims = data.claims ?? [];
    compare('notice_event_population', events.length, claimsSource?.events.length ?? 0);
    compare('claim_population', claims.length, claimsSource?.claims.length ?? 0);
    compare('unique_event_ids', new Set(events.map((r:any)=>r.eventId)).size, events.length);
    compare('unique_claim_ids', new Set(claims.map((r:any)=>r.claimId)).size, claims.length);
    compare('claim_headline_matches_register', data.claimCount, claims.length);
    compare('event_headline_matches_register', data.eventCount, events.length);
    const count=(state:string)=>events.filter((r:any)=>r.noticeTimeliness===state).length;
    compare('timely_notice_count',data.timelyNoticeCount,count('timely'));
    compare('late_notice_count',data.lateNoticeCount,count('late'));
    compare('event_date_missing_count',data.noticeEventDateMissingCount,count('event_date_missing'));
    compare('requirement_missing_count',data.noticeRequirementMissingCount,count('requirement_missing'));
    for(const row of events.filter((r:any)=>['timely','late'].includes(r.noticeTimeliness))){
      const elapsed=row.eventStartIso&&row.noticeIssuedAt?(Date.parse(row.noticeIssuedAt)-Date.parse(row.eventStartIso))/86400000:null;
      compare('notice_dates_required:'+row.eventId,elapsed!==null&&Number.isFinite(elapsed)&&row.requiredNoticeDays!==null,true);
      if(elapsed!==null&&Number.isFinite(elapsed)&&row.requiredNoticeDays!==null)compare('notice_rule:'+row.eventId,row.noticeTimeliness,elapsed<=row.requiredNoticeDays?'timely':'late');
    }
    const source=new Map((claimsSource?.claims??[]).map(r=>[r.claimId,r]));
    for(const row of claims)compare('claimed_days_retained:'+row.claimId,row.claimedDays,source.get(row.claimId)?.claimedDays??null);
  }
  if (result.key === 'windows-analysis') {
    const windows=data.windows??[];
    compare('window_headline_matches_register',data.windowCount,windows.length);
    compare('unique_windows',new Set(windows.map((r:any)=>r.windowId)).size,windows.length);
    const diff=(a:any,b:any)=>a&&b?(Date.parse(b)-Date.parse(a))/86400000:null;
    for(const row of windows){
      compare('submitted_date_movement:'+row.windowId,row.sourceForecastMovementDays,diff(row.fromSourceForecastCompletionIso,row.toSourceForecastCompletionIso));
      compare('calendar_date_movement:'+row.windowId,row.independentForecastMovementDays,diff(row.fromIndependentForecastCompletionIso,row.toIndependentForecastCompletionIso));
    }
    compare('net_completion_date_movement',data.projectCompletionMovementDays,diff(data.firstProjectCompletionIso,data.latestProjectCompletionIso));
    compare('positive_calendar_movement',data.positiveIndependentMovementDays,windows.reduce((n:number,r:any)=>n+Math.max(0,r.independentForecastMovementDays??0),0));
    compare('negative_calendar_movement',data.negativeIndependentMovementDays,windows.reduce((n:number,r:any)=>n+Math.min(0,r.independentForecastMovementDays??0),0));
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
  if(data.position?.projectionKey==='commercial_control_position')checks.push(...commercialIntegrityChecks(result.key,data.position));
  const failures = checks.filter(check => !check.passed);
  const contract = { schemaVersion: '1.0', state: failures.length ? 'failed' : checks.length ? 'verified_for_checked_metrics' : 'not_checked',
    sourceRevisionId: model.sourceRevisionId, dataDateIso: model.dataDateIso,
    population: execution.contract, checks, failureCount: failures.length,
    scope: 'Only the listed population, arithmetic, coverage and time-boundary checks are certified. Source truth, evidence completeness and causal or contractual conclusions are not certified.' };
  return { ...result, data: { ...data, systemEvidenceContract: contract },
    ...(failures.length ? { status: 'partial' as const, professionalState: 'review_required' as const,
      reason: 'Shared calculation consistency failed: ' + failures.map(x => x.metric).join(', ') } : {}) };
}
