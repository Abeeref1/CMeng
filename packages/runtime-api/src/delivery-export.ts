import ExcelJS from 'exceljs';
import type {ModuleRuntimeResult} from './project-state-types';
/** Normalize every nested record, including every curve point, without row caps. */
export async function buildDeliveryWorkbook(projectId:string,result:ModuleRuntimeResult){
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
 const summary=workbook.addWorksheet('Report');summary.addRows([['Project',projectId],['Page',result.key],['Status',result.status],['Management position',result.reason],['Data Date',(result.data as any)?.dataDateIso??'Unresolved'],['Programme revision',(result.data as any)?.programmeRevisionId??'Unresolved'],['Authority',(result.data as any)?.authorityScope]]);
 const index=workbook.addWorksheet('Dataset index');index.addRow(['Worksheet','Dataset path','Row count']);
 let number=0;for(const [path,rows] of sections){const name=String(++number).padStart(2,'0')+' '+path.split('.').at(-1)!.replace(/[\\/*?:\[\]]/g,' ').slice(0,26);const sheet=workbook.addWorksheet(name);index.addRow([name,path,rows.length]);const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];sheet.addRow(keys);for(const r of rows)sheet.addRow(keys.map(k=>{const v=r[k];return v===null||v===undefined?'Unresolved':typeof v==='string'?v.slice(0,32767):v;}));sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,rows.length+1),column:Math.max(1,keys.length)}};sheet.getRow(1).font={bold:true};sheet.columns.forEach(c=>c.width=24);}
 summary.columns.forEach(c=>c.width=55);index.columns.forEach(c=>c.width=42);return Buffer.from(await workbook.xlsx.writeBuffer());
}
