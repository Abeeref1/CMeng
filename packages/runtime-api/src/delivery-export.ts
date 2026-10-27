import type {ModuleRuntimeResult} from './project-state-types';
import {readableFieldLabel,readablePathLabel} from './field-labels';
import {titleForModule} from './registry';
// T10 X1: the screen's one word for an unknown value. A cell whose field is
// absent from that record (the column belongs to other records) stays empty.
const NOT_ESTABLISHED='Not established';
// Columns the export itself adds to every record row.
const exportColumnLabels:Record<string,string>={projectId:'Project',parentRecordId:'Parent record',rowOrdinal:'Row number'};
/** Normalize every nested record, including every curve point, without row caps. */
export async function buildDeliveryWorkbook(projectId:string,result:ModuleRuntimeResult){
 const {default:ExcelJS}=await import('exceljs');
 const workbook=new ExcelJS.Workbook();workbook.creator='CMeng';workbook.title=projectId+' Delivery';
 const sections=new Map<string,Record<string,unknown>[]>();
 function visit(value:any,path:string,parent:string|null){
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value)){value.forEach((row,index)=>{const out:Record<string,unknown>={projectId,parentRecordId:parent,rowOrdinal:index+1};const id=row?.recordId??row?.key??parent;
   function flatten(v:any,prefix:string){if(Array.isArray(v)){if(v.every(x=>x===null||typeof x!=='object'))out[prefix]=v.join('; ');else visit(v,path+'.'+prefix,id);}else if(v&&typeof v==='object')Object.entries(v).forEach(([k,x])=>flatten(x,prefix?prefix+'.'+k:k));else out[prefix]=v??null;}
   flatten(row,'');const list=sections.get(path)??[];list.push(out);sections.set(path,list);});return;}
  Object.entries(value).forEach(([key,child])=>visit(child,path?path+'.'+key:key,parent));
 }
 visit(result.data,'Delivery',null);
 const data=result.data as any,known=(v:unknown)=>v===null||v===undefined||v===''?NOT_ESTABLISHED:v;
 // T10 X1/X2: reader words, the page title, and the page's data date and scope.
 const summary=workbook.addWorksheet('Report');summary.addRows([['Project',projectId],['Page',titleForModule(result.key)],['Status',readableFieldLabel(result.status)],['Management position',known(result.reason)],
   ['Data date',known(data?.dataDateIso??data?.reportingContract?.dataDateIso)],['Programme revision',known(data?.programmeRevisionId??data?.reportingContract?.programmeRevisionId)],
   ['Authority',known(typeof data?.authorityScope==='string'?readableFieldLabel(data.authorityScope):data?.authorityScope)],
   ['Scope','Project '+projectId+' · '+titleForModule(result.key)+' · all records (no screen paging)']]);
 // T10 X2: every figure the page shows outside its tables, in reader words.
 // Tables are on their own worksheets below; nothing is cut at a fixed depth.
 summary.addRow([]);summary.addRow(['Figures on the page','Value']).font={bold:true};
 const seen=new Set<object>();
 const figures=(value:any,path:string)=>{
  if(Array.isArray(value)||value===undefined)return;
  if(value&&typeof value==='object'){if(seen.has(value))return;seen.add(value);for(const [key,child] of Object.entries(value))figures(child,path?path+'.'+key:key);seen.delete(value);return;}
  summary.addRow([readablePathLabel(path)||path,value===null?NOT_ESTABLISHED:typeof value==='string'?value.slice(0,32767):value]);
 };
 figures(data,'');
 // The Table heading is in reader words; 'Table key' keeps each table's data path
 // so a reader (and the independent check) finds a table by key, never by wording.
 const index=workbook.addWorksheet('Dataset index');index.addRow(['Worksheet','Table','Row count','Table key']);
 // Machine-readable column mapping: the heading shown and the field key it holds.
 const columnKeys:Array<[string,number,string,string]>=[];
 let number=0;for(const [path,rows] of sections){const name=String(++number).padStart(2,'0')+' '+path.split('.').at(-1)!.replace(/[\\/*?:\[\]]/g,' ').slice(0,26);const sheet=workbook.addWorksheet(name);index.addRow([name,readablePathLabel(path)||path,rows.length,path]);const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
  const headings=keys.map(k=>exportColumnLabels[k]??(readablePathLabel(k)||k));keys.forEach((k,i)=>columnKeys.push([name,i+1,headings[i]!,k]));
  sheet.addRow(headings);for(const r of rows)sheet.addRow(keys.map(k=>{if(!Object.prototype.hasOwnProperty.call(r,k))return null;const v=r[k];return v===null||v===undefined?NOT_ESTABLISHED:typeof v==='string'?v.slice(0,32767):v;}));sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,rows.length+1),column:Math.max(1,keys.length)}};sheet.getRow(1).font={bold:true};sheet.columns.forEach(c=>c.width=24);}
 const mapping=workbook.addWorksheet('Column keys');mapping.addRow(['Worksheet','Column','Heading','Field key']);mapping.addRows(columnKeys);mapping.getRow(1).font={bold:true};mapping.columns.forEach(c=>c.width=30);
 summary.columns.forEach(c=>c.width=55);index.columns.forEach(c=>c.width=42);return Buffer.from(await workbook.xlsx.writeBuffer());
}
/** Field key of each column of one delivery worksheet, read from 'Column keys'. */
export function deliveryColumnKeys(book:{getWorksheet(name:string):any},worksheet:string):string[]{
 const sheet=book.getWorksheet('Column keys'),keys:string[]=[];
 sheet?.eachRow((row:any,n:number)=>{if(n>1&&row.getCell(1).value===worksheet)keys[Number(row.getCell(2).value)]=String(row.getCell(4).value);});
 return keys;
}
