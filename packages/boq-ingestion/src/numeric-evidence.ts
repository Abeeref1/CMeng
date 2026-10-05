import {BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED} from '../../boq-parser/src/numeric-evidence';
import type {BoqIngestionResult} from './types';

/** The canonical calculation fields must not carry unconfirmed OCR numbers.
 * Keep observations and original cell evidence separately. This also protects
 * legacy receipts: missing page-reading provenance is not proof of native text.
 * Adopting a document does not confirm each of its numeric readings. */
export function quarantineUnconfirmedBoqNumerics(result:BoqIngestionResult):BoqIngestionResult{
 if(result.sourceFormat!=='pdf'&&!result.canonicalItems.some(item=>item.diagnostics?.includes('BOQ_AMOUNT_ARITHMETIC_MISMATCH')))return result;
 const read=result.pdfRead,matchingRead=Boolean(read&&result.evidenceReceipt.sourceHash===result.sourceHashSha256);
 const nativePages=new Set(matchingRead?read!.pages.filter(page=>page.method==='native').map(page=>page.pageNumber):[]);
 let changed=false,unconfirmed=false;
 const canonicalItems=result.canonicalItems.map(item=>{
  const itemDiagnostics=item.diagnostics??[];
  const pages=(item.sourceRefs??[]).flatMap(ref=>{const match=/(?:^|:)pdf:page:(\d+)(?::|$)/.exec(ref);return match?[Number(match[1])]:[];});
  const confirmedNative=(result.sourceFormat!=='pdf'||pages.length>0&&pages.every(page=>nativePages.has(page)))&&!item.sourceCellEvidence&&!itemDiagnostics.includes('BOQ_OFFLINE_RASTER_CELL_EVIDENCE')&&!itemDiagnostics.includes(BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED)&&!itemDiagnostics.includes('BOQ_AMOUNT_ARITHMETIC_MISMATCH');
  if(confirmedNative)return item;
  unconfirmed=true;
  if(item.sourceNumericReadings&&item.quantity===null&&item.rate===null&&item.amount===null&&itemDiagnostics.includes(BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED))return item;
  changed=true;
  const sourceNumericReadings=item.sourceNumericReadings??{quantity:item.quantity,rate:item.rate,amount:item.amount};
  return {...item,quantity:null,rate:null,amount:null,status:'unresolved' as const,sourceNumericReadings,
   diagnostics:[...new Set([...itemDiagnostics,BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED,
    ...(sourceNumericReadings.quantity!==null?['QUANTITY_ITEM_CANDIDATE_WITHHELD:'+sourceNumericReadings.quantity]:[])])]};
 });
 if(!unconfirmed||!changed&&result.complete===false&&result.state==='partial_candidate')return result;
 return {...result,canonicalItems,state:'partial_candidate',complete:false,coveragePercent:null,
  verifiedRows:canonicalItems.filter(item=>item.status==='verified').length,
  unresolvedRows:canonicalItems.filter(item=>item.status==='unresolved').length,
  diagnostics:[...new Set([...(result.diagnostics??[]),BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED])]};
}
