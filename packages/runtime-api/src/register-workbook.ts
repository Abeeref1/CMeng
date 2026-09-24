import ExcelJS from 'exceljs';
import {canonicalHeader,prepareRegisterRows} from '../../truth-kernel/src';
import type {StoredEvidenceDocument} from './project-state-types';

export async function readRegisterWorkbook(bytes:Uint8Array,sourceHashSha256:string,documentType:string):Promise<NonNullable<StoredEvidenceDocument['tabularRead']>> {
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(bytes) as any);
  const sheets=workbook.worksheets.map(sheet=>{
    const rows:string[][]=[];
    sheet.eachRow({includeEmpty:true},row=>{const values:string[]=[];for(let i=1;i<=sheet.columnCount;i++){
      const c=row.getCell(i),value=c.value;
      values.push(value instanceof Date?value.toISOString().slice(0,10):value&&typeof value==='object'&&'formula' in value?(value.result===undefined?'':String(value.result)):c.text);
    }rows.push(values);});
    // Remove only columns that are empty throughout the worksheet. Source row
    // positions, including title rows, remain unchanged.
    const columns=Array.from({length:sheet.columnCount},(_,i)=>i).filter(i=>rows.some(row=>row[i]?.trim()));
    const compact=rows.map(row=>columns.map(i=>row[i]??''));
    const prepared=prepareRegisterRows(compact,documentType);
    for(let r=prepared.headerRow;r<compact.length;r++)for(let c=0;c<prepared.headers.length;c++){
      const header=canonicalHeader(prepared.headers[c]!),raw=compact[r]![c]??'';
      if(!/(?:date|period end|as of|event start|event end|week start)$/.test(header)||!/^\d+(?:\.\d+)?$/.test(raw))continue;
      const serial=Number(raw);
      if(serial===60&&!workbook.properties.date1904){compact[r]![c]='Unresolved Excel date serial 60';continue;}
      if(serial<=0||serial>2958465)continue;
      const epoch=workbook.properties.date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,serial<60?31:30);
      compact[r]![c]=new Date(epoch+Math.floor(serial)*86400000).toISOString().slice(0,10);
    }
    return {name:sheet.name,rows:compact};
  });
  return {producerVersion:'register-workbook-v1',sourceHashSha256,sheets};
}
export const registerCsv=(rows:readonly string[][])=>rows.map(row=>row.map(value=>'"'+value.replaceAll('"','""')+'"').join(',')).join('\n');
