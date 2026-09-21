import {
  buildCommercialFoundation,
  type CommercialFoundationProjection,
} from "../../commercial-foundation/src";
import {
  extractContractLdTerms,
  extractContractValue,
} from "../../contract-commercial/src";
import type { SourceReceipt } from "../../truth-kernel/src";
import {
  canonicalTimeClaims,
  projectDataDate,
} from "./canonical-time-claims";
import {
  commercialCanonical,
  type CommercialMoney,
} from "./commercial-canonical";
import type {
  ModuleRuntimeResult,
  ProjectRuntimeState,
} from "./project-state-types";

export const commercialFoundationCapabilities = [
  {
    key: "commercial-terms",
    title: "Commercial Terms",
    tier: 1,
  },
  {
    key: "cost-register",
    title: "Cost Register",
    tier: 1,
  },
  {
    key: "payment-register",
    title: "Payment Register",
    tier: 1,
  },
  {
    key: "cbs-breakdown",
    title: "CBS Breakdown",
    tier: 1,
  },
] as const;

export type CommercialFoundationCapabilityKey =
  (typeof commercialFoundationCapabilities)[number]["key"];

function receiptRef(
  receipt: SourceReceipt,
): string {
  return (
    "evidence-document:" +
    receipt.documentId +
    ":" +
    receipt.locator
  );
}

function moneyRefs(
  money: CommercialMoney,
): string[] {
  return money.receipts.map(
    receiptRef,
  );
}

const cache = new WeakMap<
  ProjectRuntimeState,
  {
    version: number;
    value: CommercialFoundationProjection;
  }
>();

export function commercialFoundationForState(
  state: ProjectRuntimeState,
  generatedAt = new Date().toISOString(),
): CommercialFoundationProjection {
  const prior = cache.get(state);
  if (
    prior?.version ===
    state.version
  ) {
    return prior.value;
  }

  const ledger =
    commercialCanonical(state);
  const timeClaims =
    canonicalTimeClaims(state);
  const contractValueExtraction =
    state.contract
      ? extractContractValue(
          state.contract,
        )
      : null;
  const ldTerms =
    state.contract
      ? extractContractLdTerms(
          state.contract,
        )
      : null;
  const evidenceById =
    new Map(
      state.evidenceDocuments.map(
        (document) => [
          document.documentId,
          document,
        ],
      ),
    );

  const contractSections =
    state.contractDocuments
      .flatMap((document) => {
        const evidence =
          evidenceById.get(
            document.documentId,
          );
        const basisState =
          evidence?.basisState ??
          "candidate";
        if (
          ![
            "active",
            "additive",
            "candidate",
          ].includes(
            basisState,
          )
        ) {
          return [];
        }
        return document.result.sections.map(
          (section) => ({
            documentId:
              document.documentId,
            documentRole:
              document.role,
            basisState,
            revision:
              evidence
                ?.linkedArtifactId ??
              document
                .sourceHashSha256,
            sourceHash:
              document
                .sourceHashSha256,
            sectionKey:
              section.sectionKey,
            identifier:
              section.identifier,
            parentIdentifier:
              section
                .parentIdentifier,
            heading:
              section.heading,
            text: section.text,
            startPage:
              section.startPage,
            sourceMode:
              section.sourceMode,
            sectionStatus:
              section.status,
          }),
        );
      });

  const amendments =
    timeClaims.amendments.map(
      (amendment) => {
        const document =
          state.contractDocuments.find(
            (candidate) =>
              candidate.documentId ===
              amendment.documentId,
          );
        return {
          documentId:
            amendment.documentId,
          effectiveDate:
            amendment.effectiveDate,
          completionIso:
            amendment.completionIso,
          incorporatedEotDays:
            amendment
              .incorporatedEotDays,
          state: amendment.state,
          sourceRefs: [
            receiptRef(
              amendment.receipt,
            ),
          ],
          actions:
            document?.result
              .amendmentActions
              .map((action) => ({
                targetIdentifier:
                  action.targetIdentifier,
                action:
                  action.action,
                status:
                  action.status,
              })) ?? [],
        };
      },
    );

  const foundation =
    buildCommercialFoundation({
      projectId:
        state.projectId,
      generatedAt,
      dataDateIso:
        projectDataDate(state),
      contractValue:
        state.controls
          .contractValue
          ? {
              amount:
                state.controls
                  .contractValue
                  .amount,
              currency:
                state.controls
                  .contractValue
                  .currency
                  .trim()
                  .toUpperCase(),
              sourceRefs: [
                ...state.controls
                  .contractValue
                  .sourceRefs,
              ],
              authority:
                "approved",
            }
          : null,
      contractValueCandidates:
        contractValueExtraction
          ?.candidates.map(
            (candidate) => ({
              amount:
                candidate.amount,
              currency:
                candidate.currency,
              sourceRefs: [
                ...candidate
                  .sourceRefs,
              ],
              authority:
                "candidate",
            }),
          ) ?? [],
      variations:
        state.controls.variations.map(
          (variation) => ({
            variationId:
              variation.variationId,
            state:
              variation.state,
            amount:
              variation.amount,
            currency:
              variation.currency
                .trim()
                .toUpperCase(),
            sourceRefs: [
              ...variation
                .sourceRefs,
            ],
          }),
        ),
      contractTimeBasis:
        state.controls
          .contractTimeBasis
          ? {
              contractualCompletionIso:
                state.controls
                  .contractTimeBasis
                  .contractualCompletionIso,
              contractualCompletionState:
                state.controls
                  .contractTimeBasis
                  .contractualCompletionState,
              sourceRefs: [
                ...state.controls
                  .contractTimeBasis
                  .sourceRefs,
              ],
            }
          : null,
      ldTerms:
        ldTerms
          ? {
              rateState:
                ldTerms.rateState,
              capState:
                ldTerms.capState,
              rate:
                ldTerms.rate
                  ? {
                      basis:
                        ldTerms
                          .rate
                          .basis,
                      amount:
                        ldTerms
                          .rate
                          .amount,
                      currency:
                        ldTerms
                          .rate
                          .currency,
                      percent:
                        ldTerms
                          .rate
                          .percent,
                      sourceRefs: [
                        ...ldTerms
                          .rate
                          .sourceRefs,
                      ],
                    }
                  : null,
              cap:
                ldTerms.cap
                  ? {
                      basis:
                        ldTerms
                          .cap
                          .basis,
                      amount:
                        ldTerms
                          .cap
                          .amount,
                      currency:
                        ldTerms
                          .cap
                          .currency,
                      percent:
                        ldTerms
                          .cap
                          .percent,
                      sourceRefs: [
                        ...ldTerms
                          .cap
                          .sourceRefs,
                      ],
                    }
                  : null,
              diagnostics: [
                ...ldTerms
                  .diagnostics,
              ],
            }
          : null,
      contractSections,
      amendments,
      costMetrics:
        ledger.costMetrics.map(
          (row) => ({
            metric: row.metric,
            amount: {
              value:
                row.amount.value,
              currency:
                row.amount.currency,
              taxBasis:
                row.amount.taxBasis,
              amountBasis:
                row.amount
                  .amountBasis,
              state:
                row.amount.state,
              asOf:
                row.amount.asOf,
              sourceRefs:
                moneyRefs(
                  row.amount,
                ),
            },
            sourceStatus:
              row.sourceStatus,
            cbsId: row.cbsId,
            cbsDescription:
              row.cbsDescription,
            parentCbsId:
              row.parentCbsId,
            wbsId: row.wbsId,
            counterparty:
              row.counterparty,
            boqItemId:
              row.boqItemId,
            paymentId:
              row.paymentId,
          }),
        ),
      payments:
        ledger.payments.map(
          (row) => ({
            paymentId:
              row.paymentId,
            paymentType:
              row.paymentType,
            periodEnd:
              row.periodEnd,
            sourceStatus:
              row.sourceStatus,
            applicationDate:
              row.applicationDate,
            assessmentDate:
              row.assessmentDate,
            certificationDate:
              row.certificationDate,
            certificationDueDate:
              row.certificationDueDate,
            paymentDueDate:
              row.paymentDueDate,
            paymentDate:
              row.paymentDate,
            paymentTimestamp:
              row.paymentTimestamp,
            retentionReleaseDate:
              row
                .retentionReleaseDate,
            finalReceiptDate:
              row.finalReceiptDate,
            paymentReference:
              row.paymentReference,
            amounts:
              Object.fromEntries(
                Object.entries(
                  row.amounts,
                ).map(
                  ([
                    key,
                    money,
                  ]) => [
                    key,
                    {
                      value:
                        money.value,
                      currency:
                        money.currency,
                      taxBasis:
                        money.taxBasis,
                      amountBasis:
                        money
                          .amountBasis,
                      state:
                        money.state,
                      asOf:
                        money.asOf,
                      sourceRefs:
                        moneyRefs(
                          money,
                        ),
                    },
                  ],
                ),
              ),
            calculatedOutstandingAmount:
              {
                value:
                  row
                    .calculatedOutstandingAmount
                    .value,
                currency:
                  row
                    .calculatedOutstandingAmount
                    .currency,
                taxBasis:
                  row
                    .calculatedOutstandingAmount
                    .taxBasis,
                amountBasis:
                  row
                    .calculatedOutstandingAmount
                    .amountBasis,
                state:
                  row
                    .calculatedOutstandingAmount
                    .state,
                asOf:
                  row
                    .calculatedOutstandingAmount
                    .asOf,
                sourceRefs:
                  moneyRefs(
                    row
                      .calculatedOutstandingAmount,
                  ),
              },
            reconciliation:
              row.reconciliation,
            diagnostics: [
              ...row.diagnostics,
            ],
            sourceRefs: [
              receiptRef(
                row.receipt,
              ),
            ],
          }),
        ),
    });

  cache.set(state, {
    version: state.version,
    value: foundation,
  });
  return foundation;
}

export function commercialFoundationCapabilityForState(
  state: ProjectRuntimeState,
  key: string,
): ModuleRuntimeResult | null {
  const foundation =
    commercialFoundationForState(
      state,
    );

  let data: unknown;
  let capabilityState:
    | "established"
    | "candidate"
    | "partial"
    | "missing"
    | "conflicted";

  if (key === "commercial-terms") {
    data =
      foundation.commercialTerms;
    capabilityState =
      foundation
        .commercialTerms.state;
  } else if (
    key === "cost-register"
  ) {
    data =
      foundation.costRegister;
    capabilityState =
      foundation.costRegister
        .state;
  } else if (
    key === "payment-register"
  ) {
    data =
      foundation.paymentRegister;
    capabilityState =
      foundation.paymentRegister
        .state;
  } else if (
    key === "cbs-breakdown"
  ) {
    data =
      foundation.cbsBreakdown;
    capabilityState =
      foundation.cbsBreakdown
        .state;
  } else {
    return null;
  }

  return {
    key,
    status:
      capabilityState ===
      "established"
        ? "ready"
        : "partial",
    reason:
      capabilityState ===
      "established"
        ? null
        : capabilityState ===
            "conflicted"
          ? "Conflicting source evidence is retained. Review is required before a single governed position is promoted."
          : capabilityState ===
              "missing"
            ? "The source evidence required for this commercial capability is not yet established."
            : "The commercial capability is partially established and retains its evidence gaps explicitly.",
    dependencies: [
      "governed project evidence",
      "commercial canonical ledger",
      "programme Data Date",
    ],
    data,
  };
}
