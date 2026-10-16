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
type ForecastModel=ProjectRuntimeState['schedules'][number]['revision']['model'];
type ForecastProjection=ReturnType<typeof buildIndependentForecastProjection>;
// The full-content hash is still the only equality test. It is computed only
// when a pooled programme has the same identity shape (project, revision, Data
// Date, source and table sizes) - a necessary condition for an identical copy -
// instead of hashing every distinct revision on its first cold CPM lookup.
// A pooled projection keeps its own programme reachable (weakly, only while
// the projection itself is reachable) so its hash can be taken on demand.
type PoolEntry={shape:string;projection:WeakRef<ForecastProjection>;fingerprint?:string};
const forecastContentPool:PoolEntry[]=[];
const projectionModels=new WeakMap<ForecastProjection,ForecastModel>();
const modelFingerprints=new WeakMap<ForecastModel,string>();
function modelFingerprint(model:ForecastModel){
  const prior=modelFingerprints.get(model);if(prior)return prior;
  const fingerprint=createHash('sha256').update(JSON.stringify(model)).digest('hex');
  modelFingerprints.set(model,fingerprint);return fingerprint;
}
function modelShape(model:ForecastModel){
  return JSON.stringify([model.projectId,model.sourceRevisionId,model.dataDateIso,model.source,
    model.activities?.length,model.relationships?.length,model.calendars?.length,model.wbs?.length]);
}
function entryFingerprint(entry:PoolEntry){
  if(entry.fingerprint===undefined){
    const pooled=entry.projection.deref(),pooledModel=pooled&&projectionModels.get(pooled);
    if(pooledModel)entry.fingerprint=modelFingerprint(pooledModel);
  }
  return entry.fingerprint;
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
  const shape=modelShape(model);
  let fingerprint:string|undefined;
  let shared:ForecastProjection|undefined;
  for(const entry of forecastContentPool){
    if(entry.shape!==shape)continue;
    fingerprint??=modelFingerprint(model);
    if(entryFingerprint(entry)===fingerprint){shared=entry.projection.deref();break;}
  }
  const afterFingerprint=profiling?performance.now():0;
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
  // Replace the pooled entry for this exact content (or a collected one of
  // the same shape), then keep the 24 most recent entries.
  for(let index=forecastContentPool.length-1;index>=0;index--){
    const entry=forecastContentPool[index]!;
    if(entry.shape!==shape)continue;
    const known=entryFingerprint(entry);
    if(known===undefined||known===fingerprint)forecastContentPool.splice(index,1);
  }
  projectionModels.set(projection,model);
  forecastContentPool.push({shape,projection:new WeakRef(projection),...(fingerprint===undefined?{}:{fingerprint})});
  while(forecastContentPool.length>24)forecastContentPool.shift();
  return projection;
}
