import {buildIndependentForecastProjection} from '../../independent-forecast/src';
import {reviewScheduleCalendarBasis} from './schedule-calendar-review';
import {savedProgrammeResult} from './programme-results';
import type {ProjectRuntimeState} from './project-state-types';

export const independentForecastCache =
  new WeakMap<
    ProjectRuntimeState["schedules"][number]["revision"]["model"],
    ReturnType<
      typeof buildIndependentForecastProjection
    >
  >();

const FORECAST_OPTIONS={producerVersion:"independent-forecast-fast-v1",cpmConfig:{applySourceConstraints:true}} as const;

export function cachedIndependentForecast(
  model:
    ProjectRuntimeState["schedules"][number]["revision"]["model"],
  generatedAt: string,
) {
  const cached=independentForecastCache.get(model);
  if(cached)return cached;
  const profiling=process.env.CMENG_PROFILE_PERF?.trim()==='1';
  const started=profiling?performance.now():0;
  let computed=false;
  // Mechanism 14: one saved CPM result per exact programme content. A
  // value-identical reporting copy of the same revision reads the same result,
  // in this request, on every other page and after a restart.
  const projection=savedProgrammeResult('independent-forecast',[model,FORECAST_OPTIONS],()=>{
    computed=true;
    const value=buildIndependentForecastProjection(model,{generatedAt,...FORECAST_OPTIONS});
    const calendarReview=reviewScheduleCalendarBasis(model);
    if(calendarReview.state==='calendar_basis_difference'){
      value.origin='scenario_with_assumptions';
      value.assumptions.push('SOURCE_DURATION_ELAPSED_DAY_PATTERN_REQUIRES_CALENDAR_RECONCILIATION');
    }
    return value;
  },saved=>({...saved,generatedAt}));
  independentForecastCache.set(model,projection);
  if(profiling)process.stdout.write(JSON.stringify({event:'independent_cpm_profile',
    projectId:model.projectId,sourceRevisionId:model.sourceRevisionId,
    activities:model.activities.length,relationships:model.relationships.length,calendars:model.calendars.length,
    computed,forecastMs:performance.now()-started})+'\n');
  return projection;
}
