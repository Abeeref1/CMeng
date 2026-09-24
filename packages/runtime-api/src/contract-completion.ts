import {dateValue} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';

const dateToken='(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{4}|\\d{1,2}\\s+[A-Za-z]+\\s+\\d{4})';
function explicitDate(raw:string):string|null {
  const numeric=/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw.trim());
  if(numeric)return dateValue(numeric[3]+'-'+numeric[2]!.padStart(2,'0')+'-'+numeric[1]!.padStart(2,'0'));
  return dateValue(raw);
}
export interface CompletionCandidate {date:string;documentId:string;role:string;effectiveFrom:string|null;sourceRef:string;}
/** A date must be attached to a completion label, never merely present in a
 * section that discusses completion. All competing assertions are retained. */
export function contractCompletionPosition(state:ProjectRuntimeState,asOf:string|null) {
  const candidates:CompletionCandidate[]=[];
  const documents=state.contractDocuments.filter(c=>['main','amendment','replacement'].includes(c.role)&&state.evidenceDocuments.some(d=>d.documentId===c.documentId&&['active','additive'].includes(d.basisState)));
  for(const doc of documents){
    const sections=[...(doc.result.sections??[]),...(doc.result.pdf?.pages??[]).filter(p=>p.method==='native').map(p=>({text:p.text,heading:null,startPage:p.pageNumber,sectionKey:'page:'+p.pageNumber,sourceSpans:[]}))];
    const whole=sections.map(s=>s.text).join('\n');
    const effective=new RegExp('(?:effective\\s+date|effective\\s+from)\\s*[:|\\t]?\\s*('+dateToken+')','i').exec(whole);
    const effectiveFrom=effective?explicitDate(effective[1]!):null;
    const label='(?:(?:revised|amended|contractual|contract|original|current)\\s+)*(?:date\\s+(?:for|of)\\s+completion|completion\\s+date|time\\s+for\\s+completion|contractual\\s+completion|revised\\s+completion)';
    const pattern=new RegExp('\\b'+label+'\\s*(?:(?:shall\\s+be|is|on)\\s*)?[:|=\\t]?\\s*('+dateToken+')','gi');
    for(const section of sections){
      const text=[section.heading??'',section.text].join('\n');
      for(const match of text.matchAll(pattern)){
        const date=explicitDate(match[1]!);if(!date)continue;
        const span=section.sourceSpans?.find(s=>s.text.includes(match[1]!));
        const page=span?.page??section.startPage;
        candidates.push({date,documentId:doc.documentId,role:doc.role,effectiveFrom,sourceRef:'evidence-document:'+doc.documentId+':contract-completion:'+(page?'page:'+page:section.sectionKey)});
      }
    }
  }
  const base=candidates.filter(c=>c.role!=='amendment');
  const changes=candidates.filter(c=>c.role==='amendment');
  const applicable=changes.filter(c=>c.effectiveFrom&&asOf&&c.effectiveFrom<=asOf);
  const latest=applicable.map(c=>c.effectiveFrom!).sort().at(-1);
  const selected=latest?applicable.filter(c=>c.effectiveFrom===latest):base;
  const values=[...new Set(selected.map(c=>c.date))];
  const undated=changes.some(c=>!c.effectiveFrom||!asOf);
  const conflict=values.length>1||undated;
  const reason=undated?'Completion amendment applicability is unresolved: effective date or reporting date is missing.':values.length>1?'Conflicting completion dates are stated in the applicable contract records.':values.length===0?'No explicit completion-date line was recognised in the applicable contract data or terms.':null;
  return {value:conflict?null:values[0]??null,state:conflict?'conflicted' as const:values.length?'official' as const:'missing' as const,reason,candidates,sourceRefs:[...new Set(candidates.map(c=>c.sourceRef))],hasContractDocuments:documents.length>0};
}
