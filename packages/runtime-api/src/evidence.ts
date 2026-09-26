import {csv as parseCsv} from "../../truth-kernel/src";
import {prepareRegisterRows,canonicalHeader} from '../../truth-kernel/src';
import type {
  EvidenceCategory,
  EvidenceLineage,
  EvidenceMappingSummary,
  StoredEvidenceDocument,
  StoredScheduleRevision,
} from "./project-state-types";

function normalizePath(value: string): string {
  let normalized = value.split("\\").join("/");
  while (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }
  return normalized;
}

function lower(value: string): string {
  return normalizePath(value).toLowerCase();
}

function basename(path: string): string {
  const normalized = normalizePath(path);
  return normalized.split("/").at(-1) ?? normalized;
}

export function inferEvidenceCategory(
  path: string,
  override?: string | null,
): EvidenceCategory {
  const requested = (override ?? "").trim() as EvidenceCategory;
  const allowed = new Set<EvidenceCategory>([
    "schedule",
    "schedule_control",
    "contract",
    "boq_cost",
    "risk_claims_procurement",
    "correspondence",
    "engineering",
    "hse_quality_fm",
    "tender_commissioning",
    "other",
  ]);
  if (allowed.has(requested)) return requested;

  const value = lower(path);
  const name = basename(value);
  if (
    /^(?:rel\d*|res\d*|sch\d*|wbs\d*|obs\d*|pdb\d*|if0?[12])[_-]/.test(name) ||
    /(?:longest[_ -]?path|schedule[_ -]?comparison|resource[_ -]?register|wbs[_ -]?dictionary|productivity[_ -]?(?:work[_ -]?package|forecast|basis))/i.test(name)
  ) {
    return "schedule_control";
  }
  if (
    value.includes("02_schedules") ||
    (
      /^s0?\d+_/.test(name) &&
      /\.(xer|xml|xlsx|xlsm|csv)$/.test(name)
    )
  ) {
    return "schedule";
  }
  if (value.includes("03_schedule_control")) return "schedule_control";
  if (value.includes("01_contract")) return "contract";
  if (value.includes("04_cost_boq") || value.includes("boq")) return "boq_cost";
  if (value.includes("05_risk_procurement_claims")) return "risk_claims_procurement";
  if (value.includes("06_correspondence")) return "correspondence";
  if (value.includes("07_engineering")) return "engineering";
  if (value.includes("08_hse_quality_fm")) return "hse_quality_fm";
  if (value.includes("09_tender_commissioning")) return "tender_commissioning";

  if (/contract|amendment|appendix/.test(value)) return "contract";
  if (
    /schedule|baseline|recovery/.test(value) ||
    (/update/.test(value) && /\.(xer|xml|xlsx|xlsm|csv)$/.test(value))
  ) return "schedule";
  if (/risk|claim|procurement|bond|guarantee|security/.test(value)) return "risk_claims_procurement";
  if (/rfi|submittal|design/.test(value)) return "engineering";
  if (/hse|ncr|asset|fm/.test(value)) return "hse_quality_fm";
  if (/commission|orat|tender|employer.*requirement/.test(value)) return "tender_commissioning";
  return "other";
}

export function inferDocumentType(
  path: string,
  override?: string | null,
): string {
  if (override?.trim()) return override.trim();
  const name = basename(lower(path));

  if (/^c01_|main[_ -]?contract/.test(name)) return "main_contract";
  if (/^c02_|amendment/.test(name)) return "contract_amendment";
  if (/^c03_|technical[_ -]?appendix|appendix/.test(name)) return "contract_appendix";
  if (/^rel/.test(name)) return "longest_path_register";
  if (/^res/.test(name)) return "resource_register";
  if (/^sch0?1/.test(name)) return "schedule_control_basis";
  if (/^sch0?2/.test(name)) return "schedule_metric_register";
  if (/^sch0?3|baseline[_ -]?to[_ -]?current|schedule[_ -]?comparison/.test(name)) return "schedule_activity_comparison";
  if (/^wbs/.test(name)) return "wbs_dictionary";
  if (/^obs/.test(name)) return "obs_responsibility_matrix";
  if (/^pdb/.test(name)) return "project_data_book";
  if (/^if0?1(?:[_\-.]|$)/.test(name) || /productivity[_ -]?work[_ -]?package/.test(name)) return "productivity_work_package_register";
  if (/^if0?2(?:[_\-.]|$)/.test(name) || /productivity[_ -]?(?:forecast[_ -]?basis|basis[_ -]?forecast|allowance)/.test(name)) return "productivity_forecast_basis";
  if (/recovery/.test(name)) return "schedule_recovery";
  if (/revised[_ -]?baseline/.test(name)) return "schedule_revised_baseline";
  if (/^s01_|baseline/.test(name)) return "schedule_baseline";
  if (
    (/^s0[2-9]_|update|latest/.test(name)) &&
    /\.(xer|xml|xlsx|xlsm|csv)$/.test(name)
  ) return "schedule_update";
  if (/^obs/.test(name)) return "obs_responsibility_matrix";
  if (/^pdb/.test(name)) return "project_data_book";
  if (/^rel/.test(name)) return "longest_path_register";
  if (/^res/.test(name)) return "resource_register";
  if (/^sch01/.test(name)) return "schedule_control_basis";
  if (/^sch02/.test(name)) return "schedule_metric_register";
  if (/^wbs/.test(name)) return "wbs_dictionary";
  if (/^b01_|original[_ -]?boq/.test(name)) return "boq";
  if (/^cost/.test(name)) return "cost_evm_report";
  if (/^pay|payment[_ -]?certificate|ipc[_ -]?register/.test(name)) return "payment_certificates";
  if (/^var|variation[_ -]?register|change[_ -]?register/.test(name)) return "variation_register";
  if (/^ret|retention[_ -]?register/.test(name)) return "retention_register";
  if (/^bond|^sec|bond[_ -]?register|security[_ -]?register|guarantee[_ -]?register/.test(name)) return "bond_register";
  if (/^cl/.test(name)) return "delay_eot_claims_register";
  if (/^p0?1_.*procurement|procurement/.test(name)) return "procurement_register";
  if (/^r0?1_.*risk|risk[_ -]?register/.test(name)) return "risk_register";
  if (/^l0?1_|letters|notices/.test(name)) return "letters_notices";
  if (/^d0?1_|design[_ -]?deliver/.test(name)) return "design_deliverables";
  if (/^rfi/.test(name)) return "rfi_register";
  if (/^sub/.test(name)) return "submittal_register";
  if (/^fm/.test(name)) return "asset_register";
  if (/^hse/.test(name)) return "hse_report";
  if (/^q0?1_|ncr/.test(name)) return "quality_ncr_register";
  if (/^com/.test(name)) return "testing_commissioning_register";
  if (/^t0?1_|tender|employer[_ -]?requirement/.test(name)) return "tender_employer_requirements";
  return "supporting_document";
}

export function inferScheduleRole(
  path: string,
  requested?: string | null,
): StoredScheduleRevision["role"] {
  const normalized = (requested ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (
    normalized === "baseline" ||
    normalized === "update" ||
    normalized === "recovery" ||
    normalized === "revised_baseline"
  ) return normalized;

  // When no explicit role is supplied, use only strong, human-readable
  // filename/path signals. Generic names such as Revision_01 remain unresolved.
  const source = path
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\\/g, "/");
  const words = source
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (/\brevised\s+baseline\b/.test(words)) {
    return "revised_baseline";
  }
  if (/\brecovery\b/.test(words)) {
    return "recovery";
  }
  if (
    /\bbaseline\b/.test(words) &&
    (
      /\brev(?:ision)?\s*0\b/.test(words) ||
      /\brev0\b/.test(source) ||
      /(?:^|[\/_-])s0?1(?:[\/_-]|$)/.test(source)
    )
  ) {
    return "baseline";
  }
  if (/\bupdate\b/.test(words)) {
    return "update";
  }

  return "other";
}

export function inferMediaType(
  path: string,
  fallback?: string | null,
): string {
  const value = lower(path);
  if (value.endsWith(".xer")) return "text/plain";
  if (value.endsWith(".csv")) return "text/csv";
  if (value.endsWith(".xml")) return "application/xml";
  if (value.endsWith(".pdf")) return "application/pdf";
  if (value.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (value.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (value.endsWith(".xlsm")) return "application/vnd.ms-excel.sheet.macroEnabled.12";
  if (value.endsWith(".zip")) return "application/zip";
  return fallback?.trim() || "application/octet-stream";
}



function normalizedHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const LINKED_ACTIVITY_HEADERS = [
  "linked activity",
  "linked schedule activity",
  "activity id",
  "schedule activity",
];

export function analyzeCsvEvidence(
  bytes: Uint8Array,
  activityIds: ReadonlySet<string>,
): EvidenceMappingSummary {
  const text = Buffer.from(bytes)
    .toString("utf8")
    .replace(/^\uFEFF/, "");
  return analyzeEvidenceRows(parseCsv(text),activityIds);
}
export function analyzeEvidenceRows(rows:string[][],activityIds:ReadonlySet<string>):EvidenceMappingSummary {
  if (rows.length === 0) {
    return {
      method: "explicit_column",
      rowCount: 0,
      linkedActivityField: null,
      linkedActivityCount: null,
      mappedActivityCount: null,
      unmappedActivityCount: null,
      coveragePercent: null,
      state:"column_absent",message:"No linkage column supplied",
    };
  }

  const prepared=prepareRegisterRows(rows);
  const headers = prepared.headers;
  const linkedIndex = headers.findIndex((header) =>
    header==='linked activity',
  );
  const rowCount = prepared.rows.filter((row) =>
    row.some((value) => value.trim() !== ""),
  ).length;

  if (linkedIndex < 0) {
    return {
      method: "explicit_column",
      rowCount,
      linkedActivityField: null,
      linkedActivityCount: null,
      mappedActivityCount: null,
      unmappedActivityCount: null,
      coveragePercent: null,
      state:"column_absent",message:"No linkage column supplied",
    };
  }

  let linkedActivityCount = 0;
  let mappedActivityCount = 0;
  for (const row of prepared.rows) {
    const value = (row[linkedIndex] ?? "").trim();
    if (!value) continue;
    linkedActivityCount += 1;
    if (activityIds.has(value)) mappedActivityCount += 1;
  }

  const unmappedActivityCount =
    linkedActivityCount -
    mappedActivityCount;
  return {
    method: "explicit_column",
    state:linkedActivityCount===0?"values_empty":mappedActivityCount===0?"no_matches":mappedActivityCount===linkedActivityCount?"linked":"partly_linked",
    message:linkedActivityCount===0?"Linkage column supplied, values empty":mappedActivityCount===0?"Linkage column supplied but no rows matched":mappedActivityCount+" of "+linkedActivityCount+" activity references linked",
    rowCount,
    linkedActivityField:
      prepared.rawHeaders[linkedIndex] ?? null,
    linkedActivityCount,
    mappedActivityCount,
    unmappedActivityCount,
    coveragePercent:
      linkedActivityCount === 0
        ? null
        : (
            mappedActivityCount /
            linkedActivityCount
          ) * 100,
  };
}


export function analyzeTextEvidence(
  text: string,
  activityIds: ReadonlySet<string>,
): EvidenceMappingSummary | null {
  if (activityIds.size === 0) return null;

  const matched = new Set<string>();
  const tokens =
    text.match(/[A-Za-z0-9][A-Za-z0-9_.:/-]{2,}/g) ?? [];

  for (const raw of tokens) {
    const token = raw
      .replace(/^[("']+|[)"',.;]+$/g, "")
      .trim();
    if (
      token &&
      activityIds.has(token)
    ) {
      matched.add(token);
    }
  }

  if (matched.size === 0) {
    return null;
  }

  return {
    method:
      "exact_text_reference",
    rowCount: null,
    linkedActivityField:
      "document text",
    linkedActivityCount:
      matched.size,
    mappedActivityCount:
      matched.size,
    unmappedActivityCount: 0,
    coveragePercent: 100,
  };
}


export function inferEvidenceLineage(
  input: {
    category: EvidenceCategory;
    documentType: string;
    textSample: string;
    existingDocuments:
      readonly StoredEvidenceDocument[];
  },
): EvidenceLineage {
  const text =
    input.textSample
      .toLowerCase()
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();

  const sameDomain =
    input.existingDocuments.filter(
      (document) =>
        document.category ===
        input.category,
    );
  const predecessor =
    sameDomain
      .at(-1)
      ?.documentId;

  const diagnostics: string[] = [];
  let effect:
    EvidenceLineage["effect"] =
    "unknown";
  let confidence = 0.55;

  const fullReplacementSignal =
    /\b(amended and restated|restated agreement|consolidated contract|consolidated boq|revised bill of quantities|revised boq|supersedes? (?:the )?(?:previous|prior|original)|replaces? (?:the )?(?:previous|prior|original) (?:contract|boq|bill of quantities))\b/i.test(
      text,
    );

  const variationSignal =
    /\b(variation order|change order|vo\s*(?:no\.?|number|#)|variation\s*(?:no\.?|number|#)|additional quantities|omitted quantities|deleted quantities)\b/i.test(
      text,
    ) ||
    input.documentType ===
      "variation_order";

  const amendmentSignal =
    /\b(contract amendment|amendment\s+(?:no\.?|number)|supplemental agreement|addendum)\b/i.test(
      text,
    ) ||
    input.documentType ===
      "contract_amendment";

  const revisionSignal =
    /\b(revision|rev\.?\s*\d+|revised)\b/i.test(
      text,
    );

  if (
    sameDomain.length === 0 &&
    !variationSignal &&
    !amendmentSignal
  ) {
    effect = "original";
    confidence = 0.96;
  } else if (
    fullReplacementSignal
  ) {
    effect = "full_replacement";
    confidence = 0.94;
  } else if (
    variationSignal
  ) {
    effect = "variation_order";
    confidence = 0.92;
  } else if (
    amendmentSignal
  ) {
    effect = "delta_amendment";
    confidence = 0.92;
  } else if (
    /\b(supplement|supplementary)\b/i.test(
      text,
    )
  ) {
    effect = "supplement";
    confidence = 0.82;
  } else if (
    revisionSignal ||
    sameDomain.length > 0
  ) {
    effect = "revision_snapshot";
    confidence =
      revisionSignal
        ? 0.78
        : 0.62;
  }

  const replacesEntireBasis =
    effect ===
    "full_replacement";
  const appliesAsDelta =
    effect ===
      "delta_amendment" ||
    effect ===
      "variation_order" ||
    effect ===
      "supplement";
  const predecessorDocumentIds =
    effect === "full_replacement"
      ? sameDomain.map(
          (document) =>
            document.documentId,
        )
      : predecessor
        ? [predecessor]
        : [];

  if (
    effect ===
      "revision_snapshot" &&
    !fullReplacementSignal
  ) {
    diagnostics.push(
      "CHANGE_EFFECT_REQUIRES_REVIEW_BEFORE_REPLACING_CURRENT_BASIS",
    );
  }

  if (
    appliesAsDelta &&
    predecessorDocumentIds.length ===
      0
  ) {
    diagnostics.push(
      "DELTA_DOCUMENT_HAS_NO_PRIOR_BASIS_DOCUMENT",
    );
  }

  const needsReview =
    effect === "unknown" ||
    effect ===
      "revision_snapshot" ||
    (
      appliesAsDelta &&
      predecessorDocumentIds.length ===
        0
    );

  return {
    effect,
    predecessorDocumentIds,
    replacesEntireBasis,
    appliesAsDelta,
    inferred: true,
    confidence,
    needsReview,
    diagnostics,
  };
}
