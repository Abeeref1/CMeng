import type {SectionLdScenario} from './types';

/** F34: one shared sectional delay-damages position, built only from the
 * per-section scenarios (each with its own date, rate and cap). The total is
 * the sum of capped section amounts, given only when every section is
 * complete and in one currency. Otherwise it is "needs review" with the
 * missing inputs per section. A scenario, never a determination or deduction. */
export interface SectionalLdPosition{
 state:'calculated'|'needs_review';
 cappedTotal:number|null;uncappedTotal:number|null;currency:string|null;sectionCount:number;
 sections:Array<{sectionId:string;label:string;lateDays:number|null;uncappedExposure:number|null;cappedExposure:number|null;capAmount:number|null;rate:number|null;currency:string|null;missingInputs:string[]}>;
 missingInputs:string[];reason:string;basis:string;sourceRefs:string[];
}
export function sectionalLdPosition(scenarios:readonly SectionLdScenario[]|null|undefined):SectionalLdPosition|null{
 const rows=scenarios??[];
 if(!rows.length)return null;
 const sections=rows.map(s=>{
  const missing=[...s.missingInputs];
  if(s.capAmount===null&&!missing.some(m=>/cap/i.test(m)))missing.push('Section monetary cap');
  if(!s.currency)missing.push('Section currency');
  if(!missing.length&&s.cappedExposure===null)missing.push('Section capped amount');
  return {sectionId:s.sectionId,label:s.label,lateDays:s.lateDays,uncappedExposure:s.uncappedExposure,cappedExposure:s.cappedExposure,capAmount:s.capAmount,rate:s.rate,currency:s.currency,missingInputs:missing};
 });
 const currencies=[...new Set(sections.map(s=>s.currency).filter((c):c is string=>!!c))];
 const missingInputs=sections.flatMap(s=>s.missingInputs.map(m=>'Section '+s.sectionId+': '+m));
 if(currencies.length>1)missingInputs.push('Sections are stated in different currencies ('+currencies.join(', ')+'); no single total');
 const complete=missingInputs.length===0;
 const round=(n:number)=>Number(n.toFixed(2));
 return {state:complete?'calculated':'needs_review',
  cappedTotal:complete?round(sections.reduce((a,s)=>a+s.cappedExposure!,0)):null,
  uncappedTotal:complete?round(sections.reduce((a,s)=>a+(s.uncappedExposure??0),0)):null,
  currency:currencies.length===1?currencies[0]!:null,sectionCount:sections.length,sections,missingInputs,
  reason:complete?'Sum of capped section amounts; every section has its own completion date, forecast, rate and cap.':'Needs review: '+missingInputs.join('; ')+'.',
  basis:'Sectional delay damages scenario from contract section terms; not a determination, certified deduction or agreed entitlement.',
  sourceRefs:[...new Set(rows.flatMap(s=>s.sourceRefs))]};
}
