import type { ScheduleColumnRole, ScheduleHeaderMapping } from "./types";

const ALIASES: Record<Exclude<ScheduleColumnRole,"unknown">, string[]> = {
  activity_id:["activity id","activity_id","task id","task_id","id","activity code","task_code"],
  activity_name:["activity name","activity_name","task name","task_name","name","description"],
  wbs:["wbs","wbs path","wbs code","wbs name"],
  wbs_id:["wbs id","wbs_id"],
  calendar:["calendar","calendar name","calendar id","clndr_id"],
  start:["start","start date","forecast start","early start","planned start"],
  finish:["finish","finish date","forecast finish","early finish","planned finish"],
  actual_start:["actual start","actual start date"],
  actual_finish:["actual finish","actual finish date"],
  baseline_start:["baseline start","bl start","target start"],
  baseline_finish:["baseline finish","bl finish","target finish"],
  original_duration:["original duration","orig duration","planned duration","target duration","duration"],
  remaining_duration:["remaining duration","remain duration","rem duration"],
  total_float:["total float","total_float","tf"],
  free_float:["free float","free_float","ff"],
  percent_complete:["percent complete","% complete","complete %","physical %","duration %"],
  status:["status","activity status"],
  predecessor_id:["predecessor","predecessor id","pred id","pred_task_id"],
  successor_id:["successor","successor id","succ id","task_id"],
  relationship_type:["relationship type","relation type","type","pred_type"],
  lag:["lag","lag hours","lag_hr_cnt"],
  record_type:["record type","record_type","row type","type record"],
};

function normalize(v:string):string {
 return v
  .toLowerCase()
  .replace(/[\[(](?:h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks|m|min|mins|minute|minutes)[\])]/g," ")
  .replace(/[._:/\-]+/g," ")
  .replace(/\s+/g," ")
  .trim();
}

function roleFor(v:string):{role:ScheduleColumnRole;score:number}{
 const n=normalize(v);
 let best:{role:ScheduleColumnRole;score:number}={role:"unknown",score:0};
 for(const [role,aliases] of Object.entries(ALIASES) as Array<[Exclude<ScheduleColumnRole,"unknown">,string[]]>) {
  for(const alias of aliases){
   const a=normalize(alias);
   let score=0;
   if(n===a) score=1;
   else if(n.includes(a)||a.includes(n)) score=Math.min(n.length,a.length)/Math.max(n.length,a.length);
   if(score>best.score) best={role,score};
  }
 }
 return best;
}

function mappingForRow(
  row: readonly string[],
  rowNumber: number,
): ScheduleHeaderMapping | null {
  const roles:Record<number,ScheduleColumnRole>={};
  const headers:Record<number,string>={};
  const seen=new Set<ScheduleColumnRole>();
  let score=0;

  row.forEach((cell,i)=>{
    headers[i+1]=cell;
    const m=roleFor(cell);
    if(m.role!=="unknown"&&m.score>=0.65&&!seen.has(m.role)){
      roles[i+1]=m.role;
      seen.add(m.role);
      score+=m.score;
    }
  });

  const looksActivity =
    seen.has("activity_id") &&
    (seen.has("activity_name") || seen.has("start") || seen.has("finish"));
  const looksRelationship =
    seen.has("predecessor_id") && seen.has("successor_id");

  if(!looksActivity && !looksRelationship) return null;

  return {
    row: rowNumber,
    roles,
    headers,
    score:Number(score.toFixed(4)),
  };
}

export function detectAllScheduleHeaders(
  rows: readonly (readonly string[])[],
): ScheduleHeaderMapping[] {
  const mappings: ScheduleHeaderMapping[] = [];
  rows.forEach((row,index)=>{
    const mapping = mappingForRow(row,index+1);
    if(mapping) mappings.push(mapping);
  });
  return mappings;
}

export function detectScheduleHeader(
  rows:readonly (readonly string[])[],
  maxRows=30,
):ScheduleHeaderMapping|null{
  let best:ScheduleHeaderMapping|null=null;
  for(let r=0;r<Math.min(rows.length,maxRows);r++){
    const candidate = mappingForRow(rows[r]??[],r+1);
    if(!candidate) continue;
    if(!best||candidate.score>best.score) best=candidate;
  }
  return best;
}
