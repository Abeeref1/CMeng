import { extractContractValue } from "../../contract-commercial/src";
import { buildCommercialControlPosition, buildCommercialModuleProjection } from "../../commercial-control/src";
import { commercialCanonical } from "./commercial-canonical";
import type { ProjectRuntimeState, ModuleRuntimeResult } from "./project-state-types";
const cache = new WeakMap<ProjectRuntimeState, {version:number;position:ReturnType<typeof buildCommercialControlPosition>}>();
export function commercialPositionForState(state:ProjectRuntimeState, generatedAt = new Date().toISOString()) {
  const prior=cache.get(state);if(prior?.version===state.version)return prior.position;
  const contractValueExtraction=state.contract?extractContractValue(state.contract):null;
  const position = buildCommercialControlPosition({
      sourceLedger: commercialCanonical(state),
      generatedAt,
      projectId:
        state.projectId,
      contractValue:
        state.controls
          .contractValue,
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
        state.controls
          .variations,
      invoices:
        state.controls.invoices,
      retentions:
        state.controls
          .retentions,
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
        state.controls.delayClaims !== null ||
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
  cache.set(state,{version:state.version,position});return position;
}
const views = {
  "commercial-overview":"commercial_overview", "cost-forecast":"cost_forecast",
  "variations-change":"variations_change", "payments":"payments", "cash-flow":"cash_flow",
  "commercial-claims-notices":"commercial_claims_notices", "contract-particulars-bonds":"contract_particulars_bonds"
} as const;
/** Same canonical position for overview, detail, exports and scheduled management projections. */
export function canonicalCommercialModule(state:ProjectRuntimeState, key:string):ModuleRuntimeResult|null {
  const projectionKey=views[key as keyof typeof views];if(!projectionKey)return null;
  const position=commercialPositionForState(state);
  return {key,status:"partial",reason:"Source-backed commercial evidence. Missing stage approvals, dated receipts, CBS allocation and EOT incorporation are not implied by parsed registers.",dependencies:["governed commercial source ledger","programme Data Date","currency and tax basis"],data:buildCommercialModuleProjection(projectionKey,position)};
}
