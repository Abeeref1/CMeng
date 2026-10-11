import type {ProjectRuntimeState} from './project-state-types';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import {resolveBoqSource} from './boq-source';
import {quantityMappingForState} from './quantity-mapping-runtime';
import {linkHash,type LinkContext,type LinkRecord} from './record-link-review';
const cache=new WeakMap<ProjectRuntimeState,{version:number;model:CanonicalScheduleModel;context:LinkContext}>();
export function boqReviewContext(state:ProjectRuntimeState,model:CanonicalScheduleModel):LinkContext{
 const old=cache.get(state);if(old?.version===state.version&&old.model===model)return old.context;
 const boq=resolveBoqSource(state,model.sourceRevisionId).quantities,mapping=quantityMappingForState(state,model);
 const scopes=new Map((mapping?.sourceWbsLinks??[]).map(row=>[row.quantityItemId,row.wbsId]));
 const sources:LinkRecord[]=(boq?.items??[]).map(item=>({id:item.quantityItemId,reference:item.itemNumber??item.quantityItemId,label:[item.itemNumber,item.description,item.unit].filter(Boolean).join(' · '),text:item.description??'',unit:item.unit,wbs:scopes.get(item.quantityItemId)??null,sourceRefs:['boq:'+boq!.boqRevisionId+':'+item.quantityItemId]}));
 const targets:LinkRecord[]=model.activities.filter(row=>!['wbs_summary','level_of_effort'].includes(row.activityType)).map(row=>({id:row.activityId,reference:row.activityId,label:[row.activityId,row.name].filter(Boolean).join(' · '),text:row.name??'',wbs:row.wbsId,sourceRefs:['schedule:'+model.sourceRevisionId+':'+row.activityId]}));
 const context:LinkContext={kind:'boq_activity',basisHash:linkHash([state.projectId,'boq_activity',model.sourceRevisionId,boq?.boqRevisionId,sources,targets]),sources,targets,basis:'Existing BOQ items and programme activities. Confirming a relationship does not allocate quantity, earned value or cost.'};
 cache.set(state,{version:state.version,model,context});return context;
}
