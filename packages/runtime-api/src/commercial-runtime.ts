import {sourceCommercialEvidence} from './source-commercial-evidence';
import {certificateProfile} from "./certificate-profile";
import {programmeCashScenario} from './programme-cash-scenario';
import {projectControlSchedule} from './canonical-time-claims';
import {amendmentAmounts,variationBasisReview,costBasisReview} from "./commercial-basis-review";
import {contractNoticeRules} from "./contract-notice-rules";
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
  const programmeCutoff=ledger.dataDateIso;
  const datedCommercialEvidence=[
    ...state.controls.invoices.flatMap(row=>[row.certificateDateIso,row.paymentDateIso]),
    ...ledger.payments.flatMap(row=>[row.periodEnd,row.certificationDate,row.paymentDate]),
    ...ledger.variations.map(row=>row.approvalDate),
    ...ledger.costMetrics.map(row=>row.amount.asOf),
  ].filter((value):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value))
    .map(value=>value.slice(0,10))
    .sort();
  const sourceCommercialCutoff=programmeCutoff??datedCommercialEvidence.at(-1)??null;
  const sourceFactVisibleWithoutProgramme=(date:string|null|undefined)=>{
    if(programmeCutoff)return reportingScope(date,programmeCutoff)==='as_of';
    return Boolean(date&&sourceCommercialCutoff&&String(date).slice(0,10)<=sourceCommercialCutoff);
  };
  const controlVariationDate=(variationId:string,stateValue:string)=>{
    const source=ledger.variations.find(row=>row.variationId===variationId);
    if(!source)return null;
    // Approval date is authoritative for approved value, but using it for a
    // pending variation removes the exposure precisely because it is not yet
    // approved. Pending/rejected records are scoped by the earliest retained
    // lifecycle date that establishes that the variation existed by the cutoff.
    return stateValue==='approved'
      ? source.approvalDate
      : source.submittedDate??source.instructionDate??source.quotationDate??source.assessedDate??source.agreedDate??source.approvalDate;
  };
  const parsedSource = (pattern: RegExp) => state.evidenceDocuments.some(document =>
    document.basisState !== "superseded" && document.parserState === "parsed" &&
    pattern.test(document.documentType + " " + document.sourceFilename));
  const position =
    buildCommercialControlPosition({
      sourceRead: {
        commercial: Boolean(state.contract || state.controls.contractValue),
        payments: Boolean(state.controls.invoices.length || state.controls.retentions.length || parsedSource(/payment|invoice|certificate|retention|advance/i)),
        variations: Boolean(state.controls.variations.length || parsedSource(/variation|change/i)),
        bonds: Boolean((ledger.bonds??state.controls.bonds).length || parsedSource(/bond|guarantee|security/i)),
        claims: Boolean(state.controls.claimCommercials.length || state.controls.delayClaims || parsedSource(/claim|eot|notice/i)),
      },
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
        state.controls.variations.filter(row=>sourceFactVisibleWithoutProgramme(controlVariationDate(row.variationId,row.state))),
      invoices:
        state.controls.invoices.filter(row=>sourceFactVisibleWithoutProgramme(row.certificateDateIso)).map(row=>({...row,paidAmount:sourceFactVisibleWithoutProgramme(row.paymentDateIso)?row.paidAmount:null})),
      retentions:
        state.controls.retentions.filter(retention=>{
          const certificate=ledger.payments.find(row=>retention.retentionId===row.paymentId+':retention');
          return !certificate||sourceFactVisibleWithoutProgramme(certificate.certificationDate);
        }),
      bonds:
        (ledger.bonds??state.controls.bonds),
      claimCommercials:
        state.controls.claimCommercials.flatMap(row=>{
          const claim=state.controls.delayClaims?.claims.find(candidate=>candidate.claimId===row.claimId);
          if(!claim||reportingScope(claim.submittedAt,ledger.dataDateIso)!=='as_of')return [];
          return [{
            ...row,
            // Claim valuation may be reported at submission, but assessed money
            // becomes an established commercial input only when the linked
            // lifecycle record says that assessment is official.
            claimedAmount:claim.claimedAmount??row.claimedAmount,
            assessedAmount:claim.assessedAmountState==='official'?claim.assessedAmount:null,
          }];
        }),
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
  position.variationBasisReview=variationBasisReview(ledger,amendmentAmounts(state));
  for(const group of position.variationBasisReview.groups){
    if(!group.signExceptions.length)continue;
    const currency=position.currencies.find(c=>c.currency===group.currency);if(!currency)continue;
    const diagnostics=group.signExceptions.map(r=>'OMISSION_SIGN_REVIEW:'+r.variationId);
    currency.approvedVariationAmount={...currency.approvedVariationAmount,state:'candidate',diagnostics:[...currency.approvedVariationAmount.diagnostics,...diagnostics],consequence:'Positive omission amounts need sign confirmation before the approved-change total is relied on.',action:'Review the named omission rows in Variations & Change.'};
    currency.currentContractValue={...currency.currentContractValue,state:'candidate',diagnostics:[...currency.currentContractValue.diagnostics,...diagnostics]};
  }
  position.costBasisReview=costBasisReview(ledger,position.certificateProfile,position.currencies);
  Object.assign(position,sourceCommercialEvidence(state,ledger,position,sourceCommercialCutoff));
  position.contractNoticeRules=[...contractNoticeRules(state),...contractNoticeRules(state,'detailed_claim')];
  position.foundation.commercialTerms.noticeVersions=position.contractNoticeRules;
  const scheduleModel=projectControlSchedule(state)?.revision.model??null;
  const sourceFinishDates=(scheduleModel?.activities??[])
    .filter(activity=>!['wbs_summary','level_of_effort'].includes(activity.activityType))
    .map(activity=>activity.status==='completed'?
      activity.actualFinishIso??activity.forecastFinishIso??activity.currentFinishIso:
      activity.forecastFinishIso??activity.currentFinishIso)
    .filter((date):date is string=>!!date&&Number.isFinite(Date.parse(date)));
  const submittedProgrammeFinish=sourceFinishDates.length?
    sourceFinishDates.reduce((latest,date)=>Date.parse(date)>Date.parse(latest)?date:latest):null;
  position.programmeCashScenario=programmeCashScenario(position,sourceCommercialCutoff,submittedProgrammeFinish);
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
    return position.evidence.payments === "established" ? "missing_information" : position.evidence.payments;
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
    return position.evidence.payments === "established" ? "missing_information" : position.evidence.payments;
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
    return "A relevant source was provided, but CMeng has not read its structured records. Review the extraction result.";
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
