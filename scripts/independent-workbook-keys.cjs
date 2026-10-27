// Downloads print reader headings ('Paid income · value'); the field key of each
// column stays on a key sheet ('Field keys' in module reports, 'Column keys' in
// delivery workbooks). The independent comparers find a column by that field
// key, never by the printed heading, so a wording change cannot hide a figure.
// Each lookup also proves the key sheet points at the heading really printed in
// that column: a stale or shifted key sheet is a failed check, not a pass.
function text(value){
 if(value&&typeof value==='object'&&Array.isArray(value.richText))return value.richText.map(part=>part.text).join('');
 return value===null||value===undefined?value:String(value);
}
/** Map of worksheet -> field key -> {column, heading} read from one key sheet. */
function workbookFieldKeys(book,keySheetName){
 const byWorksheet=new Map(),sheet=book.getWorksheet(keySheetName);
 if(!sheet)return byWorksheet;
 const head=(sheet.getRow(1).values||[]).map(text),at=name=>head.indexOf(name);
 const worksheet=at('Worksheet'),column=at('Column'),row=at('Row'),heading=at('Heading'),key=at('Field key');
 if(worksheet<1||column<1||heading<1||key<1)return byWorksheet;
 sheet.eachRow((entry,number)=>{
  // Module reports also key the 'Report' figure rows; only row 1 holds column headings.
  if(number===1||(row>0&&Number(entry.getCell(row).value)!==1))return;
  const name=text(entry.getCell(worksheet).value),columns=byWorksheet.get(name)??new Map();
  columns.set(text(entry.getCell(key).value),{column:Number(entry.getCell(column).value),heading:text(entry.getCell(heading).value)});
  byWorksheet.set(name,columns);
 });
 return byWorksheet;
}
/**
 * Column reader for one data worksheet. column(key) is the column number, or -1
 * when the export has no column with that field key. headingCheck(key) returns
 * null when the printed heading in that column is the key sheet's heading, or
 * the difference to record when the column is absent or the key sheet is stale.
 */
function fieldKeyColumns(book,keySheetName,worksheetName){
 const keys=workbookFieldKeys(book,keySheetName).get(worksheetName)??new Map(),sheet=book.getWorksheet(worksheetName);
 const column=key=>{const found=keys.get(key);return found&&Number.isInteger(found.column)&&found.column>0?found.column:-1;};
 const cell=(row,key)=>{const at=column(key);return row&&at>0?row.getCell(at).value:undefined;};
 const headingCheck=key=>{
  const found=keys.get(key),at=column(key);
  if(at<0)return {actual:null,expected:'column with field key '+key+' on '+worksheetName};
  const printed=sheet?text(sheet.getRow(1).getCell(at).value):undefined;
  return printed===found.heading?null:{actual:printed??null,expected:found.heading};
 };
 return {sheet,column,cell,headingCheck};
}
/**
 * Worksheet name of one data table, found by its table key (data path, such as
 * 'Delivery.rows') on the index sheet; the index's Table column is reader words.
 * Undefined when no table carries that key, or when two worksheets claim it.
 */
function worksheetByTableKey(book,indexSheetName,tableKey){
 const index=book.getWorksheet(indexSheetName);
 if(!index)return undefined;
 const head=(index.getRow(1).values||[]).map(text),worksheet=head.indexOf('Worksheet'),key=head.indexOf('Table key'),found=[];
 if(worksheet<1||key<1)return undefined;
 index.eachRow((row,number)=>{if(number>1&&text(row.getCell(key).value)===tableKey)found.push(text(row.getCell(worksheet).value));});
 return found.length===1?found[0]:undefined;
}
module.exports={workbookFieldKeys,fieldKeyColumns,worksheetByTableKey};
