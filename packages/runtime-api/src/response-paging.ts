import {responseSourceLabels} from './response-labels';
import {milestonePopulation} from './milestone-population';
/** Project screen responses have a strict uncompressed size budget. Original
 * source data stays in the versioned project/module producers and in exports.
 * Only the browser projection is paged; details can be requested by JSON pointer.
 */
export const PROJECT_SCREEN_MAX_BYTES=1_850_000;
export const PROJECT_TABLE_PAGE_SIZE=25;
export interface PageTable {
  pointer:string;total:number;shown:number;kind:'array'|'object'|'text';
}
export interface ResponsePaging {
  source:string;pageSize:25;projectVersion:number|null;
  tables:PageTable[];additionalTables:number;responseBytes:number;
  sourcePreserved:true;
  /** F61: set (additive) only when even the smallest paged projection is
   * still larger than the screen budget, so an oversize page is never silent. */
  overBudget?:true;budgetBytes?:number;
}
const token=(v:string)=>v.replace(/~/g,'~0').replace(/\//g,'~1');
const allowedScreen=/^\/api\/projects\/[^/]+\/(?:overview|director-position|management-surfaces|management\/[^/]+|advanced\/[^/]+|(?:schedule|commercial|delivery)\/modules\/[^/]+|evidence\/documents|boq\/(?:page-review|numeric-review)|actions)$/;
export function isProjectScreenRequest(method:string|undefined,path:string):boolean {
  return method==='GET'&&allowedScreen.test(path);
}
export function jsonPointer(root:unknown,pointer:string):unknown {
  if(!pointer||pointer==='/')return root;
  if(pointer.length>3000||!pointer.startsWith('/'))return undefined;
  let value:any=root;
  for(const segment of pointer.slice(1).split('/')){
    const part=segment.replace(/~1/g,'/').replace(/~0/g,'~');
    if(part==='__proto__'||part==='constructor'||part==='prototype')return undefined;
    if(!value||typeof value!=='object'||!Object.prototype.hasOwnProperty.call(value,part))return undefined;
    value=value[part];
  }
  return value;
}
const bytes=(value:unknown)=>Buffer.byteLength(JSON.stringify(value),'utf8');
const TABLE_NAME=/(?:rows|records|register|entries|activities|actions|findings|documents|claims|notices|rfis|ncrs|issues|payments|variations|evidence|sources|lineItems|assets|quantities|bonds|insurances|links|details)$/i;
const PRIORITY_FIELDS=new Set(['key','status','reason','projectId','projectVersion','projectFacts','data','metrics','counts','summary','position','time','controls','schedule','commercial','actions','claims','reportingContract','dataDateIso','issueAssessment','completionPosition','forecastTaxonomy','focus','pagination','filterOptions','filterDomains','activitySummary','boqProgrammeLinks','briefCommercialPosition','completionConstraints','completionMilestoneConstraints','paymentLinkage','heldEvidence','deliveryFeasibility','controlMetrics']);
type PageBudget={rows:number;keys:number;text:number;depth:number};
const FACT_BUDGET:PageBudget={rows:10,keys:85,text:800,depth:9};
const PAGE_BUDGETS:PageBudget[]=[
  {rows:25,keys:150,text:4096,depth:12},
  {rows:25,keys:100,text:2048,depth:10},
  {rows:12,keys:90,text:1600,depth:10},
  {rows:4,keys:72,text:1200,depth:9},
  {rows:1,keys:55,text:700,depth:8},
];

function chosenKeys(value:Record<string,unknown>,max:number):string[]{
 const keys=Object.keys(value);
 if(keys.length<=max)return keys;
 return [...keys.filter(key=>PRIORITY_FIELDS.has(key)),...keys.filter(key=>!PRIORITY_FIELDS.has(key))].slice(0,max);
}
/** True for the reporting contract object and every object nested inside it
 * (for example /data/reportingContract/metricContracts), wherever the screen
 * or management bundle nests it. */
const reportingContractObject=(pointer:string)=>/\/reportingContract(?:\/|$)/.test(pointer);
/** A canonical fact snapshot is projected by the SAME fixed rule on every
 * screen, independent of how large the surrounding specialist module is.
 * Original registers, receipts and full source facts remain in producers and
 * downloadable reports, and are retrievable on demand. */
/** Project facts are shared canonical authority, not a visible table.
 * Never silently remove contract sections, evidence qualifications or other
 * fact groups. Screen tables alone are eligible for paging. */
const factProjectionCache=new WeakMap<object,{projection:unknown;pages:PageTable[]}>();
function compactFactSnapshot(value:unknown,record:(entry:PageTable)=>void,rootPointer:string):unknown {
 const cached=value&&typeof value==='object'?factProjectionCache.get(value):undefined;
 if(cached){cached.pages.forEach(page=>record({...page,pointer:rootPointer+page.pointer}));return cached.projection;}
 const relativePages:PageTable[]=[];
 const retainPage=(page:PageTable)=>{relativePages.push(page);record({...page,pointer:rootPointer+page.pointer});};
 // Fact values, states, units, qualifications and contract sections are not
 // table previews. Only long provenance/identity collections can be deferred.
 // A fixed rule keeps the same canonical facts on every page at every budget.
 const evidenceList=/(?:positiveLags|negativeLags|sourceRefs|sourceReferences|memberIds|memberActionIds|activityIds|relationshipIds|recordIds|documentIds|receiptIds|checkIds|affectedActivityIds|missingBaselineActivityIds|missingActualFinishActivityIds|unknownLagRelationshipIds|finishActivityIds)$/i;
 const seen=new Set<object>();
 const walk=(input:any,pointer:string,key:string):any=>{
  if(input===null||typeof input!=='object')return input;
  if(seen.has(input))return input;
  seen.add(input);
  if(Array.isArray(input)){
   const shown=evidenceList.test(key)?Math.min(input.length,PROJECT_TABLE_PAGE_SIZE):input.length;
   if(shown<input.length)retainPage({pointer,total:input.length,shown,kind:'array'});
   const result=input.slice(0,shown).map((item:any,index:number)=>walk(item,pointer+'/'+index,''));
   seen.delete(input);return result;
  }
  const output:Record<string,unknown>={};
  for(const [field,item] of Object.entries(input))output[field]=walk(item,pointer+'/'+token(field),field);
  seen.delete(input);return output;
 };
 const projection=walk(value,'','projectFacts');
 if(value&&typeof value==='object')factProjectionCache.set(value,{projection,pages:relativePages});
 return projection;
}

function projectFactsOf(body:unknown):unknown {
 const item=body as any;
 // The management transport bundle nests the exact same shared facts under
 // each constituent page. Never null them simply because the route has no
 // top-level data wrapper (N-20 / inconsistent management bundle).
 return item?.data?.projectFacts??item?.projectFacts??
   item?.masterDashboard?.projectFacts??
   item?.commandCenter?.projectFacts??
   item?.masterControlProgramme?.projectFacts??
   item?.sourceQuality?.projectFacts??null;
}

const priorityMilestoneOrder=(a:any,b:any)=>{
  const rank=(r:any)=>r?.managementPriority==='critical'?0:r?.managementPriority==='high'?1:r?.managementPriority==='watch'?2:3;
  return Number(a?.status==='completed')-Number(b?.status==='completed')||
    Number(Boolean(b?.terminalMilestone))-Number(Boolean(a?.terminalMilestone))||
    rank(a)-rank(b)||Number(Boolean(b?.negativeFloat))-Number(Boolean(a?.negativeFloat))||
    Number(a?.daysFromDataDate??Number.MAX_SAFE_INTEGER)-Number(b?.daysFromDataDate??Number.MAX_SAFE_INTEGER);
};

/** No stringify of the 65-MB original data, no six full-payload
 * serialization passes, and no page-specific truncation of canonical facts.
 * Counts are always taken BEFORE paging from each exact source population. */
export function pageProjectResponse(
 body:unknown,source:string,maxBytes=PROJECT_SCREEN_MAX_BYTES,
 // Applied to each paged projection BEFORE its size is measured, so
 // responseBytes and the screen budget describe the bytes actually sent.
 prepare?:(projection:any)=>any,
):unknown {
 if(!body||typeof body!=='object')return body;
 const facts=projectFactsOf(body);
 const sharedFactPages:PageTable[]=[];
 const item=body as any;
 const sourceLabelCatalogue=item?.data?.sourceLabels??item?.sourceLabels??item?.masterDashboard?.sourceLabels??{};
 const factPointer=item?.data?.projectFacts?'/data/projectFacts':
   item?.projectFacts?'/projectFacts':item?.masterDashboard?.projectFacts?'/masterDashboard/projectFacts':
   item?.commandCenter?.projectFacts?'/commandCenter/projectFacts':
   item?.masterControlProgramme?.projectFacts?'/masterControlProgramme/projectFacts':
   '/sourceQuality/projectFacts';
 const normalizedFacts=facts?compactFactSnapshot(facts,entry=>sharedFactPages.push(entry),factPointer):null;
 // Chart series, time histories and milestone decision populations are not
 // display-register pages. Their full data must reach the visualisation.
 const screenKey=String(item?.legacyKey??item?.key??item?.data?.projectionKey??(source.split('?')[0]??'').split('/').pop()??'').toLowerCase();
 const milestoneRows=(pointer:string)=>pointer==='/data/rows'&&screenKey==='milestones';
 // Quantity series are independent BOQ items, not traces of one shared chart.
 // Page the item population while retaining each selected item's time history.
 const quantityItemSeries=(pointer:string)=>pointer.endsWith('/series')&&
   (jsonPointer(body,pointer.slice(0,-'/series'.length)) as any)?.projectionKey==='quantity_scurve';
 const neverPageArray=(key:string,pointer:string,value:unknown[])=>(
   // These eight links are columns of one event's evidence chain, not separate records.
   (/\/delayEotEvidenceChain\/rows\/\d+\/links$/.test(pointer)&&value.length<=8)
   ||(/^(?:points|weeklyTotals|actualSnapshots|readinessCoverage|blockerTypes|sourceResourceTrades|resourceSummaries|monthlyPoints|monthlySeries|chartPoints|curvePoints|series|metrics|kpis|ownerGroups|ownerRegisterGroups|milestoneFullCounts|largestFloatMovements|movementClusters|monthlyEvmPoints|evmPoints|periods|currencies)$/i.test(key)&&!quantityItemSeries(pointer))
   ||(pointer==='/rows'&&Number.isInteger(item.page)&&Number.isInteger(item.pageSize)&&Number.isInteger(item.matchingCount)&&value.length<=item.pageSize)
   // A source record-page has already been bounded, sorted and filtered.
   // Do not turn the requested 50 original rows into a 25-row preview.
   // The same applies to an object page (field/value rows): a requested 50-row
   // page cut to 25 here skipped 25 fields because hasMore/offset assume 50.
   ||(pointer==='/rows'&&(item.kind==='array'||item.kind==='object')&&Number.isInteger(item.offset)&&Number.isInteger(item.total)&&Number.isInteger(item.pageSize)&&value.length<=item.pageSize)
   ||(['openMilestones','completedMilestones'].includes(key)&&value.length<=160)
   ||(milestoneRows(pointer)&&value.length<=160)
   ||(screenKey==='activity-analytics'&&pointer==='/data/rows'&&!!item?.data?.activitySummary&&value.length<=50)
 );
 const fullMilestoneRows=screenKey==='milestones'&&Array.isArray(item?.data?.rows)?item.data.rows as any[]:null;
 const milestoneFullCounts=fullMilestoneRows?{...milestonePopulation(fullMilestoneRows),identificationComplete:item?.data?.populationState!=='partial'}:null;
 const projectVersion=Number.isInteger((body as any).projectVersion)
   ?Number((body as any).projectVersion)
   :Number.isInteger((facts as any)?.projectVersion)?Number((facts as any).projectVersion):null;
 let smallestProjection:unknown=body;
 for(const budget of PAGE_BUDGETS){
  // Reserve paging metadata for the actual screen registers. A large canonical
  // fact snapshot can have hundreds of nested arrays; allowing it to consume
  // every slot leaves visible BOQ, evidence and action lists stuck at 25 rows.
  // This is only a response metadata budget; it does not modify source data.
  const factSlots=sharedFactPages.length;
  const tables:PageTable[]=[...sharedFactPages.slice(0,factSlots)];
  let additionalTables=Math.max(0,sharedFactPages.length-factSlots),changed=sharedFactPages.length>0;
  const seen=new Set<object>();
  const record=(entry:PageTable)=>{
   if(entry.shown<entry.total)changed=true;
   tables.push(entry);
  };
  const visit=(value:any,pointer:string,key:string,depth:number):any=>{
   if(value===null||value===undefined||typeof value==='number'||typeof value==='boolean')return value;
   if(typeof value==='string'){
     if(value.length>budget.text&&depth>1){
       record({pointer,total:value.length,shown:budget.text,kind:'text'});
       return value.slice(0,budget.text)+'…';
     }
     return value;
   }
   if(typeof value!=='object')return String(value);
   if(key==='projectFacts')return normalizedFacts;
   if(key==='filterOptions'||key==='filterDomains'||key==='activitySummary'||key==='completionMilestoneConstraints'||key==='briefCommercialPosition')return value;
   // These values populate editable controls. Paging an ID list or clipping a
   // saved mapping/reference can turn a later save into an unintended partial
   // replacement. Keep the complete decision input; findings remain pageable.
   if(key==='target'&&/\/(?:actions|information|dataGaps)\/\d+\/target$/.test(pointer)&&value.type==='inline'&&typeof value.kind==='string'&&value.kind.startsWith('review-'))return value;
   if(key==='sourceLabels'){changed=true;return {};}
   if(seen.has(value))return {detailAvailable:true};
   if(depth>budget.depth){
     // SW-03 / N10: below the nesting budget a register keeps its first page
     // (each row's own scalar fields) with its true total and pointer, so the
     // remaining pages are fetched by recordDetailPage. It was replaced by an
     // empty [] / {detailAvailable:true} stub, and the screen showed no rows.
     const clip=(v:unknown)=>typeof v==='string'&&v.length>budget.text?v.slice(0,budget.text)+'…':v;
     const scalars=(row:any)=>{
       if(row===null||typeof row!=='object')return clip(row);
       if(Array.isArray(row))return row.filter(v=>v===null||typeof v!=='object').slice(0,budget.rows).map(clip);
       const out:Record<string,unknown>={};
       for(const field of chosenKeys(row,budget.keys)){const v=row[field];if(v===null||typeof v!=='object')out[field]=clip(v);}
       return out;
     };
     if(Array.isArray(value)){
       const shown=Math.min(budget.rows,value.length);
       record({pointer,total:value.length,shown,kind:'array'});
       return value.slice(0,shown).map(scalars);
     }
     const result=scalars(value) as Record<string,unknown>,total=Object.keys(value).length,shown=Object.keys(result).length;
     if(shown<total)record({pointer,total,shown,kind:'object'});
     return result;
   }
   seen.add(value);
   if(Array.isArray(value)){
     const table=quantityItemSeries(pointer)||!neverPageArray(key,pointer,value)&&(TABLE_NAME.test(key)||value.length>100);
     // Select priority milestone representatives from ALL source rows, without
     // altering the stored source order or declaring the preview complete.
     const candidate=table&&milestoneRows(pointer)?[...value].sort(priorityMilestoneOrder):value;
     const shown=table?Math.min(milestoneRows(pointer)?Math.max(12,budget.rows):budget.rows,value.length):value.length;
     if(table||shown<value.length)record({pointer,total:value.length,shown,kind:'array'});
     const rows=candidate.slice(0,shown).map((item:any,i:number)=>visit(item,pointer+'/'+i,'',depth+1));
     seen.delete(value);return rows;
   }
   // The reporting contract is shared metadata (populations and one semantic
   // contract per reported metric), not a display table. Like projectFacts it
   // is never key-capped: a cut map silently drops the contract of a metric the
   // screen still shows. Its long identity lists remain paged arrays with their
   // true totals, and its bytes still count towards the screen size budget.
   const names=Object.keys(value),ordered=reportingContractObject(pointer)?names:chosenKeys(value,budget.keys);
   if(ordered.length<names.length)record({pointer,total:names.length,shown:ordered.length,kind:'object'});
   const result:Record<string,unknown>={};
   for(const field of ordered)result[field]=visit(value[field],pointer+'/'+token(field),field,depth+1);
   seen.delete(value);return result;
  };
  const projection=prepare?prepare(visit(body,'','',0)):visit(body,'','',0);
  const displayLabels=responseSourceLabels(sourceLabelCatalogue,projection);
  if(projection?.data&&typeof projection.data==='object')projection.data.sourceLabels=displayLabels;
  else if(projection&&typeof projection==='object'){for(const value of Object.values(projection))if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.hasOwn(value,'sourceLabels'))(value as any).sourceLabels=displayLabels;}
  if(milestoneFullCounts&&(projection as any)?.data)(projection as any).data.milestoneFullCounts=milestoneFullCounts;
  if(!projection||Array.isArray(projection)||typeof projection!=='object')return projection;
  // If there are no paged tables and no canonical facts to normalize, the
  // original small payload must retain exact source identity.
  if(!changed&&!facts&&!milestoneFullCounts)return prepare?prepare(body):body;
  const paging:ResponsePaging={
   source,pageSize:25,projectVersion,tables,additionalTables,responseBytes:0,sourcePreserved:true,
  };
  (projection as Record<string,unknown>).responsePaging=paging;
  const size=bytes(projection);
  paging.responseBytes=size;
  smallestProjection=projection;
  if(size<=maxBytes)return projection;
 }
 // Preserve the screen shape and the exact table pointers even when the
 // irreducible facts exceed the target. Dropping the entire module here made
 // populated registers appear empty and removed their record navigation.
 // F61: the overrun is stated in the response, never silent.
 const lastPaging=(smallestProjection as any)?.responsePaging as ResponsePaging|undefined;
 if(smallestProjection!==body&&lastPaging&&lastPaging.responseBytes>maxBytes){
  lastPaging.overBudget=true;lastPaging.budgetBytes=maxBytes;
  // Same measuring convention as above: responseBytes describes the bytes sent.
  lastPaging.responseBytes=0;lastPaging.responseBytes=bytes(smallestProjection);
 }
 return smallestProjection;
}
export function recordDetailPage(root:unknown,pointer:string,offset:number,limit=25,filter?:{
 query?:string;status?:string;groupKey?:string;sort?:string;direction?:'asc'|'desc';
}){

  const value=jsonPointer(root,pointer);
  const at=Math.max(0,Math.min(1_000_000,Math.floor(Number.isFinite(offset)?offset:0)));
  const size=Math.max(1,Math.min(50,Math.floor(Number.isFinite(limit)?limit:25)));
  if(Array.isArray(value)){
    const quantityItems=pointer.endsWith('/series')&&
      (jsonPointer(root,pointer.slice(0,-'/series'.length)) as any)?.projectionKey==='quantity_scurve';
    const query=String(filter?.query??'').trim().toLowerCase().slice(0,100);
    const status=String(filter?.status??'').trim().toLowerCase().slice(0,80);
    const sort=String(filter?.sort??'').trim().slice(0,80);
    const safeSort=sort&&!sort.split('.').some(part=>['__proto__','constructor','prototype'].includes(part))?sort:'';
    const groupKey=typeof filter?.groupKey==='string'?filter.groupKey:null;
    let matched=query||status||groupKey?value.filter(row=>{
      if(groupKey&&(row as any)?.ownerGroupKey!==groupKey)return false;
      // The explicit current business status wins over administrative source
      // states such as 'candidate', 'current' and 'verified'. In mixed records
      // a present-but-blank field must not conceal a later readable status.
      // Unknown statuses remain unknown; no source is rewritten or counted
      // as completed merely because it has a source-authority state.
      const statusValues=[
        (row as any)?.currentStatus,(row as any)?.permitStatus,
        (row as any)?.readinessState,(row as any)?.status,
        (row as any)?.state,(row as any)?.scope,
      ];
      const rowStatus=String(statusValues.find(v=>v!==null&&v!==undefined&&String(v).trim().length>0)??'').trim().toLowerCase();
      if(status&&(status==='__open__'?rowStatus==='completed':status==='__completed__'?rowStatus!=='completed':rowStatus!==status))return false;
      // Search item identity, not thousands of historical numeric points.
      // This also prevents an unrelated date/value from matching an item code.
      return !query||(quantityItems
        ?[row?.quantityItemId,row?.itemNumber,row?.description,row?.unit,row?.unitKey].some(v=>String(v??'').toLowerCase().includes(query))
        :JSON.stringify(row).toLowerCase().includes(query));
    }):value;
    // Milestone preview ranks the entire source population. Browse pages
    // must use that same order or critical entries repeat and others vanish.
    // Explicit user sorting continues to take precedence over that default.
    const milestoneBrowse=pointer==='/data/rows'&&
      ((root as any)?.key==='milestones'||(root as any)?.data?.projectionKey==='milestones');
    if(!safeSort&&milestoneBrowse&&value.length>160)
      matched=[...matched].sort(priorityMilestoneOrder);
    if(safeSort){
      const atField=(row:any)=>safeSort.split('.').reduce((o,k)=>o?.[k],row);
      matched=[...matched].sort((a,b)=>{
        const av=atField(a),bv=atField(b);
        const order=typeof av==='number'&&typeof bv==='number'?av-bv:String(av??'').localeCompare(String(bv??''),undefined,{numeric:true});
        return filter?.direction==='desc'?-order:order;
      });
    }
    return {pointer,kind:'array',offset:at,total:matched.length,sourceTotal:value.length,
      rows:matched.slice(at,at+size),sourceLabels:responseSourceLabels((root as any)?.data?.sourceLabels??(root as any)?.sourceLabels,matched.slice(at,at+size)),hasMore:at+size<matched.length};
  }
  if(typeof value==='string')return {pointer,kind:'text',offset:at,total:value.length,text:value.slice(at,at+8192),hasMore:at+8192<value.length};
  if(value&&typeof value==='object'){
    const keys=Object.keys(value),selected=keys.slice(at,at+size);
    return {pointer,kind:'object',offset:at,total:keys.length,rows:selected.map(key=>({field:key,value:(value as any)[key]})),hasMore:at+size<keys.length};
  }
  return {pointer,kind:'scalar',offset:0,total:value===undefined?0:1,value:value??null,hasMore:false};
}
