import type ExcelJSModule from 'exceljs';

let loaded:typeof ExcelJSModule|undefined;
/** T11: ExcelJS (with its archive and stream libraries) is loaded on first
 * workbook use instead of at every project-worker start. It returns the same
 * module object a default import of 'exceljs' gives. */
export function excelJs():typeof ExcelJSModule{
  if(!loaded){
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module=require('exceljs');
    loaded=(module&&module.__esModule?module.default:module) as typeof ExcelJSModule;
  }
  return loaded;
}
