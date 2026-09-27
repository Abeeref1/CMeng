import type {AnalysisPlan, AuthorityDescriptor, RequestRoute} from './types';
import {normalized} from './primitives';

// A small language layer chooses capabilities, never values or project authority.
const greeting=/^(?:(?:(?:good\s+(?:morning|afternoon|evening)|hello|hi|hey|thanks|thank you|okay|ok|how are you(?: today)?)\b|مرحبا|السلام عليكم|صباح الخير|شكرا|كيف حالك)[\s!,.؟?؛:]*)+/i;
export function substantiveQuestion(question:string){return question.trim().replace(greeting,'').replace(/^(?:and |please[ ,]+)/i,'').trim();}
export function isSocial(question:string){return !!question.trim()&&!substantiveQuestion(question);}
export function socialReply(question:string){return /[\u0600-\u06ff]/.test(question)?'مرحباً، أنا جاهز لمساعدتك. ماذا تريد أن تعرف عن هذا المشروع؟':/thank|شكرا/i.test(question)?'You’re welcome. What else would you like to check for this project?':'Good to hear from you. I’m ready to help—what would you like to know about this project?';}
const interpretation=/\b(why|explain|interpret|recommend|investigate|diagnos\w*|caus\w*|drivers?|deterioration|advise|challenge|justify|professional|draft|counterposition)\b|لماذا|فسر|توصي|صياغه/;
const complex=/full.*(?:report|package)|construction intelligence|monthly project|project director meeting|management interpretation|تقرير شامل/;
export function routeRequest(question:string,plan:AnalysisPlan,purePresentation=false):RequestRoute{
  const q=normalized(substantiveQuestion(question));
  if(!q)return 'social';
  if(/\b(?:all|across|compare|other|another)\s+(?:projects|portfolios|programmes)\b|cross.project|جميع المشاريع/.test(q))return 'unsupported_enterprise';
  if(purePresentation)return 'local_visual_export';
  if(plan.kind==='historical')return 'historical';
  if(plan.kind==='scenario')return 'scenario';
  if(plan.kind==='document')return 'document_analysis';
  if(complex.test(q)||plan.kind==='report'&&interpretation.test(q))return 'complex_report';
  if(interpretation.test(q)||plan.kind==='draft')return plan.authorities.length>2?'cross_domain_diagnostic':'ai_explanation';
  if(/\b(chart|graph|dashboard|excel|xlsx|pdf|word|csv|export|power ?bi)\b/.test(q))return 'local_visual_export';
  return /^(?:what(?:'s| is| are)|how (?:many|much)|give me|ما|كم)\b/.test(q)?'deterministic_fact':'local_data';
}
export const needsInterpretation=(route:RequestRoute)=>['ai_explanation','cross_domain_diagnostic','complex_report','document_analysis'].includes(route);

// Producer concepts and inflections drive authority matching for all requests.
export function mentionsConcept(question:string,concept:string){
  const escaped=normalized(concept).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return /^[a-z0-9 ]+$/.test(escaped)?new RegExp('\\b'+escaped+'(?:s|es)?\\b','i').test(question):question.includes(escaped);
}
export function rankedRequests(question:string,catalogue:AuthorityDescriptor[]){
  const q=normalized(question),matches=[...q.matchAll(/\b(top|worst)\s*(\d{1,4})\s+([^;,.]+?)(?=\band\s+(?:top|worst)\b|[;,.]|$)/g)];
  return matches.flatMap(m=>{
    const phrase=m[3]!,authority=catalogue.find(c=>c.concepts.some(k=>mentionsConcept(phrase,k)));
    if(!authority)return [];
    const field=authority.id==='boq'?'amount':authority.id==='risks'?'score':['materials','procurement','long-lead'].includes(authority.id)?'headroomCalendarDays':'totalFloatHours';
    return [{authorityId:authority.id,field,direction:field==='amount'||field==='score'?'desc' as const:'asc' as const,limit:Math.min(1000,Math.max(1,Number(m[2])))}];
  });
}
