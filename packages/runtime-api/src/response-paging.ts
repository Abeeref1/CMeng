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
const PRIORITY_FIELDS=new Set(['key','status','reason','projectId','projectVersion','projectFacts','data','metrics','counts','summary','position','time','controls','schedule','commercial','actions','claims','reportingContract','dataDateIso','issueAssessment','completionPosition','forecastTaxonomy','focus','pagination']);
type PageBudget={rows:number;keys:number;text:number;depth:number};
const FACT_BUDGET:PageBudget={rows:10,keys:85,text:800,depth:9};
const PAGE_BUDGETS:PageBudget[]=[
  {rows:25,keys:150,text:4096,depth:12},
  {rows:25,keys:100,text:2048,depth:10},
  {rows:12,keys:90,text:1600,depth:10},
  {rows:4,keys:72,text:1200,depth:9},
  {rows:0,keys:55,text:700,depth:8},
];

function chosenKeys(value:Record<string,unknown>,max:number):string[]{
 const keys=Object.keys(value);
 if(keys.length<=max)return keys;
 return [...keys.filter(key=>PRIORITY_FIELDS.has(key)),...keys.filter(key=>!PRIORITY_FIELDS.has(key))].slice(0,max);
}
/** A canonical fact snapshot is projected by the SAME fixed rule on every
 * screen, independent of how large the surrounding specialist module is.
 * Original registers, receipts and full source facts remain in producers and
 * downloadable reports, and are retrievable on demand. */
function compactFactSnapshot(value:unknown):unknown {
 const seen=new Set<object>();
 const walk=(v:any,key:string,depth:number):any=>{
  if(v===null||typeof v!=='object'){
   return typeof v==='string'&&v.length>FACT_BUDGET.text?v.slice(0,FACT_BUDGET.text):v;
  }
  if(seen.has(v))return null;
  if(depth>FACT_BUDGET.depth)return Array.isArray(v)?[]:{detailAvailable:true};
  seen.add(v);
  if(Array.isArray(v)){
   const result=v.slice(0,FACT_BUDGET.rows).map((item:any)=>walk(item,'',depth+1));
   seen.delete(v);return result;
  }
  const keys=chosenKeys(v,FACT_BUDGET.keys).filter(k=>!['programmeQuality','contractSections','securityValidity'].includes(k));
  const result:Record<string,unknown>={};
  for(const field of keys)result[field]=walk(v[field],field,depth+1);
  seen.delete(v);return result;
 };
 return walk(value,'projectFacts',0);
}

function projectFactsOf(body:unknown):unknown {
 const item=body as any;
 return item?.data?.projectFacts??item?.projectFacts??null;
}

/** No stringify of the 65-MB original data, no six full-payload
 * serialization passes, and no page-specific truncation of canonical facts.
 * Counts are always taken BEFORE paging from each exact source population. */
export function pageProjectResponse(
 body:unknown,source:string,maxBytes=PROJECT_SCREEN_MAX_BYTES,
):unknown {
 if(!body||typeof body!=='object')return body;
 const facts=projectFactsOf(body);
 const normalizedFacts=facts?compactFactSnapshot(facts):null;
 const projectVersion=Number.isInteger((body as any).projectVersion)
   ?Number((body as any).projectVersion)
   :Number.isInteger((facts as any)?.projectVersion)?Number((facts as any).projectVersion):null;
 for(const budget of PAGE_BUDGETS){
  const tables:PageTable[]=[];
  let additionalTables=0,changed=false;
  const seen=new Set<object>();
  const record=(entry:PageTable)=>{
   changed=true;
   if(tables.length<180)tables.push(entry);
   else additionalTables++;
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
   if(seen.has(value))return {detailAvailable:true};
   if(depth>budget.depth){
     record({pointer,total:Array.isArray(value)?value.length:Object.keys(value).length,shown:0,
       kind:Array.isArray(value)?'array':'object'});
     return Array.isArray(value)?[]:{detailAvailable:true};
   }
   seen.add(value);
   if(Array.isArray(value)){
     const table=TABLE_NAME.test(key)||value.length>100;
     const shown=table?Math.min(budget.rows,value.length):value.length;
     if(shown<value.length)record({pointer,total:value.length,shown,kind:'array'});
     const rows=value.slice(0,shown).map((item:any,i:number)=>visit(item,pointer+'/'+i,'',depth+1));
     seen.delete(value);return rows;
   }
   const names=Object.keys(value),ordered=chosenKeys(value,budget.keys);
   if(ordered.length<names.length)record({pointer,total:names.length,shown:ordered.length,kind:'object'});
   const result:Record<string,unknown>={};
   for(const field of ordered)result[field]=visit(value[field],pointer+'/'+token(field),field,depth+1);
   seen.delete(value);return result;
  };
  const projection=visit(body,'','',0);
  if(!projection||Array.isArray(projection)||typeof projection!=='object')return projection;
  // If there are no paged tables and no canonical facts to normalize, the
  // original small payload must retain exact source identity.
  if(!changed&&!facts)return body;
  const paging:ResponsePaging={
   source,pageSize:25,projectVersion,tables,additionalTables,responseBytes:0,sourcePreserved:true,
  };
  (projection as Record<string,unknown>).responsePaging=paging;
  const size=bytes(projection);
  if(size<=maxBytes){paging.responseBytes=size;return projection;}
 }
 const input=body as Record<string,any>;
 const final={
   key:input.key??null,status:input.status??'partial',
   reason:'Source details are paged. No original register or computation has been deleted.',
   data:{projectFacts:normalizedFacts},
   responsePaging:{source,pageSize:25 as const,projectVersion,
     tables:[{pointer:'',total:Object.keys(input).length,shown:0,kind:'object' as const}],
     additionalTables:0,responseBytes:0,sourcePreserved:true as const},
 };
 // Fail with an explicit warning rather than inventing shortened numbers.
 if(bytes(final)>maxBytes)final.data.projectFacts=null;
 final.responsePaging.responseBytes=bytes(final);
 return final;
}
export function recordDetailPage(root:unknown,pointer:string,offset:number,limit=25){
  const value=jsonPointer(root,pointer);
  const at=Math.max(0,Math.min(1_000_000,Math.floor(Number.isFinite(offset)?offset:0)));
  const size=Math.max(1,Math.min(25,Math.floor(Number.isFinite(limit)?limit:25)));
  if(Array.isArray(value))return {pointer,kind:'array',offset:at,total:value.length,rows:value.slice(at,at+size),hasMore:at+size<value.length};
  if(typeof value==='string')return {pointer,kind:'text',offset:at,total:value.length,text:value.slice(at,at+8192),hasMore:at+8192<value.length};
  if(value&&typeof value==='object'){
    const keys=Object.keys(value),selected=keys.slice(at,at+size);
    return {pointer,kind:'object',offset:at,total:keys.length,rows:selected.map(key=>({field:key,value:(value as any)[key]})),hasMore:at+size<keys.length};
  }
  return {pointer,kind:'scalar',offset:0,total:value===undefined?0:1,value:value??null,hasMore:false};
}
