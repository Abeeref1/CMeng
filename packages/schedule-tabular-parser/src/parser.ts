import ExcelJS from "exceljs";
import { parseCsv } from "../../tabular-parser/src";
import { parseStrictNumeric } from "../../boq-parser/src/numeric";
import { detectScheduleHeader } from "./headers";
import type {
  ScheduleActivityRow,
  ScheduleCellLocator,
  ScheduleColumnRole,
  ScheduleRelationshipRow,
  ScheduleTabularResult,
} from "./types";

function locator(source:"csv"|"xlsx",sheet:string|null,row:number,column:number,address:string|null):ScheduleCellLocator{
 return {source,sheet,row,column,address};
}

function roleColumn(roles:Record<number,ScheduleColumnRole>,role:ScheduleColumnRole):number|null{
 const e=Object.entries(roles).find(([,r])=>r===role);
 return e?Number(e[0]):null;
}

function valueAt(row:readonly string[],column:number|null):string|null{
 if(column===null) return null;
 const value=(row[column-1]??"").trim();
 return value||null;
}

function parseHours(raw:string|null,diagnostics:string[],code:string):number|null{
 if(raw===null) return null;
 const p=parseStrictNumeric(raw);
 if(p.status==="valid") return p.value;
 diagnostics.push(`${code}_${p.status.toUpperCase()}`);
 return null;
}

function makeLocators(
 source:"csv"|"xlsx",
 sheet:string|null,
 rowNo:number,
 roles:Record<number,ScheduleColumnRole>,
):Partial<Record<ScheduleColumnRole,ScheduleCellLocator>>{
 const out:Partial<Record<ScheduleColumnRole,ScheduleCellLocator>>={};
 for(const [col,role] of Object.entries(roles)){
  const column=Number(col);
  out[role]=locator(source,sheet,rowNo,column,source==="xlsx"?null:null);
 }
 return out;
}

function parseRows(
 source:"csv"|"xlsx",
 sheet:string|null,
 rows:readonly (readonly string[])[],
 headerRow:number,
 roles:Record<number,ScheduleColumnRole>,
):{activities:ScheduleActivityRow[];relationships:ScheduleRelationshipRow[];diagnostics:string[]}{
 const activities:ScheduleActivityRow[]=[];
 const relationships:ScheduleRelationshipRow[]=[];
 const diagnostics:string[]=[];
 const activityIdCol=roleColumn(roles,"activity_id");
 const predCol=roleColumn(roles,"predecessor_id");
 const succCol=roleColumn(roles,"successor_id");

 for(let i=headerRow;i<rows.length;i++){
  const row=rows[i]??[];
  if(row.every(v=>!v.trim())) continue;
  const rowNo=i+1;

  if(predCol!==null&&succCol!==null){
   const d:string[]=[];
   const predecessorId=valueAt(row,predCol);
   const successorId=valueAt(row,succCol);
   const relationshipType=valueAt(row,roleColumn(roles,"relationship_type"));
   const lagHours=parseHours(valueAt(row,roleColumn(roles,"lag")),d,"SCHEDULE_LAG");
   if(!predecessorId) d.push("SCHEDULE_PREDECESSOR_ID_MISSING");
   if(!successorId) d.push("SCHEDULE_SUCCESSOR_ID_MISSING");
   relationships.push({
    predecessorId,successorId,relationshipType,lagHours,
    locators:makeLocators(source,sheet,rowNo,roles),
    statusState:d.length===0?"verified":"unresolved",
    diagnostics:d,
   });
   continue;
  }

  if(activityIdCol!==null){
   const d:string[]=[];
   const activityId=valueAt(row,activityIdCol);
   if(!activityId) d.push("SCHEDULE_ACTIVITY_ID_MISSING");
   const originalDurationHours=parseHours(valueAt(row,roleColumn(roles,"original_duration")),d,"SCHEDULE_ORIGINAL_DURATION");
   const remainingDurationHours=parseHours(valueAt(row,roleColumn(roles,"remaining_duration")),d,"SCHEDULE_REMAINING_DURATION");
   const totalFloatHours=parseHours(valueAt(row,roleColumn(roles,"total_float")),d,"SCHEDULE_TOTAL_FLOAT");
   const freeFloatHours=parseHours(valueAt(row,roleColumn(roles,"free_float")),d,"SCHEDULE_FREE_FLOAT");
   const percentComplete=parseHours(valueAt(row,roleColumn(roles,"percent_complete")),d,"SCHEDULE_PERCENT_COMPLETE");
   if(percentComplete!==null&&(percentComplete<0||percentComplete>100)) d.push("SCHEDULE_PERCENT_COMPLETE_OUT_OF_RANGE");
   activities.push({
    activityId,
    activityName:valueAt(row,roleColumn(roles,"activity_name")),
    wbs:valueAt(row,roleColumn(roles,"wbs")),
    wbsId:valueAt(row,roleColumn(roles,"wbs_id")),
    calendar:valueAt(row,roleColumn(roles,"calendar")),
    start:valueAt(row,roleColumn(roles,"start")),
    finish:valueAt(row,roleColumn(roles,"finish")),
    originalDurationHours,remainingDurationHours,totalFloatHours,freeFloatHours,percentComplete,
    status:valueAt(row,roleColumn(roles,"status")),
    locators:makeLocators(source,sheet,rowNo,roles),
    statusState:d.length===0?"verified":"unresolved",
    diagnostics:d,
   });
  }
 }
 return {activities,relationships,diagnostics};
}

function finalize(sourceType:"csv"|"xlsx",sets:Array<ReturnType<typeof parseRows>>,diagnostics:string[]):ScheduleTabularResult{
 const activities=sets.flatMap(s=>s.activities);
 const relationships=sets.flatMap(s=>s.relationships);
 const activityRowsUnresolved=activities.filter(x=>x.statusState==="unresolved").length;
 const relationshipRowsUnresolved=relationships.filter(x=>x.statusState==="unresolved").length;
 const total=activities.length+relationships.length;
 const verified=total-activityRowsUnresolved-relationshipRowsUnresolved;
 return {
  sourceType,activities,relationships,
  activityRowsSeen:activities.length,
  activityRowsVerified:activities.length-activityRowsUnresolved,
  activityRowsUnresolved,
  relationshipRowsSeen:relationships.length,
  relationshipRowsVerified:relationships.length-relationshipRowsUnresolved,
  relationshipRowsUnresolved,
  coveragePercent:total===0?null:Number(((verified/total)*100).toFixed(4)),
  complete:total>0&&activityRowsUnresolved===0&&relationshipRowsUnresolved===0&&diagnostics.length===0,
  diagnostics,
 };
}

export function parseScheduleCsv(bytes:Uint8Array):ScheduleTabularResult{
 const csv=parseCsv(bytes);
 const rows=csv.rows.map(r=>r.cells);
 const header=detectScheduleHeader(rows);
 const diagnostics=[...csv.diagnostics];
 if(!header){
  diagnostics.push("SCHEDULE_CSV_HEADER_NOT_FOUND");
  return finalize("csv",[],diagnostics);
 }
 return finalize("csv",[parseRows("csv",null,rows,header.row,header.roles)],diagnostics);
}

export async function parseScheduleXlsx(bytes:Uint8Array):Promise<ScheduleTabularResult>{
 const wb=new ExcelJS.Workbook();
 await wb.xlsx.load(Buffer.from(bytes) as any);
 const sets:Array<ReturnType<typeof parseRows>>=[];
 const diagnostics:string[]=[];
 for(const sheet of wb.worksheets){
  const rows:string[][]=[];
  for(let r=1;r<=sheet.rowCount;r++){
   const vals:string[]=[];
   for(let c=1;c<=sheet.columnCount;c++) vals.push(sheet.getRow(r).getCell(c).text??"");
   rows.push(vals);
  }
  const header=detectScheduleHeader(rows);
  if(!header){
   const populated=rows.flat().filter(v=>v.trim()).length;
   if(populated>=6) diagnostics.push(`${sheet.name}:SCHEDULE_POPULATED_SHEET_UNCLASSIFIED`);
   continue;
  }
  sets.push(parseRows("xlsx",sheet.name,rows,header.row,header.roles));
 }
 return finalize("xlsx",sets,diagnostics);
}
