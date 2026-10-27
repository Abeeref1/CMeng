import {numberValue,registerDate} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';
import {contractSourceAnalysis,CONTRACT_SOURCE_ANALYTICAL_NOTE,SOURCE_ANALYTICAL_USE} from './contract-source-analysis';
export type ContractTermKey='ldRate'|'ldCap'|'retentionPercent'|'retentionCapPercent'|'paymentPeriodDays'|'noticePeriodDays'|'performanceSecurity'|'advanceSecurity';
export interface ContractTermVersion {term:ContractTermKey;value:number;unit:string;effectiveFromIso:string|null;effectiveToIso:string|null;documentId:string;role:string;sourceRefs:string[];clauseIdentifier:string|null;applicability:'prospective'|'unresolved';reviewReference?:string;decisionReference?:string;sourceAnalyticalUse?:typeof SOURCE_ANALYTICAL_USE;sourceAnalyticalNote?:string;}
const labels:Array<[ContractTermKey,RegExp]>=[
 // ABB G5_DELAY-30: "LD" is a whole word. Inside other words ("should", "held",
 // "build") it is not a delay-damages label and must not hide the line's real term.
 ['ldCap',/(?:(?:maximum|cap on|limit of)\s+(?:delay damages|liquidated damages|\bLDs?\b)|(?:delay damages|liquidated damages|\bLDs?\b)\s*(?:maximum|cap|limit))/i],['ldRate',/(?:delay damages|liquidated damages|\bLDs?\b)\s*(?:rate)?/i],
 ['retentionCapPercent',/(?:limit of retention(?: money)?|retention\s*(?:cap|maximum|limit))/i],['retentionPercent',/retention\s*(?:percent(?:age)?|rate)?/i],
 ['paymentPeriodDays',/payment\s*(?:period|time|deadline)/i],['noticePeriodDays',/(?:initial\s+notice\s+of\s+claim(?:\s*\/\s*compensation\s+event)?\s*(?:notification\s*)?period|notice\s+of\s+delay\s+event\s+period(?:\s*\(Article\s+[\d.]+\))?|initial\s+(?:claim\s+)?notice|notice\s*(?:period|of claim)|claim notice)/i],
 ['performanceSecurity',/performance\s*(?:security|bond|guarantee)(?:\s*amount)?/i],['advanceSecurity',/advance[- ]payment\s*(?:security|bond|guarantee)(?:\s*amount)?/i],
];
/** Only labelled contract values become terms. Document dates and clause numbers
 * are never scanned as amounts. Effective intervals are exclusive at the end. */
export function contractTermVersions(state:ProjectRuntimeState):ContractTermVersion[]{
 const versions:ContractTermVersion[]=[];
 // T04: the shared source-analytical rule (adopted, or the unique fully read candidate).
 const sources=contractSourceAnalysis(state);
 for(const doc of state.contractDocuments){
  if(!['main','replacement','amendment'].includes(doc.role)||!sources.eligible(doc.documentId))continue;
  const unadopted=sources.unadopted(doc.documentId);
  const nativePages=(doc.result.pdf?.pages??[]).filter(p=>p.method==='native');
  const fragments=nativePages.length?nativePages.map(p=>({text:p.text,page:p.pageNumber})):(doc.result.sections??[]).filter(s=>s.sourceMode==='deterministic').map(s=>({text:[s.heading??'',s.text].join('\n'),page:s.startPage}));
  const whole=fragments.map(f=>f.text).join('\n');
  const from=registerDate(/(?:effective\s+date|effective\s+from)\s*[:|]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i.exec(whole)?.[1]??'');
  const applicability=doc.role==='amendment'&&(!from||/retrospective|retroactive/i.test(whole))?'unresolved':'prospective';
  for(const f of fragments){
  const lines=f.text.split(/[\r\n]+/).map(s=>s.trim()).filter(Boolean);
  const oldNewTable=doc.role==='amendment'&&/\bOriginal\s+(?:As\s+amended|Amended|Revised)\b/i.test(f.text);
  for(let index=0;index<lines.length;index++){
   // PDF table cells are often separate lines. Join a wrapped label and its
   // immediately adjacent numeric value, never unrelated prose further away.
   let line=lines[index]!;
   if(/(?:claim\s*\/\s*compensation event|\(Article)$/i.test(line))line+=' '+(lines[++index]??'');
   const entry=labels.find(([,label])=>label.test(line));if(!entry)continue;
   const [term,label]=entry,match=label.exec(line)!;
   let suffix=line.slice(match.index+match[0].length);
   // ABB G5_DELAY-30: the clause wording "the initial notice of claim shall be given
   // within 28 days" is the same period the notice rules read; read it here too, so
   // the dated versions (and the period at the Data Date) come from one reading.
   if(term==='noticePeriodDays')suffix=suffix.replace(/^\s*(?:of\s+claim\s+)?(?:shall|must|is\s+to)\s+be\s+(?:given|served|issued|submitted)\s+within\s+/i,'');
   suffix=suffix.replace(/^\s*(?:is|shall be)?\s*[:|=]?\s*/i,'');
   if(!suffix&&/^(?:[A-Z]{3}\s*)?[\d,]+(?:\.\d+)?\s*(?:%|percent|(?:calendar\s+|working\s+)?days|\b)/.test(lines[index+1]??'')){
    suffix=lines[index+1]!;
    if(oldNewTable&&/^(?:[A-Z]{3}\s*)?[\d,]+(?:\.\d+)?\s*(?:%|percent|(?:calendar\s+|working\s+)?days|\b)/.test(lines[index+2]??''))suffix=lines[index+2]!;
   }
   const amountPattern=/^(?:([A-Z]{3})\s*)?([\d,]+(?:\.\d+)?)\s*(%|percent|(?:calendar\s+|working\s+)?days|[A-Z]{3}\b)?(?:\s*(?:per|\/)\s*(?:calendar\s+)?(day|week))?/;
   let amount=amountPattern.exec(suffix);
   if(oldNewTable&&amount){const amended=amountPattern.exec(suffix.slice(amount[0].length).trim());if(amended)amount=amended;}
   if(!amount)continue;const value=numberValue(amount[2]!);if(value===null)continue;
   let unit=amount[1]?.toUpperCase()??amount[3]?.toLowerCase()??'';
   if(unit==='percent')unit='%';if(/^[a-z]{3}$/.test(unit)&&unit!=='day')unit=unit.toUpperCase();
   if(/PeriodDays$/.test(term)&&!/days/.test(unit))continue;
   if(/Percent$/.test(term)&&unit!=='%')continue;
   if(!unit)continue;if(amount[4])unit+=' per '+amount[4]!.toLowerCase();
   const clause=/(?:Sub[- ]Clause|Clause|Article)\s+(\d+(?:\.\d+)*)/i.exec(line)?.[1]??null;
   const sourceRef='evidence-document:'+doc.documentId+':page:'+(f.page??'unresolved');
   const prior=versions.find(v=>v.documentId===doc.documentId&&v.term===term&&v.value===value&&v.unit===unit&&v.effectiveFromIso===from);
   if(prior){if(!prior.sourceRefs.includes(sourceRef))prior.sourceRefs.push(sourceRef);continue;}
   versions.push({term,value,unit,effectiveFromIso:from,effectiveToIso:null,documentId:doc.documentId,role:doc.role,sourceRefs:[sourceRef],clauseIdentifier:clause,applicability,
    ...(unadopted?{sourceAnalyticalUse:SOURCE_ANALYTICAL_USE,sourceAnalyticalNote:CONTRACT_SOURCE_ANALYTICAL_NOTE}:{})});
  }
  }
 }
 // An unadopted version never closes the interval of an adopted one.
 for(const v of versions)v.effectiveToIso=versions.filter(x=>x.term===v.term&&x.applicability==='prospective'&&x.effectiveFromIso&&(!v.effectiveFromIso||x.effectiveFromIso>v.effectiveFromIso)&&(v.sourceAnalyticalUse||!x.sourceAnalyticalUse)).map(x=>x.effectiveFromIso!).sort()[0]??null;
 return versions;
}
export function termAtEvent(versions:readonly ContractTermVersion[],term:ContractTermKey,eventDate:string|null){
 // T04: an adopted value is never erased or overridden by an unadopted source.
 // When an adopted version exists for this term, unadopted versions are kept
 // only as named source conflicts; otherwise they are used and labelled.
 const termVersions=versions.filter(v=>v.term===term);
 // A user decision from the decision place governs its interval; it keeps its
 // 'not formally adopted' label (sourceAnalyticalUse) and is never shown as adopted.
 const adoptedVersions=termVersions.filter(v=>!v.sourceAnalyticalUse||v.decisionReference);
 const all=adoptedVersions.length?adoptedVersions:termVersions;const date=registerDate(eventDate??'');
 const applicable=all.filter(v=>date&&(!v.effectiveFromIso||v.effectiveFromIso<=date)&&(!v.effectiveToIso||v.effectiveToIso>date));
 const unresolved=all.some(v=>v.applicability==='unresolved');const distinct=new Set(applicable.map(v=>v.value+'|'+v.unit));
 const established=Boolean(date)&&!unresolved&&distinct.size===1;
 const unadoptedUsed=applicable.some(v=>v.sourceAnalyticalUse);
 const sourceConflicts=adoptedVersions.length?[...new Set(termVersions.filter(v=>v.sourceAnalyticalUse&&!applicable.some(a=>a.value===v.value&&a.unit===v.unit))
  .filter(v=>date&&(!v.effectiveFromIso||v.effectiveFromIso<=date))
  .map(v=>'UNADOPTED_SOURCE_CONTRACT_TERM_DIFFERS:'+term+':'+v.value+' '+v.unit+':'+v.documentId))]:[];
 return {...(unadoptedUsed?{sourceAnalyticalUse:SOURCE_ANALYTICAL_USE,sourceAnalyticalNote:applicable.find(v=>v.sourceAnalyticalUse)?.sourceAnalyticalNote??CONTRACT_SOURCE_ANALYTICAL_NOTE}:{}),
  ...(sourceConflicts.length?{sourceConflicts,sourceConflictNote:'An unadopted contract source states a different value; the adopted value is used until the source decision is made.'}:{}),
  state:established?'established' as const:'unresolved' as const,value:established?applicable[0]!.value:null,unit:established?applicable[0]!.unit:null,reason:!date?'Event date is unresolved.':unresolved?'Amendment applicability is unresolved.':distinct.size>1?'Conflicting applicable contract values.':!distinct.size?'No applicable labelled contract value was recognised.':null,versions:applicable,sourceRefs:[...new Set(applicable.flatMap(v=>v.sourceRefs))]};
}

export function contractTermSelectionFactState(selected:ReturnType<typeof termAtEvent>){
 const conflicting=/^Conflicting applicable contract values\.$/.test(selected.reason??'');
 const hasApplicableSource=selected.versions.length>0;
 return {
  state:selected.state==='established'?'established' as const:conflicting?'conflicted' as const:hasApplicableSource?'partial' as const:'missing' as const,
  // Read from source but not formally adopted is never reported as source authority.
  authority:selected.state==='established'?(selected.sourceAnalyticalUse?'candidate' as const:'source' as const):conflicting?'mixed' as const:hasApplicableSource?'candidate' as const:'missing' as const,
 };
}
