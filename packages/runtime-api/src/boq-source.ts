import type {BoqIngestionResult} from '../../boq-ingestion/src';
import type {CanonicalQuantityProgressModel} from '../../quantity-progress-core/src';
import type {ProjectRuntimeState} from './project-state-types';
import {documentClassificationForReview} from './document-identification';

/** Display supplied figures independently of schedule links, progress, productivity
 * or approval. A missing field does not suppress the other fields in its row. */
export function suppliedBoqFigures(boq:BoqIngestionResult|null,quantities:CanonicalQuantityProgressModel|null) {
  const rows=boq?boq.canonicalItems.map(item=>({
    itemId:item.itemId,itemNumber:item.itemNumber,section:item.section,description:item.description,
    unit:item.unit,quantity:item.quantity,rate:item.rate,amount:item.amount,currency:item.currency,
    sourceRefs:item.sourceRefs,
  })):(quantities?.items??[]).map(item=>({
    itemId:item.quantityItemId,itemNumber:item.itemNumber,section:item.section,description:item.description,
    unit:item.unit,quantity:item.contractQuantity,rate:null,amount:null,currency:null,
    sourceRefs:item.sourceRefs.map(ref=>ref.source+':'+ref.locator),
  }));
  return {sourceFilename:boq?.sourceFilename??null,revisionId:boq?.evidenceReceipt.revisionId??quantities?.boqRevisionId??null,
    itemCount:rows.length,readableQuantityCount:rows.filter(row=>row.quantity!==null&&Number.isFinite(row.quantity)).length,
    basis:'Figures as read from the supplied BOQ. Schedule links and calculation inputs do not block these figures.',rows};
}

/** Source-family validation is shared by all consumers, including restored
 * projects. A rejected legacy classification cannot hide valid source quantities.
 * A sole usable candidate is visible as a candidate; this does not adopt it. */
export function resolveBoqSource(state:ProjectRuntimeState,scheduleRevisionId:string) {
  const documents=state.evidenceDocuments.filter(d=>d.documentType==='boq'&&['active','additive','candidate'].includes(d.basisState));
  const rejected=documents.filter(d=>documentClassificationForReview(d).documentType!=='boq');
  const usable=documents.filter(d=>!rejected.includes(d));
  const invalidIds=new Set(rejected.map(d=>d.linkedArtifactId));
  const recordedDocument=documents.find(d=>d.linkedArtifactId===state.boq?.ingestionId);
  const validCurrent=state.boq&&!invalidIds.has(state.boq.ingestionId)&&(!recordedDocument||usable.includes(recordedDocument));
  const established=usable.filter(d=>['active','additive'].includes(d.basisState));
  const candidates=established.length?established:usable;
  const selected=validCurrent?state.boq:candidates.length===1?state.boqRevisions.find(b=>b.ingestionId===candidates[0]!.linkedArtifactId)??null:null;
  const source=usable.find(d=>d.linkedArtifactId===selected?.ingestionId);
  const selection={state:selected?(source?.basisState==='candidate'?'candidate':'source'):'missing',
    sourceDocumentId:source?.documentId??null,sourceFilename:source?.sourceFilename??selected?.sourceFilename??null,
    authority:'source_quantities_not_certified_installations',adoptedSource:source?['active','additive'].includes(source.basisState):Boolean(selected),
    excludedMisclassifiedDocuments:rejected.map(d=>({documentId:d.documentId,sourceFilename:d.sourceFilename,recordedType:d.documentType,detectedType:documentClassificationForReview(d).documentType})),
    diagnostics:[...(rejected.length?['LEGACY_NON_BOQ_SOURCES_EXCLUDED']:[]),...(!validCurrent&&candidates.length>1?['BOQ_SOURCE_SELECTION_AMBIGUOUS']:[])],
    explanation:rejected.length?'Content validation excluded sources from another evidence family. Valid BOQ quantities retain their own source authority.':'BOQ source and measured installation evidence remain separate.'};
  return {boq:selected,quantities:selected?(selected===state.boq&&state.quantities?state.quantities:quantityModelFromBoq(selected,scheduleRevisionId,state.quantities)):state.boq?null:state.quantities,selection};
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
      contractQuantity:
        item.quantity,
      sourceRefs: [{
        source,
        locator:
          item.sourceRefs[0] ??
          "evidence-receipt:" +
            result.evidenceReceipt
              .receiptId,
      }],
      diagnostics: [
        ...item.diagnostics,
        ...(item.status ===
        "unresolved"
          ? [
              "QUANTITY_ITEM_SOURCE_UNRESOLVED",
            ]
          : []),
      ],
    }),
  );

  const itemIds = new Set(
    items.map(
      (item) =>
        item.quantityItemId,
    ),
  );

  return {
    projectId: result.projectId,
    boqRevisionId:
      result.evidenceReceipt
        .revisionId,
    scheduleRevisionId,
    items,
    allocations:
      existing?.allocations.filter(
        (allocation) =>
          itemIds.has(
            allocation.quantityItemId,
          ),
      ) ?? [],
    installedSnapshots:
      existing?.installedSnapshots.filter(
        (snapshot) =>
          itemIds.has(
            snapshot.quantityItemId,
          ),
      ) ?? [],
    diagnostics: [
      ...result.diagnostics,
    ],
  };
}
