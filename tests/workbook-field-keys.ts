import type ExcelJS from 'exceljs';
import {FIELD_KEYS_SHEET} from '../packages/runtime-api/src/field-labels';

// Downloads print readable headings; the field key of each column is kept on
// the field-key sheet. Tests that read data columns find them by key here.
type Book=ExcelJS.Workbook;
function fieldKeyRows(book:Book){
 const sheet=book.getWorksheet(FIELD_KEYS_SHEET);
 if(!sheet)return [];
 const rows:{worksheet:string,column:number,row:number,heading:string,fieldKey:string}[]=[];
 sheet.eachRow((row,number)=>{if(number===1)return;const v=row.values as any[];rows.push({worksheet:String(v[1]),column:Number(v[2]),row:Number(v[3]),heading:String(v[4]),fieldKey:String(v[5])});});
 return rows;
}
/** Column number of a field key on a worksheet, or -1 when the worksheet has no such column. */
export function fieldKeyColumn(book:Book,worksheet:string,key:string):number{
 return fieldKeyRows(book).find(r=>r.worksheet===worksheet&&r.row===1&&r.fieldKey===key)?.column??-1;
}
/** The first data worksheet whose columns carry every given field key. */
export function worksheetWithFieldKeys(book:Book,keys:string[]):ExcelJS.Worksheet|undefined{
 const rows=fieldKeyRows(book);
 return book.worksheets.find(sheet=>keys.every(key=>rows.some(r=>r.worksheet===sheet.name&&r.row===1&&r.fieldKey===key)));
}
/** The printed heading of a field key on a worksheet. */
export function fieldKeyHeading(book:Book,worksheet:string,key:string):string|undefined{
 const column=fieldKeyColumn(book,worksheet,key);
 return column>0?String(book.getWorksheet(worksheet)!.getRow(1).getCell(column).value):undefined;
}
