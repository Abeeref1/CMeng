import type {
  CommercialCanonicalModel,
  CommercialReconciliation,
  CostControlSummary,
} from "./types";

function amount(
  fact:
    | {
        value:
          | {
              amount: number;
              currency: string;
            }
          | null;
      }
    | null
    | undefined,
): number | null {
  return fact?.value?.amount ?? null;
}

function ratio(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (
    numerator === null ||
    denominator === null ||
    denominator === 0
  ) return null;
  return Number(
    (
      numerator /
      denominator
    ).toFixed(8),
  );
}

export function costControlSummary(
  model: CommercialCanonicalModel,
): CostControlSummary {
  const evm = model.evm;
  if (!evm) {
    return {
      currency:
        model.currencies.length === 1
          ? model.currencies[0]!
          : null,
      bac: null,
      pv: null,
      ev: null,
      ac: null,
      spi: null,
      cpi: null,
      etc: null,
      eac: null,
      vac: null,
      forecastOverrun: null,
      evmReconciliation: {
        sourceSpi: null,
        calculatedSpi: null,
        sourceCpi: null,
        calculatedCpi: null,
        sourceEac: null,
        calculatedBottomUpEac: null,
        states: [
          "EVM_SOURCE_NOT_ESTABLISHED",
        ],
      },
    };
  }

  const bac = amount(evm.bac);
  const pv = amount(evm.pv);
  const ev = amount(evm.ev);
  const ac = amount(evm.ac);
  const etc = amount(evm.etc);
  const eac = amount(evm.eac);
  const vac = amount(evm.vac);
  const sourceSpi =
    evm.spi.value;
  const sourceCpi =
    evm.cpi.value;
  const calculatedSpi =
    ratio(ev, pv);
  const calculatedCpi =
    ratio(ev, ac);
  const calculatedBottomUpEac =
    ac !== null &&
    etc !== null
      ? Number(
          (
            ac + etc
          ).toFixed(6),
        )
      : null;
  const states: string[] = [];
  if (
    sourceSpi !== null &&
    calculatedSpi !== null &&
    Math.abs(
      sourceSpi -
      calculatedSpi,
    ) > 0.0001
  ) {
    states.push(
      "SOURCE_SPI_DIFFERS_FROM_EV_DIV_PV",
    );
  }
  if (
    sourceCpi !== null &&
    calculatedCpi !== null &&
    Math.abs(
      sourceCpi -
      calculatedCpi,
    ) > 0.0001
  ) {
    states.push(
      "SOURCE_CPI_DIFFERS_FROM_EV_DIV_AC",
    );
  }
  if (
    eac !== null &&
    calculatedBottomUpEac !==
      null &&
    Math.abs(
      eac -
      calculatedBottomUpEac,
    ) > 0.01
  ) {
    states.push(
      "SOURCE_EAC_DIFFERS_FROM_AC_PLUS_ETC",
    );
  }

  return {
    currency:
      evm.currency ??
      (
        model.currencies.length ===
        1
          ? model.currencies[0]!
          : null
      ),
    bac,
    pv,
    ev,
    ac,
    spi:
      sourceSpi ??
      calculatedSpi,
    cpi:
      sourceCpi ??
      calculatedCpi,
    etc,
    eac:
      eac ??
      calculatedBottomUpEac,
    vac:
      vac ??
      (
        bac !== null &&
        (
          eac ??
          calculatedBottomUpEac
        ) !== null
          ? Number(
              (
                bac -
                (
                  eac ??
                  calculatedBottomUpEac!
                )
              ).toFixed(6),
            )
          : null
      ),
    forecastOverrun:
      bac !== null &&
      (
        eac ??
        calculatedBottomUpEac
      ) !== null
        ? Number(
            (
              (
                eac ??
                calculatedBottomUpEac!
              ) -
              bac
            ).toFixed(6),
          )
        : null,
    evmReconciliation: {
      sourceSpi,
      calculatedSpi,
      sourceCpi,
      calculatedCpi,
      sourceEac: eac,
      calculatedBottomUpEac,
      states,
    },
  };
}

function oneCurrency(
  values: Array<
    {
      amount: number;
      currency: string;
    } | null
  >,
): string | null {
  const currencies = [
    ...new Set(
      values
        .filter(
          (
            value,
          ): value is {
            amount: number;
            currency: string;
          } => value !== null,
        )
        .map(
          (value) =>
            value.currency,
        ),
    ),
  ];
  return currencies.length === 1
    ? currencies[0]!
    : null;
}

export function commercialReconciliation(
  model: CommercialCanonicalModel,
): CommercialReconciliation {
  const original =
    model.terms
      .originalContractValue.value;
  const revised =
    model.terms
      .currentContractValue.value;
  const approvedVariationValues =
    model.variations
      .filter(
        (variation) =>
          variation.authority ===
            "approved" ||
          variation.lifecycleState ===
            "approved" ||
          variation.lifecycleState ===
            "certified",
      )
      .map(
        (variation) =>
          variation.approvedValue,
      )
      .filter(
        (
          value,
        ): value is NonNullable<
          typeof value
        > => value !== null,
      );
  const certifiedValues =
    model.payments
      .map(
        (payment) =>
          payment.netCertified ??
          payment.grossCertified,
      )
      .filter(
        (
          value,
        ): value is NonNullable<
          typeof value
        > => value !== null,
      );
  const paidValues =
    model.payments
      .map(
        (payment) =>
          payment.paidAmount,
      )
      .filter(
        (
          value,
        ): value is NonNullable<
          typeof value
        > => value !== null,
      );

  const currency =
    oneCurrency([
      original,
      revised,
      ...approvedVariationValues,
      ...certifiedValues,
      ...paidValues,
    ]);
  if (!currency) {
    return {
      currency: null,
      originalContract:
        original?.amount ?? null,
      approvedVariations: null,
      revisedContract:
        revised?.amount ?? null,
      certified: null,
      paid: null,
      outstandingCertified: null,
      remainingToContract: null,
      balanceState:
        "not_assessable",
      diagnostics: [
        "RECONCILIATION_REQUIRES_ONE_CURRENCY_PER_SERIES_OR_EXPLICIT_FX_CONVERSION",
      ],
    };
  }

  const sum = (
    values:
      Array<{
        amount: number;
        currency: string;
      }>,
  ) =>
    Number(
      values.reduce(
        (total, value) =>
          total +
          (
            value.currency ===
            currency
              ? value.amount
              : 0
          ),
        0,
      ).toFixed(6),
    );

  const approvedVariations =
    sum(approvedVariationValues);
  const certified =
    sum(certifiedValues);
  const paid =
    paidValues.length
      ? sum(paidValues)
      : null;
  const revisedAmount =
    revised?.currency === currency
      ? revised.amount
      : null;

  return {
    currency,
    originalContract:
      original?.currency === currency
        ? original.amount
        : null,
    approvedVariations,
    revisedContract:
      revisedAmount,
    certified,
    paid,
    outstandingCertified:
      paid === null
        ? null
        : Number(
            (
              certified -
              paid
            ).toFixed(6),
          ),
    remainingToContract:
      revisedAmount === null
        ? null
        : Number(
            (
              revisedAmount -
              certified
            ).toFixed(6),
          ),
    balanceState:
      revisedAmount === null
        ? "partial"
        : paid === null
          ? "partial"
          : "established",
    diagnostics: [
      ...(paid === null
        ? [
            "PAID_CASH_NOT_ESTABLISHED_FROM_PAYMENT_CERTIFICATE_EVIDENCE",
          ]
        : []),
    ],
  };
}
