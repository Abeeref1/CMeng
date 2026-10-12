/** Resource identity is source evidence; capacity approval remains a separate test. */
export function attachLookaheadResourceLinks(projection:any):void {
 const byActivity=new Map<string,any[]>();
 for(const trade of projection.sourceResourceTrades??[]){
  if(!trade.registerLinkedByExactId&&!trade.registerLinkedByTradeName)continue;
  for(const id of trade.activityIds??[]){const rows=byActivity.get(id)??[];rows.push(trade);byActivity.set(id,rows);}
 }
 const updated=new Map<string,any>();
 for(const list of ['rows','forwardWindowRows','overdueBacklogRows','backlogRows','missedStartRows']){
  if(!Array.isArray(projection[list]))continue;
  projection[list]=projection[list].map((row:any)=>{
   if(updated.has(row.activityId))return updated.get(row.activityId);
   const trades=byActivity.get(row.activityId);if(!trades?.length||!row.readiness)return row;
   const evidence=trades.map(t=>({recordId:t.matchedRegisterResourceId,reference:t.trade,documentType:'Resource register',state:'unknown',dueIso:null,
    note:t.registerMatchBasis+'. Identity is linked; this does not approve crew capacity.',sourceRefs:t.registerSourceRefs??[]}));
   const dimensions=(row.readiness.dimensions??[]).map((d:any)=>d.key!=='resource'?d:{...d,
    sourceRefs:[...new Set([...(d.sourceRefs??[]),...evidence.flatMap(e=>e.sourceRefs)])],
    records:[...(d.records??[]),...evidence],note:'Source resource identity linked by exact ID or unique trade name. Capacity readiness requires approved comparable capacity.'});
   const value={...row,resourceLinkCount:evidence.length,resourceLinkBasis:'exact_id_or_unique_trade',readiness:{...row.readiness,dimensions}};
   updated.set(row.activityId,value);return value;
  });
 }
 const forward=projection.forwardWindowRows??projection.rows??[];
 for(const item of projection.readinessCoverage??[]){
  if(item.key!=='resource')continue;
  const linked=forward.filter((row:any)=>byActivity.has(row.activityId));
  item.linkedActivityCount=linked.length;
  (item as any).identityKnownCount=linked.length;
  (item as any).identityCoveragePercent=forward.length?linked.length/forward.length*100:null;
  item.linkedSourceRecordCount=new Set(linked.flatMap((row:any)=>(row.readiness?.dimensions??[]).find((d:any)=>d.key==='resource')?.sourceRefs??[])).size;
  item.unresolvedLinkedActivityCount=linked.filter((row:any)=>(row.readiness?.dimensions??[]).some((d:any)=>d.key==='resource'&&d.state==='unknown')).length;
 }
 projection.resourceLinkedActivityCount=byActivity.size;
 projection.resourceIdentityCoverage={linkedActivityCount:byActivity.size,denominator:forward.length,basis:'Source register identity linked by unique trade or exact ID; no capacity approval inferred'};
 projection.resourceLinkBasis='Unique trade-name or exact-ID evidence; not capacity approval';
}
