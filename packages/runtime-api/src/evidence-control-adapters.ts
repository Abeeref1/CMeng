import type {
  CanonicalClaimRecord,
  CanonicalDelayEvent,
  CanonicalNoticeRecord,
  DelayClaimsModel,
  GovernanceState,
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
        [
          "source granted days",
          "days granted",
        ],
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
    const linkedLetterIndex =
      indexOf(
        headers,
        ["linked letter"],
      );

    const events:
      CanonicalDelayEvent[] = [];
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
      const eventTitle =
        value(
          row,
          titleIndex,
        ) ||
        claimId;
      const eventId =
        claimId.replace(
          /^CLM/i,
          "EVT",
        );
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
      const linkedLetter =
        value(
          row,
          linkedLetterIndex,
        );
      const clause =
        value(
          row,
          clauseIndex,
        );
      const granted =
        numeric(
          value(
            row,
            grantedDaysIndex,
          ),
        );

      events.push({
        eventId,
        title: eventTitle,
        category: "other",
        startIso: null,
        endIso: null,
        responsibility:
          "unknown",
        responsibilityState:
          "missing",
        describedImpactDays:
          null,
        describedImpactState:
          "missing",
        relatedActivityIds: [],
        relatedClauseIdentifiers:
          clause ? [clause] : [],
        evidenceRefs: [
          ref,
          ...(linkedLetter
            ? [{
                sourceType:
                  "correspondence" as const,
                sourceId:
                  linkedLetter,
                locator: null,
              }]
            : []),
        ],
        diagnostics: [
          "EVENT_IDENTITY_EXPLICIT_IN_CLAIMS_REGISTER",
          "EVENT_OCCURRENCE_DATE_NOT_ESTABLISHED_BY_CL01",
          "EVENT_SCHEDULE_ACTIVITY_LINK_NOT_YET_ESTABLISHED",
        ],
      });

      claims.push({
        claimId,
        title: eventTitle,
        state:
          claimState(
            value(
              row,
              statusIndex,
            ),
          ),
        eventIds: [
          eventId,
        ],
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
          clause ? [clause] : [],
        evidenceRefs: [ref],
        diagnostics: [
          "CLAIM_LINKED_TO_EXPLICIT_SUBMITTED_EVENT_IDENTITY",
          "CLAIM_EVENT_CAUSATION_TO_SCHEDULE_NOT_YET_GOVERNED",
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
          eventId,
          claimId,
          actualIssuedAt:
            noticeDate,
          actualReceivedAt:
            null,
          plannedAt: null,
          subject:
            eventTitle,
          clauseIdentifiers:
            clause ? [clause] : [],
          evidenceRefs: [
            ref,
            ...(linkedLetter
              ? [{
                  sourceType:
                    "correspondence" as const,
                  sourceId:
                    linkedLetter,
                  locator: null,
                }]
              : []),
          ],
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
      events,
      notices,
      claims,
      noticeRequirements: [],
      diagnostics: [
        "CLAIMS_REGISTER_EVENT_IDENTITIES_PROMOTED_WITHOUT_INVENTING_EVENT_DATES_OR_RESPONSIBILITY",
      ],
    };

    return {
      delayClaims,
    };
  }

  if (
    input.document
      .documentType ===
      "delay_event_impact_register"
  ) {
    const claimIdIndex =
      indexOf(
        headers,
        ["claim id"],
      );
    const criticalIndex =
      indexOf(
        headers,
        [
          "calculated critical impact days",
        ],
      );
    const netIndex =
      indexOf(
        headers,
        [
          "net assessed impact days",
        ],
      );
    const concurrencyIndex =
      indexOf(
        headers,
        ["concurrency days"],
      );
    const mitigationIndex =
      indexOf(
        headers,
        ["mitigation days"],
      );
    const claims:
      CanonicalClaimRecord[] = [];
    const events:
      CanonicalDelayEvent[] = [];

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
      const eventId =
        claimId.replace(
          /^CLM/i,
          "EVT",
        );
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
      const net =
        numeric(
          value(
            row,
            netIndex,
          ),
        );
      const critical =
        numeric(
          value(
            row,
            criticalIndex,
          ),
        );
      const concurrency =
        numeric(
          value(
            row,
            concurrencyIndex,
          ),
        );
      const mitigation =
        numeric(
          value(
            row,
            mitigationIndex,
          ),
        );

      events.push({
        eventId,
        title:
          "Delay event for " +
          claimId,
        category: "other",
        startIso: null,
        endIso: null,
        responsibility:
          "unknown",
        responsibilityState:
          "missing",
        describedImpactDays:
          net,
        describedImpactState:
          net === null
            ? "missing"
            : "provisional",
        relatedActivityIds: [],
        relatedClauseIdentifiers:
          [],
        evidenceRefs: [ref],
        diagnostics: [
          "ANALYTICAL_EVENT_IMPACT_FROM_EOT01",
          ...(critical !== null
            ? [
                "CALCULATED_CRITICAL_IMPACT_DAYS:" +
                  critical,
              ]
            : []),
          ...(concurrency !== null
            ? [
                "CONCURRENCY_DAYS:" +
                  concurrency,
              ]
            : []),
          ...(mitigation !== null
            ? [
                "MITIGATION_DAYS:" +
                  mitigation,
              ]
            : []),
        ],
      });

      claims.push({
        claimId,
        title: claimId,
        state:
          "under_review",
        eventIds: [
          eventId,
        ],
        submittedAt: null,
        claimedDays: null,
        claimedAmount: null,
        assessedDays: net,
        assessedDaysState:
          net === null
            ? "missing"
            : "provisional",
        assessedAmount: null,
        assessedAmountState:
          "missing",
        clauseIdentifiers: [],
        evidenceRefs: [ref],
        diagnostics: [
          "EOT01_ANALYTICAL_IMPACT_IS_NOT_ENGINEER_DETERMINATION",
        ],
      });
    }

    return {
      delayClaims: {
        projectId:
          input.state.projectId,
        evidenceRevisionId:
          "evidence-document:" +
          input.document.documentId,
        events,
        notices: [],
        claims,
        noticeRequirements: [],
        diagnostics: [
          "EOT01_IMPACT_REGISTER_MERGED_BY_CLAIM_ID",
        ],
      },
    };
  }

  if (
    input.document
      .documentType ===
      "entitlement_assessment_register"
  ) {
    const claimIdIndex =
      indexOf(
        headers,
        ["claim id"],
      );
    const claimedIndex =
      indexOf(
        headers,
        ["claimed days"],
      );
    const assessedIndex =
      indexOf(
        headers,
        ["assessed days"],
      );
    const employerIndex =
      indexOf(
        headers,
        ["employer delay days"],
      );
    const contractorIndex =
      indexOf(
        headers,
        ["contractor delay days"],
      );
    const concurrencyIndex =
      indexOf(
        headers,
        ["concurrency days"],
      );
    const claims:
      CanonicalClaimRecord[] = [];
    const events:
      CanonicalDelayEvent[] = [];

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
      const eventId =
        claimId.replace(
          /^CLM/i,
          "EVT",
        );
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
      const employer =
        numeric(
          value(
            row,
            employerIndex,
          ),
        ) ?? 0;
      const contractor =
        numeric(
          value(
            row,
            contractorIndex,
          ),
        ) ?? 0;
      const concurrency =
        numeric(
          value(
            row,
            concurrencyIndex,
          ),
        ) ?? 0;
      const responsibility:
        CanonicalDelayEvent["responsibility"] =
        concurrency > 0 ||
        (
          employer > 0 &&
          contractor > 0
        )
          ? "concurrent"
          : employer > 0
            ? "employer"
            : contractor > 0
              ? "contractor"
              : "unknown";
      const assessed =
        numeric(
          value(
            row,
            assessedIndex,
          ),
        );

      events.push({
        eventId,
        title:
          "Delay event for " +
          claimId,
        category: "other",
        startIso: null,
        endIso: null,
        responsibility,
        responsibilityState:
          responsibility ===
            "unknown"
            ? "missing"
            : "provisional",
        describedImpactDays:
          assessed,
        describedImpactState:
          assessed === null
            ? "missing"
            : "provisional",
        relatedActivityIds: [],
        relatedClauseIdentifiers:
          [],
        evidenceRefs: [ref],
        diagnostics: [
          "RESPONSIBILITY_FROM_EOT02_ENTITLEMENT_ASSESSMENT",
          "ENTITLEMENT_ASSESSMENT_IS_PROVISIONAL_UNTIL_DETERMINATION",
        ],
      });

      claims.push({
        claimId,
        title: claimId,
        state:
          "under_review",
        eventIds: [
          eventId,
        ],
        submittedAt: null,
        claimedDays:
          numeric(
            value(
              row,
              claimedIndex,
            ),
          ),
        claimedAmount: null,
        assessedDays:
          assessed,
        assessedDaysState:
          assessed === null
            ? "missing"
            : "provisional",
        assessedAmount: null,
        assessedAmountState:
          "missing",
        clauseIdentifiers: [],
        evidenceRefs: [ref],
        diagnostics: [
          "EOT02_ENTITLEMENT_ASSESSMENT_IS_NOT_FINAL_ENGINEER_DETERMINATION",
        ],
      });
    }

    return {
      delayClaims: {
        projectId:
          input.state.projectId,
        evidenceRevisionId:
          "evidence-document:" +
          input.document.documentId,
        events,
        notices: [],
        claims,
        noticeRequirements: [],
        diagnostics: [
          "EOT02_ENTITLEMENT_REGISTER_MERGED_BY_CLAIM_ID",
        ],
      },
    };
  }

  if (
    input.document
      .documentType ===
      "engineer_determination_register"
  ) {
    const determinationIdIndex =
      indexOf(
        headers,
        ["determination id"],
      );
    const claimIdIndex =
      indexOf(
        headers,
        ["claim id"],
      );
    const awardedIndex =
      indexOf(
        headers,
        ["awarded eot days"],
      );
    const dateIndex =
      indexOf(
        headers,
        ["determination date"],
      );
    const letterIndex =
      indexOf(
        headers,
        ["source letter"],
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
      const eventId =
        claimId.replace(
          /^CLM/i,
          "EVT",
        );
      const awarded =
        numeric(
          value(
            row,
            awardedIndex,
          ),
        );
      const determinationId =
        value(
          row,
          determinationIdIndex,
        ) ||
        claimId +
        ":determination";
      const sourceLetter =
        value(
          row,
          letterIndex,
        );
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

      claims.push({
        claimId,
        title: claimId,
        state:
          "determined",
        eventIds: [
          eventId,
        ],
        submittedAt: null,
        claimedDays: null,
        claimedAmount: null,
        assessedDays:
          awarded,
        assessedDaysState:
          awarded === null
            ? "missing"
            : "official",
        assessedAmount: null,
        assessedAmountState:
          "missing",
        clauseIdentifiers: [],
        evidenceRefs: [
          ref,
          ...(sourceLetter
            ? [{
                sourceType:
                  "correspondence" as const,
                sourceId:
                  sourceLetter,
                locator: null,
              }]
            : []),
        ],
        diagnostics: [
          "ENGINEER_DETERMINATION_OVERRIDES_STALE_PROVISIONAL_ASSESSMENT",
        ],
      });
      notices.push({
        noticeId:
          determinationId,
        kind:
          "determination",
        eventId,
        claimId,
        actualIssuedAt:
          iso(
            value(
              row,
              dateIndex,
            ),
          ),
        actualReceivedAt:
          null,
        plannedAt: null,
        subject:
          "Engineer determination " +
          determinationId,
        clauseIdentifiers: [],
        evidenceRefs: [
          ref,
          ...(sourceLetter
            ? [{
                sourceType:
                  "correspondence" as const,
                sourceId:
                  sourceLetter,
                locator: null,
              }]
            : []),
        ],
        diagnostics: [
          "IMMUTABLE_ENGINEER_DETERMINATION",
        ],
      });
    }

    return {
      delayClaims: {
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
          "EOT03_ENGINEER_DETERMINATIONS_MERGED_AS_OFFICIAL_AUTHORITY",
        ],
      },
    };
  }

  return {};
}

function governanceRank(
  state: GovernanceState,
): number {
  return state === "official"
    ? 4
    : state === "provisional"
      ? 3
      : state === "candidate"
        ? 2
        : 1;
}

function uniqueStrings(
  values: string[],
): string[] {
  return [...new Set(values)];
}

function mergeDelayModels(
  models: DelayClaimsModel[],
  projectId: string,
): DelayClaimsModel | null {
  if (!models.length) return null;

  const events =
    new Map<
      string,
      CanonicalDelayEvent
    >();
  const claims =
    new Map<
      string,
      CanonicalClaimRecord
    >();
  const notices =
    new Map<
      string,
      CanonicalNoticeRecord
    >();
  const requirements =
    new Map<
      string,
      DelayClaimsModel["noticeRequirements"][number]
    >();

  for (const model of models) {
    for (const next of model.events) {
      const prior =
        events.get(next.eventId);
      if (!prior) {
        events.set(
          next.eventId,
          next,
        );
        continue;
      }
      const responsibilityFromNext =
        governanceRank(
          next.responsibilityState,
        ) >
        governanceRank(
          prior.responsibilityState,
        );
      const impactFromNext =
        governanceRank(
          next.describedImpactState,
        ) >
        governanceRank(
          prior.describedImpactState,
        );
      events.set(
        next.eventId,
        {
          ...prior,
          title:
            prior.title ||
            next.title,
          category:
            prior.category !==
              "other"
              ? prior.category
              : next.category,
          startIso:
            prior.startIso ??
            next.startIso,
          endIso:
            prior.endIso ??
            next.endIso,
          responsibility:
            responsibilityFromNext
              ? next.responsibility
              : prior.responsibility,
          responsibilityState:
            responsibilityFromNext
              ? next.responsibilityState
              : prior.responsibilityState,
          describedImpactDays:
            impactFromNext
              ? next.describedImpactDays
              : prior.describedImpactDays,
          describedImpactState:
            impactFromNext
              ? next.describedImpactState
              : prior.describedImpactState,
          relatedActivityIds:
            uniqueStrings([
              ...prior.relatedActivityIds,
              ...next.relatedActivityIds,
            ]),
          relatedClauseIdentifiers:
            uniqueStrings([
              ...prior.relatedClauseIdentifiers,
              ...next.relatedClauseIdentifiers,
            ]),
          evidenceRefs:
            [
              ...prior.evidenceRefs,
              ...next.evidenceRefs,
            ],
          diagnostics:
            uniqueStrings([
              ...prior.diagnostics,
              ...next.diagnostics,
            ]),
        },
      );
    }

    for (const next of model.claims) {
      const prior =
        claims.get(next.claimId);
      if (!prior) {
        claims.set(
          next.claimId,
          next,
        );
        continue;
      }
      const nextAssessmentWins =
        governanceRank(
          next.assessedDaysState,
        ) >
          governanceRank(
            prior.assessedDaysState,
          ) ||
        (
          governanceRank(
            next.assessedDaysState,
          ) ===
            governanceRank(
              prior.assessedDaysState,
            ) &&
          next.assessedDays !==
            null
        );
      const stateRank = (
        state:
          CanonicalClaimRecord["state"],
      ) =>
        state === "determined"
          ? 6
          : state === "rejected"
            ? 5
            : state === "under_review"
              ? 4
              : state === "submitted"
                ? 3
                : state === "draft"
                  ? 2
                  : 1;
      claims.set(
        next.claimId,
        {
          ...prior,
          title:
            prior.title ||
            next.title,
          state:
            stateRank(next.state) >
            stateRank(prior.state)
              ? next.state
              : prior.state,
          eventIds:
            uniqueStrings([
              ...prior.eventIds,
              ...next.eventIds,
            ]),
          submittedAt:
            prior.submittedAt ??
            next.submittedAt,
          claimedDays:
            prior.claimedDays ??
            next.claimedDays,
          claimedAmount:
            prior.claimedAmount ??
            next.claimedAmount,
          assessedDays:
            nextAssessmentWins
              ? next.assessedDays
              : prior.assessedDays,
          assessedDaysState:
            nextAssessmentWins
              ? next.assessedDaysState
              : prior.assessedDaysState,
          assessedAmount:
            prior.assessedAmount ??
            next.assessedAmount,
          assessedAmountState:
            governanceRank(
              next.assessedAmountState,
            ) >
            governanceRank(
              prior.assessedAmountState,
            )
              ? next.assessedAmountState
              : prior.assessedAmountState,
          clauseIdentifiers:
            uniqueStrings([
              ...prior.clauseIdentifiers,
              ...next.clauseIdentifiers,
            ]),
          evidenceRefs:
            [
              ...prior.evidenceRefs,
              ...next.evidenceRefs,
            ],
          diagnostics:
            uniqueStrings([
              ...prior.diagnostics,
              ...next.diagnostics,
            ]),
        },
      );
    }

    for (const notice of model.notices) {
      const prior =
        notices.get(
          notice.noticeId,
        );
      notices.set(
        notice.noticeId,
        prior
          ? {
              ...prior,
              ...notice,
              actualIssuedAt:
                notice.actualIssuedAt ??
                prior.actualIssuedAt,
              actualReceivedAt:
                notice.actualReceivedAt ??
                prior.actualReceivedAt,
              evidenceRefs: [
                ...prior.evidenceRefs,
                ...notice.evidenceRefs,
              ],
              diagnostics:
                uniqueStrings([
                  ...prior.diagnostics,
                  ...notice.diagnostics,
                ]),
            }
          : notice,
      );
    }

    for (const requirement of model.noticeRequirements) {
      const prior =
        requirements.get(
          requirement
            .requirementId,
        );
      if (
        !prior ||
        governanceRank(
          requirement.state,
        ) >
          governanceRank(
            prior.state,
          )
      ) {
        requirements.set(
          requirement
            .requirementId,
          requirement,
        );
      }
    }
  }

  return {
    projectId,
    evidenceRevisionId:
      "evidence-composite:" +
      models
        .map(
          (model) =>
            model.evidenceRevisionId,
        )
        .join("|"),
    events: [
      ...events.values(),
    ],
    notices: [
      ...notices.values(),
    ],
    claims: [
      ...claims.values(),
    ],
    noticeRequirements: [
      ...requirements.values(),
    ],
    diagnostics:
      uniqueStrings(
        models.flatMap(
          (model) =>
            model.diagnostics,
        ),
      ),
  };
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

  const derivedDelayModels:
    DelayClaimsModel[] = [];

  const activeDocuments =
    state.evidenceDocuments
      .filter(
        (document) =>
          document.basisState ===
            "active" ||
          document.basisState ===
            "additive" ||
          (
            document.basisState ===
              "candidate" &&
            [
              "delay_event_impact_register",
              "entitlement_assessment_register",
              "engineer_determination_register",
              "mitigation_acceleration_register",
            ].includes(
              document.documentType,
            )
          ),
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
      derivedDelayModels.push(
        derived.delayClaims,
      );
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
      mergeDelayModels(
        derivedDelayModels,
        state.projectId,
      );
  }
}
