import {certificateProfile} from "./certificate-profile";
import { reportingScope } from "../../truth-kernel/src";
import { reportingState,claimsReporting } from "./reporting-state";
import { extractContractValue } from "../../contract-commercial/src";
import {
  buildCommercialControlPosition,
  buildCommercialModuleProjection,
  type CommercialControlPosition,
  type CommercialEvidenceState,
} from "../../commercial-control/src";
import { commercialCanonical } from "./commercial-canonical";
import { commercialFoundationForState } from "./commercial-foundation-runtime";
import { commercialPerformanceForState } from "./commercial-performance-runtime";
import { commercialContractControlsForState } from "./commercial-contract-controls-runtime";
import type {
  ProjectRuntimeState,
  ModuleRuntimeResult,
} from "./project-state-types";

const cache = new WeakMap<
  ProjectRuntimeState,
  {
    version: number;
    position: CommercialControlPosition;
  }
>();

export function commercialPositionForState(
  state: ProjectRuntimeState,
  generatedAt = new Date().toISOString(),
): CommercialControlPosition {
  state = reportingState(state);
  const prior = cache.get(state);
  if (prior?.version === state.version) {
    return prior.position;
  }

  const contractValueExtraction =
    state.contract
      ? extractContractValue(state.contract)
      : null;

  const ledger=commercialCanonical(state);
  const position =
    buildCommercialControlPosition({
      sourceDelayClaims:claimsReporting(state)?.source??null,
      sourceLedger:
        commercialCanonical(state),
      foundation:
        commercialFoundationForState(
          state,
          generatedAt,
        ),
      performance:
        commercialPerformanceForState(
          state,
          generatedAt,
        ),
      contractControls:
        commercialContractControlsForState(
          state,
          generatedAt,
        ),
      generatedAt,
      projectId:
        state.projectId,
      contractValue:
        state.controls.contractValue,
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
            }),
          ) ?? [],
      variations:
        state.controls.variations.filter(row=>reportingScope(ledger.variations.find(v=>v.variationId===row.variationId)?.approvalDate,ledger.dataDateIso)==='as_of'),
      invoices:
        state.controls.invoices.filter(row=>reportingScope(row.certificateDateIso,ledger.dataDateIso)==='as_of').map(row=>({...row,paidAmount:reportingScope(row.paymentDateIso,ledger.dataDateIso)==='as_of'?row.paidAmount:null})),
      retentions:
        state.controls.retentions,
      bonds:
        state.controls.bonds,
      claimCommercials:
        state.controls
          .claimCommercials.filter(row=>state.controls.delayClaims?.claims.some(c=>c.claimId===row.claimId&&reportingScope(c.submittedAt,ledger.dataDateIso)==='as_of')).map(row=>({...row,assessedAmount:null})),
      delayClaims:
        state.controls
          .delayClaims,
      contractTimeBasis:
        state.controls
          .contractTimeBasis,
      commercialEvidenceSubmitted:
        Boolean(
          state.contract ||
          state.evidenceDocuments
            .some(
              (document) =>
                document.basisState !==
                  "superseded" &&
                (
                  document.category ===
                    "boq_cost" ||
                  document.category ===
                    "risk_claims_procurement"
                ),
            ),
        ),
      paymentEvidenceSubmitted:
        state.evidenceDocuments
          .some(
            (document) =>
              document.basisState !==
                "superseded" &&
              /payment|invoice|certificate|retention|advance/i.test(
                document.documentType +
                  " " +
                  document.sourceFilename,
              ),
          ),
      variationEvidenceSubmitted:
        state.evidenceDocuments
          .some(
            (document) =>
              document.basisState !==
                "superseded" &&
              /variation|change/i.test(
                document.documentType +
                  " " +
                  document.sourceFilename,
              ),
          ),
      bondEvidenceSubmitted:
        state.evidenceDocuments
          .some(
            (document) =>
              document.basisState !==
                "superseded" &&
              /bond|guarantee|security/i.test(
                document.documentType +
                  " " +
                  document.sourceFilename,
              ),
          ),
      claimEvidenceSubmitted:
        state.controls.delayClaims !==
          null ||
        state.evidenceDocuments
          .some(
            (document) =>
              document.basisState !==
                "superseded" &&
              /claim|eot|notice/i.test(
                document.documentType +
                  " " +
                  document.sourceFilename,
              ),
          ),
    });

  position.certificateProfile=certificateProfile(ledger);
  cache.set(
    state,
    {
      version: state.version,
      position,
    },
  );
  return position;
}

const views = {
  "commercial-overview":
    "commercial_overview",
  "cost-forecast":
    "cost_forecast",
  "variations-change":
    "variations_change",
  payments:
    "payments",
  "cash-flow":
    "cash_flow",
  "commercial-claims-notices":
    "commercial_claims_notices",
  "contract-particulars-bonds":
    "contract_particulars_bonds",
} as const;

export const commercialModuleKeys =
  Object.keys(
    views,
  ) as Array<keyof typeof views>;

function strongestEvidenceState(
  states:
    CommercialEvidenceState[],
): CommercialEvidenceState {
  const priority:
    CommercialEvidenceState[] = [
      "established",
      "candidate",
      "missing_information",
      "submitted_unparsed",
      "not_submitted",
      "not_applicable",
    ];
  return (
    priority.find(
      (state) =>
        states.includes(state),
    ) ??
    "not_submitted"
  );
}

export function commercialEvidenceStateForModule(
  position: CommercialControlPosition,
  key: string,
): CommercialEvidenceState | null {
  if (!(key in views)) {
    return null;
  }

  if (key === "variations-change") {
    return position.evidence.variations;
  }

  if (key === "payments") {
    if (
      position.foundation
        .paymentRegister.state ===
      "established"
    ) {
      return "established";
    }
    if(position.foundation.paymentRegister.sourceRecordCount>0)return 'missing_information';
    return position.evidence.payments ===
      "not_submitted"
      ? "not_submitted"
      : position.evidence.payments ===
          "candidate"
        ? "candidate"
        : "submitted_unparsed";
  }

  if (key === "cash-flow") {
    if (
      position.performance
        .cashFlow.state ===
      "established"
    ) {
      return "established";
    }
    if(position.foundation.paymentRegister.sourceRecordCount>0)return 'missing_information';
    return position.evidence.payments ===
      "not_submitted"
      ? "not_submitted"
      : position.evidence.payments ===
          "candidate"
        ? "candidate"
        : "submitted_unparsed";
  }

  if (
    key ===
    "commercial-claims-notices"
  ) {
    if (
      position.evidence.claims !==
      "established"
    ) {
      return position.evidence
        .claims;
    }
    const counts =
      position.claimsNotices
        .noticeTimelinessCounts;
    const unresolvedNoticeEvidence =
      (counts.requirement_missing ??
        0) +
      (counts.event_date_missing ??
        0) +
      (counts.notice_date_missing ??
        0);
    return position.claimsNotices
        .state === "established" &&
      unresolvedNoticeEvidence === 0
      ? "established"
      : "missing_information";
  }

  if (
    key ===
    "contract-particulars-bonds"
  ) {
    if (
      position.evidence
        .commercial !==
      "established"
    ) {
      return position.evidence
        .commercial;
    }
    return position.evidence.bonds;
  }

  return position.evidence
    .commercial;
}

function statusReason(
  state:
    CommercialEvidenceState,
): string | null {
  if (state === "established") {
    return null;
  }
  if (state === "candidate") {
    return "Relevant commercial evidence exists only as a candidate and is not promoted to the governed project position.";
  }
  if(state==='missing_information')return 'Source records have been read, but required values, dates or reconciled balances are not established. Review the identified field-level evidence gaps.';
  if (
    state ===
    "submitted_unparsed"
  ) {
    return "Relevant evidence is submitted but not yet structurally established. CMeng preserves it as missing/partial rather than zero.";
  }
  if (
    state ===
    "not_applicable"
  ) {
    return "This commercial evidence category is not applicable to the current governed position.";
  }
  return "Relevant commercial evidence has not been submitted. CMeng does not infer zero exposure.";
}

/**
 * The single canonical producer for all seven Commercial views.
 * Overview, detail, UI, exports and portfolio status all use the
 * same CommercialControlPosition and evidence-state contract.
 */
export function canonicalCommercialModule(
  state: ProjectRuntimeState,
  key: string,
): ModuleRuntimeResult | null {
  const projectionKey =
    views[
      key as keyof typeof views
    ];
  if (!projectionKey) {
    return null;
  }

  const position =
    commercialPositionForState(
      state,
    );
  const evidenceState =
    commercialEvidenceStateForModule(
      position,
      key,
    ) ??
    "not_submitted";

  return {
    key,
    status:
      evidenceState ===
      "established"
        ? "ready"
        : "partial",
    reason:
      evidenceState ===
      "established"
        ? null
        : key === "cash-flow" &&
            position.evidence
              .payments ===
              "established"
          ? "Payment evidence is established, but Cash Flow remains under review until dated paid-cash and actual cash-expenditure series support a defensible funding position."
          : key ===
                "contract-particulars-bonds" &&
              position.evidence
                .commercial ===
                "established" &&
              position.evidence
                .bonds !==
                "established"
            ? "Contract particulars are established, but the bond/security register is not established. Security counts and expiry status remain unavailable rather than zero."
            : key ===
                  "commercial-claims-notices" &&
                position.evidence
                  .claims ===
                  "established"
              ? "Claims evidence is established, but notice compliance remains under review where contractual requirements or event/notice dates are incomplete."
              : statusReason(
                  evidenceState,
                ),
    dependencies: [
      "governed commercial source ledger",
      "programme Data Date",
      "currency and tax basis",
    ],
    data:
      buildCommercialModuleProjection(
        projectionKey,
        position,
      ),
  };
}
