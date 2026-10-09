import {createHash} from 'node:crypto';
import type {AnalysisResult, AnalysisTable, Cell, CoverageManifest, EvidenceCoverage, Filter} from './types';
import {matchFilter,normalized} from './primitives';

export interface ReferencePage {filename:string;page:number;text:string;fileId?:string;hash?:string}
export interface EvidenceItem {id:string;kind:'metric'|'finding'|'row'|'aggregate'|'basis'|'gap'|'passage';authorityId:string;mandatory:boolean;traceIds:string[];data:unknown}
export interface EvidencePackage {items:EvidenceItem[];coverage:CoverageManifest;tables:{id:string;authorityId:string;fields:string[];rows:number}[]}
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const stableRow=(row:Record<string,Cell>)=>JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))));

/** Explicit domain rules identify exposure. No universal weighted materiality score. */
export function materialReasons(row:Record<string,Cell>,authority:string){
  const reasons:string[]=[];
  if(row.critical===true)reasons.push('critical programme linkage');
  if(typeof row.totalFloatHours==='number'&&row.totalFloatHours<0)reasons.push('negative float');
  if(['procurement','long-lead'].includes(authority)?row.forecastLate===true||row.overdueUndelivered===true:typeof row.headroomCalendarDays==='number'&&row.headroomCalendarDays<0)reasons.push('negative procurement headroom');
  if(Number(row.issueCount)>0||Number(row.exceptionCount)>0)reasons.push('source exceptions');
  if(['state','status','displayState','readinessState','currentStatus'].some(k=>/^(blocked|conflicting|conflicted|late|overdue|failed|unavailable|unknown)$/i.test(String(row[k]??''))))reasons.push('exception or unresolved state');
  for(const key of ['variancePercentagePoints','scheduleVariance','costVariance'])if(typeof row[key]==='number'&&Number(row[key])<0)reasons.push('adverse '+key);
  if(['materials','procurement','long-lead'].includes(authority)){
    for(const [left,right]of[['delivered','ordered'],['accepted','delivered'],['installed','accepted'],['installed','required']])if(typeof row[left!]==='number'&&typeof row[right!]==='number'&&Number(row[left!])>Number(row[right!]))reasons.push(left+' exceeds '+right);
    if(typeof row.deliveryCoveragePercent==='number'&&row.deliveryCoveragePercent<100)reasons.push('incomplete delivery coverage');
  }
  if(['commercial','payments','financial-claims','variations'].includes(authority))for(const key of ['certifiedUnpaidAmount','pendingVariationAmount','claimedAmount','exposureAmount'])if(typeof row[key]==='number'&&Number(row[key])>0)reasons.push('commercial exposure: '+key);
  if(authority==='milestones'&&(row.late===true||typeof row.varianceDays==='number'&&row.varianceDays>0))reasons.push('late milestone');
  return reasons;
}
const ranks:Record<string,{field:string;direction:1|-1}>={boq:{field:'amount',direction:-1},activities:{field:'totalFloatHours',direction:1},float:{field:'totalFloatHours',direction:1},risks:{field:'score',direction:-1},materials:{field:'headroomCalendarDays',direction:1},procurement:{field:'headroomCalendarDays',direction:1},'long-lead':{field:'headroomCalendarDays',direction:1},progress:{field:'variancePercentagePoints',direction:1},payments:{field:'certifiedUnpaidAmount',direction:-1}};
function rankedSupport(table:AnalysisTable){
  const rule=ranks[table.authorityId];if(!rule||!table.columns.some(c=>c.key===rule.field))return [];
  return table.rows.filter(r=>typeof r[rule.field]==='number'&&(!['procurement','long-lead'].includes(table.authorityId)||r.deliveredAtDataDate!==true&&r.deliveredStatusOnly!==true)).sort((a,b)=>rule.direction*(Number(a[rule.field])-Number(b[rule.field]))||stableRow(a).localeCompare(stableRow(b))).slice(0,20);
}
/** Whole-population statistics retain missingness, units and currencies. Percentages are never summed. */
function aggregateRows(table:AnalysisTable,rows:Record<string,Cell>[]){
  const dimensions=['unit','currency','taxBasis','state','status','critical'].filter(k=>table.columns.some(c=>c.key===k));
  const groups=new Map<string,{dimensions:Record<string,Cell>;records:number;measures:Record<string,{known:number;missing:number;min:number|null;max:number|null;sum:number|null}>}>();
  for(const row of rows){const dims=Object.fromEntries(dimensions.map(k=>[k,row[k]??null])),key=JSON.stringify(dims);let group=groups.get(key);if(!group){group={dimensions:dims,records:0,measures:{}};groups.set(key,group);}group.records++;
    for(const col of table.columns.filter(c=>c.type==='number')){const m=group.measures[col.key]??={known:0,missing:0,min:null,max:null,sum:col.aggregate==='sum'?0:null};const v=row[col.key];if(typeof v!=='number'){m.missing++;m.sum=null;continue;}m.known++;m.min=m.min===null?v:Math.min(m.min,v);m.max=m.max===null?v:Math.max(m.max,v);if(m.sum!==null)m.sum+=v;}
  }
  return [...groups.values()].sort((a,b)=>JSON.stringify(a.dimensions).localeCompare(JSON.stringify(b.dimensions)));
}
function coverageEntry(id:string,authorityId:string,source:number,applicable:number):EvidenceCoverage{return {id,authorityId,sourcePopulation:source,applicablePopulation:applicable,relevantPopulation:applicable,directlyRepresented:0,aggregated:0,supportingOmitted:0,mandatoryPopulation:0,mandatoryRepresented:0,omissionBasis:'No material evidence omitted. Ordinary rows may be represented by exact local aggregates.',state:'complete'};}

const stop=new Set('the a an and or of to in on for is are was were our this that with what why how did does explain review attached document report please'.split(' '));
const terms=(s:string)=>[...new Set(normalized(s).match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu)??[])].filter(t=>t.length>1&&!stop.has(t));
export function retrievePassages(pages:ReferencePage[],question:string,limit:number){
  const query=terms(question),explicit=[...question.matchAll(/\bpage\s+(\d+)\b/gi)].map(m=>Number(m[1]));
  const candidates:({id:string;filename:string;page:number;text:string;fileId:string|null;hash:string|null;start:number;end:number;score:number})[]=[];
  for(const page of pages){
    for(let start=0;start<page.text.length;start+=1050){const text=page.text.slice(start,start+1200),words=new Set(terms(text));let score=query.reduce((n,t)=>n+(words.has(t)?1:0),0);if(explicit.includes(page.page))score+=query.length+2;
      if(!score)continue;candidates.push({id:'passage:'+hash([page.fileId??page.filename,page.hash,page.page,start,text]).slice(0,24),filename:page.filename,page:page.page,text,fileId:page.fileId??null,hash:page.hash??null,start,end:Math.min(start+1200,page.text.length),score});
    }
  }
  candidates.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  return {passages:candidates.slice(0,limit),matchingPassages:candidates.length,matchingPages:new Set(candidates.map(p=>p.filename+':'+p.page)).size,totalPages:pages.length};
}

export function selectEvidence(result:AnalysisResult,references:ReferencePage[]=[],passageLimit=12):EvidencePackage{
  const items:EvidenceItem[]=[],entries:EvidenceCoverage[]=[];
  for(const section of result.sections){
    // Keep the factual basis and evidence qualifications separate from interpretation.
    items.push({id:'basis:'+section.authorityId,kind:'basis',authorityId:section.authorityId,mandatory:true,traceIds:[],data:{title:section.title,state:section.state,basis:section.explanation}});
    for(const t of section.traces)items.push({id:'trace:'+t.id,kind:'basis',authorityId:section.authorityId,mandatory:true,traceIds:[t.id],data:{id:t.id,authorityId:t.authorityId,projectId:t.projectId,module:t.module,path:t.path,dataDate:t.dataDate,basis:t.basis,state:t.state,exclusions:t.exclusions,sourceReferenceCount:t.sourceRefs.length,sourceReferenceDigest:hash(t.sourceRefs)}});
    for(const metric of section.metrics)items.push({id:metric.id,kind:'metric',authorityId:section.authorityId,mandatory:true,traceIds:[metric.traceId],data:metric});
    const fc=coverageEntry(section.authorityId+':findings',section.authorityId,section.findings.length,section.findings.length);
    for(const finding of section.findings)items.push({id:finding.id,kind:'finding',authorityId:section.authorityId,mandatory:true,traceIds:finding.traceIds,data:finding});
    fc.directlyRepresented=fc.mandatoryPopulation=fc.mandatoryRepresented=section.findings.length;entries.push(fc);
    for(const table of section.tables){
      if(section.authorityId==='reference-files')continue; // Pages are indexed and retrieved below, not sampled from the excerpt table.
      const c=coverageEntry(table.id,section.authorityId,table.population,Math.max(0,table.population-table.excluded));
      c.relevantPopulation=table.selection?.matching??table.rows.length;c.state=table.state==='established'?'complete':table.state==='unavailable'?'unavailable':'partial';
      const explicit=!!table.selection?.ranked&&table.selection.requested!==null;
      const support=new Set(rankedSupport(table));const ordinary:Record<string,Cell>[]=[];
      for(const row of table.rows){const reasons=materialReasons(row,section.authorityId),mandatory=explicit||reasons.length>0;
        if(mandatory)c.mandatoryPopulation++;
        if(mandatory||support.has(row)){items.push({id:'row:'+table.id+':'+hash(stableRow(row)).slice(0,24),kind:'row',authorityId:section.authorityId,mandatory,traceIds:[table.traceId],data:{tableId:table.id,reasons:explicit?['explicit requested ranking',...reasons]:reasons,row}});c.directlyRepresented++;if(mandatory)c.mandatoryRepresented++;}
        else ordinary.push(row);
      }
      const groups=aggregateRows(table,ordinary);for(const group of groups)items.push({id:'aggregate:'+table.id+':'+hash(group).slice(0,24),kind:'aggregate',authorityId:section.authorityId,mandatory:true,traceIds:[table.traceId],data:{tableId:table.id,basis:table.basis,group}});
      c.aggregated=ordinary.length;c.supportingOmitted=Math.max(0,c.relevantPopulation-table.rows.length);
      if(table.selection?.requested!==null&&table.selection)c.omissionBasis='Explicit query selected '+table.rows.length+' of '+c.relevantPopulation+' matching records; rank '+table.selection.rankBy+' '+table.selection.direction+'. All requested rows remain represented.';
      entries.push(c);
    }
  }
  result.unresolved.forEach(g=>items.push({id:'gap:'+hash(g).slice(0,24),kind:'gap',authorityId:'evidence',mandatory:true,traceIds:[],data:{qualification:g}}));
  if(references.length){const selected=retrievePassages(references,result.plan.objective,passageLimit),c=coverageEntry('reference-passages','reference-files',selected.totalPages,selected.totalPages);
    c.relevantPopulation=selected.matchingPages;c.directlyRepresented=new Set(selected.passages.map(p=>p.filename+':'+p.page)).size;c.supportingOmitted=Math.max(0,c.relevantPopulation-c.directlyRepresented);c.state='partial';
    c.omissionBasis='All extracted pages searched locally; relevance-ranked passages are reference_only. Passage selection does not establish complete document review. '+selected.passages.length+' of '+selected.matchingPassages+' matching passages represented. OCR/unreadable pages retain their reading qualifications.';entries.push(c);
    for(const passage of selected.passages)items.push({id:passage.id,kind:'passage',authorityId:'reference-files',mandatory:true,traceIds:[],data:{...passage,state:'reference_only'}});
    if(!selected.passages.length)items.push({id:'reference-no-match',kind:'gap',authorityId:'reference-files',mandatory:true,traceIds:[],data:{qualification:'No matching passage was established. Use bounded document retrieval with more specific terms; absence of a match is not evidence of absence.'}});
  }
  items.sort((a,b)=>a.authorityId.localeCompare(b.authorityId)||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
  return {items,coverage:{version:1,projectId:result.scope.projectId,projectVersion:result.scope.projectVersion,dataDate:result.scope.dataDate,entries,materialComplete:entries.every(c=>c.mandatoryPopulation===c.mandatoryRepresented),sourceComplete:result.sections.every(s=>s.state==='established'&&s.metrics.every(m=>m.value!==null&&m.state==='established')&&s.tables.every(t=>t.state==='established'))&&!result.unresolved.length&&!references.length,evidenceHash:hash(items),representedToModel:false},tables:result.sections.flatMap(s=>s.tables.map(t=>({id:t.id,authorityId:s.authorityId,fields:t.columns.map(c=>c.key),rows:t.rows.length})))};
}

export interface EvidenceRequest {projectId:string;projectVersion:number;dataDate:string|null;kind:'rows'|'passages'|'trace';target:string;query:string;filters:Filter[];offset:number;limit:number}
/** Read-only access to this immutable AnalysisResult and these authorized attachments only. */
export function retrieveEvidence(result:AnalysisResult,pages:ReferencePage[],request:EvidenceRequest,maxRecords:number){
  if(request.projectId!==result.scope.projectId||request.projectVersion!==result.scope.projectVersion||request.dataDate!==result.scope.dataDate)throw new Error('RETRIEVAL_SCOPE_INVALID');
  if(!Number.isInteger(request.limit)||request.limit<1||request.limit>maxRecords||!Number.isInteger(request.offset)||request.offset<0)throw new Error('RETRIEVAL_LIMIT_INVALID');
  if(typeof request.query!=='string'||request.query.length>2000||!Array.isArray(request.filters)||request.filters.length>8)throw new Error('RETRIEVAL_QUERY_INVALID');
  if(request.kind==='passages'){const allowed=request.target?pages.filter(p=>p.fileId===request.target||p.filename===request.target):pages;if(request.target&&!allowed.length)throw new Error('RETRIEVAL_SOURCE_INVALID');const found=retrievePassages(allowed,request.query,request.limit+request.offset);return {kind:'reference_only',rows:found.passages.slice(request.offset),matching:found.matchingPassages,scope:result.scope};}
  if(request.kind==='trace'){const trace=result.sections.flatMap(s=>s.traces).find(t=>t.id===request.target);if(!trace)throw new Error('RETRIEVAL_TRACE_INVALID');return {rows:trace.sourceRefs.slice(request.offset,request.offset+request.limit),matching:trace.sourceRefs.length,traceId:trace.id};}
  if(request.kind!=='rows')throw new Error('RETRIEVAL_KIND_INVALID');
  const table=result.sections.flatMap(s=>s.tables).find(t=>t.id===request.target);if(!table)throw new Error('RETRIEVAL_TABLE_INVALID');
  for(const f of request.filters)if(!table.columns.some(c=>c.key===f.field)||!['eq','contains','lt','lte','gt','gte','between'].includes(f.operator)||!['string','number','boolean'].includes(typeof f.value)||typeof f.value==='number'&&!Number.isFinite(f.value))throw new Error('RETRIEVAL_FILTER_INVALID');
  const rows=table.rows.filter(r=>request.filters.every(f=>matchFilter(r,f))&&(!request.query||Object.values(r).some(v=>normalized(v).includes(normalized(request.query))))).sort((a,b)=>stableRow(a).localeCompare(stableRow(b)));
  return {tableId:table.id,traceId:table.traceId,basis:table.basis,matching:rows.length,rows:rows.slice(request.offset,request.offset+request.limit)};
}
