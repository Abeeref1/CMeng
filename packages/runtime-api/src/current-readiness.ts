import type {ReadinessDimensionKey,ReadinessEvidence} from '../../lookahead-schedule/src';
import type {DeliveryKind,DeliveryRecord} from '../../delivery-core/src/types';
import {deliveryDocumentKinds} from '../../delivery-core/src/reader-columns';
import type {ProjectRuntimeState} from './project-state-types';
import {deliveryRecords,deliveryStore,deliveryPopulationPosition} from './delivery-records';
import {registerActivityLinker} from './register-activity-linker';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {READINESS_DIMENSION_DOCUMENT_TYPES,reportingReadinessEvidence,type ReadinessLinkReader} from './evidence-readiness';
import {analyticalOperationalDocuments} from './operational-reporting';
import {splitLinkCell} from './link-cell';
import {isReportingView} from './reporting-state';

// P0-C (C10, C11, M8.2): readiness is read when it is used, from the current
// sources, through the one link reader. A register row applies to the
// activities its Delivery record links to now: stated, reviewed or proposed by
// CMeng. A link confirmed or corrected in review therefore reaches Look-Ahead,
// Construction Readiness, diagnosis and workfronts at once, and a register
// uploaded before the programme is linked as soon as the programme arrives.
// Nothing read at upload time decides which activity a row belongs to.

type ReadinessByActivity=Record<string,Partial<Record<ReadinessDimensionKey,ReadinessEvidence>>>;
const norm=(value:unknown)=>String(value??'').normalize('NFKC').trim().toLowerCase();

/** The one link reader used by every readiness dimension. */
export function readinessLinkReader(state:ProjectRuntimeState):ReadinessLinkReader{
  const records=deliveryRecords(state).records.filter(r=>r.state!=='superseded');
  const byReference=new Map<string,DeliveryRecord[]>(),packageActivities=new Map<string,string[]>();
  for(const r of records){
    if(!r.reference)continue;
    for(const documentId of new Set(r.receipts.map(receipt=>receipt.documentId))){const key=documentId+'|'+norm(r.reference);const list=byReference.get(key)??[];list.push(r);byReference.set(key,list);}
    if(r.kind==='package')packageActivities.set(norm(r.reference),[...r.links.activityIds]);
  }
  const linker=registerActivityLinker(projectControlSchedule(state)?.revision.model);
  return row=>{
    // A register held as Delivery records: the Delivery record holds the link decision.
    if(row.reference){
      const matches=byReference.get(row.documentId+'|'+norm(row.reference))??[];
      if(matches.length===1){
        const record=matches[0]!;
        if(record.links.activityIds.length)return [...record.links.activityIds];
        return [...new Set(record.links.packageIds.flatMap(id=>packageActivities.get(norm(id))??[]))];
      }
    }
    // Any other register: the stated cell, else CMeng's linker with the same rules.
    const stated=splitLinkCell(row.stated);
    if(stated.length)return stated;
    const proposal=linker({reference:row.reference,description:row.fields['description']??row.fields['subject']??null,fields:row.fields});
    return proposal.state==='proposed'?[...proposal.activityIds]:[];
  };
}

const cache=new WeakMap<ProjectRuntimeState,Map<string,{version:number;delivery:object;controls:object;value:ReadinessByActivity}>>();

/** Current readiness evidence for every activity (the one reader for every page). */
export function currentReadinessEvidence(state:ProjectRuntimeState,dataDateIso?:string|null):ReadinessByActivity{
  // A reporting view already holds the resolved evidence for its own Data Date.
  if(isReportingView(state))return state.controls.readinessEvidence;
  const date=dataDateIso===undefined?projectDataDate(state):dataDateIso;
  const delivery=deliveryRecords(state),key=String(date??'');
  const byDate=cache.get(state)??new Map();cache.set(state,byDate);
  const hit=byDate.get(key);
  if(hit&&hit.version===state.version&&hit.delivery===delivery&&hit.controls===state.controls.readinessEvidence)return hit.value;
  // Nothing to read from documents: the retained evidence is the answer, unchanged.
  const readable=new Set(Object.values(READINESS_DIMENSION_DOCUMENT_TYPES).flat());
  const held=analyticalOperationalDocuments(state.evidenceDocuments).some(d=>readable.has(d.documentType)||(d.tabularRead?.sheets??[]).some(sheet=>readable.has(sheet.semantic?.documentType??'')));
  const value=held?withNoListedChecks(state,reportingReadinessEvidence(state,date,{links:readinessLinkReader(state)})):state.controls.readinessEvidence;
  byDate.set(key,{version:state.version,delivery,controls:state.controls.readinessEvidence,value});
  return value;
}

/** C10: when the project holds the register for a dimension and an activity has
 * no check listed in it, nothing is waiting on that dimension for this activity.
 * That is "no listed check" (not applicable, with its basis), not "unknown".
 * Unknown stays unknown when no such register is held. Whether the register is
 * confirmed complete is stated with the result. */
function withNoListedChecks(state:ProjectRuntimeState,evidence:ReadinessByActivity):ReadinessByActivity{
  const model=projectControlSchedule(state)?.revision.model;
  if(!model)return evidence;
  const held=new Map<string,string[]>();
  for(const d of analyticalOperationalDocuments(state.evidenceDocuments)){
    const types=new Set([d.documentType,...(d.tabularRead?.sheets??[]).map(sheet=>sheet.semantic?.documentType).filter((t):t is string=>!!t)]);
    for(const type of types){const list=held.get(type)??[];list.push(d.documentId);held.set(type,list);}
  }
  const source=deliveryRecords(state),store=deliveryStore(state);
  const complete=(kind:DeliveryKind)=>{
    const scope=source.records.filter(r=>r.kind===kind);
    const decision=[...store.populations].reverse().find(p=>p.kind===kind&&!p.scopeId);
    return deliveryPopulationPosition(kind,null,scope,source.documents,decision as any).state==='established';
  };
  const fills:Array<[ReadinessDimensionKey,ReadinessEvidence]>=[];
  for(const [dimension,types] of Object.entries(READINESS_DIMENSION_DOCUMENT_TYPES) as Array<[ReadinessDimensionKey,readonly string[]]>){
    const present=types.filter(type=>held.has(type));
    if(!present.length)continue;
    const kinds=present.map(type=>deliveryDocumentKinds[type]).filter((k):k is DeliveryKind=>!!k);
    const confirmed=kinds.length>0&&kinds.every(complete);
    const documentIds=[...new Set(present.flatMap(type=>held.get(type)!))];
    fills.push([dimension,Object.freeze({state:'not_applicable',sourceRefs:documentIds.map(id=>'evidence-document:'+id),
      note:'No listed check: the held '+present.map(type=>type.replaceAll('_',' ')).join(' or ')+' lists nothing for this activity'+(confirmed?' (confirmed complete).':'; the register is not confirmed complete.'),
      diagnostics:confirmed?[]:['READINESS_NO_LISTED_CHECK_REGISTER_NOT_CONFIRMED_COMPLETE']}) as ReadinessEvidence]);
  }
  if(!fills.length)return evidence;
  const out:ReadinessByActivity={...evidence};
  for(const activity of model.activities){
    if(activity.activityType==='wbs_summary'||activity.activityType==='level_of_effort')continue;
    const existing=out[activity.activityId];
    let next=existing;
    for(const [dimension,fill] of fills)if(!next?.[dimension]){next={...(next??{}),[dimension]:fill};}
    if(next!==existing)out[activity.activityId]=next!;
  }
  return out;
}
