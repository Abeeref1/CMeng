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
  const prior = cache.get(state);
  if (prior?.version === state.version) {
    return prior.position;
  }

  const contractValueExtraction =
    state.contract
      ? extractContractValue(state.contract)
      : null;

  const position =
    buildCommercialControlPosition({
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
        state.controls.variations,
      invoices:
        state.controls.invoices,
      retentions:
        state.controls.retentions,
      bonds:
        state.controls.bonds,
      claimCommercials:
        state.controls
          .claimCommercials,
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

  if (
    key ===
    "variations-change"
  ) {
    return position.evidence
      .variations;
  }
  if (
    key === "payments" ||
    key === "cash-flow"
  ) {
    return position.evidence
      .payments;
  }
  if (
    key ===
    "commercial-claims-notices"
  ) {
    return position.evidence
      .claims;
  }
  if (
    key ===
    "contract-particulars-bonds"
  ) {
    return strongestEvidenceState([
      position.evidence
        .commercial,
      position.evidence.bonds,
    ]);
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
      statusReason(
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
