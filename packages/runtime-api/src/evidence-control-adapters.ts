import type {
  CanonicalClaimRecord,
  CanonicalNoticeRecord,
  DelayClaimsModel,
} from "../../delay-analysis-core/src";
import type {
  InvoiceRecord,
  NcrRecord,
  RfiRecord,
  VariationRecord,
} from "../../project-director/src";
import type {
  DerivedControlEvidence,
  ProjectRuntimeState,
  RiskControlRecord,
  StoredEvidenceDocument,
} from "./project-state-types";

function parseCsv(
  text: string,
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const ch = text[index]!;
    if (quoted) {
      if (ch === '"') {
        if (
          text[index + 1] ===
          '"'
        ) {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(
        field.replace(
          /\r$/,
          "",
        ),
      );
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (
    field.length > 0 ||
    row.length > 0
  ) {
    row.push(
      field.replace(
        /\r$/,
        "",
      ),
    );
    rows.push(row);
  }

  return rows;
}

function norm(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function indexOf(
  headers: string[],
  candidates: string[],
): number {
  const wanted =
    new Set(
      candidates.map(norm),
    );
  return headers.findIndex(
    (header) =>
      wanted.has(norm(header)),
  );
}

function value(
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

function numeric(
  raw: string,
): number | null {
  const cleaned =
    raw
      .replace(/,/g, "")
      .replace(
        /[^0-9.+-]/g,
        "",
      )
      .trim();
  if (!cleaned) return null;
  const parsed =
    Number(cleaned);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function iso(
  raw: string,
): string | null {
  const text =
    raw.trim();
  if (!text) return null;
  const parsed =
    Date.parse(text);
  return Number.isFinite(parsed)
    ? new Date(parsed)
        .toISOString()
    : null;
}

function evidenceRef(
  document:
    StoredEvidenceDocument,
  rowNumber: number,
): string {
  return (
    "evidence-document:" +
    document.documentId +
    ":row:" +
    rowNumber
  );
}

function currencyFromHeaders(
  headers: string[],
): string | null {
  const joined =
    headers.join(" ");
  const matches =
    joined.match(
      /\b(?:SAR|AED|USD|EUR|GBP|JOD|QAR|KWD|BHD|OMR)\b/i,
    );
  return matches?.[0]
    ?.toUpperCase() ??
    null;
}

function variationState(
  raw: string,
): VariationRecord["state"] {
  const value =
    norm(raw);
  if (
    value.includes(
      "approved",
    )
  ) return "approved";
  if (
    value.includes(
      "rejected",
    )
  ) return "rejected";
  return "pending";
}

function claimState(
  raw: string,
): CanonicalClaimRecord["state"] {
  const value =
    norm(raw);
  if (
    value.includes(
      "submitted",
    )
  ) return "submitted";
  if (
    value.includes(
      "under review",
    )
  ) return "under_review";
  if (
    value.includes(
      "determined",
    ) ||
    value.includes(
      "approved",
    )
  ) return "determined";
  if (
    value.includes(
      "rejected",
    )
  ) return "rejected";
  if (
    value.includes(
      "withdrawn",
    )
  ) return "withdrawn";
  if (
    value.includes(
      "draft",
    )
  ) return "draft";
  return "unknown";
}

function riskStatus(
  raw: string,
): RiskControlRecord["status"] {
  const value =
    norm(raw);
  if (
    value.includes(
      "closed",
    ) ||
    value.includes(
      "retired",
    )
  ) return "closed";
  if (
    value.includes(
      "open",
    ) ||
    value.includes(
      "active",
    )
  ) return "open";
  return "unknown";
}

function ncrSeverity(
  raw: string,
): NcrRecord["severity"] {
  const value =
    norm(raw);
  if (
    value.includes(
      "critical",
    )
  ) return "critical";
  if (
    value.includes(
      "major",
    ) ||
    value.includes(
      "high",
    )
  ) return "major";
  return "minor";
}

function ncrStatus(
  raw: string,
): NcrRecord["status"] {
  const value =
    norm(raw);
  return (
    value.includes(
      "closed",
    ) ||
    value.includes(
      "complete",
    )
  )
    ? "closed"
    : "open";
}

function rfiStatus(
  raw: string,
): RfiRecord["status"] {
  const value =
    norm(raw);
  if (
    value.includes(
      "closed",
    )
  ) return "closed";
  if (
    value.includes(
      "answered",
    ) ||
    value.includes(
      "responded",
    )
  ) return "answered";
  return "open";
}

export function deriveControlsFromCsv(
  input: {
    state: ProjectRuntimeState;
    document:
      StoredEvidenceDocument;
    bytes: Uint8Array;
  },
): DerivedControlEvidence {
  const text =
    Buffer.from(
      input.bytes,
    )
      .toString("utf8")
      .replace(
        /^\uFEFF/,
        "",
      );
  const rows =
    parseCsv(text);
  const headers =
    rows[0] ?? [];
  const sourceCurrency =
    currencyFromHeaders(
      headers,
    ) ??
    input.state.controls
      .contractValue
      ?.currency ??
    null;

  if (
    input.document
      .documentType ===
    "variation_register"
  ) {
    const idIndex =
      indexOf(
        headers,
        [
          "variation id",
          "vo id",
        ],
      );
    const amountIndex =
      headers.findIndex(
        (header) =>
          norm(header).includes(
            "approved amount",
          ),
      );
    const statusIndex =
      indexOf(
        headers,
        ["status"],
      );
    if (
      idIndex < 0 ||
      amountIndex < 0 ||
      !sourceCurrency
    ) {
      return {};
    }

    const variations:
      VariationRecord[] = [];
    for (
      let rowIndex = 1;
      rowIndex <
      rows.length;
      rowIndex += 1
    ) {
      const row =
        rows[rowIndex] ??
        [];
      const variationId =
        value(
          row,
          idIndex,
        );
      const amount =
        numeric(
          value(
            row,
            amountIndex,
          ),
        );
      if (
        !variationId ||
        amount === null
      ) continue;
      variations.push({
        variationId,
        amount,
        currency:
          sourceCurrency,
        state:
          variationState(
            value(
              row,
              statusIndex,
            ),
          ),
        sourceRefs: [
          evidenceRef(
            input.document,
            rowIndex + 1,
          ),
        ],
      });
    }
    return {
      variations,
    };
  }

  if (
    input.document
      .documentType ===
    "payment_certificates"
  ) {
    const idIndex =
      indexOf(
        headers,
        [
          "certificate no",
          "certificate number",
        ],
      );
    const certifiedIndex =
      indexOf(
        headers,
        [
          "net certified",
          "certified amount",
        ],
      );
    if (
      idIndex < 0 ||
      certifiedIndex < 0 ||
      !sourceCurrency
    ) {
      return {};
    }

    const invoices:
      InvoiceRecord[] = [];
    for (
      let rowIndex = 1;
      rowIndex <
      rows.length;
      rowIndex += 1
    ) {
      const row =
        rows[rowIndex] ??
        [];
      const invoiceId =
        value(
          row,
          idIndex,
        );
      if (!invoiceId) continue;
      invoices.push({
        invoiceId,
        currency:
          sourceCurrency,
        certifiedAmount:
          numeric(
            value(
              row,
              certifiedIndex,
            ),
          ),
        paidAmount: null,
        sourceRefs: [
          evidenceRef(
            input.document,
            rowIndex + 1,
          ),
        ],
      });
    }
    return {
      invoices,
    };
  }

  if (
    input.document
      .documentType ===
    "quality_ncr_register"
  ) {
    const idIndex =
      indexOf(
        headers,
        ["ncr id"],
      );
    const severityIndex =
      indexOf(
        headers,
        ["severity"],
      );
    const statusIndex =
      indexOf(
        headers,
        ["status"],
      );
    const ncrs:
      NcrRecord[] = [];

    for (
      let rowIndex = 1;
      rowIndex <
      rows.length;
      rowIndex += 1
    ) {
      const row =
        rows[rowIndex] ??
        [];
      const ncrId =
        value(
          row,
          idIndex,
        );
      if (!ncrId) continue;
      ncrs.push({
        ncrId,
        severity:
          ncrSeverity(
            value(
              row,
              severityIndex,
            ),
          ),
        status:
          ncrStatus(
            value(
              row,
              statusIndex,
            ),
          ),
        sourceRefs: [
          evidenceRef(
            input.document,
            rowIndex + 1,
          ),
        ],
      });
    }
    return { ncrs };
  }

  if (
    input.document
      .documentType ===
    "rfi_register"
  ) {
    const idIndex =
      indexOf(
        headers,
        ["rfi id"],
      );
    const statusIndex =
      indexOf(
        headers,
        ["status"],
      );
    const dueIndex =
      indexOf(
        headers,
        [
          "required response",
          "due date",
        ],
      );
    const rfis:
      RfiRecord[] = [];

    for (
      let rowIndex = 1;
      rowIndex <
      rows.length;
      rowIndex += 1
    ) {
      const row =
        rows[rowIndex] ??
        [];
      const rfiId =
        value(
          row,
          idIndex,
        );
      if (!rfiId) continue;
      rfis.push({
        rfiId,
        status:
          rfiStatus(
            value(
              row,
              statusIndex,
            ),
          ),
        dueIso:
          iso(
            value(
              row,
              dueIndex,
            ),
          ),
        sourceRefs: [
          evidenceRef(
            input.document,
            rowIndex + 1,
          ),
        ],
      });
    }
    return { rfis };
  }

  if (
    input.document
      .documentType ===
    "risk_register"
  ) {
    const idIndex =
      indexOf(
        headers,
        ["risk id"],
      );
    const statusIndex =
      indexOf(
        headers,
        ["status"],
      );
    const ratingIndex =
      indexOf(
        headers,
        ["rating"],
      );
    const ownerIndex =
      indexOf(
        headers,
        ["owner"],
      );
    const dueIndex =
      indexOf(
        headers,
        ["due date"],
      );
    const risks:
      RiskControlRecord[] = [];

    for (
      let rowIndex = 1;
      rowIndex <
      rows.length;
      rowIndex += 1
    ) {
      const row =
        rows[rowIndex] ??
        [];
      const riskId =
        value(
          row,
          idIndex,
        );
      if (!riskId) continue;
      risks.push({
        riskId,
        status:
          riskStatus(
            value(
              row,
              statusIndex,
            ),
          ),
        rating:
          value(
            row,
            ratingIndex,
          ) || null,
        owner:
          value(
            row,
            ownerIndex,
          ) || null,
        dueIso:
          iso(
            value(
              row,
              dueIndex,
            ),
          ),
        sourceRefs: [
          evidenceRef(
            input.document,
            rowIndex + 1,
          ),
        ],
      });
    }
    return { risks };
  }

  if (
    input.document
      .documentType ===
    "delay_eot_claims_register"
  ) {
    const claimIdIndex =
      indexOf(
        headers,
        ["claim id"],
      );
    const titleIndex =
      indexOf(
        headers,
        ["event", "title"],
      );
    const noticeDateIndex =
      indexOf(
        headers,
        ["notice date"],
      );
    const claimedDaysIndex =
      indexOf(
        headers,
        ["days claimed"],
      );
    const grantedDaysIndex =
      indexOf(
        headers,
        ["days granted"],
      );
    const statusIndex =
      indexOf(
        headers,
        ["status"],
      );
    const clauseIndex =
      indexOf(
        headers,
        ["clause"],
      );

    const claims:
      CanonicalClaimRecord[] = [];
    const notices:
      CanonicalNoticeRecord[] = [];

    for (
      let rowIndex = 1;
      rowIndex <
      rows.length;
      rowIndex += 1
    ) {
      const row =
        rows[rowIndex] ??
        [];
      const claimId =
        value(
          row,
          claimIdIndex,
        );
      if (!claimId) continue;
      const ref = {
        sourceType:
          "claim" as const,
        sourceId:
          input.document
            .documentId,
        locator:
          "row:" +
          (rowIndex + 1),
      };
      const granted =
        numeric(
          value(
            row,
            grantedDaysIndex,
          ),
        );
      claims.push({
        claimId,
        title:
          value(
            row,
            titleIndex,
          ) || claimId,
        state:
          claimState(
            value(
              row,
              statusIndex,
            ),
          ),
        eventIds: [],
        submittedAt:
          iso(
            value(
              row,
              noticeDateIndex,
            ),
          ),
        claimedDays:
          numeric(
            value(
              row,
              claimedDaysIndex,
            ),
          ),
        claimedAmount: null,
        assessedDays:
          granted,
        assessedDaysState:
          granted === null
            ? "missing"
            : "candidate",
        assessedAmount: null,
        assessedAmountState:
          "missing",
        clauseIdentifiers:
          value(
            row,
            clauseIndex,
          )
            ? [
                value(
                  row,
                  clauseIndex,
                ),
              ]
            : [],
        evidenceRefs: [ref],
        diagnostics: [
          "CLAIM_REGISTER_ROW_HAS_NO_PROVEN_DELAY_EVENT_CAUSATION_LINK",
        ],
      });

      const noticeDate =
        iso(
          value(
            row,
            noticeDateIndex,
          ),
        );
      if (noticeDate) {
        notices.push({
          noticeId:
            claimId +
            ":notice",
          kind:
            "claim_notice",
          eventId: null,
          claimId,
          actualIssuedAt:
            noticeDate,
          actualReceivedAt:
            null,
          plannedAt: null,
          subject:
            value(
              row,
              titleIndex,
            ) || null,
          clauseIdentifiers:
            value(
              row,
              clauseIndex,
            )
              ? [
                  value(
                    row,
                    clauseIndex,
                  ),
                ]
              : [],
          evidenceRefs: [ref],
          diagnostics: [
            "NOTICE_DATE_FROM_CLAIMS_REGISTER",
          ],
        });
      }
    }

    const delayClaims:
      DelayClaimsModel = {
      projectId:
        input.state.projectId,
      evidenceRevisionId:
        "evidence-document:" +
        input.document.documentId,
      events: [],
      notices,
      claims,
      noticeRequirements: [],
      diagnostics: [
        "CLAIMS_REGISTER_PARSED_WITHOUT_INVENTING_DELAY_EVENTS",
      ],
    };

    return {
      delayClaims,
    };
  }

  return {};
}

function derivedRef(
  refs: string[],
): boolean {
  return (
    refs.length > 0 &&
    refs.every(
      (ref) =>
        ref.startsWith(
          "evidence-document:",
        ),
    )
  );
}

function latestById<T>(
  rows: T[],
  id: (row: T) => string,
): T[] {
  const map =
    new Map<string, T>();
  for (const row of rows) {
    map.set(
      id(row),
      row,
    );
  }
  return [
    ...map.values(),
  ];
}

export function rebuildDerivedControls(
  state: ProjectRuntimeState,
): void {
  const manualVariations =
    state.controls.variations
      .filter(
        (row) =>
          !derivedRef(
            row.sourceRefs,
          ),
      );
  const manualInvoices =
    state.controls.invoices
      .filter(
        (row) =>
          !derivedRef(
            row.sourceRefs,
          ),
      );
  const manualNcrs =
    state.controls.ncrs
      .filter(
        (row) =>
          !derivedRef(
            row.sourceRefs,
          ),
      );
  const manualRfis =
    state.controls.rfis
      .filter(
        (row) =>
          !derivedRef(
            row.sourceRefs,
          ),
      );
  const manualRisks =
    state.controls.risks
      .filter(
        (row) =>
          !derivedRef(
            row.sourceRefs,
          ),
      );

  const variations = [
    ...manualVariations,
  ];
  const invoices = [
    ...manualInvoices,
  ];
  const ncrs = [
    ...manualNcrs,
  ];
  const rfis = [
    ...manualRfis,
  ];
  const risks = [
    ...manualRisks,
  ];

  let derivedDelay:
    DelayClaimsModel | null =
    null;

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

  for (
    const document of
      activeDocuments
  ) {
    const derived =
      state
        .derivedControlsByDocument[
          document.documentId
        ];
    if (!derived) continue;
    variations.push(
      ...(derived.variations ??
        []),
    );
    invoices.push(
      ...(derived.invoices ??
        []),
    );
    ncrs.push(
      ...(derived.ncrs ??
        []),
    );
    rfis.push(
      ...(derived.rfis ??
        []),
    );
    risks.push(
      ...(derived.risks ??
        []),
    );
    if (
      derived.delayClaims
    ) {
      derivedDelay =
        derived.delayClaims;
    }
  }

  state.controls.variations =
    latestById(
      variations,
      (row) =>
        row.variationId,
    );
  state.controls.invoices =
    latestById(
      invoices,
      (row) =>
        row.invoiceId,
    );
  state.controls.ncrs =
    latestById(
      ncrs,
      (row) =>
        row.ncrId,
    );
  state.controls.rfis =
    latestById(
      rfis,
      (row) =>
        row.rfiId,
    );
  state.controls.risks =
    latestById(
      risks,
      (row) =>
        row.riskId,
    );

  const currentDelay =
    state.controls
      .delayClaims;
  const manuallyGovernedDelay =
    currentDelay &&
    !currentDelay
      .evidenceRevisionId
      .startsWith(
        "evidence-document:",
      );

  if (
    !manuallyGovernedDelay
  ) {
    state.controls
      .delayClaims =
      derivedDelay;
  }
}
