import type {ProjectRuntimeState} from './project-state-types';
import {projectControlSchedule} from './canonical-time-claims';
import {boqReviewContext} from './boq-link-context';
import {resolveBoqSource} from './boq-source';
import {quantityMappingForState} from './quantity-mapping-runtime';
import {commercialPositionForState} from './commercial-runtime';
import {linkHash,type LinkContext,type LinkRecord,type RecordLinkKind} from './record-link-review';
const cached=new WeakMap<ProjectRuntimeState,{version:number;contexts:Map<RecordLinkKind,LinkContext>}>();
export function currentLinkContext(state:ProjectRuntimeState,kind:RecordLinkKind):LinkContext{
 let entry=cached.get(state);if(!entry||entry.version!==state.version){entry={version:state.version,contexts:new Map()};cached.set(state,entry);}
 const old=entry.contexts.get(kind);if(old)return old;
 let result:LinkContext;
 if(kind==='payment_certificate'){
  const position=commercialPositionForState(state) as any;
  result=position.paymentLinkage?.linkContext??{kind,basisHash:linkHash([state.projectId,kind,'no-sources']),sources:[],targets:[],basis:'No dated receipt/certificate source population is established.'};
 }else{
  const model=projectControlSchedule(state)?.revision.model;
  result=model?boqReviewContext(state,model):{kind,basisHash:linkHash([state.projectId,kind,'no-programme']),sources:[],targets:[],basis:'A current programme and BOQ are needed to review relationships.'};
 }
 entry.contexts.set(kind,result);return result;
}
