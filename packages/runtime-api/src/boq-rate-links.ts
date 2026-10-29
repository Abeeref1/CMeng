import {governedTables,cell,numberValue,dateValue} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';
import type {LaborProductivityBasis} from '../../delivery-challenge/src/boq-feasibility';

/** M11.2: the one reader of labour-rate tables that name a BOQ item and an
 * activity. The row is a productivity rate and also a stated item-to-activity
 * link, read the same way by feasibility and the shared BOQ link resolver. */
export function boqLaborRateRows(state:ProjectRuntimeState,items:ReadonlyArray<{quantityItemId:string;itemNumber?:string|null}>,cutoff:string|null):LaborProductivityBasis[]{
  const byId=new Set(items.map(i=>i.quantityItemId));
  const itemNumbers=new Map<string,string[]>();for(const item of items)if(item.itemNumber){const ids=itemNumbers.get(item.itemNumber)??[];ids.push(item.quantityItemId);itemNumbers.set(item.itemNumber,ids);}
  const rates:LaborProductivityBasis[]=[];
  for(const table of governedTables(state.evidenceDocuments,[]).filter(t=>t.headers.some(h=>['labor hours per unit','labour hours per unit','man hours per unit','labor h unit'].includes(h))))for(const row of table.rows){
    const raw=cell(row,'Labor Hours Per Unit','Labour Hours Per Unit','Man Hours Per Unit','Labor h/unit'),rate=numberValue(raw);
    if(rate===null||rate<=0)continue;
    const dateRaw=cell(row,'As Of','Data Date','Effective Date'),date=dateValue(dateRaw);
    if(dateRaw&&(!date||!cutoff||date>cutoff))continue;
    const suppliedId=cell(row,'Quantity Item ID','BOQ Item ID','BOQ Item','BOQ Item No','Item Number','Item No'),activityId=cell(row,'Activity ID','Activity Code'),unit=cell(row,'Unit','UOM');
    const ids=byId.has(suppliedId)?[suppliedId]:itemNumbers.get(suppliedId)??[];
    if(ids.length!==1||!activityId||!unit)continue;
    rates.push({quantityItemId:ids[0]!,activityId,unit,laborHoursPerUnit:rate,sourceRefs:['evidence-document:'+row.receipt.documentId+':'+row.receipt.locator]});
  }
  return rates;
}
