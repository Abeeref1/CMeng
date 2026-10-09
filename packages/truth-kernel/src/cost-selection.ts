/** Rows must already share a metric, reporting date, currency and tax basis.
 * A confirmed current source outranks unconfirmed history. Differing sources
 * remain available for reconciliation; two confirmed values still conflict. */
export function selectCostMetricRows<T extends {amount:{state:string;value:number|null}}>(rows:readonly T[]){
  const official=rows.filter(row=>row.amount.state==='official');
  const selected=official.length?official:[...rows];
  const values=new Set(selected.map(row=>row.amount.value));
  return {selected,conflicted:values.size>1,
    historyDiffers:official.length>0&&rows.some(row=>!official.includes(row)&&!values.has(row.amount.value))};
}
