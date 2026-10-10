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
 const approved=new Set<string>();
 if(quantity?.scheduleRevisionId===model.sourceRevisionId)for(const link of quantity.allocations)if(activityIds.has(link.activityId)){approved.add(link.quantityItemId);const group=links.get(link.quantityItemId)??new Set<string>();group.add(link.activityId);links.set(link.quantityItemId,group);}
 const sourceLinks=new Map((mapping?.sourceWbsLinks??[]).map(row=>[row.quantityItemId,row]));
 const rows=(quantity?.items??[]).map(item=>({itemId:item.quantityItemId,itemNumber:item.itemNumber,activityIds:[...(links.get(item.quantityItemId)??[])],basis:approved.has(item.quantityItemId)?'Recorded activity allocation':sourceLinks.get(item.quantityItemId)?.basis??'No unique source code relationship'}));
 const linkedItemCount=rows.filter(r=>r.activityIds.length).length;
 const value={itemCount:quantity?rows.length:null,linkedItemCount:quantity?linkedItemCount:null,coveragePercent:rows.length?linkedItemCount/rows.length*100:null,approvedAllocatedItemCount:quantity?approved.size:null,rows,
 basis:'Complete BOQ population. Links use exact source WBS codes or a unique source section match to the current programme, plus recorded activity allocations. A WBS scope association is not an approved quantity split.'};
 cache.set(state,{version:state.version,model,value});return value;
}
