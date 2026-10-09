import type {CanonicalScheduleModel} from "../../schedule-analysis-core/src";
import type {IndependentForecastProjection} from "../../independent-forecast/src";
import type {ProjectRuntimeState} from "./project-state-types";
import {canonicalTimeClaims} from "./canonical-time-claims";
import {isScenarioRevision} from "./schedule-authority";
import {sourceProductivityForecastEvidence} from "./source-productivity-forecast";
import {commercialPositionForState} from './commercial-runtime';

export const FORECAST_TAXONOMY_LABELS = [
  "Contractual completion",
  "Contractor programme forecast",
  "CMeng CPM/network recalculation",
  "Source productivity forecast",
  "Independent evidence-based forecast",
  "Scenario/recovery forecast",
] as const;

export type ForecastGateState = "passed" | "review_required" | "not_established";

export interface ForecastReconciliationCheck {
  key:
    | "calendar_coverage"
    | "graph_validity"
    | "source_constraints"
    | "activity_calculation_coverage"
    | "material_activity_divergence"
    | "required_finish_authority";
  label: string;
  state: ForecastGateState;
  detail: string;
  count: number | null;
}

function finishForActivity(activity: CanonicalScheduleModel["activities"][number]): string | null {
  return activity.status === "completed"
    ? activity.actualFinishIso ?? activity.forecastFinishIso ?? activity.currentFinishIso
    : activity.forecastFinishIso ?? activity.currentFinishIso;
}

function latestProgrammeFinish(model: CanonicalScheduleModel): string | null {
  let value: string | null = null;
  let latest = Number.NEGATIVE_INFINITY;
  for (const activity of model.activities) {
    if (activity.activityType === "wbs_summary" || activity.activityType === "level_of_effort") continue;
    const finish = finishForActivity(activity);
    if (!finish) continue;
    const ms = Date.parse(finish);
    if (!Number.isFinite(ms) || ms <= latest) continue;
    latest = ms;
    value = finish;
  }
  return value;
}

export function buildForecastReconciliationGate(input: {
  forecast: IndependentForecastProjection;
  model: CanonicalScheduleModel;
  requiredFinishIso: string | null;
  materialActivityScreeningDays?: number;
}) {
  const {forecast, model, requiredFinishIso} = input;
  const materialActivityScreeningDays = input.materialActivityScreeningDays ?? 14;
  const graphPrefixes = [
    "SCHEDULE_GRAPH_CYCLES:",
    "SCHEDULE_GRAPH_DUPLICATE_ACTIVITY_IDS:",
    "SCHEDULE_GRAPH_SELF_LOOPS:",
    "SCHEDULE_GRAPH_BROKEN_PREDECESSORS:",
    "CPM_RELATIONSHIP_ENDPOINT_UNRESOLVED:",
    "CPM_NETWORK_NOT_CALCULABLE",
  ];
  const graphDiagnostics = forecast.diagnostics.filter(code =>
    graphPrefixes.some(prefix => code.startsWith(prefix)),
  );
  const unresolvedCalendarActivities = forecast.activities.filter(row =>
    row.calendarMode !== "source_calendar" || row.status !== "calculated",
  );
  const sourceConstraintActivities = model.activities.filter(activity =>
    (activity.sourceConstraints?.length ?? 0) > 0,
  );
  const constraintsApplied=forecast.diagnostics.some(code=>code.startsWith('SOURCE_CONSTRAINTS_APPLIED'));
  const unappliedConstraints=sourceConstraintActivities.length>0&&!constraintsApplied;
  const materialDivergences = forecast.activities.filter(row =>
    typeof row.finishVarianceDays === "number" &&
    Number.isFinite(row.finishVarianceDays) &&
    Math.abs(row.finishVarianceDays) > materialActivityScreeningDays,
  );
  const coverageEstablished =
    forecast.activityCoveragePercent === 100 &&
    forecast.calculatedActivityCount > 0 &&
    forecast.unresolvedActivityCount === 0;

  const checks: ForecastReconciliationCheck[] = [
    {
      key: "calendar_coverage",
      label: "Calendar coverage",
      state: unresolvedCalendarActivities.length === 0 ? "passed" : "review_required",
      detail: unresolvedCalendarActivities.length === 0
        ? "Every calculated execution activity uses a readable source working calendar."
        : String(unresolvedCalendarActivities.length) + " execution activity(ies) do not have a fully calculated source-calendar result.",
      count: unresolvedCalendarActivities.length,
    },
    {
      key: "graph_validity",
      label: "Graph validity",
      state: graphDiagnostics.length === 0 ? "passed" : "review_required",
      detail: graphDiagnostics.length === 0
        ? "No checked cycle, duplicate-ID, self-loop, broken-predecessor or unresolved-network defect blocks the CPM result."
        : String(graphDiagnostics.length) + " graph/network diagnostic(s) require correction before management publication.",
      count: graphDiagnostics.length,
    },
    {
      key: "source_constraints",
      label: "Source constraints",
      state: unappliedConstraints ? "review_required" : "passed",
      detail: sourceConstraintActivities.length === 0
        ? "No source constraints are present."
        : constraintsApplied
          ? String(sourceConstraintActivities.length) + " activity(ies) have source constraints applied in the calendar calculation."
          : String(sourceConstraintActivities.length) + " activity(ies) have source constraints that have not been applied; their effect needs calculation.",
      count: unappliedConstraints?sourceConstraintActivities.length:0,
    },
    {
      key: "activity_calculation_coverage",
      label: "Activity calculation coverage",
      state: coverageEstablished ? "passed" : "review_required",
      detail: coverageEstablished
        ? "The execution activity calculation population is fully covered."
        : "Activity calculation coverage is " + (forecast.activityCoveragePercent === null ? "not established" : forecast.activityCoveragePercent + "%") + ".",
      count: forecast.unresolvedActivityCount,
    },
    {
      key: "material_activity_divergence",
      label: "Material activity-level divergence",
      state: materialDivergences.length === 0 ? "passed" : "review_required",
      detail: materialDivergences.length === 0
        ? "No calculated activity finish differs from its submitted finish by more than the disclosed CMeng screening threshold."
        : String(materialDivergences.length) + " activity(ies) differ by more than " + materialActivityScreeningDays + " calendar days and require reconciliation.",
      count: materialDivergences.length,
    },
    {
      key: "required_finish_authority",
      label: "Required finish authority",
      state: requiredFinishIso ? "passed" : "not_established",
      detail: requiredFinishIso
        ? "A contractual/required finish is established for the management comparison."
        : "A governed contractual/required finish is not established.",
      count: requiredFinishIso ? 1 : 0,
    },
  ];

  const publishable =
    forecast.independentForecastCompletionIso !== null &&
    checks.every(check => check.state === "passed");
  // A material difference from the contractor's submitted activity dates
  // warrants qualification, not suppression of an otherwise valid source-
  // calendar calculation. Graph, calendar, constraints and complete coverage
  // remain hard gates: a failed recalculation is NEVER a dashboard value.
  const usable=forecast.independentForecastCompletionIso!==null&&
    !hasUnreconciledScheduleCalendar(forecast)&&checks
    .filter(check=>!['required_finish_authority','material_activity_divergence'].includes(check.key))
    .every(check=>check.state==='passed');
  const failed = checks.filter(check => check.state !== "passed");
  return {
    state: publishable ? "publishable" as const : "review_required" as const,
    publishable,
    usable,
    valueState:usable?'calculated_with_stated_assumption' as const:'missing' as const,
    managementForecastCompletionIso: usable ? forecast.independentForecastCompletionIso : null,
    materialActivityScreeningDays,
    materialityAuthority: "cmeng_screening_not_contractual" as const,
    materialActivityIds: materialDivergences.map(row => row.activityId),
    checks,
    reason: publishable
      ? "All six forecast reconciliation checks passed. The CMeng CPM/network recalculation may be published as a management analytical forecast, separate from contractual and contractor forecasts."
      : (usable?'Calculated using the current programme logic, remaining durations and source calendars; reconciliation remains open. ':'')+failed.map(check => check.label + ": " + check.detail).join(" "),
    basis:
      "A matching Project finish does not override failed calendar, graph, source-constraint, activity-coverage, activity-divergence or required-finish-authority checks. The " +
      materialActivityScreeningDays +
      "-day activity divergence threshold is a CMeng screening threshold, not a contractual materiality rule.",
  };
}

/** Source-calendar anomalies must not be promoted as a management finish. */
export function hasUnreconciledScheduleCalendar(
  forecast: {diagnostics?:readonly string[];assumptions?:readonly string[];forecastVarianceDays?:number|null}|null|undefined,
):boolean {
  const messages=[...(forecast?.diagnostics??[]),...(forecast?.assumptions??[])];
  const calendarWarning=messages.some(message=>
    message.startsWith('CALENDAR_SEMANTICS_UNRESOLVED:')||
    message.startsWith('CALENDAR_WORK_PATTERN_NOT_ESTABLISHED:')||
    message.includes('SOURCE_DURATION_ELAPSED_DAY_PATTERN_REQUIRES_CALENDAR_RECONCILIATION')
  );
  // Independent CPM may remain available in the specialist evidence, but its
  // management headline is withheld if it differs materially from the source
  // completion until the difference is reconciled.
  return calendarWarning||(typeof forecast?.forecastVarianceDays==='number'&&
    Math.abs(forecast.forecastVarianceDays)>1);
}

export function forecastControlForState(
  state: ProjectRuntimeState,
  model: CanonicalScheduleModel,
  forecast: IndependentForecastProjection,
) {
  const time = canonicalTimeClaims(state);
  const contractTime=commercialPositionForState(state).timeExposure;
  const originalContractualCompletionIso=time.contractTimeBasis?.contractualCompletionIso??null;
  const requiredFinishIso=contractTime.officialAdjustedCompletion.value??originalContractualCompletionIso;
  const productivity = sourceProductivityForecastEvidence(state);
  const scenario = state.schedules
    .filter(item => isScenarioRevision(item))
    .sort((a,b) => a.revision.sequence - b.revision.sequence || a.revision.revisionId.localeCompare(b.revision.revisionId))
    .at(-1) ?? null;
  const scenarioFinish = scenario ? latestProgrammeFinish(scenario.revision.model) : null;
  const gate = buildForecastReconciliationGate({forecast, model, requiredFinishIso});

  return {
    gate,
    originalContractualCompletionIso,
    taxonomy: {
      contractualCompletion: {
        label: requiredFinishIso!==originalContractualCompletionIso?'Contract completion with awarded EOT':FORECAST_TAXONOMY_LABELS[0],
        completionIso: requiredFinishIso,
        authority: "contract_time_basis",
        state: requiredFinishIso ? "established" : "not_established",
      },
      contractorProgramme: {
        label: FORECAST_TAXONOMY_LABELS[1],
        completionIso: forecast.sourceForecastCompletionIso,
        authority: "submitted_programme",
        state: forecast.sourceForecastCompletionIso ? "established" : "missing",
      },
      cmengCpm: {
        label: FORECAST_TAXONOMY_LABELS[2],
        completionIso: forecast.independentForecastCompletionIso,
        authority: "cmeng_deterministic_schedule_only",
        state: forecast.complete ? "calculated" : "review_required",
        publishableAsManagementForecast: gate.publishable,
        basis:
          "Uses the current programme logic, remaining durations and readable source calendars. It does not incorporate BOQ quantities, productivity, manpower, procurement or other external delivery evidence.",
      },
      sourceProductivity: {
        label: FORECAST_TAXONOMY_LABELS[3],
        completionIso: productivity.completionIso,
        authority: "source_productivity_evidence",
        state: productivity.state,
        method: productivity.method,
        coveragePercent: productivity.calculationCoveragePercent,
        sourceRefs: productivity.sourceRefs,
      },
      independentEvidenceBased: {
        label: FORECAST_TAXONOMY_LABELS[4],
        completionIso: null,
        authority: "not_established",
        state: "not_established",
        basis:
          "Independent BOQ/productivity/resource feasibility checks remain at activity/work-package level. They are not promoted into a Project completion date until integrated through the programme network.",
      },
      scenarioRecovery: {
        label: FORECAST_TAXONOMY_LABELS[5],
        completionIso: scenarioFinish,
        authority: "scenario_only",
        state: scenarioFinish ? "scenario_programme" : "not_established",
        revisionId: scenario?.revision.revisionId ?? null,
        basis: scenarioFinish
          ? "Explicit recovery/scenario programme. It does not replace the adopted current programme unless separately adopted."
          : "No explicit recovery/scenario programme completion is established. Local recovery options are not promoted to a Project completion forecast.",
      },
    },
  };
}
