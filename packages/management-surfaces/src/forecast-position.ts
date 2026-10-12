import type {ProjectDirectorPosition} from '../../project-director/src';

/** Publish the available finish with its actual calculation basis. */
export function managementForecastPosition(director:ProjectDirectorPosition|null|undefined){
  const source=director?.sourceInterpretation?.productivityForecast;
  const calculated=director?.schedule.independentForecastCompletionIso??null;
  const submitted=director?.schedule.submittedProgrammeCompletionIso??null;
  return {completionIso:source?.completionIso??calculated??submitted,
    label:source?.completionIso?'Productivity forecast':calculated?'Calculated programme finish':'Submitted programme finish',
    authority:source?.completionIso?source.authority:calculated?'calculated_with_assumptions':submitted?'source':'missing',
    interpretation:source?.completionIso?source.interpretation:calculated?'Calculated from programme logic, constraints and calendars; review the stated forecast qualifications.':submitted?'Finish from the current submitted programme. Independent calculation is unavailable.':'A current programme finish has not been supplied.',
    calendarRecalculationIso:calculated};
}
