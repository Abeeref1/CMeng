import type {ProjectDirectorPosition} from '../../project-director/src';

type ProductivityForecast=NonNullable<NonNullable<ProjectDirectorPosition['sourceInterpretation']>['productivityForecast']>;
export interface DashboardForecastBasis{completion:{independentFinishIso?:string|null;submittedFinishIso?:string|null}|null;productivityForecast?:ProductivityForecast|null}
/** Publish the available finish with its actual calculation basis.
 * F09: when the Dashboard's headline completion is supplied, the forecast is
 * read from it (the same reconciliation gate and productivity source the
 * Dashboard shows); the Director position is used only when it is absent. */
export function managementForecastPosition(director:ProjectDirectorPosition|null|undefined,dashboard?:DashboardForecastBasis|null){
  const source=dashboard?dashboard.productivityForecast??undefined:director?.sourceInterpretation?.productivityForecast;
  const calculated=dashboard?dashboard.completion?.independentFinishIso??null:director?.schedule.independentForecastCompletionIso??null;
  const submitted=dashboard?dashboard.completion?.submittedFinishIso??null:director?.schedule.submittedProgrammeCompletionIso??null;
  return {completionIso:source?.completionIso??calculated??submitted,
    label:source?.completionIso?'Productivity forecast':calculated?'Calculated programme finish':'Submitted programme finish',
    authority:source?.completionIso?source.authority:calculated?'calculated_with_assumptions':submitted?'source':'missing',
    interpretation:source?.completionIso?source.interpretation:calculated?'Calculated from programme logic, constraints and calendars; review the stated forecast qualifications.':submitted?'Finish from the current submitted programme. Independent calculation is unavailable.':'A current programme finish has not been supplied.',
    calendarRecalculationIso:calculated};
}
