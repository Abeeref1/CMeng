import type {ProjectRuntimeState} from './project-state-types';
import {commercialPositionForState} from './commercial-runtime';
import {COMPLETION_DATE_TOKEN,explicitDate,namesSectionScope,SECTION_SCOPE_FOLLOWS} from './contract-completion';
import {contractSourceAnalysis} from './contract-source-analysis';

type Metric<T>={value:T|null};
export interface ContractTimeDates{
  contractualCompletionIso:string|null;
  extendedCompletionIso:string|null;
  awardedEotDays:number|null;
  /** The date lateness and delay damages are measured against: contract plus
   * awarded EOT; the contract date only when no EOT is awarded; unknown when an
   * award exists but the extended date is not established. */
  governingCompletionIso:string|null;
}

/** F33 / F34: the one governing-date rule, used for the Works and for every
 * section: the extended date when established; the contract date only when no
 * EOT is awarded; unknown when an award exists but the extended date is not
 * established. */
export function governingCompletionFrom(contractualIso:string|null,awardedEotDays:number|null,extendedIso:string|null):string|null{
  return extendedIso??(awardedEotDays!==null&&awardedEotDays>0?null:contractualIso);
}

/** F33: the one shared reader of the contract time basis (canonical contract
 * completion plus approved EOT) used by every page, chart and calculation. */
export function contractTimeDatesFrom(time:{contractualCompletion:Metric<string>;approvedEotDays:Metric<number>;officialAdjustedCompletion:Metric<string>}):ContractTimeDates{
  const contractual=time.contractualCompletion.value,extended=time.officialAdjustedCompletion.value,award=time.approvedEotDays.value;
  return {contractualCompletionIso:contractual,extendedCompletionIso:extended,awardedEotDays:award,
    governingCompletionIso:governingCompletionFrom(contractual,award,extended)};
}

export function contractTimeDates(state:ProjectRuntimeState):ContractTimeDates{
  return contractTimeDatesFrom(commercialPositionForState(state).timeExposure);
}

// ---------------------------------------------------------------------------
// F34 (round 12): a Time for Completion stated as a period.
// Under FIDIC-type contracts the Time for Completion of the Works or of a
// Section is a period counted from the Commencement Date. When the period and
// the Commencement Date are both stated, the completion date is Commencement
// Date + the period on the contract's stated day basis, and the basis is
// labelled. Otherwise the date stays unknown with the reason.
// ---------------------------------------------------------------------------

export type StatedPeriodUnit='days'|'weeks'|'months'|'years';
export interface StatedPeriod{
  amount:number;unit:StatedPeriodUnit;
  /** 'calendar' or 'working' when the period itself says so; null for plain "days". */
  dayKind:'calendar'|'working'|null;
  /** 'commencement': counted from the Commencement Date as stated; 'unstated':
   * no start is named (a Time for Completion is counted from the Commencement
   * Date); 'other': counted from another event (never computed). */
  anchor:'commencement'|'unstated'|'other';
  text:string;
}
export interface StatedTimeForCompletion extends StatedPeriod {documentId:string;locator:string;sourceRef:string;sourceAnalytical:boolean}

/** One period statement: "540 days", "540 calendar days from the Commencement
 * Date", "12 months", "90 days after the Taking-Over of Section 1". */
export function readStatedPeriod(raw:string):StatedPeriod|null{
  const match=/^\s*(?:shall\s+be\s+|is\s+|will\s+be\s+)?(?:a\s+period\s+of\s+|within\s+)?(\d{1,4})(?:\s*\([^)]*\))?\s*(calendar\s+|working\s+)?(days?|weeks?|months?|years?)\b([^\n;]*)/i.exec(raw);
  if(!match)return null;
  const amount=Number(match[1]);
  if(!Number.isInteger(amount)||amount<=0)return null;
  const unit=(match[3]!.toLowerCase().replace(/s$/,'')+'s') as StatedPeriodUnit;
  const dayKind=match[2]?(/working/i.test(match[2])?'working' as const:'calendar' as const):null;
  const rest=match[4]!.trim().replace(/^\([^)]*\)\s*/,'');
  const anchor=/^(?:(?:counted|calculated|reckoned)\s+)?(?:from|after|following|of)\s+(?:the\s+)?(?:Commencement\s+Date|date\s+of\s+commencement)\b/i.test(rest)?'commencement' as const
    :/^(?:(?:counted|calculated|reckoned)\s+)?(?:from|after|following|since|before|of)\b/i.test(rest)?'other' as const:'unstated' as const;
  return {amount,unit,dayKind,anchor,text:(match[0].replace(/^\s*(?:shall\s+be\s+|is\s+|will\s+be\s+)/i,'')).trim().replace(/[.,]+$/,'')};
}

type ContractResult={sections:Array<{text:string;heading?:string|null;startPage?:number|null;sectionKey?:string;sourceMode?:string}>;pdf?:{pages:Array<{method?:string;text:string;pageNumber?:number}>}|null|undefined};
/** The readable text of one contract document: parsed sections, then the
 * native PDF pages. A parsed heading is not read as text (the parser can cut a
 * clause number such as "Section 1" off its first line). The locator names the
 * source file and page. */
function contractFragments(result:ContractResult,sourceName='Contract'){
  const sections=(result.sections??[]).map(section=>({text:section.text,
    locator:sourceName+', '+(section.startPage?'page '+section.startPage:section.heading?.trim()||section.sectionKey||'contract text'),
    ref:section.startPage?'page:'+section.startPage:(section.sectionKey??'contract')}));
  const pages=(result.pdf?.pages??[]).filter(page=>page.method==='native').map(page=>({text:page.text,locator:sourceName+', page '+(page.pageNumber??1),ref:'page:'+(page.pageNumber??1)}));
  return [...sections,...pages];
}
const samePeriod=(a:StatedPeriod,b:StatedPeriod)=>a.amount===b.amount&&a.unit===b.unit&&a.dayKind===b.dayKind&&a.anchor===b.anchor;
/** Different statements of the same period in one document are one period. */
function uniquePeriods(rows:StatedTimeForCompletion[]){
  const unique:StatedTimeForCompletion[]=[];
  for(const row of rows)if(!unique.some(other=>samePeriod(other,row)))unique.push(row);
  return unique;
}
function statedPeriodsIn(result:ContractResult,documentId:string,sourceAnalytical:boolean,sourceName:string,pattern:()=>RegExp,keep:(match:RegExpMatchArray)=>string|null){
  const rows:StatedTimeForCompletion[]=[];
  for(const fragment of contractFragments(result,sourceName))for(const match of fragment.text.matchAll(pattern())){
    const raw=keep(match);if(raw===null)continue;
    const period=readStatedPeriod(raw);
    if(period)rows.push({...period,documentId,locator:fragment.locator,sourceRef:'evidence-document:'+documentId+':time-for-completion:'+fragment.ref,sourceAnalytical});
  }
  return uniquePeriods(rows);
}
/** The Works Time for Completion stated as a period in one contract document.
 * A line about a Section is never read as the Works. */
export function worksTimeForCompletion(result:ContractResult,documentId:string,sourceAnalytical=false,sourceName='Contract'){
  return statedPeriodsIn(result,documentId,sourceAnalytical,sourceName,
    ()=>/(^|\n)([^\n]*?)\bTime\s+for\s+Completion\b((?:\s+(?:of|for)\s+(?:the\s+)?(?:whole\s+of\s+the\s+)?Works\b)?)([^\n]*)/gi,
    match=>{
      // r14: the shared section-scope rule (Section N, Sectional Completion, Portion, Milestone).
      if(namesSectionScope(match[2]!)||SECTION_SCOPE_FOLLOWS.test(match[4]!))return null;
      const raw=match[4]!.replace(/^\s*(?:\([^)]*\)\s*)?[:|=\t\-–]?\s*/,'');
      // "...: 365 days for Section 1" is that Section's period, not the Works.
      const period=/^(?:shall\s+be\s+|is\s+|will\s+be\s+)?(?:a\s+period\s+of\s+|within\s+)?\d{1,4}(?:\s*\([^)]*\))?\s*(?:calendar\s+|working\s+)?(?:days?|weeks?|months?|years?)\b/i.exec(raw);
      if(period&&/^\s*[,(]?\s*(?:for|in\s+respect\s+of)\s+(?:the\s+|each\s+|a\s+|any\s+)?(?:Sections?|Sectional|Portions?|Milestones?)\b/i.test(raw.slice(period[0].length)))return null;
      return raw;
    });
}
/** A Section's Time for Completion stated as a period ("Section 1 Time for
 * Completion: 12 months", "Time for Completion of Section 1: 365 days"). */
export function sectionTimeForCompletion(result:ContractResult,sectionId:string,documentId:string,sourceAnalytical=false,sourceName='Contract'){
  const id=sectionId.replace(/[^0-9A-Za-z]/g,'');if(!id)return [];
  return statedPeriodsIn(result,documentId,sourceAnalytical,sourceName,
    ()=>new RegExp('\\bSection\\s+'+id+'\\b(?:\\s*\\([^)]*\\))?\\s*[:\\-–]?\\s*Time\\s+for\\s+Completion\\b([^\\n]*)|\\bTime\\s+for\\s+Completion\\s+(?:of|for)\\s+Section\\s+'+id+'\\b(?:\\s*\\([^)]*\\))?([^\\n]*)','gi'),
    match=>(match[1]??match[2]??'').replace(/^\s*[:|=\t\-–]?\s*/,''));
}

/** The contract's explicit definition of a "day", or null when it states none. */
export function contractDayDefinition(texts:readonly string[]):'working'|'calendar'|null{
  const text=texts.join('\n');
  if(/(?:a\s+)?["“]?days?["”]?\s+(?:shall\s+)?(?:mean|means|be|constitute)\s+(?:a\s+)?working\s+days?/i.test(text))return 'working';
  if(/(?:a\s+)?["“]?days?["”]?\s+(?:shall\s+)?(?:mean|means|be|constitute)\s+(?:a\s+)?calendar\s+days?/i.test(text))return 'calendar';
  return null;
}
export function contractDocumentTexts(result:ContractResult){return contractFragments(result).map(fragment=>fragment.text);}
/** The name a contract document is cited by in a basis label. */
export function contractSourceName(state:ProjectRuntimeState,documentId:string){
  return state.evidenceDocuments?.find(document=>document.documentId===documentId)?.sourceFilename??'Contract';
}

const isoDay=(ms:number)=>new Date(ms).toISOString().slice(0,10);
/** Commencement Date + the period. Days and weeks are calendar days; months
 * and years are calendar months (same day of the month; the last day of the
 * month when that day does not exist). Working days are never computed here. */
export function addStatedPeriod(startIso:string,period:Pick<StatedPeriod,'amount'|'unit'>):{dateIso:string;monthEnd:boolean}|null{
  const parts=/^(\d{4})-(\d{2})-(\d{2})$/.exec(startIso);if(!parts)return null;
  const year=Number(parts[1]),month=Number(parts[2])-1,day=Number(parts[3]);
  if(period.unit==='days'||period.unit==='weeks')return {dateIso:isoDay(Date.UTC(year,month,day)+period.amount*(period.unit==='weeks'?7:1)*86400000),monthEnd:false};
  const months=period.amount*(period.unit==='years'?12:1),target=month+months;
  const targetYear=year+Math.floor(target/12),targetMonth=((target%12)+12)%12;
  const last=new Date(Date.UTC(targetYear,targetMonth+1,0)).getUTCDate();
  return {dateIso:isoDay(Date.UTC(targetYear,targetMonth,Math.min(day,last))),monthEnd:day>last};
}

export interface CommencementCandidate {dateIso:string;kind:'contract'|'engineer_notice';documentId:string;sourceRef:string;sourceAnalytical:boolean}
export interface CommencementDatePosition {
  dateIso:string|null;
  state:'stated'|'user_confirmed'|'conflicted'|'missing';
  /** Read only from a source that is not formally adopted. */
  sourceAnalytical:boolean;
  /** 'Commencement 2026-01-15' or 'Commencement 2026-01-15 (confirmed by the user)'. */
  label:string|null;
  reason:string|null;
  sourceRefs:string[];
  candidates:CommencementCandidate[];
}
export const COMMENCEMENT_NOT_STATED='no Commencement Date is stated in the contract, an Engineer\'s notice of commencement or a user-confirmed decision';
const commencementCache=new WeakMap<ProjectRuntimeState,{version:number;confirmed:string|null;value:CommencementDatePosition}>();
/** F34: the Commencement Date from the contract, an Engineer's notice of
 * commencement, or a user-confirmed decision. An adopted source is preferred
 * to an unadopted one; different stated dates stay conflicted (unknown) unless
 * the user confirms the date. Cached once per project version. */
export function commencementDatePosition(state:ProjectRuntimeState):CommencementDatePosition{
  const confirmed=state.controls?.commencementDate?.dateIso??null;
  const prior=commencementCache.get(state);if(prior&&prior.version===state.version&&prior.confirmed===confirmed)return prior.value;
  const value=readCommencementDate(state);commencementCache.set(state,{version:state.version,confirmed,value});return value;
}
function readCommencementDate(state:ProjectRuntimeState):CommencementDatePosition{
  const candidates:CommencementCandidate[]=[];
  const statement=()=>new RegExp('\\b(?:Commencement\\s+Date|Date\\s+of\\s+Commencement(?:\\s+of\\s+(?:the\\s+)?Works)?)\\b(?:\\s*\\([^)]*\\))?\\s*(?:shall\\s+be|is|will\\s+be)?\\s*[:|=\\t\\-–]?\\s*(?:on\\s+)?('+COMPLETION_DATE_TOKEN+')','gi');
  const sources=contractSourceAnalysis(state);
  for(const document of state.contractDocuments??[]){
    if(!['main','replacement','amendment','appendix'].includes(document.role))continue;
    if(!sources.eligible(document.documentId,true))continue;
    const unadopted=sources.unadopted(document.documentId);
    for(const fragment of contractFragments(document.result as ContractResult))for(const match of fragment.text.matchAll(statement())){
      const date=explicitDate(match[1]!);
      if(date)candidates.push({dateIso:date,kind:'contract',documentId:document.documentId,sourceRef:'evidence-document:'+document.documentId+':commencement-date:'+fragment.ref,sourceAnalytical:unadopted});
    }
  }
  // An Engineer's notice of commencement (letters and notices register documents).
  const notice=()=>new RegExp('\\b(?:Commencement\\s+Date|Date\\s+of\\s+Commencement(?:\\s+of\\s+(?:the\\s+)?Works)?)\\b(?:\\s*\\([^)]*\\))?\\s*(?:shall\\s+be|is|will\\s+be)?\\s*[:|=\\t\\-–]?\\s*(?:on\\s+)?('+COMPLETION_DATE_TOKEN+')|\\bcommence\\s+(?:the\\s+)?(?:execution\\s+of\\s+the\\s+)?Works\\s+on\\s+('+COMPLETION_DATE_TOKEN+')','gi');
  for(const document of state.evidenceDocuments??[]){
    if(document.documentType!=='letters_notices'||!['active','additive'].includes(document.basisState))continue;
    const read=document.fullTextRead?.sourceHashSha256===document.sourceHashSha256?document.fullTextRead.result.pages.map(page=>({text:page.text,ref:'page:'+page.pageNumber})):[];
    const segments=(document.textSegments??[]).filter(segment=>segment.sourceHashSha256===document.sourceHashSha256).map(segment=>({text:segment.text,ref:segment.locator??'text'}));
    for(const fragment of [...read,...segments]){
      if(!/notice\s+of\s+commencement|commencement\s+date|commence\s+(?:the\s+)?(?:execution\s+of\s+the\s+)?works/i.test(fragment.text)||!/\bEngineer\b|\bnotice\b/i.test(fragment.text))continue;
      for(const match of fragment.text.matchAll(notice())){
        const date=explicitDate((match[1]??match[2])!);
        if(date)candidates.push({dateIso:date,kind:'engineer_notice',documentId:document.documentId,sourceRef:'evidence-document:'+document.documentId+':commencement-date:'+fragment.ref,sourceAnalytical:false});
      }
    }
  }
  const adopted=candidates.filter(candidate=>!candidate.sourceAnalytical);
  const used=adopted.length?adopted:candidates;
  const dates=[...new Set(used.map(candidate=>candidate.dateIso))];
  const confirmed=state.controls?.commencementDate;
  const confirmedIso=confirmed&&/^\d{4}-\d{2}-\d{2}$/.test(confirmed.dateIso)?confirmed.dateIso:null;
  const sourceRefs=[...new Set(used.map(candidate=>candidate.sourceRef))];
  if(dates.length===1){
    const sourceAnalytical=used.every(candidate=>candidate.sourceAnalytical);
    const fromNotice=used.every(candidate=>candidate.kind==='engineer_notice');
    return {dateIso:dates[0]!,state:'stated',sourceAnalytical,label:'Commencement '+dates[0]!+(fromNotice?' (Engineer\'s notice of commencement)':''),reason:null,sourceRefs,candidates};
  }
  // A user-confirmed date is used only while the sources state none or disagree.
  if(confirmedIso)return {dateIso:confirmedIso,state:'user_confirmed',sourceAnalytical:false,label:'Commencement '+confirmedIso+' (confirmed by the user)',reason:null,
    sourceRefs:[...new Set([...(confirmed!.sourceRefs??[]),...sourceRefs])],candidates};
  if(dates.length>1)return {dateIso:null,state:'conflicted',sourceAnalytical:false,label:null,
    reason:'different Commencement Dates are stated ('+dates.sort().join(', ')+'); confirm the Commencement Date',sourceRefs,candidates};
  return {dateIso:null,state:'missing',sourceAnalytical:false,label:null,reason:COMMENCEMENT_NOT_STATED,sourceRefs:[],candidates};
}

export interface PeriodCompletion {dateIso:string|null;basis:string|null;reason:string|null;sourceAnalytical:boolean;sourceRefs:string[]}
const unitLabel=(period:StatedPeriod)=>period.unit==='days'?(period.amount===1?'calendar day':'calendar days')
  :period.unit==='weeks'?(period.amount===1?'week':'weeks')+' ('+(period.amount*7)+' calendar days)'
  :period.unit==='months'?(period.amount===1?'calendar month':'calendar months'):(period.amount===1?'calendar year':'calendar years');
/** The completion date for one stated Time for Completion: Commencement Date +
 * the period, with the basis label, or unknown with the reason. */
export function completionFromStatedPeriod(scope:string,periods:readonly StatedTimeForCompletion[],commencement:CommencementDatePosition,dayDefinition:'working'|'calendar'|null):PeriodCompletion{
  const unknown=(reason:string,sourceRefs:string[]=[]):PeriodCompletion=>({dateIso:null,basis:null,reason,sourceAnalytical:false,sourceRefs});
  if(periods.length>1)return unknown(scope+' Time for Completion is stated as different periods ('+periods.map(period=>period.text).join('; ')+'); the date stays unknown.',periods.map(period=>period.sourceRef));
  const period=periods[0];
  if(!period)return unknown(scope+' Time for Completion is not stated.');
  if(period.anchor==='other')return unknown(scope+' Time for Completion is stated as "'+period.text+'", which is not counted from the Commencement Date; the date stays unknown.',[period.sourceRef]);
  const working=period.dayKind==='working'||(period.dayKind===null&&period.unit==='days'&&dayDefinition==='working');
  if(working&&(period.unit==='days'||period.unit==='weeks'))return unknown(scope+' Time for Completion is stated as "'+period.text+'"'+(period.dayKind==='working'?'':' and the contract defines a day as a working day')+'; the contract working calendar is not read, so the date stays unknown.',[period.sourceRef]);
  if(!commencement.dateIso)return unknown(scope+' Time for Completion is stated as "'+period.text+'", but '+commencement.reason+'; the date stays unknown.',[period.sourceRef]);
  const added=addStatedPeriod(commencement.dateIso,period);
  if(!added)return unknown(scope+' Time for Completion could not be added to the Commencement Date '+commencement.dateIso+'.',[period.sourceRef]);
  return {dateIso:added.dateIso,
    basis:commencement.label+' + '+period.amount+' '+unitLabel(period)+(period.unit==='months'||period.unit==='years'?(added.monthEnd?' (to the last day of the month)':' (same day of the month)'):'')+', '+period.locator,
    reason:null,sourceAnalytical:period.sourceAnalytical||commencement.sourceAnalytical,sourceRefs:[...new Set([period.sourceRef,...commencement.sourceRefs])]};
}
/** True when any contract document states a Time for Completion (Works or a
 * Section) as a period counted from the Commencement Date. */
const periodStatedCache=new WeakMap<ProjectRuntimeState,{version:number;value:boolean}>();
export function contractStatesPeriodFromCommencement(state:ProjectRuntimeState){
  const prior=periodStatedCache.get(state);if(prior&&prior.version===state.version)return prior.value;
  const value=readContractStatesPeriodFromCommencement(state);periodStatedCache.set(state,{version:state.version,value});return value;
}
function readContractStatesPeriodFromCommencement(state:ProjectRuntimeState){
  const sources=contractSourceAnalysis(state);
  return (state.contractDocuments??[]).some(document=>{
    if(!['main','replacement','amendment'].includes(document.role)||!sources.eligible(document.documentId,true))return false;
    const result=document.result as ContractResult;
    const sectionIds=new Set(contractFragments(result).flatMap(fragment=>[...fragment.text.matchAll(/\bSection\s+(\w+)\b(?:\s*\([^)]*\))?\s*[:\-–]?\s*Time\s+for\s+Completion\b|\bTime\s+for\s+Completion\s+(?:of|for)\s+Section\s+(\w+)/gi)].map(match=>(match[1]??match[2])!)));
    return [...worksTimeForCompletion(result,document.documentId),...[...sectionIds].flatMap(id=>sectionTimeForCompletion(result,id,document.documentId))].some(period=>period.anchor!=='other');
  });
}
