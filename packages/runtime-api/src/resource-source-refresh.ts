import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseXerBytes} from '../../xer-parser/src';
import {canonicalResourcesFromXer,type CanonicalResourceModel} from '../../schedule-resource-core/src';
import type {ProjectRuntimeState} from './project-state-types';
const cache=new WeakMap<CanonicalResourceModel,CanonicalResourceModel>();
/** Recover previously omitted columns only from the unchanged original file.
 * Retain every existing identity, unit, assignment quantity and capacity. */
export function refreshResourceSourceFields(state:ProjectRuntimeState,model:CanonicalResourceModel){
  if(model.assignments.every(a=>a.plannedCost!==undefined)&&model.resources.every(r=>r.defaultUnitsPerHour!==undefined))return model;
  const existing=cache.get(model);if(existing)return existing;
  const stored=state.schedules.find(s=>s.revision.revisionId===model.sourceRevisionId);
  const doc=state.evidenceDocuments.find(d=>d.sourceHashSha256===stored?.sourceHashSha256);
  if(!doc||stored?.format!=='xer')return model;
  let result:CanonicalResourceModel=model;
  try{
    const bytes=readFileSync(doc.storedPath);
    if(createHash('sha256').update(bytes).digest('hex')!==doc.sourceHashSha256)throw new Error('Source hash mismatch');
    const source=canonicalResourcesFromXer(parseXerBytes(bytes),{sourceRevisionId:model.sourceRevisionId});
    const assignments=new Map(source.assignments.map(a=>[a.assignmentId,a])),resources=new Map(source.resources.map(r=>[r.resourceId,r]));
    result={...model,assignments:model.assignments.map(a=>{const r=assignments.get(a.assignmentId);return r?{...a,plannedCost:r.plannedCost??null,actualRegularCost:r.actualRegularCost??null,actualOvertimeCost:r.actualOvertimeCost??null,remainingCost:r.remainingCost??null}:a;}),
      resources:model.resources.map(r=>({...r,defaultUnitsPerHour:resources.get(r.resourceId)?.defaultUnitsPerHour??null}))};
  }catch{result={...model,diagnostics:[...model.diagnostics,'RESOURCE_COST_SOURCE_REFRESH_FAILED']};}
  cache.set(model,result);return result;
}
