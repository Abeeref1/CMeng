import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseXerBytes} from '../../xer-parser/src';
import {canonicalScheduleFromXer,type CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ProjectRuntimeState,StoredScheduleRevision} from './project-state-types';

const cache=new WeakMap<CanonicalScheduleModel,CanonicalScheduleModel>();
/** Recover omitted metadata from the same verified source, without changing
 * governed identities, source dates, durations or project controls. */
export function refreshScheduleConstraints(state:ProjectRuntimeState,stored:StoredScheduleRevision) {
  const model=stored.revision.model;
  if(stored.format!=='xer'||model.activities.every(a=>a.sourceConstraints!==undefined))return model;
  const old=cache.get(model);if(old)return old;
  const source=state.evidenceDocuments.find(d=>d.sourceHashSha256===stored.sourceHashSha256);
  if(!source)return model;
  let result:CanonicalScheduleModel;
  try {
    const bytes=readFileSync(source.storedPath);
    if(createHash('sha256').update(bytes).digest('hex')!==source.sourceHashSha256)throw new Error('Source hash mismatch');
    const recovered=canonicalScheduleFromXer(parseXerBytes(bytes),{sourceRevisionId:model.sourceRevisionId});
    const byId=new Map(recovered.activities.map(a=>[a.activityId,a.sourceConstraints]));
    result={...model,activities:model.activities.map(a=>({...a,sourceConstraints:byId.get(a.activityId)??[]}))};
  }catch{
    result={...model,diagnostics:[...model.diagnostics,'SOURCE_CONSTRAINT_RECOVERY_NOT_ESTABLISHED']};
  }
  cache.set(model,result);return result;
}
