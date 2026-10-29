import {procurementDateBasis} from './procurement-date-basis';
import {splitLinkCell,LINKED_ACTIVITY_HEADERS} from './link-cell';
import {cell,csv as parseCsv,sourceTables,procurementTiming,PROCUREMENT_LEAD_REVIEW_HEADERS,programmeOnlyNeedDateText,linkTimingMismatchText} from "../../truth-kernel/src";
import {canonicalHeader,registerBusinessStatusFields,prepareEvidenceRows,registerDate} from '../../truth-kernel/src';
import {
  readFileSync,
} from "node:fs";
import {createHash} from 'node:crypto';
import {dateValue} from '../../truth-kernel/src';
import {projectDataDate,projectControlSchedule} from './canonical-time-claims';
import {registerCsv} from './register-workbook';
import {analyticalOperationalDocuments,sourceAnalyticalCandidateIds,sourceAnalyticalDiagnostic} from './operational-reporting';

import type {
  ReadinessDimensionKey,
  ReadinessEvidence,
} from "../../lookahead-schedule/src";
import type {
  ProjectRuntimeState,
  StoredEvidenceDocument,
} from "./project-state-types";

type ReadinessByActivity =
  Record<
    string,
    Partial<
      Record<
        ReadinessDimensionKey,
        ReadinessEvidence
      >
    >
  >;

function combineReadiness(a:ReadinessEvidence|undefined,b:ReadinessEvidence):ReadinessEvidence {
  if(!a)return b;
  const order={blocked:3,unknown:2,ready:1,not_applicable:0};
  return {state:order[a.state]>=order[b.state]?a.state:b.state,sourceRefs:[...new Set([...a.sourceRefs,...b.sourceRefs])],
    records:[...(a.records??[]),...(b.records??[])],
    note:[a.note,b.note].filter(Boolean).join('; '),diagnostics:[...new Set([...(a.diagnostics??[]),...(b.diagnostics??[])])]};
}

/** Readiness read from a source that is not formally adopted keeps that
 * qualification on the evidence itself and on every record it carries. */
function sourceAnalyticalReadiness(evidence:ReadinessEvidence,documentId:string):ReadinessEvidence{
  const label=sourceAnalyticalDiagnostic(documentId),note='Read from source; not formally adopted';
  return {...evidence,diagnostics:[...new Set([...(evidence.diagnostics??[]),label])],
    note:[evidence.note,note].filter(Boolean).join('; '),
    ...(evidence.records?{records:evidence.records.map(r=>({...r,note:[r.note,note].filter(Boolean).join('; ')}))}:{})};
}

function readinessSourceRef(document:StoredEvidenceDocument,rowNumber:number,sheetName?:string){
  const sheet=sheetName&&sheetName!=='CSV'?':sheet:'+encodeURIComponent(sheetName):'';
  return 'evidence-document:'+document.documentId+sheet+':row:'+rowNumber;
}



function normHeader(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .trim();
}

function headerIndex(
  headers: string[],
  candidates: string[],
): number {
  const wanted =
    new Set(
      candidates.map(c=>canonicalHeader(c)),
    );
  return headers.findIndex(
    (header) =>
      wanted.has(
        canonicalHeader(header),
      ),
  );
}

function valueAt(
  row: string[],
  index: number,
): string {
  return index >= 0
    ? (
        row[index] ??
        ""
      ).trim()
    : "";
}

/** Read all recognized business-status columns in the original source row.
 * Divergent source assertions are not silently promoted to readiness. */
export function sourceReadinessStatus(headers:readonly string[],row:readonly string[],documentType:string) {
  const indexed=new Map(headers.map((header,index)=>[canonicalHeader(header,documentType),index]));
  const observed=registerBusinessStatusFields(documentType).flatMap(field=>{
    const index=indexed.get(canonicalHeader(field,documentType));
    const raw=index===undefined?'':String(row[index]??'').trim();
    return raw?[{field,raw}]:[];
  });
  const unique=new Set(observed.map(item=>item.raw.normalize('NFKC').toLowerCase().trim()));
  return {value:unique.size>1?'':observed[0]?.raw??'',conflicted:unique.size>1,observed};
}

function readinessState(
  documentType: string,
  status: string,
  dueIso: string,
  dataDateIso: string | null,
): ReadinessEvidence["state"] {
  const value =
    status
      .normalize("NFKC")
      .toLowerCase()
      .trim();

  // SW-18: "Not applicable" is its own state, never known-ready or blocked.
  if(/^(not applicable|n\/a|na)$/.test(value))return "not_applicable";
  // C10: the words each newly read register uses for its own position.
  if(documentType==="permit_register"){
    if(/\b(expired|suspended|revoked|refused|rejected|withdrawn|cancelled)\b/.test(value))return "blocked";
    if(/\b(approved|issued|granted|valid|active|live)\b/.test(value))return "ready";
  }
  if(documentType==="risk_register"){
    if(/\b(occurred|realised|realized|materiali[sz]ed|triggered|issue)\b/.test(value))return "blocked";
    if(/\b(closed|retired|mitigated|resolved|expired)\b/.test(value))return "ready";
    return "unknown";
  }
  if(documentType==="resource_register"||documentType==="contractor_manpower_plan"){
    if(/\b(not available|unavailable|shortfall|short|demobili[sz]ed|not mobili[sz]ed)\b/.test(value))return "blocked";
    if(/\b(available|mobili[sz]ed|on site|confirmed|allocated|assigned|approved)\b/.test(value))return "ready";
  }
  if(documentType==="variation_register"){
    if(/\b(rejected|disputed|on hold|hold|withdrawn)\b/.test(value))return "blocked";
    if(/\b(approved|instructed|agreed|accepted|issued)\b/.test(value))return "ready";
    return "unknown";
  }
  if(documentType==="interface_register"){
    if(/\b(closed|resolved|agreed|released|handed over|available|complete|completed)\b/.test(value))return "ready";
  }
  if (
    /\b(approved|accepted|closed|complete|completed|delivered|installed|issued|answered|released)\b/.test(
      value,
    )
  ) {
    return "ready";
  }

  if (
    /\b(rejected|blocked|hold|on hold|late|delayed|overdue|failed|open ncr)\b/.test(
      value,
    )
  ) {
    return "blocked";
  }

  if (
    documentType ===
      "quality_ncr_register" &&
    /\bopen\b/.test(
      value,
    )
  ) {
    return "blocked";
  }

  if (
    ["rfi_register","permit_register","interface_register","resource_register","contractor_manpower_plan"].includes(documentType) &&
    /\b(open|pending|applied|submitted|requested|under review)\b/.test(
      value,
    ) &&
    dueIso &&
    dataDateIso &&
    Number.isFinite(
      Date.parse(dueIso),
    ) &&
    Number.isFinite(
      Date.parse(
        dataDateIso,
      ),
    ) &&
    Date.parse(dueIso) <
      Date.parse(dataDateIso)
  ) {
    return "blocked";
  }

  return "unknown";
}

function dimensionFor(
  documentType: string,
): ReadinessDimensionKey | null {
  if (
    documentType ===
    "procurement_register"
  ) {
    return "procurement_material";
  }
  if (
    documentType ===
      "rfi_register" ||
    documentType ===
      "design_deliverables" ||
    documentType ===
      "submittal_register"
  ) {
    return "design_submittal";
  }
  if (
    documentType ===
    "quality_ncr_register"
  ) {
    return "quality";
  }
  // C10: the five dimensions that had no document reader.
  if(documentType==="permit_register")return "permit";
  if(documentType==="interface_register")return "access";
  if(documentType==="risk_register")return "risk";
  if(documentType==="resource_register"||documentType==="contractor_manpower_plan")return "resource";
  if(documentType==="variation_register")return "commercial";
  return null;
}

/** The register types read for each readiness dimension (one list, used by the
 * readers and by the "no listed check" rule). */
export const READINESS_DIMENSION_DOCUMENT_TYPES:Readonly<Partial<Record<ReadinessDimensionKey,readonly string[]>>>={
  procurement_material:["procurement_register"],design_submittal:["rfi_register","design_deliverables","submittal_register"],quality:["quality_ncr_register"],
  permit:["permit_register"],access:["interface_register"],risk:["risk_register"],resource:["resource_register","contractor_manpower_plan"],commercial:["variation_register"],
};
/** Each register's own record identity column (never a linked package or activity column). */
function recordIdentityHeaders(documentType:string){
  switch(documentType){
    case "procurement_register":return ["package id","procurement package id","procurement package"];
    case "submittal_register":return ["submittal id","submittal no","submittal number"];
    case "rfi_register":return ["rfi id","rfi no","rfi number"];
    case "design_deliverables":return ["deliverable id","drawing no","document no"];
    case "quality_ncr_register":return ["ncr id","ncr no","inspection id"];
    case "permit_register":return ["permit id","permit no","permit number"];
    case "interface_register":return ["interface id","interface no"];
    case "risk_register":return ["risk id","risk no","risk ref"];
    case "resource_register":case "contractor_manpower_plan":return ["resource id","resource code","crew id"];
    case "variation_register":return ["variation id","variation no","vo no"];
    default:return ["deliverable id","package id","ncr id","rfi id","submittal id"];
  }
}
const splitActivityCell=splitLinkCell;
export type ReadinessLinkReader=(row:{documentId:string;documentType:string;reference:string|null;stated:string;fields:Record<string,string>})=>string[];

function procurementPackageMap(
  state: ProjectRuntimeState,
): Map<string, PackageLink> {
  const map=new Map<string,PackageLink>(),diagnostics:string[]=[];
  const current=analyticalOperationalDocuments(state.evidenceDocuments),unadopted=sourceAnalyticalCandidateIds(state.evidenceDocuments);
  const tables=sourceTables(current,diagnostics).filter(table=>table.document.documentType==='procurement_register');
  // Adopted links first. A link read only from an unadopted candidate is used
  // and labelled; it never replaces an adopted link, and a different candidate
  // link is shown as a conflict naming that source.
  const ordered=[...tables.filter(t=>!unadopted.has(t.document.documentId)),...tables.filter(t=>unadopted.has(t.document.documentId))];
  for(const table of ordered)for(const row of table.rows){
    const packageId=cell(row,"package id","procurement package");
    const activityId=cell(row,"linked activity","linked schedule activity","activity id");
    if(!packageId||!activityId)continue;
    const fromCandidate=unadopted.has(table.document.documentId),prior=map.get(packageId);
    if(fromCandidate&&prior&&!prior.unadoptedDocumentId){
      if(prior.activityId!==activityId)prior.differingUnadopted.push(table.document.documentId);
      continue;
    }
    map.set(packageId,{activityId,unadoptedDocumentId:fromCandidate?table.document.documentId:null,differingUnadopted:[]});
  }
  return map;
}
type PackageLink={activityId:string;unadoptedDocumentId:string|null;differingUnadopted:string[]};
/** Readiness that depends on a package link keeps the link's qualification. */
function packageLinked(link:PackageLink|undefined,packageId:string,evidence:ReadinessEvidence):ReadinessEvidence{
  if(!link)return evidence;
  let out=link.unadoptedDocumentId?sourceAnalyticalReadiness(evidence,link.unadoptedDocumentId):evidence;
  if(link.differingUnadopted.length)out={...out,diagnostics:[...new Set([...(out.diagnostics??[]),...link.differingUnadopted.map(id=>'UNADOPTED_SOURCE_PACKAGE_LINK_DIFFERS:'+packageId+':'+id)])]};
  return out;
}

type ParsedReadinessTable=ReturnType<typeof prepareEvidenceRows>;
const parsedReadinessTables=new Map<string,ParsedReadinessTable>();
function parsedReadinessTable(document:StoredEvidenceDocument,sheetName:string,meanings:readonly unknown[],bytes:Uint8Array|(()=>Uint8Array|null)):ParsedReadinessTable|null{
  const confirmations=(document.tableConfirmations??[]).filter(item=>item.sheetName===sheetName);
  // Given bytes are keyed by their own content hash (equal to the source hash for an
  // uploaded file); a loader is keyed by the verified source hash it reads.
  const contentKey=typeof bytes==='function'?document.sourceHashSha256:createHash('sha256').update(bytes).digest('hex');
  const key=[document.documentId,contentKey,sheetName,document.documentType,JSON.stringify(confirmations),JSON.stringify(meanings)].join('\u0001');
  const held=parsedReadinessTables.get(key);
  if(held){parsedReadinessTables.delete(key);parsedReadinessTables.set(key,held);return held;}
  const raw=typeof bytes==='function'?bytes():bytes;
  if(!raw)return null;
  const text=Buffer.from(raw).toString('utf8').replace(/^\uFEFF/,'');
  const parsed=prepareEvidenceRows(parseCsv(text),document.documentType,confirmations,meanings as any);
  parsedReadinessTables.set(key,parsed);
  while(parsedReadinessTables.size>64)parsedReadinessTables.delete(parsedReadinessTables.keys().next().value!);
  return parsed;
}

export function deriveReadinessFromCsv(
  input: {
    state: ProjectRuntimeState;
    document:
      StoredEvidenceDocument;
    /** The source bytes, or a loader called only when the parsed table is not held yet. */
    bytes: Uint8Array | (() => Uint8Array | null);
    sheetName?: string;
    dataDateIso?: string | null;
    /** P0-C (C10, C11, M8.2): the one link reader. Given a source row it returns
     * the activities the row applies to: the Delivery record's current links
     * (stated, reviewed or proposed by CMeng), else the stated cell split on
     * ";", "|" or ",", else CMeng's linker. Without it, the stated cell only. */
    links?: ReadinessLinkReader;
    /** Called for each row that names a check but is linked to no activity. */
    onUnlinked?: (dimension: ReadinessDimensionKey, documentId: string) => void;
  },
): ReadinessByActivity {
  const dimension =
    dimensionFor(
      input.document
        .documentType,
    );
  if (!dimension) {
    return {};
  }

  const procurementDateChoice=input.document.documentType==='procurement_register'?procurementDateBasis(input.state).choice:null;
  const sheetName=input.sheetName??'CSV';
  const semantic=sheetName==='CSV'
    ?input.document.csvSemantic
    :input.document.tabularRead?.sheets.find(sheet=>sheet.name===sheetName)?.semantic;
  // Performance (T11): the link-independent parse of a source table is held per
  // source hash, sheet, type and column decisions, so a read after upload applies
  // the current links without parsing every register row again.
  const parsedTable=parsedReadinessTable(input.document,sheetName,semantic?.columnMeanings??[],input.bytes);
  if(!parsedTable)return {};
  const rows=[parsedTable.headers,...parsedTable.rows];
  const headers=parsedTable.headers;

  const activityIndex = headerIndex(headers,[...LINKED_ACTIVITY_HEADERS]);
  const dueIndex =
    headerIndex(
      headers,
      [
        "required response",
        "required on site",
        "due date",
        "planned issue",
      ],
    );
  const packageIndex =
    headerIndex(
      headers,
      [
        "procurement package",
        "package id",
      ],
    );

  const packageMap =
    input.document
      .documentType ===
      "submittal_register"
      ? procurementPackageMap(
          input.state,
        )
      : new Map<
          string,
          PackageLink
        >();

  const dataDateIso = input.dataDateIso===undefined?projectDataDate(input.state):input.dataDateIso;
  const cutoff=dateValue(dataDateIso??'');
  /* Historical status requires actual lifecycle dates or an explicit dated
   * status snapshot. Due/planned dates cannot establish an actual approval. */
  const openedIndex=headerIndex(headers,['raised date','opened date','issue date','submitted date']);
  const closedIndex=headerIndex(headers,['close date','closed date','response date','actual issue','approval date','actual delivery','delivered date']);
  const snapshotIndex=headerIndex(headers,['status as of','status date','as of','as of date','snapshot date']);
  const activityById=new Map((projectControlSchedule(input.state)?.revision.model.activities??[]).map(a=>[a.activityId,a]));
  const recordIdIndex=headerIndex(headers,recordIdentityHeaders(input.document.documentType));
  const longLeadIndex=headerIndex(headers,['long lead']);
  const ownerIndex=headerIndex(headers,['owner','responsible','responsible party','action owner']);
  const forecastDeliveryIndex=headerIndex(headers,['forecast delivery','forecast delivery date','delivery forecast date']);
  const leadReviewIndex=headerIndex(headers,PROCUREMENT_LEAD_REVIEW_HEADERS);
  const actualDeliveryIndex=headerIndex(headers,['actual delivery','actual delivery date','delivered date']);


  const result:
    ReadinessByActivity = {};

  for (
    let index = 1;
    index < rows.length;
    index += 1
  ) {
    const row =
      rows[index] ?? [];
    if (
      row.every(
        (value) =>
          !value.trim(),
      )
    ) {
      continue;
    }

    const stated=valueAt(row,activityIndex);
    let activityIds=input.links
      ?input.links({documentId:input.document.documentId,documentType:input.document.documentType,reference:valueAt(row,recordIdIndex)||null,stated,
        fields:Object.fromEntries(headers.map((header,i)=>[normHeader(header),valueAt(row,i)]))})
      :splitActivityCell(stated);
    let packageLink:PackageLink|undefined;

    if (
      !activityIds.length &&
      input.document
        .documentType ===
        "submittal_register"
    ) {
      packageLink=packageMap.get(valueAt(row,packageIndex));
      activityIds=splitActivityCell(packageLink?.activityId??"");
    }

    if (!activityIds.length) {
      input.onUnlinked?.(dimension,input.document.documentId);
      continue;
    }

    const sourceStatus=sourceReadinessStatus(headers,row,input.document.documentType);
    const status=sourceStatus.value;
    const dueIso =
      valueAt(
        row,
        dueIndex,
      );
    const opened=dateValue(valueAt(row,openedIndex)),closed=dateValue(valueAt(row,closedIndex)),snapshot=dateValue(valueAt(row,snapshotIndex));
    if(cutoff&&opened&&opened>cutoff)continue;
    let currentStatus=status,scopeNote='';
    const diagnostics:string[]=[];
    if(sourceStatus.conflicted)diagnostics.push('SOURCE_STATUS_COLUMNS_CONFLICT');
    if(!cutoff){currentStatus='';scopeNote='Data Date not established';}
    else if(closed&&opened&&closed<opened){currentStatus='';scopeNote='Invalid closure before raised/submitted date';diagnostics.push('CLOSURE_BEFORE_RAISED_DATE');}
    else if(closed){
      if(closed<=cutoff){
        if(/rejected|blocked|hold|failed/i.test(status)){currentStatus=snapshot===cutoff?status:'';scopeNote='Terminal date and adverse source status require lifecycle reconciliation';}
        else currentStatus=['quality_ncr_register','risk_register'].includes(input.document.documentType)?'closed':'approved';
      }
      else {currentStatus=opened?'open':'';scopeNote='Future closure/approval excluded from the current position';}
    }else if(snapshot!==cutoff){
      const isOpen=opened&&/^(open|pending|active|overdue)$/.test(status.toLowerCase());
      if(!isOpen){currentStatus='';scopeNote='Actual status date not established; source final status is not an as-of assertion';}
    }
    const baseNote=scopeNote,baseDiagnostics=[...diagnostics];
    for(const activityId of activityIds){
    let scopeNote=baseNote;const diagnostics=[...baseDiagnostics];
    let state =
      readinessState(
        input.document
          .documentType,
        currentStatus,
        dueIso,
        dataDateIso,
      );
    const due=dateValue(dueIso);
    if(input.document.documentType==='design_deliverables'&&cutoff&&due&&(!closed||closed>cutoff)){
      if(due<cutoff){state='blocked';scopeNote='Planned issue date has passed; no issue is recorded on/before the Data Date'+(closed?'; actual issue is after the Data Date':'');}
      else if(!/rejected|blocked|hold|failed/i.test(currentStatus)){
        state='unknown';scopeNote='Planned issue is not yet due; readiness is not established'+(/overdue|late|delayed/i.test(status)?'; source overdue label conflicts with the planned date':'');
        if(/overdue|late|delayed/i.test(status))diagnostics.push('DESIGN_STATUS_DATE_CONFLICT');
      }
    }
    if(input.document.documentType==='procurement_register'){
      const activity=activityById.get(activityId);
      const finish=dateValue(activity?.forecastFinishIso??activity?.currentFinishIso??'');
      const timing=procurementTiming({governingDate:procurementDateChoice,dataDateIso,programmeNeedDate:activity?.currentStartIso??null,sourceRequiredOnSite:registerDate(dueIso),forecastDelivery:registerDate(valueAt(row,forecastDeliveryIndex)),actualDelivery:registerDate(valueAt(row,actualDeliveryIndex)),status,leadReviewTime:valueAt(row,leadReviewIndex),linkedActivityFinish:finish});
      if(timing.notApplicable){state='not_applicable';scopeNote='Source status: not applicable; excluded from known and blocked readiness';}
      else if(timing.openStatusDeliveredConflict){state='unknown';diagnostics.push('PROCUREMENT_DELIVERY_DATE_CONFLICT');scopeNote='Source status "'+status+'" conflicts with an actual delivery dated on or before the Data Date. Review the source receipt and dates';}
      else if(timing.deliveredAtDataDate){state='ready';scopeNote='Actual delivery is recorded on or before the Data Date';}
      else if(timing.deliveredStatusOnly){state='unknown';scopeNote='The source reports Delivered/Accepted but gives no actual delivery date. No open-material blocker is established; verify the date before certifying delivery at the Data Date.';}
      else if(timing.overdueUndelivered){state='blocked';scopeNote='Assessed need date ('+timing.needDateBasis+') '+timing.needDate+' has passed and the package is still undelivered at the Data Date';}
      // SW-18: a forecast date is not a blocker; only a passed need date on an undelivered package is.
      else if(timing.forecastLate){state='unknown';diagnostics.push('PROCUREMENT_FORECAST_AFTER_NEED');scopeNote='At risk: forecast delivery is '+(-timing.headroomCalendarDays!)+' calendar days after '+timing.needDateBasis+'; a forecast date alone is not a confirmed blocker'+(timing.needDatePassedOnProgrammeOnly?'. '+programmeOnlyNeedDateText(timing):'');}
      else {state='unknown';scopeNote=timing.needDatePassedOnProgrammeOnly?programmeOnlyNeedDateText(timing):timing.needDate?'No date-based delivery blocker is established; physical readiness still requires delivery evidence.':'The selected need date is not established; confirm the missing programme link or register date.';}
      if(timing.deliveryDateConflict){diagnostics.push('PROCUREMENT_DELIVERY_DATE_CONFLICT');scopeNote+='; the completed status conflicts with a delivery date after the reporting date. Review the source receipt and dates.';}
      if(timing.linkTimingMismatch){state='unknown';scopeNote=linkTimingMismatchText(timing);diagnostics.push('MATERIAL_LINK_TIMING_MISMATCH');}
    }

    if(sourceStatus.conflicted){
      state='unknown';
      scopeNote='Conflicting business-status columns need source review: '+sourceStatus.observed.map(v=>v.field+'='+v.raw).join('; ')+'. '+scopeNote;
    }

    result[activityId] ??=
      {};
    result[activityId]![
      dimension
    ] = combineReadiness(result[activityId]![dimension],packageLinked(packageLink,valueAt(row,packageIndex),{
      state,
      diagnostics,
      records:[{recordId:valueAt(row,recordIdIndex)||null,documentType:input.document.documentType,state,dueIso:dateValue(dueIso),
        owner:valueAt(row,ownerIndex)||null,longLead:/^(yes|true|1|y)$/i.test(valueAt(row,longLeadIndex)),
        note:scopeNote||'Source status: '+(status||'not stated'),sourceRefs:[readinessSourceRef(input.document,index+1,input.sheetName)]}],
      sourceRefs: [
        readinessSourceRef(input.document,index+1,input.sheetName),
      ],
      note:
        (valueAt(row,recordIdIndex)?valueAt(row,recordIdIndex)+'; ':'')+(scopeNote?scopeNote+'; ':'')+
        input.document
          .documentType +
        " status=" +
        (
          status ||
          "not stated"
        ) +
        (
          dueIso
            ? "; due=" +
              dueIso
            : ""
        ),
    }));
    }
  }

  return result;
}

function isDerived(
  evidence:
    ReadinessEvidence,
): boolean {
  return (
    evidence.sourceRefs
      .length > 0 &&
    evidence.sourceRefs
      .every(
        (ref) =>
          ref.startsWith(
            "evidence-document:",
          ),
      )
  );
}

export function rebuildReadinessEvidence(
  state: ProjectRuntimeState,
): void {
  const manual:
    ReadinessByActivity = {};

  for (
    const [
      activityId,
      dimensions,
    ] of Object.entries(
      state.controls
        .readinessEvidence,
    )
  ) {
    for (
      const [
        key,
        evidence,
      ] of Object.entries(
        dimensions,
      ) as Array<
        [
          ReadinessDimensionKey,
          ReadinessEvidence,
        ]
      >
    ) {
      if (
        !evidence ||
        isDerived(evidence)
      ) {
        continue;
      }
      manual[activityId] ??=
        {};
      manual[activityId]![
        key
      ] = evidence;
    }
  }

  // T04: adopted sources plus the unique, fully read candidate selected by
  // the shared source-analytical rule. Candidate-read evidence is labelled
  // as not formally adopted; competing or review-needed candidates stay held.
  const sourceAnalytical=sourceAnalyticalCandidateIds(state.evidenceDocuments);
  const activeDocuments =
    analyticalOperationalDocuments(state.evidenceDocuments)
      .sort(
        (a, b) =>
          a.uploadedAt.localeCompare(
            b.uploadedAt,
          ),
      );

  const merged:
    ReadinessByActivity = {
      ...manual,
  };

  // Adopted sources first; an unadopted candidate only fills a gap. Where an
  // adopted (or manual) position exists, a differing candidate is shown as a
  // conflict naming that source and never replaces or worsens it.
  const ordered=[...activeDocuments.filter(d=>!sourceAnalytical.has(d.documentId)),...activeDocuments.filter(d=>sourceAnalytical.has(d.documentId))];
  const fromAdopted=new Set<string>();
  for (
    const document of
      ordered
  ) {
    const derived =
      state
        .derivedReadinessByDocument[
          document.documentId
        ];
    if (!derived) continue;

    for (
      const [
        activityId,
        dimensions,
      ] of Object.entries(
        derived,
      )
    ) {
      merged[activityId] ??=
        {};
      for (
        const [
          key,
          evidence,
        ] of Object.entries(
          dimensions,
        ) as Array<
          [
            ReadinessDimensionKey,
            ReadinessEvidence,
          ]
        >
      ) {
        if (!evidence) {
          continue;
        }
        const unadopted=sourceAnalytical.has(document.documentId);
        const slot=activityId+'|'+key,existing=merged[activityId]![key];
        if(unadopted&&existing&&(fromAdopted.has(slot)||!isDerived(existing))){
          if(existing.state!==evidence.state)merged[activityId]![key]={...existing,diagnostics:[...new Set([...(existing.diagnostics??[]),'UNADOPTED_SOURCE_READINESS_DIFFERS:'+document.documentId])]};
          continue;
        }
        if(!unadopted)fromAdopted.add(slot);
        const labelled=unadopted?sourceAnalyticalReadiness(evidence,document.documentId):evidence;
        merged[activityId]![
          key
        ] = combineReadiness(existing,labelled);
      }
    }
  }

  state.controls
    .readinessEvidence =
    merged;
}

/** Rebuild a read-only Data-Date view from verified retained source bytes.
 * Persisted import-time statuses cannot survive as a separate authority. */
export function reportingReadinessEvidence(state:ProjectRuntimeState,dataDateIso:string|null,options:{links?:ReadinessLinkReader;onUnlinked?:(dimension:ReadinessDimensionKey,documentId:string)=>void}={}):ReadinessByActivity {
  const derived:ProjectRuntimeState['derivedReadinessByDocument']={};
  for(const document of analyticalOperationalDocuments(state.evidenceDocuments)){
    try {
      const merge=(next:ReadinessByActivity)=>{
        const prior=derived[document.documentId]??{};
        for(const [activityId,dimensions] of Object.entries(next)){
          prior[activityId]??={};
          for(const [key,evidence] of Object.entries(dimensions) as Array<[ReadinessDimensionKey,ReadinessEvidence|undefined]>)
            if(evidence)prior[activityId]![key]=combineReadiness(prior[activityId]![key],evidence);
        }
        derived[document.documentId]=prior;
      };
      if(document.tabularRead?.sourceHashSha256===document.sourceHashSha256){
        for(const sheet of document.tabularRead.sheets){
          const type=sheet.semantic?.documentType??document.documentType;
          if(!dimensionFor(type))continue;
          const semanticDocument=sheet.semantic?{...document,documentType:type,category:sheet.semantic.category as any}:document;
          merge(deriveReadinessFromCsv({state,document:semanticDocument,bytes:()=>Buffer.from(registerCsv(sheet.rows)),sheetName:sheet.name,dataDateIso,...(options.links?{links:options.links}:{}),...(options.onUnlinked?{onUnlinked:options.onUnlinked}:{})}));
        }
        continue;
      }
      if(!dimensionFor(document.documentType)||document.mediaType!=='text/csv')continue;
      // The file is read and verified only when its parsed table is not already held.
      const bytes=()=>{const raw=readFileSync(document.storedPath);return createHash('sha256').update(raw).digest('hex')===document.sourceHashSha256?raw:null;};
      merge(deriveReadinessFromCsv({state,document,bytes,dataDateIso,...(options.links?{links:options.links}:{}),...(options.onUnlinked?{onUnlinked:options.onUnlinked}:{})}));
    }catch { /* No verified source means no derived ready assertion. */ }
  }
  const view={...state,derivedReadinessByDocument:derived,controls:{...state.controls,readinessEvidence:{...state.controls.readinessEvidence}}};
  rebuildReadinessEvidence(view);return view.controls.readinessEvidence;
}
