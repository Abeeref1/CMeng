import {buildIndependentForecastProjection} from '../../independent-forecast/src';
import {reviewScheduleCalendarBasis} from './schedule-calendar-review';
import {createHash} from 'node:crypto';
import type {ProjectRuntimeState} from './project-state-types';

export const independentForecastCache =
  new WeakMap<
    ProjectRuntimeState["schedules"][number]["revision"]["model"],
    ReturnType<
      typeof buildIndependentForecastProjection
    >
  >();

// A reporting snapshot can create a second, value-identical programme model.
// The WeakMap covers identical objects; the weak content pool also reuses the
// exact CPM result across those copies without holding obsolete projections.
// Hash the WHOLE programme (including calendars, logic and actuals), rather
// than trusting an activity count, revision label or mutable project ID.
const forecastContentPool=new Map<string,WeakRef<ReturnType<typeof buildIndependentForecastProjection>>>();
const modelFingerprints=new WeakMap<ProjectRuntimeState['schedules'][number]['revision']['model'],string>();
function modelFingerprint(model:ProjectRuntimeState['schedules'][number]['revision']['model']){
  const prior=modelFingerprints.get(model);if(prior)return prior;
  const fingerprint=createHash('sha256').update(JSON.stringify(model)).digest('hex');
  modelFingerprints.set(model,fingerprint);return fingerprint;
}

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
  const profiling=process.env.CMENG_PROFILE_PERF?.trim()==='1';
  const started=profiling?performance.now():0;
  const fingerprint=modelFingerprint(model);
  const afterFingerprint=profiling?performance.now():0;
  const shared=forecastContentPool.get(fingerprint)?.deref();
  if(shared){independentForecastCache.set(key,shared);return shared;}
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
  if(profiling)process.stdout.write(JSON.stringify({event:'independent_cpm_profile',
    projectId:model.projectId,sourceRevisionId:model.sourceRevisionId,
    activities:model.activities.length,relationships:model.relationships.length,calendars:model.calendars.length,
    fingerprintMs:afterFingerprint-started,forecastMs:performance.now()-afterFingerprint})+'\n');
  forecastContentPool.delete(fingerprint);
  forecastContentPool.set(fingerprint,new WeakRef(projection));
  while(forecastContentPool.size>24)forecastContentPool.delete(forecastContentPool.keys().next().value!);
  return projection;
}
