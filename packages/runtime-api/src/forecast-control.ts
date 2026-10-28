import type {CanonicalScheduleModel} from "../../schedule-analysis-core/src";
import type {IndependentForecastProjection} from "../../independent-forecast/src";
import type {ProjectRuntimeState} from "./project-state-types";
import {canonicalTimeClaims} from "./canonical-time-claims";
import {isScenarioRevision} from "./schedule-authority";
import {sourceProductivityForecastEvidence} from "./source-productivity-forecast";
import {commercialPositionForState} from './commercial-runtime';
import {contractTimeDatesFrom} from './contract-time-reader';
export {managementReviewStateOf} from './forecast-review-state';

export const FORECAST_TAXONOMY_LABELS = [
  "Contractual completion",
  "Contractor programme forecast",
  "CMeng CPM/network recalculation",
  "Source productivity forecast",
  "Independent evidence-based forecast",
  "Scenario/recovery forecast",
] as const;

export type ForecastGateState = "passed" | "review_required" | "not_established";

/** P0-B: what qualifies a calculated finish and what would firm it up. */
export interface ForecastQualification {
  code:
    | "assumed_calendar"
    | "elapsed_day_pattern"
    | "contractor_difference"
    | "activity_divergence"
    | "constraints_not_applied"
    | "network_references"
    | "partial_coverage";
  text: string;
  action: string;
  count: number | null;
}

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
  // C5: completed activities are fixed at their actual dates; their calendar changes nothing.
  const completedActivityIds = new Set(model.activities.filter(activity => activity.status === "completed").map(activity => activity.activityId));
  const unresolvedCalendarActivities = forecast.activities.filter(row =>
    !completedActivityIds.has(row.activityId) &&
    (row.calendarMode !== "source_calendar" || row.status !== "calculated"),
  );
  const sourceConstraintActivities = model.activities.filter(activity =>
    (activity.sourceConstraints?.length ?? 0) > 0,
  );
  const constraintsApplied=forecast.diagnostics.some(code=>code.startsWith('SOURCE_CONSTRAINTS_APPLIED'));
  const unappliedConstraints=sourceConstraintActivities.length>0&&!constraintsApplied;
  // ABB G3_CHANGES_FORECAST-44: the divergence check tests only activities that
  // have both a calculated and a submitted finish. With none, nothing was tested:
  // the check is not established, never "passed".
  const comparedActivities = forecast.activities.filter(row =>
    typeof row.finishVarianceDays === "number" &&
    Number.isFinite(row.finishVarianceDays),
  );
  const materialDivergences = comparedActivities.filter(row =>
    Math.abs(row.finishVarianceDays!) > materialActivityScreeningDays,
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
        ? "All execution activities are covered by the calculation."
        : "Activity calculation coverage is " + (forecast.activityCoveragePercent === null ? "not established" : forecast.activityCoveragePercent + "%") + ".",
      count: forecast.unresolvedActivityCount,
    },
    {
      key: "material_activity_divergence",
      label: "Material activity-level divergence",
      state: comparedActivities.length === 0 ? "not_established" : materialDivergences.length === 0 ? "passed" : "review_required",
      detail: comparedActivities.length === 0
        ? "Not tested: no activity has both a calculated finish and a submitted finish to compare."
        : materialDivergences.length === 0
        ? "No calculated activity finish differs from its submitted finish by more than the disclosed CMeng screening threshold."
        : String(materialDivergences.length) + " activity(ies) differ by more than " + materialActivityScreeningDays + " calendar days and require reconciliation.",
      count: comparedActivities.length === 0 ? null : materialDivergences.length,
    },
    {
      key: "required_finish_authority",
      label: "Required finish authority",
      state: requiredFinishIso ? "passed" : "not_established",
      detail: requiredFinishIso
        ? "A contractual/required finish is established for the management comparison."
        : "No confirmed contract or required finish date is established yet.",
      count: requiredFinishIso ? 1 : 0,
    },
  ];

  // P0-B invariant: if CMeng can calculate a finish from the network, it is the
  // management answer. Calendar and data conflicts, completed-activity
  // anomalies and the difference from the contractor's finish qualify it and
  // say what would reconcile it; they never erase it. Only a network CMeng
  // cannot calculate gives no finish, and then the cause is named.
  // A network that cannot be calculated never gives a finish, whatever else a result carries.
  const networkFailed = forecast.diagnostics.some(code => code.startsWith("CPM_NETWORK_NOT_CALCULABLE"));
  const calculatedFinish = networkFailed ? null : forecast.calculatedCompletionIso !== undefined
    ? forecast.calculatedCompletionIso
    : forecast.complete === false ? null : forecast.independentForecastCompletionIso;
  const qualifications = forecastQualifications({forecast, model, materialActivityScreeningDays, materialDivergences: materialDivergences.length,
    unappliedConstraints: unappliedConstraints ? sourceConstraintActivities.length : 0, graphDiagnostics: graphDiagnostics.length});
  const usable = calculatedFinish !== null;
  // "Publishable" now means fully reconciled: every calculation check passed and nothing
  // qualifies the finish. A missing contract or required finish is not a fault in the
  // forecast (C6): it limits the contract comparison only, which is stated separately.
  const publishable = usable && checks.every(check => check.state === "passed" || check.key === "required_finish_authority") && qualifications.length === 0;
  const failed = checks.filter(check => check.state !== "passed");
  const notCalculableReason = usable ? null :
    (failed.filter(check => check.key !== "required_finish_authority" && check.key !== "material_activity_divergence").map(check => check.label + ": " + check.detail).join(" ") ||
      "CMeng could not calculate a finish from this programme network.");
  const managementState = !usable ? "not_calculable" as const : qualifications.length ? "calculated_with_qualifications" as const : "calculated" as const;
  return {
    state: publishable ? "publishable" as const : "review_required" as const,
    publishable,
    usable,
    valueState: usable ? (qualifications.length ? 'calculated_with_stated_assumption' as const : 'calculated' as const) : 'missing' as const,
    managementForecastCompletionIso: usable ? calculatedFinish : null,
    managementForecast: {
      completionIso: usable ? calculatedFinish : null,
      state: managementState,
      qualifications,
      notCalculableReason,
    },
    materialActivityScreeningDays,
    materialityAuthority: "cmeng_screening_not_contractual" as const,
    materialActivityIds: materialDivergences.map(row => row.activityId),
    checks,
    reason: !usable
      ? "CMeng cannot calculate a finish from this programme yet. " + notCalculableReason
      : publishable
        ? "All six forecast reconciliation checks passed. The CMeng CPM/network recalculation is the management analytical forecast, separate from contractual and contractor forecasts."
        : "CMeng calculates the finish from the current programme logic, remaining durations and calendars." +
          (qualifications.length ? " " + qualifications.map(q => q.text).join(" ") : "") +
          (requiredFinishIso ? "" : " " + checks.find(check => check.key === "required_finish_authority")!.detail),
    basis:
      "The finish is shown whenever the network can be calculated; each qualification says what would reconcile it. The " +
      materialActivityScreeningDays +
      "-day activity divergence threshold is a CMeng screening threshold, not a contractual materiality rule.",
  };
}

function plural(count: number, one: string, many: string) { return count === 1 ? one : many; }
function dayText(days: number) { const n = Math.abs(days); return n + " " + plural(n, "day", "days"); }
/** The qualifications of a calculated finish, each with the input that would firm it up. */
export function forecastQualifications(input: {
  forecast: IndependentForecastProjection;
  model: CanonicalScheduleModel;
  materialActivityScreeningDays: number;
  materialDivergences: number;
  unappliedConstraints: number;
  graphDiagnostics: number;
}): ForecastQualification[] {
  const {forecast} = input;
  const out: ForecastQualification[] = [];
  const assumed = forecast.assumedCalendarOpenActivityIds ?? [];
  if (assumed.length) out.push({code: "assumed_calendar", count: assumed.length,
    text: assumed.length + " open " + plural(assumed.length, "activity has", "activities have") + " no readable working calendar; CMeng assumed continuous working for " + plural(assumed.length, "it", "them") + ".",
    action: "Supply the working calendar (days and shift hours) for " + plural(assumed.length, "this activity", "these activities") + "."});
  const messages = [...(forecast.diagnostics ?? []), ...(forecast.assumptions ?? [])];
  if (messages.some(message => message.includes("SOURCE_DURATION_ELAPSED_DAY_PATTERN_REQUIRES_CALENDAR_RECONCILIATION")))
    out.push({code: "elapsed_day_pattern", count: null,
      text: "Some completed tasks have durations that match calendar days, not working days; remaining durations may follow the same basis.",
      action: "Confirm whether the programme's durations are in working days or calendar days."});
  // The difference is read in calendar dates. A finish placed at the next morning
  // (a milestone convention) is not a one-day disagreement.
  const calculated = forecast.calculatedCompletionIso !== undefined ? forecast.calculatedCompletionIso : forecast.complete === false ? null : forecast.independentForecastCompletionIso;
  const dateMs = (iso: string | null | undefined) => iso ? Date.parse(iso.slice(0, 10) + "T00:00:00Z") : NaN;
  const variance = calculated && forecast.sourceForecastCompletionIso ? (dateMs(calculated) - dateMs(forecast.sourceForecastCompletionIso)) / 86400000 : null;
  if (typeof variance === "number" && Number.isFinite(variance) && Math.abs(variance) > 1)
    out.push({code: "contractor_difference", count: variance,
      text: "CMeng's finish is " + dayText(variance) + " " + (variance > 0 ? "later" : "earlier") + " than the contractor's programme finish" + (forecast.sourceForecastCompletionIso ? " (" + forecast.sourceForecastCompletionIso.slice(0, 10) + ")" : "") + ".",
      action: "Reconcile the logic, durations and calendars behind the difference with the programme owner."});
  if (input.materialDivergences > 0)
    out.push({code: "activity_divergence", count: input.materialDivergences,
      text: input.materialDivergences + " " + plural(input.materialDivergences, "activity finishes", "activities finish") + " more than " + input.materialActivityScreeningDays + " days away from the submitted date.",
      action: "Check the listed activities with the planner."});
  if (input.unappliedConstraints > 0)
    out.push({code: "constraints_not_applied", count: input.unappliedConstraints,
      text: input.unappliedConstraints + " source " + plural(input.unappliedConstraints, "constraint was", "constraints were") + " not applied in this calculation.",
      action: "Confirm whether the source constraints still apply."});
  if (input.graphDiagnostics > 0)
    out.push({code: "network_references", count: input.graphDiagnostics,
      text: "The programme has " + input.graphDiagnostics + " logic reference " + plural(input.graphDiagnostics, "problem", "problems") + " (for example a missing predecessor).",
      action: "Correct the listed logic references in the programme."});
  const other = Math.max(0, (forecast.unresolvedActivityCount ?? 0) - assumed.length);
  if (other > 0)
    out.push({code: "partial_coverage", count: other,
      text: other + " " + plural(other, "activity was", "activities were") + " not fully calculated.",
      action: "Check the listed activities' logic and durations."});
  return out;
}

/** Kept for evidence and older callers only. P0-B: no consumer may use it to withhold a calculated finish; calendar and finish differences are qualifications (see forecastQualifications). */
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
  // F33: the shared governing date (contract + awarded EOT); never the original
  // date while an award exists but the extended date is not established.
  const requiredFinishIso=contractTimeDatesFrom(contractTime).governingCompletionIso;
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
