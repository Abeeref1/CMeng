import {applyEotOverlapDecision,isSourceDerivedTimeBasis} from './source-review-decisions';
import {isAdoptedProgrammeRevision,isScenarioRevision} from './schedule-authority';
import {keepsUserConfirmedCompletion,completionHeldByAdoptedBasis,completionSourceLabel,contractCompletionPosition,withoutCompletionSourceLabel} from './contract-completion';
import { createHash } from 'node:crypto';
import { cell, has, numberValue, dateValue, governedTables, norm, sumKnown, type SourceReceipt, type SourceRow, type SourceTable } from '../../truth-kernel/src';
import type { CanonicalClaimRecord, CanonicalDelayEvent, CanonicalNoticeRecord, DelayClaimsModel } from '../../delay-analysis-core/src';
import type { ContractTimeBasis } from '../../eot-assessment/src';
import type { ProjectRuntimeState } from './project-state-types';
import { inferDocumentType } from './evidence';
import { resolveClaimActivityCorrespondence } from '../../claim-activity-correspondence/src';
import type {ClaimActivityCorrespondenceInput,ClaimActivityCorrespondenceResolution} from '../../claim-activity-correspondence/src';
import { contractNoticeRules } from './contract-notice-rules';
import { detailedClaimTimeBar } from './detailed-claim-time-bar';
import { reportedClaim } from '../../delay-analysis-core/src/reporting';
export interface DeterminationRecord {
  determinationId: string; claimId: string; awardedDays: number | null; determinationDate: string | null;
  state: 'source_immutable' | 'candidate' | 'conflicted'; authority: string; sourceLetter: string | null;
  supersedes: string | null; incorporatedInAmendment: string | null; receipt: SourceReceipt;
  correspondenceReview?: {identityFound:boolean;awardTextDays:number|null;awardMatchesRegister:boolean|null;basis:string};
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
/** One deterministic association pass per source event/project version. A
 * rebuilt reporting view may have different object identity even though its
 * programme and claim sources are unchanged. Version/revision plus an exact
 * input fingerprint make that reuse safe without masking changed evidence. */
const claimAssociationCache=new Map<string,{
  version:number;revisionId:string;resolutions:Map<string,{fingerprint:string;result:ClaimActivityCorrespondenceResolution}>
}>();
function versionedClaimAssociation(state:ProjectRuntimeState,input:ClaimActivityCorrespondenceInput):ClaimActivityCorrespondenceResolution{
  const revisionId=input.schedule.sourceRevisionId;
  let cached=claimAssociationCache.get(state.projectId);
  if(!cached||cached.version!==state.version||cached.revisionId!==revisionId){
    cached={version:state.version,revisionId,resolutions:new Map()};
    // Avoid keeping entire old project populations alive across deployments.
    if(claimAssociationCache.size>=40)claimAssociationCache.delete(claimAssociationCache.keys().next().value!);
    claimAssociationCache.set(state.projectId,cached);
  }
  const fingerprint=createHash('sha256').update(JSON.stringify([
    input.eventId,input.claimId,input.narrative,input.explicitActivityIds,
    input.claimEvidenceRefs,input.maxCandidates,input.aiScores,revisionId,
    input.schedule.activities.length,input.schedule.wbs?.length??0,
  ])).digest('hex');
  const prior=cached.resolutions.get(input.eventId);
  if(prior?.fingerprint===fingerprint)return prior.result;
  const result=resolveClaimActivityCorrespondence(input);
  cached.resolutions.set(input.eventId,{fingerprint,result});
  return result;
}


const sequenceNumber=(value:string,pattern:RegExp):number|null=>{
  const match=pattern.exec(value.trim());
  if(!match)return null;
  const parsed=Number(match[1]);
  return Number.isInteger(parsed)&&parsed>0?parsed:null;
};

/**
 * Fail closed on a large generated-looking claim population. This is deliberately
 * narrow: sequential generic claim/event identities, matching sequential letter
 * references, zero schedule linkage and an arithmetic claimed-day prefix must all
 * be present. The source rows stay retained for audit; they are not promoted into
 * project-control truth until the source is replaced or independently verified.
 */
export function assessClaimPopulationIntegrity(
  claims:readonly CanonicalClaimRecord[],
  events:readonly CanonicalDelayEvent[],
  sourceLettersByClaim:ReadonlyMap<string,string>,
  sourceFilenames:readonly string[]=[],
){
  const eventById=new Map(events.map(event=>[event.eventId,event]));
  let genericClaimEventPairCount=0,genericNoticePairCount=0;
  const numberedDays:Array<{claimNumber:number;claimedDays:number}>=[];
  for(const claim of claims){
    const claimNumber=sequenceNumber(claim.claimId,/^CLM[-_\s]?0*(\d+)$/i);
    const event=claim.eventIds.map(id=>eventById.get(id)).find(Boolean);
    const eventNumber=event?sequenceNumber(event.title,/^Delay\s+event\s+0*(\d+)$/i):null;
    if(claimNumber!==null&&eventNumber===claimNumber)genericClaimEventPairCount+=1;
    const noticeNumber=sequenceNumber(sourceLettersByClaim.get(claim.claimId)??"",/^LTR[-_\s]?C[-_\s]?0*(\d+)$/i);
    if(claimNumber!==null&&noticeNumber===claimNumber)genericNoticePairCount+=1;
    if(claimNumber!==null&&claim.claimedDays!==null&&Number.isFinite(claim.claimedDays)){
      numberedDays.push({claimNumber,claimedDays:claim.claimedDays});
    }
  }
  numberedDays.sort((a,b)=>a.claimNumber-b.claimNumber);
  let arithmeticClaimedDaysPrefixLength=0;
  if(numberedDays.length>=2&&numberedDays[0]!.claimNumber===1&&numberedDays[1]!.claimNumber===2){
    const delta=numberedDays[1]!.claimedDays-numberedDays[0]!.claimedDays;
    if(Number.isFinite(delta)&&Math.abs(delta)>1e-9){
      arithmeticClaimedDaysPrefixLength=2;
      for(let index=2;index<numberedDays.length;index+=1){
        const previous=numberedDays[index-1]!,current=numberedDays[index]!;
        if(current.claimNumber!==previous.claimNumber+1)break;
        if(Math.abs((current.claimedDays-previous.claimedDays)-delta)>1e-9)break;
        arithmeticClaimedDaysPrefixLength+=1;
      }
    }
  }
  const linkedActivityEventCount=events.filter(event=>
    event.relatedActivityIds.length>0||
    (event.activityCorrespondence?.acceptedActivityIds.length??0)>0
  ).length;
  const sourceClaimCount=claims.length;
  const pairCoverage=sourceClaimCount?genericClaimEventPairCount/sourceClaimCount:0;
  const noticeCoverage=sourceClaimCount?genericNoticePairCount/sourceClaimCount:0;
  // A sequence or arithmetic pattern is not proof that a real register is synthetic.
  // Keep it as a non-blocking source-quality observation. Genuine conflicts,
  // missing approvals and supersession checks are still evaluated per record.
  const patternDetected=
    sourceClaimCount>=25&&pairCoverage>=0.9&&noticeCoverage>=0.9&&
    linkedActivityEventCount===0&&arithmeticClaimedDaysPrefixLength>=5;
  const reasons=patternDetected?["CLAIM_SOURCE_PATTERN_INFORMATION_ONLY"]:[];
  return {
    state:"accepted" as const,
    sourceClaimCount,
    quarantinedClaimCount:0,
    linkedActivityEventCount,
    genericClaimEventPairCount,
    genericNoticePairCount,
    arithmeticClaimedDaysPrefixLength,
    sourceFilenames:[...new Set(sourceFilenames.filter(Boolean))].sort(),
    reasons,
  };
}

const n = (r:SourceRow,...names:string[])=>numberValue(cell(r,...names));
const evref = (r:SourceRow,sourceType:'claim'|'notice'|'other'='claim')=>({sourceType,sourceId:r.receipt.documentId,locator:r.receipt.locator});
const splitRefs = (r:SourceRow,...names:string[]):string[] =>
  cell(r,...names)
    .split(/[;,|\n]+/)
    .map(value=>value.trim())
    .filter(Boolean);
const uniq = (values:readonly string[]):string[] => [...new Set(values)];
const correspondenceIdentity=(text:string)=>text.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,'').toLowerCase();
/** A reference in another letter's body does not make that letter the notice. */
function ownLetterReference(text:string,reference:string){
  const header=/\bReference\s*:\s*([^\n\r]+)/i.exec(text)?.[1]?.trim();
  return Boolean(header)&&correspondenceIdentity(header!)===correspondenceIdentity(reference);
}

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
  if(basis?.activeArtifactId){
    const selected=state.schedules.find(s=>s.revision.revisionId===basis.activeArtifactId&&!isScenarioRevision(s)) ?? null;
    // An evidence-family selection is not itself programme adoption. A current
    // analytical programme exists only after the exact schedule revision has a
    // source-bound adoption decision. Until then every schedule-dependent
    // calculation must fail closed rather than silently treating the upload as
    // the Current Programme.
    return selected&&isAdoptedProgrammeRevision(state,selected)?selected:null;
  }

  const programmeTypes=new Set([
    'schedule_file',
    'schedule_baseline',
    'schedule_update',
    'schedule_revised_baseline',
    'schedule_recovery', 'schedule_scenario',
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
  const eligible=state.schedules.filter(s=>!isScenarioRevision(s)&&dateValue(s.revision.model.dataDateIso??''));
  const latest=eligible.map(s=>dateValue(s.revision.model.dataDateIso!)!).sort().at(-1);
  const newest=eligible.filter(s=>dateValue(s.revision.model.dataDateIso!)===latest);
  return newest.length===1?newest[0]!:null;
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
    const programmes=state.schedules.filter(item=>!isScenarioRevision(item));
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
  const sourceLettersByClaim=new Map<string,string>();
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
  // F47: the contract's own detailed-claim rule (notice calculator rules), read once.
  const detailedClaimRules=contractNoticeRules(state,'detailed_claim');
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
    const sourceLetter=cell(
      r,
      'linked letter',
      'notice reference',
      'notice ref',
      'letter reference',
      'letter no',
      'letter number',
    );
    if(sourceLetter)sourceLettersByClaim.set(claimId,sourceLetter);
    const linkedCorrespondence=sourceLetter?correspondence.get(norm(sourceLetter))??null:null;
    const linkedNarratives=sourceLetter?correspondenceNarratives.get(norm(sourceLetter))??[]:[];
    const semanticLinkVerified=!!linkedCorrespondence&&(
      (!linkedCorrespondence.claimId||norm(linkedCorrespondence.claimId)===norm(claimId)) &&
      (!linkedCorrespondence.eventId||norm(linkedCorrespondence.eventId)===norm(eventId))
    );
    const identityNarratives=linkedNarratives.filter(item=>ownLetterReference(item.text,sourceLetter));
    const anchoredCorrespondenceVerified=identityNarratives.length>0;
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
    const responsibilityText=cell(r,'responsibility');
    const responsibilityValue=/employer|client|owner/i.test(responsibilityText)?'employer'
      :/contractor/i.test(responsibilityText)?'contractor'
      :/concurrent|shared/i.test(responsibilityText)?'concurrent'
      :/neutral|authority|weather|force majeure/i.test(responsibilityText)?'neutral'
      :'unknown';
    const eventStart=dateValue(cell(r,'event start','event start date','start date','delay start','from date','impact start','analysis start'));
    const awarenessIso=dateValue(cell(r,'awareness date'));
    events.push({eventId,title,category:'other',identitySource:'claims_register_row',
      startIso:eventStart,
      awarenessIso,
      endIso:dateValue(cell(r,'event end','event end date','end date','delay end','to date','impact end','analysis end')),
      responsibility:responsibilityValue,responsibilityState:responsibilityText?'candidate':'missing',describedImpactDays:n(r,'days claimed','claimed days'),describedImpactState:'candidate',
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
    const claim=claims.at(-1)!;
    // F13: the register's responsibility, awareness and determination columns are
    // carried on the claim as source values (unknown stays null, never inferred).
    const detailedSubmitted=dateValue(cell(r,'detailed claim date','fully detailed claim date','detailed submission date','claim submission date','submission date'));
    const determinationText=cell(r,'determination','engineer determination','determination status','determination outcome')||null;
    const determinationDateIso=dateValue(cell(r,'determination date'));
    const determinationDays=n(r,'determined days','determination days','awarded days','awarded eot days');
    const determinationReference=cell(r,'determination id','determination reference','determination ref')||null;
    claim.sourceRegister={...reportedClaim(claim),sourceStatus:cell(r,'status')||'Not stated',registerGrantedDays:n(r,'source granted days','days granted'),
      responsibility:responsibilityValue,responsibilitySourceText:responsibilityText||null,awarenessIso,eventStartIso:eventStart,detailedClaimSubmittedIso:detailedSubmitted,
      registerDetermination:determinationText||determinationDateIso||determinationDays!==null||determinationReference?{text:determinationText,dateIso:determinationDateIso,days:determinationDays,reference:determinationReference}:null,
      detailedClaimTimeBar:detailedClaimTimeBar({awarenessIso,eventStartIso:eventStart,submittedIso:detailedSubmitted,cutoffIso:dataDateIso?dateValue(dataDateIso):null},detailedClaimRules)};
    if(issued)notices.push({noticeId:sourceLetter||claimId+':notice',kind:'claim_notice',eventId,claimId,actualIssuedAt:issued,actualReceivedAt:null,plannedAt:null,subject:title,clauseIdentifiers,evidenceRefs:[evref(r,'notice')],diagnostics:['NOTICE_DATE_FROM_REGISTER_NOT_EVENT_START_DATE']});
    if(issued&&sourceLetter){
      notices.at(-1)!.correspondenceEvidence={sourceLetter,identityFound:Boolean(linkedCorrespondence)||anchoredCorrespondenceVerified,
        mentionedOnly:linkedNarratives.length>0&&!anchoredCorrespondenceVerified&&!linkedCorrespondence,
        noticeContentLinked:Boolean(linkedCorrespondence&&(linkedCorrespondence.claimId||linkedCorrespondence.eventId)&&semanticLinkVerified&&linkedCorrespondence.issuedAt),
        evidenceRefs:[...(linkedCorrespondence?[correspondenceRef(linkedCorrespondence)]:[]),...identityNarratives.map(n=>n.ref)]};
    }
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
    c.sourceRegister={...reportedClaim(c),assessedDays:c.assessedDays,
      employerDelayDays:n(r,'employer delay days'),contractorDelayDays:n(r,'contractor delay days'),
      evidenceRefs:[...c.evidenceRefs],diagnostics:[...c.diagnostics]};
    const event=events.find(e=>e.eventId===c.eventIds[0]);if(event)event.evidenceRefs.push(evref(r));
  }


  const determinations:DeterminationRecord[]=[],determinationById=new Map<string,DeterminationRecord>();
  for(const table of tables.filter(t=>has(t,'determination id','claim id','awarded eot days')))for(const r of table.rows){
    const awardedDays=n(r,'awarded eot days');
    const determinationDate=dateValue(cell(r,'determination date'));
    const authorityText=cell(r,'authority');
    const governanceText=cell(r,'governance state');
    const statusText=cell(r,'status');
    const explicitAuthorityOk=!authorityText||/engineer|employer representative|contract administrator/i.test(authorityText);
    const explicitGovernanceOk=!governanceText||/immutable|official|approved|final/i.test(governanceText);
    const explicitStatusOk=!statusText||/determined|approved|awarded|final/i.test(statusText);
    const determinationRegister=/determination/i.test(table.document.documentType??'')||has(table,'determination id','claim id','awarded eot days');
    const sourceDetermination=determinationRegister&&awardedDays!==null&&determinationDate!==null&&explicitAuthorityOk&&explicitGovernanceOk&&explicitStatusOk&&['active','additive'].includes(r.receipt.basisState);
    const record:DeterminationRecord={determinationId:cell(r,'determination id'),claimId:cell(r,'claim id'),awardedDays,determinationDate,
      state:sourceDetermination?'source_immutable':'candidate',
      authority:authorityText||'Engineer determination register',sourceLetter:cell(r,'source letter')||null,supersedes:cell(r,'supersedes','supersedes determination id')||null,incorporatedInAmendment:cell(r,'incorporated in amendment','amendment id')||null,receipt:{...r.receipt,authority:'engineer_determination'}};
    if(!record.determinationId)continue;
    const previous=determinationById.get(record.determinationId);
    if(previous){if(previous.awardedDays!==record.awardedDays||previous.claimId!==record.claimId||previous.determinationDate!==record.determinationDate){previous.state='conflicted';diagnostics.push('IMMUTABLE_DETERMINATION_CONFLICT:'+record.determinationId);}continue;}
    determinationById.set(record.determinationId,record);determinations.push(record);
    const c=byClaim.get(record.claimId);
    const event=c?events.find(e=>e.eventId===c.eventIds[0]):null;
    const determinationLetter=record.sourceLetter?correspondence.get(norm(record.sourceLetter))??null:null;
    const determinationNarratives=record.sourceLetter?correspondenceNarratives.get(norm(record.sourceLetter))??[]:[];
    const ownDeterminationNarratives=determinationNarratives.filter(n=>ownLetterReference(n.text,record.sourceLetter!));
    const ownDeterminationText=ownDeterminationNarratives.map(n=>n.text).join('\n');
    const awards=[...new Set([...ownDeterminationText.matchAll(/(?:determines\s+that|awards?)\s+(\d+(?:\.\d+)?)\s+(?:calendar\s+)?days(?:\s+of\s+extension\s+of\s+time)?/gi)].map(m=>Number(m[1])))];
    record.correspondenceReview={identityFound:Boolean(determinationLetter)||Boolean(ownDeterminationText),
      awardTextDays:awards.length===1?awards[0]!:null,
      awardMatchesRegister:awards.length===1&&record.awardedDays!==null?awards[0]===record.awardedDays:null,
      basis:ownDeterminationText?'Letter identity found; compare its award, date and claim reference with the register.':'Register award only; matching determination letter not confirmed in extracted pages. Check unread pages and original letter identities.'};
    const determinationRefs=[
      evref(r),
      ...(determinationLetter?[correspondenceRef(determinationLetter)]:[]),
      ...ownDeterminationNarratives.map(item=>item.ref),
    ];
    if(c){
      c.evidenceRefs.push(...determinationRefs);
      addClaimNarrative(
        record.claimId,
        ownDeterminationNarratives.map(item=>item.text),
      );
    }else diagnostics.push('ORPHAN_DETERMINATION:'+record.determinationId);
    if(event)event.evidenceRefs.push(...determinationRefs);
    if(record.sourceLetter&&!determinationLetter&&!ownDeterminationNarratives.length)diagnostics.push('DETERMINATION_LETTER_NOT_CONFIRMED_IN_READ_PAGES:'+record.determinationId+':'+record.sourceLetter);
    notices.push({noticeId:record.determinationId,kind:'determination',eventId:c?.eventIds[0]??null,claimId:record.claimId,actualIssuedAt:record.determinationDate,actualReceivedAt:null,plannedAt:null,subject:'Engineer determination '+record.determinationId,clauseIdentifiers:[],evidenceRefs:[evref(r,'notice'),...(determinationLetter?[correspondenceRef(determinationLetter)]:[]),...ownDeterminationNarratives.map(item=>item.ref)],diagnostics:(determinationLetter||ownDeterminationNarratives.length)?['DETERMINATION_LETTER_IDENTITY_FOUND_CONTENT_REQUIRES_REVIEW',...(ownDeterminationNarratives.length?['DETERMINATION_LETTER_HEADER_MATCHED']:[]),...(record.sourceLetter?['SOURCE_LETTER:'+record.sourceLetter]:[])]:record.sourceLetter?['DETERMINATION_CORRESPONDENCE_UNVERIFIED','SOURCE_LETTER:'+record.sourceLetter]:[]});
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
      const resolution=versionedClaimAssociation(state,{
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

  const claimIntegrity=assessClaimPopulationIntegrity(
    claims,
    events,
    sourceLettersByClaim,
    [...new Set([...claimDiagnosticSources.values()].map(source=>source.tableSourceFilename).filter((value):value is string=>Boolean(value)))],
  );
  // Source identity patterns do not remove retained claim, notice, event or
  // determination records from analysis. Status and authority stay per-record.
  // SW-15: delay events come only from event sources. An event/delay register
  // (event id with an event date or description, and no claim id) gives events; a
  // notice register row that states an event id gives a notice-stated event. A claim
  // row is never an event: a claim-cited reference with the same id is merged into
  // the source event (its links kept), and the event's dates come from the source.
  const eventSourceTables=tables.filter(t=>has(t,'event id')&&!has(t,'claim id')&&
    ['event date','event start','event start date','start date','delay start','description','event description','event','title'].some(h=>has(t,h)));
  const sourceEventIds=new Set<string>();
  for(const table of eventSourceTables)for(const r of table.rows){
    const eventId=cell(r,'event id');if(!eventId)continue;
    if(sourceEventIds.has(eventId)){diagnostics.push('DUPLICATE_EVENT_ID_IN_EVENT_SOURCE:'+eventId);continue;}
    sourceEventIds.add(eventId);
    const noticeStated=['notice date','notice reference','letter reference','letter no','issued date'].some(h=>has(table,h));
    const cited=events.filter(event=>event.eventId===eventId);
    const responsibilityText=cell(r,'responsibility','cause');
    const responsibility=/employer|client|owner/i.test(responsibilityText)?'employer'
      :/contractor/i.test(responsibilityText)?'contractor'
      :/concurrent|shared/i.test(responsibilityText)?'concurrent'
      :/neutral|authority|weather|force majeure/i.test(responsibilityText)?'neutral'
      :'unknown';
    const clause=cell(r,'clause');
    const sourceEvent:CanonicalDelayEvent={eventId,title:cell(r,'description','event description','event','title')||cited[0]?.title||eventId,category:'other',
      identitySource:noticeStated?'notice':'event_register',
      startIso:dateValue(cell(r,'event date','event start','event start date','start date','delay start','from date')),
      awarenessIso:dateValue(cell(r,'awareness date')),
      endIso:dateValue(cell(r,'event end','event end date','end date','delay end','to date')),
      responsibility:responsibility==='unknown'&&cited[0]?cited[0].responsibility:responsibility,
      responsibilityState:responsibility!=='unknown'?'candidate':cited[0]?.responsibilityState??'missing',
      describedImpactDays:cited[0]?.describedImpactDays??null,describedImpactState:cited[0]?.describedImpactState??'missing',
      relatedActivityIds:uniq(cited.flatMap(event=>event.relatedActivityIds)).sort(),
      ...(cited.find(event=>event.activityCorrespondence)?{activityCorrespondence:cited.find(event=>event.activityCorrespondence)!.activityCorrespondence}:{}),
      relatedWindowReferences:uniq(cited.flatMap(event=>event.relatedWindowReferences??[])),
      relatedClauseIdentifiers:uniq([...(clause?[clause]:[]),...cited.flatMap(event=>event.relatedClauseIdentifiers)]),
      evidenceRefs:[{sourceType:noticeStated?'notice':'other',sourceId:r.receipt.documentId,locator:r.receipt.locator},...cited.flatMap(event=>event.evidenceRefs)],
      diagnostics:[noticeStated?'EVENT_FROM_NOTICE_STATING_EVENT':'EVENT_FROM_EVENT_REGISTER','SOURCE_REGISTER_EVENT_NOT_PROVEN_CAUSATION',...(cited.length?['CLAIM_CITED_EVENT_REFERENCES_MERGED:'+cited.length]:[])]};
    for(let index=events.length-1;index>=0;index-=1)if(events[index]!.eventId===eventId)events.splice(index,1);
    events.push(sourceEvent);
  }
  // SW-15: a claim-cited event reference keeps its links but never an event date.
  for(const event of events)if(event.identitySource==='claims_register_row'){event.startIso=null;event.awarenessIso=null;event.endIso=null;}
  const trustedClaims=claims;
  const trustedEvents=events;
  const trustedNotices=notices;
  const trustedDeterminations=determinations;
  if(claimIntegrity.reasons.length)diagnostics.push("CLAIM_SOURCE_PATTERN_INFORMATION_ONLY:"+claimIntegrity.sourceClaimCount);

  // Validate lineage once, but resolve supersession separately for each reporting cutoff.
  for (const d of trustedDeterminations.filter(d => d.state === 'source_immutable' && d.supersedes)) {
    const prior = determinationById.get(d.supersedes!);
    if (!prior || prior.claimId !== d.claimId || !d.determinationDate || !prior.determinationDate ||
        d.determinationDate <= prior.determinationDate) {
      diagnostics.push('INVALID_DETERMINATION_SUPERSESSION:' + d.determinationId);
      d.state = 'conflicted';
    }
  }
  function population(cutoff: string | null) {
    const dated = trustedDeterminations.filter(d => cutoff === null ||
      (d.determinationDate !== null && d.determinationDate <= cutoff));
    const accepted = dated.filter(d => d.state === 'source_immutable');
    const superseded = new Set(accepted.map(d => d.supersedes).filter(Boolean));
    return accepted.filter(d => !superseded.has(d.determinationId));
  }
  const eligible = population(null);
  const registerDeterminationDays = determinations.some(d => d.state === 'conflicted') ? null :
    sumKnown(eligible.map(d => d.awardedDays));
  const effective = dataDateIso === null ? [] : population(dataDateIso);
  const asOfConflict = trustedDeterminations.some(d => d.state === 'conflicted' &&
    (d.determinationDate === null || dataDateIso !== null && d.determinationDate <= dataDateIso));
  const effectiveDeterminationDays = asOfConflict || dataDateIso === null ||
    eligible.some(d => d.determinationDate === null) ? null :
    effective.length ? sumKnown(effective.map(d => d.awardedDays)) : eligible.length ? 0 : null;
  const completion=contractCompletionPosition(state,dataDateIso);
  const amendmentRead=state.evidenceDocuments.some(d=>d.basisState==='candidate'&&state.contractDocuments.some(c=>c.documentId===d.documentId&&c.role==='amendment'))?contractCompletionPosition(state,dataDateIso,true):completion;
  const amendments:AmendmentTimeRecord[]=[];
  for(const contract of state.contractDocuments.filter(c=>c.role==='amendment')){
    const doc=state.evidenceDocuments.find(d=>d.documentId===contract.documentId);if(!doc||!['active','additive','candidate'].includes(doc.basisState))continue;
    const sections=contract.result.sections;const text=sections.map(s=>s.text).join('\n');
    const completionCandidates=amendmentRead.candidates.filter(c=>c.documentId===doc.documentId&&!c.historical);
    const unique=[...new Set(completionCandidates.map(c=>c.date))];
    if(unique.length!==1){if(unique.length>1)diagnostics.push('CONFLICTING_AMENDMENT_COMPLETION:'+doc.documentId);continue;}
    const effectiveDate=completionCandidates[0]?.effectiveFrom??null;
    const extension=/extended by\s+(\d+)\s+calendar days|EOT Granted\s*[:\n]?\s*(\d+)\s+calendar days/i.exec(text);
    const section=sections.find(s=>s.text.includes(unique[0]!)||/revised contractual completion/i.test(s.text));
    const deterministic=completionCandidates.some(candidate=>candidate.sourceVerified===true);
    amendments.push({documentId:doc.documentId,effectiveDate,completionIso:unique[0]!,incorporatedEotDays:extension?numberValue(extension[1]??extension[2]??''):null,
      state:['active','additive'].includes(doc.basisState)&&deterministic?'official':'candidate',
      receipt:{documentId:doc.documentId,sourceHash:doc.sourceHashSha256,revision:doc.linkedArtifactId??doc.sourceHashSha256,locator:section?.startPage?'page:'+section.startPage:section?.sectionKey??'contract',basisState:doc.basisState,authority:'source_approved'}});
  }
  const applicable=amendments.filter(a=>a.effectiveDate!==null&&dataDateIso!==null&&a.effectiveDate<=dataDateIso).sort((a,b)=>a.effectiveDate!.localeCompare(b.effectiveDate!));
  const officialApplicable = applicable.filter(a => a.state === 'official');
  const selection = officialApplicable.length ? officialApplicable : applicable;
  const amendment=selection.at(-1); const sameEffective=selection.filter(a=>a.effectiveDate===amendment?.effectiveDate);
  if (officialApplicable.length && applicable.some(a => a.state === 'candidate')) diagnostics.push('CANDIDATE_AMENDMENT_NOT_APPLIED');
  const amendmentConflict=new Set(sameEffective.map(a=>a.completionIso)).size>1;
  // An explicit user confirmation from Actions required is a governed reporting
  // authority when no stronger contract/amendment source has replaced it. Keep it
  // in the canonical time position so every page reads the same confirmed date.
  // Approved EOT days entered by the user (C2) are held the same way.
  const confirmedManualBasis=state.controls.contractTimeBasis?.sourceRefs.some(ref=>ref.startsWith('user-confirmation:contract-completion:')||ref.startsWith('user-confirmation:approved-eot-days:'))
    ? state.controls.contractTimeBasis
    : null;
  let contractTimeBasis:ContractTimeBasis|null=confirmedManualBasis?{...confirmedManualBasis,sourceRefs:[...confirmedManualBasis.sourceRefs]}:null;
  if(amendment&&!amendmentConflict){
    // C2: a user-entered award stays held while the sources establish none,
    // as the reporting time basis keeps it, so every page shows one value.
    const userAward=effectiveDeterminationDays===null&&confirmedManualBasis?.officialApprovedEotDays!=null&&
      confirmedManualBasis.sourceRefs.some(ref=>ref.startsWith('user-confirmation:approved-eot-days:'))?confirmedManualBasis:null;
    contractTimeBasis={contractualCompletionIso:amendment.completionIso,contractualCompletionState:amendment.state,
      officialApprovedEotDays:userAward?userAward.officialApprovedEotDays:effectiveDeterminationDays,
      officialApprovedEotState:userAward?userAward.officialApprovedEotState:effectiveDeterminationDays===null?'missing':'official',eotDayBasis:'calendar_days',eotDayBasisState:amendment.state,
      sourceRefs:[...new Set([...[amendment.receipt,...eligible.map(d=>d.receipt)].map(r=>'evidence-document:'+r.documentId+':'+r.locator),
        ...(userAward?userAward.sourceRefs.filter(ref=>ref.startsWith('user-confirmation:approved-eot-days:')):[])])],
      incorporatedEotDays:amendment.incorporatedEotDays,additionalApprovedEotDays:null,overlapResolution:'unresolved',registerDeterminationDays,
      registerDeterminationCount:eligible.length,effectiveDeterminationCount:effective.length,
      futureDeterminationCount:eligible.filter(d=>dataDateIso!==null&&d.determinationDate!==null&&d.determinationDate>dataDateIso).length,dataDateIso,
    };
    if(trustedDeterminations.length)diagnostics.push('AMENDMENT_DETERMINATION_OVERLAP_UNRESOLVED_NO_ADDITIONAL_DAYS_APPLIED');
  }
  if(amendmentConflict)diagnostics.push('CONFLICTING_EFFECTIVE_AMENDMENTS');
  // T04: a date read only from a unique, fully read unadopted contract is used
  // with state 'candidate' and its label; it never replaces an adopted or
  // user-confirmed date, which keeps the different date as a named conflict.
  const heldByAdopted=completionHeldByAdoptedBasis(contractTimeBasis??state.controls.contractTimeBasis,completion);
  if(heldByAdopted){
    const previous=(contractTimeBasis??state.controls.contractTimeBasis)!;
    if(heldByAdopted.length){contractTimeBasis={...previous,sourceRefs:[...(previous.sourceRefs??[])],contractualCompletionSourceConflicts:[...new Set([...(previous.contractualCompletionSourceConflicts??[]),...heldByAdopted])]};diagnostics.push(...heldByAdopted);}
  }
  // An adopted contract without a completion line must not erase a user-confirmed date.
  else if((completion.hasContractDocuments||completion.hasSourceAnalyticalDocuments)&&!(!amendment&&keepsUserConfirmedCompletion(confirmedManualBasis,completion))){
    const previous=withoutCompletionSourceLabel(contractTimeBasis??state.controls.contractTimeBasis);
    const completionAlreadyAmended=completion.value!==null&&completion.candidates.some(candidate=>
      candidate.role==='amendment'&&candidate.date===completion.value&&candidate.effectiveFrom!==null&&dataDateIso!==null&&candidate.effectiveFrom<=dataDateIso
    );
    const determinationOnlyExtension=!amendment&&!completionAlreadyAmended&&completion.state==='official'&&effectiveDeterminationDays!==null;
    const effectiveDeterminationRefs=effective.map(d=>'evidence-document:'+d.receipt.documentId+':'+d.receipt.locator);
    contractTimeBasis={...previous,...completionSourceLabel(completion),contractualCompletionIso:completion.value,contractualCompletionState:completion.state,completionReason:completion.reason,
      officialApprovedEotDays:determinationOnlyExtension?effectiveDeterminationDays:previous?.officialApprovedEotDays??null,
      officialApprovedEotState:determinationOnlyExtension?'official':previous?.officialApprovedEotState??'missing',
      eotDayBasis:determinationOnlyExtension?'calendar_days':previous?.eotDayBasis??'unknown',
      eotDayBasisState:determinationOnlyExtension?'official':previous?.eotDayBasisState??'missing',
      ...(determinationOnlyExtension?{
        incorporatedEotDays:null,
        additionalApprovedEotDays:effectiveDeterminationDays,
        overlapResolution:'resolved' as const,
        registerDeterminationDays,
        registerDeterminationCount:eligible.length,
        effectiveDeterminationCount:effective.length,
        futureDeterminationCount:eligible.filter(d=>dataDateIso!==null&&d.determinationDate!==null&&d.determinationDate>dataDateIso).length,
        dataDateIso,
      }:{}),
      sourceRefs:[...new Set([...(previous?.sourceRefs??[]),...completion.sourceRefs,...(determinationOnlyExtension?effectiveDeterminationRefs:[])])]};
    if(determinationOnlyExtension)diagnostics.push('OFFICIAL_DETERMINATIONS_APPLIED_TO_UNAMENDED_CONTRACT_COMPLETION');
    if(completion.reason&&!completion.sourceAnalyticalUse)diagnostics.push('CONTRACT_COMPLETION_UNRESOLVED:'+completion.reason);
    if(completion.sourceAnalyticalUse)diagnostics.push('SOURCE_ANALYTICAL_NOT_ADOPTED:contract-completion');
    diagnostics.push(...completion.sourceConflicts);
  }

  // A governed award is not erased merely because the importer did not
  // populate a day-basis field. Resolve explicit working-day definitions
  // first; absent those, show a calendar-day assumption as a qualified date.
  if(contractTimeBasis&&contractTimeBasis.officialApprovedEotDays!==null&&
     contractTimeBasis.officialApprovedEotDays>0&&contractTimeBasis.eotDayBasis==='unknown'){
    const contractText=state.contractDocuments.filter(document=>['main','replacement','amendment'].includes(document.role))
      .filter(document=>state.evidenceDocuments.some(source=>source.documentId===document.documentId&&
        ['active','additive'].includes(source.basisState)))
      .flatMap(document=>[...document.result.sections.map(section=>section.text),
        ...(document.result.pdf?.pages??[]).filter(page=>page.method==='native').map(page=>page.text)]).join('\n');
    const explicitWorking=/(?:a\s+)?days?\s+(?:shall\s+)?(?:mean|means|be|constitute)\s+(?:a\s+)?working\s+days?/i.test(contractText);
    const explicitCalendar=/(?:a\s+)?days?\s+(?:shall\s+)?(?:mean|means|be|constitute)\s+(?:a\s+)?calendar\s+days?/i.test(contractText);
    contractTimeBasis={...contractTimeBasis,
      eotDayBasis:explicitWorking?'working_days':'calendar_days',
      eotDayBasisState:explicitWorking||explicitCalendar?'official':'candidate'};
    if(!explicitWorking&&!explicitCalendar)diagnostics.push('EOT_CALENDAR_DAYS_ASSUMED_CHECK_CONTRACT_DEFINITION');
  }

  if(contractTimeBasis?.overlapResolution==='unresolved'){
    const confirmed=applyEotOverlapDecision(state,contractTimeBasis);
    if(confirmed?.overlapResolution==='resolved'){
      contractTimeBasis=confirmed;
      const index=diagnostics.indexOf('AMENDMENT_DETERMINATION_OVERLAP_UNRESOLVED_NO_ADDITIONAL_DAYS_APPLIED');
      if(index>=0)diagnostics.splice(index,1);
      diagnostics.push('AMENDMENT_DETERMINATION_OVERLAP_CONFIRMED:'+confirmed.additionalApprovedEotDays);
    }
  }

  for(const claim of claims){
    const reported=reportedClaim(claim);
    const conflict=reported.state==='determined'&&!trustedDeterminations.some(d=>d.claimId===claim.claimId);
    claim.sourceRegister={...reported,evidenceRefs:[...claim.evidenceRefs],diagnostics:[...new Set([...reported.diagnostics,...claim.diagnostics,...(conflict?['REGISTER_DETERMINED_STATUS_NOT_IN_DETERMINATION_REGISTER']:[])])]};
  }
  const delayClaims:DelayClaimsModel|null=claims.length||sourceEventIds.size?{dataDateIso,projectId:state.projectId,evidenceRevisionId:'canonical-evidence:'+createHash('sha256').update(JSON.stringify(tables.filter(t=>has(t,'claim id')||eventSourceTables.includes(t)).map(t=>[t.document.documentId,t.document.sourceHashSha256,t.document.basisState]))).digest('hex'),events:trustedEvents,claims:trustedClaims,notices:trustedNotices,noticeRequirements:contractNoticeRules(state),diagnostics:['EVENT_IDENTITIES_ESTABLISHED_FROM_SOURCE_REGISTER_CAUSATION_REMAINS_UNPROVEN',...diagnostics],integrity:claimIntegrity}:null;
  const result:CanonicalTimeClaims={producerVersion:'canonical-time-claims-v1',dataDateIso,delayClaims,contractTimeBasis,determinations:trustedDeterminations,amendments,registerDeterminationDays,effectiveDeterminationDays,futureDeterminationCount:eligible.filter(d=>dataDateIso!==null&&d.determinationDate!==null&&d.determinationDate>dataDateIso).length,diagnostics};
  cache.set(state,{version:state.version,value:result});return result;
}
/** A reporting view may reuse source extraction only when every extraction
 * input is identical. Sanitized schedule models or refreshed contract text
 * force a new calculation; project/version alone is never sufficient. */
export function inheritTimeClaimsCache(source:ProjectRuntimeState,target:ProjectRuntimeState):void {
  const old=cache.get(source);
  if(old?.version!==target.version||source.evidenceDocuments!==target.evidenceDocuments||source.activeEvidenceBasis!==target.activeEvidenceBasis)return;
  if(source.schedules.length!==target.schedules.length||source.schedules.some((s,i)=>s!==target.schedules[i]))return;
  if(source.contractDocuments.length!==target.contractDocuments.length||source.contractDocuments.some((d,i)=>d.result!==target.contractDocuments[i]?.result))return;
  cache.set(target,old);
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
  if (!model.contractTimeBasis && existingTime?.overlapResolution && isSourceDerivedTimeBasis(existingTime)) state.controls.contractTimeBasis = null;
  if(model.contractTimeBasis && (!existingTime||isSourceDerivedTimeBasis(existingTime)))state.controls.contractTimeBasis=model.contractTimeBasis;
}
