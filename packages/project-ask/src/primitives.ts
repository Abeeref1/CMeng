import type {AnalysisTable, AnalysisPlan, AnalysisChart, Cell, Filter, Column} from './types';
export const label = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/\bIso\b/g, '').trim().replace(/^./, c=>c.toUpperCase());
export const finite = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
export const cell = (v: unknown): Cell => v === null || v === undefined ? null : typeof v === 'number' ? finite(v) : typeof v === 'string' || typeof v === 'boolean' ? v : Array.isArray(v) && v.every(x=>typeof x==='string') ? v.join('; ') : null;
export const normalized = (s: unknown) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').trim();
export function matchFilter(row: Record<string, Cell>, filter: Filter) {
  if(filter.field==='search')return Object.values(row).some(value=>value!==null&&normalized(value).includes(normalized(filter.value)));
  const value = row[filter.field];
  if (value === null || value === undefined) return false;
  if (filter.operator === 'eq') return normalized(value) === normalized(filter.value);
  if (filter.operator === 'contains') return normalized(value).includes(normalized(filter.value));
  if (typeof value === 'number' && typeof filter.value !== 'number') return false;
  const a = value as number | string, b = filter.value as number | string;
  if (b === null) return false;
  return filter.operator === 'lt' ? a < b : filter.operator === 'lte' ? a <= b : filter.operator === 'gt' ? a > b : filter.operator === 'gte' ? a >= b : filter.upper !== null && a >= b && a <= (filter.upper as number | string);
}
/** Aggregation never guesses compatibility or averages percentages. */
export function groupTable(table: AnalysisTable, dimensions: string[]): AnalysisTable {
  const dims = dimensions.filter(d=>table.columns.some(c=>c.key===d && c.dimension));
  if (!dims.length) return table;
  for (const key of ['unit','currency','taxBasis']) if (table.columns.some(c=>c.key===key) && !dims.includes(key)) dims.push(key);
  const sums = table.columns.filter(c=>c.type==='number' && c.aggregate==='sum' && !dims.includes(c.key));
  const groups = new Map<string, Record<string, Cell>>();
  for (const row of table.rows) {
    const key = JSON.stringify(dims.map(d=>row[d]??null));
    let group = groups.get(key);
    if (!group) { group=Object.fromEntries(dims.map(d=>[d,row[d]??null])); group.recordCount=0; for(const col of sums)group[col.key]=0; groups.set(key,group); }
    group.recordCount = Number(group.recordCount)+1;
    for(const col of sums)group[col.key]=group[col.key]===null||typeof row[col.key]!=='number'?null:Number(group[col.key])+Number(row[col.key]);
  }
  return {...table,id:table.id+'-grouped',title:table.title+' by '+dims.map(label).join(' / '),rows:[...groups.values()],
    columns:[...dims.map(d=>table.columns.find(c=>c.key===d)!),{key:'recordCount',label:'Records in this group',type:'number',unit:'records',aggregate:'sum',dimension:false},...sums],
    basis:table.basis+' Grouped with unit, currency and tax basis kept separate. Missing component values withhold the group total.'};
}
export function queryTable(table: AnalysisTable, plan: AnalysisPlan): {table: AnalysisTable; gaps: string[]} {
  let rows=table.rows;const gaps:string[]=[];
  for(const f of plan.filters){
    if(f.field!=='search'&&!table.columns.some(c=>c.key===f.field)){gaps.push(table.title+': '+label(f.field)+' is not mapped; the requested filtered position is not established.');rows=[];break;}
    const unknown=rows.filter(r=>f.field!=='search'&&(r[f.field]===null||r[f.field]===undefined)).length;if(unknown)gaps.push(table.title+': '+unknown+' records lack '+label(f.field)+' and are excluded from the requested filter.');
    rows=rows.filter(r=>matchFilter(r,f));
  }
  if(plan.criticalOnly){
    if(table.columns.some(c=>c.key==='critical')){const unknown=rows.filter(r=>typeof r.critical!=='boolean').length;if(unknown)gaps.push(table.title+': '+unknown+' records have no established critical programme linkage and are excluded.');rows=rows.filter(r=>r.critical===true);}
    else {gaps.push(table.title+': critical programme linkage is not established.');rows=[];}
  }
  if(plan.issuesOnly){const fields=['issueCount','exceptionCount','headroomCalendarDays','forecastLate','overdueUndelivered','variancePercentagePoints','state','status'];
    if(!fields.some(f=>table.columns.some(c=>c.key===f))){gaps.push(table.title+': no defensible exception classification is available.');rows=[];}
    else rows=rows.filter(r=>Number(r.issueCount)>0||Number(r.exceptionCount)>0||(['procurement','long-lead'].includes(table.authorityId)?r.forecastLate===true||r.overdueUndelivered===true:typeof r.headroomCalendarDays==='number'&&r.headroomCalendarDays<0)||typeof r.variancePercentagePoints==='number'&&r.variancePercentagePoints<0||['blocked','conflicting','late','overdue','open','unknown'].includes(String(r.state??r.status)));}
  let result:AnalysisTable={...table,rows,excluded:table.excluded+table.rows.length-rows.length};
  for(const dimension of plan.groupBy)if(!table.columns.some(c=>c.key===dimension&&c.dimension))gaps.push(table.title+': grouping by '+label(dimension)+' is not established; the source rows retain their existing scope.');
  result=groupTable(result,plan.groupBy);
  let rank=plan.rankBy && result.columns.some(c=>c.key===plan.rankBy) ? plan.rankBy : null;
  if(rank&&result.columns.find(c=>c.key===rank)?.unit==='row currency'&&new Set(result.rows.map(r=>r.currency??'unknown')).size>1){gaps.push(table.title+': monetary ranking requires a single currency; no exchange rate is assumed. Filter by currency to establish Top N.');rank=null;}
  if(plan.rankBy&&!rank)gaps.push(table.title+': ranking by '+label(plan.rankBy)+' is not established. These are source rows, not a ranked risk assessment.');
  if(rank) result={...result,rows:[...result.rows].sort((a,b)=>{
    const x=a[rank],y=b[rank];if(x==null)return y==null?JSON.stringify(a).localeCompare(JSON.stringify(b)):1;if(y==null)return -1;
    const cmp=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y));return (plan.rankDirection==='asc'?cmp:-cmp)||JSON.stringify(a).localeCompare(JSON.stringify(b));
  })};
  result={...result,selection:{matching:result.rows.length,ranked:!!rank,requested:plan.limit,rankBy:rank,direction:plan.rankDirection}};
  if(plan.limit!==null&&rank)result={...result,rows:result.rows.slice(0,plan.limit),basis:result.basis+' Showing up to '+plan.limit+' of '+result.rows.length+' matching records.'};
  return {table:result,gaps};
}
export function chooseChart(table: AnalysisTable, dataDate:string|null): AnalysisChart|null {
  if(table.rows.length<1||table.rows.length>60)return null;
  const category=table.columns.find(c=>c.dimension && !['unit','currency','taxBasis','status','state'].includes(c.key))??table.columns.find(c=>c.type==='date');
  if(!category||category.type==='date'&&table.rows.length<2)return null;
  const measures=table.columns.filter(c=>c.type==='number'&&c.unit && c.key!=='recordCount' && table.rows.some(r=>typeof r[c.key]==='number'));
  const first=measures[0];if(!first)return null;
  for(const key of ['currency','unit'])if(new Set(table.rows.map(r=>r[key]).filter(v=>v!==null&&v!==undefined)).size>1)return null;
  const unit=first.unit==='row unit'?String(table.rows[0]?.unit??''):first.unit==='row currency'?String(table.rows[0]?.currency??''):first.unit;
  if(!unit)return null;
  const compatible=measures.filter(m=>m.unit===first.unit);const chain=['required','ordered','delivered','installed'];const quantityChain=compatible.filter(m=>chain.includes(m.key));const series=(quantityChain.length>=2?quantityChain:compatible).slice(0,4).map(m=>m.key);
  return {id:table.id+'-chart',title:table.title,type:category.type==='date'?'line':'bar',tableId:table.id,category:category.key,series,unit,basis:table.basis,population:table.population,dataDate};
}
export function columnsFor(rows: Record<string,Cell>[], overrides: Record<string,Partial<Column>>={}):Column[]{
  const keys=[...new Set(rows.flatMap(Object.keys))];
  return keys.map(key=>{const v=rows.find(r=>r[key]!==null)?.[key];return {key,label:label(key),type:typeof v==='number'?'number':typeof v==='boolean'?'boolean':/date|iso$/i.test(key)?'date':'text',unit:null,aggregate:'none',dimension:/^(reference|name|description|itemNumber|discipline|location|floor|zone|supplier|wbsId|status|state|unit|currency|taxBasis|section)$/.test(key),...overrides[key]};});
}
