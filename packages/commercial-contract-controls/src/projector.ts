import type {
  CommercialFinding,
  CommercialFindingAuthority,
  CommercialFindingState,
} from "../../commercial-foundation/src";
import type {
  BondPosition,
  BondsInsuranceProjection,
  ContractControlMoney,
  ContractControlsInput,
  ContractControlsProjection,
  ContractObligationsProjection,
  InsurancePosition,
  LdScenario,
  LiquidatedDamagesProjection,
  ObligationRecord,
  RetentionCalendarProjection,
  RetentionCalendarRecord,
  SiteInstructionRecord,
  SiteInstructionsProjection,
  VariationLifecycleRecord,
  VariationsProjection,
} from "./types";

const DAY_MS = 86_400_000;

function uniq(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values.filter(Boolean),
    ),
  ].sort();
}

function dayDiff(
  from: string | null,
  to: string | null,
): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b)
  ) {
    return null;
  }
  return Math.round(
    (b - a) / DAY_MS,
  );
}

function addDays(
  iso: string | null,
  days: number | null,
): string | null {
  if (!iso || days === null) {
    return null;
  }
  const stamp = Date.parse(iso);
  if (!Number.isFinite(stamp)) {
    return null;
  }
  return new Date(
    stamp + days * DAY_MS,
  )
    .toISOString()
    .slice(0, 10);
}

function coverage(
  known: number,
  total: number,
): number | null {
  return total <= 0
    ? null
    : Number(
        (
          (known / total) *
          100
        ).toFixed(2),
      );
}

function finding<T>(
  value: T | null,
  options: {
    method: string;
    asOf?: string | null;
    refs?: string[];
    authority:
      CommercialFindingAuthority;
    state:
      CommercialFindingState;
    submitted?: T | null;
    independent?: T | null;
    gap?: number | string | null;
    consequence?: string | null;
    action?: string | null;
    diagnostics?: string[];
    known?: number;
    total?: number;
  },
): CommercialFinding<T> {
  const known =
    options.known ??
    (value === null ? 0 : 1);
  const total =
    options.total ?? 1;
  return {
    value,
    basis: {
      asOfDate:
        options.asOf ??
        null,
      method:
        options.method,
      sourceRefs: uniq(
        options.refs ?? [],
      ),
    },
    coverage: {
      known,
      total,
      percent:
        coverage(known, total),
    },
    authority:
      options.authority,
    submitted:
      options.submitted ??
      value,
    independent:
      options.independent ??
      null,
    gap:
      options.gap ??
      null,
    consequence:
      options.consequence ??
      null,
    action:
      options.action ??
      null,
    state:
      options.state,
    diagnostics: [
      ...(options.diagnostics ??
        []),
    ],
  };
}

function missingNumber(
  method: string,
  action: string,
  consequence: string,
): CommercialFinding<number> {
  return finding<number>(
    null,
    {
      method,
      authority: "missing",
      state: "missing",
      action,
      consequence,
    },
  );
}

function moneyFinding(
  money: ContractControlMoney,
  method: string,
  consequence: string,
): CommercialFinding<number> {
  const authority:
    CommercialFindingAuthority =
    money.state === "official"
      ? "source"
      : money.state ===
          "candidate"
        ? "candidate"
        : money.state ===
            "conflicted"
          ? "mixed"
          : money.state ===
              "missing"
            ? "missing"
            : "source";
  const state:
    CommercialFindingState =
    money.state === "official"
      ? "established"
      : money.state;
  return finding(
    money.value,
    {
      method,
      asOf: money.asOf,
      refs:
        money.sourceRefs,
      authority,
      state,
      consequence,
      action:
        money.value === null
          ? "Provide or map the missing monetary evidence."
          : null,
    },
  );
}

function ageFinding(
  start: string | null,
  end: string | null,
  refs: string[],
  method: string,
): CommercialFinding<number> {
  const value =
    dayDiff(start, end);
  return value === null
    ? missingNumber(
        method,
        "Provide the missing lifecycle date.",
        "Aging is withheld when the start or reporting date is not established.",
      )
    : finding(
        Math.max(0, value),
        {
          method,
          asOf: end,
          refs,
          authority:
            "calculated",
          state:
            "established",
          independent:
            Math.max(0, value),
          consequence:
            "Aging highlights unresolved commercial items that require management attention.",
          action: null,
        },
      );
}

function variationStage(
  row:
    ContractControlsInput["variations"][number],
): VariationLifecycleRecord["lifecycleStage"] {
  if (
    /reject/i.test(
      row.status,
    )
  ) return "rejected";
  if (
    row.approvalDate ||
    /approved/i.test(
      row.status,
    )
  ) return "approved";
  if (
    row.agreedDate ||
    row.agreedAmount
      .value !== null
  ) return "agreed";
  if (
    row.assessedDate ||
    row.assessedAmount
      .value !== null
  ) return "assessed";
  if (
    row.quotationDate
  ) return "quoted";
  if (
    row.submittedDate ||
    row.claimedAmount
      .value !== null
  ) return "submitted";
  if (
    row.instructionId ||
    row.instructionDate
  ) return "instruction";
  return "unknown";
}

function variations(
  input: ContractControlsInput,
): VariationsProjection {
  const rows =
    input.variations.map(
      (row) => {
        const lastOpenDate =
          row.agreedDate ??
          row.assessedDate ??
          row.quotationDate ??
          row.submittedDate ??
          row.instructionDate;
        const closed =
          Boolean(
            row.approvalDate,
          ) ||
          /approved|rejected/i.test(
            row.status,
          );
        const linkageCount =
          [
            row.instructionId,
            row.claimId,
            row.paymentId,
            row.activityIds
              .length
              ? "activities"
              : null,
          ].filter(Boolean)
            .length;
        return {
          variationId:
            row.variationId,
          description:
            row.description,
          lifecycleStage:
            variationStage(row),
          status: row.status,
          authority:
            row.authority,
          dates: {
            instruction:
              row.instructionDate,
            submitted:
              row.submittedDate,
            quotation:
              row.quotationDate,
            assessed:
              row.assessedDate,
            agreed:
              row.agreedDate,
            approved:
              row.approvalDate,
          },
          ageDays:
            closed
              ? finding(
                  0,
                  {
                    method:
                      "closed_variation_age",
                    asOf:
                      row.approvalDate ??
                      input.dataDateIso,
                    refs:
                      row.sourceRefs,
                    authority:
                      "calculated",
                    state:
                      "established",
                    independent: 0,
                    consequence:
                      "Closed variations are not included in open-item aging.",
                    action: null,
                  },
                )
              : ageFinding(
                  lastOpenDate,
                  input.dataDateIso,
                  row.sourceRefs,
                  "variation_open_age",
                ),
          cost: {
            claimed:
              moneyFinding(
                row.claimedAmount,
                "variation_claimed_amount",
                "Claimed variation value remains separate from assessment, agreement and approval.",
              ),
            assessed:
              moneyFinding(
                row.assessedAmount,
                "variation_assessed_amount",
                "Assessed variation value does not equal approved entitlement.",
              ),
            agreed:
              moneyFinding(
                row.agreedAmount,
                "variation_agreed_amount",
                "Agreed value remains distinct until contractual approval is evidenced.",
              ),
            approved:
              moneyFinding(
                row.approvedAmount,
                "variation_approved_amount",
                "Approved value is the only variation value eligible to change the governed contract sum.",
              ),
          },
          scheduleImpactDays:
            row.scheduleImpactDays ===
            null
              ? missingNumber(
                  "source_variation_schedule_impact",
                  "Link or assess the variation against the schedule if time impact is material.",
                  "Cost change does not establish schedule impact.",
                )
              : finding(
                  row.scheduleImpactDays,
                  {
                    method:
                      "source_variation_schedule_impact",
                    asOf:
                      row.approvalDate ??
                      input.dataDateIso,
                    refs:
                      row.sourceRefs,
                    authority:
                      "source",
                    state:
                      "established",
                    consequence:
                      "Source-reported schedule impact is retained separately from EOT entitlement.",
                    action: null,
                  },
                ),
          instructionId:
            row.instructionId,
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
          linkageCoveragePercent:
            coverage(
              linkageCount,
              4,
            ),
          sourceRefs: [
            ...row.sourceRefs,
          ],
          diagnostics: [
            "VARIATION_COST_STAGES_ARE_NOT_INTERCHANGEABLE",
            "SOURCE_TIME_IMPACT_DOES_NOT_ESTABLISH_EOT_ENTITLEMENT",
          ],
        };
      },
    );
  const lifecycleKnown =
    rows.filter(
      (row) =>
        row.lifecycleStage !==
        "unknown",
    ).length;
  const fullLifecycleKnown =
    rows.filter(
      (row) => {
        const terminal =
          row.lifecycleStage ===
            "approved" ||
          row.lifecycleStage ===
            "rejected";
        if (!terminal) {
          return false;
        }
        const commonDates = [
          row.dates.instruction,
          row.dates.submitted,
          row.dates.assessed,
        ];
        const terminalDate =
          row.lifecycleStage ===
            "approved"
            ? row.dates.approved
            : (
                row.dates.agreed ??
                row.dates.approved
              );
        return (
          commonDates.every(Boolean) &&
          Boolean(terminalDate)
        );
      },
    ).length;
  const lifecycleStageCounts = {
    instruction:
      rows.filter(
        (row) =>
          row.lifecycleStage ===
          "instruction",
      ).length,
    submitted:
      rows.filter(
        (row) =>
          row.lifecycleStage ===
          "submitted",
      ).length,
    quoted:
      rows.filter(
        (row) =>
          row.lifecycleStage ===
          "quoted",
      ).length,
    assessed:
      rows.filter(
        (row) =>
          row.lifecycleStage ===
          "assessed",
      ).length,
    agreed:
      rows.filter(
        (row) =>
          row.lifecycleStage ===
          "agreed",
      ).length,
    approved:
      rows.filter(
        (row) =>
          row.lifecycleStage ===
          "approved",
      ).length,
    rejected:
      rows.filter(
        (row) =>
          row.lifecycleStage ===
          "rejected",
      ).length,
    unknown:
      rows.filter(
        (row) =>
          row.lifecycleStage ===
          "unknown",
      ).length,
  };
  const pendingRows =
    rows.filter(
      (row) =>
        ![
          "approved",
          "rejected",
        ].includes(
          row.lifecycleStage,
        ),
    );
  const pendingAgeBands = {
    upTo30Days:
      pendingRows.filter(
        (row) =>
          row.ageDays.value !==
            null &&
          row.ageDays.value <=
            30,
      ).length,
    days31To60:
      pendingRows.filter(
        (row) =>
          row.ageDays.value !==
            null &&
          row.ageDays.value >
            30 &&
          row.ageDays.value <=
            60,
      ).length,
    days61To90:
      pendingRows.filter(
        (row) =>
          row.ageDays.value !==
            null &&
          row.ageDays.value >
            60 &&
          row.ageDays.value <=
            90,
      ).length,
    over90Days:
      pendingRows.filter(
        (row) =>
          row.ageDays.value !==
            null &&
          row.ageDays.value >
            90,
      ).length,
    unknown:
      pendingRows.filter(
        (row) =>
          row.ageDays.value ===
            null,
      ).length,
  };
  return {
    capabilityKey:
      "variations",
    state:
      rows.length === 0
        ? "missing"
        : rows.some(
              (row) =>
                row.cost.approved
                  .state ===
                  "conflicted",
            )
          ? "conflicted"
          : lifecycleKnown ===
              rows.length
            ? "established"
            : "partial",
    recordCount:
      rows.length,
    approvedCount:
      rows.filter(
        (row) =>
          row.lifecycleStage ===
          "approved",
      ).length,
    pendingCount:
      rows.filter(
        (row) =>
          ![
            "approved",
            "rejected",
          ].includes(
            row.lifecycleStage,
          ),
      ).length,
    rejectedCount:
      rows.filter(
        (row) =>
          row.lifecycleStage ===
          "rejected",
      ).length,
    finalStageCoveragePercent:
      coverage(
        lifecycleKnown,
        rows.length,
      ),
    fullLifecycleCoveragePercent:
      coverage(
        fullLifecycleKnown,
        rows.length,
      ),
    lifecycleStageCounts,
    pendingAgeBands,
    scheduleLinkCoveragePercent:
      coverage(
        rows.filter(
          (row) =>
            row.activityIds
              .length > 0 ||
            row
              .scheduleImpactDays
              .value !== null,
        ).length,
        rows.length,
      ),
    claimLinkCoveragePercent:
      coverage(
        rows.filter(
          (row) =>
            Boolean(
              row.claimId,
            ),
        ).length,
        rows.length,
      ),
    paymentLinkCoveragePercent:
      coverage(
        rows.filter(
          (row) =>
            Boolean(
              row.paymentId,
            ),
        ).length,
        rows.length,
      ),
    rows,
    diagnostics: [
      "INSTRUCTION_SUBMISSION_ASSESSMENT_AGREEMENT_APPROVAL_AND_PAYMENT_REMAIN_SEPARATE",
      "VARIATION_TIME_LINKS_REFERENCE_SCHEDULE_AND_CLAIM_DOMAINS_WITHOUT_RECALCULATING_CAUSATION",
    ],
  };
}

function siteInstructions(
  input: ContractControlsInput,
): SiteInstructionsProjection {
  const rows:
    SiteInstructionRecord[] =
    input.siteInstructions.map(
      (row) => {
        const quotationTimeliness:
          SiteInstructionRecord["quotationTimeliness"] =
          row.quotationDueDate
            ? row.quotationDate
              ? row.quotationDate <=
                row.quotationDueDate
                ? "on_time"
                : "late"
              : input.dataDateIso &&
                  input.dataDateIso >
                    row
                      .quotationDueDate
                ? "late"
                : "open"
            : "not_established";
        return {
          instructionId:
            row.instructionId,
          description:
            row.description,
          issueDate:
            row.issueDate,
          status:
            row.status,
          quotationDueDate:
            row.quotationDueDate
              ? finding(
                  row.quotationDueDate,
                  {
                    method:
                      "source_quotation_due_date",
                    asOf:
                      row.issueDate,
                    refs:
                      row.sourceRefs,
                    authority:
                      "source",
                    state:
                      "established",
                    consequence:
                      "Quotation due date drives instruction response aging.",
                    action: null,
                  },
                )
              : finding<string>(
                  null,
                  {
                    method:
                      "source_quotation_due_date",
                    authority:
                      "missing",
                    state:
                      "missing",
                    consequence:
                      "Quotation timeliness cannot be judged without a due date.",
                    action:
                      "Provide the contractual or instructed quotation due date.",
                  },
                ),
          quotationDate:
            row.quotationDate,
          quotationTimeliness,
          openAgeDays:
            row.quotationDate
              ? finding(
                  0,
                  {
                    method:
                      "quoted_instruction_closed_age",
                    asOf:
                      row.quotationDate,
                    refs:
                      row.sourceRefs,
                    authority:
                      "calculated",
                    state:
                      "established",
                    independent: 0,
                    consequence:
                      "Quoted instruction is removed from open quotation aging.",
                    action: null,
                  },
                )
              : ageFinding(
                  row.issueDate,
                  input.dataDateIso,
                  row.sourceRefs,
                  "site_instruction_open_age",
                ),
          estimatedAmount:
            moneyFinding(
              row.estimatedAmount,
              "site_instruction_estimated_amount",
              "Instruction estimate is not an approved variation.",
            ),
          scheduleImpactDays:
            row.scheduleImpactDays ===
            null
              ? missingNumber(
                  "site_instruction_schedule_impact",
                  "Assess/link schedule impact where required.",
                  "Instruction issuance alone does not establish delay.",
                )
              : finding(
                  row.scheduleImpactDays,
                  {
                    method:
                      "source_site_instruction_schedule_impact",
                    asOf:
                      row.issueDate,
                    refs:
                      row.sourceRefs,
                    authority:
                      "source",
                    state:
                      "established",
                    consequence:
                      "Reported schedule impact remains separate from EOT entitlement.",
                    action: null,
                  },
                ),
          variationId:
            row.variationId,
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
          sourceRefs: [
            ...row.sourceRefs,
          ],
        };
      },
    );
  return {
    capabilityKey:
      "site-instructions",
    state:
      rows.length
        ? "established"
        : "missing",
    recordCount:
      rows.length,
    unquotedCount:
      rows.filter(
        (row) =>
          !row.quotationDate,
      ).length,
    overdueQuotationCount:
      rows.filter(
        (row) =>
          row
            .quotationTimeliness ===
          "late",
      ).length,
    convertedVariationCount:
      rows.filter(
        (row) =>
          Boolean(
            row.variationId,
          ),
      ).length,
    rows,
    diagnostics: [
      "SITE_INSTRUCTION_IS_NOT_AUTOMATICALLY_A_VARIATION_OR_ENTITLEMENT",
      "QUOTATION_AGING_USES_ACTUAL_ISSUE_AND_DUE_DATES",
    ],
  };
}

function clauseLooksObligatory(
  text: string,
): boolean {
  return (
    /\b(?:shall|must|required to|is required to)\b/i.test(
      text,
    ) &&
    /\b(?:submit|provide|maintain|notify|insur|bond|guarantee|certificate|record|report|approve|pay|deliver)\w*/i.test(
      text,
    )
  );
}

function obligations(
  input: ContractControlsInput,
): ContractObligationsProjection {
  const explicit:
    ObligationRecord[] =
    input.obligations.map(
      (row) => {
        const completed =
          Boolean(
            row.completedDate,
          ) ||
          /complete|closed|fulfilled|complied/i.test(
            row.status,
          );
        const overdue =
          !completed &&
          Boolean(
            row.dueDate &&
              input.dataDateIso &&
              input.dataDateIso >
                row.dueDate,
          );
        return {
          obligationId:
            row.obligationId,
          origin:
            "explicit_register",
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
            completed
              ? "complete"
              : overdue
                ? "overdue"
                : "open",
          daysToDue:
            row.dueDate &&
            input.dataDateIso
              ? finding(
                  dayDiff(
                    input.dataDateIso,
                    row.dueDate,
                  ),
                  {
                    method:
                      "obligation_due_date_minus_data_date",
                    asOf:
                      input.dataDateIso,
                    refs:
                      row.sourceRefs,
                    authority:
                      "calculated",
                    state:
                      "established",
                    consequence:
                      "Negative days indicate an overdue contractual obligation.",
                    action:
                      overdue
                        ? "Escalate the overdue obligation and confirm compliance evidence."
                        : null,
                  },
                )
              : missingNumber(
                  "obligation_due_date_minus_data_date",
                  "Provide the obligation due date.",
                  "Due-state cannot be calculated without a date.",
                ),
          evidenceReference:
            row.evidenceReference,
          sourceRefs: [
            ...row.sourceRefs,
          ],
          diagnostics: [],
        };
      },
    );

  const registeredClauses =
    new Set(
      explicit
        .map(
          (row) =>
            row.clauseIdentifier,
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        ),
    );
  const candidates:
    ObligationRecord[] =
    input.contractClauses
      .filter(
        (clause) =>
          clauseLooksObligatory(
            [
              clause.heading ??
                "",
              clause.textPreview,
            ].join(" "),
          ) &&
          !(
            clause.identifier &&
            registeredClauses.has(
              clause.identifier,
            )
          ),
      )
      .map(
        (clause) => ({
          obligationId:
            "clause:" +
            clause.clauseKey,
          origin:
            "contract_clause_candidate",
          clauseIdentifier:
            clause.identifier,
          description:
            clause.textPreview,
          responsibleParty:
            null,
          dueDate: null,
          completedDate: null,
          status:
            "candidate",
          daysToDue:
            missingNumber(
              "clause_obligation_due_date",
              "Map the clause to an explicit obligation/due date before monitoring compliance.",
              "A contractual requirement is not given a fabricated compliance date.",
            ),
          evidenceReference:
            null,
          sourceRefs: [
            clause.sourceRef,
          ],
          diagnostics: [
            "CLAUSE_OBLIGATION_IS_CANDIDATE_UNTIL_MAPPED_TO_A_CONTROLLED_OBLIGATION",
          ],
        }),
      );

  const rows = [
    ...explicit,
    ...candidates,
  ];
  return {
    capabilityKey:
      "contract-obligations",
    state:
      explicit.length
        ? candidates.length
          ? "partial"
          : "established"
        : candidates.length
          ? "candidate"
          : "missing",
    recordCount:
      rows.length,
    explicitRecordCount:
      explicit.length,
    clauseCandidateCount:
      candidates.length,
    overdueCount:
      explicit.filter(
        (row) =>
          row.status ===
          "overdue",
      ).length,
    openCount:
      explicit.filter(
        (row) =>
          row.status ===
          "open",
      ).length,
    completeCount:
      explicit.filter(
        (row) =>
          row.status ===
          "complete",
      ).length,
    rows,
    diagnostics: [
      "CONTRACT_CLAUSES_CAN_PROPOSE_OBLIGATIONS_BUT_CANNOT_INVENT_COMPLIANCE_STATUS",
      "EXPLICIT_OBLIGATION_REGISTER_REMAINS_SEPARATE_FROM_CLAUSE_CANDIDATES",
    ],
  };
}

function termState(
  state:
    | "candidate"
    | "missing"
    | "conflicted",
): CommercialFindingState {
  return state === "candidate"
    ? "candidate"
    : state === "conflicted"
      ? "conflicted"
      : "missing";
}

function eotFinding(
  value: number | null,
  coveragePercent: number | null,
  state:
    CommercialFindingState,
  refs: string[],
  method: string,
): CommercialFinding<number> {
  return finding(
    value,
    {
      method,
      refs,
      authority:
        state ===
        "established"
          ? "approved"
          : state ===
              "candidate"
            ? "candidate"
            : "missing",
      state,
      submitted: value,
      consequence:
        "EOT scenario days change the adjusted completion used for LD exposure testing but do not alter entitlement authority.",
      action:
        value === null
          ? "Establish this EOT position before relying on the scenario."
          : null,
      known:
        coveragePercent ===
        null
          ? value === null
            ? 0
            : 1
          : Math.round(
              coveragePercent,
            ),
      total:
        coveragePercent ===
        null
          ? 1
          : 100,
    },
  );
}

function ratePerDay(
  rate:
    NonNullable<
      ContractControlsInput["ldTerms"]
    >["rate"],
  contractValue: number | null,
): number | null {
  if (!rate) return null;
  if (
    rate.basis ===
    "fixed_amount_per_day"
  ) {
    return rate.amount;
  }
  if (
    rate.basis ===
    "fixed_amount_per_week"
  ) {
    return rate.amount === null
      ? null
      : rate.amount / 7;
  }
  if (
    contractValue === null ||
    rate.percent === null
  ) {
    return null;
  }
  const perPeriod =
    contractValue *
    (rate.percent / 100);
  return rate.basis ===
    "percent_contract_amount_per_week"
    ? perPeriod / 7
    : perPeriod;
}

function capAmount(
  cap:
    NonNullable<
      ContractControlsInput["ldTerms"]
    >["cap"],
  contractValue: number | null,
): number | null {
  if (!cap) return null;
  if (
    cap.basis ===
    "fixed_amount"
  ) {
    return cap.amount;
  }
  if (
    contractValue === null ||
    cap.percent === null
  ) {
    return null;
  }
  return (
    contractValue *
    (cap.percent / 100)
  );
}

function liquidatedDamages(
  input: ContractControlsInput,
): LiquidatedDamagesProjection {
  const terms =
    input.ldTerms;
  const rateState =
    terms
      ? termState(
          terms.rateState,
        )
      : "missing";
  const capState =
    terms
      ? termState(
          terms.capState,
        )
      : "missing";

  const scenarioInputs = [
    {
      scenario:
        "no_eot" as const,
      days: 0,
      coverage: 100,
      state:
        "established" as const,
      method:
        "no_eot_scenario",
    },
    {
      scenario:
        "awarded_eot" as const,
      days:
        input.ldTime
          .awardedOverlapResolution ===
          "unresolved"
          ? null
          : input.ldTime
              .awardedEotDays,
      coverage:
        input.ldTime
          .awardedEotDays ===
        null
          ? 0
          : 100,
      state:
        input.ldTime
          .awardedOverlapResolution ===
          "unresolved"
          ? "partial" as const
          : input.ldTime
                .awardedEotState ===
              "official" &&
            input.ldTime
                .awardedEotDays !==
              null
            ? "established" as const
            : input.ldTime
                  .awardedEotDays !==
                null
              ? "candidate" as const
              : "missing" as const,
      method:
        "governed_awarded_eot_scenario",
    },
  ];

  const scenarios:
    LdScenario[] = [];
  const contractValues =
    input.contractValues.length
      ? input.contractValues
      : [
          {
            currency:
              terms?.rate
                ?.currency ??
              terms?.cap
                ?.currency ??
              "UNRESOLVED",
            value: null,
            state:
              "missing" as const,
            sourceRefs: [],
          },
        ];

  for (
    const scenarioInput of
      scenarioInputs
  ) {
    const eotDays =
      eotFinding(
        scenarioInput.days,
        scenarioInput.coverage,
        scenarioInput.state,
        input.ldTime
          .eotSourceRefs,
        scenarioInput.method,
      );
    const adjusted =
      addDays(
        input.ldTime
          .contractualCompletionIso,
        eotDays.value,
      );
    const adjustedFinding =
      adjusted
        ? finding(
            adjusted,
            {
              method:
                "contract_completion_plus_scenario_eot",
              refs:
                input.ldTime
                  .eotSourceRefs,
              authority:
                scenarioInput.state ===
                "established"
                  ? "calculated"
                  : "candidate",
              state:
                scenarioInput.state ===
                "established"
                  ? "established"
                  : "candidate",
              independent:
                adjusted,
              consequence:
                "Scenario adjusted completion is used only for LD sensitivity.",
              action: null,
            },
          )
        : finding<string>(
            null,
            {
              method:
                "contract_completion_plus_scenario_eot",
              authority:
                "missing",
              state:
                scenarioInput.state ===
                "partial"
                  ? "partial"
                  : "missing",
              consequence:
                "Adjusted completion cannot be calculated without contractual completion and scenario EOT days.",
              action:
                scenarioInput.scenario ===
                "awarded_eot" &&
                input.ldTime
                  .awardedOverlapResolution ===
                  "unresolved"
                  ? "Resolve amendment/determination overlap before applying awarded EOT to LD."
                  : "Establish the missing time basis.",
            },
          );
    const exposure =
      dayDiff(
        adjusted,
        input.ldTime
          .programmeCompletionIso,
      );
    const exposureDays =
      exposure === null
        ? missingNumber(
            "forecast_completion_minus_adjusted_completion",
            "Establish the programme completion and adjusted completion dates.",
            "LD exposure days require a defensible completion forecast and contractual time basis.",
          )
        : finding(
            Math.max(
              0,
              exposure,
            ),
            {
              method:
                "max(0, programme completion - adjusted completion)",
              refs: uniq([
                ...input.ldTime
                  .programmeSourceRefs,
                ...input.ldTime
                  .eotSourceRefs,
              ]),
              authority:
                "calculated",
              state:
                "established",
              independent:
                Math.max(
                  0,
                  exposure,
                ),
              consequence:
                "Exposure days are a schedule/commercial scenario, not a legal determination.",
              action: null,
            },
          );

    for (
      const contractValue of
        contractValues
    ) {
      const rate =
        terms?.rate ??
        null;
      const cap =
        terms?.cap ??
        null;
      const perDay =
        ratePerDay(
          rate,
          contractValue.value,
        );
      const uncapped =
        exposureDays.value !==
          null &&
        perDay !== null
          ? exposureDays.value *
            perDay
          : null;
      const capValue =
        capAmount(
          cap,
          contractValue.value,
        );
      const capped =
        uncapped === null ||
        capValue === null
          ? null
          : Math.min(
              uncapped,
              capValue,
            );
      const rateRefs =
        rate?.sourceRefs ??
        [];
      const capRefs =
        cap?.sourceRefs ??
        [];
      const termsCandidate =
        rateState !==
          "established" ||
        capState !==
          "established";
      scenarios.push({
        scenario:
          scenarioInput.scenario,
        eotDays,
        adjustedCompletion:
          adjustedFinding,
        forecastCompletion:
          input.ldTime
            .programmeCompletionIso
            ? finding(
                input.ldTime
                  .programmeCompletionIso,
                {
                  method:
                    input.ldTime
                      .programmeCompletionMethod,
                  refs:
                    input.ldTime
                      .programmeSourceRefs,
                  authority:
                    "source",
                  state:
                    "established",
                  consequence:
                    "Programme/forecast completion is schedule evidence only.",
                  action: null,
                },
              )
            : finding<string>(
                null,
                {
                  method:
                    input.ldTime
                      .programmeCompletionMethod,
                  authority:
                    "missing",
                  state:
                    "missing",
                  consequence:
                    "LD cannot be forecast without a completion position.",
                  action:
                    "Establish the current programme/forecast completion date.",
                },
              ),
        exposureDays,
        currency:
          rate?.currency ??
          (
            contractValue.currency ===
            "UNRESOLVED"
              ? null
              : contractValue
                  .currency
          ),
        uncappedExposure:
          uncapped === null
            ? missingNumber(
                "ld_rate_per_day_x_exposure_days",
                "Govern the LD rate and compatible contract value basis.",
                "LD amount remains withheld where the rate basis cannot be applied.",
              )
            : finding(
                Number(
                  uncapped.toFixed(
                    2,
                  ),
                ),
                {
                  method:
                    "ld_rate_per_day_x_exposure_days",
                  refs: uniq([
                    ...rateRefs,
                    ...contractValue
                      .sourceRefs,
                    ...exposureDays
                      .basis
                      .sourceRefs,
                  ]),
                  authority:
                    termsCandidate
                      ? "candidate"
                      : "calculated",
                  state:
                    termsCandidate
                      ? "candidate"
                      : "established",
                  independent:
                    Number(
                      uncapped.toFixed(
                        2,
                      ),
                    ),
                  consequence:
                    "Uncapped LD is a commercial exposure scenario only.",
                  action:
                    termsCandidate
                      ? "Promote the governing LD term before treating this as contractual exposure."
                      : null,
                },
              ),
        capAmount:
          capValue === null
            ? missingNumber(
                "ld_cap",
                "Govern the LD cap and compatible contract value basis.",
                "The maximum contractual LD exposure is not established.",
              )
            : finding(
                Number(
                  capValue.toFixed(
                    2,
                  ),
                ),
                {
                  method:
                    "governed_ld_cap_basis",
                  refs: uniq([
                    ...capRefs,
                    ...contractValue
                      .sourceRefs,
                  ]),
                  authority:
                    termsCandidate
                      ? "candidate"
                      : "calculated",
                  state:
                    termsCandidate
                      ? "candidate"
                      : "established",
                  consequence:
                    "Cap limits contractual LD exposure when the term is governed.",
                  action:
                    termsCandidate
                      ? "Promote the governing LD cap."
                      : null,
                },
              ),
        cappedExposure:
          capped === null
            ? missingNumber(
                "min(uncapped_ld, ld_cap)",
                "Establish the LD rate/cap and time exposure.",
                "Capped LD remains unresolved without complete compatible inputs.",
              )
            : finding(
                Number(
                  capped.toFixed(
                    2,
                  ),
                ),
                {
                  method:
                    "min(uncapped_ld, ld_cap)",
                  refs: uniq([
                    ...rateRefs,
                    ...capRefs,
                    ...contractValue
                      .sourceRefs,
                    ...exposureDays
                      .basis
                      .sourceRefs,
                  ]),
                  authority:
                    termsCandidate
                      ? "candidate"
                      : "calculated",
                  state:
                    termsCandidate
                      ? "candidate"
                      : "established",
                  independent:
                    Number(
                      capped.toFixed(
                        2,
                      ),
                    ),
                  consequence:
                    "LD exposure remains a scenario and never becomes an imposed deduction automatically.",
                  action:
                    termsCandidate
                      ? "Govern LD terms before using this scenario as contractual exposure."
                      : null,
                },
              ),
        rateBasis:
          rate?.basis ??
          null,
        diagnostics: [
          "LD_SCENARIO_DOES_NOT_ESTABLISH_LEGAL_ENTITLEMENT_OR_DEDUCTION",
          ...(scenarioInput.scenario ===
              "awarded_eot" &&
            input.ldTime
                .awardedOverlapResolution ===
              "unresolved"
            ? [
                "AWARDED_EOT_NOT_APPLIED_WHILE_AMENDMENT_DETERMINATION_OVERLAP_UNRESOLVED",
              ]
            : []),
        ],
      });
    }
  }

  return {
    capabilityKey:
      "liquidated-damages",
    state:
      scenarios.some(
        (row) =>
          row.cappedExposure
            .value !== null,
      )
        ? rateState ===
            "conflicted" ||
          capState ===
            "conflicted"
          ? "conflicted"
          : rateState ===
                "candidate" ||
              capState ===
                "candidate"
            ? "candidate"
            : "established"
        : "partial",
    rateState,
    capState,
    scenarios,
    diagnostics: [
      "CLAIM_REGISTER_DAY_SUMS_ARE_NOT_PROJECT_EOT_AND_NEVER_ADJUST_COMPLETION",
      "SCHEDULE_MOVEMENT_EOT_POSITION_AND_LD_AMOUNT_REMAIN_SEPARATE",
      "ONLY_NO_EOT_AND_GOVERNED_AWARDED_EOT_SCENARIOS_MAY_ADJUST_PROJECT_COMPLETION",
      "LD_IS_NEVER_AUTOMATICALLY_DEDUCTED_FROM_PAYMENTS",
    ],
  };
}

function expiryPosition(
  expiryDate: string | null,
  dataDate: string | null,
  refs: string[],
): {
  days:
    CommercialFinding<number>;
  state:
    BondPosition["expiryState"];
} {
  if (
    !expiryDate ||
    !dataDate
  ) {
    return {
      days:
        missingNumber(
          "instrument_days_to_expiry",
          "Provide the instrument expiry date and reporting date.",
          "Expiry risk cannot be assessed without both dates.",
        ),
      state:
        "date_missing",
    };
  }
  const days =
    dayDiff(
      dataDate,
      expiryDate,
    );
  if (days === null) {
    return {
      days:
        missingNumber(
          "instrument_days_to_expiry",
          "Correct the invalid expiry date.",
          "Expiry risk cannot be assessed from an invalid date.",
        ),
      state:
        "date_missing",
    };
  }
  return {
    days: finding(
      days,
      {
        method:
          "instrument_expiry_minus_data_date",
        asOf: dataDate,
        refs,
        authority:
          "calculated",
        state:
          "established",
        independent: days,
        consequence:
          days < 0
            ? "Instrument has expired."
            : days <= 30
              ? "Instrument is within the 30-day renewal window."
              : days <= 90
                ? "Instrument is within the 90-day watch window."
                : "Instrument expiry is outside the 90-day watch window.",
        action:
          days < 0
            ? "Escalate expired security/insurance."
            : days <= 30
              ? "Obtain renewal or release confirmation."
              : null,
      },
    ),
    state:
      days < 0
        ? "expired"
        : days <= 30
          ? "expiring_30"
          : days <= 90
            ? "expiring_90"
            : "valid",
  };
}

function bondsInsurance(
  input: ContractControlsInput,
): BondsInsuranceProjection {
  const bonds:
    BondPosition[] =
    input.bonds.map(
      (row) => {
        const expiry =
          expiryPosition(
            row.expiryIso,
            input.dataDateIso,
            row.sourceRefs,
          );
        return {
          bondId: row.bondId,
          kind: row.kind,
          status: row.status,
          amount: finding(
            row.amount,
            {
              method:
                "governed_bond_record",
              asOf:
                input.dataDateIso,
              refs:
                row.sourceRefs,
              authority:
                "source",
              state:
                "established",
              consequence:
                "Security value is not cash and is tracked separately from advance/retention balances.",
              action: null,
            },
          ),
          expiryDate:
            row.expiryIso,
          daysToExpiry:
            expiry.days,
          expiryState:
            expiry.state,
          sourceRefs: [
            ...row.sourceRefs,
          ],
        };
      },
    );
  const insurances:
    InsurancePosition[] =
    input.insurances.map(
      (row) => {
        const expiry =
          expiryPosition(
            row.expiryDate,
            input.dataDateIso,
            row.sourceRefs,
          );
        return {
          policyId:
            row.policyId,
          kind: row.kind,
          insurer:
            row.insurer,
          status: row.status,
          coverageAmount:
            moneyFinding(
              row.coverageAmount,
              "insurance_coverage_amount",
              "Policy coverage is tracked independently from bonds and cash.",
            ),
          inceptionDate:
            row.inceptionDate,
          expiryDate:
            row.expiryDate,
          daysToExpiry:
            expiry.days,
          expiryState:
            expiry.state,
          sourceRequirement:
            row.sourceRequirement,
          sourceRefs: [
            ...row.sourceRefs,
          ],
        };
      },
    );

  const performanceRequired =
    input.performanceBondRequirement
      .value !== null;
  const advanceRequired =
    input.advancePaymentBondRequirement
      .value !== null;
  const insuranceRequired =
    input.insuranceRequirementCount > 0;
  const validPerformanceBond =
    bonds.some(
      (row) =>
        row.kind ===
          "performance" &&
        row.status ===
          "active" &&
        row.expiryState !==
          "expired",
    );
  const validAdvanceBond =
    bonds.some(
      (row) =>
        row.kind ===
          "advance_payment" &&
        row.status ===
          "active" &&
        row.expiryState !==
          "expired",
    );
  const validInsurance =
    insurances.some(
      (row) =>
        /active|valid|in.force/i.test(
          row.status,
        ) &&
        row.expiryState !==
          "expired",
    );
  const requirementGap =
    (
      performanceRequired &&
      !validPerformanceBond
    ) ||
    (
      advanceRequired &&
      !validAdvanceBond
    ) ||
    (
      insuranceRequired &&
      !validInsurance
    );

  return {
    capabilityKey:
      "bonds-insurance",
    state:
      bonds.length ||
      insurances.length
        ? requirementGap
          ? "partial"
          : "established"
        : performanceRequired ||
          advanceRequired ||
          insuranceRequired
          ? "partial"
          : "missing",
    performanceBondRequirement:
      input.performanceBondRequirement,
    advancePaymentBondRequirement:
      input.advancePaymentBondRequirement,
    insuranceRequirementCount:
      input.insuranceRequirementCount,
    activeBondCount:
      bonds.filter(
        (row) =>
          row.status ===
            "active" &&
          row.expiryState !==
            "expired",
      ).length,
    expiredBondCount:
      bonds.filter(
        (row) =>
          row.expiryState ===
          "expired" ||
          row.status ===
            "expired",
      ).length,
    expiringBondCount:
      bonds.filter(
        (row) =>
          row.expiryState ===
            "expiring_30" ||
          row.expiryState ===
            "expiring_90",
      ).length,
    activeInsuranceCount:
      insurances.filter(
        (row) =>
          /active|valid|in.force/i.test(
            row.status,
          ) &&
          row.expiryState !==
            "expired",
      ).length,
    expiredInsuranceCount:
      insurances.filter(
        (row) =>
          row.expiryState ===
            "expired" ||
          /expired/i.test(
            row.status,
          ),
      ).length,
    expiringInsuranceCount:
      insurances.filter(
        (row) =>
          row.expiryState ===
            "expiring_30" ||
          row.expiryState ===
            "expiring_90",
      ).length,
    bonds,
    insurances,
    diagnostics: [
      "BOND_VALUE_IS_NOT_ADVANCE_OR_RETENTION_CASH_BALANCE",
      "CONTRACT_REQUIREMENT_POLICY_OR_BOND_RECORD_AND_EXPIRY_STATUS_REMAIN_SEPARATE",
      ...(input
        .insuranceRequirementCount >
        0 &&
      insurances.length === 0
        ? [
            "INSURANCE_REQUIRED_BY_CONTRACT_BUT_NO_POLICY_REGISTER_ESTABLISHED",
          ]
        : []),
      ...(performanceRequired &&
      !validPerformanceBond
        ? [
            "PERFORMANCE_SECURITY_REQUIREMENT_NOT_SATISFIED_BY_CURRENT_VALID_BOND",
          ]
        : []),
      ...(advanceRequired &&
      !validAdvanceBond
        ? [
            "ADVANCE_PAYMENT_SECURITY_REQUIREMENT_NOT_SATISFIED_BY_CURRENT_VALID_BOND",
          ]
        : []),
      ...(insuranceRequired &&
      !validInsurance
        ? [
            "INSURANCE_REQUIREMENT_NOT_SATISFIED_BY_CURRENT_VALID_POLICY",
          ]
        : []),
    ],
  };
}

function retentionCalendar(
  input: ContractControlsInput,
): RetentionCalendarProjection {
  const rows:
    RetentionCalendarRecord[] =
    [];
  const seen =
    new Set<string>();

  for (
    const row of
      input.retentions
  ) {
    const key =
      "explicit:" +
      row.retentionId;
    if (seen.has(key)) continue;
    seen.add(key);
    const overdue =
      !row.releaseDate &&
      Boolean(
        row.dueDate &&
          input.dataDateIso &&
          input.dataDateIso >
            row.dueDate,
      );
    rows.push({
      retentionId:
        row.retentionId,
      origin:
        "explicit_register",
      certificateNo:
        row.certificateNo,
      state:
        row.releaseDate
          ? "released"
          : overdue
            ? "overdue"
            : row.state,
      trigger:
        row.trigger,
      amount:
        moneyFinding(
          row.amount,
          "explicit_retention_balance",
          "Retention amount stays distinct from deduction, bond and cash balances.",
        ),
      dueDate:
        row.dueDate
          ? finding(
              row.dueDate,
              {
                method:
                  "source_retention_due_date",
                asOf:
                  input.dataDateIso,
                refs:
                  row.sourceRefs,
                authority:
                  "source",
                state:
                  "established",
                consequence:
                  "Explicit release due date controls retention aging.",
                action: null,
              },
            )
          : finding<string>(
              null,
              {
                method:
                  "source_retention_due_date",
                authority:
                  "missing",
                state:
                  "missing",
                consequence:
                  "Release date is not inferred from retention percentage alone.",
                action:
                  "Provide the contractual release trigger/event date.",
              },
            ),
      releaseDate:
        row.releaseDate,
      daysToDue:
        row.dueDate &&
        input.dataDateIso
          ? finding(
              dayDiff(
                input.dataDateIso,
                row.dueDate,
              ),
              {
                method:
                  "retention_due_minus_data_date",
                asOf:
                  input.dataDateIso,
                refs:
                  row.sourceRefs,
                authority:
                  "calculated",
                state:
                  "established",
                consequence:
                  overdue
                    ? "Retention release is overdue."
                    : "Positive days remain until release due date.",
                action:
                  overdue
                    ? "Review and process overdue retention release if contractual conditions are met."
                    : null,
              },
            )
          : missingNumber(
              "retention_due_minus_data_date",
              "Provide release due date.",
              "Retention due status cannot be inferred without a trigger/date.",
            ),
      sourceRefs: [
        ...row.sourceRefs,
      ],
      diagnostics: [],
    });
  }

  for (
    const row of
      input.existingRetentions
  ) {
    const key =
      "control:" +
      row.retentionId;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      retentionId:
        row.retentionId,
      origin:
        "governed_control",
      certificateNo: null,
      state: row.state,
      trigger: null,
      amount: finding(
        row.amount,
        {
          method:
            "governed_retention_control",
          asOf:
            input.dataDateIso,
          refs:
            row.sourceRefs,
          authority:
            "source",
          state:
            "established",
          consequence:
            "Governed held/released balance is retained without inventing a release date.",
          action: null,
        },
      ),
      dueDate:
        finding<string>(
          null,
          {
            method:
              "retention_due_date",
            authority:
              "missing",
            state:
              "missing",
            consequence:
              "Release timing is not established by the balance record alone.",
            action:
              "Link the contractual release trigger and event date.",
          },
        ),
      releaseDate: null,
      daysToDue:
        missingNumber(
          "retention_due_minus_data_date",
          "Link release trigger/date.",
          "Due status cannot be calculated from balance only.",
        ),
      sourceRefs: [
        ...row.sourceRefs,
      ],
      diagnostics: [
        "RETENTION_BALANCE_DOES_NOT_IMPLY_RELEASE_DATE",
      ],
    });
  }

  for (
    const payment of
      input.paymentRetentions
  ) {
    if (
      payment
        .retentionDeduction
        .value === null
    ) continue;
    const key =
      "payment:" +
      payment.paymentId;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      retentionId:
        payment.paymentId +
        ":retention",
      origin:
        "payment_deduction",
      certificateNo:
        payment.paymentId,
      state:
        payment
          .retentionReleaseDate
          ? "release_date_recorded"
          : "held_unreconciled",
      trigger: null,
      amount:
        moneyFinding(
          payment
            .retentionDeduction,
          "payment_retention_deduction",
          "Retention deduction is not automatically the current held balance.",
        ),
      dueDate:
        payment
          .retentionReleaseDate
          ? finding(
              payment
                .retentionReleaseDate,
              {
                method:
                  "payment_source_retention_release_date",
                asOf:
                  payment.periodEnd,
                refs:
                  payment.sourceRefs,
                authority:
                  "source",
                state:
                  "established",
                consequence:
                  "Explicit payment-source release date is retained.",
                action: null,
              },
            )
          : finding<string>(
              null,
              {
                method:
                  "payment_source_retention_release_date",
                authority:
                  "missing",
                state:
                  "missing",
                consequence:
                  "Retention deduction does not establish release timing.",
                action:
                  "Provide the release trigger/date.",
              },
            ),
      releaseDate: null,
      daysToDue:
        payment
          .retentionReleaseDate &&
        input.dataDateIso
          ? finding(
              dayDiff(
                input.dataDateIso,
                payment
                  .retentionReleaseDate,
              ),
              {
                method:
                  "retention_release_date_minus_data_date",
                asOf:
                  input.dataDateIso,
                refs:
                  payment.sourceRefs,
                authority:
                  "calculated",
                state:
                  "established",
                consequence:
                  "Payment-source release date is compared to the Data Date.",
                action: null,
              },
            )
          : missingNumber(
              "retention_release_date_minus_data_date",
              "Provide the retention release date/trigger.",
              "Release due status remains unestablished.",
            ),
      sourceRefs: [
        ...payment
          .sourceRefs,
      ],
      diagnostics: [
        "RETENTION_DEDUCTION_IS_NOT_RECONCILED_HELD_BALANCE",
      ],
    });
  }

  const overdueAssessable =
    rows.length > 0 &&
    rows.every(
      (row) =>
        /released|release_date_recorded/i.test(
          row.state,
        ) ||
        row.dueDate.value !==
          null,
    );
  const overdue =
    overdueAssessable
      ? rows.filter(
          (row) =>
            row.state ===
              "overdue" ||
            (
              row.daysToDue
                .value !== null &&
              row.daysToDue
                .value < 0 &&
              !row.releaseDate
            ),
        ).length
      : null;

  return {
    capabilityKey:
      "retention-calendar",
    state:
      rows.length
        ? rows.some(
              (row) =>
                row.dueDate
                  .value === null,
            )
          ? "partial"
          : "established"
        : input.retentionPercent
              .value !== null ||
            input
              .retentionCapPercent
              .value !== null
          ? "partial"
          : "missing",
    retentionPercent:
      input.retentionPercent,
    retentionCapPercent:
      input.retentionCapPercent,
    recordCount:
      rows.length,
    heldCount:
      rows.filter(
        (row) =>
          /held/i.test(
            row.state,
          ),
      ).length,
    releasedCount:
      rows.filter(
        (row) =>
          /released/i.test(
            row.state,
          ),
      ).length,
    dueCount:
      rows.filter(
        (row) =>
          row.dueDate
            .value !== null,
      ).length,
    overdueCount:
      overdue,
    rows,
    diagnostics: [
      "RETENTION_PERCENTAGE_CAP_DEDUCTION_HELD_BALANCE_RELEASE_DUE_AND_ACTUAL_RELEASE_REMAIN_SEPARATE",
      "RELEASE_DATE_IS_NEVER_INFERRED_FROM_PERCENTAGE_WITHOUT_A_TRIGGER_EVENT",
      ...(overdueAssessable
        ? []
        : [
            "RETENTION_OVERDUE_NOT_ASSESSABLE_WITHOUT_RELEASE_DUE_DATES",
          ]),
    ],
  };
}

export function buildContractControls(
  input: ContractControlsInput,
): ContractControlsProjection {
  const variationResult =
    variations(input);
  const instructionResult =
    siteInstructions(input);
  const obligationResult =
    obligations(input);
  const ldResult =
    liquidatedDamages(input);
  const bondResult =
    bondsInsurance(input);
  const retentionResult =
    retentionCalendar(input);

  return {
    schemaVersion: "1.0",
    projectionKey:
      "commercial_contract_controls",
    producerVersion:
      "commercial-contract-controls-v1",
    generatedAt:
      input.generatedAt,
    projectId:
      input.projectId,
    dataDateIso:
      input.dataDateIso,
    variations:
      variationResult,
    siteInstructions:
      instructionResult,
    contractObligations:
      obligationResult,
    liquidatedDamages:
      ldResult,
    bondsInsurance:
      bondResult,
    retentionCalendar:
      retentionResult,
    diagnostics: [
      "CHANGE_CONTRACT_SECURITY_RETENTION_AND_LD_CONTROLS_REUSE_CANONICAL_PROJECT_EVIDENCE",
      "NO_CAPABILITY_RECALCULATES_SCHEDULE_CAUSATION_OR_EOT_ENTITLEMENT",
      "MISSING_SOURCE_EVIDENCE_REMAINS_EXPLICIT",
    ],
  };
}
