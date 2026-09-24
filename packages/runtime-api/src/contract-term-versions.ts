import {numberValue,registerDate} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';
export type ContractTermKey='ldRate'|'ldCap'|'retentionPercent'|'retentionCapPercent'|'paymentPeriodDays'|'noticePeriodDays'|'performanceSecurity'|'advanceSecurity';
export interface ContractTermVersion {term:ContractTermKey;value:number;unit:string;effectiveFromIso:string|null;effectiveToIso:string|null;documentId:string;role:string;sourceRefs:string[];clauseIdentifier:string|null;applicability:'prospective'|'unresolved';}
const labels:Array<[ContractTermKey,RegExp]>=[
 ['ldCap',/(?:delay damages|liquidated damages|LD)\s*(?:maximum|cap|limit)/i],['ldRate',/(?:delay damages|liquidated damages|LD)\s*(?:rate)?/i],
 ['retentionCapPercent',/retention\s*(?:cap|maximum|limit)/i],['retentionPercent',/retention\s*(?:percent(?:age)?|rate)/i],
 ['paymentPeriodDays',/payment\s*(?:period|time|deadline)/i],['noticePeriodDays',/(?:initial\s+(?:claim\s+)?notice|notice\s*(?:period|of claim)|claim notice)/i],
 ['performanceSecurity',/performance\s*(?:security|bond|guarantee)(?:\s*amount)?/i],['advanceSecurity',/advance[- ]payment\s*(?:security|bond|guarantee)(?:\s*amount)?/i],
];
/** Only labelled contract values become terms. Document dates and clause numbers
 * are never scanned as amounts. Effective intervals are exclusive at the end. */
export function contractTermVersions(state:ProjectRuntimeState):ContractTermVersion[]{
 const versions:ContractTermVersion[]=[];
 for(const doc of state.contractDocuments){
  if(!['main','replacement','amendment'].includes(doc.role)||!state.evidenceDocuments.some(d=>d.documentId===doc.documentId&&['active','additive'].includes(d.basisState)))continue;
  const fragments=[...(doc.result.pdf?.pages??[]).filter(p=>p.method==='native').map(p=>({text:p.text,page:p.pageNumber})),...(doc.result.sections??[]).filter(s=>s.sourceMode==='deterministic').map(s=>({text:[s.heading??'',s.text].join('\n'),page:s.startPage}))];
  const whole=fragments.map(f=>f.text).join('\n');
  const from=registerDate(/(?:effective\s+date|effective\s+from)\s*[:|]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i.exec(whole)?.[1]??'');
  const applicability=doc.role==='amendment'&&(!from||/retrospective|retroactive/i.test(whole))?'unresolved':'prospective';
  for(const f of fragments)for(const line of f.text.split(/[\r\n]+/)){
   const entry=labels.find(([,label])=>label.test(line));if(!entry)continue;
   const [term,label]=entry,match=label.exec(line)!;
   const suffix=line.slice(match.index+match[0].length).replace(/^\s*(?:is|shall be)?\s*[:|=]?\s*/i,'');
   const amount=/^(?:([A-Z]{3})\s*)?([\d,]+(?:\.\d+)?)\s*(%|percent|(?:calendar\s+|working\s+)?days|[A-Z]{3}\b)?(?:\s*(?:per|\/)\s*(?:calendar\s+)?(day|week))?/.exec(suffix);
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
   versions.push({term,value,unit,effectiveFromIso:from,effectiveToIso:null,documentId:doc.documentId,role:doc.role,sourceRefs:[sourceRef],clauseIdentifier:clause,applicability});
  }
 }
 for(const v of versions)v.effectiveToIso=versions.filter(x=>x.term===v.term&&x.applicability==='prospective'&&x.effectiveFromIso&&(!v.effectiveFromIso||x.effectiveFromIso>v.effectiveFromIso)).map(x=>x.effectiveFromIso!).sort()[0]??null;
 return versions;
}
export function termAtEvent(versions:readonly ContractTermVersion[],term:ContractTermKey,eventDate:string|null){
 const all=versions.filter(v=>v.term===term);const date=registerDate(eventDate??'');
 const applicable=all.filter(v=>date&&(!v.effectiveFromIso||v.effectiveFromIso<=date)&&(!v.effectiveToIso||v.effectiveToIso>date));
 const unresolved=all.some(v=>v.applicability==='unresolved');const distinct=new Set(applicable.map(v=>v.value+'|'+v.unit));
 const established=Boolean(date)&&!unresolved&&distinct.size===1;
 return {state:established?'established' as const:'unresolved' as const,value:established?applicable[0]!.value:null,unit:established?applicable[0]!.unit:null,reason:!date?'Event date is unresolved.':unresolved?'Amendment applicability is unresolved.':distinct.size>1?'Conflicting applicable contract values.':!distinct.size?'No applicable labelled contract value was recognised.':null,versions:applicable,sourceRefs:[...new Set(applicable.flatMap(v=>v.sourceRefs))]};
}
