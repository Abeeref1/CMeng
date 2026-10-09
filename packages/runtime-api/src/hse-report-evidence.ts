import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dateValue,sourceTables,cell,numberValue,canonicalHeader} from '../../truth-kernel/src';
import type {StoredEvidenceDocument,ProjectRuntimeState} from './project-state-types';
import {weeklyResourceCapacityEvidence} from './canonical-resource-evidence';

export interface HseReportSummary {
  producerVersion:'hse-summary-v1'|'hse-summary-v2'|'hse-summary-v3'; sourceHashSha256:string; periodEndIso:string|null;
  metrics:Record<string,number|null>; sourceRefs:string[]; diagnostics:string[]; periods?:HseReportSummary[]; sourceTableRead?:boolean;
  metricBasis?:'cumulative'|'reported_period'; monthlyMetrics?:Record<string,number|null>; rateBasisHours?:{ltifr:number;trir:number};
}
/** Read a native PDF statistics table only after its column sequence is identified.
 * Monthly incidents are accumulated only when the exposure series starts at zero.
 * A mid-series extract retains its reported rates without inventing prior cases. */
export function parseHseStatisticsTable(text:string,hash:string,sourceRef:string):HseReportSummary|null {
  const compact=text.replace(/\s+/g,' ');
  if(!/Month Exposure (?:hrs|hours) \(month\) Exposure (?:hrs|hours) \(cumulative\) LTI MT\s*C RW\s*C First aid Near miss LTIFR \(cum\) TRIR \(cum\)/i.test(compact))return null;
  const monthNames=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const matches=[...text.matchAll(/^\s*([A-Za-z]{3,9})\s+(20\d{2})\s+([\d,.]+)\s+([\d,.]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s*$/gm)];
  if(!matches.length)return null;
  const cases={lostTimeInjuries:0,medicalTreatmentCases:0,restrictedWorkCases:0,firstAidCases:0,nearMisses:0};
  let previousHours=0,previousPeriod='',complete=true;
  const periods:HseReportSummary[]=[];
  const trirBasis=/TRIR\s*=.{0,120}?200,?000/i.test(compact)?200000:/TRIR\s*=.{0,120}?1,?000,?000/i.test(compact)?1000000:null;
  const ltifrBasis=/LTIFR\s*=.{0,80}?1,?000,?000/i.test(compact)?1000000:null;
  for(const match of matches){
    const month=monthNames.indexOf(match[1]!.slice(0,3).toLowerCase());if(month<0)continue;
    const periodEndIso=new Date(Date.UTC(Number(match[2]),month+1,0)).toISOString().slice(0,10);
    const values=match.slice(3).map(v=>Number(v.replaceAll(',','')));
    if(values.some(v=>!Number.isFinite(v)||v<0))continue;
    const [hours,cumulativeHours,lti,medical,restricted,firstAid,nearMisses,ltifr,trir]=values as [number,number,number,number,number,number,number,number,number];
    const monthlyMetrics={manHours:hours,lostTimeInjuries:lti,medicalTreatmentCases:medical,restrictedWorkCases:restricted,firstAidCases:firstAid,nearMisses};
    if(previousPeriod&&periodEndIso<=previousPeriod||Math.abs(previousHours+hours-cumulativeHours)>0.01)complete=false;
    for(const key of Object.keys(cases) as (keyof typeof cases)[])cases[key]+=monthlyMetrics[key];
    const metrics:Record<string,number|null>={manHours:cumulativeHours,ltifr,trir};
    for(const key of Object.keys(cases) as (keyof typeof cases)[])metrics[key]=complete?cases[key]:null;
    periods.push({producerVersion:'hse-summary-v3',sourceHashSha256:hash,periodEndIso,metrics,monthlyMetrics,metricBasis:'cumulative',
      ...(trirBasis&&ltifrBasis?{rateBasisHours:{trir:trirBasis,ltifr:ltifrBasis}}:{}),
      sourceRefs:[sourceRef+':month:'+periodEndIso.slice(0,7)],sourceTableRead:true,diagnostics:complete?[]:['HSE_CUMULATIVE_CASE_POPULATION_INCOMPLETE']});
    previousHours=cumulativeHours;previousPeriod=periodEndIso;
  }
  const latest=periods.at(-1);return latest?{...latest,periods}:null;
}
export function parseHseSummary(text:string,hash:string,sourceRef:string):HseReportSummary {
  const metrics:Record<string,number|null>={};const diagnostics:string[]=[];
  const patterns:Record<string,string>={manHours:'(?:total\\s+)?man[ -]?hours',lostTimeInjuries:'lost[ -]time\\s+injur(?:y|ies)',medicalTreatmentCases:'medical\\s+treatment\\s+cases',firstAidCases:'first\\s+aid\\s+cases',nearMisses:'near\\s+misses',ltifr:'LTIFR',trir:'TRIR'};
  for(const [key,pattern] of Object.entries(patterns)){
    const values=[...text.matchAll(new RegExp('\\b'+pattern+'\\s*[:|]?\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)\\b','gi'))].map(m=>Number(m[1]!.replaceAll(',','')));
    const unique=[...new Set(values)];metrics[key]=unique.length===1?unique[0]!:null;
    if(unique.length>1)diagnostics.push('HSE_SUMMARY_VALUE_CONFLICT:'+key);
  }
  const month=text.match(/Reporting\s+Month\s*[:|]?\s*([A-Za-z]+)\s+(20\d{2})/i);
  const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const m=month?months.indexOf(month[1]!.toLowerCase()):-1;
  const periodEndIso=month&&m>=0?new Date(Date.UTC(Number(month[2]),m+1,0)).toISOString().slice(0,10):dateValue(text.match(/(?:reporting period end|report date|as of)\s*[:|]?\s*(20\d{2}-\d{2}-\d{2})/i)?.[1]??'');
  return {producerVersion:'hse-summary-v1',sourceHashSha256:hash,periodEndIso,metrics,sourceRefs:[sourceRef],diagnostics};
}
export async function refreshHseSummary(document:StoredEvidenceDocument):Promise<boolean>{
  if(!['active','additive','candidate'].includes(document.basisState))return false;
  const tabular=/csv|spreadsheetml/.test(document.mediaType);
  if(!tabular&&document.documentType!=='hse_report')return false;
  if(document.hseSummary?.producerVersion==='hse-summary-v3'&&document.hseSummary.sourceHashSha256===document.sourceHashSha256)return false;
  const bytes=readFileSync(document.storedPath);
  if(createHash('sha256').update(bytes).digest('hex')!==document.sourceHashSha256)throw new Error('HSE_SOURCE_HASH_MISMATCH');
  if(tabular){
    const tables=sourceTables([document],[]).filter(table=>table.document.documentType==='hse_report');
    if(!tables.length)return false;
    const names:Record<string,string>={'man hours':'manHours','lost time injuries':'lostTimeInjuries','medical treatment cases':'medicalTreatmentCases','first aid cases':'firstAidCases','near misses':'nearMisses',ltifr:'ltifr',trir:'trir'};
    const periods=new Map<string,{seen:Map<string,Set<number>>;sourceRefs:string[]}>();
    for(const table of tables)for(const row of table.rows){
      const date=dateValue(cell(row,'report date','period end','as of'))??'';
      const period=periods.get(date)??{seen:new Map<string,Set<number>>(),sourceRefs:[]};periods.set(date,period);
      for(const [header,key] of Object.entries(names)){
        const value=numberValue(canonicalHeader(cell(row,'metric'))===header?cell(row,'value'):cell(row,header));
        if(value!==null){const values=period.seen.get(key)??new Set<number>();values.add(value);period.seen.set(key,values);period.sourceRefs.push('evidence-document:'+document.documentId+':'+row.receipt.locator);}
      }
    }
    const summaries:HseReportSummary[]=[...periods].map(([date,period])=>{
      const metrics:Record<string,number|null>={},diagnostics:string[]=[];
      for(const key of Object.values(names)){const values=[...(period.seen.get(key)??[])];metrics[key]=values.length===1?values[0]!:null;if(values.length>1)diagnostics.push('HSE_SUMMARY_VALUE_CONFLICT:'+key);}
      return {producerVersion:'hse-summary-v2',sourceHashSha256:document.sourceHashSha256,periodEndIso:date||null,metrics,sourceRefs:[...new Set(period.sourceRefs)],sourceTableRead:tables.length>0,diagnostics:date?diagnostics:[...diagnostics,'HSE_REPORT_PERIOD_UNRESOLVED']};
    });
    const latest=summaries.sort((a,b)=>(b.periodEndIso??'').localeCompare(a.periodEndIso??''))[0];
    document.hseSummary={producerVersion:'hse-summary-v2',sourceHashSha256:document.sourceHashSha256,periodEndIso:latest?.periodEndIso??null,metrics:latest?.metrics??{},sourceRefs:latest?.sourceRefs??[],diagnostics:latest?.diagnostics??[],periods:summaries,sourceTableRead:tables.length>0};
    return true;
  }
  if(!/pdf/i.test(document.mediaType))return false;
  const parser=new (await import('pdf-parse')).PDFParse({data:bytes as any});
  try{const parsed=await parser.getText();const ref='evidence-document:'+document.documentId+':native-pdf-summary';document.hseSummary={...(parseHseStatisticsTable(parsed.text,document.sourceHashSha256,ref)??parseHseSummary(parsed.text,document.sourceHashSha256,ref)),producerVersion:'hse-summary-v3',sourceTableRead:parsed.pages.every(p=>p.text.trim().length>0)};return true;}finally{await parser.destroy();}
}
const cache=new WeakMap<ProjectRuntimeState,{version:number;date:string|null;value:ReturnType<typeof calculateHsePosition>}>();
export function hseReportPosition(state:ProjectRuntimeState,dataDateIso:string|null){
  const c=cache.get(state);if(c?.version===state.version&&c.date===dataDateIso)return c.value;
  const value=calculateHsePosition(state,dataDateIso);cache.set(state,{version:state.version,date:dataDateIso,value});return value;
}
function calculateHsePosition(state:ProjectRuntimeState,dataDateIso:string|null){
  const cutoff=dateValue(dataDateIso??'');
  const reports=state.evidenceDocuments.filter(d=>(d.hseSummary||d.documentType==='hse_report')&&['active','additive','candidate'].includes(d.basisState)).flatMap(d=>{
    const read=d.fullTextRead?.sourceHashSha256===d.sourceHashSha256?d.fullTextRead:null;
    const unread=read&&(!read.result.complete||read.result.failedPages>0||read.result.unresolvedPages>0);
    const refreshed=read&&!unread?parseHseStatisticsTable(read.result.pages.map(p=>p.text).join('\n'),d.sourceHashSha256,'evidence-document:'+d.documentId+':native-pdf-summary'):null;
    const summary=refreshed??d.hseSummary;if(!summary)return [];
    return (summary.periods??[summary]).map(r=>({...r,sourceTableRead:unread?false:r.sourceTableRead}));
  });
  const eligible=reports.filter(r=>cutoff&&r.periodEndIso&&r.periodEndIso<=cutoff).sort((a,b)=>b.periodEndIso!.localeCompare(a.periodEndIso!));
  const latest=eligible[0]??null;
  const samePeriod=eligible.filter(r=>r.periodEndIso===latest?.periodEndIso);
  const conflicting=samePeriod.some(r=>JSON.stringify(r.metrics)!==JSON.stringify(latest?.metrics));
  const metrics:Record<string,number|null>={...(conflicting?{}:latest?.metrics??{})};
  const hours=metrics.manHours??null,lti=metrics.lostTimeInjuries??null,medical=metrics.medicalTreatmentCases??null;
  const restricted=metrics.restrictedWorkCases??null;
  const recordable=lti!==null&&medical!==null?lti+medical+(restricted??0):null;
  const sourceTableUnread=latest?.sourceTableRead===false;
  const countsConfirmed=!sourceTableUnread&&hours!==null&&hours>0&&recordable!==null;
  const reportedRates={trir:metrics.trir??null,ltifr:metrics.ltifr??null};
  const rateReason=sourceTableUnread?'Rate unconfirmed, source table unread':!countsConfirmed?'Rate unconfirmed, incident counts or exposure hours unresolved':null;
  if(!countsConfirmed){metrics.trir=null;metrics.ltifr=null;}
  const rates=[200000,1000000].map(basisHours=>({basisHours,fromReportedCases:countsConfirmed&&hours&&recordable!==null?recordable/hours*basisHours:null}));
  const supplied=metrics.trir??null;
  const unexplained=supplied!==null&&rates.every(r=>r.fromReportedCases!==null&&Math.abs(Number(r.fromReportedCases.toFixed(2))-supplied)>0.005);
  const weekly=weeklyResourceCapacityEvidence(state.evidenceDocuments,dataDateIso);
  const labor=weekly.points.filter(p=>p.resourceClass==='labor'&&p.unit==='labor_hour'&&p.weekStartIso&&cutoff&&p.weekStartIso<=cutoff&&p.actualApprovedUsage!==null);
  const approvedLaborHours=labor.length?labor.reduce((n,p)=>n+p.actualApprovedUsage!,0):null;
  return {state:conflicting?'conflicted':latest?'source_report':'not_established',periodEndIso:latest?.periodEndIso??null,metrics,sourceRefs:latest?.sourceRefs??[],
    scope:latest?.metricBasis==='cumulative'?'Cumulative exposure and incidents through the reported month; monthly rows retained separately.':'Reported period totals; incident closure status and cumulative/monthly exposure basis are not inferred.',
    monthlyMetrics:latest?.monthlyMetrics??null,periods:eligible,metricBasis:latest?.metricBasis??'reported_period',
    rates:{state:countsConfirmed?'counts_available':'unresolved',reason:rateReason,reportedRates,recordableCasesFromLtiAndMedical:countsConfirmed?recordable:null,restrictedWorkCases:restricted,suppliedTrir:supplied,comparisons:rates,basisEstablished:!!latest?.rateBasisHours,sourceBasisHours:latest?.rateBasisHours??null,
      calculatedTrir:countsConfirmed&&hours&&latest?.rateBasisHours?recordable!/hours*latest.rateBasisHours.trir:null,
      calculatedLtifr:countsConfirmed&&hours&&latest?.rateBasisHours?lti!/hours*latest.rateBasisHours.ltifr:null},
    laborComparison:{reportedManHours:hours,approvedLaborHoursToDataDate:approvedLaborHours,resourceWeekCount:labor.length,ratio:hours!==null&&approvedLaborHours?hours/approvedLaborHours:null,basis:'Report exposure and approved labor usage have different stated populations; reconcile coverage and period before asserting a same-basis contradiction.'},
    futureReportCount:reports.filter(r=>cutoff&&r.periodEndIso&&r.periodEndIso>cutoff).length,
    diagnostics:[...(latest?.diagnostics??[]),...(conflicting?['HSE_REPORT_SAME_PERIOD_CONFLICT']:[]),...(unexplained?['HSE_TRIR_RECONCILIATION_REQUIRED']:[])],
  };
}
