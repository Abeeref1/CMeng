import type {ProjectDirectorPosition} from '../../project-director/src';

/** Portfolio, dashboard and reports must identify the same delivery forecast.
 * A calendar reconciliation scenario is never its silent fallback. */
export function managementForecastPosition(director:ProjectDirectorPosition|null|undefined){
  const source=director?.sourceInterpretation?.productivityForecast;
  return {completionIso:source?.completionIso??null,label:'Productivity forecast',authority:source?.authority??'missing',
    interpretation:source?.interpretation??'A productivity forecast has not yet been read from the project documents.',
    calendarRecalculationIso:director?.schedule.independentForecastCompletionIso??null};
}
