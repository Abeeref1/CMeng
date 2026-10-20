import type {ProjectRuntimeState} from './project-state-types';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import {quantityMappingForState} from './quantity-mapping-runtime';
import {resolveBoqSource} from './boq-source';
const cache=new WeakMap<ProjectRuntimeState,{version:number;model:CanonicalScheduleModel;value:any}>();
export function boqProgrammeLinks(state:ProjectRuntimeState,model:CanonicalScheduleModel){
 const cached=cache.get(state);if(cached?.version===state.version&&cached.model===model)return cached.value;
 const source=resolveBoqSource(state,model.sourceRevisionId),quantity=source.quantities,mapping=quantityMappingForState(state,model);
 const activityIds=new Set(model.activities.map(a=>a.activityId)),links=new Map<string,Set<string>>();
 for(const link of mapping?.sourceWbsLinks??[])if(link.wbsId)for(const activityId of link.activityIds){const group=links.get(link.quantityItemId)??new Set<string>();group.add(activityId);links.set(link.quantityItemId,group);}
 const confirmedScope=new Set<string>(),quantityIds=new Set((quantity?.items??[]).map(i=>i.quantityItemId));
 for(const r of state.linkCandidateReviews??[])if(r.kind==='boq_activity'&&r.state==='confirmed'&&r.basisVersion===state.version&&activityIds.has(r.targetId)&&quantityIds.has(r.sourceId)){
  const group=links.get(r.sourceId)??new Set<string>();group.add(r.targetId);links.set(r.sourceId,group);confirmedScope.add(r.sourceId);
 }
 const approved=new Set<string>();
 if(quantity?.scheduleRevisionId===model.sourceRevisionId)for(const link of quantity.allocations)if(activityIds.has(link.activityId)){approved.add(link.quantityItemId);const group=links.get(link.quantityItemId)??new Set<string>();group.add(link.activityId);links.set(link.quantityItemId,group);}
 const sourceLinks=new Map((mapping?.sourceWbsLinks??[]).map(row=>[row.quantityItemId,row]));
 const rows=(quantity?.items??[]).map(item=>({itemId:item.quantityItemId,itemNumber:item.itemNumber,activityIds:[...(links.get(item.quantityItemId)??[])],basis:approved.has(item.quantityItemId)?'Recorded activity allocation':confirmedScope.has(item.quantityItemId)?'User-confirmed BOQ/activity scope relationship; no quantity split approved':sourceLinks.get(item.quantityItemId)?.basis??'No unique source code relationship'}));
 const linkedItemCount=rows.filter(r=>r.activityIds.length).length;
 const value={itemCount:quantity?rows.length:null,linkedItemCount:quantity?linkedItemCount:null,coveragePercent:rows.length?linkedItemCount/rows.length*100:null,approvedAllocatedItemCount:quantity?approved.size:null,confirmedScopeLinkCount:confirmedScope.size,rows,
 basis:'All BOQ items. Links use exact source WBS codes, unique source section matches, current user-reviewed section scope and recorded activity allocations. A WBS scope association is not an approved quantity split.'};
 cache.set(state,{version:state.version,model,value});return value;
}
