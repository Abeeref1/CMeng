import {createHash,randomUUID} from 'node:crypto';
import {sourceTables,cell,canonicalHeader,registerDate,type SourceRow,type SourceReceipt} from '../../truth-kernel/src';
import {deliveryKinds,kindIdentities,emptyLinks,type DeliveryRecord,type DeliveryKind,type DeliveryFields,type DeliveryLinks,type DeliveryStateStore} from '../../delivery-core/src/types';
import type {ProjectRuntimeState} from './project-state-types';
import {deliveryAuthorityCatalog} from './delivery-authorities';
import {deliverySourceTables} from './delivery-sources';
import {auditContext} from './audit-context';
import {projectControlSchedule} from './canonical-time-claims';
import {resolveBoqSource} from './boq-source';
export const deliveryHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const split=(value:string)=>value.split(/[;|]/).map(x=>x.trim()).filter(Boolean);
export const deliveryStore=(state:ProjectRuntimeState):DeliveryStateStore=>state.delivery??{schemaVersion:1,manual:[],decisions:[],populations:[]};
const typed:Record<string,DeliveryKind>={procurement_register:'package',submittal_register:'submittal',rfi_register:'design',quality_ncr_register:'quality',asset_register:'asset',testing_commissioning_register:'commissioning',hse_report:'hse'};
function kindFor(row:SourceRow,type:string):DeliveryKind|null {
 // A foreign key (supplier or location ID) does not turn a package into that register.
 const explicit=cell(row,'delivery record type') as DeliveryKind;
 if(deliveryKinds.includes(explicit))return explicit;

 if(typed[type])return typed[type]!;
 const candidates=deliveryKinds.filter(k=>kindIdentities[k].some(id=>Object.hasOwn(row.cells,canonicalHeader(id))));
 if(candidates.length===1)return candidates[0]!;
 const first=Object.keys(row.cells)[0];
 // Ambiguous tables require a mapping decision. Foreign IDs are never promoted by text similarity.
 return candidates.find(k=>kindIdentities[k].some(id=>canonicalHeader(id)===first))??null;
}
export function deliveryRecords(state:ProjectRuntimeState){
 const diagnostics:string[]=[];const tables=deliverySourceTables(state,diagnostics);const store=deliveryStore(state);
 const records:DeliveryRecord[]=[...store.manual.map(r=>({...structuredClone(r),sourceActive:r.receipts.every(receipt=>state.evidenceDocuments.some(d=>d.documentId===receipt.documentId&&d.sourceHashSha256===receipt.sourceHash&&(['active','additive','candidate'].includes(d.basisState)||['supporting_document','delivery_register'].includes(d.documentType)&&d.basisState==='historical'&&!d.supersededByDocumentId)))}))];
 const documents:Array<{documentId:string;filename:string;kind:DeliveryKind|null;rowCount:number;state:string;readingComplete:boolean|null;diagnostics:string[]}>=[];
 for(const t of tables){let count=0,kind:DeliveryKind|null=null;const kindCounts=new Map<DeliveryKind,number>();
  const mapping=store.mappings?.filter(m=>m.documentId===t.document.documentId&&m.sourceHash===t.document.sourceHashSha256).at(-1);
  for(const original of t.rows){const row=mapping?{...original,cells:{...original.cells,...Object.fromEntries(Object.entries(mapping.columns).map(([target,source])=>[canonicalHeader(target),original.cells[canonicalHeader(source)]??'']))}}:original;
   const k=mapping?.kind??kindFor(row,t.document.documentType??'');if(!k)continue;kind=k;count++;kindCounts.set(k,(kindCounts.get(k)??0)+1);
   const reference=cell(row,'record reference',...kindIdentities[k])||null;
   const links=emptyLinks();links.activityIds=split(cell(row,'linked activity'));links.boqItemIds=split(cell(row,'boq item id'));
   if(k!=='package')links.packageIds=split(cell(row,'package id','procurement package id'));
   if(k!=='supplier')links.supplierIds=split(cell(row,'supplier id','subcontractor id'));
   if(k!=='location')links.locationIds=split(cell(row,'location id'));
   if(k!=='asset')links.assetIds=split(cell(row,'asset id','asset tag'));
   const recordId='delivery:'+deliveryHash([state.projectId,k,t.document.documentId,row.receipt.locator]).slice(0,24);
   records.push({recordId,projectId:state.projectId,kind:k,reference,description:cell(row,'description','package name','name','subject','test')||null,
    revision:deliveryHash([row.receipt.sourceHash,row.receipt.locator,row.cells]),state:'extracted_candidate',fields:{...row.cells},links,receipts:[row.receipt],diagnostics:reference?[]:['Record reference is missing.'],sourceActive:['active','additive','candidate'].includes(t.document.basisState)||['supporting_document','delivery_register'].includes(t.document.documentType??'')&&t.document.basisState==='historical'&&!state.evidenceDocuments.find(d=>d.documentId===t.document.documentId)?.supersededByDocumentId});
  }
  const read=state.evidenceDocuments.find(d=>d.documentId===t.document.documentId)?.fullTextRead;
  for(const [documentKind,documentCount] of kindCounts.size?[...kindCounts]:[[null,0] as const])documents.push({documentId:t.document.documentId,filename:t.document.sourceFilename,kind:documentKind,rowCount:documentCount,readingComplete:read?.result.complete??null,state:read&&!read.result.complete?'partial_page_reading':count?'parsed_candidates':/^(boq|installed_measurement_register|risk_register|variation_register|payment_certificates)$/.test(t.document.documentType??'')?'existing_authority':t.rows.length?'mapping_required':'parsed_empty',diagnostics:[...(count?[]:[t.rows.length+' source rows; '+(t.rows.length?'Delivery record identity is not mapped.':'the parsed table is empty.')]),...(read&&!read.result.complete?['Physical-page reading is incomplete. Read records do not establish complete register coverage.']:[])]});
 }
 for(const d of state.evidenceDocuments){if(documents.some(r=>r.documentId===d.documentId))continue;
  if(/procurement|submittal|commissioning|handover|permit|asset|snag|spare|weather|hse|rfi|quality|delivery/.test(d.documentType))documents.push({documentId:d.documentId,filename:d.sourceFilename,kind:typed[d.documentType]??null,rowCount:0,readingComplete:d.fullTextRead?.result.complete??null,state:'submitted_not_interpreted',diagnostics:['Source retained. Structured Delivery records have not been established. Review the reading receipt and field mapping.']});
 }
 const latest=new Map(store.decisions.map(d=>[d.recordId,d]));
 for(const r of records){const d=latest.get(r.recordId);if(d){if(d.sourceRevision!==r.revision||!r.sourceActive)r.state='stale';else{r.state=d.state;r.fields={...r.fields,...d.fields};r.links={...emptyLinks(),...structuredClone(d.links)};r.reference=String(r.fields['record reference']??r.reference??'')||null;r.description=String(r.fields.description??r.description??'')||null;}}}
 for(const r of records)r.links={...emptyLinks(),...r.links};
 const superseded=new Set([...latest.values()].filter(d=>['governed','verified'].includes(d.state)).map(d=>d.supersedesId).filter(Boolean));
 for(const r of records){if(!r.sourceActive)r.state='stale';if(superseded.has(r.recordId)||r.receipts.some(receipt=>state.evidenceDocuments.some(d=>d.documentId===receipt.documentId&&d.supersededByDocumentId)))r.state='superseded';}
 const governed=records.filter(r=>['governed','verified'].includes(r.state)),references=new Map<string,DeliveryRecord[]>();
 for(const r of governed)if(r.reference){const key=r.kind+'|'+r.reference;const group=references.get(key)??[];group.push(r);references.set(key,group);}
 for(const group of references.values())if(group.length>1)for(const r of group){r.state='conflicted';r.diagnostics.push('Multiple governed records share this reference; select the current revision explicitly.');}
 return {records,documents,diagnostics};
}
export function deliveryPopulationFingerprint(records:DeliveryRecord[]){return deliveryHash(records.map(r=>[r.recordId,r.revision,r.state,r.fields,r.links]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));}
export function validateDeliveryLinks(state:ProjectRuntimeState,records:DeliveryRecord[],links:DeliveryLinks){
 const model=projectControlSchedule(state)?.revision.model;const boq=resolveBoqSource(state,model?.sourceRevisionId??'').quantities;
 const has=(ids:string[],available:string[],label:string)=>{const set=new Set(available);if(ids.some(id=>!set.has(id)))throw new Error(label+' link is not an established ID in this project.');};
 has(links.activityIds,model?.activities.map(a=>a.activityId)??[],'Activity');has(links.boqItemIds,boq?.items.map(i=>i.quantityItemId)??[],'BOQ item');
 const eligible=records.filter(r=>['governed','verified'].includes(r.state));
 for(const [field,kind] of [['packageIds','package'],['supplierIds','supplier'],['locationIds','location'],['assetIds','asset']] as const)has(links[field],eligible.filter(r=>r.kind===kind).map(r=>r.recordId),kind);
 has(links.recordIds,eligible.map(r=>r.recordId),'Delivery record');
 for(const [key,kind] of [['riskIds','risk'],['claimIds','claim'],['noticeIds','notice'],['variationIds','variation']] as const)if(links[key].length)has(links[key],deliveryAuthorityCatalog(state,kind).map(r=>r.id),kind);
 const allocated=new Set<string>();for(const allocation of links.boqAllocations){const item=allocation&&boq?.items.find(i=>i.quantityItemId===allocation.boqItemId);if(!item||item.unit!==allocation.unit||!Number.isFinite(allocation.quantity)||allocation.quantity<0||!links.boqItemIds.includes(allocation.boqItemId)||allocated.has(allocation.boqItemId))throw new Error('Scope allocations require one entry per linked BOQ item, its exact unit and a non-negative quantity.');allocated.add(allocation.boqItemId);}
}
function cleanLinks(input:unknown,previous:DeliveryLinks):DeliveryLinks {
 if(input===undefined)return structuredClone(previous);
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid relationship lists.');
 const links=emptyLinks();for(const [key,value] of Object.entries(input)){if(!Object.hasOwn(links,key)||!Array.isArray(value)||key!=='boqAllocations'&&value.some(v=>typeof v!=='string'||!v.trim()))throw new Error('Invalid relationship list.');(links as any)[key]=structuredClone(value);}
 return links;
}
function sourceReceipts(state:ProjectRuntimeState,input:any):SourceReceipt[]{
 if(input===undefined)return [];
 if(!Array.isArray(input))throw new Error('Invalid evidence links.');
 return input.map((source:any)=>{const doc=state.evidenceDocuments.find(d=>d.documentId===source.documentId);if(!doc||doc.sourceHashSha256!==source.sourceHash||!String(source.locator??'').trim())throw new Error('Evidence must identify a document in this project, its current source hash and a page/row locator.');return {documentId:doc.documentId,sourceHash:doc.sourceHashSha256,revision:doc.linkedArtifactId??doc.sourceHashSha256,locator:String(source.locator),basisState:doc.basisState,authority:'source_record'};});
}
function cleanFields(input:unknown):DeliveryFields {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Record fields must be supplied.');
 const result:DeliveryFields={};for(const [key,value] of Object.entries(input)){if(!key.trim()||key.length>120||['__proto__','constructor','prototype'].includes(key))throw new Error('Invalid field name.');if(value!==null&&typeof value!=='string'&&typeof value!=='number')throw new Error('Fields must contain text, numbers or null.');if(typeof value==='number'&&!Number.isFinite(value)||typeof value==='string'&&value.length>20000)throw new Error('Invalid field value.');result[canonicalHeader(key)]=value;}
 return result;
}
export function changeDelivery(state:ProjectRuntimeState,input:any){
 if(input.expectedVersion!==state.version)throw new Error('PROJECT_VERSION_CHANGED: Reload this project before saving; another update was received.');
 const store=structuredClone(deliveryStore(state)),actorId=auditContext().actor.id,recordedAt=new Date().toISOString();
 const source=deliveryRecords(state),all=source.records;
 if(input.action==='create'){
  if(!deliveryKinds.includes(input.kind))throw new Error('Unknown Delivery record type.');
  const fields=cleanFields(input.fields);const reference=String(fields['record reference']??'').trim();if(!reference)throw new Error('Enter a record reference.');
  const receipts=sourceReceipts(state,input.receipts);
  const record:DeliveryRecord={recordId:'delivery:'+randomUUID(),projectId:state.projectId,kind:input.kind,reference,description:String(fields.description??'')||null,revision:deliveryHash([fields,receipts,recordedAt,actorId]),state:'working',fields,links:emptyLinks(),receipts,diagnostics:[],sourceActive:true};store.manual.push(record);
 }else if(input.action==='review'){
  const r=all.find(r=>r.recordId===input.recordId);if(!r||r.revision!==input.sourceRevision)throw new Error('Source revision changed; reload the record.');
  if(!['working','governed','verified','scenario'].includes(input.state))throw new Error('Select a supported review state.');
  const fields={...r.fields,...cleanFields(input.fields??{})};const links=cleanLinks(input.links,r.links);
  if(['governed','verified'].includes(input.state)){
   if(!String(fields['record reference']??r.reference??'').trim())throw new Error('Establish the record reference before governing it.');
   if(!r.sourceActive)throw new Error('The source is no longer current. Review the replacement source.');
   validateDeliveryLinks(state,all,links);
   if(input.state==='verified'&&(!registerDate(String(fields['verification date']??''))||!r.receipts.length))throw new Error('Verification requires a valid verification date and supporting source evidence.');
   if(r.kind==='location'){
    const seen=new Set([r.recordId]);let parent=String(fields['parent location id']??'');
    while(parent){if(seen.has(parent))throw new Error('Location hierarchy cannot contain a cycle.');seen.add(parent);const row=all.find(x=>x.kind==='location'&&x.recordId===parent&&['governed','verified'].includes(x.state));if(!row)throw new Error('Parent location must be a governed location in this project.');parent=String(row.fields['parent location id']??'');}
   }
   if(fields['lifecycle id']&&!all.some(x=>x.kind==='lifecycle'&&x.recordId===fields['lifecycle id']&&['governed','verified'].includes(x.state)))throw new Error('Select a governed lifecycle template in this project.');
  }
  if(!String(input.note??'').trim())throw new Error('Record the reason for this decision.');
  const latest=new Map(store.decisions.map(d=>[d.recordId,d]));
  const supersedesId=input.supersedesId===undefined?latest.get(r.recordId)?.supersedesId??null:input.supersedesId;
  const old=supersedesId?all.find(x=>x.recordId===supersedesId):null;if(supersedesId&&(!old||old.kind!==r.kind||old.recordId===r.recordId))throw new Error('Select a previous record of the same type.');
  const seen=new Set([r.recordId]);let predecessor=old?.recordId;
  while(predecessor){if(seen.has(predecessor))throw new Error('Record supersession cannot contain a cycle.');seen.add(predecessor);predecessor=latest.get(predecessor)?.supersedesId??undefined;}
  store.decisions.push({recordId:r.recordId,sourceRevision:r.revision,state:input.state,note:String(input.note),fields,links,supersedesId:old?.recordId??null,actorId,recordedAt});
 }else if(input.action==='map_document'){
  const doc=state.evidenceDocuments.find(d=>d.documentId===input.documentId);if(!doc||doc.sourceHashSha256!==input.sourceHash||!deliveryKinds.includes(input.kind))throw new Error('Select the current source document and Delivery record type.');
  const columns=cleanFields(input.columns),tables=deliverySourceTables(state,[]).filter(t=>t.document.documentId===doc.documentId);const headers=new Set(tables.flatMap(t=>t.headers));
  if(!Object.keys(columns).length||Object.values(columns).some(v=>typeof v!=='string'||!headers.has(canonicalHeader(v))))throw new Error('Select source columns from the retained table.');
  (store.mappings??=[]).push({documentId:doc.documentId,sourceHash:doc.sourceHashSha256,kind:input.kind,columns:columns as Record<string,string>,actorId,recordedAt});
 }else if(input.action==='confirm_population'){
  if(!deliveryKinds.includes(input.kind)||!String(input.note??'').trim())throw new Error('Select a population and record its completeness basis.');
  const rows=all.filter(r=>r.kind===input.kind&&['governed','verified'].includes(r.state)&&(!input.scopeId||r.links.packageIds.includes(input.scopeId)||r.links.recordIds.includes(input.scopeId)));
  if(!input.scopeId&&source.documents.some(d=>d.kind===input.kind&&d.readingComplete===false))throw new Error('Complete the physical-page reading before confirming this register population.');
  if(input.scopeId&&!all.some(r=>r.recordId===input.scopeId&&['governed','verified'].includes(r.state)))throw new Error('Population scope must be a governed record in this project.');
  if(all.some(r=>r.kind===input.kind&&(!input.scopeId||r.links.packageIds.includes(input.scopeId)||r.links.recordIds.includes(input.scopeId))&&!['governed','verified','superseded','scenario'].includes(r.state)))throw new Error('Review pending or conflicting records before confirming the denominator.');
  store.populations.push({kind:input.kind,scopeId:input.scopeId??null,recordIds:rows.map(r=>r.recordId),fingerprint:deliveryPopulationFingerprint(rows),note:String(input.note),actorId,recordedAt});
 }else throw new Error('Unknown Delivery action.');
 state.delivery=store;return {action:input.action,recordedAt};
}
