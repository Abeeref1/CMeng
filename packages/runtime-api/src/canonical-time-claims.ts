import { createHash } from 'node:crypto';
import { cell, has, numberValue, dateValue, governedTables, norm, sumKnown, type SourceReceipt, type SourceRow, type SourceTable } from '../../truth-kernel/src';
import type { CanonicalClaimRecord, CanonicalDelayEvent, CanonicalNoticeRecord, DelayClaimsModel } from '../../delay-analysis-core/src';
import type { ContractTimeBasis } from '../../eot-assessment/src';
import type { ProjectRuntimeState } from './project-state-types';
import { inferDocumentType } from './evidence';
import { resolveClaimActivityCorrespondence } from '../../claim-activity-correspondence/src';
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
const splitRefs = (r:SourceRow,...names:string[]):string[] =>
  cell(r,...names)
    .split(/[;,|\n]+/)
    .map(value=>value.trim())
    .filter(Boolean);
const uniq = (values:readonly string[]):string[] => [...new Set(values)];

interface CorrespondenceLink {
  logicalId: string;
  claimId: string | null;
  eventId: string | null;
  issuedAt: string | null;
  subject: string | null;
  receipt: SourceReceipt;
}
function correspondenceLinks(tables: readonly SourceTable[], diagnostics: string[]): Map<string, CorrespondenceLink> {
  const links = new Map<string, CorrespondenceLink>();
  for (const table of tables) {
    const docType = norm((table.document as any).sourceFilename ?? "");
    const schemaLooksLikeCorrespondence =
      has(table,'letter id') || has(table,'letter no') || has(table,'letter number') ||
      has(table,'letter reference') || has(table,'correspondence id') ||
      (has(table,'reference') && (has(table,'subject') || has(table,'letter date') || has(table,'date')));
    if (!schemaLooksLikeCorrespondence && !/^l0?1\b/.test(docType)) continue;
    for (const row of table.rows) {
      const logicalId = cell(row,'letter id','letter no','letter number','letter reference','correspondence id','reference');
      if (!logicalId) continue;
      const key = norm(logicalId);
      const record: CorrespondenceLink = {
        logicalId,
        claimId: cell(row,'claim id','related claim id','claim reference') || null,
        eventId: cell(row,'event id','delay event id','related event id','event reference') || null,
        issuedAt: dateValue(cell(row,'letter date','date','issued date','notice date')),
        subject: cell(row,'subject','title','description') || null,
        receipt: row.receipt,
      };
      const previous = links.get(key);
      if (previous && (
        previous.claimId !== record.claimId ||
        previous.eventId !== record.eventId ||
        previous.issuedAt !== record.issuedAt ||
        previous.subject !== record.subject
      )) {
        links.delete(key);
        diagnostics.push('CONFLICTING_CORRESPONDENCE_ID:' + logicalId);
        continue;
      }
      if (!previous) links.set(key, record);
    }
  }
  return links;
}
function correspondenceRef(link: CorrespondenceLink) {
  return {
    sourceType: 'correspondence' as const,
    sourceId: link.receipt.documentId,
    locator: link.receipt.locator,
  };
}
function correspondenceNarrativeSegments(
  state: ProjectRuntimeState,
): Map<
  string,
  Array<{
    text: string;
    ref: {
      sourceType: "correspondence";
      sourceId: string;
      locator: string | null;
    };
  }>
> {
  const result =
    new Map<
      string,
      Array<{
        text: string;
        ref: {
          sourceType: "correspondence";
          sourceId: string;
          locator: string | null;
        };
      }>
    >();

  for (const document of state.evidenceDocuments) {
    if (
      document.documentType !==
        "letters_notices" ||
      !["active", "additive"].includes(
        document.basisState,
      )
    ) {
      continue;
    }

    for (const segment of document.textSegments ?? []) {
      if (
        segment.kind !==
          "linked_correspondence_context" ||
        segment.sourceHashSha256 !==
          document.sourceHashSha256 ||
        !segment.anchor.trim() ||
        !segment.text.trim()
      ) {
        continue;
      }

      const key =
        norm(
          segment.anchor,
        );
      const list =
        result.get(key) ??
        [];
      list.push({
        text:
          segment.text,
        ref: {
          sourceType:
            "correspondence",
          sourceId:
            document.documentId,
          locator:
            segment.locator,
        },
      });
      result.set(
        key,
        list,
      );
    }
  }

  return result;
}

export function projectControlSchedule(state:ProjectRuntimeState) {
  const basis=state.activeEvidenceBasis['schedule:control'] ?? state.activeEvidenceBasis['schedule:baseline'];
  if(basis?.activeArtifactId) return state.schedules.find(s=>s.revision.revisionId===basis.activeArtifactId) ?? null;

  const programmeTypes=new Set([
    'schedule_file',
    'schedule_baseline',
    'schedule_update',
    'schedule_revised_baseline',
    'schedule_recovery',
  ]);
  const hasProgrammeEvidence=state.evidenceDocuments.some(document=>{
    if(document.category!=='schedule')return false;
    const inferred=inferDocumentType(
      document.sourceRelativePath??document.sourceFilename,
      null,
    );
    return (
      programmeTypes.has(document.documentType) ||
      programmeTypes.has(inferred) ||
      document.linkedArtifactId!==null
    );
  });

  // If governed programme evidence exists but no active programme basis resolves,
  // fail closed. Legacy/misclassified schedule-control support documents must not
  // suppress an otherwise valid programme model.
  if(hasProgrammeEvidence) return null;
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
  const controlSchedule = projectControlSchedule(state);
  const scheduleActivityIds = new Set(
    controlSchedule?.revision.model.activities.map(activity=>activity.activityId) ?? [],
  );
  const activityByFolded = new Map<string,string>();
  const duplicateFolded = new Set<string>();
  for(const activityId of scheduleActivityIds){
    const folded=activityId.normalize("NFKC").trim().toLowerCase();
    if(activityByFolded.has(folded)&&activityByFolded.get(folded)!==activityId){
      duplicateFolded.add(folded);
      activityByFolded.delete(folded);
    }else if(!duplicateFolded.has(folded)){
      activityByFolded.set(folded,activityId);
    }
  }
  const mapActivityRefs=(values:readonly string[],context:string):string[]=>{
    const mapped:string[]=[];
    for(const raw of values){
      if(scheduleActivityIds.has(raw)){mapped.push(raw);continue;}
      const folded=raw.normalize("NFKC").trim().toLowerCase();
      const resolved=activityByFolded.get(folded);
      if(resolved){mapped.push(resolved);continue;}
      diagnostics.push("UNMAPPED_EXPLICIT_DELAY_ACTIVITY:"+context);
    }
    return uniq(mapped);
  };
  const normalizeNarrative=(value:string):string=>
    value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
  const activityNameCandidates=new Map<string,string>();
  const duplicateActivityNames=new Set<string>();
  for(const activity of controlSchedule?.revision.model.activities??[]){
    const normalized=normalizeNarrative(activity.name??"");
    const meaningfulTokens=normalized.split(" ").filter(token=>token.length>2);
    if(normalized.length<8||meaningfulTokens.length<2)continue;
    if(activityNameCandidates.has(normalized)&&activityNameCandidates.get(normalized)!==activity.activityId){
      duplicateActivityNames.add(normalized);
      activityNameCandidates.delete(normalized);
    }else if(!duplicateActivityNames.has(normalized)){
      activityNameCandidates.set(normalized,activity.activityId);
    }
  }
  const narrativeActivityRefs=(values:readonly string[],context:string):string[]=>{
    const mapped:string[]=[];
    const joined=values.filter(Boolean).join(" | ");
    const tokens=joined.match(/[A-Za-z0-9][A-Za-z0-9_.:/-]{2,}/g)??[];
    for(const token of tokens){
      const folded=token.normalize("NFKC").trim().toLowerCase();
      const resolved=activityByFolded.get(folded);
      if(resolved)mapped.push(resolved);
    }
    const narrative=normalizeNarrative(joined);
    if(narrative){
      for(const [name,activityId] of activityNameCandidates){
        if(
          narrative===name||
          narrative.includes(" "+name+" ")||
          narrative.startsWith(name+" ")||
          narrative.endsWith(" "+name)
        ){
          mapped.push(activityId);
        }
      }
    }
    const unique=uniq(mapped);
    if(unique.length>0)diagnostics.push("DERIVED_DELAY_ACTIVITY_FROM_EXACT_NARRATIVE_REFERENCE:"+context+":"+unique.length);
    return unique;
  };
  const programmeWindowReference=(anchorIso:string|null):string[]=>{
    if(!anchorIso)return[];
    const programmes=state.schedules.filter(item=>item.role!=="recovery");
    const official=programmes.filter(item=>["baseline","revised_baseline","update"].includes(item.role));
    const ordered=[...(official.length?official:programmes)].sort((a,b)=>{
      const ad=a.revision.model.dataDateIso??a.revision.effectiveAt??"";
      const bd=b.revision.model.dataDateIso??b.revision.effectiveAt??"";
      const byDate=ad.localeCompare(bd);
      return byDate!==0?byDate:a.revision.sequence-b.revision.sequence;
    });
    const anchor=Date.parse(anchorIso);
    if(!Number.isFinite(anchor))return[];
    for(let index=1;index<ordered.length;index+=1){
      const from=ordered[index-1]!,to=ordered[index]!;
      const fromIso=from.revision.model.dataDateIso??from.revision.effectiveAt;
      const toIso=to.revision.model.dataDateIso??to.revision.effectiveAt;
      if(!fromIso||!toIso)continue;
      const fromMs=Date.parse(fromIso),toMs=Date.parse(toIso);
      if(!Number.isFinite(fromMs)||!Number.isFinite(toMs))continue;
      if(anchor>fromMs&&anchor<=toMs){
        return[from.revision.revisionId+"->"+to.revision.revisionId];
      }
    }
    return[];
  };
  const correspondence = correspondenceLinks(tables, diagnostics);
  const correspondenceNarratives=correspondenceNarrativeSegments(state);
  const sourceTablesForClaims=tables.filter(t=>has(t,'claim id','event')&&has(t,'notice date'));
  const claimNarratives=new Map<string,string[]>();
  const claimDiagnosticSources=new Map<string,{
    tableDocumentId:string|null;
    tableSourceFilename:string|null;
    sourceLocator:string|null;
    columns:string[];
    rawFragments:Array<{column:string;value:string}>;
  }>();
  const explicitActivitiesByClaim=new Map<string,string[]>();
  const semanticNarrativeFragments=(row:SourceRow):Array<{column:string;value:string}> =>
    Object.entries(row.cells)
      .filter(([key,value]) =>
        value.trim() !== "" &&
        /(?:event|title|description|subject|location|discipline|trade|scope|area|zone|wbs|work package|cause|reason|impact|activity name|affected work)/i.test(key),
      )
      .map(([column,value])=>({column,value}));
  const semanticNarrativeValues=(row:SourceRow):string[] =>
    semanticNarrativeFragments(row).map(fragment=>fragment.value);
  const addClaimNarrative=(claimId:string,values:readonly string[]):void=>{
    const existing=claimNarratives.get(claimId)??[];
    claimNarratives.set(claimId,[...existing,...values.filter(Boolean)]);
  };
  const addExplicitActivities=(claimId:string,activityIds:readonly string[]):void=>{
    if(!activityIds.length)return;
    explicitActivitiesByClaim.set(
      claimId,
      uniq([...(explicitActivitiesByClaim.get(claimId)??[]),...activityIds]).sort(),
    );
  };
  const claims:CanonicalClaimRecord[]=[],events:CanonicalDelayEvent[]=[],notices:CanonicalNoticeRecord[]=[];
  const claimIds=new Set<string>();
  for(const table of sourceTablesForClaims) for(const r of table.rows){
    const claimId=cell(r,'claim id');if(!claimId)continue;
    if(claimIds.has(claimId)){diagnostics.push('DUPLICATE_CLAIM_ID_REQUIRES_REVISION_RECONCILIATION:'+claimId);continue;}claimIds.add(claimId);
    const eventId=cell(r,'event id')||claimId+':event',title=cell(r,'event','title')||claimId;
    const primarySemanticFragments=semanticNarrativeFragments(r);
    claimDiagnosticSources.set(claimId,{
      tableDocumentId:table.document.documentId??null,
      tableSourceFilename:table.document.sourceFilename??null,
      sourceLocator:r.receipt.locator??null,
      columns:primarySemanticFragments.map(fragment=>fragment.column),
      rawFragments:primarySemanticFragments,
    });
    const clause=cell(r,'clause'),clauseIdentifiers=clause?[clause]:[];
    const sourceLetter=cell(r,'linked letter');
    const linkedCorrespondence=sourceLetter?correspondence.get(norm(sourceLetter))??null:null;
    const linkedNarratives=sourceLetter?correspondenceNarratives.get(norm(sourceLetter))??[]:[];
    const semanticLinkVerified=!!linkedCorrespondence&&(
      (!linkedCorrespondence.claimId||norm(linkedCorrespondence.claimId)===norm(claimId)) &&
      (!linkedCorrespondence.eventId||norm(linkedCorrespondence.eventId)===norm(eventId))
    );
    const anchoredCorrespondenceVerified=linkedNarratives.length>0;
    const evidenceRefs=[
      evref(r),
      ...(linkedCorrespondence?[correspondenceRef(linkedCorrespondence)]:[]),
      ...linkedNarratives.map(item=>item.ref),
      ...(
        sourceLetter&&!linkedCorrespondence&&!anchoredCorrespondenceVerified
          ?[{sourceType:'correspondence' as const,sourceId:sourceLetter,locator:null}]
          :[]
      ),
    ];
    const explicitActivities=splitRefs(
      r,
      'activity id','activity ids','related activity id','related activity ids',
      'schedule activity','schedule activity id','schedule activity ids',
      'p6 activity','p6 activity id','p6 activity ids',
      'affected activity','affected activity id','affected activity ids',
      'impacted activity','impacted activity id','impacted activity ids',
      'critical activity','critical activity id','critical activity ids',
      'activity reference','activity references'
    );
    const explicitWindows=splitRefs(
      r,
      'window id','window ids','delay window','delay window id','delay window ids',
      'window','window reference','window references','analysis window','analysis window id','time window'
    );
    const registerIssued=dateValue(cell(r,'notice date'));
    addClaimNarrative(
      claimId,
      [
        ...primarySemanticFragments.map(fragment=>fragment.value),
        linkedCorrespondence?.subject??"",
        ...linkedNarratives.map(item=>item.text),
      ],
    );
    const governedExplicitActivities=mapActivityRefs(explicitActivities,claimId);
    addExplicitActivities(claimId,governedExplicitActivities);
    const temporalWindows=programmeWindowReference(registerIssued);
    const relatedActivities=uniq([
      ...governedExplicitActivities,
    ]).sort();
    const relatedWindows=uniq([
      ...explicitWindows,
      ...temporalWindows,
    ]);
    events.push({eventId,title,category:'other',
      startIso:dateValue(cell(r,'event start','event start date','start date','delay start','from date','impact start','analysis start')),
      endIso:dateValue(cell(r,'event end','event end date','end date','delay end','to date','impact end','analysis end')),
      responsibility:'unknown',responsibilityState:'missing',describedImpactDays:n(r,'days claimed','claimed days'),describedImpactState:'candidate',
      relatedActivityIds:relatedActivities,
      relatedWindowReferences:relatedWindows,
      relatedClauseIdentifiers:clauseIdentifiers,evidenceRefs,
      diagnostics:[
        'SOURCE_REGISTER_EVENT_NOT_PROVEN_CAUSATION',
        ...(governedExplicitActivities.length?['ACTIVITY_LINK_FROM_GOVERNED_EXPLICIT_SCHEDULE_REFERENCE']:[]),
        ...(temporalWindows.length?['WINDOW_ASSOCIATION_FROM_VERIFIED_NOTICE_DATE_NOT_CAUSATION']:[]),
        ...(sourceLetter&&!linkedCorrespondence&&!anchoredCorrespondenceVerified?['LINKED_CORRESPONDENCE_NOT_FOUND:'+sourceLetter]:sourceLetter&&linkedCorrespondence&&!semanticLinkVerified?['LINKED_CORRESPONDENCE_SEMANTIC_MISMATCH:'+sourceLetter]:(semanticLinkVerified||anchoredCorrespondenceVerified)?['LINKED_CORRESPONDENCE_VERIFIED:'+sourceLetter,...(anchoredCorrespondenceVerified?['LINKED_CORRESPONDENCE_NARRATIVE_VERIFIED:'+sourceLetter]:[])]:[])
      ],});
    const correspondenceIssued=semanticLinkVerified?linkedCorrespondence?.issuedAt??null:null;
    const issued=registerIssued??correspondenceIssued;
    if(registerIssued&&correspondenceIssued&&registerIssued!==correspondenceIssued)diagnostics.push('NOTICE_DATE_CONFLICT:'+claimId+':'+sourceLetter);
    claims.push({claimId,title,state:claimStatus(cell(r,'status')),eventIds:[eventId],submittedAt:dateValue(cell(r,'submitted date','submission date')),
      claimedDays:n(r,'days claimed','claimed days'),claimedAmount:n(r,'claimed amount'),assessedDays:n(r,'source granted days','days granted'),assessedDaysState:n(r,'source granted days','days granted')===null?'missing':'candidate',
      assessedAmount:null,assessedAmountState:'missing',clauseIdentifiers,evidenceRefs,diagnostics:['REGISTER_ASSESSMENT_IS_NOT_ENGINEER_DETERMINATION']});
    if(issued)notices.push({noticeId:sourceLetter||claimId+':notice',kind:'claim_notice',eventId,claimId,actualIssuedAt:issued,actualReceivedAt:null,plannedAt:null,subject:title,clauseIdentifiers,evidenceRefs:[evref(r,'notice')],diagnostics:['NOTICE_DATE_FROM_REGISTER_NOT_EVENT_START_DATE']});
  }
  const byClaim=new Map(claims.map(c=>[c.claimId,c]));
  const eventById=new Map(events.map(event=>[event.eventId,event]));
  for(const table of tables.filter(t=>has(t,'claim id')))for(const r of table.rows){
    const claimId=cell(r,'claim id');
    const c=byClaim.get(claimId);
    if(!c)continue;
    const explicitEventId=cell(r,'event id','delay event id','related event id','event reference');
    const targetEventId=explicitEventId||c.eventIds[0]||'';
    const event=eventById.get(targetEventId);
    if(!event){
      if(explicitEventId)diagnostics.push('SUPPLEMENTAL_EVENT_ID_NOT_IN_CLAIM_REGISTER:'+claimId);
      continue;
    }
    if(explicitEventId&&c.eventIds.length>0&&!c.eventIds.includes(explicitEventId)){
      diagnostics.push('SUPPLEMENTAL_EVENT_ID_CONFLICT:'+claimId);
      continue;
    }

    const activityRefs=splitRefs(
      r,
      'activity id','activity ids','related activity id','related activity ids',
      'schedule activity','schedule activity id','schedule activity ids',
      'p6 activity','p6 activity id','p6 activity ids',
      'affected activity','affected activity id','affected activity ids',
      'impacted activity','impacted activity id','impacted activity ids',
      'critical activity','critical activity id','critical activity ids',
      'activity reference','activity references'
    );
    addClaimNarrative(claimId,semanticNarrativeValues(r));
    const supplementalLetters=splitRefs(
      r,
      'linked letter','source letter','letter reference','correspondence reference'
    );
    const supplementalNarratives=supplementalLetters.flatMap(
      letter=>correspondenceNarratives.get(norm(letter))??[],
    );
    addClaimNarrative(
      claimId,
      supplementalNarratives.map(item=>item.text),
    );
    for(const narrative of supplementalNarratives){
      if(!event.evidenceRefs.some(existing=>existing.sourceId===narrative.ref.sourceId&&existing.locator===narrative.ref.locator)){
        event.evidenceRefs.push(narrative.ref);
      }
      if(!c.evidenceRefs.some(existing=>existing.sourceId===narrative.ref.sourceId&&existing.locator===narrative.ref.locator)){
        c.evidenceRefs.push(narrative.ref);
      }
    }
    const mappedExplicitActivities=mapActivityRefs(activityRefs,claimId);
    addExplicitActivities(claimId,mappedExplicitActivities);
    const mappedActivities=uniq([
      ...mappedExplicitActivities,
    ]);
    if(mappedActivities.length){
      event.relatedActivityIds=uniq([...event.relatedActivityIds,...mappedActivities]).sort();
      if(!event.diagnostics.includes('EXPLICIT_ACTIVITY_LINK_FROM_SUPPLEMENTAL_CLAIM_EOT_SOURCE')){
        event.diagnostics.push('EXPLICIT_ACTIVITY_LINK_FROM_SUPPLEMENTAL_CLAIM_EOT_SOURCE');
      }
    }

    const windowRefs=splitRefs(
      r,
      'window id','window ids','delay window','delay window id','delay window ids',
      'window','window reference','window references','analysis window','analysis window id','time window'
    );
    if(windowRefs.length){
      event.relatedWindowReferences=uniq([...(event.relatedWindowReferences??[]),...windowRefs]);
      if(!event.diagnostics.includes('EXPLICIT_WINDOW_REFERENCE_FROM_SUPPLEMENTAL_CLAIM_EOT_SOURCE')){
        event.diagnostics.push('EXPLICIT_WINDOW_REFERENCE_FROM_SUPPLEMENTAL_CLAIM_EOT_SOURCE');
      }
    }

    const fragmentStart=dateValue(cell(
      r,'event start','event start date','start date','delay start','from date','impact start','analysis start'
    ));
    const fragmentEnd=dateValue(cell(
      r,'event end','event end date','end date','delay end','to date','impact end','analysis end'
    ));
    if(event.startIso===null&&fragmentStart!==null){
      event.startIso=fragmentStart;
      event.diagnostics.push('EVENT_START_FROM_SUPPLEMENTAL_CLAIM_EOT_SOURCE');
    }else if(event.startIso!==null&&fragmentStart!==null&&event.startIso!==fragmentStart){
      event.diagnostics.push('CONFLICTING_EVENT_START_IN_SUPPLEMENTAL_SOURCE');
    }
    if(event.endIso===null&&fragmentEnd!==null){
      event.endIso=fragmentEnd;
      event.diagnostics.push('EVENT_END_FROM_SUPPLEMENTAL_CLAIM_EOT_SOURCE');
    }else if(event.endIso!==null&&fragmentEnd!==null&&event.endIso!==fragmentEnd){
      event.diagnostics.push('CONFLICTING_EVENT_END_IN_SUPPLEMENTAL_SOURCE');
    }

    const clauses=splitRefs(r,'clause','clause reference','clause references','contract clause');
    if(clauses.length)event.relatedClauseIdentifiers=uniq([...event.relatedClauseIdentifiers,...clauses]);
    const ref=evref(r);
    if(!event.evidenceRefs.some(existing=>existing.sourceId===ref.sourceId&&existing.locator===ref.locator)){
      event.evidenceRefs.push(ref);
    }
    if(!c.evidenceRefs.some(existing=>existing.sourceId===ref.sourceId&&existing.locator===ref.locator)){
      c.evidenceRefs.push(ref);
    }
  }

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
    const c=byClaim.get(record.claimId);
    const event=c?events.find(e=>e.eventId===c.eventIds[0]):null;
    const determinationLetter=record.sourceLetter?correspondence.get(norm(record.sourceLetter))??null:null;
    const determinationNarratives=record.sourceLetter?correspondenceNarratives.get(norm(record.sourceLetter))??[]:[];
    const determinationRefs=[
      evref(r),
      ...(determinationLetter?[correspondenceRef(determinationLetter)]:[]),
      ...determinationNarratives.map(item=>item.ref),
    ];
    if(c){
      c.evidenceRefs.push(...determinationRefs);
      addClaimNarrative(
        record.claimId,
        determinationNarratives.map(item=>item.text),
      );
    }else diagnostics.push('ORPHAN_DETERMINATION:'+record.determinationId);
    if(event)event.evidenceRefs.push(...determinationRefs);
    if(record.sourceLetter&&!determinationLetter&&!determinationNarratives.length)diagnostics.push('DETERMINATION_CORRESPONDENCE_NOT_FOUND:'+record.determinationId+':'+record.sourceLetter);
    notices.push({noticeId:record.determinationId,kind:'determination',eventId:c?.eventIds[0]??null,claimId:record.claimId,actualIssuedAt:record.determinationDate,actualReceivedAt:null,plannedAt:null,subject:'Engineer determination '+record.determinationId,clauseIdentifiers:[],evidenceRefs:[evref(r,'notice'),...(determinationLetter?[correspondenceRef(determinationLetter)]:[]),...determinationNarratives.map(item=>item.ref)],diagnostics:(determinationLetter||determinationNarratives.length)?['DETERMINATION_CORRESPONDENCE_LINK_VERIFIED',...(determinationNarratives.length?['DETERMINATION_CORRESPONDENCE_NARRATIVE_VERIFIED']:[]),...(record.sourceLetter?['SOURCE_LETTER:'+record.sourceLetter]:[])]:record.sourceLetter?['DETERMINATION_CORRESPONDENCE_UNVERIFIED','SOURCE_LETTER:'+record.sourceLetter]:[]});
  }
  if(controlSchedule){
    const claimsByEventId=new Map<string,CanonicalClaimRecord[]>();
    for(const claim of claims){
      for(const eventId of claim.eventIds){
        const list=claimsByEventId.get(eventId)??[];
        list.push(claim);
        claimsByEventId.set(eventId,list);
      }
    }

    for(const event of events){
      const eventClaims=claimsByEventId.get(event.eventId)??[];
      const narrative=[
        event.title,
        ...eventClaims.map(claim=>claim.title),
        ...eventClaims.flatMap(claim=>claimNarratives.get(claim.claimId)??[]),
      ].filter(Boolean).join(" | ");
      const explicitActivityIds=uniq(
        eventClaims.flatMap(claim=>explicitActivitiesByClaim.get(claim.claimId)??[]),
      );
      const resolution=resolveClaimActivityCorrespondence({
        claimId:eventClaims[0]?.claimId??event.eventId,
        eventId:event.eventId,
        narrative,
        claimEvidenceRefs:event.evidenceRefs,
        schedule:controlSchedule.revision.model,
        explicitActivityIds,
        aiScores:null,
        maxCandidates:8,
        ...(
          eventClaims[0] &&
          claimDiagnosticSources.has(eventClaims[0].claimId)
            ? {
                diagnosticSource:
                  claimDiagnosticSources.get(eventClaims[0].claimId)!,
              }
            : {}
        ),
      });
      event.activityCorrespondence=resolution;
      if(resolution.acceptedActivityIds.length){
        event.relatedActivityIds=uniq([
          ...event.relatedActivityIds,
          ...resolution.acceptedActivityIds,
        ]).sort();
        event.diagnostics.push(
          "ACTIVITY_CORRESPONDENCE_ACCEPTED:"+resolution.classification,
          "ACTIVITY_CORRESPONDENCE_IS_ASSOCIATION_NOT_CAUSATION_OR_ENTITLEMENT",
        );
      }else{
        event.diagnostics.push(
          "ACTIVITY_CORRESPONDENCE_WITHHELD:"+resolution.classification,
        );
      }
    }
  }else{
    diagnostics.push("CLAIM_ACTIVITY_CORRESPONDENCE_REQUIRES_ACTIVE_PROGRAMME");
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
      incorporatedEotDays:amendment.incorporatedEotDays,additionalApprovedEotDays:null,overlapResolution:'unresolved',registerDeterminationDays,
      registerDeterminationCount:eligible.length,effectiveDeterminationCount:effective.length,
      futureDeterminationCount:eligible.filter(d=>dataDateIso!==null&&d.determinationDate!==null&&d.determinationDate>dataDateIso).length,dataDateIso,
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
