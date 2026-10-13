/** One complete array population per logical field path. Nested arrays retain
 * their parent location and identity instead of keeping only the first parent. */
export interface ReportTableGroup {
 rows: unknown[];
 pointer: string;
 parentPointer: string|null;
 parentReference: string|null;
}
export interface ReportArraySection {
 path: string;
 groups: ReportTableGroup[];
 rowCount: number;
 nested: boolean;
}
const token=(key:string)=>key.replace(/~/g,'~0').replace(/\//g,'~1');
function reference(value:unknown):string|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const fields=Object.entries(value).filter(([key,v])=>
  /^(?:id|reference|itemNumber|name|dateIso|unit)$|Id$/.test(key)&&
  (typeof v==='string'||typeof v==='number'));
 return fields.length?fields.map(([key,v])=>key+'='+String(v)).join('; '):null;
}
export function collectReportArrays(value:unknown):ReportArraySection[] {
 const sections=new Map<string,ReportArraySection>(),active=new Set<object>();
 const visit=(value:unknown,fields:string[],pointer:string,parentPointer:string|null,parentReference:string|null)=>{
  if(!value||typeof value!=='object'||active.has(value))return;
  active.add(value);
  if(Array.isArray(value)){
   const key=JSON.stringify(fields);let section=sections.get(key);
   if(!section){section={path:fields.join('.')||'records',groups:[],rowCount:0,nested:parentPointer!==null};sections.set(key,section);}
   section.groups.push({rows:value,pointer,parentPointer,parentReference});section.rowCount+=value.length;
   for(let index=0;index<value.length;index++){
    const row=value[index];if(!row||typeof row!=='object')continue;
    const rowPointer=pointer+'/'+index;
    visit(row,Array.isArray(row)?[...fields,'[]']:fields,rowPointer,rowPointer,reference(row)??parentReference);
   }
  }else{
   for(const [key,child]of Object.entries(value))visit(child,[...fields,key],pointer+'/'+token(key),parentPointer,parentReference);
  }
  active.delete(value);
 };
 visit(value,[],'/data',null,null);
 return [...sections.values()];
}
/** Lazy rows avoid copying every nested history into an intermediate flat list. */
export function* reportArrayRows(section:ReportArraySection):Generator<unknown> {
 for(const group of section.groups)for(let index=0;index<group.rows.length;index++){
  const record=group.rows[index];
  yield section.nested?{parentPointer:group.parentPointer,parentReference:group.parentReference,sourcePointer:group.pointer+'/'+index,record}:record;
 }
}
