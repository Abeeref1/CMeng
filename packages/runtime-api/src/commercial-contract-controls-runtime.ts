import {
  buildContractControls,
  type ContractControlsProjection,
  type ContractControlMoney,
} from "../../commercial-contract-controls/src";
import {
  extractContractLdTerms,
} from "../../contract-commercial/src";
import {
  buildScheduleAnalyticsProjection,
} from "../../schedule-analytics/src";
import {
  orderScheduleRevisionsChronologically,
} from "../../schedule-revision-core/src";
import type {
  SourceReceipt,
} from "../../truth-kernel/src";
import {
  canonicalTimeClaims,
  projectDataDate,
  projectControlSchedule,
} from "./canonical-time-claims";
import {
  commercialCanonical,
  type CommercialMoney,
} from "./commercial-canonical";
import {
  commercialFoundationForState,
} from "./commercial-foundation-runtime";
import {
  isProgrammeScheduleRevision,
} from "./project-state";
import type {
  ModuleRuntimeResult,
  ProjectRuntimeState,
} from "./project-state-types";

export const commercialContractControlCapabilities = [
  {
    key: "variations",
    title: "Variations",
    tier: 2,
  },
  {
    key: "site-instructions",
    title: "Site Instructions",
    tier: 2,
  },
  {
    key: "contract-obligations",
    title: "Contract Obligations",
    tier: 2,
  },
  {
    key: "liquidated-damages",
    title: "Liquidated Damages",
    tier: 2,
  },
  {
    key: "bonds-insurance",
    title: "Bonds & Insurance",
    tier: 2,
  },
  {
    key: "retention-calendar",
    title: "Retention Calendar",
    tier: 2,
  },
] as const;

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

function moneyInput(
  money: CommercialMoney,
): ContractControlMoney {
  return {
    value: money.value,
    currency: money.currency,
    state: money.state,
    asOf: money.asOf,
    sourceRefs:
      money.receipts.map(
        receiptRef,
      ),
  };
}

function currentProgrammeCompletion(
  state: ProjectRuntimeState,
): {
  dateIso: string | null;
  method: string;
  sourceRefs: string[];
} {
  const current = projectControlSchedule(state)?.revision;
  if (!current || !Array.isArray(current.model.activities) || !Array.isArray(current.model.relationships) || !Array.isArray(current.model.calendars) || !Array.isArray(current.model.wbs)) {
    return {
      dateIso: null,
      method:
        "programme_completion_not_established",
      sourceRefs: [],
    };
  }
  const projection =
    buildScheduleAnalyticsProjection(
      current.model,
      {
        generatedAt:
          new Date()
            .toISOString(),
        producerVersion:
          "commercial-contract-controls-schedule-consumer-v1",
      },
    );
  const bases =
    projection.result
      .completionBases;
  const selected =
    bases.find(
      (basis) =>
        basis.basis ===
          "forecast" &&
        basis.dateIso,
    ) ??
    bases.find(
      (basis) =>
        basis.basis ===
          "programme" &&
        basis.dateIso,
    ) ??
    bases.find(
      (basis) =>
        basis.basis ===
          "actual" &&
        basis.dateIso,
    ) ??
    null;
  return {
    dateIso:
      selected?.dateIso ??
      null,
    method:
      selected
        ? "schedule_analytics_completion_basis:" +
          selected.basis +
          ":" +
          selected.method
        : "schedule_analytics_completion_basis_missing",
    sourceRefs:
      selected
        ?.sourceRefs ??
      [],
  };
}

const cache = new WeakMap<
  ProjectRuntimeState,
  {
    version: number;
    value:
      ContractControlsProjection;
  }
>();

export function commercialContractControlsForState(
  state: ProjectRuntimeState,
  generatedAt = new Date().toISOString(),
): ContractControlsProjection {
  const prior =
    cache.get(state);
  if (
    prior?.version ===
    state.version
  ) {
    return prior.value;
  }

  const ledger =
    commercialCanonical(state);
  const foundation =
    commercialFoundationForState(
      state,
      generatedAt,
    );
  const timeClaims =
    canonicalTimeClaims(state);
  const programme =
    currentProgrammeCompletion(
      state,
    );
  const contractTime =
    state.controls
      .contractTimeBasis;

  const ldTerms =
    state.contract
      ? extractContractLdTerms(
          state.contract,
        )
      : null;

  const contractValues =
    foundation
      .commercialTerms
      .originalContractValueByCurrency
      .map((row) => ({
        currency:
          row.currency,
        value:
          row.current.value,
        state:
          row.current.state,
        sourceRefs: [
          ...row.current
            .basis.sourceRefs,
        ],
      }));

  const awardedOverlap =
    contractTime
      ?.overlapResolution ??
    "not_applicable";
  const awardedDays =
    awardedOverlap ===
      "unresolved"
      ? null
      : contractTime
          ?.overlapResolution
        ? contractTime
            .additionalApprovedEotDays ??
          null
        : contractTime
            ?.officialApprovedEotDays ??
          null;

  const projection =
    buildContractControls({
      projectId:
        state.projectId,
      generatedAt,
      dataDateIso:
        projectDataDate(state),
      variations:
        ledger.variations.map(
          (row) => ({
            variationId:
              row.variationId,
            description:
              row.description,
            status:
              row.status,
            authority:
              row.authority,
            instructionId:
              row.instructionId,
            instructionDate:
              row.instructionDate,
            submittedDate:
              row.submittedDate,
            quotationDate:
              row.quotationDate,
            assessedDate:
              row.assessedDate,
            agreedDate:
              row.agreedDate,
            approvalDate:
              row.approvalDate,
            scheduleImpactDays:
              row.scheduleImpactDays,
            claimId:
              row.claimId,
            paymentId:
              row.paymentId,
            activityIds: [
              ...row.activityIds,
            ],
            clauseIdentifiers:
              [
                ...row
                  .clauseIdentifiers,
              ],
            claimedAmount:
              moneyInput(
                row.claimedAmount,
              ),
            assessedAmount:
              moneyInput(
                row.assessedAmount,
              ),
            agreedAmount:
              moneyInput(
                row.agreedAmount,
              ),
            approvedAmount:
              moneyInput(
                row.approvedAmount,
              ),
            sourceRefs: [
              receiptRef(
                row.receipt,
              ),
            ],
          }),
        ),
      siteInstructions:
        ledger.siteInstructions
          .map((row) => ({
            instructionId:
              row.instructionId,
            description:
              row.description,
            issueDate:
              row.issueDate,
            status:
              row.status,
            variationId:
              row.variationId,
            quotationDueDate:
              row.quotationDueDate,
            quotationDate:
              row.quotationDate,
            scheduleImpactDays:
              row.scheduleImpactDays,
            claimId:
              row.claimId,
            paymentId:
              row.paymentId,
            activityIds: [
              ...row.activityIds,
            ],
            clauseIdentifiers:
              [
                ...row
                  .clauseIdentifiers,
              ],
            estimatedAmount:
              moneyInput(
                row.estimatedAmount,
              ),
            sourceRefs: [
              receiptRef(
                row.receipt,
              ),
            ],
          })),
      obligations:
        ledger.obligations
          .map((row) => ({
            obligationId:
              row.obligationId,
            clauseIdentifier:
              row.clauseIdentifier,
            description:
              row.description,
            responsibleParty:
              row.responsibleParty,
            dueDate:
              row.dueDate,
            completedDate:
              row.completedDate,
            status:
              row.status,
            evidenceReference:
              row.evidenceReference,
            sourceRefs: [
              receiptRef(
                row.receipt,
              ),
            ],
          })),
      contractClauses:
        foundation
          .commercialTerms
          .clauses.map(
            (clause) => ({
              clauseKey:
                clause.clauseKey,
              identifier:
                clause.identifier,
              heading:
                clause.heading,
              governanceState:
                clause
                  .governanceState,
              textPreview:
                clause.textPreview,
              sourceRef:
                clause.sourceRef,
              sourceRefs:clause.sourceRefs??[clause.sourceRef],
              occurrenceCount:clause.occurrenceCount??1,
              referencedClauseIdentifiers:clause.referencedClauseIdentifiers??[],
            }),
          ),
      bonds:
        state.controls.bonds
          .map((row) => ({
            bondId:
              row.bondId,
            kind:
              row.kind,
            status:
              row.status,
            expiryIso:
              row.expiryIso,
            amount:
              row.amount,
            currency:
              row.currency,
            sourceRefs: [
              ...row.sourceRefs,
            ],
          })),
      insurances:
        ledger.insurances
          .map((row) => ({
            policyId:
              row.policyId,
            kind:
              row.kind,
            insurer:
              row.insurer,
            status:
              row.status,
            inceptionDate:
              row.inceptionDate,
            expiryDate:
              row.expiryDate,
            coverageAmount:
              moneyInput(
                row.coverageAmount,
              ),
            sourceRequirement:
              row.sourceRequirement,
            sourceRefs: [
              receiptRef(
                row.receipt,
              ),
            ],
          })),
      retentions:
        ledger.retentions
          .map((row) => ({
            retentionId:
              row.retentionId,
            certificateNo:
              row.certificateNo,
            state:
              row.state,
            trigger:
              row.trigger,
            dueDate:
              row.dueDate,
            releaseDate:
              row.releaseDate,
            amount:
              moneyInput(
                row.amount,
              ),
            sourceRefs: [
              receiptRef(
                row.receipt,
              ),
            ],
          })),
      existingRetentions:
        state.controls
          .retentions.map(
            (row) => ({
              retentionId:
                row.retentionId,
              state:
                row.state,
              amount:
                row.amount,
              currency:
                row.currency,
              sourceRefs: [
                ...row.sourceRefs,
              ],
            }),
          ),
      paymentRetentions:
        ledger.payments.map(
          (row) => ({
            paymentId:
              row.paymentId,
            periodEnd:
              row.periodEnd,
            retentionDeduction:
              moneyInput(
                row.amounts
                  .retentionDeduction,
              ),
            retentionReleaseDate:
              row
                .retentionReleaseDate,
            sourceRefs: [
              receiptRef(
                row.receipt,
              ),
            ],
          }),
        ),
      retentionPercent:
        foundation
          .commercialTerms
          .retentionPercent,
      retentionCapPercent:
        foundation
          .commercialTerms
          .retentionCapPercent,
      performanceBondRequirement:
        foundation
          .commercialTerms
          .performanceBondRequirement,
      advancePaymentBondRequirement:
        foundation
          .commercialTerms
          .advancePaymentBondRequirement,
      insuranceRequirementCount:
        foundation
          .commercialTerms
          .insuranceRequirements
          .length,
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
                        ldTerms.rate
                          .basis,
                      amount:
                        ldTerms.rate
                          .amount,
                      currency:
                        ldTerms.rate
                          .currency,
                      percent:
                        ldTerms.rate
                          .percent,
                      sourceRefs: [
                        ...ldTerms.rate
                          .sourceRefs,
                      ],
                    }
                  : null,
              cap:
                ldTerms.cap
                  ? {
                      basis:
                        ldTerms.cap
                          .basis,
                      amount:
                        ldTerms.cap
                          .amount,
                      currency:
                        ldTerms.cap
                          .currency,
                      percent:
                        ldTerms.cap
                          .percent,
                      sourceRefs: [
                        ...ldTerms.cap
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
      contractValues,
      ldTime: {
        contractualCompletionIso:
          contractTime
            ?.contractualCompletionIso ??
          null,
        contractualCompletionState:
          contractTime
            ?.contractualCompletionState ??
          "missing",
        programmeCompletionIso:
          programme.dateIso,
        programmeCompletionMethod:
          programme.method,
        programmeSourceRefs: [
          ...programme
            .sourceRefs,
        ],
        awardedEotDays:
          awardedDays,
        awardedEotState:
          contractTime
            ?.officialApprovedEotState ??
          "missing",
        awardedOverlapResolution:
          awardedOverlap,
        eotSourceRefs: [
          ...(contractTime
            ?.sourceRefs ??
            []),
        ],
      },
    });

  cache.set(state, {
    version: state.version,
    value: projection,
  });
  return projection;
}

export function commercialContractControlCapabilityForState(
  state: ProjectRuntimeState,
  key: string,
): ModuleRuntimeResult | null {
  const projection =
    commercialContractControlsForState(
      state,
    );
  let data: unknown;
  let capabilityState:
    | "established"
    | "candidate"
    | "partial"
    | "missing"
    | "conflicted";

  if (key === "variations") {
    data =
      projection.variations;
    capabilityState =
      projection.variations
        .state;
  } else if (
    key ===
    "site-instructions"
  ) {
    data =
      projection.siteInstructions;
    capabilityState =
      projection.siteInstructions
        .state;
  } else if (
    key ===
    "contract-obligations"
  ) {
    data =
      projection
        .contractObligations;
    capabilityState =
      projection
        .contractObligations
        .state;
  } else if (
    key ===
    "liquidated-damages"
  ) {
    data =
      projection
        .liquidatedDamages;
    capabilityState =
      projection
        .liquidatedDamages
        .state;
  } else if (
    key ===
    "bonds-insurance"
  ) {
    data =
      projection
        .bondsInsurance;
    capabilityState =
      projection
        .bondsInsurance
        .state;
  } else if (
    key ===
    "retention-calendar"
  ) {
    data =
      projection
        .retentionCalendar;
    capabilityState =
      projection
        .retentionCalendar
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
          ? "Conflicting contract/commercial evidence is retained and requires governed resolution."
          : capabilityState ===
              "missing"
            ? "The evidence required for this Commercial control capability is not established."
            : capabilityState ===
                "candidate"
              ? "The capability has source candidates but no fully governed position yet."
              : "The capability is partially established and preserves its source gaps.",
    dependencies: [
      "commercial-canonical-v1",
      "commercial-foundation-v1",
      "schedule analytics completion basis",
      "canonical claims/EOT time basis",
    ],
    data,
  };
}
