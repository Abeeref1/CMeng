import {dateValue} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';
import {contractSourceAnalysis,CONTRACT_SOURCE_ANALYTICAL_NOTE,SOURCE_ANALYTICAL_USE} from './contract-source-analysis';

const dateToken='(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{4}|\\d{1,2}\\s+[A-Za-z]+\\s+\\d{4}|[A-Za-z]+\\s+\\d{1,2},?\\s+\\d{4})';
function explicitDate(raw:string):string|null {
  const numeric=/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw.trim());
  if(numeric)return dateValue(numeric[3]+'-'+numeric[2]!.padStart(2,'0')+'-'+numeric[1]!.padStart(2,'0'));
  const monthFirst=/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(raw.trim());
  return dateValue(monthFirst?monthFirst[2]+' '+monthFirst[1]+' '+monthFirst[3]:raw);
}
export interface CompletionCandidate {date:string;documentId:string;role:string;effectiveFrom:string|null;sourceRef:string;historical?:boolean;sourceVerified?:boolean;sourceAnalytical?:boolean;}
/** A date must be attached to a completion label, never merely present in a
 * section that discusses completion. All competing assertions are retained. */
export function contractCompletionPosition(state:ProjectRuntimeState,asOf:string|null,includeCandidates=false) {
  const candidates:CompletionCandidate[]=[];
  // T04: the shared source-analytical rule. includeCandidates keeps the existing
  // amendment read that labels every candidate amendment as 'candidate'.
  const sources=contractSourceAnalysis(state);
  const documents=state.contractDocuments.filter(c=>['main','amendment','replacement'].includes(c.role)&&(includeCandidates
    ?state.evidenceDocuments.some(d=>d.documentId===c.documentId&&['active','additive','candidate'].includes(d.basisState))
    :state.evidenceDocuments.some(d=>d.documentId===c.documentId)&&sources.eligible(c.documentId)));
  for(const doc of documents){
    const nativePages=(doc.result.pdf?.pages??[]).filter(p=>p.method==='native');
    const sections=[...(doc.result.sections??[]),...nativePages.map(p=>({text:p.text,heading:null,startPage:p.pageNumber,sectionKey:'page:'+p.pageNumber,sourceSpans:[],sourceMode:'deterministic' as const}))];
    const whole=sections.map(s=>s.text).join('\n');
    const effective=new RegExp('(?:effective\\s+date|effective\\s+from)\\s*[:|\\t]?\\s*('+dateToken+')','i').exec(whole);
    const effectiveFrom=effective?explicitDate(effective[1]!):null;
    const label='(?:(?:revised|amended|contractual|contract|original|current)\\s+)*(?:date\\s+(?:for|of)\\s+completion|completion\\s+date|time\\s+for\\s+completion|(?:contractual|original|revised|amended|current)\\s+completion)';
    const pattern=new RegExp('\\b'+label+'\\s*(?:(?:shall\\s+be|is|on)\\s*)?[:|=\\t]?\\s*('+dateToken+')','gi');
    for(const section of sections){
      const text=[section.heading??'',section.text].join('\n');
      for(const match of text.matchAll(pattern)){
        // In an explicitly labelled Original / As amended table the second
        // adjacent date replaces the first. Do not treat the historical cell
        // as a competing current assertion or use an amendment's effective date.
        const oldNewTable=doc.role==='amendment'&&/\bOriginal\s+(?:As\s+amended|Amended|Revised)\b/i.test(text);
        const following=oldNewTable?new RegExp('^\\s*[|\\t]?\\s*('+dateToken+')').exec(text.slice((match.index??0)+match[0].length)):null;
        const dateText=following?.[1]??match[1]!;
        const date=explicitDate(dateText);if(!date)continue;
        const span=section.sourceSpans?.find(s=>s.text.includes(dateText));
        const nativePage=nativePages.find(p=>p.text.includes(dateText));
        const page=span?.page??nativePage?.pageNumber??section.startPage;
        candidates.push({date,sourceVerified:section.sourceMode==='deterministic',...(!includeCandidates&&sources.unadopted(doc.documentId)?{sourceAnalytical:true}:{}),historical:doc.role==='amendment'&&!following&&/\boriginal\b/i.test(match[0]),documentId:doc.documentId,role:doc.role,effectiveFrom,sourceRef:'evidence-document:'+doc.documentId+':contract-completion:'+(page?'page:'+page:section.sectionKey)});
      }
    }
  }
  // An adopted value is never erased or overridden by an unadopted source: when
  // any adopted assertion exists, unadopted ones are kept as named conflicts.
  const adoptedAssertions=candidates.filter(c=>!c.sourceAnalytical);
  const used=adoptedAssertions.length?adoptedAssertions:candidates;
  const sourceAnalyticalOnly=used.length>0&&used.every(c=>c.sourceAnalytical);
  const base=used.filter(c=>c.role!=='amendment');
  const changes=used.filter(c=>c.role==='amendment'&&!c.historical);
  const applicable=changes.filter(c=>c.effectiveFrom&&asOf&&c.effectiveFrom<=asOf);
  const latest=applicable.map(c=>c.effectiveFrom!).sort().at(-1);
  const selected=latest?applicable.filter(c=>c.effectiveFrom===latest):base;
  const values=[...new Set(selected.map(c=>c.date))];
  const undated=changes.some(c=>!c.effectiveFrom||!asOf);
  const conflict=values.length>1||undated;
  const reason=undated?'Completion amendment applicability is unresolved: effective date or reporting date is missing.':values.length>1?'Conflicting completion dates are stated in the applicable contract records.':values.length===0?'No explicit completion-date line was recognised in the applicable contract data or terms.':null;
  const value=conflict?null:values[0]??null;
  const sourceConflicts=adoptedAssertions.length?[...new Set(candidates.filter(c=>c.sourceAnalytical&&!c.historical&&c.date!==value&&(c.role!=='amendment'||!c.effectiveFrom||!asOf||c.effectiveFrom<=asOf))
    .map(c=>'UNADOPTED_SOURCE_COMPLETION_DIFFERS:'+c.date+':'+c.documentId))]:[];
  const adoptedDocuments=documents.filter(d=>!sources.unadopted(d.documentId)||includeCandidates);
  // A date read only from an unadopted source is used and labelled; it is never 'official'.
  const state_=conflict?'conflicted' as const:values.length?(sourceAnalyticalOnly?'candidate' as const:'official' as const):'missing' as const;
  return {value,state:state_,reason:sourceAnalyticalOnly&&!conflict&&values.length?CONTRACT_SOURCE_ANALYTICAL_NOTE:reason,candidates,
    sourceRefs:[...new Set((sourceAnalyticalOnly?candidates:adoptedAssertions).map(c=>c.sourceRef))],
    hasContractDocuments:adoptedDocuments.length>0,hasSourceAnalyticalDocuments:documents.length>adoptedDocuments.length,
    ...(sourceAnalyticalOnly?{sourceAnalyticalUse:SOURCE_ANALYTICAL_USE,sourceAnalyticalNote:CONTRACT_SOURCE_ANALYTICAL_NOTE}:{}),
    sourceConflicts};
}

type CompletionPosition=ReturnType<typeof contractCompletionPosition>;
type LabelFields={contractualCompletionSourceUse?:typeof SOURCE_ANALYTICAL_USE;contractualCompletionSourceNote?:string;contractualCompletionSourceConflicts?:string[]};
/** Remove a previous source label so an adopted date never keeps a stale one. */
export function withoutCompletionSourceLabel<T extends LabelFields>(basis:T|null|undefined):Omit<T,keyof LabelFields>|undefined{
  if(!basis)return undefined;
  const {contractualCompletionSourceUse:_u,contractualCompletionSourceNote:_n,contractualCompletionSourceConflicts:_c,...rest}=basis;return rest;
}
/** The label every page, report and Ask answer reads with the completion date. */
export function completionSourceLabel(resolved:CompletionPosition,conflicts:string[]=resolved.sourceConflicts):LabelFields{
  return {...(resolved.sourceAnalyticalUse?{contractualCompletionSourceUse:resolved.sourceAnalyticalUse,contractualCompletionSourceNote:resolved.sourceAnalyticalNote}:{}),
    ...(conflicts.length?{contractualCompletionSourceConflicts:[...conflicts]}:{})};
}
/** A date read only from an unadopted source never replaces an official or
 * user-confirmed completion date; a different date is kept as a named conflict. */
export function completionHeldByAdoptedBasis(current:{contractualCompletionIso:string|null;contractualCompletionState:string;sourceRefs:string[]}|null|undefined,resolved:CompletionPosition){
  if(!current||!resolved.sourceAnalyticalUse)return null;
  const adopted=current.contractualCompletionState==='official'||current.sourceRefs.some(ref=>ref.startsWith('user-confirmation:contract-completion:'));
  if(!adopted)return null;
  return resolved.candidates.filter(c=>c.sourceAnalytical&&!c.historical&&c.date!==current.contractualCompletionIso).map(c=>'UNADOPTED_SOURCE_COMPLETION_DIFFERS:'+c.date+':'+c.documentId);
}
