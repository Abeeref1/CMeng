import type {
  CanonicalClaimRecord,
  CanonicalDelayEvent,
  CanonicalNoticeRecord,
  DelayClaimsModel,
  GovernanceState,
} from "../../delay-analysis-core/src";
import type {
  EngineerEotDetermination,
} from "../../eot-assessment/src";
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

function yesNoValue(
  raw: string,
): boolean | null {
  const normalized =
    norm(raw);
  if (
    normalized === "yes" ||
    normalized === "y" ||
    normalized === "true" ||
    normalized === "1" ||
    normalized === "approved"
  ) {
    return true;
  }
  if (
    normalized === "no" ||
    normalized === "n" ||
    normalized === "false" ||
    normalized === "0" ||
    normalized === "rejected"
  ) {
    return false;
  }
  return null;
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
        [
          "linked letter",
          "source letter",
        ],
      );

    const claims:
      CanonicalClaimRecord[] = [];
    const notices:
      CanonicalNoticeRecord[] = [];
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
        "delay-event:" +
        claimId;
      const title =
        value(
          row,
          titleIndex,
        ) || claimId;
      const claimedDays =
        numeric(
          value(
            row,
            claimedDaysIndex,
          ),
        );
      const grantedDays =
        numeric(
          value(
            row,
            grantedDaysIndex,
          ),
        );
      const noticeDate =
        iso(
          value(
            row,
            noticeDateIndex,
          ),
        );
      const clause =
        value(
          row,
          clauseIndex,
        );
      const linkedLetter =
        value(
          row,
          linkedLetterIndex,
        );
      const rowRef = {
        sourceType:
          "claim" as const,
        sourceId:
          input.document
            .documentId,
        locator:
          "row:" +
          (rowIndex + 1),
      };

      events.push({
        eventId,
        title,
        category: "other",
        startIso: null,
        endIso: null,
        responsibility:
          "unknown",
        responsibilityState:
          "missing",
        describedImpactDays:
          claimedDays,
        describedImpactState:
          claimedDays === null
            ? "missing"
            : "candidate",
        relatedActivityIds: [],
        relatedClauseIdentifiers:
          clause
            ? [clause]
            : [],
        evidenceRefs: [
          rowRef,
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
          "DELAY_EVENT_IDENTITY_ESTABLISHED_FROM_CLAIM_EVENT_REGISTER",
          "DELAY_EVENT_OCCURRENCE_DATE_REQUIRES_EVENT_OR_CORRESPONDENCE_EVIDENCE",
        ],
      });

      claims.push({
        claimId,
        title,
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
          noticeDate,
        claimedDays,
        claimedAmount: null,
        assessedDays:
          grantedDays,
        assessedDaysState:
          grantedDays === null
            ? "missing"
            : "candidate",
        assessedAmount: null,
        assessedAmountState:
          "missing",
        clauseIdentifiers:
          clause
            ? [clause]
            : [],
        evidenceRefs: [
          rowRef,
        ],
        diagnostics: [
          "CLAIM_LINKED_TO_REGISTERED_DELAY_EVENT_IDENTITY",
        ],
      });

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
          subject: title,
          clauseIdentifiers:
            clause
              ? [clause]
              : [],
          evidenceRefs: [
            rowRef,
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
            ...(linkedLetter
              ? [
                  "NOTICE_LINKED_TO_CORRESPONDENCE_REFERENCE",
                ]
              : []),
          ],
        });
      }
    }

    return {
      delayClaims: {
        projectId:
          input.state.projectId,
        evidenceRevisionId:
          "evidence-document:" +
          input.document
            .documentId,
        events,
        notices,
        claims,
        noticeRequirements: [],
        diagnostics: [
          "CLAIM_EVENT_REGISTER_CREATED_EVENT_IDENTITIES_WITHOUT_INVENTING_EVENT_DATES_OR_CAUSATION",
        ],
      },
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
    const netIndex =
      indexOf(
        headers,
        [
          "net assessed impact days",
        ],
      );
    const approvedIndex =
      indexOf(
        headers,
        ["approved"],
      );

    const events:
      CanonicalDelayEvent[] = [];
    const claims:
      CanonicalClaimRecord[] = [];

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
        "delay-event:" +
        claimId;
      const approved =
        yesNoValue(
          value(
            row,
            approvedIndex,
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
      const net =
        numeric(
          value(
            row,
            netIndex,
          ),
        );
      const governance:
        GovernanceState =
        approved === true
          ? "official"
          : "candidate";
      const rowRef = {
        sourceType:
          "claim" as const,
        sourceId:
          input.document
            .documentId,
        locator:
          "row:" +
          (rowIndex + 1),
      };

      events.push({
        eventId,
        title:
          claimId +
          " impact assessment",
        category: "other",
        startIso: null,
        endIso: null,
        responsibility:
          "unknown",
        responsibilityState:
          "missing",
        describedImpactDays:
          net ?? critical,
        describedImpactState:
          (
            net ??
            critical
          ) === null
            ? "missing"
            : governance,
        relatedActivityIds: [],
        relatedClauseIdentifiers:
          [],
        evidenceRefs: [
          rowRef,
        ],
        diagnostics: [
          "DELAY_IMPACT_REGISTER_ASSESSMENT",
          ...(concurrency !==
            null &&
          concurrency > 0
            ? [
                "CONCURRENCY_DAYS:" +
                  concurrency,
              ]
            : []),
          ...(mitigation !==
            null &&
          mitigation !== 0
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
          approved === true
            ? "determined"
            : "under_review",
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
            : governance,
        assessedAmount: null,
        assessedAmountState:
          "missing",
        clauseIdentifiers: [],
        evidenceRefs: [
          rowRef,
        ],
        diagnostics: [
          "ASSESSED_DAYS_FROM_DELAY_EVENT_IMPACT_REGISTER",
        ],
      });
    }

    return {
      delayClaims: {
        projectId:
          input.state.projectId,
        evidenceRevisionId:
          "evidence-document:" +
          input.document
            .documentId,
        events,
        notices: [],
        claims,
        noticeRequirements: [],
        diagnostics: [
          "DELAY_IMPACT_REGISTER_FRAGMENT",
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
    const mitigationIndex =
      indexOf(
        headers,
        ["mitigation days"],
      );
    const approvedIndex =
      indexOf(
        headers,
        ["approved"],
      );

    const events:
      CanonicalDelayEvent[] = [];
    const claims:
      CanonicalClaimRecord[] = [];

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
        "delay-event:" +
        claimId;
      const approved =
        yesNoValue(
          value(
            row,
            approvedIndex,
          ),
        );
      const assessed =
        numeric(
          value(
            row,
            assessedIndex,
          ),
        );
      const employer =
        numeric(
          value(
            row,
            employerIndex,
          ),
        ) ??
        0;
      const contractor =
        numeric(
          value(
            row,
            contractorIndex,
          ),
        ) ??
        0;
      const concurrency =
        numeric(
          value(
            row,
            concurrencyIndex,
          ),
        ) ??
        0;
      const mitigation =
        numeric(
          value(
            row,
            mitigationIndex,
          ),
        ) ??
        0;
      const governance:
        GovernanceState =
        approved === true
          ? "official"
          : "candidate";
      const responsibility:
        CanonicalDelayEvent["responsibility"] =
        employer > 0 &&
        contractor === 0
          ? "employer"
          : contractor > 0 &&
              employer === 0
            ? "contractor"
            : "unknown";
      const rowRef = {
        sourceType:
          "claim" as const,
        sourceId:
          input.document
            .documentId,
        locator:
          "row:" +
          (rowIndex + 1),
      };

      events.push({
        eventId,
        title:
          claimId +
          " entitlement assessment",
        category: "other",
        startIso: null,
        endIso: null,
        responsibility,
        responsibilityState:
          responsibility ===
          "unknown"
            ? "candidate"
            : governance,
        describedImpactDays:
          assessed,
        describedImpactState:
          assessed === null
            ? "missing"
            : governance,
        relatedActivityIds: [],
        relatedClauseIdentifiers:
          [],
        evidenceRefs: [
          rowRef,
        ],
        diagnostics: [
          "ENTITLEMENT_ASSESSMENT_REGISTER",
          ...(concurrency > 0
            ? [
                "CONCURRENCY_DAYS:" +
                  concurrency,
              ]
            : []),
          ...(mitigation !== 0
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
          approved === true
            ? "determined"
            : "under_review",
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
            : governance,
        assessedAmount: null,
        assessedAmountState:
          "missing",
        clauseIdentifiers: [],
        evidenceRefs: [
          rowRef,
        ],
        diagnostics: [
          "ASSESSED_DAYS_FROM_ENTITLEMENT_REGISTER",
        ],
      });
    }

    return {
      delayClaims: {
        projectId:
          input.state.projectId,
        evidenceRevisionId:
          "evidence-document:" +
          input.document
            .documentId,
        events,
        notices: [],
        claims,
        noticeRequirements: [],
        diagnostics: [
          "ENTITLEMENT_ASSESSMENT_REGISTER_FRAGMENT",
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
    const statusIndex =
      indexOf(
        headers,
        ["status"],
      );
    const authorityIndex =
      indexOf(
        headers,
        ["authority"],
      );
    const letterIndex =
      indexOf(
        headers,
        ["source letter"],
      );
    const governanceIndex =
      indexOf(
        headers,
        ["governance state"],
      );
    const determinations:
      EngineerEotDetermination[] =
      [];

    for (
      let rowIndex = 1;
      rowIndex <
      rows.length;
      rowIndex += 1
    ) {
      const row =
        rows[rowIndex] ??
        [];
      const determinationId =
        value(
          row,
          determinationIdIndex,
        );
      if (!determinationId) {
        continue;
      }
      const governance =
        value(
          row,
          governanceIndex,
        );
      determinations.push({
        determinationId,
        claimId:
          value(
            row,
            claimIdIndex,
          ) || null,
        awardedEotDays:
          numeric(
            value(
              row,
              awardedIndex,
            ),
          ),
        determinationDateIso:
          iso(
            value(
              row,
              dateIndex,
            ),
          ),
        status:
          value(
            row,
            statusIndex,
          ) || null,
        authority:
          value(
            row,
            authorityIndex,
          ) || null,
        sourceLetter:
          value(
            row,
            letterIndex,
          ) || null,
        governanceState:
          governance ||
          null,
        immutable:
          norm(
            governance,
          ).includes(
            "immutable",
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
      eotDeterminations:
        determinations,
    };
  }

  if (
    input.document
      .documentType ===
    "mitigation_acceleration_register"
  ) {
    return {};
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

function governanceRank(
  state: GovernanceState,
): number {
  if (state === "official") return 4;
  if (state === "provisional") return 3;
  if (state === "candidate") return 2;
  return 1;
}

function claimStateRank(
  state: CanonicalClaimRecord["state"],
): number {
  if (state === "determined") return 6;
  if (state === "rejected") return 5;
  if (state === "under_review") return 4;
  if (state === "submitted") return 3;
  if (state === "draft") return 2;
  if (state === "withdrawn") return 1;
  return 0;
}

function evidenceRefKey(
  ref: CanonicalDelayEvent["evidenceRefs"][number],
): string {
  return [
    ref.sourceType,
    ref.sourceId,
    ref.locator ?? "",
  ].join("|");
}

function uniqueDelayRefs(
  refs: CanonicalDelayEvent["evidenceRefs"],
): CanonicalDelayEvent["evidenceRefs"] {
  const map = new Map<
    string,
    CanonicalDelayEvent["evidenceRefs"][number]
  >();
  for (const ref of refs) {
    map.set(
      evidenceRefKey(ref),
      ref,
    );
  }
  return [...map.values()];
}

function mergeDelayEvent(
  before: CanonicalDelayEvent | null,
  incoming: CanonicalDelayEvent,
): CanonicalDelayEvent {
  if (!before) {
    return {
      ...incoming,
      relatedActivityIds: [
        ...new Set(
          incoming.relatedActivityIds,
        ),
      ],
      relatedClauseIdentifiers: [
        ...new Set(
          incoming
            .relatedClauseIdentifiers,
        ),
      ],
      evidenceRefs:
        uniqueDelayRefs(
          incoming.evidenceRefs,
        ),
      diagnostics: [
        ...new Set(
          incoming.diagnostics,
        ),
      ],
    };
  }

  const incomingResponsibilityWins =
    governanceRank(
      incoming.responsibilityState,
    ) >
      governanceRank(
        before.responsibilityState,
      ) ||
    (
      governanceRank(
        incoming.responsibilityState,
      ) ===
        governanceRank(
          before.responsibilityState,
        ) &&
      before.responsibility ===
        "unknown" &&
      incoming.responsibility !==
        "unknown"
    );

  const incomingImpactWins =
    incoming.describedImpactDays !==
      null &&
    (
      before.describedImpactDays ===
        null ||
      governanceRank(
        incoming.describedImpactState,
      ) >=
        governanceRank(
          before.describedImpactState,
        )
    );

  return {
    ...before,
    title:
      (
        before.title ===
          before.eventId ||
        before.title.includes(
          "impact assessment",
        ) ||
        before.title.includes(
          "entitlement assessment",
        )
      ) &&
      incoming.title
        ? incoming.title
        : before.title,
    startIso:
      before.startIso ??
      incoming.startIso,
    endIso:
      before.endIso ??
      incoming.endIso,
    responsibility:
      incomingResponsibilityWins
        ? incoming.responsibility
        : before.responsibility,
    responsibilityState:
      incomingResponsibilityWins
        ? incoming.responsibilityState
        : before.responsibilityState,
    describedImpactDays:
      incomingImpactWins
        ? incoming.describedImpactDays
        : before.describedImpactDays,
    describedImpactState:
      incomingImpactWins
        ? incoming.describedImpactState
        : before.describedImpactState,
    relatedActivityIds: [
      ...new Set([
        ...before.relatedActivityIds,
        ...incoming.relatedActivityIds,
      ]),
    ],
    relatedClauseIdentifiers: [
      ...new Set([
        ...before
          .relatedClauseIdentifiers,
        ...incoming
          .relatedClauseIdentifiers,
      ]),
    ],
    evidenceRefs:
      uniqueDelayRefs([
        ...before.evidenceRefs,
        ...incoming.evidenceRefs,
      ]),
    diagnostics: [
      ...new Set([
        ...before.diagnostics,
        ...incoming.diagnostics,
      ]),
    ],
  };
}

function mergeClaim(
  before: CanonicalClaimRecord | null,
  incoming: CanonicalClaimRecord,
): CanonicalClaimRecord {
  if (!before) {
    return {
      ...incoming,
      eventIds: [
        ...new Set(
          incoming.eventIds,
        ),
      ],
      clauseIdentifiers: [
        ...new Set(
          incoming
            .clauseIdentifiers,
        ),
      ],
      evidenceRefs:
        uniqueDelayRefs(
          incoming.evidenceRefs,
        ),
      diagnostics: [
        ...new Set(
          incoming.diagnostics,
        ),
      ],
    };
  }

  const incomingAssessmentWins =
    incoming.assessedDays !==
      null &&
    (
      before.assessedDays ===
        null ||
      governanceRank(
        incoming.assessedDaysState,
      ) >=
        governanceRank(
          before.assessedDaysState,
        )
    );
  const incomingAmountWins =
    incoming.assessedAmount !==
      null &&
    (
      before.assessedAmount ===
        null ||
      governanceRank(
        incoming.assessedAmountState,
      ) >=
        governanceRank(
          before.assessedAmountState,
        )
    );

  return {
    ...before,
    title:
      before.title ===
        before.claimId &&
      incoming.title !==
        incoming.claimId
        ? incoming.title
        : before.title,
    state:
      claimStateRank(
        incoming.state,
      ) >
      claimStateRank(
        before.state,
      )
        ? incoming.state
        : before.state,
    eventIds: [
      ...new Set([
        ...before.eventIds,
        ...incoming.eventIds,
      ]),
    ],
    submittedAt:
      before.submittedAt ??
      incoming.submittedAt,
    claimedDays:
      before.claimedDays ??
      incoming.claimedDays,
    claimedAmount:
      before.claimedAmount ??
      incoming.claimedAmount,
    assessedDays:
      incomingAssessmentWins
        ? incoming.assessedDays
        : before.assessedDays,
    assessedDaysState:
      incomingAssessmentWins
        ? incoming.assessedDaysState
        : before.assessedDaysState,
    assessedAmount:
      incomingAmountWins
        ? incoming.assessedAmount
        : before.assessedAmount,
    assessedAmountState:
      incomingAmountWins
        ? incoming.assessedAmountState
        : before.assessedAmountState,
    clauseIdentifiers: [
      ...new Set([
        ...before.clauseIdentifiers,
        ...incoming.clauseIdentifiers,
      ]),
    ],
    evidenceRefs:
      uniqueDelayRefs([
        ...before.evidenceRefs,
        ...incoming.evidenceRefs,
      ]),
    diagnostics: [
      ...new Set([
        ...before.diagnostics,
        ...incoming.diagnostics,
      ]),
    ],
  };
}

function mergeDelayFragments(
  projectId: string,
  fragments: DelayClaimsModel[],
): DelayClaimsModel | null {
  if (fragments.length === 0) {
    return null;
  }

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

  for (const fragment of fragments) {
    for (const event of fragment.events) {
      events.set(
        event.eventId,
        mergeDelayEvent(
          events.get(
            event.eventId,
          ) ?? null,
          event,
        ),
      );
    }
    for (const claim of fragment.claims) {
      claims.set(
        claim.claimId,
        mergeClaim(
          claims.get(
            claim.claimId,
          ) ?? null,
          claim,
        ),
      );
    }
    for (const notice of fragment.notices) {
      const existing =
        notices.get(
          notice.noticeId,
        );
      notices.set(
        notice.noticeId,
        existing
          ? {
              ...existing,
              eventId:
                existing.eventId ??
                notice.eventId,
              claimId:
                existing.claimId ??
                notice.claimId,
              actualIssuedAt:
                existing
                  .actualIssuedAt ??
                notice
                  .actualIssuedAt,
              actualReceivedAt:
                existing
                  .actualReceivedAt ??
                notice
                  .actualReceivedAt,
              plannedAt:
                existing.plannedAt ??
                notice.plannedAt,
              subject:
                existing.subject ??
                notice.subject,
              clauseIdentifiers: [
                ...new Set([
                  ...existing
                    .clauseIdentifiers,
                  ...notice
                    .clauseIdentifiers,
                ]),
              ],
              evidenceRefs:
                uniqueDelayRefs([
                  ...existing
                    .evidenceRefs,
                  ...notice
                    .evidenceRefs,
                ]),
              diagnostics: [
                ...new Set([
                  ...existing
                    .diagnostics,
                  ...notice
                    .diagnostics,
                ]),
              ],
            }
          : notice,
      );
    }
    for (
      const requirement of
        fragment.noticeRequirements
    ) {
      const existing =
        requirements.get(
          requirement
            .requirementId,
        );
      if (
        !existing ||
        governanceRank(
          requirement.state,
        ) >
          governanceRank(
            existing.state,
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
      "merged-evidence:" +
      fragments
        .map(
          (fragment) =>
            fragment
              .evidenceRevisionId,
        )
        .sort()
        .join("|"),
    events: [
      ...events.values(),
    ].sort(
      (a, b) =>
        a.eventId.localeCompare(
          b.eventId,
        ),
    ),
    notices: [
      ...notices.values(),
    ].sort(
      (a, b) =>
        a.noticeId.localeCompare(
          b.noticeId,
        ),
    ),
    claims: [
      ...claims.values(),
    ].sort(
      (a, b) =>
        a.claimId.localeCompare(
          b.claimId,
        ),
    ),
    noticeRequirements: [
      ...requirements.values(),
    ].sort(
      (a, b) =>
        a.requirementId.localeCompare(
          b.requirementId,
        ),
    ),
    diagnostics: [
      ...new Set([
        ...fragments.flatMap(
          (fragment) =>
            fragment.diagnostics,
        ),
        "DELAY_EVENT_CLAIM_EVIDENCE_MERGED_ACROSS_ACTIVE_REGISTERS",
      ]),
    ],
  };
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
  const delayFragments:
    DelayClaimsModel[] = [];
  const determinations:
    EngineerEotDetermination[] =
    [];

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
      delayFragments.push(
        derived.delayClaims,
      );
    }
    determinations.push(
      ...(
        derived
          .eotDeterminations ??
        []
      ),
    );
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
      ) &&
    !currentDelay
      .evidenceRevisionId
      .startsWith(
        "merged-evidence:",
      );

  if (
    !manuallyGovernedDelay
  ) {
    state.controls.delayClaims =
      mergeDelayFragments(
        state.projectId,
        delayFragments,
      );
  }

  const timeBasis =
    state.controls
      .contractTimeBasis;
  if (
    timeBasis &&
    determinations.length > 0
  ) {
    const unique =
      latestById(
        determinations,
        (item) =>
          item.determinationId,
      );
    const awarded =
      unique
        .map(
          (item) =>
            item.awardedEotDays,
        )
        .filter(
          (
            value,
          ): value is number =>
            value !== null,
        );
    state.controls
      .contractTimeBasis = {
        ...timeBasis,
        engineerDeterminations:
          unique,
        engineerDeterminationCount:
          unique.length,
        engineerDeterminationAwardedDaysTotal:
          awarded.length > 0
            ? Number(
                awarded
                  .reduce(
                    (
                      sum,
                      value,
                    ) =>
                      sum +
                      value,
                    0,
                  )
                  .toFixed(6),
              )
            : null,
        determinationAggregationState:
          "register_established_non_additive",
        sourceRefs: [
          ...new Set([
            ...timeBasis
              .sourceRefs,
            ...unique.flatMap(
              (item) =>
                item.sourceRefs,
            ),
          ]),
        ],
      };
  }
}
