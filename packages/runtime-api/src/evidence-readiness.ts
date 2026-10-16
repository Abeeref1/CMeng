import {procurementDateBasis} from './procurement-date-basis';
import {cell,csv as parseCsv,sourceTables,procurementTiming} from "../../truth-kernel/src";
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
    documentType ===
      "rfi_register" &&
    /\bopen\b/.test(
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
  return null;
}

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

export function deriveReadinessFromCsv(
  input: {
    state: ProjectRuntimeState;
    document:
      StoredEvidenceDocument;
    bytes: Uint8Array;
    sheetName?: string;
    dataDateIso?: string | null;
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
  const text =
    Buffer.from(
      input.bytes,
    )
      .toString("utf8")
      .replace(
        /^\uFEFF/,
        "",
      );
  const sheetName=input.sheetName??'CSV';
  const semantic=sheetName==='CSV'
    ?input.document.csvSemantic
    :input.document.tabularRead?.sheets.find(sheet=>sheet.name===sheetName)?.semantic;
  const parsedTable=prepareEvidenceRows(
    parseCsv(text),
    input.document.documentType,
    (input.document.tableConfirmations??[]).filter(item=>item.sheetName===sheetName),
    semantic?.columnMeanings??[],
  );
  const rows=[parsedTable.headers,...parsedTable.rows];
  const headers=parsedTable.headers;

  const activityIndex =
    headerIndex(
      headers,
      [
        "linked activity",
        "linked schedule activity",
        "activity id",
        "schedule activity",
      ],
    );
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
  const recordIdIndex=headerIndex(headers,['deliverable id','package id','ncr id','rfi id','submittal id']);
  const longLeadIndex=headerIndex(headers,['long lead']);
  const ownerIndex=headerIndex(headers,['owner','responsible','responsible party','action owner']);
  const forecastDeliveryIndex=headerIndex(headers,['forecast delivery','forecast delivery date','delivery forecast date']);
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

    let activityId =
      valueAt(
        row,
        activityIndex,
      );
    let packageLink:PackageLink|undefined;

    if (
      !activityId &&
      input.document
        .documentType ===
        "submittal_register"
    ) {
      packageLink=packageMap.get(valueAt(row,packageIndex));
      activityId=packageLink?.activityId??"";
    }

    if (!activityId) {
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
        else currentStatus=input.document.documentType==='quality_ncr_register'?'closed':'approved';
      }
      else {currentStatus=opened?'open':'';scopeNote='Future closure/approval excluded from the current position';}
    }else if(snapshot!==cutoff){
      const isOpen=opened&&/^(open|pending|active|overdue)$/.test(status.toLowerCase());
      if(!isOpen){currentStatus='';scopeNote='Actual status date not established; source final status is not an as-of assertion';}
    }
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
      const timing=procurementTiming({governingDate:procurementDateChoice,dataDateIso,programmeNeedDate:activity?.currentStartIso??null,sourceRequiredOnSite:registerDate(dueIso),forecastDelivery:registerDate(valueAt(row,forecastDeliveryIndex)),actualDelivery:registerDate(valueAt(row,actualDeliveryIndex)),status});
      if(timing.deliveredAtDataDate){state='ready';scopeNote='Actual delivery is recorded on or before the Data Date';}
      else if(timing.deliveredStatusOnly){state='unknown';scopeNote='The source reports Delivered/Accepted but gives no actual delivery date. No open-material blocker is established; verify the date before certifying delivery at the Data Date.';}
      else if(timing.overdueUndelivered){state='blocked';scopeNote='Assessed need date ('+timing.needDateBasis+') '+timing.needDate+' has passed and the package is still undelivered at the Data Date';}
      else if(timing.forecastLate){state='blocked';scopeNote='Forecast delivery is '+(-timing.headroomCalendarDays!)+' calendar days after '+timing.needDateBasis;}
      else {state='unknown';scopeNote=timing.needDate?'No date-based delivery blocker is established; physical readiness still requires delivery evidence.':'The selected need date is not established; confirm the missing programme link or register date.';}
      if(timing.deliveryDateConflict){diagnostics.push('PROCUREMENT_DELIVERY_DATE_CONFLICT');scopeNote+='; the completed status conflicts with a delivery date after the reporting date. Review the source receipt and dates.';}
      const finish=dateValue(activity?.forecastFinishIso??activity?.currentFinishIso??'');
      if(procurementDateChoice!=='programme'&&due&&finish&&due>finish){state='unknown';scopeNote='Source package is linked, but required-on-site date '+due+' is after activity finish '+finish+'; confirm the link and required date before assessing material readiness';diagnostics.push('MATERIAL_LINK_TIMING_MISMATCH');}
    }

    if(sourceStatus.conflicted){
      state='unknown';
      currentStatus='';
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
export function reportingReadinessEvidence(state:ProjectRuntimeState,dataDateIso:string|null):ReadinessByActivity {
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
          merge(deriveReadinessFromCsv({state,document:semanticDocument,bytes:Buffer.from(registerCsv(sheet.rows)),sheetName:sheet.name,dataDateIso}));
        }
        continue;
      }
      if(!dimensionFor(document.documentType)||document.mediaType!=='text/csv')continue;
      const bytes=readFileSync(document.storedPath);
      if(createHash('sha256').update(bytes).digest('hex')!==document.sourceHashSha256)continue;
      merge(deriveReadinessFromCsv({state,document,bytes,dataDateIso}));
    }catch { /* No verified source means no derived ready assertion. */ }
  }
  const view={...state,derivedReadinessByDocument:derived,controls:{...state.controls,readinessEvidence:{...state.controls.readinessEvidence}}};
  rebuildReadinessEvidence(view);return view.controls.readinessEvidence;
}
