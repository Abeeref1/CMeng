import {buildIndependentForecastProjection} from '../../independent-forecast/src';
import {reviewScheduleCalendarBasis} from './schedule-calendar-review';
import type {ProjectRuntimeState} from './project-state-types';

export const independentForecastCache =
  new WeakMap<
    ProjectRuntimeState["schedules"][number]["revision"]["model"],
    ReturnType<
      typeof buildIndependentForecastProjection
    >
  >();

export function cachedIndependentForecast(
  model:
    ProjectRuntimeState["schedules"][number]["revision"]["model"],
  generatedAt: string,
) {
  const key =
    model;
  const cached =
    independentForecastCache.get(
      key,
    );
  if (cached) {
    return cached;
  }
  const projection =
    buildIndependentForecastProjection(
      model,
      {
        generatedAt,
        producerVersion:
          "independent-forecast-fast-v1",
        cpmConfig:{applySourceConstraints:true},
      },
    );
  const calendarReview=reviewScheduleCalendarBasis(model);
  if(calendarReview.state==='calendar_basis_difference'){
    projection.origin='scenario_with_assumptions';
    projection.assumptions.push('SOURCE_DURATION_ELAPSED_DAY_PATTERN_REQUIRES_CALENDAR_RECONCILIATION');
  }
  independentForecastCache.set(
    key,
    projection,
  );
  return projection;
}
