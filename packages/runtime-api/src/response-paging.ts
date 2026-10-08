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
/** Idempotent for small bodies. A large result is never silently replaced with
 * null or zero: every collapsed array/text/object has a retrievable pointer. */
export function pageProjectResponse(
  body:unknown,source:string,maxBytes=PROJECT_SCREEN_MAX_BYTES,
):unknown {
  if(!body||typeof body!=='object'||bytes(body)<=maxBytes)return body;
  const projectVersion=Number.isInteger((body as any).projectVersion)
    ?Number((body as any).projectVersion):Number.isInteger((body as any).data?.projectFacts?.projectVersion)
    ?Number((body as any).data.projectFacts.projectVersion):null;
  const limits=[
    {array:25,depth:10,text:4096,map:50},
    {array:15,depth:8,text:2048,map:35},
    {array:8,depth:7,text:1200,map:25},
    {array:3,depth:6,text:700,map:15},
    {array:1,depth:5,text:350,map:10},
    {array:0,depth:3,text:160,map:7},
  ];
  for(const limit of limits){
    const tables:PageTable[]=[];
    let additionalTables=0;
    const record=(entry:PageTable)=>{
      if(tables.length<90)tables.push(entry);else additionalTables++;
    };
    const visit=(value:any,pointer:string,depth:number,stack:Set<unknown>):any=>{
      if(value===null||value===undefined||typeof value==='number'||typeof value==='boolean')return value;
      if(typeof value==='string'){
        if(value.length<=limit.text||depth<=1)return value;
        record({pointer,total:value.length,shown:limit.text,kind:'text'});
        return value.slice(0,limit.text)+'…';
      }
      if(typeof value!=='object')return String(value);
      if(stack.has(value))return {detailAvailable:true};
      if(depth>limit.depth){
        record({pointer,total:Array.isArray(value)?value.length:Object.keys(value).length,shown:0,kind:Array.isArray(value)?'array':'object'});
        return Array.isArray(value)?[]:{detailAvailable:true};
      }
      stack.add(value);
      if(Array.isArray(value)){
        if(value.length>limit.array)record({pointer,total:value.length,shown:limit.array,kind:'array'});
        const v=value.slice(0,limit.array).map((row,i)=>visit(row,pointer+'/'+i,depth+1,stack));
        stack.delete(value);return v;
      }
      const names=Object.keys(value),namesShown=names.slice(0,limit.map);
      if(names.length>namesShown.length)record({pointer,total:names.length,shown:namesShown.length,kind:'object'});
      const data:Record<string,unknown>={};
      for(const key of namesShown)data[key]=visit(value[key],pointer+'/'+token(key),depth+1,stack);
      stack.delete(value);return data;
    };
    const projection=visit(body,'',0,new Set());
    const paging:ResponsePaging={source,pageSize:25,projectVersion,
      tables,additionalTables,responseBytes:0,sourcePreserved:true};
    if(!projection||typeof projection!=='object'||Array.isArray(projection))continue;
    projection.responsePaging=paging;
    const size=bytes(projection);
    if(size<=maxBytes){
      paging.responseBytes=size;return projection;
    }
  }
  // A rare very large scalar/flat dictionary still cannot break the browser.
  // Its original producer remains untouched and available by pointer or export.
  const sourceValues=body as Record<string,any>;
  const final={
    key:sourceValues.key??null,
    status:sourceValues.status??'partial',
    reason:'Large source details are available by page. The original records have been retained.',
    projectFacts:sourceValues.projectFacts??sourceValues.data?.projectFacts??null,
    data:{projectFacts:sourceValues.data?.projectFacts??null},
    responsePaging:{source,pageSize:25 as const,projectVersion,
      tables:[{pointer:'',total:Object.keys(sourceValues).length,shown:0,kind:'object' as const}],
      additionalTables:0,responseBytes:0,sourcePreserved:true as const},
  };
  // Headline facts themselves may be exceptionally large in a damaged input.
  if(bytes(final)>maxBytes){final.projectFacts=null;final.data.projectFacts=null;}
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
