import {dateValue} from '../../truth-kernel/src';
import type {NoticeRequirement} from '../../delay-analysis-core/src';
import type {ProjectRuntimeState} from './project-state-types';

/** Extract explicit initial-claim periods with their contract version. Never
 * turn a document-wide topic count into a notice rule or apply an amendment
 * retrospectively merely because its period is shorter. */
export function contractNoticeRules(state:ProjectRuntimeState,noticeKind:'claim_notice'|'detailed_claim'='claim_notice'):NoticeRequirement[] {
  const rules:NoticeRequirement[]=[];
  for(const document of state.contractDocuments){
    if(!['main','amendment','replacement'].includes(document.role))continue;
    const evidence=state.evidenceDocuments.find(d=>d.documentId===document.documentId);
    if(evidence&&!['active','additive'].includes(evidence.basisState))continue;
    const pages=document.result.pdf?.pages??[];
    const sections=document.result.sections??[];
    const fragments=[...pages.map(p=>({text:p.text,locator:'page:'+p.pageNumber})),
      ...sections.map(s=>({text:s.text,locator:s.startPage?'page:'+s.startPage:s.sectionKey}))];
    const text=fragments.map(f=>f.text).join('\n');
    const pattern=noticeKind==='claim_notice'?/(?:current\s+)?initial\s+claim\s+notice\s*[:\n]?\s*(\d+)\s+(?:calendar\s+)?days|initial\s+notice\s+of\s+claim\s+shall\s+be\s+given\s+within\s+(\d+)\s+(?:calendar\s+)?days/gi:
      /fully\s+detailed\s+claim\s*[:\n]?\s*(\d+)\s+(?:calendar\s+)?days|(?:fully\s+)?detailed\s+claim[^.]{0,100}?within\s+(\d+)\s+(?:calendar\s+)?days/gi;
    const matches=fragments.flatMap(f=>[...f.text.matchAll(pattern)].map(m=>({days:Number(m[1]??m[2]),locator:f.locator})));
    const periods=[...new Set(matches.map(m=>m.days))];
    const effective=/Effective Date\s*[:\n]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})/i.exec(text);
    const from=effective?dateValue(effective[1]!):null;
    // An undated amendment must not overwrite the original rule.
    if(document.role==='amendment'&&!from)continue;
    for(const days of periods){
      rules.push({requirementId:document.documentId+':'+noticeKind+':'+days,
        sourceFilename:evidence?.sourceFilename??document.documentId,
        noticeKind,eventCategories:[],noticePeriodDays:days,
        effectiveFromIso:from,effectiveToIso:null,
        triggerBasis:noticeKind==='detailed_claim'?'not_stated':/became aware|become aware|should have become aware/i.test(text)?'awareness':/after (?:the )?event (?:start|occurr)|from (?:the )?event date/i.test(text)?'event_start':'not_stated',
        state:periods.length===1&&Boolean(evidence)&&sections.some(s=>s.sourceMode==='deterministic')?'official':'candidate',
        clauseIdentifiers:[...new Set([...text.matchAll(/Clause\s+(\d+(?:\.\d+)+)\s+is\s+amended/gi)].map(m=>m[1]!))],
        evidenceRefs:[...new Set(matches.filter(m=>m.days===days).map(m=>m.locator))].map(locator=>({sourceType:'contract' as const,sourceId:document.documentId,locator})),
        applicabilityNote:'Version dates assume prospective application. Confirm the contractual trigger, day basis and any retrospective effect before a notice-compliance conclusion.'});
    }
  }
  const changes=[...new Set(rules.map(r=>r.effectiveFromIso).filter((v):v is string=>Boolean(v)))].sort();
  return rules.map(rule=>({...rule,effectiveToIso:changes.find(date=>!rule.effectiveFromIso||date>rule.effectiveFromIso)??null}));
}

export function noticeVersionCohorts(notices:readonly {kind:string;actualIssuedAt:string|null}[],rules:readonly NoticeRequirement[]){
  return rules.map(rule=>({...rule,noticeCount:notices.filter(n=>n.kind!=='determination'&&n.actualIssuedAt&&
    (!rule.effectiveFromIso||n.actualIssuedAt.slice(0,10)>=rule.effectiveFromIso)&&
    (!rule.effectiveToIso||n.actualIssuedAt.slice(0,10)<rule.effectiveToIso)).length,
    basis:'Grouped by notice date for review only. Applicability depends on the contractual trigger and amendment effect.'}));
}
