import {createHash} from 'node:crypto';
import type {ProjectRuntimeState} from './project-state-types';

// P0-A R2 (M11.1): a capacity confirmation is a statement about a resource, not
// about one programme file. It stays in use when a new programme revision
// arrives, while that revision still holds the same resource (same ID, name,
// type and unit). It becomes stale only when that resource changes or is gone.

const norm=(v:unknown)=>String(v??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
export function resourceFingerprint(resource:{resourceId:string;name?:string|null;shortName?:string|null;resourceType?:string|null;unitName?:string|null;unitAbbreviation?:string|null}){
 return createHash('sha256').update(JSON.stringify([resource.resourceId,norm(resource.name??resource.shortName),norm(resource.resourceType),norm(resource.unitAbbreviation??resource.unitName)])).digest('hex').slice(0,32);
}
/** The confirmations that apply to the programme revision now in use. */
export function currentCapacityConfirmations(state:ProjectRuntimeState,revisionId:string){
 const stored=state.resourcesByRevision.get(revisionId);
 if(!stored)return [];
 const byId=new Map(stored.resources.map(r=>[r.resourceId,resourceFingerprint(r)]));
 return (state.resourceCapacityConfirmations??[]).filter(row=>{
  const now=byId.get(row.resourceId);if(!now)return false;
  // Saved before fingerprints: the same resource ID in the current programme.
  return row.resourceFingerprint?row.resourceFingerprint===now:true;
 });
}
