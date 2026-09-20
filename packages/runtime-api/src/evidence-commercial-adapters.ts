import {
  extractContractLdTerms,
  extractContractValue,
} from "../../contract-commercial/src";
import {
  emptyCommercialRuntimeState,
  type CommercialMoney,
  type CommercialRuntimeState,
  type CostEvmSnapshot,
  type PaymentCertificateRecord,
  type CommercialVariationRecord,
} from "../../commercial-core/src";
import type {
  CanonicalAuthority,
  CanonicalSourceRef,
  CanonicalValueState,
  TaxBasis,
} from "../../truth-model/src";
import type {
  ProjectRuntimeState,
  StoredEvidenceDocument,
} from "./project-state-types";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index]!;
    if (quoted) {
      if (ch === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function norm(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function col(headers: string[], candidates: string[]): number {
  const normalized = headers.map(norm);
  for (const candidate of candidates) {
    const exact = normalized.indexOf(norm(candidate));
    if (exact >= 0) return exact;
  }
  return normalized.findIndex((header) =>
    candidates.some((candidate) => header.includes(norm(candidate))),
  );
}

function cell(row: string[], index: number): string {
  return index >= 0 ? (row[index] ?? "").trim() : "";
}

function numeric(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const negativeByParentheses =
    /^\(.*\)$/.test(text);
  const cleaned = text
    .replace(/[(),]/g, "")
    .replace(/[^0-9.+-]/g, "")
    .trim();
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return negativeByParentheses
    ? -Math.abs(value)
    : value;
}

function iso(raw: string): string | null {
  const parsed = Date.parse(raw.trim());
  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : null;
}

function taxBasis(raw: string): TaxBasis {
  const value = norm(raw);
  if (value.includes("excl") || value.includes("exclusive")) return "exclusive";
  if (value.includes("incl") || value.includes("inclusive")) return "inclusive";
  if (value.includes("not applicable") || value === "na") return "not_applicable";
  return "unknown";
}

function state(raw: string): CanonicalValueState {
  const value = norm(raw);
  if (value.includes("official")) return "official";
  if (value.includes("approved")) return "approved";
  if (value.includes("certified")) return "certified";
  if (value.includes("assessed")) return "assessed";
  if (value.includes("submitted")) return "submitted";
  if (value.includes("provisional") || value.includes("draft")) return "provisional";
  if (value.includes("conflict")) return "conflicted";
  return "candidate";
}

function authority(raw: string): CanonicalAuthority {
  const value = norm(raw);
  if (value.includes("approved amendment")) return "approved_amendment";
  if (value.includes("contract")) return "contractual";
  if (value.includes("engineer determination")) return "engineer_determination";
  if (value.includes("employer cert")) return "employer_certified";
  if (value.includes("certified")) return "certified";
  if (value.includes("paid")) return "paid";
  if (value.includes("actual")) return "actual_incurred";
  return "source_register";
}

function sourceRef(
  document: StoredEvidenceDocument,
  rowNumber: number,
): CanonicalSourceRef {
  return {
    sourceId: document.documentId,
    locator: "row:" + rowNumber,
    row: rowNumber,
  };
}

function currencyFromUnit(raw: string): string | null {
  const match = /\b([A-Z]{3})\b/.exec(raw.toUpperCase());
  return match?.[1] ?? null;
}

function currencyFromHeaders(headers: string[]): string | null {
  for (const header of headers) {
    const found = currencyFromUnit(header);
    if (found) return found;
  }
  return null;
}

function money(input: {
  amount: number | null;
  currency: string | null;
  taxBasisValue: string | null;
  stateValue?: CanonicalValueState;
  authorityValue?: CanonicalAuthority;
  asOfIso?: string | null;
  sourceRefs: CanonicalSourceRef[];
  diagnostics?: string[];
}): CommercialMoney {
  return {
    amount: input.amount,
    currency: input.currency,
    taxBasis:
      taxBasis(input.taxBasisValue ?? ""),
    state:
      input.amount === null
        ? "missing"
        : input.stateValue ?? "candidate",
    authority:
      input.amount === null
        ? "missing"
        : input.authorityValue ?? "source_register",
    asOfIso:
      input.asOfIso ?? null,
    sourceRefs: [
      ...input.sourceRefs,
    ],
    diagnostics: [
      ...(input.diagnostics ?? []),
      ...(input.amount !== null &&
      input.currency === null
        ? [
            "MONEY_CURRENCY_NOT_ESTABLISHED",
          ]
        : []),
    ],
  };
}

function normalizedMetric(raw: string): string {
  return norm(raw)
    .replace(/\bvalue\b/g, "")
    .replace(/\bamount\b/g, "")
    .trim();
}

function costMetricKey(metric: string):
  | "originalContractValue"
  | "approvedVariations"
  | "currentContractValue"
  | "bac"
  | "pv"
  | "ev"
  | "ac"
  | "spi"
  | "cpi"
  | "etc"
  | "eac"
  | "vac"
  | "sv"
  | "cv"
  | null {
  const m = normalizedMetric(metric);
  if (m === "original contract" || m === "original contract price") return "originalContractValue";
  if (m.includes("approved variation")) return "approvedVariations";
  if (m === "current contract" || m === "current contract sum") return "currentContractValue";
  if (m === "bac" || m.includes("budget at completion")) return "bac";
  if (m === "pv" || m.includes("planned value")) return "pv";
  if (m === "ev" || m.includes("earned value")) return "ev";
  if (m === "ac" || m.includes("actual cost")) return "ac";
  if (m === "spi" || m.includes("schedule performance index")) return "spi";
  if (m === "cpi" || m.includes("cost performance index")) return "cpi";
  if (m === "etc" || m.includes("estimate to complete")) return "etc";
  if (m === "eac" || m.includes("estimate at completion")) return "eac";
  if (m === "vac" || m.includes("variance at completion")) return "vac";
  if (m === "sv" || m.includes("schedule variance")) return "sv";
  if (m === "cv" || m.includes("cost variance")) return "cv";
  return null;
}

function deriveCostEvm(
  document: StoredEvidenceDocument,
  rows: string[][],
): Partial<CommercialRuntimeState> | null {
  const headers = rows[0] ?? [];
  const metricIndex = col(headers, ["metric"]);
  const valueIndex = col(headers, ["value"]);
  const unitIndex = col(headers, ["unit"]);
  const statusIndex = col(headers, ["status"]);
  const asOfIndex = col(headers, ["as of", "data date"]);
  const vatIndex = col(headers, ["vat basis"]);
  if (metricIndex < 0 || valueIndex < 0) return null;

  const snapshot: CostEvmSnapshot = {
    snapshotId: "cost-evm:" + document.documentId,
    asOfIso: null,
    vatBasis: null,
    currency: null,
    originalContractValue: null,
    approvedVariations: null,
    currentContractValue: null,
    bac: null,
    pv: null,
    ev: null,
    ac: null,
    spi: null,
    cpi: null,
    etc: null,
    eac: null,
    vac: null,
    sv: null,
    cv: null,
    sourceReportedMetrics: {},
    state: "candidate",
    authority: "source_register",
    sourceRefs: [],
    diagnostics: [],
  };

  const states: CanonicalValueState[] = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const metric = cell(row, metricIndex);
    if (!metric) continue;
    const raw = cell(row, valueIndex);
    const parsed = numeric(raw);
    const unit = cell(row, unitIndex);
    const key = costMetricKey(metric);
    const rowState = state(cell(row, statusIndex));
    const rowAsOf = iso(cell(row, asOfIndex));
    const vat = cell(row, vatIndex);
    const ref = sourceRef(document, rowIndex + 1);
    states.push(rowState);
    snapshot.sourceRefs.push(ref);
    snapshot.sourceReportedMetrics[metric] =
      parsed ?? raw || null;
    if (rowAsOf) snapshot.asOfIso = rowAsOf;
    if (vat) snapshot.vatBasis = vat;
    const currency = currencyFromUnit(unit);
    if (currency) snapshot.currency = currency;
    if (key && parsed !== null) {
      snapshot[key] = parsed;
    }
  }

  snapshot.state =
    states.includes("official")
      ? "official"
      : states.includes("approved")
        ? "approved"
        : "candidate";

  if (
    snapshot.pv !== null &&
    snapshot.ev !== null &&
    snapshot.spi !== null
  ) {
    const calculated =
      snapshot.pv === 0
        ? null
        : snapshot.ev /
          snapshot.pv;
    if (
      calculated !== null &&
      Math.abs(
        calculated -
        snapshot.spi,
      ) > 0.0001
    ) {
      snapshot.diagnostics.push(
        "SOURCE_REPORTED_SPI_DOES_NOT_RECONCILE_WITH_EV_OVER_PV",
      );
    }
  }
  if (
    snapshot.ev !== null &&
    snapshot.ac !== null &&
    snapshot.cpi !== null
  ) {
    const calculated =
      snapshot.ac === 0
        ? null
        : snapshot.ev /
          snapshot.ac;
    if (
      calculated !== null &&
      Math.abs(
        calculated -
        snapshot.cpi,
      ) > 0.0001
    ) {
      snapshot.diagnostics.push(
        "SOURCE_REPORTED_CPI_DOES_NOT_RECONCILE_WITH_EV_OVER_AC",
      );
    }
  }

  return {
    costEvmSnapshots: [
      snapshot,
    ],
  };
}

function paymentCurrency(
  state: ProjectRuntimeState,
  headers: string[],
): string | null {
  return (
    currencyFromHeaders(headers) ??
    state.commercial
      .contractTerms
      .currentContractValue
      ?.currency ??
    state.commercial
      .costEvmSnapshots
      .at(-1)
      ?.currency ??
    state.controls
      .contractValue
      ?.currency ??
    null
  );
}

function derivePayments(
  state: ProjectRuntimeState,
  document: StoredEvidenceDocument,
  rows: string[][],
): Partial<CommercialRuntimeState> | null {
  const headers = rows[0] ?? [];
  const certificateIndex = col(headers, ["certificate no", "certificate number"]);
  const periodEndIndex = col(headers, ["period end"]);
  const grossIndex = col(headers, ["gross work"]);
  const variationIndex = col(headers, ["variations"]);
  const retentionIndex = col(headers, ["retention"]);
  const advanceIndex = col(headers, ["advance recovery"]);
  const netIndex = col(headers, ["net certified"]);
  const vatIndex = col(headers, ["vat basis"]);
  const statusIndex = col(headers, ["status"]);
  if (certificateIndex < 0 || netIndex < 0) return null;

  const currency = paymentCurrency(state, headers);
  const certificates: PaymentCertificateRecord[] = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const no = cell(row, certificateIndex);
    if (!no) continue;
    const ref = sourceRef(document, rowIndex + 1);
    const vat = cell(row, vatIndex);
    const status = cell(row, statusIndex);
    const recordState =
      state(status);
    const commercialAuthority: CanonicalAuthority =
      recordState === "certified" ||
      norm(status).includes("certif")
        ? "certified"
        : "source_register";
    const m = (index: number) =>
      index < 0
        ? null
        : money({
            amount:
              numeric(
                cell(row, index),
              ),
            currency,
            taxBasisValue: vat,
            stateValue:
              recordState,
            authorityValue:
              commercialAuthority,
            asOfIso:
              iso(
                cell(
                  row,
                  periodEndIndex,
                ),
              ),
            sourceRefs: [
              ref,
            ],
          });

    certificates.push({
      certificateId:
        no,
      certificateNo:
        no,
      periodEndIso:
        iso(
          cell(
            row,
            periodEndIndex,
          ),
        ),
      applicationId: null,
      assessmentId: null,
      grossWork:
        m(grossIndex),
      variations:
        m(variationIndex),
      retentionDeduction:
        m(retentionIndex),
      advanceRecovery:
        m(advanceIndex),
      otherDeductions: null,
      taxAmount: null,
      netCertified:
        m(netIndex),
      submittedAtIso: null,
      assessedAtIso: null,
      certifiedAtIso: null,
      certificationDueIso:
        null,
      paymentDueIso: null,
      status:
        status || null,
      vatBasis:
        vat || null,
      sourceRefs: [
        ref,
      ],
      diagnostics: [
        "PAYMENT_APPLICATION_STAGE_NOT_ESTABLISHED_BY_CERTIFICATE_REGISTER",
        "ENGINEER_ASSESSMENT_STAGE_NOT_ESTABLISHED_BY_CERTIFICATE_REGISTER",
        "PAYMENT_RECEIPTS_NOT_ESTABLISHED_BY_CERTIFICATE_REGISTER",
        ...(currency === null
          ? [
              "PAYMENT_CURRENCY_NOT_ESTABLISHED",
            ]
          : []),
      ],
    });
  }
  return {
    paymentCertificates:
      certificates,
  };
}

function deriveVariations(
  state: ProjectRuntimeState,
  document: StoredEvidenceDocument,
  rows: string[][],
): Partial<CommercialRuntimeState> | null {
  const headers = rows[0] ?? [];
  const idIndex = col(headers, ["variation id", "vo id"]);
  const descriptionIndex = col(headers, ["description"]);
  const approvalIndex = col(headers, ["approval date"]);
  const amountIndex = headers.findIndex((header) =>
    norm(header).includes("approved amount"),
  );
  const vatIndex = col(headers, ["vat basis"]);
  const statusIndex = col(headers, ["status"]);
  const authorityIndex = col(headers, ["authority"]);
  if (idIndex < 0 || amountIndex < 0) return null;

  const currency =
    currencyFromUnit(
      headers[amountIndex] ?? "",
    ) ??
    paymentCurrency(
      state,
      headers,
    );
  const variations:
    CommercialVariationRecord[] =
    [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const id = cell(row, idIndex);
    if (!id) continue;
    const ref = sourceRef(document, rowIndex + 1);
    const status = cell(row, statusIndex);
    const auth = cell(row, authorityIndex);
    const amount = numeric(cell(row, amountIndex));
    const approved =
      norm(status).includes("approved") ||
      norm(auth).includes("approved");
    const amountValue =
      money({
        amount,
        currency,
        taxBasisValue:
          cell(
            row,
            vatIndex,
          ),
        stateValue:
          approved
            ? "approved"
            : state(status),
        authorityValue:
          approved
            ? "approved_amendment"
            : authority(auth),
        asOfIso:
          iso(
            cell(
              row,
              approvalIndex,
            ),
          ),
        sourceRefs: [
          ref,
        ],
      });
    variations.push({
      variationId: id,
      description:
        cell(
          row,
          descriptionIndex,
        ) || null,
      instructionId: null,
      notificationId: null,
      quotationId: null,
      approvalDateIso:
        iso(
          cell(
            row,
            approvalIndex,
          ),
        ),
      claimedValue: null,
      assessedValue: null,
      agreedValue: null,
      certifiedValue: null,
      approvedContractSumImpact:
        approved
          ? amountValue
          : null,
      timeImpactDays: null,
      status:
        status || null,
      authority:
        auth || null,
      amendmentId: null,
      sourceRefs: [
        ref,
      ],
      diagnostics: [
        "VARIATION_LIFECYCLE_PRE_APPROVAL_STAGES_NOT_ESTABLISHED_BY_APPROVED_VARIATION_REGISTER",
      ],
    });
  }

  return {
    variations,
  };
}

export function deriveCommercialFromCsv(input: {
  state: ProjectRuntimeState;
  document: StoredEvidenceDocument;
  bytes: Uint8Array;
}): Partial<CommercialRuntimeState> {
  const text = Buffer.from(input.bytes)
    .toString("utf8")
    .replace(/^\uFEFF/, "");
  const rows = parseCsv(text);

  if (
    input.document.documentType ===
    "cost_evm_report"
  ) {
    return (
      deriveCostEvm(
        input.document,
        rows,
      ) ??
      {}
    );
  }

  if (
    input.document.documentType ===
    "payment_certificates"
  ) {
    return (
      derivePayments(
        input.state,
        input.document,
        rows,
      ) ??
      {}
    );
  }

  if (
    input.document.documentType ===
    "variation_register"
  ) {
    return (
      deriveVariations(
        input.state,
        input.document,
        rows,
      ) ??
      {}
    );
  }

  return {};
}

function latestBy<T>(
  rows: T[],
  key: (row: T) => string,
): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    map.set(key(row), row);
  }
  return [
    ...map.values(),
  ];
}

function stringSourceRef(
  value: string,
): CanonicalSourceRef {
  const parts =
    value.split(":");
  return {
    sourceId:
      parts.length > 1
        ? parts.slice(0, 2)
            .join(":")
        : value,
    locator:
      parts.length > 2
        ? parts.slice(2)
            .join(":")
        : null,
  };
}

function contractCandidateMoney(
  state: ProjectRuntimeState,
): CommercialMoney | null {
  if (state.controls.contractValue) {
    return money({
      amount:
        state.controls
          .contractValue
          .amount,
      currency:
        state.controls
          .contractValue
          .currency,
      taxBasisValue:
        "unknown",
      stateValue:
        "official",
      authorityValue:
        "management_approved",
      sourceRefs:
        state.controls
          .contractValue
          .sourceRefs
          .map(
            stringSourceRef,
          ),
    });
  }
  if (!state.contract) return null;
  const extracted =
    extractContractValue(
      state.contract,
    );
  if (
    extracted.state !==
      "candidate" ||
    !extracted.value
  ) {
    return null;
  }
  return money({
    amount:
      extracted.value
        .amount,
    currency:
      extracted.value
        .currency,
    taxBasisValue:
      "unknown",
    stateValue:
      "candidate",
    authorityValue:
      "candidate",
    sourceRefs:
      extracted.value
        .sourceRefs
        .map(
          stringSourceRef,
        ),
    diagnostics: [
      "CONTRACT_VALUE_EXTRACTED_CANDIDATE_REQUIRES_GOVERNANCE",
    ],
  });
}

function applyContractTerms(
  state: ProjectRuntimeState,
  commercial:
    CommercialRuntimeState,
): void {
  const latestCost =
    commercial
      .costEvmSnapshots
      .at(-1) ??
    null;
  const contractCandidate =
    contractCandidateMoney(
      state,
    );

  const sourceMoney = (
    amount: number | null,
  ): CommercialMoney | null =>
    amount === null
      ? null
      : money({
          amount,
          currency:
            latestCost
              ?.currency ??
            contractCandidate
              ?.currency ??
            null,
          taxBasisValue:
            latestCost
              ?.vatBasis ??
            "unknown",
          stateValue:
            latestCost
              ?.state ??
            "candidate",
          authorityValue:
            latestCost
              ?.authority ??
            "source_register",
          asOfIso:
            latestCost
              ?.asOfIso ??
            null,
          sourceRefs:
            latestCost
              ?.sourceRefs ??
            [],
        });

  const original =
    sourceMoney(
      latestCost
        ?.originalContractValue ??
      null,
    ) ??
    contractCandidate;
  const current =
    sourceMoney(
      latestCost
        ?.currentContractValue ??
      null,
    ) ??
    contractCandidate;

  const time =
    state.controls
      .contractTimeBasis;
  const notices =
    state.controls
      .contractNoticeRequirements;

  const claimNotice =
    notices.find(
      (item) =>
        item.noticeKind ===
        "claim_notice",
    );
  const detailed =
    notices.find(
      (item) =>
        item.noticeKind ===
        "detailed_claim",
    );

  const amendments =
    state.contractDocuments
      .filter(
        (document) =>
          document.role ===
          "amendment",
      )
      .map(
        (document, index) => ({
          amendmentId:
            document.documentId,
          amendmentNumber:
            document.sourceFilename ??
            null,
          effectiveDateIso:
            time
              ?.controllingAmendmentId ===
              document.documentId
              ? time
                  .controllingAmendmentEffectiveAtIso ??
                null
              : null,
          description:
            document.sourceFilename ??
            null,
          contractValueChange:
            null,
          timeExtensionDays:
            time
              ?.controllingAmendmentId ===
              document.documentId
              ? time
                  .incorporatedAmendmentEotDays ??
                null
              : null,
          revisedContractualCompletionIso:
            time
              ?.controllingAmendmentId ===
              document.documentId
              ? time
                  .contractualCompletionIso
              : null,
          precedence:
            index + 1,
          state:
            "approved" as const,
          sourceRefs: [{
            sourceId:
              document.documentId,
            locator:
              null,
          }],
          diagnostics: [],
        }),
      );

  commercial.contractTerms = {
    ...commercial
      .contractTerms,
    originalContractValue:
      original,
    currentContractValue:
      current,
    originalCompletionIso:
      time
        ?.originalContractualCompletionIso ??
      commercial
        .contractTerms
        .originalCompletionIso,
    revisedCompletionIso:
      time
        ?.contractualCompletionIso ??
      commercial
        .contractTerms
        .revisedCompletionIso,
    noticePeriodDays:
      claimNotice
        ?.noticePeriodDays ??
      commercial
        .contractTerms
        .noticePeriodDays,
    detailedClaimPeriodDays:
      detailed
        ?.noticePeriodDays ??
      commercial
        .contractTerms
        .detailedClaimPeriodDays,
    amendments,
    sourceRefs: [
      ...new Map(
        [
          ...(original
            ?.sourceRefs ??
            []),
          ...(current
            ?.sourceRefs ??
            []),
          ...(time
            ?.sourceRefs
            .map(
              stringSourceRef,
            ) ??
            []),
          ...notices.flatMap(
            (item) =>
              item.evidenceRefs.map(
                (ref) => ({
                  sourceId:
                    ref.sourceId,
                  locator:
                    ref.locator,
                }),
              ),
          ),
        ].map(
          (ref) => [
            ref.sourceId +
            "|" +
            (
              ref.locator ??
              ""
            ),
            ref,
          ],
        ),
      ).values(),
    ],
    diagnostics: [
      ...commercial
        .contractTerms
        .diagnostics,
    ],
  };

  if (state.contract) {
    const ld =
      extractContractLdTerms(
        state.contract,
      );
    if (
      ld.rateState ===
        "candidate" &&
      ld.rate
    ) {
      if (
        ld.rate.amount !==
          null &&
        ld.rate.currency
      ) {
        commercial
          .contractTerms
          .ldRatePerDay =
          money({
            amount:
              ld.rate.amount,
            currency:
              ld.rate.currency,
            taxBasisValue:
              "not applicable",
            stateValue:
              "candidate",
            authorityValue:
              "candidate",
            sourceRefs:
              ld.rate
                .sourceRefs
                .map(
                  stringSourceRef,
                ),
            diagnostics: [
              "LD_RATE_REQUIRES_GOVERNED_PROMOTION",
            ],
          });
      }
    }
    if (
      ld.capState ===
        "candidate" &&
      ld.cap?.percent !==
        null
    ) {
      commercial
        .contractTerms
        .ldCapPercent =
        ld.cap.percent;
    }
  }
}

export function rebuildCommercialState(
  state: ProjectRuntimeState,
): void {
  const rebuilt =
    emptyCommercialRuntimeState();

  rebuilt.contractTerms = {
    ...state.commercial
      .contractTerms,
    amendments: [
      ...state.commercial
        .contractTerms
        .amendments,
    ],
    sourceRefs: [
      ...state.commercial
        .contractTerms
        .sourceRefs,
    ],
    diagnostics: [
      ...state.commercial
        .contractTerms
        .diagnostics,
    ],
  };

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

  for (const document of activeDocuments) {
    const fragment =
      state
        .derivedCommercialByDocument[
          document.documentId
        ];
    if (!fragment) continue;
    rebuilt.costEvmSnapshots.push(
      ...(fragment
        .costEvmSnapshots ??
        []),
    );
    rebuilt.paymentCertificates.push(
      ...(fragment
        .paymentCertificates ??
        []),
    );
    rebuilt.variations.push(
      ...(fragment
        .variations ??
        []),
    );
    rebuilt.costCodes.push(
      ...(fragment.costCodes ?? []),
    );
    rebuilt.commitments.push(
      ...(fragment.commitments ?? []),
    );
    rebuilt.accruals.push(
      ...(fragment.accruals ?? []),
    );
    rebuilt.paymentApplications.push(
      ...(fragment.paymentApplications ?? []),
    );
    rebuilt.paymentAssessments.push(
      ...(fragment.paymentAssessments ?? []),
    );
    rebuilt.paymentReceipts.push(
      ...(fragment.paymentReceipts ?? []),
    );
    rebuilt.cashFlow.push(
      ...(fragment.cashFlow ?? []),
    );
    rebuilt.sourceDocumentIds.push(
      document.documentId,
    );
  }

  rebuilt.costEvmSnapshots =
    latestBy(
      rebuilt.costEvmSnapshots,
      (row) => row.snapshotId,
    );
  rebuilt.paymentCertificates =
    latestBy(
      rebuilt.paymentCertificates,
      (row) => row.certificateId,
    );
  rebuilt.variations =
    latestBy(
      rebuilt.variations,
      (row) => row.variationId,
    );
  rebuilt.sourceDocumentIds = [
    ...new Set(
      rebuilt.sourceDocumentIds,
    ),
  ];

  applyContractTerms(
    state,
    rebuilt,
  );

  state.commercial =
    rebuilt;
}
