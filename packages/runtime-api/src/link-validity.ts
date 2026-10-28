import {cell,dateValue,numberValue,governedTables} from '../../truth-kernel/src';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {resolveBoqSource} from './boq-source';
import {commercialCanonical} from './commercial-canonical';
import type {ProjectRuntimeState} from './project-state-types';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import {compatibleLink,linkEntityFingerprint,type LinkCandidate,type LinkEntity,type LinkKind} from './link-candidate-core';

// P0-A R2 (C2): a reviewed relationship is tied to the two records it joins,
// never to the project version. Any project write raises the version (an
// owner, a decision, an unrelated upload), so a version tie made every
// confirmation lapse. A relationship is current while its source record and its
// target record both exist with the content they had when it was reviewed; it
// becomes stale only when one of those two records changes or disappears.

const date=(v:unknown)=>typeof v==='string'?dateValue(v):null;
const ref=(v:any)=>v?.receipt?String(v.receipt.documentId)+':'+String(v.receipt.locator):null;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const NOT_LINKABLE_ACTIVITY=new Set(['wbs_summary','level_of_effort','start_milestone','finish_milestone','milestone']);

/** The BOQ item as a relationship source. Shared by the dataset and every consumer. */
export function boqItemLinkEntity(row:any,projectId:string):LinkEntity{
 return {id:row.quantityItemId,projectId,reference:row.itemNumber??row.quantityItemId,
  description:([row.costCode?'Cost code '+row.costCode:null,row.section,row.description].filter(Boolean).join(' · ')).slice(0,500),
  unit:row.unit,sourceRefs:(row.sourceRefs??[]).map((x:any)=>x.source+':'+x.locator)};
}
/** The programme activity as a relationship target. */
export function activityLinkEntity(a:any,wbsName:string|null|undefined,revisionId:string,projectId:string):LinkEntity{
 return {id:a.activityId,projectId,reference:a.activityId,description:([a.name,wbsName].filter(Boolean).join(' · ')).slice(0,500),sourceRefs:['schedule:'+revisionId+':'+a.activityId]};
}
export function activityIsLinkable(a:any){return !NOT_LINKABLE_ACTIVITY.has(a.activityType);}

const datasetCache=new WeakMap<ProjectRuntimeState,{version:number;data:Map<LinkKind,{sources:LinkEntity[];targets:LinkEntity[]}>}>();
export function linkDataset(state:ProjectRuntimeState,kind:LinkKind){
 let c=datasetCache.get(state);if(!c||c.version!==state.version){c={version:state.version,data:new Map()};datasetCache.set(state,c);}
 const cached=c.data.get(kind);if(cached)return cached;
 const projectId=state.projectId,sources:LinkEntity[]=[],targets:LinkEntity[]=[];
 if(kind==='boq_activity'){
  const model=projectControlSchedule(state)?.revision.model;
  const q=model?resolveBoqSource(state,model.sourceRevisionId).quantities:null;
  for(const row of q?.items??[])sources.push(boqItemLinkEntity(row,projectId));
  const wbs=new Map(model?.wbs.map(x=>[x.wbsId,x.name])??[]);
  for(const a of model?.activities??[])if(activityIsLinkable(a))targets.push(activityLinkEntity(a,wbs.get(a.wbsId??''),model!.sourceRevisionId,projectId));
 }else{
  const ledger=commercialCanonical(state),byRef=new Map(ledger.payments.map(p=>[ref(p),p]));
  for(const p of ledger.payments){
   const id=ref(p);if(!id)continue;
   const money=[p.amounts.netCertifiedAmount,p.amounts.grossCertifiedAmount,p.amounts.employerCertifiedAmount].find(m=>finite(m.value));
   if(p.certificationDate&&money&&!/appli(?:ed|cation)|submitted|draft|pending certification/i.test(p.sourceStatus))targets.push({id,projectId,reference:p.paymentId,description:p.sourceStatus,currency:money.currency,amount:money.value,dateIso:date(p.certificationDate),certified:true,sourceRefs:[id]});
  }
  const seen=new Set<string>();
  for(const table of governedTables(state.evidenceDocuments,[])){
   if(!/pay|receipt|bank|certif|invoice|cash/i.test(table.document.documentType??''))continue;
   for(const row of table.rows){
    const id=ref(row);if(!id||seen.has(id))continue;
    const p=byRef.get(id),paid=numberValue(cell(row,'paid amount','amount paid','payment amount','receipt amount','amount received'))??p?.amounts.paidAmount.value??null;
    const paidDate=date(cell(row,'actual payment date','payment date','paid date','receipt date','date paid'))??date(p?.paymentDate);
    if(paid===null&&!paidDate)continue;
    seen.add(id);sources.push({id,projectId,reference:cell(row,'payment reference','receipt reference','transaction no','certificate no')||p?.paymentReference||p?.paymentId||id,
     description:(cell(row,'description','remarks','payment details')||'Retained payment record').slice(0,500),currency:cell(row,'currency')||p?.amounts.paidAmount.currency||null,amount:paid,dateIso:paidDate,sourceRefs:[id]});
   }
  }
  for(const p of ledger.payments){const id=ref(p);if(!id||seen.has(id)||(!finite(p.amounts.paidAmount.value)&&!p.paymentDate))continue;
   sources.push({id,projectId,reference:p.paymentReference||p.paymentId,description:p.sourceStatus,currency:p.amounts.paidAmount.currency,amount:p.amounts.paidAmount.value,dateIso:date(p.paymentDate),sourceRefs:[id]});}
 }
 const data={sources,targets};c.data.set(kind,data);return data;
}

type Index={sources:Map<string,LinkEntity>;targets:Map<string,LinkEntity>;sourceFp:Map<string,string>;targetFp:Map<string,string>};
const indexCache=new WeakMap<ProjectRuntimeState,{version:number;data:Map<LinkKind,Index>}>();
function linkIndex(state:ProjectRuntimeState,kind:LinkKind):Index{
 let c=indexCache.get(state);if(!c||c.version!==state.version){c={version:state.version,data:new Map()};indexCache.set(state,c);}
 const cached=c.data.get(kind);if(cached)return cached;
 const data=linkDataset(state,kind);
 const index:Index={sources:new Map(data.sources.map(e=>[e.id,e])),targets:new Map(data.targets.map(e=>[e.id,e])),
  sourceFp:new Map(data.sources.map(e=>[e.id,linkEntityFingerprint(kind,e)])),targetFp:new Map(data.targets.map(e=>[e.id,linkEntityFingerprint(kind,e)]))};
 c.data.set(kind,index);return index;
}
/** The fingerprints a relationship is bound to, read from the current records. */
export function linkFingerprints(state:ProjectRuntimeState,kind:LinkKind,sourceId:string,targetId:string){
 const index=linkIndex(state,kind),source=index.sourceFp.get(sourceId),target=index.targetFp.get(targetId);
 return source&&target?{sourceFingerprint:source,targetFingerprint:target}:null;
}

/**
 * True while both joined records exist with the content they were reviewed
 * against. A relationship saved before fingerprints existed is accepted when
 * both records still exist and the rules still find them compatible; it is then
 * bound to their current content, so any later change to either record makes it
 * stale.
 */
export function linkReviewIsCurrent(state:ProjectRuntimeState,review:LinkCandidate):boolean{
 const index=linkIndex(state,review.kind),source=index.sources.get(review.sourceId),target=index.targets.get(review.targetId);
 if(!source||!target)return false;
 if(review.sourceFingerprint&&review.targetFingerprint)
  return index.sourceFp.get(review.sourceId)===review.sourceFingerprint&&index.targetFp.get(review.targetId)===review.targetFingerprint;
 if(compatibleLink(review.kind,source,target,projectDataDate(state)?.slice(0,10)??null))return false;
 review.sourceFingerprint=index.sourceFp.get(review.sourceId)!;review.targetFingerprint=index.targetFp.get(review.targetId)!;
 return true;
}

/**
 * BOQ-to-activity check against the programme model a page is using (which may
 * be a phase model, not the control schedule). Same fingerprints as the dataset.
 */
export function boqActivityReviewChecker(state:ProjectRuntimeState,model:CanonicalScheduleModel,quantityItems:any[]){
 const projectId=state.projectId,wbs=new Map(model.wbs.map(x=>[x.wbsId,x.name]));
 const sourceFp=new Map(quantityItems.map(row=>[row.quantityItemId,linkEntityFingerprint('boq_activity',boqItemLinkEntity(row,projectId))]));
 const targetFp=new Map(model.activities.map(a=>[a.activityId,linkEntityFingerprint('boq_activity',activityLinkEntity(a,wbs.get(a.wbsId??''),model.sourceRevisionId,projectId))]));
 return (review:LinkCandidate)=>{
  const s=sourceFp.get(review.sourceId),t=targetFp.get(review.targetId);
  if(!s||!t)return false;
  if(review.sourceFingerprint&&review.targetFingerprint)return s===review.sourceFingerprint&&t===review.targetFingerprint;
  return true; // saved before fingerprints: both records still exist (BOQ scope links carry no unit or area on the activity)
 };
}

/** A payment relationship check that needs no ledger rebuild when the record predates fingerprints. */
export function paymentReviewIsCurrent(state:ProjectRuntimeState,review:LinkCandidate):boolean{
 if(!review.sourceFingerprint||!review.targetFingerprint)return true; // the payment rules below still validate the pair
 return linkReviewIsCurrent(state,review);
}

/**
 * Keep every current row and every recorded decision; drop proposals whose
 * records changed. The capacity limit counts current rows only, so expired
 * proposals can never block new confirmations.
 */
export function pruneLinkReviews(state:ProjectRuntimeState,rows:LinkCandidate[]):LinkCandidate[]{
 return rows.filter(r=>r.state!=='candidate'||linkReviewIsCurrent(state,r));
}
