import {cell,dateValue,governedTables,numberValue} from '../../truth-kernel/src';
import type {CanonicalQuantityProgressModel,InstalledQuantitySnapshot} from '../../quantity-progress-core/src';
import type {ProjectRuntimeState} from './project-state-types';

const norm=(value:string)=>value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
/** Measurements never create or replace contract BOQ items. Match an explicit,
 * unique item number and unit; retain every unresolved row in the review. */
export function withInstalledMeasurements(state:ProjectRuntimeState,model:CanonicalQuantityProgressModel|null,dataDateIso:string|null){
  if(!model)return null;
  const documents=state.evidenceDocuments.filter(d=>d.documentType==='installed_measurement_register');
  if(!documents.length)return model;
  const diagnostics:string[]=[],tables=governedTables(documents,diagnostics);
  const items=new Map<string,typeof model.items>();
  for(const item of model.items){
    if(!item.itemNumber||!item.unit)continue;
    const key=norm(item.itemNumber)+'|'+norm(item.unit),list=items.get(key)??[];
    list.push(item);items.set(key,list);
  }
  const snapshots=new Map<string,InstalledQuantitySnapshot>(),conflicts=new Set<string>();
  const unresolved:Array<{documentId:string;locator:string;dateIso:string|null;reason:string}>=[];
  let sourceRowCount=0,matchedRowCount=0,futureRowCount=0;
  for(const table of tables)for(const row of table.rows){
    sourceRowCount++;
    const date=dateValue(cell(row,'measurement date')),quantity=numberValue(cell(row,'cumulative installed qty'));
    const matches=items.get(norm(cell(row,'item no'))+'|'+norm(cell(row,'unit')))??[];
    if(date&&dataDateIso&&date>dataDateIso.slice(0,10))futureRowCount++;
    const reason=!date?'measurement_date_unresolved':quantity===null||quantity<0?'installed_quantity_unresolved':matches.length!==1?'boq_item_or_unit_unresolved':null;
    if(reason){unresolved.push({documentId:row.receipt.documentId,locator:row.receipt.locator,dateIso:date,reason});continue;}
    matchedRowCount++;
    const item=matches[0]!,key=item.quantityItemId+'|'+date;
    const ref={source:'progress_record' as const,locator:'measurement:'+row.receipt.documentId+':'+row.receipt.sourceHash+':'+row.receipt.locator};
    const prior=snapshots.get(key);
    if(prior&&prior.installedQuantity!==quantity){conflicts.add(key);unresolved.push({documentId:row.receipt.documentId,locator:row.receipt.locator,dateIso:date,reason:'conflicting_measurements_same_item_and_date'});}
    else if(prior)prior.sourceRefs.push(ref);
    else snapshots.set(key,{snapshotId:'measurement:'+key,asOfIso:date!,quantityItemId:item.quantityItemId,installedQuantity:quantity!,sourceRefs:[ref]});
  }
  const blockingRows=unresolved.filter(row=>!row.dateIso||!dataDateIso||row.dateIso<=dataDateIso.slice(0,10));
  const measuredItemIds=new Set([...snapshots].filter(([key,s])=>!conflicts.has(key)&&dataDateIso&&s.asOfIso.slice(0,10)<=dataDateIso.slice(0,10)).map(([,s])=>s.quantityItemId));
  const measurementReview={measuredItemCount:measuredItemIds.size,boqItemCount:model.items.length,sourceRowCount,matchedRowCount,futureRowCount,unresolvedRowCount:unresolved.length,
    currentUnresolvedRowCount:blockingRows.length,complete:diagnostics.length===0&&blockingRows.length===0&&tables.length>0,
    unresolvedRows:unresolved,diagnostics,
    basis:'Cumulative measured quantities matched by unique BOQ item number and unit. Future measurements remain outside the reporting date. Displayed actuals are the recorded measured subtotal, not proof that unmeasured items have zero installation. Measurements do not establish contract quantities or programme links.'};
  return {...model,measurementReview,
    installedSnapshots:[...model.installedSnapshots.filter(s=>!s.snapshotId.startsWith('measurement:')),...[...snapshots].filter(([key])=>!conflicts.has(key)).map(([,value])=>value)],
    diagnostics:[...model.diagnostics,...diagnostics,...(blockingRows.length?['INSTALLED_MEASUREMENT_POPULATION_UNRESOLVED']:[])]};
}
