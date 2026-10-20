import {boqItemContinuity} from './boq-item-continuity';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {sourceTables,cell,canonicalHeader,registerDate,sourceCandidateHold,type SourceRow,type SourceReceipt} from '../../truth-kernel/src';
import {deliveryKinds,deliveryLabels,kindIdentities,emptyLinks,type DeliveryRecord,type DeliveryKind,type DeliveryFields,type DeliveryLinks,type DeliveryStateStore} from '../../delivery-core/src/types';
import type {ProjectRuntimeState} from './project-state-types';
import {deliveryAuthorityCatalog} from './delivery-authorities';
import {deliverySourceTables} from './delivery-sources';
import {auditContext} from './audit-context';
import {projectControlSchedule} from './canonical-time-claims';
import {resolveBoqSource} from './boq-source';
import {boqReferenceResolver} from './boq-scope-mapping';
import {deliveryNumericIssues} from './delivery-validation';
import {deliveryFields} from '../../delivery-core/src/fields';
import {assetValueMapping} from './delivery-value-mapping';
export const deliveryHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const split=(value:string)=>value.split(/[;|]/).map(x=>x.trim()).filter(Boolean);
export const deliveryStore=(state:ProjectRuntimeState):DeliveryStateStore=>state.delivery??{schemaVersion:1,manual:[],decisions:[],populations:[]};
const typed:Record<string,DeliveryKind>={procurement_register:'package',interface_register:'interface',submittal_register:'submittal',rfi_register:'design',quality_ncr_register:'quality',permit_register:'permit',asset_register:'asset',testing_commissioning_register:'commissioning',hse_report:'hse'};
// Source-table keys are already canonical. Normalise the finite identity list
// once, rather than repeating the same alias/Unicode work for every source row.
const identityKeys=Object.fromEntries(deliveryKinds.map(k=>[k,kindIdentities[k].map(id=>canonicalHeader(id))])) as Record<DeliveryKind,string[]>;
const signatureKeys=Object.fromEntries(deliveryKinds.map(k=>[k,deliveryFields[k].map(field=>canonicalHeader(field))])) as Record<DeliveryKind,string[]>;
// T11: a record's numeric validity depends only on its kind and its fields
// object. Fields objects are replaced, never edited in place (a new project
// version builds new records), and many pages ask the same record again, so
// each fields object is checked once.
const numericValidity=new WeakMap<object,{kind:DeliveryKind;valid:boolean}>();
const numericFieldsValid=(r:DeliveryRecord)=>{
 const known=numericValidity.get(r.fields);if(known&&known.kind===r.kind)return known.valid;
 const valid=deliveryNumericIssues(r.kind,r.fields).length===0;numericValidity.set(r.fields,{kind:r.kind,valid});return valid;
};
export const deliveryCurrentRecord=(r:DeliveryRecord)=>r.state==='governed'||r.state==='verified'||r.state==='extracted_candidate'&&r.sourceActive&&r.diagnostics.length===0&&numericFieldsValid(r);
export function classifyDeliveryRowKind(row:SourceRow,type:string,governedKind:DeliveryKind|null=null):DeliveryKind|null {
 // Explicit source identity is strongest. A reviewed mapping is an intentional
 // user decision and therefore outranks inferred document classification.
 const explicit=cell(row,'delivery record type') as DeliveryKind;
 if(deliveryKinds.includes(explicit))return explicit;
 if(governedKind&&deliveryKinds.includes(governedKind))return governedKind;

 const candidates=deliveryKinds.filter(k=>identityKeys[k].some(id=>Object.hasOwn(row.cells,id)));
 {
  if(candidates.length===1)return candidates[0]!;
  if(candidates.length>1){
   const ranked=candidates.map(kind=>({
    kind,
    score:signatureKeys[kind].reduce((score,key)=>score+(Object.hasOwn(row.cells,key)&&String(row.cells[key]??'').trim()?1:0),0),
   })).sort((a,b)=>b.score-a.score||a.kind.localeCompare(b.kind));
   if(ranked[0]!.score>0&&ranked[0]!.score>(ranked[1]?.score??-1))return ranked[0]!.kind;
  }
 }
 // Header evidence wins for every physical format, including previously
 // misclassified spreadsheets. A tied signature can still use the file type.
 if(typed[type])return typed[type]!;
 if(candidates.length===1)return candidates[0]!;
 return null;
}
const boqContinuityCache=new WeakMap<ProjectRuntimeState,{version:number;mapping:Map<string,string>}>();
type DeliveryDocumentReceipt={documentId:string;filename:string;kind:DeliveryKind|null;rowCount:number;state:string;readingComplete:boolean|null;diagnostics:string[];columnsNotUsed?:string[]};
const deliveryRecordsCache=new WeakMap<ProjectRuntimeState,{version:number;decisionFingerprint:string;value:{
 records:DeliveryRecord[];documents:DeliveryDocumentReceipt[];diagnostics:string[];
}}>();
export function deliveryRecords(state:ProjectRuntimeState){
 // The persisted version changes after ordinary writes. A decision/import
 // may also be appended inside an in-progress transaction before touch().
 // Include its identity and latest record content so the read cache cannot
 // return the wrong original kind or omit revised evidence when state.version
 // has not yet advanced. This is the same bug exposed by native mixed PDF
 // packets containing submittals, spares and permits.
 const store=deliveryStore(state);
 const decisionFingerprint=deliveryHash([
   store.manual.length,store.decisions.length,store.populations.length,
   store.mappings?.length??0,
   store.manual.at(-1)??null,store.decisions.at(-1)??null,
   store.populations.at(-1)??null,store.mappings?.at(-1)??null,
 ]);
 const prior=deliveryRecordsCache.get(state);
 if(prior?.version===state.version&&prior.decisionFingerprint===decisionFingerprint)return prior.value;
 const diagnostics:string[]=[];const tables=deliverySourceTables(state,diagnostics);
 const decidedIds=new Set(store.decisions.map(d=>d.recordId));
 const records:DeliveryRecord[]=[...store.manual.map(r=>({...structuredClone(r),sourceActive:r.receipts.every(receipt=>state.evidenceDocuments.some(d=>d.documentId===receipt.documentId&&d.sourceHashSha256===receipt.sourceHash&&(['active','additive','candidate'].includes(d.basisState)||['supporting_document','delivery_register','interface_register','permit_register'].includes(d.documentType)&&d.basisState==='historical'&&!d.supersededByDocumentId)))}))];
 const documents:DeliveryDocumentReceipt[]=[];
 for(const t of tables){let count=0,kind:DeliveryKind|null=null;const kindCounts=new Map<DeliveryKind,number>();
  const mapping=store.mappings?.filter(m=>m.documentId===t.document.documentId&&m.sourceHash===t.document.sourceHashSha256).at(-1);
  const mappedColumns=Object.entries(mapping?.columns??{}).map(([target,source])=>[canonicalHeader(target),canonicalHeader(source)] as const),flagMappings=Object.entries(mapping?.valueMappings??{});
  for(const original of t.rows){let row=mapping?{...original,cells:{...original.cells,...Object.fromEntries(mappedColumns.map(([target,source])=>[target,original.cells[source]??'']))}}:original;
   const k=classifyDeliveryRowKind(row,t.document.documentType??'',mapping?.kind??null);if(!k)continue;kind=k;count++;kindCounts.set(k,(kindCounts.get(k)??0)+1);
   let sourceValueReview:DeliveryRecord['sourceValueReview'];
   if(k==='asset'&&flagMappings.length){
    const originalValues:Record<string,string>={},interpreted:Record<string,string>={};
    for(const [field,values] of flagMappings){const raw=String(row.cells[field]??'');originalValues[field]=raw;if(Object.hasOwn(values,raw))interpreted[field]=values[raw]??'';}
    if(Object.keys(interpreted).length)row={...row,cells:{...row.cells,...interpreted}};
    sourceValueReview={reference:mapping!.reference!,recordedAt:mapping!.recordedAt,actorId:mapping!.actorId,originalValues};
   }

   const reference=cell(row,'record reference',...kindIdentities[k])||null;
   const links=emptyLinks();links.activityIds=split(cell(row,'linked activity'));links.boqItemIds=split(cell(row,'boq item id','boq item','boq items','boq item no','boq ref','boq reference','boq item ref','boq item reference'));
   if(k!=='package')links.packageIds=split(cell(row,'package id','procurement package id'));
   if(k!=='supplier')links.supplierIds=split(cell(row,'supplier id','subcontractor id'));
   if(k!=='location')links.locationIds=split(cell(row,'location id'));
   if(k!=='asset')links.assetIds=split(cell(row,'asset id','asset tag'));
   let recordId='delivery:'+deliveryHash([state.projectId,k,t.document.documentId,row.receipt.locator]).slice(0,24);
   const previousKind=typed[t.document.documentType??''];
   const previousId=previousKind&&previousKind!==k?'delivery:'+deliveryHash([state.projectId,previousKind,t.document.documentId,row.receipt.locator]).slice(0,24):null;
   const reclassified=!!previousId&&decidedIds.has(previousId);
   if(reclassified)recordId=previousId!; // Retain the decision history, but require a fresh review of the corrected kind.
   records.push({recordId,projectId:state.projectId,kind:k,reference,description:cell(row,'description','package name','name','subject','test',...(k==='permit'?['permit type']:[]))||null,
    revision:deliveryHash([row.receipt.sourceHash,row.receipt.locator,row.cells,...(reclassified?[k]:[])]),state:'extracted_candidate',fields:{...row.cells},...(sourceValueReview?{sourceFields:{...original.cells},sourceValueReview}:{}),links,receipts:[row.receipt],diagnostics:[...(reference?[]:['Record reference is missing.']),...(reclassified?['Page identity changed the record type. Review the retained decision against the corrected source identity.']:[])],sourceActive:['active','additive','candidate'].includes(t.document.basisState)||['supporting_document','delivery_register','interface_register','permit_register'].includes(state.evidenceDocuments.find(d=>d.documentId===t.document.documentId)?.documentType??'')&&t.document.basisState==='historical'&&!state.evidenceDocuments.find(d=>d.documentId===t.document.documentId)?.supersededByDocumentId});
  }
  const read=state.evidenceDocuments.find(d=>d.documentId===t.document.documentId)?.fullTextRead;
  for(const [documentKind,documentCount] of kindCounts.size?[...kindCounts]:[[null,0] as const])documents.push({documentId:t.document.documentId,filename:t.document.sourceFilename,kind:documentKind,rowCount:documentCount,readingComplete:read?.result.complete??null,state:read&&!read.result.complete?'partial_page_reading':count?'parsed_candidates':/^(boq|installed_measurement_register|risk_register|variation_register|payment_certificates)$/.test(t.document.documentType??'')?'existing_authority':t.rows.length?'mapping_required':'parsed_empty',diagnostics:[...(count?[]:[t.rows.length+' source rows; '+(t.rows.length?'Delivery record identity is not mapped.':'the parsed table is empty.')]),...(read&&!read.result.complete?['Physical-page reading is incomplete. Read records do not establish complete register coverage.']:[]),...(t.recognition?.unknown.length?['Source columns read and kept but not used by any calculation: '+t.recognition.unknown.join(', ')+'.']:[])],columnsNotUsed:[...(t.recognition?.unknown??[])]});
 }
 for(const d of state.evidenceDocuments){if(documents.some(r=>r.documentId===d.documentId))continue;
  if(/procurement|interface|submittal|commissioning|handover|permit|asset|snag|spare|weather|hse|rfi|quality|delivery/.test(d.documentType))documents.push({documentId:d.documentId,filename:d.sourceFilename,kind:typed[d.documentType]??null,rowCount:0,readingComplete:d.fullTextRead?.result.complete??null,state:'submitted_not_interpreted',diagnostics:['Source retained. Structured Delivery records have not been established. Review the reading receipt and field mapping.']});
 }
 let continuity=boqContinuityCache.get(state)?.version===state.version?boqContinuityCache.get(state)!.mapping:null;
 if(!continuity){continuity=new Map<string,string>();const currentBoq=resolveBoqSource(state,'').boq;if(currentBoq){const currentItems=currentBoq.canonicalItems.map(i=>({...i,id:i.itemId}));for(const previous of state.boqRevisions)for(const [oldId,newId]of boqItemContinuity(previous.canonicalItems.map(i=>({...i,id:i.itemId})),currentItems))continuity.set(oldId,newId);}boqContinuityCache.set(state,{version:state.version,mapping:continuity});}
 const latest=new Map(store.decisions.map(d=>[d.recordId,d]));
 for(const r of records){const d=latest.get(r.recordId);if(d){if(d.sourceRevision!==r.revision||!r.sourceActive)r.state='stale';else{r.state=d.state;r.fields={...r.fields,...d.fields};r.links={...emptyLinks(),...structuredClone(d.links)};r.reference=String(r.fields['record reference']??r.reference??'')||null;r.description=String(r.fields.description??r.description??'')||null;}}}
 // T04 one rule: an unreviewed record read from a candidate document becomes
 // current only when the shared candidate rule admits that document (fully
 // parsed, no review needed, the only candidate of its family, no adopted
 // document of that family). Otherwise it stays a candidate awaiting a choice.
 const candidateHold=sourceCandidateHold(state.evidenceDocuments);
 const documentById=new Map(state.evidenceDocuments.map(d=>[d.documentId,d]));
 for(const r of records){
  const decision=latest.get(r.recordId);
  if(r.state==='extracted_candidate'&&!decision){
   const held=[...new Set(r.receipts.map(receipt=>{const d=documentById.get(receipt.documentId);return d?candidateHold(d):null;}).filter(Boolean))];
   if(held.length)r.diagnostics.push('Source document is a candidate held for review ('+held.join(', ')+'). Not used as current until the source is chosen or adopted.');
  }
  if(decision?.receipts){r.evidenceRevision=deliveryHash(decision.receipts);r.receipts=structuredClone(decision.receipts);r.sourceActive=r.sourceActive&&r.receipts.every(receipt=>state.evidenceDocuments.some(d=>d.documentId===receipt.documentId&&d.sourceHashSha256===receipt.sourceHash&&!d.supersededByDocumentId&&(['active','additive','candidate'].includes(d.basisState)||['supporting_document','delivery_register','interface_register','permit_register'].includes(d.documentType)&&d.basisState==='historical')));}
  r.links={...emptyLinks(),...r.links};
  if(r.links.boqItemIds.some(id=>continuity!.has(id)&&continuity!.get(id)!==id))r.diagnostics.push('BOQ links carried to the active revision by unique item number, section, description and unit.');
  r.links.boqItemIds=r.links.boqItemIds.map(id=>continuity!.get(id)??id);r.links.boqAllocations=r.links.boqAllocations.map(a=>({...a,boqItemId:continuity!.get(a.boqItemId)??a.boqItemId}));
  r.diagnostics.push(...deliveryNumericIssues(r.kind,r.fields).map(i=>i.message));
 }
 const superseded=new Set([...latest.values()].filter(d=>['governed','verified'].includes(d.state)).map(d=>d.supersedesId).filter(Boolean));
 for(const r of records){if(!r.sourceActive)r.state='stale';if(superseded.has(r.recordId)||r.receipts.some(receipt=>state.evidenceDocuments.some(d=>d.documentId===receipt.documentId&&d.supersededByDocumentId)))r.state='superseded';}
 const governed=records.filter(deliveryCurrentRecord),references=new Map<string,DeliveryRecord[]>();
 for(const r of governed)if(r.reference){const key=r.kind+'|'+r.reference;const group=references.get(key)??[];group.push(r);references.set(key,group);}
 for(const group of references.values())if(group.length>1)for(const r of group){r.state='conflicted';r.diagnostics.push('Multiple current source records share this reference; select the current revision explicitly.');}
 // Source registers name related records by their exact reference, while the
 // shared delivery views use stable record IDs. Resolve only one current
 // record of the required kind. Raw cells/receipts and reviewed links remain
 // intact; a missing or ambiguous target stays unresolved.
 const currentById=new Map(records.filter(deliveryCurrentRecord).map(r=>[r.recordId,r]));
 // F21: registers cite BOQ items by BOQ item ID or, usually, by BOQ item
 // number. The shared resolver links an exact ID or an item number carried
 // by exactly one current BOQ item; a repeated number stays unlinked with its
 // candidate items listed. Reviewed links are never rewritten.
 const resolveBoq=boqReferenceResolver(resolveBoqSource(state,'').quantities?.items??[]);
 for(const r of records)if(r.state==='extracted_candidate'&&!latest.has(r.recordId)){
  if(r.links.boqItemIds.length){
   const resolved=r.links.boqItemIds.map(resolveBoq);
   r.links.boqItemIds=[...new Set(resolved.map(x=>x.itemId??x.reference))];
   // Kept beside the links (not as a record diagnostic): an unresolved BOQ
   // reference leaves that item unmapped; it does not hold the whole record.
   if(resolved.some(x=>x.state!=='exact_item_id'))r.boqReferences=resolved;
  }
  for(const [link,kind] of [['packageIds','package'],['supplierIds','supplier'],['locationIds','location'],['assetIds','asset']] as const){
   r.links[link]=[...new Set(r.links[link].map(value=>{
    if(currentById.get(value)?.kind===kind)return value;
    const matches=references.get(kind+'|'+value)?.filter(deliveryCurrentRecord)??[];
    return matches.length===1?matches[0]!.recordId:value;
   }))];
  }
 }
 const value={records,documents,diagnostics};deliveryRecordsCache.set(state,{version:state.version,decisionFingerprint,value});
 return value;
}
export function deliveryPopulationFingerprint(records:DeliveryRecord[]){return deliveryHash(records.map(r=>[r.recordId,r.revision,r.state,r.fields,r.links,...(r.evidenceRevision?[r.evidenceRevision]:[])]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));}
/** A3: the population instruction names its own register, so each register page
 * states its own action (one shared sentence for every register read as one action). */
export function deliveryPopulationBasis(kind:DeliveryKind){return 'Confirm that all applicable records in the '+deliveryLabels[kind]+' register have been captured before relying on a percentage.';}
/** Shared source-bound population authority. Callers may provide indexed scope
 * rows; reading them here must not reclassify source facts as reviewed facts. */
export function deliveryPopulationPosition(kind:DeliveryKind,scopeId:string|null,scope:DeliveryRecord[],documents:DeliveryDocumentReceipt[],decision:DeliveryStateStore['populations'][number]|undefined){
 const rows=scope.filter(deliveryCurrentRecord);
 const pending=scope.filter(r=>!deliveryCurrentRecord(r)&&!['superseded','scenario'].includes(r.state));
 const unread=documents.some(d=>d.kind===kind&&(d.readingComplete===false||['submitted_not_interpreted','mapping_required'].includes(d.state)));
 const established=!!decision&&!unread&&decision.fingerprint===deliveryPopulationFingerprint(rows)&&pending.length===0;
 return {kind,scopeId,state:established?'established':'not_established',denominator:established?rows.length:null,knownRecordCount:rows.length,pendingRecordCount:pending.length,
  recordIds:rows.map(r=>r.recordId),basis:decision?.note??deliveryPopulationBasis(kind),confirmedAt:decision?.recordedAt??null};
}
/** W10: the one rule for what still waits for a decision on a Delivery page.
 * A record waits when it needs its own decision (working, conflicted, stale, or
 * a source row that cannot be used as current), or when it is a usable source
 * row whose register population is not yet confirmed. The confirmed population
 * decision (deliveryPopulationPosition, bound to the record fingerprint) ends
 * that wait; the per-record source flag alone does not keep it open. */
export function deliveryAwaitingDecision(records:DeliveryRecord[],populationOf:(kind:DeliveryKind)=>{state:string}|null|undefined){
 return records.filter(r=>['extracted_candidate','working','conflicted','stale'].includes(r.state)&&!(deliveryCurrentRecord(r)&&populationOf(r.kind)?.state==='established'));
}
function deliveryLinkValidator(state:ProjectRuntimeState,records:DeliveryRecord[]){
 const model=projectControlSchedule(state)?.revision.model,boq=resolveBoqSource(state,model?.sourceRevisionId??'').quantities;
 const eligible=records.filter(r=>['governed','verified'].includes(r.state)),items=new Map(boq?.items.map(i=>[i.quantityItemId,i])??[]);
 const available=new Map<string,Set<string>>([
  ['activityIds',new Set(model?.activities.map(a=>a.activityId)??[])],['boqItemIds',new Set(items.keys())],['recordIds',new Set(eligible.map(r=>r.recordId))],
  ...(['package','supplier','location','asset'] as const).map(kind=>[kind+'Ids',new Set(eligible.filter(r=>r.kind===kind).map(r=>r.recordId))] as [string,Set<string>]),
 ]);
 return (links:DeliveryLinks)=>{
  const has=(ids:string[],field:string,label:string)=>{const idsAvailable=available.get(field)!;if(ids.some(id=>!idsAvailable.has(id)))throw new Error(label+' link is not an established ID in this project.');};
  has(links.activityIds,'activityIds','Activity');has(links.boqItemIds,'boqItemIds','BOQ item');has(links.recordIds,'recordIds','Delivery record');
  for(const kind of ['package','supplier','location','asset'] as const)has(links[(kind+'Ids') as 'packageIds'],kind+'Ids',kind);
  for(const kind of ['risk','claim','notice','variation'] as const){const key=(kind+'Ids') as 'riskIds';if(links[key].length){if(!available.has(key))available.set(key,new Set(deliveryAuthorityCatalog(state,kind).map(r=>r.id)));has(links[key],key,kind);}}
  const allocated=new Set<string>(),linkedItems=new Set(links.boqItemIds);for(const allocation of links.boqAllocations){const item=allocation&&items.get(allocation.boqItemId);if(!item||item.unit!==allocation.unit||!Number.isFinite(allocation.quantity)||allocation.quantity<0||!linkedItems.has(allocation.boqItemId)||allocated.has(allocation.boqItemId))throw new Error('Scope allocations require one entry per linked BOQ item, its exact unit and a non-negative quantity.');allocated.add(allocation.boqItemId);}
 };
}
export function validateDeliveryLinks(state:ProjectRuntimeState,records:DeliveryRecord[],links:DeliveryLinks){deliveryLinkValidator(state,records)(links);}
export function deliveryBatchReview(state:ProjectRuntimeState,input:{documentId:string;sourceHash:string;kind:string}){
 if(input.kind!=='asset')throw new Error('Batch source review is available for asset registers.');
 const doc=state.evidenceDocuments.find(d=>d.documentId===input.documentId&&d.sourceHashSha256===input.sourceHash);if(!doc)throw new Error('Source document changed; reload its review.');
 if(doc.storedPath&&createHash('sha256').update(readFileSync(doc.storedPath)).digest('hex')!==doc.sourceHashSha256)throw new Error('Retained source bytes do not match the document hash.');
 const source=deliveryRecords(state),records=source.records.filter(r=>r.kind==='asset'&&r.receipts.some(s=>s.documentId===doc.documentId&&s.sourceHash===doc.sourceHashSha256));
 const decided=new Set(deliveryStore(state).decisions.map(d=>d.recordId)),validateLinks=deliveryLinkValidator(state,source.records);
 const lifecycles=new Set(source.records.filter(r=>r.kind==='lifecycle'&&['governed','verified'].includes(r.state)).map(r=>r.recordId));
 const incomplete=source.documents.some(d=>d.documentId===doc.documentId&&d.readingComplete===false);
 const rows=records.map(r=>{
  let reason=incomplete?'Physical-page reading is incomplete.':decided.has(r.recordId)?'Existing individual or batch decision retained.':r.state!=='extracted_candidate'?'Record state requires individual review: '+r.state:!r.sourceActive?'Source is no longer current.':!r.reference?'Record reference is missing.':r.diagnostics.length?r.diagnostics.join('; '):null;
  if(!reason){try{validateLinks(r.links);if(r.fields['lifecycle id']&&!lifecycles.has(String(r.fields['lifecycle id'])))throw new Error('Lifecycle template is not governed.');}catch(e){reason=e instanceof Error?e.message:'Relationships require individual review.';}}
  return {recordId:r.recordId,reference:r.reference,description:r.description,sourceRevision:r.revision,state:r.state,eligible:!reason,reason:reason??'Source fields and relationships can be retained as reviewed.',fields:r.fields,sourceRefs:r.receipts};
 });
 const eligibleIds=new Set(rows.filter(r=>r.eligible).map(r=>r.recordId));
 const previewFingerprint=deliveryHash(['asset-batch-review-v1',state.projectId,doc.documentId,doc.sourceHashSha256,deliveryPopulationFingerprint(records),rows.map(r=>[r.recordId,r.eligible,r.reason])]);
 return {projectId:state.projectId,projectVersion:state.version,kind:'asset',documentId:doc.documentId,sourceHash:doc.sourceHashSha256,filename:doc.sourceFilename,previewFingerprint,total:rows.length,eligibleCount:eligibleIds.size,retainedCount:rows.length-eligibleIds.size,rows,
  basis:'Review the listed source records together. Original fields and unknown values remain unchanged. Existing decisions and exceptions remain separate; this review does not verify commissioning, accept handover or establish population completeness.',
  eligibleRecords:records.filter(r=>eligibleIds.has(r.recordId))};
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
 return input.map((source:any)=>{const doc=state.evidenceDocuments.find(d=>d.documentId===source.documentId);if(!doc||doc.sourceHashSha256!==source.sourceHash||!String(source.locator??'').trim())throw new Error('Evidence must identify a document in this project, its current source hash and a page/row locator.');if(doc.supersededByDocumentId||!(['active','additive','candidate'].includes(doc.basisState)||['supporting_document','delivery_register'].includes(doc.documentType)&&doc.basisState==='historical'))throw new Error('Supporting evidence is no longer current. Select the replacement source.');return {documentId:doc.documentId,sourceHash:doc.sourceHashSha256,revision:doc.linkedArtifactId??doc.sourceHashSha256,locator:String(source.locator),basisState:doc.basisState,authority:'source_record'};});
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
  const receipts=[...r.receipts];for(const receipt of sourceReceipts(state,input.receipts))if(!receipts.some(s=>s.documentId===receipt.documentId&&s.sourceHash===receipt.sourceHash&&s.locator===receipt.locator))receipts.push(receipt);
  if(['governed','verified'].includes(input.state)){
   if(!String(fields['record reference']??r.reference??'').trim())throw new Error('Establish the record reference before governing it.');
   if(!r.sourceActive)throw new Error('The source is no longer current. Review the replacement source.');
   validateDeliveryLinks(state,all,links);
   const issues=deliveryNumericIssues(r.kind,fields);if(issues.length)throw new Error(issues.map(i=>i.message).join(' ')+' Retain the source as Working until the input is reconciled.');
   if(input.state==='verified'&&(!registerDate(String(fields['verification date']??''))||!receipts.length))throw new Error('Verification requires a valid verification date and supporting source evidence.');
   if(r.kind==='location'){
    const seen=new Set([r.recordId]);let parent=String(fields['parent location id']??'');
    while(parent){if(seen.has(parent))throw new Error('Location hierarchy cannot contain a cycle.');seen.add(parent);const row=all.find(x=>x.kind==='location'&&x.recordId===parent&&['governed','verified'].includes(x.state));if(!row)throw new Error('Parent location must be a governed location in this project.');parent=String(row.fields['parent location id']??'');}
   }
   if(r.kind!=='lifecycle'&&fields['lifecycle id']&&!all.some(x=>x.kind==='lifecycle'&&x.recordId===fields['lifecycle id']&&['governed','verified'].includes(x.state)))throw new Error('Select a governed lifecycle template in this project.');
  }
  if(!String(input.note??'').trim())throw new Error('Record the reason for this decision.');
  let continuity=boqContinuityCache.get(state)?.version===state.version?boqContinuityCache.get(state)!.mapping:null;
 if(!continuity){continuity=new Map<string,string>();const currentBoq=resolveBoqSource(state,'').boq;if(currentBoq){const currentItems=currentBoq.canonicalItems.map(i=>({...i,id:i.itemId}));for(const previous of state.boqRevisions)for(const [oldId,newId]of boqItemContinuity(previous.canonicalItems.map(i=>({...i,id:i.itemId})),currentItems))continuity.set(oldId,newId);}boqContinuityCache.set(state,{version:state.version,mapping:continuity});}
 const latest=new Map(store.decisions.map(d=>[d.recordId,d]));
  const supersedesId=input.supersedesId===undefined?latest.get(r.recordId)?.supersedesId??null:input.supersedesId;
  const old=supersedesId?all.find(x=>x.recordId===supersedesId):null;if(supersedesId&&(!old||old.kind!==r.kind||old.recordId===r.recordId))throw new Error('Select a previous record of the same type.');
  const seen=new Set([r.recordId]);let predecessor=old?.recordId;
  while(predecessor){if(seen.has(predecessor))throw new Error('Record supersession cannot contain a cycle.');seen.add(predecessor);predecessor=latest.get(predecessor)?.supersedesId??undefined;}
  store.decisions.push({recordId:r.recordId,sourceRevision:r.revision,state:input.state,note:String(input.note),fields,links,...(receipts.length?{receipts}:{}),supersedesId:old?.recordId??null,actorId,recordedAt});
 }else if(input.action==='review_source_batch'){
  if(!String(input.note??'').trim())throw new Error('Enter the source batch review reference.');
  if(input.state!==undefined&&input.state!=='governed'||input.fields!==undefined||input.links!==undefined||input.recordIds!==undefined)throw new Error('Batch review retains the previewed source fields and relationships; it cannot verify or edit records.');
  const preview=deliveryBatchReview(state,input);
  if(input.previewFingerprint!==preview.previewFingerprint)throw new Error('The source review population changed; reload its preview.');
  if(!preview.eligibleCount)throw new Error('No source records are eligible for this batch review.');
  const batchId='delivery-batch:'+randomUUID(),ids=new Set(preview.eligibleRecords.map(r=>r.recordId));
  // Preserve an existing explicit completeness decision only when its exact
  // population was valid before this source-only state transition.
  const latestPopulations=new Map(store.populations.map(p=>[p.kind+'|'+(p.scopeId??''),p]));
  const preserved=[...latestPopulations.values()].filter(p=>p.kind==='asset').map(p=>({p,rows:all.filter(r=>r.kind===p.kind&&deliveryCurrentRecord(r)&&(!p.scopeId||r.links.packageIds.includes(p.scopeId)||r.links.recordIds.includes(p.scopeId)))})).filter(({p,rows})=>p.fingerprint===deliveryPopulationFingerprint(rows));
  for(const r of preview.eligibleRecords)store.decisions.push({recordId:r.recordId,sourceRevision:r.revision,state:'governed',note:String(input.note).trim(),fields:{},links:structuredClone(r.links),supersedesId:null,actorId,recordedAt,batchId});
  for(const {p,rows} of preserved){const fingerprint=deliveryPopulationFingerprint(rows.map(r=>ids.has(r.recordId)?{...r,state:'governed' as const}:r));if(fingerprint!==p.fingerprint)store.populations.push({...p,fingerprint,sourceReviewBatchId:batchId});}
  state.delivery=store;return {action:input.action,recordedAt,batchId,reviewedRecordCount:preview.eligibleCount,retainedRecordCount:preview.retainedCount};
 }else if(input.action==='map_document'){
  const doc=state.evidenceDocuments.find(d=>d.documentId===input.documentId);if(!doc||doc.sourceHashSha256!==input.sourceHash||!deliveryKinds.includes(input.kind))throw new Error('Select the current source document and Delivery record type.');
  if(doc.storedPath&&createHash('sha256').update(readFileSync(doc.storedPath)).digest('hex')!==doc.sourceHashSha256)throw new Error('Retained source bytes do not match the document hash.');
  const columns=cleanFields(input.columns),tables=deliverySourceTables(state,[]).filter(t=>t.document.documentId===doc.documentId);const headers=new Set(tables.flatMap(t=>t.headers));
  if(!Object.keys(columns).length||Object.values(columns).some(v=>typeof v!=='string'||!headers.has(canonicalHeader(v))))throw new Error('Select source columns from the retained table.');
  const values=assetValueMapping(input.valueMappings,columns as Record<string,string>,tables.flatMap(t=>t.rows),input.kind,input.reference);
  const previous=store.mappings?.filter(m=>m.documentId===doc.documentId&&m.sourceHash===doc.sourceHashSha256).at(-1);
  if(Object.keys(previous?.valueMappings??{}).length&&!String(input.reference??'').trim())throw new Error('Enter the source interpretation reference when changing or clearing a saved value mapping.');
  (store.mappings??=[]).push({documentId:doc.documentId,sourceHash:doc.sourceHashSha256,kind:input.kind,columns:columns as Record<string,string>,...values,...(input.reference?{reference:String(input.reference).trim()}:{}),actorId,recordedAt});
 }else if(input.action==='confirm_population'){
  if(!deliveryKinds.includes(input.kind)||!String(input.note??'').trim())throw new Error('Select a population and record its completeness basis.');
  const rows=all.filter(r=>r.kind===input.kind&&deliveryCurrentRecord(r)&&(!input.scopeId||r.links.packageIds.includes(input.scopeId)||r.links.recordIds.includes(input.scopeId)));
  if(!input.scopeId&&source.documents.some(d=>d.kind===input.kind&&d.readingComplete===false))throw new Error('Complete the physical-page reading before confirming this register population.');
  if(input.scopeId&&!all.some(r=>r.recordId===input.scopeId&&['governed','verified'].includes(r.state)))throw new Error('Population scope must be a governed record in this project.');
  const unresolved=all.filter(r=>r.kind===input.kind&&(!input.scopeId||r.links.packageIds.includes(input.scopeId)||r.links.recordIds.includes(input.scopeId))&&!deliveryCurrentRecord(r)&&!['superseded','scenario'].includes(r.state));
  if(unresolved.length)throw new Error('Resolve these records before confirming completeness: '+unresolved.map(r=>(r.reference??r.recordId)+': '+(r.diagnostics.join('; ')||r.state)).join(' | '));
  store.populations.push({kind:input.kind,scopeId:input.scopeId??null,recordIds:rows.map(r=>r.recordId),fingerprint:deliveryPopulationFingerprint(rows),note:String(input.note),actorId,recordedAt});
 }else throw new Error('Unknown Delivery action.');
 state.delivery=store;return {action:input.action,recordedAt};
}
