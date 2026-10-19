import {dateValue} from '../../truth-kernel/src';
import type {NoticeRequirement} from '../../delay-analysis-core/src';
import type {ProjectRuntimeState} from './project-state-types';
import {noticeReviewBasis,reportingContractTermVersions} from './notice-review';
import {contractSourceAnalysis,CONTRACT_SOURCE_ANALYTICAL_NOTE,SOURCE_ANALYTICAL_USE} from './contract-source-analysis';

/** Extract explicit initial-claim periods with their contract version. Never
 * turn a document-wide topic count into a notice rule or apply an amendment
 * retrospectively merely because its period is shorter. */
export function contractNoticeRules(state:ProjectRuntimeState,noticeKind:'claim_notice'|'detailed_claim'='claim_notice'):NoticeRequirement[] {
  const rules:NoticeRequirement[]=[];
  const review=noticeKind==='claim_notice'?noticeReviewBasis(state):null;
  const labelledTerms=noticeKind==='claim_notice'?reportingContractTermVersions(state).filter(v=>v.term==='noticePeriodDays'):[];
  const selected=review?.decision?.choice==='choose_provisions';
  // An unadopted term cannot make an adopted notice rule unresolved.
  const adoptedTerms=labelledTerms.filter(t=>!t.sourceAnalyticalUse);
  const interpretationUnresolved=noticeKind==='claim_notice'&&(review?.decision?.choice==='refer_contracts'||(adoptedTerms.length?adoptedTerms:labelledTerms).some(t=>t.applicability==='unresolved'));
  // T04: the shared source-analytical rule; a unique fully read candidate is used and labelled.
  const sources=contractSourceAnalysis(state);
  for(const document of state.contractDocuments){
    if(!['main','amendment','replacement'].includes(document.role))continue;
    const evidence=state.evidenceDocuments.find(d=>d.documentId===document.documentId);
    if(!sources.eligible(document.documentId,true))continue;
    const unadopted=sources.unadopted(document.documentId);
    const pages=document.result.pdf?.pages??[];
    const sections=document.result.sections??[];
    const fragments=pages.length?pages.map(p=>({text:p.text,locator:'page:'+p.pageNumber})):
      sections.map(s=>({text:s.text,locator:s.startPage?'page:'+s.startPage:s.sectionKey}));
    const text=fragments.map(f=>f.text).join('\n');
    const pattern=noticeKind==='claim_notice'?/(?:current\s+)?initial\s+claim\s+notice\s*[:|\n]?\s*(\d+)\s+(?:calendar\s+)?days|initial\s+notice\s+of\s+claim\s+shall\s+be\s+given\s+within\s+(\d+)\s+(?:calendar\s+)?days/gi:
      /fully\s+detailed\s+claim\s*[:\n]?\s*(\d+)\s+(?:calendar\s+)?days|(?:fully\s+)?detailed\s+claim[^.]{0,100}?within\s+(\d+)\s+(?:calendar\s+)?days/gi;
    const matches=fragments.flatMap(f=>[...f.text.matchAll(pattern)].map(m=>({days:Number(m[1]??m[2]),locator:f.locator,context:f.text.slice(m.index!,m.index!+m[0].length+200).split(/\n\s*(?:Sub[- ]Clause|\d+\.\d+)/i)[0]??''})));
    for(const term of labelledTerms.filter(v=>v.documentId===document.documentId)){
      for(const ref of term.sourceRefs)matches.push({days:term.value,locator:ref.split(':').slice(-2).join(':'),context:text});
    }
    const periods=[...new Set(matches.map(m=>m.days))].filter(days=>!selected||labelledTerms.some(t=>t.documentId===document.documentId&&t.value===days));
    const effective=/Effective Date\s*[:|\n]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})/i.exec(text);
    const from=(effective?dateValue(effective[1]!):null)??labelledTerms.find(t=>t.documentId===document.documentId)?.effectiveFromIso??null;
    // An undated amendment must not overwrite the original rule.
    if(document.role==='amendment'&&!from)continue;
    for(const days of periods){
      const term=labelledTerms.find(t=>t.documentId===document.documentId&&t.value===days);
      const conflictingDayBasis=new Set(labelledTerms.filter(t=>t.documentId===document.documentId&&t.value===days).map(t=>t.unit)).size>1;
      const ruleText=matches.filter(m=>m.days===days).map(m=>m.context).join(' ');
      rules.push({requirementId:document.documentId+':'+noticeKind+':'+days,
        sourceFilename:evidence?.sourceFilename??document.documentId,
        noticeKind,eventCategories:[],noticePeriodDays:days,
        effectiveFromIso:term?.effectiveFromIso??from,effectiveToIso:term?.effectiveToIso??null,
        ...(term?.reviewReference?{reviewReference:term.reviewReference}:{}),
        applicabilityState:interpretationUnresolved||conflictingDayBasis||/retrospective|retroactive/i.test(text)?'unresolved':'established',
        ...(term?.unit.includes('working')?{sourceDayBasis:'working' as const}:{}),
        triggerBasis:/became aware|become aware|should have become aware/i.test(ruleText)?'awareness':/after (?:the )?event (?:start|occurr)|from (?:the )?event date/i.test(ruleText)?'event_start':'not_stated',
        // Read from an unadopted source: used and labelled, never 'official'.
        state:!unadopted&&periods.length===1&&Boolean(evidence)&&sections.some(s=>s.sourceMode==='deterministic')?'official':'candidate',
        ...(unadopted?{sourceAnalyticalUse:SOURCE_ANALYTICAL_USE,sourceAnalyticalNote:CONTRACT_SOURCE_ANALYTICAL_NOTE}:{}),
        clauseIdentifiers:[...new Set([...text.matchAll(/(?:Sub[- ]Clause|Clause|Article)\s+(\d+(?:\.\d+)*)/gi)].map(m=>m[1]!))],
        evidenceRefs:[...new Set(matches.filter(m=>m.days===days).map(m=>m.locator))].map(locator=>({sourceType:'contract' as const,sourceId:document.documentId,locator})),
        applicabilityNote:'Version dates assume prospective application. Confirm the contractual trigger, day basis and any retrospective effect before a notice-compliance conclusion.'});
    }
  }
  // An adopted notice rule is never erased, shortened or overridden by an
  // unadopted source: when adopted rules exist, a different unadopted period is
  // kept as a named source conflict and takes no part in the intervals.
  const adoptedRules=rules.filter(r=>!r.sourceAnalyticalUse);
  const sourceConflicts=adoptedRules.length?[...new Set(rules.filter(r=>r.sourceAnalyticalUse&&!adoptedRules.some(a=>a.noticePeriodDays===r.noticePeriodDays))
    .map(r=>'UNADOPTED_SOURCE_NOTICE_PERIOD_DIFFERS:'+noticeKind+':'+r.noticePeriodDays+' days:'+r.requirementId.split(':'+noticeKind+':')[0]))]:[];
  const used=adoptedRules.length?adoptedRules:rules;
  const changes=[...new Set(used.map(r=>r.effectiveFromIso).filter((v):v is string=>Boolean(v)))].sort();
  // Preserve source intervals even when a later provision is not selected:
  // excluding it cannot silently extend the earlier rule into that gap.
  return used.map(rule=>({...rule,effectiveToIso:rule.effectiveToIso??changes.find(date=>!rule.effectiveFromIso||date>rule.effectiveFromIso)??null,
    ...(sourceConflicts.length?{sourceConflicts}:{})}));
}

export function noticeVersionCohorts(notices:readonly {kind:string;actualIssuedAt:string|null}[],rules:readonly NoticeRequirement[]){
  return rules.map(rule=>({...rule,noticeCount:notices.filter(n=>n.kind!=='determination'&&n.actualIssuedAt&&
    (!rule.effectiveFromIso||n.actualIssuedAt.slice(0,10)>=rule.effectiveFromIso)&&
    (!rule.effectiveToIso||n.actualIssuedAt.slice(0,10)<rule.effectiveToIso)).length,
    basis:'Grouped by notice date for review only. Applicability depends on the contractual trigger and amendment effect.'}));
}
