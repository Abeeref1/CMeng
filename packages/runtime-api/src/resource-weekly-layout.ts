import {canonicalHeader,type SourceTable} from '../../truth-kernel/src';

/**
 * F16 shared weekly layout rule for resource registers.
 *
 * A weekly resource / labour register is supplied in one of two layouts:
 *  - week rows: one row per resource and week, with a Week Start column (read as is);
 *  - week columns: one column per week, headed by the week-start date. The measure of
 *    each value (Available Capacity, Planned Demand, Actual Approved Usage / Actual Hours
 *    ...) is stated either in a Measure column on each row, or in the column heading next
 *    to the date ("Actual Approved Usage 2026-08-24").
 * Week columns are turned into week rows with the same headings the week-row readers use,
 * so both resource readers apply one rule. A value is read only when the source states
 * its measure and an unambiguous date (ISO, or day with a month name); a blank cell stays
 * blank (not recorded), never 0. Numeric dd/mm dates are not guessed.
 */
const norm=(value:string)=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const FULL_MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
/** Week-row heading for each measure, and the measure names a week-column register may state. */
export const WEEKLY_RESOURCE_MEASURES:ReadonlyArray<readonly [string,readonly string[]]>=[
  ['Available Capacity',['available capacity','capacity available','weekly capacity','capacity']],
  ['Planned Demand',['planned demand','required demand','demand','planned hours']],
  ['Forecast Demand',['forecast demand']],
  ['Actual Approved Usage',['actual approved usage','approved usage','actual usage','actual hours','actual manhours','actual man hours','actual labor hours','actual labour hours','recorded hours']],
];
const MEASURE_COLUMNS=['measure','metric','value type','hours type','row type','data type','series','type'];
const WEEK_ROW_HEADINGS=new Set(['week start','period start','week','week commencing','week beginning','week start date']);
const RESOURCE_ID_HEADINGS=new Set(['resource id','resource unique id','resource code']);
const UNIT_HEADINGS=new Set(['unit','uom','unit of measure']);

export function weeklyResourceMeasure(label:string):string|null{
  const key=norm(label);
  if(!key)return null;
  for(const [heading,names] of WEEKLY_RESOURCE_MEASURES)if(names.includes(key))return heading;
  return null;
}
function validDate(y:number,m:number,d:number):string|null{
  const date=new Date(Date.UTC(y,m-1,d));
  return m>=1&&m<=12&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?date.toISOString().slice(0,10):null;
}
function monthIndex(word:string):number{
  const short=word.slice(0,3),index=MONTHS.indexOf(short);
  return index>=0&&(word.length===3||word==='sept'||word===FULL_MONTHS[index])?index+1:0;
}
/** The week-start date stated in a column heading and the rest of the heading, or null. */
export function weekColumnDate(header:string):{iso:string;rest:string}|null{
  const text=norm(header);
  let iso:string|null=null,match:RegExpExecArray|null;
  if((match=/(?:^| )(\d{4}) (\d{1,2}) (\d{1,2})(?= |$)/.exec(text)))iso=validDate(+match[1]!,+match[2]!,+match[3]!);
  else if((match=/(?:^| )(\d{1,2}) ([a-z]{3,9}) (\d{4})(?= |$)/.exec(text))&&monthIndex(match[2]!))iso=validDate(+match[3]!,monthIndex(match[2]!),+match[1]!);
  else if((match=/(?:^| )([a-z]{3,9}) (\d{1,2}) (\d{4})(?= |$)/.exec(text))&&monthIndex(match[1]!))iso=validDate(+match[3]!,monthIndex(match[1]!),+match[2]!);
  if(!iso||!match)return null;
  const rest=(text.slice(0,match.index)+' '+text.slice(match.index+match[0].length))
    .replace(/\b(?:w c|wc|week|wk|commencing|beginning|starting|start|ending|from|of|on|no)\b/g,' ')
    .replace(/\b\d{1,2}\b/g,' ').replace(/\s+/g,' ').trim();
  return {iso,rest};
}

export interface WeeklyResourceLayoutRow {cells:string[];sources:Array<{row:number;column:string}>}
export interface WeeklyResourceLayout {
  layout:'week_columns_measure_rows'|'week_columns_measure_headings';
  headers:string[];rows:WeeklyResourceLayoutRow[];diagnostics:string[];
}
/** True when a table has a resource id, no week column, and at least one column heading that states a date. */
export function isWeekColumnResourceTable(headers:readonly string[]):boolean{
  const keys=headers.map(norm);
  return !keys.some(key=>WEEK_ROW_HEADINGS.has(key))&&keys.some(key=>RESOURCE_ID_HEADINGS.has(key))&&headers.some(header=>weekColumnDate(header)!==null);
}
/**
 * Turns a week-column resource table into week rows. Returns null when the table is
 * not a week-column resource table (it already has a week column, has no resource id,
 * or no column heading states a date).
 */
export function weeklyResourceLayout(headers:readonly string[],rows:readonly (readonly string[])[]):WeeklyResourceLayout|null{
  if(!isWeekColumnResourceTable(headers))return null;
  const keys=headers.map(norm);
  const idIndex=keys.findIndex(key=>RESOURCE_ID_HEADINGS.has(key));
  const dated=headers.flatMap((header,index)=>{const d=weekColumnDate(header);return d?[{index,iso:d.iso,rest:d.rest,measure:d.rest?weeklyResourceMeasure(d.rest):null}]:[];});
  const diagnostics:string[]=[];
  const inHeading=dated.filter(d=>d.rest),pure=dated.filter(d=>!d.rest);
  const measureIndex=pure.length?MEASURE_COLUMNS.map(name=>keys.indexOf(name)).find(index=>index>=0)??-1:-1;
  const unread=inHeading.filter(d=>!d.measure);
  if(unread.length)diagnostics.push('RESOURCE_WEEK_COLUMN_MEASURE_NOT_RECOGNISED:'+unread.length);
  if(pure.length&&measureIndex<0)diagnostics.push('RESOURCE_WEEK_COLUMNS_MEASURE_NOT_STATED:'+pure.length);
  const datedIndexes=new Set(dated.map(d=>d.index));
  const carried=headers.map((_,index)=>index).filter(index=>!datedIndexes.has(index)&&index!==measureIndex);
  const unitIndex=keys.findIndex(key=>UNIT_HEADINGS.has(key));
  const groups=new Map<string,{carried:string[];week:string;values:Map<string,string>;conflicts:Set<string>;sources:Array<{row:number;column:string}>}>();
  let unknownMeasureRows=0;
  const add=(row:readonly string[],rowIndex:number,week:string,measure:string,raw:string,column:string)=>{
    const value=(raw??'').trim();if(!value)return;
    const id=(row[idIndex]??'').trim(),unit=unitIndex>=0?(row[unitIndex]??'').trim().toUpperCase():'';
    const key=JSON.stringify([id,unit,week]);
    const group=groups.get(key)??{carried:carried.map(()=>''),week,values:new Map<string,string>(),conflicts:new Set<string>(),sources:[]};
    carried.forEach((index,position)=>{
      const cell=(row[index]??'').trim();
      if(!cell)return;
      if(!group.carried[position])group.carried[position]=cell;
      else if(group.carried[position]!==cell&&index!==idIndex){
        diagnostics.push('RESOURCE_WEEK_ROW_DETAIL_CONFLICT:'+id+':'+week+':'+headers[index]);
      }
    });
    const prior=group.values.get(measure);
    if(prior!==undefined&&prior!==value){group.conflicts.add(measure);diagnostics.push('RESOURCE_WEEK_MEASURE_CONFLICT:'+id+':'+week+':'+measure);}
    else group.values.set(measure,value);
    group.sources.push({row:rowIndex,column});
    groups.set(key,group);
  };
  rows.forEach((row,rowIndex)=>{
    if(!(row[idIndex]??'').trim())return;
    for(const d of inHeading)if(d.measure)add(row,rowIndex,d.iso,d.measure,row[d.index]??'',headers[d.index]!);
    if(measureIndex>=0&&pure.length){
      const measure=weeklyResourceMeasure(row[measureIndex]??'');
      if(!measure){unknownMeasureRows++;return;}
      for(const d of pure)add(row,rowIndex,d.iso,measure,row[d.index]??'',headers[d.index]!);
    }
  });
  if(unknownMeasureRows)diagnostics.push('RESOURCE_WEEK_ROW_MEASURE_NOT_RECOGNISED:'+unknownMeasureRows);
  const measures=WEEKLY_RESOURCE_MEASURES.map(([heading])=>heading).filter(heading=>[...groups.values()].some(group=>group.values.has(heading)));
  return {layout:inHeading.some(d=>d.measure)?'week_columns_measure_headings':'week_columns_measure_rows',
    headers:[...carried.map(index=>headers[index]!),'Week Start',...measures],
    rows:[...groups.values()].map(group=>({
      cells:[...group.carried,group.week,...measures.map(measure=>group.conflicts.has(measure)?'':group.values.get(measure)??'')],
      sources:group.sources})),
    diagnostics};
}

/** The same rule for a governed source table (canonical reader): week columns become week rows with cited cells. */
export function weeklyResourceLayoutTable(table:SourceTable,diagnostics:string[]):SourceTable{
  if(!isWeekColumnResourceTable(table.headers))return table;
  const layout=weeklyResourceLayout(table.headers,table.rows.map(row=>table.headers.map(header=>row.cells[header]??'')));
  if(!layout)return table;
  diagnostics.push(...layout.diagnostics.map(d=>d+':'+table.document.documentId));
  if(!layout.rows.length)return table;
  diagnostics.push('RESOURCE_WEEK_COLUMNS_READ_AS_WEEK_ROWS:'+table.document.documentId+':'+layout.layout+':'+layout.rows.length);
  const headers=layout.headers.map(header=>canonicalHeader(header));
  return {...table,headers,rows:layout.rows.map(row=>{
    const first=table.rows[row.sources[0]!.row]!;
    return {cells:Object.freeze(Object.fromEntries(headers.map((header,index)=>[header,row.cells[index]??'']))),
      receipt:{...first.receipt,locator:row.sources.map(source=>table.rows[source.row]!.receipt.locator+':column:'+source.column).join(';')}};
  })};
}
