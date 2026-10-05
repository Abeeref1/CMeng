import {boqItemContinuity} from './boq-item-continuity';
import type {BoqIngestionResult} from '../../boq-ingestion/src';
import {admissibleBoqQuantity,type CanonicalQuantityProgressModel} from '../../quantity-progress-core/src';
import type {ProjectRuntimeState} from './project-state-types';
import {documentClassificationForReview} from './document-identification';
import {parseNativeBoqText,nativeBoqReportedTotals} from '../../boq-pdf-parser/src';

const recoveredSources=new WeakMap<BoqIngestionResult,{reading:object;value:BoqIngestionResult}>();
/** Restored uploads can use their retained, hash-matched complete page reading.
 * No source decision or installed quantity changes; this only exposes readable
 * fields that the legacy ruled-table extraction missed. */
function readableRetainedSource(boq:BoqIngestionResult|null,document:ProjectRuntimeState['evidenceDocuments'][number]|undefined){
 const read=document?.fullTextRead;
 if(!boq||boq.canonicalItems.length||boq.sourceFormat!=='pdf'||!read||read.sourceHashSha256!==boq.sourceHashSha256||read.sourceHashSha256!==document.sourceHashSha256)return boq;
 const cached=recoveredSources.get(boq);if(cached?.reading===read)return cached.value;
 const rows=read.result.pages.filter(p=>p.method==='native').flatMap(p=>parseNativeBoqText(p.pageNumber,p.text));
 if(!rows.length)return boq;
 const value:BoqIngestionResult={...boq,state:'partial_candidate',complete:false,candidateRows:rows.length,verifiedRows:0,unresolvedRows:rows.length,coveragePercent:null,canonicalItems:rows.map(r=>({itemId:boq.sourceHashSha256+':native:p'+r.page+':l'+r.row,itemNumber:r.itemNumber,section:r.section,description:r.description,unit:r.unit,quantity:r.quantity,rate:r.rate,amount:r.amount,currency:r.currency,sourceFormat:'pdf',status:r.status,diagnostics:r.diagnostics,
   sourceRefs:['evidence-receipt:'+boq.evidenceReceipt.receiptId,'sha256:'+boq.sourceHashSha256+':pdf:page:'+r.page+':text-line:'+r.row]})),diagnostics:[...boq.diagnostics,'BOQ_RETAINED_NATIVE_TEXT_RECOVERY_PARTIAL']};
 recoveredSources.set(boq,{reading:read,value});return value;
}
export function suppliedBoqReportedTotals(state:ProjectRuntimeState,sourceDocumentId:string|null){
 const doc=state.evidenceDocuments.find(d=>d.documentId===sourceDocumentId),read=doc?.fullTextRead;
 if(!doc||!read||read.sourceHashSha256!==doc.sourceHashSha256)return [];
 return nativeBoqReportedTotals(read.result.pages).map(r=>({...r,sourceRefs:['sha256:'+doc.sourceHashSha256+':pdf:page:'+r.page],basis:'Explicit source summary, not a reconciled sum of the extracted item population or certification of contract value.'}));
}

/** An attempted ingestion is not proof of an empty measured population. */
export function hasReadableBoqPopulation(boq: BoqIngestionResult) {
  return boq.state !== 'unavailable' && (boq.canonicalItems.length > 0 || boq.complete);
}

/** Old snapshots may have cached a suspect quantity before the adapter guard.
 * Keep source rows, allocations and installed measurements intact. */
export function quarantineBoqQuantityModel(model:CanonicalQuantityProgressModel|null,boq:BoqIngestionResult|null) {
  if(!model)return model;
  const sources=new Map((boq?.canonicalItems??[]).map(item=>[item.itemId,item]));
  let changed=false;
  const items=model.items.map(item=>{
    const source=sources.get(item.quantityItemId);
    const diagnostics=[...new Set([...item.diagnostics,...(source?.diagnostics??[])])];
    if(!diagnostics.includes('BOQ_AMOUNT_ARITHMETIC_MISMATCH'))return item;
    const safe=admissibleBoqQuantity(source?.quantity??item.contractQuantity,diagnostics);
    if(item.contractQuantity===null&&safe.diagnostics.length===item.diagnostics.length&&safe.diagnostics.every(code=>item.diagnostics.includes(code)))return item;
    changed=true;return {...item,...safe};
  });
  return changed?{...model,items}:model;
}

/** Display supplied figures independently of schedule links, progress, productivity
 * or approval. A missing field does not suppress the other fields in its row. */
export function suppliedBoqFigures(boq:BoqIngestionResult|null,quantities:CanonicalQuantityProgressModel|null) {
  const rows=boq?boq.canonicalItems.map(item=>({
    itemId:item.itemId,itemNumber:item.itemNumber,section:item.section,description:item.description,
    unit:item.unit,quantity:item.quantity,rate:item.rate,amount:item.amount,currency:item.currency,
    sourceRefs:item.sourceRefs,readingStatus:item.status,readingDiagnostics:item.diagnostics,
  })):(quantities?.items??[]).map(item=>({
    itemId:item.quantityItemId,itemNumber:item.itemNumber,section:item.section,description:item.description,
    unit:item.unit,quantity:item.contractQuantity,rate:null,amount:null,currency:null,
    sourceRefs:item.sourceRefs.map(ref=>ref.source+':'+ref.locator),
  }));
  const populationKnown = boq ? hasReadableBoqPopulation(boq) : quantities !== null;
  return {sourceFilename:boq?.sourceFilename??null,revisionId:boq?.evidenceReceipt.revisionId??quantities?.boqRevisionId??null,
    itemCount:populationKnown?rows.length:null,readableQuantityCount:populationKnown?rows.filter(row=>row.quantity!==null&&Number.isFinite(row.quantity)).length:null,
    basis:'Figures as read from the supplied BOQ. Schedule links and calculation inputs do not block these figures.',rows};
}

/** Source-family validation is shared by all consumers, including restored
 * projects. A rejected legacy classification cannot hide valid source quantities.
 * A sole usable candidate is visible as a candidate; this does not adopt it. */
export function resolveBoqSource(state:ProjectRuntimeState,scheduleRevisionId:string) {
  const hasRasterBoq=(d:ProjectRuntimeState['evidenceDocuments'][number])=>Boolean(d.sourceHashSha256&&d.boqTableRead&&d.boqTableRead.sourceHashSha256===d.sourceHashSha256&&d.boqTableRead.structuredTableFound);
  const artifactId=(d:ProjectRuntimeState['evidenceDocuments'][number])=>hasRasterBoq(d)?d.boqTableRead!.ingestionId:d.linkedArtifactId;
  const adopted=(d:ProjectRuntimeState['evidenceDocuments'][number])=>d.documentType==='boq'&&['active','additive'].includes(d.basisState);
  const documents=state.evidenceDocuments.filter(d=>['active','additive','candidate'].includes(d.basisState)&&(d.documentType==='boq'||hasRasterBoq(d)));
  const rejected=documents.filter(d=>documentClassificationForReview(d).documentType!=='boq');
  const usable=documents.filter(d=>!rejected.includes(d));
  const invalidIds=new Set(rejected.map(artifactId));
  const recordedDocuments=state.evidenceDocuments.filter(d=>artifactId(d)===state.boq?.ingestionId);
  const hasEstablished=usable.some(adopted);
  const validCurrent=state.boq&&!invalidIds.has(state.boq.ingestionId)&&(recordedDocuments.length
    ? recordedDocuments.some(d=>usable.includes(d)&&(!hasEstablished||adopted(d)))
    : documents.length===0);
  const established=usable.filter(adopted);
  const candidates=established.length?established:usable;
  const selectedOriginal=validCurrent?state.boq:candidates.length===1?state.boqRevisions.find(b=>b.ingestionId===artifactId(candidates[0]!))??null:null;
  const source=usable.find(d=>artifactId(d)===selectedOriginal?.ingestionId);
  const selected=readableRetainedSource(selectedOriginal,source);
  const readable = selected ? hasReadableBoqPopulation(selected) : false;
  const selection={state:selected?(!readable?'unreadable':source&&!adopted(source)?'candidate':'source'):'missing',
    sourceDocumentId:source?.documentId??null,sourceFilename:source?.sourceFilename??selected?.sourceFilename??null,
    authority:'source_quantities_not_certified_installations',adoptedSource:source?adopted(source):Boolean(selected),
    excludedMisclassifiedDocuments:rejected.map(d=>({documentId:d.documentId,sourceFilename:d.sourceFilename,recordedType:d.documentType,detectedType:documentClassificationForReview(d).documentType})),
    diagnostics:[...(selected&&!readable?['BOQ_ITEM_POPULATION_UNREADABLE']:[]),...(rejected.length?['LEGACY_NON_BOQ_SOURCES_EXCLUDED']:[]),...(!validCurrent&&candidates.length>1?['BOQ_SOURCE_SELECTION_AMBIGUOUS']:[])],
    explanation:selected&&!readable?'The selected source did not yield a readable BOQ item population. Counts and quantity calculations remain unresolved.':rejected.length?'Content validation excluded sources from another evidence family. Valid BOQ quantities retain their own source authority.':'BOQ source and measured installation evidence remain separate.'};
  return {boq:selected,quantities:selected?(readable?(selected===state.boq&&state.quantities?quarantineBoqQuantityModel(state.quantities,selected):quantityModelFromBoq(selected,scheduleRevisionId,state.quantities)):null):state.boq?null:quarantineBoqQuantityModel(state.quantities,null),selection};
}

export function quantityModelFromBoq(
  result: BoqIngestionResult,
  scheduleRevisionId: string,
  existing:
    CanonicalQuantityProgressModel | null,
): CanonicalQuantityProgressModel {
  const source =
    result.sourceFormat === "pdf"
      ? "boq_pdf" as const
      : result.sourceFormat ===
          "csv"
        ? "boq_csv" as const
        : "boq_xlsx" as const;

  const items = result.canonicalItems.map(
    (item) => ({
      quantityItemId: item.itemId,
      itemNumber: item.itemNumber,
      section: item.section,
      description: item.description,
      unit: item.unit,
      contractQuantity: admissibleBoqQuantity(item.quantity,item.diagnostics).contractQuantity,
      sourceRefs: [{
        source,
        locator:
          item.sourceRefs[0] ??
          "evidence-receipt:" +
            result.evidenceReceipt
              .receiptId,
      }],
      diagnostics: [
        ...admissibleBoqQuantity(item.quantity,item.diagnostics).diagnostics,
        ...(item.status ===
        "unresolved"
          ? [
              "QUANTITY_ITEM_SOURCE_UNRESOLVED",
            ]
          : []),
      ],
    }),
  );

  const continuity=boqItemContinuity((existing?.items??[]).map(i=>({...i,id:i.quantityItemId})),items.map(i=>({...i,id:i.quantityItemId})));

  return {
    projectId: result.projectId,
    boqRevisionId:
      result.evidenceReceipt
        .revisionId,
    scheduleRevisionId,
    items,
    allocations:
      existing?.allocations.filter(a=>continuity.has(a.quantityItemId)).map(a=>({...a,quantityItemId:continuity.get(a.quantityItemId)!})) ?? [],
    installedSnapshots:
      existing?.installedSnapshots.filter(s=>continuity.has(s.quantityItemId)).map(s=>({...s,quantityItemId:continuity.get(s.quantityItemId)!})) ?? [],
    diagnostics: [
      ...result.diagnostics,
      ...(existing&&continuity.size<existing.items.length?['BOQ_ITEM_LINKS_REQUIRE_REVIEW']:[]),
      ...([...continuity].some(([a,b])=>a!==b)?['BOQ_LINKS_CARRIED_BY_UNIQUE_ITEM_IDENTITY']:[]),
    ],
  };
}
