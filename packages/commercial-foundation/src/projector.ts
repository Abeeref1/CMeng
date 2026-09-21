import type {
  CbsBreakdownProjection,
  CbsNode,
  CommercialAmendmentRecord,
  CommercialClauseRecord,
  CommercialFinding,
  CommercialFindingAuthority,
  CommercialFindingState,
  CommercialFoundationInput,
  CommercialFoundationProjection,
  CommercialTermsProjection,
  CostRegisterProjection,
  CostRegisterRecord,
  FoundationMoneyInput,
  PaymentRegisterProjection,
} from "./types";

const DAY_MS = 86_400_000;

function uniq(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function coverage(
  known: number,
  total: number,
) {
  return {
    known,
    total,
    percent:
      total <= 0
        ? null
        : Number(
            (
              (known / total) *
              100
            ).toFixed(2),
          ),
  };
}

function authorityForMoney(
  money: FoundationMoneyInput,
): CommercialFindingAuthority {
  if (money.value === null) return "missing";
  if (money.state === "official") return "source";
  if (money.state === "candidate") return "candidate";
  if (money.state === "conflicted") return "mixed";
  return "source";
}

function stateForMoney(
  money: FoundationMoneyInput,
): CommercialFindingState {
  if (money.state === "official") return "established";
  if (money.state === "candidate") return "candidate";
  if (money.state === "conflicted") return "conflicted";
  if (money.state === "partial") return "partial";
  return "missing";
}

function finding<T>(
  value: T | null,
  options: {
    asOfDate?: string | null;
    method: string;
    sourceRefs?: string[];
    authority: CommercialFindingAuthority;
    state: CommercialFindingState;
    submitted?: T | null;
    independent?: T | null;
    gap?: number | string | null;
    consequence?: string | null;
    action?: string | null;
    known?: number;
    total?: number;
    diagnostics?: string[];
  },
): CommercialFinding<T> {
  return {
    value,
    basis: {
      asOfDate:
        options.asOfDate ??
        null,
      method: options.method,
      sourceRefs: uniq(
        options.sourceRefs ?? [],
      ),
    },
    coverage: coverage(
      options.known ??
        (value === null ? 0 : 1),
      options.total ?? 1,
    ),
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

function moneyFinding(
  value: FoundationMoneyInput,
): CommercialFinding<number> {
  return finding(
    value.value,
    {
      asOfDate: value.asOf,
      method:
        "source_commercial_ledger",
      sourceRefs:
        value.sourceRefs,
      authority:
        authorityForMoney(value),
      state:
        stateForMoney(value),
      diagnostics:
        value.state ===
        "partial"
          ? [
              "MONEY_VALUE_PARTIAL_SOURCE_BASIS",
            ]
          : [],
    },
  );
}

function text(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function sectionRef(
  section:
    CommercialFoundationInput["contractSections"][number],
): string {
  return (
    "evidence-document:" +
    section.documentId +
    ":" +
    (
      section.startPage
        ? "page:" +
          section.startPage
        : section.sectionKey
    )
  );
}

function clauseRecord(
  section:
    CommercialFoundationInput["contractSections"][number],
): CommercialClauseRecord {
  const effective =
    (
      section.basisState ===
        "active" ||
      section.basisState ===
        "additive"
    ) &&
    section.sourceMode ===
      "deterministic" &&
    section.sectionStatus ===
      "verified";
  return {
    clauseKey:
      section.sectionKey,
    documentId:
      section.documentId,
    documentRole:
      section.documentRole,
    identifier:
      section.identifier,
    parentIdentifier:
      section.parentIdentifier,
    heading: section.heading,
    startPage:
      section.startPage,
    governanceState:
      effective
        ? "effective"
        : section.sectionStatus ===
            "unresolved"
          ? "unresolved"
          : "provisional",
    sourceMode:
      section.sourceMode,
    sourceRef:
      sectionRef(section),
    textPreview:
      text(section.text)
        .slice(0, 360),
  };
}

interface MatchCandidate<T> {
  value: T;
  ref: string;
  approved: boolean;
}

function uniqueCandidates<T>(
  values: MatchCandidate<T>[],
): MatchCandidate<T>[] {
  const byValue =
    new Map<
      string,
      MatchCandidate<T>
    >();
  for (const candidate of values) {
    const key =
      JSON.stringify(
        candidate.value,
      );
    const existing =
      byValue.get(key);
    if (
      !existing ||
      (
        candidate.approved &&
        !existing.approved
      )
    ) {
      byValue.set(
        key,
        candidate,
      );
    }
  }
  return [
    ...byValue.values(),
  ];
}

function candidateFinding<T>(
  candidates:
    MatchCandidate<T>[],
  options: {
    method: string;
    dataDateIso: string | null;
    consequence: string;
    action: string;
  },
): CommercialFinding<T> {
  const unique =
    uniqueCandidates(candidates);
  if (!unique.length) {
    return finding<T>(null, {
      method:
        options.method,
      authority: "missing",
      state: "missing",
      action: options.action,
      consequence:
        options.consequence,
      known: 0,
      total: 1,
    });
  }
  if (unique.length > 1) {
    return finding<T>(null, {
      method:
        options.method,
      sourceRefs:
        unique.map(
          (candidate) =>
            candidate.ref,
        ),
      authority: "mixed",
      state: "conflicted",
      action:
        "Review the conflicting source positions and promote the governing contractual term.",
      consequence:
        options.consequence,
      known: 0,
      total:
        unique.length,
      diagnostics: [
        "CONFLICTING_COMMERCIAL_TERM_CANDIDATES",
      ],
    });
  }
  const only = unique[0]!;
  return finding(
    only.value,
    {
      asOfDate:
        options.dataDateIso,
      method:
        options.method,
      sourceRefs: [only.ref],
      authority:
        only.approved
          ? "approved"
          : "candidate",
      state:
        only.approved
          ? "established"
          : "candidate",
      consequence:
        options.consequence,
      action:
        only.approved
          ? null
          : options.action,
    },
  );
}

function explicitPercent(
  input:
    CommercialFoundationInput,
  patterns: RegExp[],
  method: string,
  consequence: string,
): CommercialFinding<number> {
  const matches:
    MatchCandidate<number>[] =
    [];
  for (
    const section of
      input.contractSections
  ) {
    const combined = [
      section.heading ?? "",
      section.text,
    ].join("\n");
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match:
        RegExpExecArray | null;
      while (
        (match =
          pattern.exec(
            combined,
          )) !== null
      ) {
        const value =
          Number(match[1]);
        if (
          Number.isFinite(value) &&
          value >= 0
        ) {
          matches.push({
            value,
            ref:
              sectionRef(section),
            approved:
              (
                section.basisState ===
                  "active" ||
                section.basisState ===
                  "additive"
              ) &&
              section.sourceMode ===
                "deterministic" &&
              section.sectionStatus ===
                "verified",
          });
        }
      }
    }
  }
  return candidateFinding(
    matches,
    {
      method,
      dataDateIso:
        input.dataDateIso,
      consequence,
      action:
        "Confirm the governing contract clause before downstream commercial calculations use this term.",
    },
  );
}

function explicitDays(
  input:
    CommercialFoundationInput,
  patterns: RegExp[],
  method: string,
  consequence: string,
): CommercialFinding<number> {
  return explicitPercent(
    input,
    patterns,
    method,
    consequence,
  );
}

function explicitRequirement(
  input:
    CommercialFoundationInput,
  headingPattern: RegExp,
  method: string,
  consequence: string,
): CommercialFinding<string> {
  const matches:
    MatchCandidate<string>[] =
    [];
  for (
    const section of
      input.contractSections
  ) {
    const body = text(
      [
        section.heading ?? "",
        section.text,
      ].join(" "),
    );
    if (
      !headingPattern.test(body)
    ) {
      headingPattern.lastIndex = 0;
      continue;
    }
    headingPattern.lastIndex = 0;
    matches.push({
      value: body.slice(0, 320),
      ref: sectionRef(section),
      approved:
        (
          section.basisState ===
            "active" ||
          section.basisState ===
            "additive"
        ) &&
        section.sourceMode ===
          "deterministic" &&
        section.sectionStatus ===
          "verified",
    });
  }
  return candidateFinding(
    matches,
    {
      method,
      dataDateIso:
        input.dataDateIso,
      consequence,
      action:
        "Review and approve the governing instrument requirement before expiry or exposure monitoring relies on it.",
    },
  );
}

function contractValueRows(
  input:
    CommercialFoundationInput,
): CommercialTermsProjection["originalContractValueByCurrency"] {
  const currencySet =
    new Set<string>();
  if (input.contractValue) {
    currencySet.add(
      input.contractValue
        .currency,
    );
  }
  for (
    const candidate of
      input.contractValueCandidates
  ) {
    currencySet.add(
      candidate.currency,
    );
  }
  for (
    const variation of
      input.variations
  ) {
    currencySet.add(
      variation.currency,
    );
  }

  return [...currencySet]
    .filter(Boolean)
    .sort()
    .map((currency) => {
      const governed =
        input.contractValue
          ?.currency === currency
          ? input.contractValue
          : null;
      const candidates =
        input
          .contractValueCandidates
          .filter(
            (candidate) =>
              candidate.currency ===
              currency,
          );
      const original =
        governed
          ? finding(
              governed.amount,
              {
                method:
                  "governed_contract_value",
                sourceRefs:
                  governed.sourceRefs,
                authority:
                  "approved",
                state:
                  "established",
                asOfDate:
                  input.dataDateIso,
                consequence:
                  "Sets the contractual monetary baseline for all downstream commercial positions.",
                action: null,
              },
            )
          : candidateFinding(
              candidates.map(
                (candidate) => ({
                  value:
                    candidate.amount,
                  ref:
                    candidate
                      .sourceRefs[0] ??
                    "contract-value-candidate",
                  approved: false,
                }),
              ),
              {
                method:
                  "contract_value_extraction",
                dataDateIso:
                  input.dataDateIso,
                consequence:
                  "The original contract value is not yet governed.",
                action:
                  "Review and promote the governing contract value.",
              },
            );
      const approvedRows =
        input.variations
          .filter(
            (variation) =>
              variation.currency ===
                currency &&
              variation.state ===
                "approved",
          );
      const approvedValue =
        approvedRows.length
          ? approvedRows.reduce(
              (sum, row) =>
                sum +
                row.amount,
              0,
            )
          : null;
      const approvedVariations =
        finding(
          approvedValue,
          {
            method:
              "approved_variation_sum",
            sourceRefs:
              approvedRows.flatMap(
                (row) =>
                  row.sourceRefs,
              ),
            authority:
              approvedRows.length
                ? "approved"
                : "missing",
            state:
              approvedRows.length
                ? "established"
                : "missing",
            asOfDate:
              input.dataDateIso,
            consequence:
              "Only approved variations can change the governed current contract value.",
            action:
              approvedRows.length
                ? null
                : "No approved variation amount is established for this currency.",
            known:
              approvedRows.length,
            total:
              approvedRows.length ||
              1,
          },
        );
      const currentValue =
        original.value !== null
          ? original.value +
            (
              approvedValue ??
              0
            )
          : null;
      return {
        currency,
        original,
        approvedVariations,
        current:
          finding(
            currentValue,
            {
              method:
                "original_contract_plus_approved_variations",
              sourceRefs: uniq([
                ...original.basis
                  .sourceRefs,
                ...approvedVariations
                  .basis
                  .sourceRefs,
              ]),
              authority:
                currentValue !==
                null
                  ? original
                        .authority ===
                      "approved"
                    ? "calculated"
                    : "candidate"
                  : "missing",
              state:
                currentValue !==
                null
                  ? original
                        .state ===
                      "established"
                    ? "established"
                    : "candidate"
                  : "missing",
              asOfDate:
                input.dataDateIso,
              submitted:
                currentValue,
              independent:
                currentValue,
              gap: 0,
              consequence:
                "This is the contract-sum basis used for commercial reconciliation in this currency.",
              action:
                currentValue ===
                null
                  ? "Establish the original contract value before a current contract value is calculated."
                  : null,
            },
          ),
      };
    });
}

function buildCommercialTerms(
  input:
    CommercialFoundationInput,
): CommercialTermsProjection {
  const clauses =
    input.contractSections
      .filter(
        (section) =>
          section.identifier !==
            null ||
          section.heading !==
            null,
      )
      .map(clauseRecord);
  const activeClauses =
    clauses.filter(
      (clause) =>
        clause.governanceState ===
        "effective",
    );
  const currencyCandidates:
    MatchCandidate<string>[] =
    [];
  for (
    const section of
      input.contractSections
  ) {
    const body = [
      section.heading ?? "",
      section.text,
    ].join("\n");
    const regex =
      /(?:contract currency(?:\s+is)?|currency of (?:the )?contract(?:\s+is)?|values are stated in)\s*[:\n]?\s*([A-Z]{3})\b/gi;
    let match:
      RegExpExecArray | null;
    while (
      (match =
        regex.exec(body)) !==
      null
    ) {
      currencyCandidates.push({
        value:
          match[1]!
            .toUpperCase(),
        ref:
          sectionRef(section),
        approved:
          (
            section.basisState ===
              "active" ||
            section.basisState ===
              "additive"
          ) &&
          section.sourceMode ===
            "deterministic" &&
          section.sectionStatus ===
            "verified",
      });
    }
  }
  if (input.contractValue) {
    currencyCandidates.push({
      value:
        input.contractValue
          .currency,
      ref:
        input.contractValue
          .sourceRefs[0] ??
        "governed-contract-value",
      approved: true,
    });
  }
  const contractCurrency =
    candidateFinding(
      currencyCandidates,
      {
        method:
          "explicit_contract_currency",
        dataDateIso:
          input.dataDateIso,
        consequence:
          "Currency controls every monetary comparison and prevents invalid cross-currency arithmetic.",
        action:
          "Confirm the governing contract currency before monetary rollups are promoted.",
      },
    );

  const completion =
    input.contractTimeBasis
      ?.contractualCompletionIso ??
    null;
  const contractualCompletionDate =
    finding(
      completion,
      {
        method:
          "governed_contract_time_basis",
        sourceRefs:
          input
            .contractTimeBasis
            ?.sourceRefs ?? [],
        authority:
          completion
            ? input
                .contractTimeBasis
                ?.contractualCompletionState ===
              "official"
              ? "approved"
              : "source"
            : "missing",
        state:
          completion
            ? "established"
            : "missing",
        asOfDate:
          input.dataDateIso,
        consequence:
          "The contractual completion basis drives EOT and liquidated-damages exposure.",
        action:
          completion
            ? null
            : "Establish the applicable contract-time basis.",
      },
    );

  const ldRate =
    input.ldTerms?.rate
      ? finding(
          [
            input.ldTerms.rate
              .amount,
            input.ldTerms.rate
              .currency,
            input.ldTerms.rate
              .percent === null
              ? null
              : input.ldTerms.rate
                  .percent +
                "%",
            input.ldTerms.rate
              .basis,
          ]
            .filter(
              (value) =>
                value !== null &&
                value !==
                  undefined,
            )
            .join(" "),
          {
            method:
              "contract_ld_rate_extraction",
            sourceRefs:
              input.ldTerms.rate
                .sourceRefs,
            authority:
              input.ldTerms
                .rateState ===
              "candidate"
                ? "candidate"
                : "mixed",
            state:
              input.ldTerms
                .rateState ===
              "candidate"
                ? "candidate"
                : "conflicted",
            asOfDate:
              input.dataDateIso,
            consequence:
              "LD exposure cannot be calculated contractually without a governed rate.",
            action:
              "Review and promote the applicable LD rate.",
            diagnostics:
              input.ldTerms
                .diagnostics,
          },
        )
      : finding<string>(
          null,
          {
            method:
              "contract_ld_rate_extraction",
            authority:
              input.ldTerms
                ?.rateState ===
              "conflicted"
                ? "mixed"
                : "missing",
            state:
              input.ldTerms
                ?.rateState ===
              "conflicted"
                ? "conflicted"
                : "missing",
            consequence:
              "LD exposure cannot be calculated contractually without a governed rate.",
            action:
              "Locate and govern the applicable LD rate.",
            diagnostics:
              input.ldTerms
                ?.diagnostics ??
              [],
          },
        );
  const ldCap =
    input.ldTerms?.cap
      ? finding(
          [
            input.ldTerms.cap
              .amount,
            input.ldTerms.cap
              .currency,
            input.ldTerms.cap
              .percent === null
              ? null
              : input.ldTerms.cap
                  .percent +
                "%",
            input.ldTerms.cap
              .basis,
          ]
            .filter(
              (value) =>
                value !== null &&
                value !==
                  undefined,
            )
            .join(" "),
          {
            method:
              "contract_ld_cap_extraction",
            sourceRefs:
              input.ldTerms.cap
                .sourceRefs,
            authority:
              "candidate",
            state:
              "candidate",
            asOfDate:
              input.dataDateIso,
            consequence:
              "The LD cap bounds contractual delay-damages exposure.",
            action:
              "Review and promote the applicable LD cap.",
          },
        )
      : finding<string>(
          null,
          {
            method:
              "contract_ld_cap_extraction",
            authority:
              input.ldTerms
                ?.capState ===
              "conflicted"
                ? "mixed"
                : "missing",
            state:
              input.ldTerms
                ?.capState ===
              "conflicted"
                ? "conflicted"
                : "missing",
            consequence:
              "The LD cap must be established before capped exposure is stated.",
            action:
              "Locate and govern the applicable LD cap.",
            diagnostics:
              input.ldTerms
                ?.diagnostics ??
              [],
          },
        );

  const retentionPercent =
    explicitPercent(
      input,
      [
        /retention(?:\s+percentage|\s+rate)?[^\n.%]{0,100}?(\d+(?:\.\d+)?)\s*%/gi,
      ],
      "explicit_retention_percentage",
      "Retention terms control deductions, cap monitoring and release forecasts.",
    );
  const retentionCapPercent =
    explicitPercent(
      input,
      [
        /retention[^\n.]{0,100}?(?:cap|maximum|not\s+exceed)[^\n.%]{0,80}?(\d+(?:\.\d+)?)\s*%/gi,
      ],
      "explicit_retention_cap_percentage",
      "The retention cap prevents deductions exceeding the contractual maximum.",
    );
  const certificationPeriodDays =
    explicitDays(
      input,
      [
        /certif(?:y|ication|ied)[^\n.]{0,100}?within\s+(\d+)\s+(?:calendar\s+|working\s+)?days/gi,
      ],
      "explicit_certification_period",
      "Certification SLA is required to assess late engineer/employer processing.",
    );
  const paymentPeriodDays =
    explicitDays(
      input,
      [
        /payment[^\n.]{0,120}?within\s+(\d+)\s+(?:calendar\s+|working\s+)?days/gi,
        /(?:amount\s+due|certified\s+amount)[^\n.]{0,100}?paid[^\n.]{0,60}?within\s+(\d+)\s+(?:calendar\s+|working\s+)?days/gi,
      ],
      "explicit_payment_period",
      "Payment period is required for payment SLA, late-payment and interest analysis.",
    );
  const noticePeriodDays =
    explicitDays(
      input,
      [
        /notice[^\n.]{0,120}?within\s+(\d+)\s+(?:calendar\s+|working\s+)?days/gi,
        /within\s+(\d+)\s+(?:calendar\s+|working\s+)?days[^\n.]{0,80}?notice/gi,
      ],
      "explicit_notice_period",
      "Notice periods affect time-bar and entitlement risk.",
    );
  const performanceBondRequirement =
    explicitRequirement(
      input,
      /performance\s+(?:bond|security|guarantee)/i,
      "performance_security_requirement",
      "Missing or expired performance security creates contractual exposure.",
    );
  const advancePaymentBondRequirement =
    explicitRequirement(
      input,
      /advance[- ]payment\s+(?:bond|security|guarantee)/i,
      "advance_payment_security_requirement",
      "Advance-payment security must reconcile with outstanding advance exposure.",
    );

  const insuranceRequirements =
    clauses.filter(
      (clause) =>
        /insurance|insurer|policy|professional indemnity|third[- ]party/i.test(
          [
            clause.heading ?? "",
            clause.textPreview,
          ].join(" "),
        ),
    );
  const hierarchyAndPrecedenceClauses =
    clauses.filter(
      (clause) =>
        /order of precedence|priority of documents|document precedence|conflict between documents/i.test(
          [
            clause.heading ?? "",
            clause.textPreview,
          ].join(" "),
        ),
    );
  const amendments:
    CommercialAmendmentRecord[] =
    input.amendments.map(
      (amendment) => ({
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
        actions:
          amendment.actions.map(
            (action) => ({
              ...action,
            }),
          ),
        sourceRefs: [
          ...amendment
            .sourceRefs,
        ],
      }),
    );

  const contractValues =
    contractValueRows(input);
  const essential = [
    contractCurrency.state,
    contractualCompletionDate
      .state,
    contractValues.some(
      (row) =>
        row.original.state ===
        "established",
    )
      ? "established"
      : contractValues.some(
            (row) =>
              row.original
                .state ===
              "candidate",
          )
        ? "candidate"
        : "missing",
  ];
  const state:
    CommercialFindingState =
    essential.every(
      (value) =>
        value ===
        "established",
    )
      ? "established"
      : essential.some(
            (value) =>
              value ===
              "conflicted",
          )
        ? "conflicted"
        : essential.some(
              (value) =>
                value !==
                "missing",
            )
          ? "partial"
          : activeClauses
                .length >
              0
            ? "partial"
            : "missing";

  return {
    capabilityKey:
      "commercial-terms",
    state,
    originalContractValueByCurrency:
      contractValues,
    contractCurrency,
    contractualCompletionDate,
    ldRate,
    ldCap,
    retentionPercent,
    retentionCapPercent,
    certificationPeriodDays,
    paymentPeriodDays,
    noticePeriodDays,
    performanceBondRequirement,
    advancePaymentBondRequirement,
    insuranceRequirements,
    hierarchyAndPrecedenceClauses,
    clauses,
    amendments,
    diagnostics: [
      "CONTRACT_TERMS_ARE_SOURCE_BACKED_AND_CANDIDATES_DO_NOT_BECOME_APPROVED_AUTOMATICALLY",
      ...(clauses.some(
        (clause) =>
          clause
            .governanceState ===
          "unresolved",
      )
        ? [
            "UNRESOLVED_CONTRACT_CLAUSES_REQUIRE_REVIEW",
          ]
        : []),
    ],
  };
}

function latestRowsByMetric(
  rows:
    CommercialFoundationInput["costMetrics"],
): Map<string, CommercialFoundationInput["costMetrics"]> {
  const grouped =
    new Map<
      string,
      CommercialFoundationInput["costMetrics"]
    >();
  for (const row of rows) {
    const key =
      row.metric
        .trim()
        .toLowerCase();
    const list =
      grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  for (
    const [key, list] of
      grouped
  ) {
    const latest = [
      ...list,
    ].sort((a, b) =>
      (
        a.amount.asOf ??
        ""
      ).localeCompare(
        b.amount.asOf ??
          "",
      ),
    );
    const latestDate =
      latest.at(-1)
        ?.amount.asOf ??
      null;
    grouped.set(
      key,
      latest.filter(
        (row) =>
          row.amount.asOf ===
          latestDate,
      ),
    );
  }
  return grouped;
}

function buildCostRegister(
  input:
    CommercialFoundationInput,
): CostRegisterProjection {
  const groups =
    new Map<
      string,
      CommercialFoundationInput["costMetrics"]
    >();
  for (
    const row of
      input.costMetrics
  ) {
    const key = [
      row.cbsId ??
        "__PROJECT__",
      row.wbsId ?? "",
      row.amount.currency ??
        "__NO_CURRENCY__",
      row.amount.taxBasis,
    ].join("|");
    const list =
      groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const rows:
    CostRegisterRecord[] =
    [];
  for (
    const [key, values] of
      groups
  ) {
    const first =
      values[0]!;
    const byMetric =
      latestRowsByMetric(
        values,
      );
    const metrics:
      Record<
        string,
        CommercialFinding<number>
      > = {};
    const diagnostics:
      string[] = [];
    for (
      const [
        metric,
        candidates,
      ] of byMetric
    ) {
      const valuesKnown =
        candidates.filter(
          (candidate) =>
            candidate.amount
              .value !== null,
        );
      const distinct =
        new Set(
          valuesKnown.map(
            (candidate) =>
              candidate.amount
                .value,
          ),
        );
      if (
        distinct.size >
        1
      ) {
        metrics[metric] =
          finding<number>(null, {
            method:
              "latest_cost_metric_by_cost_code",
            sourceRefs:
              candidates.flatMap(
                (candidate) =>
                  candidate
                    .amount
                    .sourceRefs,
              ),
            authority:
              "mixed",
            state:
              "conflicted",
            asOfDate:
              candidates[0]
                ?.amount.asOf ??
              null,
            consequence:
              "Conflicting cost values prevent a single governed current position.",
            action:
              "Resolve the conflicting source values for this cost metric.",
            known: 0,
            total:
              candidates.length,
            diagnostics: [
              "CONFLICTING_LATEST_COST_METRIC",
            ],
          });
        diagnostics.push(
          "CONFLICTING_COST_METRIC:" +
            metric,
        );
      } else {
        metrics[metric] =
          moneyFinding(
            candidates.at(-1)!
              .amount,
          );
      }
    }
    const state:
      CommercialFindingState =
      diagnostics.length
        ? "conflicted"
        : Object.values(
              metrics,
            ).some(
              (metric) =>
                metric.state ===
                "established",
            )
          ? "established"
          : Object.values(
                metrics,
              ).some(
                (metric) =>
                  metric.state ===
                  "candidate",
              )
            ? "candidate"
            : "partial";
    rows.push({
      recordId:
        "cost:" + key,
      costCode:
        first.cbsId,
      description:
        values.find(
          (row) =>
            row.cbsDescription,
        )
          ?.cbsDescription ??
        null,
      parentCostCode:
        values.find(
          (row) =>
            row.parentCbsId,
        )
          ?.parentCbsId ??
        null,
      wbsId:
        first.wbsId,
      counterparty:
        values.find(
          (row) =>
            row.counterparty,
        )
          ?.counterparty ??
        null,
      currency:
        first.amount
          .currency ??
        "UNRESOLVED",
      taxBasis:
        first.amount.taxBasis,
      metrics,
      boqItemIds: uniq(
        values
          .map(
            (row) =>
              row.boqItemId ??
              "",
          )
          .filter(Boolean),
      ),
      paymentIds: uniq(
        values
          .map(
            (row) =>
              row.paymentId ??
              "",
          )
          .filter(Boolean),
      ),
      sourceRefs: uniq(
        values.flatMap(
          (row) =>
            row.amount
              .sourceRefs,
        ),
      ),
      state,
      diagnostics,
    });
  }
  const mapped =
    input.costMetrics.filter(
      (row) =>
        Boolean(row.cbsId),
    ).length;
  const total =
    input.costMetrics.length;
  const state:
    CommercialFindingState =
    total === 0
      ? "missing"
      : rows.some(
            (row) =>
              row.state ===
              "conflicted",
          )
        ? "conflicted"
        : mapped === total
          ? "established"
          : "partial";

  return {
    capabilityKey:
      "cost-register",
    state,
    recordCount:
      rows.length,
    mappedCbsRecordCount:
      mapped,
    unmappedCbsRecordCount:
      total - mapped,
    mappingCoveragePercent:
      coverage(
        mapped,
        total,
      ).percent,
    rows: rows.sort(
      (a, b) =>
        (
          a.costCode ??
          ""
        ).localeCompare(
          b.costCode ??
            "",
        ),
    ),
    diagnostics: [
      "COST_REGISTER_PRESERVES_CURRENCY_TAX_PERIOD_AND_SOURCE_AUTHORITY",
      ...(total >
        mapped
        ? [
            "UNMAPPED_CBS_COST_ROWS_RETAINED",
          ]
        : []),
    ],
  };
}

function addDays(
  iso: string | null,
  days: number | null,
): string | null {
  if (
    !iso ||
    days === null
  ) {
    return null;
  }
  const parsed =
    Date.parse(iso);
  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return null;
  }
  return new Date(
    parsed +
      days * DAY_MS,
  )
    .toISOString()
    .slice(0, 10);
}

function dateDueFinding(
  explicitDate: string | null,
  anchorDate: string | null,
  days:
    CommercialFinding<number>,
  method: string,
): CommercialFinding<string> {
  if (explicitDate) {
    return finding(
      explicitDate,
      {
        method:
          "explicit_source_due_date",
        authority: "source",
        state:
          "established",
        consequence:
          "The explicit due date governs SLA assessment unless superseded by a governed contractual decision.",
        action: null,
      },
    );
  }
  if (
    anchorDate &&
    days.value !== null
  ) {
    const derived =
      addDays(
        anchorDate,
        days.value,
      );
    return finding(
      derived,
      {
        method,
        sourceRefs:
          days.basis
            .sourceRefs,
        authority:
          derived
            ? "calculated"
            : "missing",
        state:
          derived
            ? days.state ===
                "established"
              ? "established"
              : "candidate"
            : "missing",
        submitted: null,
        independent:
          derived,
        consequence:
          "Calculated due date is derived only from an explicit event date and contractual period.",
        action:
          days.state ===
          "established"
            ? null
            : "Approve the contractual period before treating this due date as governed.",
      },
    );
  }
  return finding<string>(
    null,
    {
      method,
      authority: "missing",
      state: "missing",
      consequence:
        "SLA cannot be assessed without the event date and governing contractual period.",
      action:
        "Provide the missing event date or contractual period.",
    },
  );
}

function slaState(
  due:
    CommercialFinding<string>,
  actual: string | null,
  dataDateIso: string | null,
): "on_time" | "late" | "open" | "not_established" {
  if (!due.value) {
    return "not_established";
  }
  if (actual) {
    return actual <=
      due.value
      ? "on_time"
      : "late";
  }
  if (
    dataDateIso &&
    dataDateIso >
      due.value
  ) {
    return "late";
  }
  return "open";
}

function buildPaymentRegister(
  input:
    CommercialFoundationInput,
  terms:
    CommercialTermsProjection,
): PaymentRegisterProjection {
  const rows =
    input.payments.map(
      (payment) => {
        const certificationDueDate =
          dateDueFinding(
            payment
              .certificationDueDate,
            payment
              .applicationDate,
            terms
              .certificationPeriodDays,
            "application_date_plus_contract_certification_period",
          );
        const paymentDueDate =
          dateDueFinding(
            payment.paymentDueDate,
            payment
              .certificationDate ??
              payment.periodEnd,
            terms
              .paymentPeriodDays,
            "certification_date_plus_contract_payment_period",
          );
        const amountFindings:
          Record<
            string,
            CommercialFinding<number>
          > = {};
        for (
          const [
            key,
            amount,
          ] of Object.entries(
            payment.amounts,
          )
        ) {
          amountFindings[key] =
            moneyFinding(amount);
        }
        const stageKnown =
          [
            payment.applicationDate,
            payment.assessmentDate,
            payment.certificationDate,
            payment.paymentDate,
          ].filter(Boolean)
            .length;
        return {
          paymentId:
            payment.paymentId,
          paymentType:
            payment.paymentType,
          periodEnd:
            payment.periodEnd,
          sourceStatus:
            payment.sourceStatus,
          lifecycle: {
            applicationDate:
              payment.applicationDate,
            assessmentDate:
              payment.assessmentDate,
            certificationDate:
              payment
                .certificationDate,
            certificationDueDate,
            paymentDueDate,
            paymentDate:
              payment.paymentDate,
            paymentTimestamp:
              payment
                .paymentTimestamp,
            retentionReleaseDate:
              payment
                .retentionReleaseDate,
            finalReceiptDate:
              payment
                .finalReceiptDate,
            slaState:
              slaState(
                paymentDueDate,
                payment.paymentDate,
                input.dataDateIso,
              ),
          },
          amounts:
            amountFindings,
          calculatedOutstandingAmount:
            moneyFinding(
              payment
                .calculatedOutstandingAmount,
            ),
          reconciliation:
            payment.reconciliation,
          sourceRefs: uniq(
            payment.sourceRefs,
          ),
          diagnostics: [
            ...payment
              .diagnostics,
            ...(stageKnown ===
            0
              ? [
                  "PAYMENT_STAGE_DATES_NOT_ESTABLISHED",
                ]
              : []),
          ],
        };
      },
    );
  const stageKnown =
    rows.reduce(
      (sum, row) =>
        sum +
        [
          row.lifecycle
            .applicationDate,
          row.lifecycle
            .assessmentDate,
          row.lifecycle
            .certificationDate,
          row.lifecycle
            .paymentDate,
        ].filter(Boolean)
          .length,
      0,
    );
  const stageTotal =
    rows.length * 4;
  return {
    capabilityKey:
      "payment-register",
    state:
      rows.length === 0
        ? "missing"
        : stageKnown ===
            stageTotal
          ? "established"
          : "partial",
    recordCount:
      rows.length,
    stageCoveragePercent:
      coverage(
        stageKnown,
        stageTotal,
      ).percent,
    rows,
    diagnostics: [
      "APPLIED_ASSESSED_CERTIFIED_AND_PAID_STAGES_REMAIN_SEPARATE",
      "PAYMENT_SLA_USES_ACTUAL_EVENT_DATES_NOT_PLANNED_DATES",
      "MISSING_PAYMENT_STAGE_VALUES_ARE_NOT_COPIED_FROM_OTHER_STAGES",
    ],
  };
}

function buildCbsBreakdown(
  input:
    CommercialFoundationInput,
  costRegister:
    CostRegisterProjection,
): CbsBreakdownProjection {
  const mapped =
    costRegister.rows.filter(
      (row) =>
        row.costCode,
    );
  const nodes =
    new Map<
      string,
      CbsNode
    >();

  for (const row of mapped) {
    const code =
      row.costCode!;
    let node =
      nodes.get(code);
    if (!node) {
      node = {
        costCode: code,
        description:
          row.description,
        parentCostCode:
          row.parentCostCode,
        currencies: [],
        childCostCodes: [],
        wbsIds: [],
        boqItemIds: [],
        paymentIds: [],
        sourceRefs: [],
      };
      nodes.set(code, node);
    }
    node.description ??=
      row.description;
    node.parentCostCode ??=
      row.parentCostCode;
    node.currencies.push({
      currency:
        row.currency,
      taxBasis:
        row.taxBasis,
      metrics:
        row.metrics,
    });
    node.wbsIds = uniq([
      ...node.wbsIds,
      ...(row.wbsId
        ? [row.wbsId]
        : []),
    ]);
    node.boqItemIds = uniq([
      ...node.boqItemIds,
      ...row.boqItemIds,
    ]);
    node.paymentIds = uniq([
      ...node.paymentIds,
      ...row.paymentIds,
    ]);
    node.sourceRefs = uniq([
      ...node.sourceRefs,
      ...row.sourceRefs,
    ]);
  }
  for (
    const node of
      nodes.values()
  ) {
    if (
      node.parentCostCode &&
      nodes.has(
        node.parentCostCode,
      )
    ) {
      const parent =
        nodes.get(
          node.parentCostCode,
        )!;
      parent.childCostCodes =
        uniq([
          ...parent
            .childCostCodes,
          node.costCode,
        ]);
    }
  }
  const rootCostCodes =
    [...nodes.values()]
      .filter(
        (node) =>
          !node.parentCostCode ||
          !nodes.has(
            node.parentCostCode,
          ),
      )
      .map(
        (node) =>
          node.costCode,
      )
      .sort();
  const total =
    input.costMetrics.length;
  const mappedCount =
    input.costMetrics.filter(
      (row) =>
        Boolean(row.cbsId),
    ).length;
  return {
    capabilityKey:
      "cbs-breakdown",
    state:
      total === 0
        ? "missing"
        : mappedCount ===
            total
          ? "established"
          : mappedCount >
              0
            ? "partial"
            : "missing",
    nodeCount:
      nodes.size,
    rootCostCodes,
    unmappedCostMetricCount:
      total - mappedCount,
    mappingCoveragePercent:
      coverage(
        mappedCount,
        total,
      ).percent,
    nodes: [
      ...nodes.values(),
    ].sort((a, b) =>
      a.costCode.localeCompare(
        b.costCode,
      ),
    ),
    diagnostics: [
      "CBS_ROLLUPS_NEVER_CROSS_SUM_CURRENCIES_OR_TAX_BASES",
      ...(mappedCount <
      total
        ? [
            "UNMAPPED_COST_ROWS_REMAIN_VISIBLE",
          ]
        : []),
    ],
  };
}

export function buildCommercialFoundation(
  input:
    CommercialFoundationInput,
): CommercialFoundationProjection {
  const commercialTerms =
    buildCommercialTerms(input);
  const costRegister =
    buildCostRegister(input);
  const paymentRegister =
    buildPaymentRegister(
      input,
      commercialTerms,
    );
  const cbsBreakdown =
    buildCbsBreakdown(
      input,
      costRegister,
    );

  return {
    schemaVersion: "1.0",
    projectionKey:
      "commercial_foundation",
    producerVersion:
      "commercial-foundation-v1",
    generatedAt:
      input.generatedAt,
    projectId:
      input.projectId,
    dataDateIso:
      input.dataDateIso,
    commercialTerms,
    costRegister,
    paymentRegister,
    cbsBreakdown,
    diagnostics: [
      "COMMERCIAL_FOUNDATION_USES_SHARED_EVIDENCE_SAFE_FINDING_CONTRACT",
      "NO_COMMERCIAL_CAPABILITY_MAY_REPLACE_MISSING_EVIDENCE_WITH_ZERO",
      "CURRENCY_TAX_DATE_AND_AUTHORITY_BASIS_ARE_PRESERVED",
    ],
  };
}
