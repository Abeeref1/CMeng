import { createHash } from 'node:crypto';
import { cell, has, numberValue, dateValue, governedTables, sumKnown, type SourceReceipt, type SourceRow } from '../../truth-kernel/src';
import type { CanonicalClaimRecord, CanonicalDelayEvent, CanonicalNoticeRecord, DelayClaimsModel } from '../../delay-analysis-core/src';
import type { ContractTimeBasis } from '../../eot-assessment/src';
import type { ProjectRuntimeState } from './project-state-types';
export interface DeterminationRecord {
  determinationId: string; claimId: string; awardedDays: number | null; determinationDate: string | null;
  state: 'source_immutable' | 'candidate' | 'conflicted'; authority: string; sourceLetter: string | null;
  supersedes: string | null; incorporatedInAmendment: string | null; receipt: SourceReceipt;
}
export interface AmendmentTimeRecord {
  documentId: string; effectiveDate: string | null; completionIso: string; incorporatedEotDays: number | null;
  state: 'official' | 'candidate'; receipt: SourceReceipt;
}
export interface CanonicalTimeClaims {
  producerVersion: 'canonical-time-claims-v1'; dataDateIso: string | null;
  delayClaims: DelayClaimsModel | null; contractTimeBasis: ContractTimeBasis | null;
  determinations: DeterminationRecord[]; amendments: AmendmentTimeRecord[];
  registerDeterminationDays: number | null; effectiveDeterminationDays: number | null;
  futureDeterminationCount: number; diagnostics: string[];
}
const cache = new WeakMap<ProjectRuntimeState,{version:number;value:CanonicalTimeClaims}>();
const n = (r:SourceRow,...names:string[])=>numberValue(cell(r,...names));
const evref = (r:SourceRow,sourceType:'claim'|'notice'|'other'='claim')=>({sourceType,sourceId:r.receipt.documentId,locator:r.receipt.locator});
export function projectControlSchedule(state:ProjectRuntimeState) {
  const basis=state.activeEvidenceBasis['schedule:control'] ?? state.activeEvidenceBasis['schedule:baseline'];
  if(basis?.activeArtifactId) return state.schedules.find(s=>s.revision.revisionId===basis.activeArtifactId) ?? null;
  // Manually supplied models without an evidence register remain supported.
  if(state.evidenceDocuments.some(d=>d.category==='schedule')) return null;
  return state.schedules.filter(s=>s.role!=='recovery').sort((a,b)=>a.revision.sequence-b.revision.sequence).at(-1) ?? null;
}
export function projectDataDate(state:ProjectRuntimeState):string|null {
  return dateValue(projectControlSchedule(state)?.revision.model.dataDateIso ?? '');
}
function claimStatus(s:string):CanonicalClaimRecord['state'] {
  return /reject/i.test(s)?'rejected':/withdraw/i.test(s)?'withdrawn':/determined/i.test(s)?'determined':/assess|review/i.test(s)?'under_review':/submit/i.test(s)?'submitted':'unknown';
}
export function canonicalTimeClaims(state:ProjectRuntimeState,force=false):CanonicalTimeClaims {
  const old=cache.get(state);if(!force&&old?.version===state.version)return old.value;
  const diagnostics:string[]=[], tables=governedTables(state.evidenceDocuments,diagnostics),dataDateIso=projectDataDate(state);
  const sourceTablesForClaims=tables.filter(t=>has(t,'claim id','event')&&has(t,'notice date'));
  const claims:CanonicalClaimRecord[]=[],events:CanonicalDelayEvent[]=[],notices:CanonicalNoticeRecord[]=[];
  const claimIds=new Set<string>();
  for(const table of sourceTablesForClaims) for(const r of table.rows){
    const claimId=cell(r,'claim id');if(!claimId)continue;
    if(claimIds.has(claimId)){diagnostics.push('DUPLICATE_CLAIM_ID_REQUIRES_REVISION_RECONCILIATION:'+claimId);continue;}claimIds.add(claimId);
    const eventId=cell(r,'event id')||claimId+':event',title=cell(r,'event','title')||claimId;
    const clause=cell(r,'clause'),clauseIdentifiers=clause?[clause]:[];
    const sourceLetter=cell(r,'linked letter');const evidenceRefs=[evref(r),...(sourceLetter?[{sourceType:'correspondence' as const,sourceId:sourceLetter,locator:null}]:[])];
    events.push({eventId,title,category:'other',startIso:dateValue(cell(r,'event start','start date')),endIso:dateValue(cell(r,'event end','end date')),
      responsibility:'unknown',responsibilityState:'missing',describedImpactDays:n(r,'days claimed','claimed days'),describedImpactState:'candidate',
      relatedActivityIds:cell(r,'activity id','related activity ids').split(/[;,|]/).map(s=>s.trim()).filter(Boolean),relatedClauseIdentifiers:clauseIdentifiers,evidenceRefs,
      diagnostics:['SOURCE_REGISTER_EVENT_NOT_PROVEN_CAUSATION',...(sourceLetter?['LINKED_LETTER_CONTENT_NOT_YET_VERIFIED']:[])],});
    const issued=dateValue(cell(r,'notice date'));
    claims.push({claimId,title,state:claimStatus(cell(r,'status')),eventIds:[eventId],submittedAt:dateValue(cell(r,'submitted date','submission date')),
      claimedDays:n(r,'days claimed','claimed days'),claimedAmount:n(r,'claimed amount'),assessedDays:n(r,'source granted days','days granted'),assessedDaysState:n(r,'source granted days','days granted')===null?'missing':'candidate',
      assessedAmount:null,assessedAmountState:'missing',clauseIdentifiers,evidenceRefs,diagnostics:['REGISTER_ASSESSMENT_IS_NOT_ENGINEER_DETERMINATION']});
    if(issued)notices.push({noticeId:sourceLetter||claimId+':notice',kind:'claim_notice',eventId,claimId,actualIssuedAt:issued,actualReceivedAt:null,plannedAt:null,subject:title,clauseIdentifiers,evidenceRefs:[evref(r,'notice')],diagnostics:['NOTICE_DATE_FROM_REGISTER_NOT_EVENT_START_DATE']});
  }
  const byClaim=new Map(claims.map(c=>[c.claimId,c]));
  for(const table of tables.filter(t=>has(t,'claim id','net assessed impact days')||has(t,'claim id','assessed days')))for(const r of table.rows){
    const c=byClaim.get(cell(r,'claim id'));if(!c){diagnostics.push('ORPHAN_ASSESSMENT:'+cell(r,'claim id'));continue;}
    const assessed=n(r,'assessed days','net assessed impact days');
    if(c.assessedDays!==null&&assessed!==null&&c.assessedDays!==assessed){c.diagnostics.push('PARALLEL_ASSESSMENT_VALUES_DIFFER');}
    if(has(table,'assessed days')||c.assessedDays===null){c.assessedDays=assessed;c.assessedDaysState=assessed===null?'missing':'candidate';}
    c.evidenceRefs.push(evref(r));
    const event=events.find(e=>e.eventId===c.eventIds[0]);if(event)event.evidenceRefs.push(evref(r));
  }
  const determinations:DeterminationRecord[]=[],determinationById=new Map<string,DeterminationRecord>();
  for(const table of tables.filter(t=>has(t,'determination id','claim id','awarded eot days')))for(const r of table.rows){
    const record:DeterminationRecord={determinationId:cell(r,'determination id'),claimId:cell(r,'claim id'),awardedDays:n(r,'awarded eot days'),determinationDate:dateValue(cell(r,'determination date')),
      state:/^engineer$/i.test(cell(r,'authority'))&&/^immutable$/i.test(cell(r,'governance state'))&&/^determined$/i.test(cell(r,'status'))&&['active','additive'].includes(r.receipt.basisState)?'source_immutable':'candidate',
      authority:cell(r,'authority'),sourceLetter:cell(r,'source letter')||null,supersedes:cell(r,'supersedes','supersedes determination id')||null,incorporatedInAmendment:cell(r,'incorporated in amendment','amendment id')||null,receipt:{...r.receipt,authority:'engineer_determination'}};
    if(!record.determinationId)continue;
    const previous=determinationById.get(record.determinationId);
    if(previous){if(previous.awardedDays!==record.awardedDays||previous.claimId!==record.claimId||previous.determinationDate!==record.determinationDate){previous.state='conflicted';diagnostics.push('IMMUTABLE_DETERMINATION_CONFLICT:'+record.determinationId);}continue;}
    determinationById.set(record.determinationId,record);determinations.push(record);
    const c=byClaim.get(record.claimId);if(c)c.evidenceRefs.push(evref(r));else diagnostics.push('ORPHAN_DETERMINATION:'+record.determinationId);
    notices.push({noticeId:record.sourceLetter||record.determinationId,kind:'determination',eventId:c?.eventIds[0]??null,claimId:record.claimId,actualIssuedAt:record.determinationDate,actualReceivedAt:null,plannedAt:null,subject:'Engineer determination '+record.determinationId,clauseIdentifiers:[],evidenceRefs:[evref(r,'notice')],diagnostics:[]});
  }
  // Validate lineage once, but resolve supersession separately for each reporting cutoff.
  for (const d of determinations.filter(d => d.state === 'source_immutable' && d.supersedes)) {
    const prior = determinationById.get(d.supersedes!);
    if (!prior || prior.claimId !== d.claimId || !d.determinationDate || !prior.determinationDate ||
        d.determinationDate <= prior.determinationDate) {
      diagnostics.push('INVALID_DETERMINATION_SUPERSESSION:' + d.determinationId);
      d.state = 'conflicted';
    }
  }
  function population(cutoff: string | null) {
    const dated = determinations.filter(d => cutoff === null ||
      (d.determinationDate !== null && d.determinationDate <= cutoff));
    const accepted = dated.filter(d => d.state === 'source_immutable');
    const superseded = new Set(accepted.map(d => d.supersedes).filter(Boolean));
    return accepted.filter(d => !superseded.has(d.determinationId));
  }
  const eligible = population(null);
  const registerDeterminationDays = determinations.some(d => d.state === 'conflicted') ? null :
    sumKnown(eligible.map(d => d.awardedDays));
  const effective = dataDateIso === null ? [] : population(dataDateIso);
  const asOfConflict = determinations.some(d => d.state === 'conflicted' &&
    (d.determinationDate === null || dataDateIso !== null && d.determinationDate <= dataDateIso));
  const effectiveDeterminationDays = asOfConflict || dataDateIso === null ||
    eligible.some(d => d.determinationDate === null) ? null :
    effective.length ? sumKnown(effective.map(d => d.awardedDays)) : eligible.length ? 0 : null;
  const amendments:AmendmentTimeRecord[]=[];
  for(const contract of state.contractDocuments.filter(c=>c.role==='amendment')){
    const doc=state.evidenceDocuments.find(d=>d.documentId===contract.documentId);if(!doc||!['active','additive','candidate'].includes(doc.basisState))continue;
    const sections=contract.result.sections;const text=sections.map(s=>s.text).join('\n');
    const dates=[...text.matchAll(/revised contractual completion(?:\s+date)?(?:\s+is)?\s*[:\n]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})/gi)].map(m=>dateValue(m[1]!)).filter((v):v is string=>v!==null);
    const unique=[...new Set(dates)];if(unique.length!==1){if(unique.length>1)diagnostics.push('CONFLICTING_AMENDMENT_COMPLETION:'+doc.documentId);continue;}
    const effectiveMatch=/Effective Date\s*[:\n]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})/i.exec(text);
    const extension=/extended by\s+(\d+)\s+calendar days|EOT Granted\s*[:\n]?\s*(\d+)\s+calendar days/i.exec(text);
    const section=sections.find(s=>s.text.includes(unique[0]!)||/revised contractual completion/i.test(s.text));
    const deterministic=section?.sourceMode==='deterministic';
    amendments.push({documentId:doc.documentId,effectiveDate:effectiveMatch?dateValue(effectiveMatch[1]!):null,completionIso:unique[0]!,incorporatedEotDays:extension?numberValue(extension[1]??extension[2]??''):null,
      state:['active','additive'].includes(doc.basisState)&&deterministic?'official':'candidate',
      receipt:{documentId:doc.documentId,sourceHash:doc.sourceHashSha256,revision:doc.linkedArtifactId??doc.sourceHashSha256,locator:section?.startPage?'page:'+section.startPage:section?.sectionKey??'contract',basisState:doc.basisState,authority:'source_approved'}});
  }
  const applicable=amendments.filter(a=>a.effectiveDate!==null&&dataDateIso!==null&&a.effectiveDate<=dataDateIso).sort((a,b)=>a.effectiveDate!.localeCompare(b.effectiveDate!));
  const officialApplicable = applicable.filter(a => a.state === 'official');
  const selection = officialApplicable.length ? officialApplicable : applicable;
  const amendment=selection.at(-1); const sameEffective=selection.filter(a=>a.effectiveDate===amendment?.effectiveDate);
  if (officialApplicable.length && applicable.some(a => a.state === 'candidate')) diagnostics.push('CANDIDATE_AMENDMENT_NOT_APPLIED');
  const amendmentConflict=new Set(sameEffective.map(a=>a.completionIso)).size>1;
  let contractTimeBasis:ContractTimeBasis|null=null;
  if(amendment&&!amendmentConflict){
    contractTimeBasis={contractualCompletionIso:amendment.completionIso,contractualCompletionState:amendment.state,
      officialApprovedEotDays:effectiveDeterminationDays,officialApprovedEotState:effectiveDeterminationDays===null?'missing':'official',eotDayBasis:'calendar_days',eotDayBasisState:amendment.state,
      sourceRefs:[...new Set([amendment.receipt,...eligible.map(d=>d.receipt)].map(r=>'evidence-document:'+r.documentId+':'+r.locator))],
      incorporatedEotDays:amendment.incorporatedEotDays,additionalApprovedEotDays:null,overlapResolution:'unresolved',registerDeterminationDays,dataDateIso,
    };
    if(determinations.length)diagnostics.push('AMENDMENT_DETERMINATION_OVERLAP_UNRESOLVED_NO_ADDITIONAL_DAYS_APPLIED');
  }
  if(amendmentConflict)diagnostics.push('CONFLICTING_EFFECTIVE_AMENDMENTS');
  const delayClaims:DelayClaimsModel|null=claims.length?{projectId:state.projectId,evidenceRevisionId:'canonical-evidence:'+createHash('sha256').update(JSON.stringify(tables.filter(t=>has(t,'claim id')).map(t=>[t.document.documentId,t.document.sourceHashSha256,t.document.basisState]))).digest('hex'),events,claims,notices,noticeRequirements:[],diagnostics:['EVENT_IDENTITIES_ESTABLISHED_FROM_SOURCE_REGISTER_CAUSATION_REMAINS_UNPROVEN',...diagnostics]}:null;
  const result:CanonicalTimeClaims={producerVersion:'canonical-time-claims-v1',dataDateIso,delayClaims,contractTimeBasis,determinations,amendments,registerDeterminationDays,effectiveDeterminationDays,futureDeterminationCount:eligible.filter(d=>dataDateIso!==null&&d.determinationDate!==null&&d.determinationDate>dataDateIso).length,diagnostics};
  cache.set(state,{version:state.version,value:result});return result;
}
export function synchronizeCanonicalTimeClaims(state:ProjectRuntimeState,force=false):void{
  const model=canonicalTimeClaims(state,force),existing=state.controls.delayClaims;
  if(model.delayClaims && (!existing||/^(canonical-evidence|evidence-document):/.test(existing.evidenceRevisionId))){
    state.controls.delayClaims=model.delayClaims;
    for(const event of model.delayClaims?.events??[]){
      const fingerprint=createHash('sha256').update(JSON.stringify(event)).digest('hex');
      const last=state.delayEventHistory.filter(h=>h.eventId===event.eventId).at(-1);if(last?.fingerprint===fingerprint)continue;
      state.delayEventHistory.push({eventId:event.eventId,version:(last?.version??0)+1,fingerprint,effectiveAt:new Date().toISOString(),supersedesVersion:last?.version??null,evidenceRevisionId:model.delayClaims!.evidenceRevisionId,snapshot:JSON.parse(JSON.stringify(event))});
    }
  }
  if (!model.delayClaims && existing?.evidenceRevisionId.startsWith('canonical-evidence:')) state.controls.delayClaims = null;
  const existingTime=state.controls.contractTimeBasis;
  if (!model.contractTimeBasis && existingTime?.overlapResolution && existingTime.sourceRefs.length && existingTime.sourceRefs.every(r => r.startsWith('evidence-document:'))) state.controls.contractTimeBasis = null;
  if(model.contractTimeBasis && (!existingTime||(existingTime.sourceRefs.length>0&&existingTime.sourceRefs.every(r=>r.startsWith('evidence-document:')))))state.controls.contractTimeBasis=model.contractTimeBasis;
}
