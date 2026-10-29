import type {ProjectRuntimeState} from './project-state-types';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import {quantityMappingForState} from './quantity-mapping-runtime';
import {resolveBoqSource} from './boq-source';
import {boqActivityReviewChecker} from './link-validity';
import {boqLaborRateRows} from './boq-rate-links';
import {dateValue} from '../../truth-kernel/src';
import type {CanonicalQuantityProgressModel,QuantityScheduleAllocation} from '../../quantity-progress-core/src/types';
const cache=new WeakMap<ProjectRuntimeState,{version:number;model:CanonicalScheduleModel;value:any}>();
export function boqProgrammeLinks(state:ProjectRuntimeState,model:CanonicalScheduleModel){
 const cached=cache.get(state);if(cached?.version===state.version&&cached.model===model)return cached.value;
 const source=resolveBoqSource(state,model.sourceRevisionId),quantity=source.quantities,mapping=quantityMappingForState(state,model);
 const activityIds=new Set(model.activities.map(a=>a.activityId)),links=new Map<string,Set<string>>();
 for(const link of mapping?.sourceWbsLinks??[])if(link.wbsId)for(const activityId of link.activityIds){const group=links.get(link.quantityItemId)??new Set<string>();group.add(activityId);links.set(link.quantityItemId,group);}
 const confirmedScope=new Set<string>(),quantityIds=new Set((quantity?.items??[]).map(i=>i.quantityItemId));
 // R2: a confirmed link counts while its BOQ item and its activity are unchanged, whatever else was saved.
 const linkIsCurrent=boqActivityReviewChecker(state,model,quantity?.items??[]);
 for(const r of state.linkCandidateReviews??[])if(r.kind==='boq_activity'&&r.state==='confirmed'&&activityIds.has(r.targetId)&&quantityIds.has(r.sourceId)&&linkIsCurrent(r)){
  const group=links.get(r.sourceId)??new Set<string>();group.add(r.targetId);links.set(r.sourceId,group);confirmedScope.add(r.sourceId);
 }
 const approved=new Set<string>();
 // M8.3: allocations come from the one governed allocation truth (recorded, confirmed link, rate-table link).
 const governed=governedQuantityModel(state,model);
 for(const link of governed.quantities?.allocations??[])if(activityIds.has(link.activityId)){approved.add(link.quantityItemId);const group=links.get(link.quantityItemId)??new Set<string>();group.add(link.activityId);links.set(link.quantityItemId,group);}
 const sourceLinks=new Map((mapping?.sourceWbsLinks??[]).map(row=>[row.quantityItemId,row]));
 const rows=(quantity?.items??[]).map(item=>({itemId:item.quantityItemId,itemNumber:item.itemNumber,activityIds:[...(links.get(item.quantityItemId)??[])],allocationBasis:governed.basisByItem.get(item.quantityItemId)??null,basis:governed.basisByItem.get(item.quantityItemId)==='recorded_allocation'?'Recorded activity allocation':governed.basisByItem.get(item.quantityItemId)==='confirmed_link'?'User-confirmed link to one activity; the whole item quantity is allocated to it':governed.basisByItem.get(item.quantityItemId)==='rate_table_link'?'Labour-rate table names this item and one activity; the whole item quantity is allocated to it':confirmedScope.has(item.quantityItemId)?'User-confirmed BOQ/activity scope relationship to several activities; no quantity split approved':sourceLinks.get(item.quantityItemId)?.basis??'No unique source code relationship'}));
 const linkedItemCount=rows.filter(r=>r.activityIds.length).length;
 const value={itemCount:quantity?rows.length:null,linkedItemCount:quantity?linkedItemCount:null,coveragePercent:rows.length?linkedItemCount/rows.length*100:null,approvedAllocatedItemCount:quantity?approved.size:null,confirmedScopeLinkCount:confirmedScope.size,rows,
 basis:'All BOQ items. Links use exact source WBS codes, unique source section matches, current user-reviewed section scope and recorded activity allocations. A WBS scope association is not an approved quantity split.'};
 cache.set(state,{version:state.version,model,value});return value;
}

type AllocationBasis='recorded_allocation'|'confirmed_link'|'rate_table_link';
const allocationCache=new WeakMap<ProjectRuntimeState,{version:number;model:CanonicalScheduleModel;value:{quantities:CanonicalQuantityProgressModel|null;basisByItem:Map<string,AllocationBasis>}}>();
/** M8.3 + M11.2: the one BOQ-to-activity allocation truth. Every consumer
 * (Delivery, quantity S-curve, feasibility and challenge, the shared link rows)
 * reads the quantities through this model. Per BOQ item, in this order:
 * a recorded allocation for this programme revision (PUT /quantities or carried);
 * else a user-confirmed link to exactly one current activity (the whole item
 * quantity to that activity; a split is never guessed); else a labour-rate table
 * row naming the item and exactly one activity. CMeng proposals and WBS scope
 * associations are never allocations. */
export function governedQuantityModel(state:ProjectRuntimeState,model:CanonicalScheduleModel){
  const cached=allocationCache.get(state);if(cached?.version===state.version&&cached.model===model)return cached.value;
  const quantities=resolveBoqSource(state,model.sourceRevisionId).quantities;
  const basisByItem=new Map<string,AllocationBasis>();
  if(!quantities){const value={quantities:null,basisByItem};allocationCache.set(state,{version:state.version,model,value});return value;}
  const activityIds=new Set(model.activities.map(a=>a.activityId));
  const sameRevision=quantities.scheduleRevisionId===model.sourceRevisionId;
  const recorded=sameRevision?quantities.allocations.filter(a=>activityIds.has(a.activityId)):[];
  for(const a of recorded)basisByItem.set(a.quantityItemId,'recorded_allocation');
  const linkIsCurrent=boqActivityReviewChecker(state,model,quantities.items);
  const confirmed=new Map<string,Array<{activityId:string;reviewId:string}>>();
  for(const r of state.linkCandidateReviews??[])if(r.kind==='boq_activity'&&r.state==='confirmed'&&activityIds.has(r.targetId)&&linkIsCurrent(r)){
    const list=confirmed.get(r.sourceId)??[];if(!list.some(x=>x.activityId===r.targetId))list.push({activityId:r.targetId,reviewId:String((r as {reviewId?:string}).reviewId??r.sourceId+'|'+r.targetId)});confirmed.set(r.sourceId,list);
  }
  const rateLinks=new Map<string,Set<string>>(),rateRefs=new Map<string,string[]>();
  for(const rate of boqLaborRateRows(state,quantities.items,dateValue(model.dataDateIso??'')))if(activityIds.has(rate.activityId)){
    const set=rateLinks.get(rate.quantityItemId)??new Set<string>();set.add(rate.activityId);rateLinks.set(rate.quantityItemId,set);
    rateRefs.set(rate.quantityItemId,[...(rateRefs.get(rate.quantityItemId)??[]),...rate.sourceRefs]);
  }
  const derived:QuantityScheduleAllocation[]=[];
  for(const item of quantities.items){
    if(basisByItem.has(item.quantityItemId))continue;
    const quantity=item.contractQuantity;
    if(typeof quantity!=='number'||!Number.isFinite(quantity)||quantity<0)continue;
    const links=confirmed.get(item.quantityItemId)??[];
    if(links.length===1){
      derived.push({allocationId:'confirmed-link:'+item.quantityItemId+':'+links[0]!.activityId,quantityItemId:item.quantityItemId,activityId:links[0]!.activityId,allocatedQuantity:quantity,
        sourceRefs:[{source:'governed_mapping',locator:'user-confirmed-link:'+links[0]!.reviewId}]});
      basisByItem.set(item.quantityItemId,'confirmed_link');continue;
    }
    if(links.length>1)continue; // confirmed to several activities: the split is the user's to give
    const rated=[...(rateLinks.get(item.quantityItemId)??[])];
    if(rated.length===1){
      derived.push({allocationId:'rate-table-link:'+item.quantityItemId+':'+rated[0]!,quantityItemId:item.quantityItemId,activityId:rated[0]!,allocatedQuantity:quantity,
        sourceRefs:(rateRefs.get(item.quantityItemId)??[]).map(ref=>({source:'governed_mapping' as const,locator:ref}))});
      basisByItem.set(item.quantityItemId,'rate_table_link');
    }
  }
  const governed:CanonicalQuantityProgressModel={...quantities,scheduleRevisionId:sameRevision||derived.length?model.sourceRevisionId:quantities.scheduleRevisionId,allocations:[...recorded,...derived]};
  // A recorded allocation for another revision stays out (it is not current) but is not lost from the source model.
  const value={quantities:governed,basisByItem};
  allocationCache.set(state,{version:state.version,model,value});
  return value;
}
