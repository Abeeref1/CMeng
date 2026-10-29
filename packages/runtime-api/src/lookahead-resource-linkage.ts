/** Resource identity is source evidence; capacity approval remains a separate test.
 * M9.1: one identity rule for every readiness page. Look-Ahead finds the links
 * (programme resource to register resource, by exact ID or a unique trade);
 * every page that shows readiness rows applies the same links with
 * withResourceIdentity, so Look-Ahead rows, its counts and Construction
 * Readiness give the same resource evidence for the same activity. */
type Identity=Map<string,any[]>;
const remembered=new Map<string,{version:number;map:Identity}>();
let provider:((state:{projectId:string;version:number})=>void)|null=null;
let providing=false;

/** The look-ahead builder registers how to produce the links for a project. */
export function registerResourceIdentityProvider(fn:(state:{projectId:string;version:number})=>void):void{provider=fn;}

/** Identity evidence per activity, from the look-ahead resource trades. */
export function resourceIdentityByActivity(trades:readonly any[]):Identity{
 const byActivity:Identity=new Map();
 for(const trade of trades??[]){
  if(!trade.registerLinkedByExactId&&!trade.registerLinkedByTradeName)continue;
  const evidence={recordId:trade.matchedRegisterResourceId,reference:trade.trade,documentType:'Resource register',state:'unknown',dueIso:null,
   note:trade.registerMatchBasis+'. Identity is linked; this does not approve crew capacity.'+(trade.registerSourceNote?' '+trade.registerSourceNote+'.':''),sourceRefs:trade.registerSourceRefs??[]};
  for(const id of trade.activityIds??[]){const rows=byActivity.get(id)??[];rows.push(evidence);byActivity.set(id,rows);}
 }
 return byActivity;
}

/** The one edit of a readiness row: resource identity records and note; the state is unchanged. */
export function withResourceIdentity(row:any,evidence:readonly any[]):any{
 if(!evidence?.length||!row?.readiness)return row;
 const dimensions=(row.readiness.dimensions??[]).map((d:any)=>d.key!=='resource'?d:{...d,
  sourceRefs:[...new Set([...(d.sourceRefs??[]),...evidence.flatMap((e:any)=>e.sourceRefs)])],
  records:[...(d.records??[]),...evidence],note:'Source resource identity linked by exact ID or unique trade name. Capacity readiness requires approved comparable capacity.'});
 return {...row,resourceLinkCount:evidence.length,resourceLinkBasis:'exact_id_or_unique_trade',readiness:{...row.readiness,dimensions}};
}

/** The links for a project at its current version (built through Look-Ahead when not yet held). */
export function resourceIdentityFor(state:{projectId:string;version:number}):Identity{
 const hit=remembered.get(state.projectId);
 if(hit&&hit.version===state.version)return hit.map;
 if(provider&&!providing){providing=true;try{provider(state);}finally{providing=false;}}
 const after=remembered.get(state.projectId);
 return after&&after.version===state.version?after.map:new Map();
}

export function attachLookaheadResourceLinks(projection:any,state?:{projectId:string;version:number}):void {
 const byActivity=resourceIdentityByActivity(projection.sourceResourceTrades??[]);
 if(state){remembered.set(state.projectId,{version:state.version,map:byActivity});while(remembered.size>64)remembered.delete(remembered.keys().next().value!);}
 const updated=new Map<string,any>();
 for(const list of ['rows','forwardWindowRows','overdueBacklogRows','backlogRows','missedStartRows']){
  if(!Array.isArray(projection[list]))continue;
  projection[list]=projection[list].map((row:any)=>{
   if(updated.has(row.activityId))return updated.get(row.activityId);
   const evidence=byActivity.get(row.activityId);if(!evidence?.length||!row.readiness)return row;
   const value=withResourceIdentity(row,evidence);
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
