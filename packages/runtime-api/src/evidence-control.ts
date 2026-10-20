import {scenarioName,explicitScheduleDecision,submittedScheduleDecision,isScenarioRevision} from './schedule-authority';
import { typedEvidenceRoleFromText } from "./typed-evidence-families";
import {csv,prepareRegisterRows,registerDate} from '../../truth-kernel/src';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {
  EvidenceBasisEffect,
  EvidenceBasisRecord,
  EvidenceBasisState,
  EvidenceFamilyBehavior,
  EvidenceUploadIntent,
  ProjectRuntimeState,
  StoredEvidenceDocument,
  StoredScheduleRevision,
} from "./project-state-types";

function norm(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function documentIdentifier(
  documentType: string,
  text: string,
  filename: string,
): string | null {
  const controlIdentities:Record<string,[string,string[]]>={
    site_instruction_register:['instruction',['instruction id','site instruction id','si id']],
    contract_obligation_register:['obligation',['obligation id']],
    retention_register:['retention',['retention id']],
  };
  const own=controlIdentities[documentType];
  if(own){
    const table=prepareRegisterRows(csv(text),documentType);
    const column=table.headers.findIndex(header=>own[1].includes(header));
    const ids=new Set(column<0?[]:table.rows.map(row=>row[column]?.trim()).filter(Boolean));
    // A related VO/claim is not this register's identity. Several owning IDs
    // describe a population, with no single document identifier established.
    return ids.size===1?own[0]+':'+[...ids][0]!.normalize('NFKC').toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,''):null;
  }
  const corpus =
    text + "\n" + filename;
  const patterns: Array<
    [string, RegExp]
  > = [
    [
      "amendment",
      /\b(?:contract\s+)?amendment\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9._/-]+)/i,
    ],
    [
      "vo",
      /\bvo\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9._/-]*\d[A-Z0-9._/-]*)/i,
    ],
    [
      "vo",
      /\b(?:variation\s+order|change\s+order)\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9._/-]*\d[A-Z0-9._/-]*)/i,
    ],
    [
      "vo",
      /\b(?:vo|variation\s+order|change\s+order)\s*[:\-]?\s*([A-Z0-9._/-]*\d[A-Z0-9._/-]*)/i,
    ],
    [
      "payment",
      /\b(?:payment\s+certificate|certificate)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9._/-]+)/i,
    ],
    [
      "letter",
      /\b(?:letter|ref(?:erence)?)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9._/-]+)/i,
    ],
    // A notice or claim identifier carries a number (NTC-001, CLM-07). A
    // register's column heading ("Notice Date", "Claim ID") is not a document
    // identity: read as one, every claims register shared "claim:id" and a
    // second, different register was held as a correction candidate.
    [
      "notice",
      /\bnotice\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9._/-]*\d[A-Z0-9._/-]*)/i,
    ],
    [
      "claim",
      /\bclaim\s*(?:id|no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9._/-]*\d[A-Z0-9._/-]*)/i,
    ],
    [
      "meeting",
      /\b(?:meeting\s+minutes|minutes\s+of\s+meeting|mom)\b[^\n]{0,80}?\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})\b/i,
    ],
  ];

  for (const [prefix, regex] of patterns) {
    const match = regex.exec(corpus);
    if (match?.[1]) {
      return (
        prefix +
        ":" +
        norm(match[1])
          .replace(/\s+/g, "-")
      );
    }
  }

  if (
    documentType ===
      "variation_order" ||
    documentType ===
      "payment_certificate" ||
    documentType ===
      "letters_notices" ||
    documentType ===
      "meeting_minutes"
  ) {
    const base =
      filename
        .toLowerCase()
        .replace(/\.[^.]+$/, "")
        .replace(
          /(?:rev(?:ision)?|r)\s*[-_. ]*\d+\b/gi,
          "",
        )
        .replace(
          /[^a-z0-9]+/g,
          "-",
        )
        .replace(
          /^-+|-+$/g,
          "",
        );
    return base
      ? documentType +
          ":" +
          base
      : null;
  }

  return null;
}

export const sourceDocumentIdentifier=(documentType:string,text:string)=>documentIdentifier(documentType,text,'');
export function hasSourceDocumentIdentity(document:StoredEvidenceDocument){return !!document.identification?.sourceDocumentIdentity||documentIdentifier(document.documentType,document.assertions.map(a=>a.sourceText).join('\n'),'')!==null;}

export function evidenceFamily(
  input: {
    category: string;
    documentType: string;
    scheduleRole:
      | StoredScheduleRevision["role"]
      | null;
    textSample: string;
    sourceFilename: string;
  },
): {
  familyKey: string;
  behavior: EvidenceFamilyBehavior;
  logicalDocumentKey: string;
} {
  const {
    category,
    documentType,
    scheduleRole,
    textSample,
    sourceFilename,
  } = input;

  if(documentType==='installed_measurement_register')return {
    familyKey:'quantity:measurements',behavior:'additive',
    logicalDocumentKey:'quantity:measurements:'+norm(sourceFilename.replace(/(?:rev(?:ision)?|r)[-_. ]*\d+\b/gi,'')),
  };

  if (category === "schedule") {
    if (scheduleRole === "recovery" || scheduleRole === "scenario") {
      return {
        familyKey:
          "schedule:scenario",
        behavior:
          "schedule_special",
        logicalDocumentKey:
          "schedule:recovery:" +
          norm(sourceFilename),
      };
    }
    if (scheduleRole === "baseline" || scheduleRole === "revised_baseline") {
      return {
        familyKey:
          "schedule:baseline",
        behavior:
          "schedule_special",
        logicalDocumentKey:
          "schedule:baseline",
      };
    }
    return {
      familyKey:
        "schedule:control",
      behavior:
        "schedule_special",
      logicalDocumentKey:
        "schedule:control",
    };
  }

  if (
    category === "boq_cost" &&
    documentType === "boq"
  ) {
    return {
      familyKey: "boq:quantity",
      behavior: "boq_special",
      logicalDocumentKey:
        "boq:quantity",
    };
  }

  if (
    documentType ===
      "contract_amendment"
  ) {
    return {
      familyKey:
        "contract:amendments",
      behavior:
        "contract_delta",
      logicalDocumentKey:
        documentIdentifier(
          documentType,
          textSample,
          sourceFilename,
        ) ??
        "contract:amendment:" +
          norm(
            sourceFilename.replace(
              /(?:rev(?:ision)?|r)\s*[-_. ]*\d+\b/gi,
              "",
            ),
          ),
    };
  }

  if (
    documentType ===
      "contract_replacement"
  ) {
    return {
      familyKey: "contract:base",
      behavior:
        "contract_replacement",
      logicalDocumentKey:
        "contract:base",
    };
  }

  if (
    documentType ===
      "main_contract"
  ) {
    return {
      familyKey: "contract:base",
      behavior:
        "contract_replacement",
      logicalDocumentKey:
        "contract:base",
    };
  }

  const additive =
    new Set([
      "variation_order",
      "letters_notices",
      "meeting_minutes",
      "notice",
      "claim_notice",
      "correspondence",
    ]);

  if (
    additive.has(documentType) ||
    category ===
      "correspondence"
  ) {
    return {
      familyKey:
        documentType ===
          "variation_order"
          ? "commercial:variations"
          : category +
            ":" +
            documentType,
      behavior: "additive",
      logicalDocumentKey:
        documentIdentifier(
          documentType,
          textSample,
          sourceFilename,
        ) ??
        category +
          ":" +
          documentType +
          ":" +
          norm(sourceFilename),
    };
  }

  const sourceRole = typedEvidenceRoleFromText(documentType, textSample);
  if (sourceRole) {
    const key = category + ":" + documentType + ":" + sourceRole;
    return { familyKey: key, behavior: "snapshot", logicalDocumentKey: key };
  }

  const snapshotTypes =
    new Set([
      "bond_register",
      "security_register",
      "determination_register",
      "risk_register",
      "procurement_register",
      "permit_register",
      "rfi_register",
      "submittal_register",
      "design_deliverables",
      "quality_ncr_register",
      "asset_register",
      "testing_commissioning_register",
      "cost_evm_report",
      "payment_certificates",
      "retention_register",
      "site_instruction_register",
      "contract_obligation_register",
      "variation_register",
      "delay_eot_claims_register",
      "contractor_manpower_plan",
      "schedule_control_basis",
      "schedule_metric_register",
      "schedule_activity_comparison",
      "longest_path_register",
      "resource_register",
      "wbs_dictionary",
      "obs_responsibility_matrix",
      "project_data_book",
      "productivity_work_package_register",
      "productivity_forecast_basis",
      "hse_report",
      "mixed_register_workbook",
    ]);

  if (
    snapshotTypes.has(
      documentType,
    )
  ) {
    return {
      familyKey:
        category +
        ":" +
        documentType,
      behavior: "snapshot",
      logicalDocumentKey:
        category +
        ":" +
        documentType,
    };
  }

  return {
    familyKey:
      category +
      ":" +
      documentType,
    behavior: "reference",
    logicalDocumentKey:
      category +
      ":" +
      documentType +
      ":" +
      norm(sourceFilename),
  };
}

function revisionHint(
  document:
    StoredEvidenceDocument,
): {
  revision: number | null;
  date: string | null;
} {
  const text = [
    document.sourceFilename,
    document.sourceRelativePath ??
      "",
    document.identification
      .detectedTitle ??
      "",
  ].join(" ");

  const rev =
    /(?:^|[^A-Za-z0-9])(?:rev(?:ision)?|r)\s*[-_. ]*0*(\d{1,6})(?=$|[^A-Za-z0-9])/i.exec(
      text,
    );
  const isoDate =
    /(?:^|[^0-9])(20\d{2})[-_. ]?(0[1-9]|1[0-2])[-_. ]?([0-2]\d|3[01])(?=$|[^0-9])/.exec(
      text,
    );

  return {
    revision:
      rev?.[1]
        ? Number(
            rev[1],
          )
        : null,
    date:
      isoDate
        ? [
            isoDate[1],
            isoDate[2],
            isoDate[3],
          ].join("-")
        : null,
  };
}

const reportDateHeader=/^(?:report(?:ing)?(?: period)? (?:date|end|ending)|data date|status date|status as (?:of|at)|as (?:of|at)(?: date)?|period end(?:ing| date)?|period ended|cut ?off date|valuation date)$/;
/** F06: a column that states the file's own report date (read by contentReportDate). */
export const isReportDateHeader=(header:string)=>reportDateHeader.test(header);
// One shared label set for every cost-report format (CSV, xlsx, PDF text):
// "Report date: 31/08/2026", "Period ending 31 August 2026", "As at 2026-08-31".
const reportDateLabelText='(?:report(?:ing)?(?: period)? (?:date|end(?:ing)?)|data date|status date|status as (?:of|at)|as (?:of|at)|period end(?:ing| date)?|period ended|cut ?off date|valuation date)';
const reportDateValueText='(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{4}|\\d{1,2}[ \\-]+[A-Za-z]{3,9}[ ,\\-]+\\d{4})';
const reportDateLabel=new RegExp('(?:^|[^a-z])'+reportDateLabelText+'\\s*[:=\\-\\u2013]?\\s*'+reportDateValueText+'(?![\\d])','i');
const reportDateLabelOnly=new RegExp('^\\s*'+reportDateLabelText+'\\s*[:=\\-\\u2013]?\\s*$','i');
/** Source date in any shared register format (ISO, day/month/year, 31 Aug 2026). */
const isoDay=(value:string)=>registerDate(value.trim());
/** The single report date stated inside a snapshot: a report/data/status
 * date column holding one value, a labelled "Report Date: yyyy-mm-dd"
 * line or title, or a label cell followed by its date cell (xlsx). Any
 * disagreement inside the document, or no stated date, is unknown (null)
 * and never guessed from the file name. */
export function contentReportDate(document:StoredEvidenceDocument):string|null{
  let sheets:string[][][]=[];
  if(document.tabularRead?.sourceHashSha256===document.sourceHashSha256)sheets=document.tabularRead.sheets.map(sheet=>sheet.rows);
  else if(/csv|text\/plain/i.test(document.mediaType+' '+(document.identification?.verifiedMediaType??''))){
    try{const bytes=readFileSync(document.storedPath);if(createHash('sha256').update(bytes).digest('hex')!==document.sourceHashSha256)return null;sheets=[csv(bytes.toString(bytes[0]===0xff&&bytes[1]===0xfe?'utf16le':'utf8'))];}catch{return null;}
  }
  const found=new Set<string>();
  const labelled=(value:string)=>{const m=reportDateLabel.exec(value);if(m){const day=isoDay(m[1]!);if(day)found.add(day);}};
  for(const rows of sheets){
    const table=prepareRegisterRows(rows,document.documentType);
    table.headers.forEach((header,index)=>{if(!reportDateHeader.test(header))return;for(const row of table.rows){const raw=String(row[index]??'').trim();if(!raw)continue;const day=isoDay(raw);if(day)found.add(day);else found.add('unreadable:'+raw);}});
    for(const row of rows.slice(0,Math.max(0,table.headerRow-1)))row.forEach((value,index)=>{
      labelled(value);
      if(!reportDateLabelOnly.test(value))return;
      const next=row.slice(index+1).map(cell=>String(cell??'').trim()).find(Boolean);
      if(next){const day=isoDay(next);found.add(day??'unreadable:'+next);}
    });
  }
  for(const segment of document.textSegments??[])for(const line of segment.text.split(/\r?\n/))labelled(line);
  return found.size===1&&!/^unreadable:/.test([...found][0]!)?[...found][0]!:null;
}

function snapshotComparison(
  current:
    StoredEvidenceDocument | null,
  incoming:
    StoredEvidenceDocument,
): {
  promote: boolean;
  reason: string;
} {
  if (!current) {
    return {
      promote: true,
      reason:
        "First established snapshot becomes active.",
    };
  }

  // The report date written inside both documents outranks any revision or
  // date guessed from file names. An older report never becomes current
  // because its file name carries a higher revision number.
  const beforeContent=contentReportDate(current),afterContent=contentReportDate(incoming);
  if(beforeContent&&afterContent&&beforeContent!==afterContent)return {
    promote:afterContent>beforeContent,
    reason:afterContent>beforeContent
      ?'Incoming snapshot has a later report date inside the document ('+afterContent+' after '+beforeContent+').'
      :'Incoming snapshot has an earlier report date inside the document ('+afterContent+' before '+beforeContent+') and is retained as history. File names are not used to order it.',
  };
  // No usable content date: say so, and never present a file-name guess as
  // certain. The existing order (file-name revision/date, then hold the
  // later upload as candidate) is kept so no basis changes silently.
  const missingContent=[[current,beforeContent],[incoming,afterContent]].filter(([,day])=>!day).map(([document])=>(document as StoredEvidenceDocument).sourceFilename);
  const contentNote=missingContent.length
    ?' No single report date was found inside '+missingContent.join(' and ')+', so the order below comes from the file name, path, title or upload order and is not confirmed by the document content.'
    :' Both documents state the same report date ('+afterContent+'), so the document content does not order them.';

  const before =
    revisionHint(current);
  const after =
    revisionHint(incoming);

  if (
    before.revision !== null &&
    after.revision !== null
  ) {
    return {
      promote:
        after.revision >
        before.revision,
      reason:
        after.revision >
        before.revision
          ? "Incoming snapshot has a higher revision number in its file name, path or title."+contentNote
          : "Incoming snapshot does not have a higher revision number in its file name, path or title and is retained as candidate/history."+contentNote,
    };
  }

  if (
    before.date !== null &&
    after.date !== null
  ) {
    return {
      promote:
        after.date >
        before.date,
      reason:
        after.date >
        before.date
          ? "Incoming snapshot has a later date in its file name, path or title."+contentNote
          : "Incoming snapshot does not have a later date in its file name, path or title and is retained as candidate/history."+contentNote,
    };
  }

  if (
    before.revision === null &&
    after.revision !== null
  ) {
    return {
      promote: true,
      reason:
        "Incoming snapshot carries a revision number in its file name, path or title while the current basis did not."+contentNote,
    };
  }

  if (
    before.date === null &&
    after.date !== null
  ) {
    return {
      promote: true,
      reason:
        "Incoming snapshot carries a date in its file name, path or title while the current basis did not."+contentNote,
    };
  }

  return {
    promote: false,
    reason:
      "Relative snapshot chronology cannot be proven from document content/metadata. Add/Update retains the later upload as candidate; use Replace to promote it explicitly."+contentNote,
  };
}

function scheduleComparison(
  state: ProjectRuntimeState,
  current:
    StoredEvidenceDocument | null,
  incoming:
    StoredEvidenceDocument,
): {
  promote: boolean;
  reason: string;
} {
  if (!current) {
    return {
      promote: true,
      reason:
        "First control schedule for the family becomes active.",
    };
  }

  const currentRevision =
    state.schedules.find(
      (item) =>
        item.revision
          .revisionId ===
        current.linkedArtifactId,
    );
  const incomingRevision =
    state.schedules.find(
      (item) =>
        item.revision
          .revisionId ===
        incoming.linkedArtifactId,
    );

  const before =
    currentRevision?.revision.model.dataDateIso ?? null;
  const after =
    incomingRevision?.revision.model.dataDateIso ?? null;

  if (
    before &&
    after
  ) {
    return {
      promote:
        after > before,
      reason:
        after > before
          ? "Incoming control schedule has a later internal Data Date."
          : "Incoming control schedule is not later than the active control schedule and remains historical/candidate.",
    };
  }

  return {promote:false,reason:'Unresolved revision order: an internal Data Date is missing.'};
}

function markSuperseded(
  state: ProjectRuntimeState,
  documentId: string,
  supersededByDocumentId: string,
): void {
  const document =
    state.evidenceDocuments.find(
      (item) =>
        item.documentId ===
        documentId,
    );
  if (!document) return;
  document.basisState =
    "superseded";
  document.supersededByDocumentId =
    supersededByDocumentId;
}

function activeDocument(
  state: ProjectRuntimeState,
  familyKey: string,
): StoredEvidenceDocument | null {
  const id =
    state.activeEvidenceBasis[
      familyKey
    ]?.activeDocumentId ??
    null;
  if (!id) return null;
  return (
    state.evidenceDocuments.find(
      (item) =>
        item.documentId === id,
    ) ?? null
  );
}

function updateBasisRecord(
  state: ProjectRuntimeState,
  input: {
    document: StoredEvidenceDocument;
    familyKey: string;
    behavior: EvidenceFamilyBehavior;
    reason: string;
    previousActiveDocumentId:
      string | null;
  },
): void {
  const prior =
    state.activeEvidenceBasis[
      input.familyKey
    ];
  const history =
    new Set([
      ...(prior
        ?.previousDocumentIds ??
        []),
      ...(input.previousActiveDocumentId
        ? [
            input
              .previousActiveDocumentId,
          ]
        : []),
    ]);
  state.activeEvidenceBasis[
    input.familyKey
  ] = {
    familyKey:
      input.familyKey,
    behavior:
      input.behavior,
    activeDocumentId:
      input.document.documentId,
    activeArtifactId:
      input.document
        .linkedArtifactId,
    updatedAt:
      input.document.uploadedAt,
    reason: input.reason,
    previousDocumentIds: [
      ...history,
    ],
  };
}

export function applyEvidenceBasis(
  state: ProjectRuntimeState,
  document: StoredEvidenceDocument,
  intent: EvidenceUploadIntent,
): EvidenceBasisEffect {
  const familyKey =
    document.familyKey;
  const behavior =
    evidenceFamily({
      category:
        document.category,
      documentType:
        document.documentType,
      scheduleRole:
        document.scheduleRole,
      textSample:
        document.assertions
          .map(
            (assertion) =>
              assertion.sourceText,
          )
          .join("\n"),
      sourceFilename:
        document.sourceFilename,
    }).behavior;

  if(['additive','contract_delta'].includes(behavior)&&document.identification?.sourceDocumentIdentity&&!document.relationshipDecision)document.logicalDocumentKey=document.identification.sourceDocumentIdentity;

  const current =
    activeDocument(
      state,
      familyKey,
    );
  const previousActiveDocumentId =
    current?.documentId ??
    null;

  const result = (
    basisState: EvidenceBasisState,
    changedActiveBasis: boolean,
    reason: string,
  ): EvidenceBasisEffect => ({
    familyKey,
    behavior,
    intent,
    logicalDocumentKey:
      document.logicalDocumentKey,
    basisState,
    previousActiveDocumentId,
    activeDocumentId:
      changedActiveBasis
        ? document.documentId
        : state.activeEvidenceBasis[
            familyKey
          ]?.activeDocumentId ??
          null,
    changedActiveBasis,
    reason,
  });

  if(current?.documentId===document.documentId&&document.basisState==='active')return result('active',false,'Identical active source retained; upload did not demote or duplicate its authority.');
  const identical=state.evidenceDocuments.find(d=>d.documentId!==document.documentId&&d.familyKey===familyKey&&d.sourceHashSha256===document.sourceHashSha256&&['active','additive'].includes(d.basisState));
  if(identical){document.basisState='historical';document.supersededByDocumentId=identical.documentId;return result('historical',false,'Identical content already exists in this project source family. Retained as history; not counted twice.');}
  const relationship=document.relationshipDecision;
  if(relationship?.sourceHash===document.sourceHashSha256&&relationship.kind==='replacement'){
    const target=state.evidenceDocuments.find(d=>d.documentId===relationship.targetDocumentId&&d.sourceHashSha256===relationship.targetSourceHash);
    if(!target||target.familyKey!==document.familyKey)throw new Error('REPLACEMENT_TARGET_INVALID');
    document.logicalDocumentKey=target.logicalDocumentKey;intent='replace_current_basis';
  }
  if (
    behavior ===
      "schedule_special" &&
    (
      document.scheduleRole === "recovery" ||
      document.scheduleRole === "scenario" ||
      (
        !document.scheduleRoleConfirmed &&
        !["baseline","revised_baseline","recovery"].includes(document.scheduleRole ?? "other") &&
        scenarioName(document.sourceFilename)
      )
    )
  ) {
    document.basisState =
      "scenario";
    return result(
      "scenario",
      false,
      "Recovery schedule retained as scenario; current control programme is unchanged.",
    );
  }

  if(['contract_delta','additive'].includes(behavior)&&['contract_amendment','variation_order'].includes(document.documentType)&&!relationship&&!hasSourceDocumentIdentity(document)&&state.evidenceDocuments.some(d=>d.documentId!==document.documentId&&d.familyKey===familyKey&&['active','additive'].includes(d.basisState))){
    document.basisState='candidate';document.lineage.needsReview=true;return result('candidate',false,'The source does not establish a unique document identifier. Review whether this is a new record or a correction; the filename does not establish that relationship.');
  }
  if (
    behavior ===
    "contract_delta"
  ) {
    const priorVersion =
      state.evidenceDocuments
        .filter(
          (item) =>
            item.documentId !==
              document.documentId &&
            item.familyKey ===
              familyKey &&
            item.logicalDocumentKey ===
              document
                .logicalDocumentKey &&
            ["active", "additive"].includes(item.basisState),
        )
        .sort(
          (a, b) =>
            a.uploadedAt.localeCompare(
              b.uploadedAt,
            ),
        )
        .at(-1);

    if (
      intent ===
        "replace_current_basis" &&
      priorVersion
    ) {
      markSuperseded(
        state,
        priorVersion.documentId,
        document.documentId,
      );
      document.supersedesDocumentIds =
        [
          ...new Set([
            ...document
              .supersedesDocumentIds,
            priorVersion
              .documentId,
          ]),
        ];
    }
    if(priorVersion&&intent==='add_update'&&priorVersion.sourceHashSha256!==document.sourceHashSha256){document.basisState='candidate';document.lineage.needsReview=true;return result('candidate',false,'Another record has the same document identity. Review whether this corrects that record; both revisions are not counted together.');}
    document.basisState =
      "additive";
    return result(
      "additive",
      false,
      "Contract amendment is additive/delta evidence and does not replace the contract family.",
    );
  }

  if (behavior === "additive") {
    const priorVersion =
      state.evidenceDocuments
        .filter(
          (item) =>
            item.documentId !==
              document.documentId &&
            item.familyKey ===
              familyKey &&
            item.logicalDocumentKey ===
              document
                .logicalDocumentKey &&
            ["active", "additive"].includes(item.basisState),
        )
        .sort(
          (a, b) =>
            a.uploadedAt.localeCompare(
              b.uploadedAt,
            ),
        )
        .at(-1);

    if (
      intent ===
        "replace_current_basis" &&
      priorVersion
    ) {
      markSuperseded(
        state,
        priorVersion.documentId,
        document.documentId,
      );
      document.supersedesDocumentIds =
        [
          ...new Set([
            ...document
              .supersedesDocumentIds,
            priorVersion
              .documentId,
          ]),
        ];
    }
    if(priorVersion&&intent==='add_update'&&priorVersion.sourceHashSha256!==document.sourceHashSha256){document.basisState='candidate';document.lineage.needsReview=true;return result('candidate',false,'Another record has the same document identity. Review whether this corrects that record; both revisions are not counted together.');}
    document.basisState =
      "additive";
    return result(
      "additive",
      false,
      priorVersion &&
      intent ===
        "replace_current_basis"
        ? "Only the earlier revision of the same logical additive document was superseded; the rest of the family remains cumulative."
        : "Additive evidence appended to the cumulative family.",
    );
  }

  if (behavior === "reference") {
    document.basisState =
      "historical";
    return result(
      "historical",
      false,
      "Reference evidence is retained without replacing another evidence family.",
    );
  }

  let promote = false;
  let reason = "";
  const replaceIntent =
    intent ===
    "replace_current_basis";

  const incomingSchedule=behavior==='schedule_special'?state.schedules.find(s=>s.revision.revisionId===document.linkedArtifactId):undefined;
  const missingScheduleDate=behavior==='schedule_special'&&!incomingSchedule?.revision.model.dataDateIso;
  if(missingScheduleDate){promote=false;reason='Unresolved revision order: the programme has no internal Data Date.';}
  else if(behavior==='schedule_special'){
    if(incomingSchedule?.role==='other'&&!isScenarioRevision(incomingSchedule)){
      incomingSchedule.role='update';document.scheduleRole='update';document.documentType='schedule_update';
    }
    const formalBaseline=!!incomingSchedule&&['baseline','revised_baseline'].includes(incomingSchedule.role);
    if(replaceIntent)explicitScheduleDecision(document,document.scheduleAdoption?.recordedAt??document.uploadedAt);
    let decision=document.scheduleAdoption;
    if(decision?.sourceHashSha256===document.sourceHashSha256&&decision.method==='explicit'){
      promote=true;reason=formalBaseline?'Approved baseline programme explicitly adopted as the active basis.':'Programme explicitly selected as the current submitted basis.';
    }else if(decision?.sourceHashSha256===document.sourceHashSha256&&decision.method==='legacy_retained'){
      promote=!current||scheduleComparison(state,current,document).promote;
      reason='Previous non-scenario source selection retained as a submitted analytical basis; no approval is inferred.';
    }else if(!formalBaseline&&incomingSchedule&&!isScenarioRevision(incomingSchedule)&&(!current||scheduleComparison(state,current,document).promote)){
      submittedScheduleDecision(document,document.uploadedAt,current?'Later ordinary programme Data Date accepted as the current submitted analytical position. No contractual approval is inferred.':'First ordinary programme with an established Data Date accepted as the current submitted analytical position. No contractual approval is inferred.');
      decision=document.scheduleAdoption;promote=true;
      reason=current?'Later ordinary programme update becomes the current submitted analytical position.':'First ordinary programme becomes the current submitted analytical position.';
    }else{
      promote=false;
      reason=formalBaseline?'Baseline or revised baseline retained as candidate until approval evidence and an explicit adoption decision are provided.':'Programme retained for review because it is not a later ordinary current update.';
    }
  }
  else if (!current) {
    promote = true;
    reason =
      "First established evidence for this family becomes the active basis.";
  } else if (
    replaceIntent
  ) {
    promote = true;
    reason =
      "User selected Replace current basis for this matching evidence family.";
  } else if (
    behavior ===
      "snapshot"
  ) {
    const comparison =
      snapshotComparison(
        current,
        document,
      );
    promote =
      comparison.promote;
    reason =
      comparison.reason;
  } else if (
    behavior ===
      "boq_special"
  ) {
    promote =
      replaceIntent;
    reason =
      "Later BOQ revisions remain candidate evidence unless explicitly promoted with Replace intent.";
  } else if (
    behavior ===
      "contract_replacement"
  ) {
    promote =
      !current ||
      replaceIntent;
    reason = promote
      ? "Contract base established/promoted for this family."
      : "Replacement/restated contract retained as candidate until explicitly promoted.";
  }

  if (promote) {
    if (
      previousActiveDocumentId &&
      previousActiveDocumentId !==
        document.documentId
    ) {
      markSuperseded(
        state,
        previousActiveDocumentId,
        document.documentId,
      );
      document.supersedesDocumentIds =
        [
          ...new Set([
            ...document
              .supersedesDocumentIds,
            previousActiveDocumentId,
          ]),
        ];
    }
    document.basisState =
      "active";
    updateBasisRecord(
      state,
      {
        document,
        familyKey,
        behavior,
        reason,
        previousActiveDocumentId,
      },
    );
    return result(
      "active",
      previousActiveDocumentId !==
        document.documentId,
      reason,
    );
  }

  document.basisState =
    "candidate";
  return result(
    "candidate",
    false,
    reason ||
      "Evidence retained as candidate without changing the active family basis.",
  );
}


export function rebuildEvidenceFamily(
  state: ProjectRuntimeState,
  familyKey: string,
): void {
  const documents =
    state.evidenceDocuments
      .filter(
        (document) =>
          document.familyKey ===
          familyKey,
      )
      .sort((a, b) => {
        const byTime =
          (a.scheduleAdoption?.recordedAt??a.uploadedAt).localeCompare(
            b.scheduleAdoption?.recordedAt??b.uploadedAt,
          );
        return byTime !== 0
          ? byTime
          : a.documentId.localeCompare(
              b.documentId,
            );
      });

  delete state.activeEvidenceBasis[
    familyKey
  ];

  for (const document of documents) {
    document.basisState =
      "candidate";
    document.supersededByDocumentId =
      null;
    document.supersedesDocumentIds =
      [];
  }

  for (const document of documents) {
    applyEvidenceBasis(
      state,
      document,
      document.uploadIntent,
    );
  }
}
