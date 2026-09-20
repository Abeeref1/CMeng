import type {
  CanonicalClaimRecord,
  CanonicalDelayEvent,
  CanonicalNoticeRecord,
  DelayClaimsModel,
} from "../../delay-analysis-core/src";
import type {
  ContractTimeBasis,
} from "../../eot-assessment/src";
import type {
  BondRecord,
  ClaimCommercialRecord,
  InvoiceRecord,
  NcrRecord,
  RetentionRecord,
  RfiRecord,
  VariationRecord,
} from "../../project-director/src";
import type {
  DerivedControlEvidence,
  ProjectRuntimeState,
  RiskControlRecord,
  StoredEvidenceDocument,
} from "./project-state-types";

function delayResponsibility(
  raw: string,
): CanonicalDelayEvent["responsibility"] {
  const value = norm(raw);
  if (
    value.includes("employer") ||
    value.includes("client") ||
    value.includes("owner")
  ) return "employer";
  if (
    value.includes("contractor")
  ) return "contractor";
  if (
    value.includes("concurrent")
  ) return "concurrent";
  if (
    value.includes("neutral") ||
    value.includes("authority") ||
    value.includes("weather")
  ) return "neutral";
  return "unknown";
}

function delayCategory(
  raw: string,
): CanonicalDelayEvent["category"] {
  const value = norm(raw);
  if (value.includes("variation")) return "variation";
  if (value.includes("change")) return "change";
  if (value.includes("access")) return "late_access";
  if (value.includes("information")) return "late_information";
  if (value.includes("suspension")) return "suspension";
  if (value.includes("authority")) return "authority";
  if (value.includes("weather")) return "weather";
  if (value.includes("procurement")) return "procurement";
  if (value.includes("design")) return "design";
  if (value.includes("payment")) return "payment";
  if (value.includes("performance")) return "contractor_performance";
  return "other";
}

function splitRefs(
  raw: string,
): string[] {
  return raw
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

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

function bondKind(
  raw: string,
): BondRecord["kind"] {
  const value = norm(raw);
  if (
    value.includes("performance")
  ) return "performance";
  if (
    value.includes("advance")
  ) return "advance_payment";
  if (
    value.includes("retention")
  ) return "retention";
  return "other";
}

function bondStatus(
  raw: string,
): BondRecord["status"] {
  const value = norm(raw);
  if (
    value.includes("released") ||
    value.includes("discharged") ||
    value.includes("cancelled") ||
    value.includes("canceled")
  ) return "released";
  if (
    value.includes("expired")
  ) return "expired";
  return "active";
}

function retentionState(
  raw: string,
): RetentionRecord["state"] {
  const value = norm(raw);
  return (
    value.includes("released") ||
    value.includes("paid")
  )
    ? "released"
    : "held";
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
          "variation no",
          "variation number",
          "vo id",
          "vo no",
          "change id",
          "change order",
        ],
      );
    const approvedAmountIndex =
      indexOf(
        headers,
        [
          "approved amount",
          "agreed amount",
          "determined amount",
        ],
      );
    const submittedAmountIndex =
      indexOf(
        headers,
        [
          "submitted amount",
          "claimed amount",
          "proposed amount",
          "estimated amount",
          "current amount",
          "variation amount",
          "vo amount",
        ],
      );
    const statusIndex =
      indexOf(
        headers,
        ["status", "variation status"],
      );
    if (
      idIndex < 0 ||
      (
        approvedAmountIndex < 0 &&
        submittedAmountIndex < 0
      ) ||
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
      if (!variationId) continue;

      const state =
        variationState(
          value(
            row,
            statusIndex,
          ),
        );
      const approvedAmount =
        numeric(
          value(
            row,
            approvedAmountIndex,
          ),
        );
      const submittedAmount =
        numeric(
          value(
            row,
            submittedAmountIndex,
          ),
        );
      const amount =
        state === "approved"
          ? approvedAmount ??
            submittedAmount
          : submittedAmount ??
            approvedAmount;
      if (amount === null) {
        continue;
      }

      variations.push({
        variationId,
        amount,
        currency:
          sourceCurrency,
        state,
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
          "certificate id",
          "ipc no",
          "ipc number",
          "payment certificate",
        ],
      );
    const certifiedIndex =
      indexOf(
        headers,
        [
          "net certified",
          "certified amount",
          "net amount certified",
          "amount certified",
        ],
      );
    const paidIndex =
      indexOf(
        headers,
        [
          "paid amount",
          "amount paid",
          "payment amount",
          "actual paid",
        ],
      );
    const certificateDateIndex =
      indexOf(
        headers,
        [
          "certificate date",
          "certification date",
          "ipc date",
        ],
      );
    const paymentDateIndex =
      indexOf(
        headers,
        [
          "payment date",
          "paid date",
          "date paid",
        ],
      );
    const retentionIndex =
      indexOf(
        headers,
        [
          "retention amount",
          "retention held",
          "retention",
        ],
      );
    const advanceRecoveryIndex =
      indexOf(
        headers,
        [
          "advance recovery",
          "advance payment recovery",
          "advance recovered",
        ],
      );
    const advanceBalanceIndex =
      indexOf(
        headers,
        [
          "advance balance",
          "advance payment balance",
          "unamortized advance",
          "unamortised advance",
          "outstanding advance",
        ],
      );

    if (
      idIndex < 0 ||
      (
        certifiedIndex < 0 &&
        paidIndex < 0 &&
        retentionIndex < 0 &&
        advanceBalanceIndex < 0
      ) ||
      !sourceCurrency
    ) {
      return {};
    }

    const invoices:
      InvoiceRecord[] = [];
    const retentions:
      RetentionRecord[] = [];
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
      const sourceRef =
        evidenceRef(
          input.document,
          rowIndex + 1,
        );
      const retentionAmount =
        numeric(
          value(
            row,
            retentionIndex,
          ),
        );
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
        paidAmount:
          numeric(
            value(
              row,
              paidIndex,
            ),
          ),
        certificateDateIso:
          iso(
            value(
              row,
              certificateDateIndex,
            ),
          ),
        paymentDateIso:
          iso(
            value(
              row,
              paymentDateIndex,
            ),
          ),
        retentionAmount,
        advanceRecoveryAmount:
          numeric(
            value(
              row,
              advanceRecoveryIndex,
            ),
          ),
        advanceBalance:
          numeric(
            value(
              row,
              advanceBalanceIndex,
            ),
          ),
        sourceRefs: [
          sourceRef,
        ],
      });

      if (
        retentionAmount !== null
      ) {
        retentions.push({
          retentionId:
            invoiceId +
            ":retention",
          amount:
            retentionAmount,
          currency:
            sourceCurrency,
          state: "held",
          sourceRefs: [
            sourceRef,
          ],
        });
      }
    }
    return {
      invoices,
      retentions,
    };
  }

  if (
    input.document
      .documentType ===
    "retention_register"
  ) {
    const idIndex =
      indexOf(
        headers,
        [
          "retention id",
          "retention no",
          "retention number",
          "certificate no",
          "certificate number",
        ],
      );
    const amountIndex =
      indexOf(
        headers,
        [
          "retention amount",
          "retention held",
          "held amount",
          "amount",
        ],
      );
    const statusIndex =
      indexOf(
        headers,
        [
          "status",
          "retention status",
        ],
      );

    if (
      idIndex < 0 ||
      amountIndex < 0 ||
      !sourceCurrency
    ) {
      return {};
    }

    const retentions:
      RetentionRecord[] = [];
    for (
      let rowIndex = 1;
      rowIndex <
      rows.length;
      rowIndex += 1
    ) {
      const row =
        rows[rowIndex] ??
        [];
      const retentionId =
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
        !retentionId ||
        amount === null
      ) continue;

      retentions.push({
        retentionId,
        amount,
        currency:
          sourceCurrency,
        state:
          retentionState(
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
    return { retentions };
  }

  if (
    input.document
      .documentType ===
      "bond_register" ||
    input.document
      .documentType ===
      "security_register"
  ) {
    const idIndex =
      indexOf(
        headers,
        [
          "bond id",
          "bond no",
          "bond number",
          "guarantee no",
          "guarantee number",
          "security id",
        ],
      );
    const kindIndex =
      indexOf(
        headers,
        [
          "bond type",
          "guarantee type",
          "security type",
          "type",
        ],
      );
    const amountIndex =
      indexOf(
        headers,
        [
          "bond amount",
          "guarantee amount",
          "security amount",
          "amount",
        ],
      );
    const statusIndex =
      indexOf(
        headers,
        ["status", "bond status"],
      );
    const expiryIndex =
      indexOf(
        headers,
        [
          "expiry date",
          "expiration date",
          "valid until",
        ],
      );

    if (
      idIndex < 0 ||
      amountIndex < 0 ||
      !sourceCurrency
    ) {
      return {};
    }

    const bonds:
      BondRecord[] = [];
    for (
      let rowIndex = 1;
      rowIndex <
      rows.length;
      rowIndex += 1
    ) {
      const row =
        rows[rowIndex] ??
        [];
      const bondId =
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
        !bondId ||
        amount === null
      ) continue;
      bonds.push({
        bondId,
        amount,
        currency:
          sourceCurrency,
        kind:
          bondKind(
            value(
              row,
              kindIndex,
            ),
          ),
        status:
          bondStatus(
            value(
              row,
              statusIndex,
            ),
          ),
        expiryIso:
          iso(
            value(
              row,
              expiryIndex,
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
    return { bonds };
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
        ["claim id", "claim no", "claim number"],
      );
    const eventIdIndex =
      indexOf(
        headers,
        [
          "event id",
          "delay event id",
          "event no",
          "event number",
        ],
      );
    const titleIndex =
      indexOf(
        headers,
        ["event", "event title", "title", "description"],
      );
    const eventStartIndex =
      indexOf(
        headers,
        [
          "event start",
          "start date",
          "delay start",
          "from date",
        ],
      );
    const eventEndIndex =
      indexOf(
        headers,
        [
          "event end",
          "end date",
          "delay end",
          "to date",
        ],
      );
    const responsibilityIndex =
      indexOf(
        headers,
        [
          "responsibility",
          "responsible party",
          "delay responsibility",
        ],
      );
    const categoryIndex =
      indexOf(
        headers,
        ["category", "event category", "delay type"],
      );
    const impactDaysIndex =
      indexOf(
        headers,
        [
          "impact days",
          "delay days",
          "event days",
        ],
      );
    const activityIndex =
      indexOf(
        headers,
        [
          "activity id",
          "activity ids",
          "schedule activity",
        ],
      );
    const noticeDateIndex =
      indexOf(
        headers,
        ["notice date", "submitted date"],
      );
    const claimedDaysIndex =
      indexOf(
        headers,
        ["days claimed", "claimed days"],
      );
    const grantedDaysIndex =
      indexOf(
        headers,
        [
          "days granted",
          "granted days",
          "determined days",
          "approved eot days",
        ],
      );
    const claimedAmountIndex =
      indexOf(
        headers,
        [
          "claimed amount",
          "amount claimed",
          "claim amount",
          "submitted amount",
        ],
      );
    const assessedAmountIndex =
      indexOf(
        headers,
        [
          "assessed amount",
          "determined amount",
          "approved amount",
          "amount assessed",
          "amount awarded",
        ],
      );
    const statusIndex =
      indexOf(
        headers,
        ["status", "determination status"],
      );
    const clauseIndex =
      indexOf(
        headers,
        ["clause", "clause reference"],
      );
    const determinationIdIndex =
      indexOf(
        headers,
        [
          "determination id",
          "determination no",
          "engineer determination",
        ],
      );
    const dayBasisIndex =
      indexOf(
        headers,
        [
          "day basis",
          "eot day basis",
          "calendar working",
        ],
      );

    const claims:
      CanonicalClaimRecord[] = [];
    const notices:
      CanonicalNoticeRecord[] = [];
    const events:
      CanonicalDelayEvent[] = [];
    const claimCommercials:
      ClaimCommercialRecord[] = [];
    const determinationDays =
      new Map<string, number>();
    let explicitDayBasis:
      ContractTimeBasis["eotDayBasis"] =
      "unknown";

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
      const explicitEventId =
        value(
          row,
          eventIdIndex,
        );
      const eventStart =
        iso(
          value(
            row,
            eventStartIndex,
          ),
        );
      const eventEnd =
        iso(
          value(
            row,
            eventEndIndex,
          ),
        );
      const eventTitle =
        value(
          row,
          titleIndex,
        );
      const hasEventEvidence =
        Boolean(
          explicitEventId ||
          eventStart ||
          eventEnd ||
          numeric(
            value(
              row,
              impactDaysIndex,
            ),
          ) !== null
        );
      const eventId =
        explicitEventId ||
        (
          hasEventEvidence &&
          claimId
            ? "event:" + claimId
            : ""
        );

      if (
        !claimId &&
        !eventId
      ) continue;

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
      const claimedAmount =
        numeric(
          value(
            row,
            claimedAmountIndex,
          ),
        );
      const assessedAmount =
        numeric(
          value(
            row,
            assessedAmountIndex,
          ),
        );
      const statusRaw =
        value(
          row,
          statusIndex,
        );
      const officialDetermination =
        granted !== null &&
        /determined|approved|granted|engineer/i.test(
          statusRaw +
          " " +
          value(
            row,
            determinationIdIndex,
          ),
        );

      if (eventId) {
        const responsibilityRaw =
          value(
            row,
            responsibilityIndex,
          );
        events.push({
          eventId,
          title:
            eventTitle ||
            claimId ||
            eventId,
          category:
            delayCategory(
              value(
                row,
                categoryIndex,
              ) ||
              eventTitle,
            ),
          startIso:
            eventStart,
          endIso:
            eventEnd,
          responsibility:
            delayResponsibility(
              responsibilityRaw,
            ),
          responsibilityState:
            responsibilityRaw
              ? officialDetermination
                ? "official"
                : "candidate"
              : "missing",
          describedImpactDays:
            numeric(
              value(
                row,
                impactDaysIndex,
              ),
            ) ??
            numeric(
              value(
                row,
                claimedDaysIndex,
              ),
            ),
          describedImpactState:
            numeric(
              value(
                row,
                impactDaysIndex,
              ),
            ) !== null
              ? "candidate"
              : "missing",
          relatedActivityIds:
            splitRefs(
              value(
                row,
                activityIndex,
              ),
            ),
          relatedClauseIdentifiers:
            splitRefs(
              value(
                row,
                clauseIndex,
              ),
            ),
          evidenceRefs: [ref],
          diagnostics: [
            ...(explicitEventId
              ? []
              : [
                  "DELAY_EVENT_ID_DERIVED_FROM_CLAIM_ID",
                ]),
            ...(responsibilityRaw
              ? []
              : [
                  "DELAY_EVENT_RESPONSIBILITY_NOT_ESTABLISHED",
                ]),
          ],
        });
      }

      if (claimId) {
        claims.push({
          claimId,
          title:
            eventTitle || claimId,
          state:
            claimState(
              statusRaw,
            ),
          eventIds:
            eventId
              ? [eventId]
              : [],
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
          claimedAmount,
          assessedDays:
            granted,
          assessedDaysState:
            granted === null
              ? "missing"
              : officialDetermination
                ? "official"
                : "candidate",
          assessedAmount,
          assessedAmountState:
            assessedAmount === null
              ? "missing"
              : /determined|approved|awarded|engineer/i.test(
                  statusRaw +
                  " " +
                  value(
                    row,
                    determinationIdIndex,
                  ),
                )
                ? "official"
                : "candidate",
          clauseIdentifiers:
            splitRefs(
              value(
                row,
                clauseIndex,
              ),
            ),
          evidenceRefs: [ref],
          diagnostics:
            eventId
              ? []
              : [
                  "CLAIM_REGISTER_ROW_HAS_NO_PROVEN_DELAY_EVENT_CAUSATION_LINK",
                ],
        });

        if (
          sourceCurrency &&
          (
            claimedAmount !==
              null ||
            assessedAmount !==
              null
          )
        ) {
          claimCommercials.push({
            claimId,
            currency:
              sourceCurrency,
            claimedAmount,
            assessedAmount,
            sourceRefs: [
              evidenceRef(
                input.document,
                rowIndex + 1,
              ),
            ],
          });
        }

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
            eventId:
              eventId || null,
            claimId,
            actualIssuedAt:
              noticeDate,
            actualReceivedAt:
              null,
            plannedAt: null,
            subject:
              eventTitle || null,
            clauseIdentifiers:
              splitRefs(
                value(
                  row,
                  clauseIndex,
                ),
              ),
            evidenceRefs: [ref],
            diagnostics: [
              "NOTICE_DATE_FROM_CLAIMS_REGISTER",
            ],
          });
        }
      }

      if (
        officialDetermination &&
        granted !== null
      ) {
        const determinationId =
          value(
            row,
            determinationIdIndex,
          ) ||
          claimId ||
          "row:" +
            (rowIndex + 1);
        determinationDays.set(
          determinationId,
          granted,
        );
      }

      const dayBasisRaw =
        norm(
          value(
            row,
            dayBasisIndex,
          ),
        );
      if (
        dayBasisRaw.includes(
          "calendar",
        )
      ) {
        explicitDayBasis =
          "calendar_days";
      } else if (
        dayBasisRaw.includes(
          "working",
        ) &&
        explicitDayBasis ===
          "unknown"
      ) {
        explicitDayBasis =
          "working_days";
      }
    }

    const uniqueEvents =
      latestById(
        events,
        (event) =>
          event.eventId,
      );
    const delayClaims:
      DelayClaimsModel = {
      projectId:
        input.state.projectId,
      evidenceRevisionId:
        "evidence-document:" +
        input.document.documentId,
      events:
        uniqueEvents,
      notices,
      claims,
      noticeRequirements: [],
      diagnostics: [
        ...(uniqueEvents.length > 0
          ? [
              "DELAY_EVENTS_GOVERNED_FROM_CLAIMS_REGISTER_FIELDS",
            ]
          : [
              "CLAIMS_REGISTER_CONTAINS_NO_DELAY_EVENT_FIELDS",
            ]),
      ],
    };

    const officialApprovedEotDays =
      determinationDays.size > 0
        ? Number(
            [
              ...determinationDays.values(),
            ]
              .reduce(
                (sum, days) =>
                  sum + days,
                0,
              )
              .toFixed(6),
          )
        : null;

    const contractTimeBasis:
      ContractTimeBasis | undefined =
      officialApprovedEotDays !==
      null
        ? {
            contractualCompletionIso:
              null,
            contractualCompletionState:
              "missing",
            officialApprovedEotDays,
            officialApprovedEotState:
              "official",
            eotDayBasis:
              explicitDayBasis,
            eotDayBasisState:
              explicitDayBasis ===
                "unknown"
                ? "missing"
                : "official",
            sourceRefs: [
              "evidence-document:" +
                input.document
                  .documentId,
            ],
          }
        : undefined;

    return {
      delayClaims,
      claimCommercials:
        latestById(
          claimCommercials,
          (row) =>
            row.claimId,
        ),
      ...(contractTimeBasis
        ? {
            contractTimeBasis,
          }
        : {}),
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
  const manualRetentions =
    state.controls.retentions
      .filter(
        (row) =>
          !derivedRef(
            row.sourceRefs,
          ),
      );
  const manualBonds =
    state.controls.bonds
      .filter(
        (row) =>
          !derivedRef(
            row.sourceRefs,
          ),
      );
  const manualClaimCommercials =
    state.controls
      .claimCommercials
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
  const retentions = [
    ...manualRetentions,
  ];
  const bonds = [
    ...manualBonds,
  ];
  const claimCommercials = [
    ...manualClaimCommercials,
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
  let derivedContractTime:
    ContractTimeBasis | null =
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
    retentions.push(
      ...(derived.retentions ??
        []),
    );
    bonds.push(
      ...(derived.bonds ??
        []),
    );
    claimCommercials.push(
      ...(derived
        .claimCommercials ??
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
    if (
      derived.contractTimeBasis
    ) {
      derivedContractTime =
        derived.contractTimeBasis;
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
  state.controls.retentions =
    latestById(
      retentions,
      (row) =>
        row.retentionId,
    );
  state.controls.bonds =
    latestById(
      bonds,
      (row) =>
        row.bondId,
    );
  state.controls
    .claimCommercials =
    latestById(
      claimCommercials,
      (row) =>
        row.claimId,
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

  if (derivedContractTime) {
    const currentTime =
      state.controls
        .contractTimeBasis;
    state.controls
      .contractTimeBasis = {
      contractualCompletionIso:
        currentTime
          ?.contractualCompletionIso ??
        derivedContractTime
          .contractualCompletionIso,
      contractualCompletionState:
        currentTime
          ?.contractualCompletionIso
          ? currentTime
              .contractualCompletionState
          : derivedContractTime
              .contractualCompletionState,
      officialApprovedEotDays:
        derivedContractTime
          .officialApprovedEotDays,
      officialApprovedEotState:
        derivedContractTime
          .officialApprovedEotState,
      eotDayBasis:
        derivedContractTime
          .eotDayBasis !==
          "unknown"
          ? derivedContractTime
              .eotDayBasis
          : currentTime
              ?.eotDayBasis ??
            "unknown",
      eotDayBasisState:
        derivedContractTime
          .eotDayBasisState !==
          "missing"
          ? derivedContractTime
              .eotDayBasisState
          : currentTime
              ?.eotDayBasisState ??
            "missing",
      sourceRefs: [
        ...new Set([
          ...(
            currentTime
              ?.sourceRefs ??
            []
          ),
          ...derivedContractTime
            .sourceRefs,
        ]),
      ],
    };
  }
}
