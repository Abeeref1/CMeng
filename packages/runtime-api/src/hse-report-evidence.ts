import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PDFParse} from 'pdf-parse';
import {dateValue} from '../../truth-kernel/src';
import type {StoredEvidenceDocument,ProjectRuntimeState} from './project-state-types';
import {weeklyResourceCapacityEvidence} from './canonical-resource-evidence';

export interface HseReportSummary {
  producerVersion:'hse-summary-v1'; sourceHashSha256:string; periodEndIso:string|null;
  metrics:Record<string,number|null>; sourceRefs:string[]; diagnostics:string[];
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
  if(document.documentType!=='hse_report'||!['active','additive','candidate'].includes(document.basisState))return false;
  if(document.hseSummary?.producerVersion==='hse-summary-v1'&&document.hseSummary.sourceHashSha256===document.sourceHashSha256)return false;
  const bytes=readFileSync(document.storedPath);
  if(createHash('sha256').update(bytes).digest('hex')!==document.sourceHashSha256)throw new Error('HSE_SOURCE_HASH_MISMATCH');
  if(!/pdf/i.test(document.mediaType))return false;
  const parser=new PDFParse({data:bytes as any});
  try{const parsed=await parser.getText();document.hseSummary=parseHseSummary(parsed.text,document.sourceHashSha256,'evidence-document:'+document.documentId+':native-pdf-summary');return true;}finally{await parser.destroy();}
}
const cache=new WeakMap<ProjectRuntimeState,{version:number;date:string|null;value:ReturnType<typeof calculateHsePosition>}>();
export function hseReportPosition(state:ProjectRuntimeState,dataDateIso:string|null){
  const c=cache.get(state);if(c?.version===state.version&&c.date===dataDateIso)return c.value;
  const value=calculateHsePosition(state,dataDateIso);cache.set(state,{version:state.version,date:dataDateIso,value});return value;
}
function calculateHsePosition(state:ProjectRuntimeState,dataDateIso:string|null){
  const cutoff=dateValue(dataDateIso??'');
  const reports=state.evidenceDocuments.filter(d=>d.documentType==='hse_report'&&['active','additive'].includes(d.basisState)).map(d=>d.hseSummary).filter((x):x is HseReportSummary=>Boolean(x));
  const eligible=reports.filter(r=>cutoff&&r.periodEndIso&&r.periodEndIso<=cutoff).sort((a,b)=>b.periodEndIso!.localeCompare(a.periodEndIso!));
  const latest=eligible[0]??null;
  const samePeriod=eligible.filter(r=>r.periodEndIso===latest?.periodEndIso);
  const conflicting=samePeriod.some(r=>JSON.stringify(r.metrics)!==JSON.stringify(latest?.metrics));
  const metrics=conflicting?{}:latest?.metrics??{};
  const hours=metrics.manHours??null,lti=metrics.lostTimeInjuries??null,medical=metrics.medicalTreatmentCases??null;
  const recordable=lti!==null&&medical!==null?lti+medical:null;
  const rates=[200000,1000000].map(basisHours=>({basisHours,fromReportedCases:hours&&recordable!==null?recordable/hours*basisHours:null}));
  const supplied=metrics.trir??null;
  const unexplained=supplied!==null&&rates.every(r=>r.fromReportedCases!==null&&Math.abs(Number(r.fromReportedCases.toFixed(2))-supplied)>0.005);
  const weekly=weeklyResourceCapacityEvidence(state.evidenceDocuments,dataDateIso);
  const labor=weekly.points.filter(p=>p.resourceClass==='labor'&&p.unit==='labor_hour'&&p.weekStartIso&&cutoff&&p.weekStartIso<=cutoff&&p.actualApprovedUsage!==null);
  const approvedLaborHours=labor.length?labor.reduce((n,p)=>n+p.actualApprovedUsage!,0):null;
  return {state:conflicting?'conflicted':latest?'source_report':'not_established',periodEndIso:latest?.periodEndIso??null,metrics,sourceRefs:latest?.sourceRefs??[],
    scope:'Reported period totals; incident closure status and cumulative/monthly exposure basis are not inferred.',
    rates:{recordableCasesFromLtiAndMedical:recordable,suppliedTrir:supplied,comparisons:rates,basisEstablished:false},
    laborComparison:{reportedManHours:hours,approvedLaborHoursToDataDate:approvedLaborHours,resourceWeekCount:labor.length,ratio:hours!==null&&approvedLaborHours?hours/approvedLaborHours:null,basis:'Report exposure and approved labor usage have different stated populations; reconcile coverage and period before asserting a same-basis contradiction.'},
    futureReportCount:reports.filter(r=>cutoff&&r.periodEndIso&&r.periodEndIso>cutoff).length,
    diagnostics:[...(latest?.diagnostics??[]),...(conflicting?['HSE_REPORT_SAME_PERIOD_CONFLICT']:[]),...(unexplained?['HSE_TRIR_RECONCILIATION_REQUIRED']:[])],
  };
}
