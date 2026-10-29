import {canonicalHeader} from '../../truth-kernel/src';
import type {DeliveryRecord} from '../../delivery-core/src/types';
import type {ProjectRuntimeState} from './project-state-types';
import {deliveryRecords} from './delivery-records';
import {operationalReporting} from './reporting-state';
import {splitLinkCell} from './link-cell';
import {UNASSIGNED_OWNER} from './pmc-roles';

/** M12.1: the owner a register record names reaches the activities it is linked
 * to, through the one Delivery link reader. Only a stated link or a link
 * confirmed in review carries an owner (a CMeng proposal does not). A record
 * that names no owner adds none: the PMC role fallback stays, marked
 * "individual not designated". Every consumer that shows an activity's owner
 * reads this one function. */
export type ActivityOwner={owner:string;recordId:string;reference:string|null;kind:string;link:'stated'|'reviewed';sourceRefs:string[]};

const named=(value:unknown)=>{const text=String(value??'').trim();return text&&!UNASSIGNED_OWNER.test(text)?text:null;};
const recordOwner=(r:DeliveryRecord)=>{for(const name of ['owner','responsible party','responsible','assigned to','action owner']){const v=named(r.fields[canonicalHeader(name)]);if(v)return v;}return null;};

const cache=new WeakMap<object,{version:number;delivery:object;value:Map<string,ActivityOwner[]>}>();
export function ownersForActivity(state:ProjectRuntimeState):Map<string,ActivityOwner[]>{
  const source=deliveryRecords(state);
  const hit=cache.get(state);
  if(hit&&hit.version===state.version&&hit.delivery===source)return hit.value;
  const out=new Map<string,ActivityOwner[]>();
  const push=(activityId:string,item:ActivityOwner)=>{const list=out.get(activityId)??[];if(!list.some(o=>o.owner===item.owner&&o.recordId===item.recordId))list.push(item);out.set(activityId,list);};
  const linked=new Set<string>();
  for(const r of source.records){
    if(r.state==='superseded'||r.state==='scenario')continue;
    const link=r.activityLink?.state;
    if(link!=='stated'&&link!=='reviewed')continue;
    if(r.reference)linked.add(r.kind+'|'+r.reference.toLowerCase());
    const owner=recordOwner(r);if(!owner)continue;
    const refs=r.receipts.map(x=>'evidence-document:'+x.documentId+':'+x.locator);
    for(const id of r.links.activityIds)push(id,{owner,recordId:r.recordId,reference:r.reference,kind:r.kind,link,sourceRefs:refs});
  }
  // Risk rows are not Delivery records: their stated activity cell is the link.
  for(const row of operationalReporting(state).risk.current as any[]){
    const owner=named(row.owner);if(!owner)continue;
    for(const id of splitLinkCell(row.linkedActivityId))push(id,{owner,recordId:row.riskId,reference:row.riskId,kind:'risk',link:'stated',sourceRefs:row.sourceRefs??[]});
  }
  cache.set(state,{version:state.version,delivery:source,value:out});
  return out;
}

/** The owners of one activity as one display value (all listed), or null. */
export function activityOwnerText(owners:readonly ActivityOwner[]|undefined):string|null{
  const names=[...new Set((owners??[]).map(o=>o.owner))];
  return names.length?names.join('; '):null;
}

/** The one edit of a readiness row: the owners linked records name for its activity. */
export function withActivityOwners<T extends {activityId:string}>(row:T,owners:ReadonlyMap<string,ActivityOwner[]>):T{
  const list=owners.get(row.activityId);
  return list?.length?{...row,linkedOwners:list.map(o=>({owner:o.owner,reference:o.reference,kind:o.kind,link:o.link,sourceRefs:o.sourceRefs}))}:row;
}
