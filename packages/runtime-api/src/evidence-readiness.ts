import {csv as parseCsv} from "../../truth-kernel/src";
import {canonicalHeader,prepareRegisterRows,registerDate} from '../../truth-kernel/src';
import {
  readFileSync,
} from "node:fs";
import {createHash} from 'node:crypto';
import {dateValue} from '../../truth-kernel/src';
import {projectDataDate,projectControlSchedule} from './canonical-time-claims';

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
): Map<string, string> {
  const map =
    new Map<
      string,
      string
    >();

  const activeProcurement =
    state.evidenceDocuments
      .filter(
        (document) =>
          document.documentType ===
            "procurement_register" &&
          document.basisState ===
            "active",
      )
      .sort(
        (a, b) =>
          a.uploadedAt.localeCompare(
            b.uploadedAt,
          ),
      )
      .at(-1);

  if (!activeProcurement) {
    return map;
  }

  try {
    const text =
      readFileSync(
        activeProcurement
          .storedPath,
        "utf8",
      ).replace(
        /^\uFEFF/,
        "",
      );
    const rows =
      parseCsv(text);
    const headers =
      rows[0] ?? [];
    const packageIndex =
      headerIndex(
        headers,
        [
          "package id",
          "procurement package",
        ],
      );
    const activityIndex =
      headerIndex(
        headers,
        [
          "linked activity",
          "linked schedule activity",
          "activity id",
        ],
      );

    for (
      const row of
        rows.slice(1)
    ) {
      const packageId =
        valueAt(
          row,
          packageIndex,
        );
      const activityId =
        valueAt(
          row,
          activityIndex,
        );
      if (
        packageId &&
        activityId
      ) {
        map.set(
          packageId,
          activityId,
        );
      }
    }
  } catch {
    return map;
  }

  return map;
}

export function deriveReadinessFromCsv(
  input: {
    state: ProjectRuntimeState;
    document:
      StoredEvidenceDocument;
    bytes: Uint8Array;
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

  const text =
    Buffer.from(
      input.bytes,
    )
      .toString("utf8")
      .replace(
        /^\uFEFF/,
        "",
      );
  const parsedTable=prepareRegisterRows(parseCsv(text),input.document.documentType);
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
  const statusIndex =
    headerIndex(
      headers,
      [
        "status",
        "current status",
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
          string
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

    if (
      !activityId &&
      input.document
        .documentType ===
        "submittal_register"
    ) {
      activityId =
        packageMap.get(
          valueAt(
            row,
            packageIndex,
          ),
        ) ?? "";
    }

    if (!activityId) {
      continue;
    }

    const status =
      valueAt(
        row,
        statusIndex,
      );
    const dueIso =
      valueAt(
        row,
        dueIndex,
      );
    const opened=dateValue(valueAt(row,openedIndex)),closed=dateValue(valueAt(row,closedIndex)),snapshot=dateValue(valueAt(row,snapshotIndex));
    if(cutoff&&opened&&opened>cutoff)continue;
    let currentStatus=status,scopeNote='';
    const diagnostics:string[]=[];
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
      const finish=dateValue(activity?.forecastFinishIso??activity?.currentFinishIso??'');
      if(due&&finish&&due>finish){state='unknown';scopeNote='Source package is linked, but required-on-site date '+due+' is after activity finish '+finish+'; confirm the link and required date before assessing material readiness';diagnostics.push('MATERIAL_LINK_TIMING_MISMATCH');}
    }

    result[activityId] ??=
      {};
    result[activityId]![
      dimension
    ] = combineReadiness(result[activityId]![dimension],{
      state,
      diagnostics,
      records:[{recordId:valueAt(row,recordIdIndex)||null,documentType:input.document.documentType,state,dueIso:dateValue(dueIso),
        note:scopeNote||'Source status: '+(status||'not stated'),sourceRefs:['evidence-document:'+input.document.documentId+':row:'+(index+1)]}],
      sourceRefs: [
        "evidence-document:" +
          input.document
            .documentId +
          ":row:" +
          (index + 1),
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
    });
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

  const activeDocuments =
    state.evidenceDocuments
      .filter(
        (document) =>
          document.basisState ===
            "active" ||
          document.basisState ===
            "additive",
      )
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

  for (
    const document of
      activeDocuments
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
        merged[activityId]![
          key
        ] = combineReadiness(merged[activityId]![key],evidence);
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
  for(const document of state.evidenceDocuments.filter(d=>['active','additive'].includes(d.basisState)&&dimensionFor(d.documentType)&&d.mediaType==='text/csv')){
    try {
      const bytes=readFileSync(document.storedPath);
      if(createHash('sha256').update(bytes).digest('hex')!==document.sourceHashSha256)continue;
      derived[document.documentId]=deriveReadinessFromCsv({state,document,bytes,dataDateIso});
    }catch { /* No verified source means no derived ready assertion. */ }
  }
  const view={...state,derivedReadinessByDocument:derived,controls:{...state.controls,readinessEvidence:{...state.controls.readinessEvidence}}};
  rebuildReadinessEvidence(view);return view.controls.readinessEvidence;
}
