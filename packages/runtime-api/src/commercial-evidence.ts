import {
  readFileSync,
} from "node:fs";

import {
  extractContractLdTerms,
  extractContractValue,
} from "../../contract-commercial/src";
import type {
  ContractDocumentResult,
} from "../../contract-parser/src";
import type {
  ProjectRuntimeState,
  StoredEvidenceDocument,
} from "./project-state-types";
import type {
  AccrualRecord,
  CbsNode,
  CashFlowPeriod,
  CommercialAuthority,
  CommercialCanonicalModel,
  CommercialFact,
  CommercialMappingSummary,
  CommercialSourceRef,
  CommercialTermsSnapshot,
  CommitmentRecord,
  ContractAmendmentRecord,
  ContractNoticeTerm,
  EvmSnapshot,
  MoneyAmount,
  PaymentCertificateRecord,
  VariationRecord,
} from "../../commercial-core/src";

function norm(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCsv(
  text: string,
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const ch = text[index]!;
    if (quoted) {
      if (ch === '"') {
        if (
          text[index + 1] ===
          '"'
        ) {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(
        field.replace(
          /\r$/,
          "",
        ),
      );
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (
    field.length > 0 ||
    row.length > 0
  ) {
    row.push(
      field.replace(
        /\r$/,
        "",
      ),
    );
    rows.push(row);
  }
  return rows;
}

function readCsv(
  document:
    StoredEvidenceDocument,
): string[][] | null {
  try {
    return parseCsv(
      readFileSync(
        document.storedPath,
        "utf8",
      ).replace(
        /^\uFEFF/,
        "",
      ),
    );
  } catch {
    return null;
  }
}

function findColumn(
  headers: string[],
  candidates: string[],
): number {
  const normalized =
    headers.map(norm);
  for (const candidate of candidates) {
    const exact =
      normalized.indexOf(
        norm(candidate),
      );
    if (exact >= 0) return exact;
  }
  return normalized.findIndex(
    (header) =>
      candidates.some(
        (candidate) =>
          header.includes(
            norm(candidate),
          ),
      ),
  );
}

function cell(
  row: string[],
  index: number,
): string {
  return index >= 0
    ? (
        row[index] ??
        ""
      ).trim()
    : "";
}

function numeric(
  value: string,
): number | null {
  const cleaned =
    value
      .replace(/,/g, "")
      .replace(
        /[^0-9.+-]/g,
        "",
      )
      .trim();
  if (!cleaned) return null;
  const parsed =
    Number(cleaned);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function dateIso(
  value: string,
): string | null {
  if (!value.trim()) return null;
  const parsed =
    Date.parse(value);
  return Number.isFinite(parsed)
    ? new Date(parsed)
        .toISOString()
        .slice(0, 10)
    : null;
}

function sourceRef(
  sourceId: string,
  locator:
    string | null = null,
  revisionId:
    string | null = null,
): CommercialSourceRef {
  return {
    sourceId,
    locator,
    revisionId,
  };
}

function emptyFact<T>(
  key: string,
  unit: string | null,
  method: string,
): CommercialFact<T> {
  return {
    value: null,
    unit,
    state: "missing",
    authority: "missing",
    effectiveAt: null,
    sourceRefs: [],
    method,
    diagnostics: [],
  };
}

function fact<T>(
  input: {
    value: T | null;
    unit?: string | null;
    authority:
      CommercialAuthority;
    effectiveAt?:
      string | null;
    sourceRefs?:
      CommercialSourceRef[];
    method: string;
    diagnostics?: string[];
  },
): CommercialFact<T> {
  return {
    value: input.value,
    unit: input.unit ?? null,
    state:
      input.value === null
        ? "missing"
        : "established",
    authority:
      input.value === null
        ? "missing"
        : input.authority,
    effectiveAt:
      input.effectiveAt ??
      null,
    sourceRefs:
      input.sourceRefs ?? [],
    method: input.method,
    diagnostics:
      input.diagnostics ?? [],
  };
}

function money(
  amount: number,
  currency: string,
  vatBasis:
    MoneyAmount["vatBasis"] =
      "not_stated",
): MoneyAmount {
  return {
    amount,
    currency:
      currency.toUpperCase(),
    vatBasis,
  };
}

function activeEvidence(
  state: ProjectRuntimeState,
  types: string[],
  filenamePatterns: RegExp[] = [],
): StoredEvidenceDocument[] {
  return state.evidenceDocuments
    .filter(
      (document) =>
        document.basisState !==
          "superseded" &&
        document.basisState !==
          "historical",
    )
    .filter(
      (document) =>
        types.includes(
          document.documentType,
        ) ||
        filenamePatterns.some(
          (pattern) =>
            pattern.test(
              document.sourceFilename,
            ),
        ),
    )
    .sort(
      (a, b) =>
        a.uploadedAt.localeCompare(
          b.uploadedAt,
        ),
    );
}

function contractText(
  contract:
    ContractDocumentResult,
): string {
  return contract.sections
    .map(
      (section) =>
        [
          section.heading ?? "",
          section.text,
        ].join("\n"),
    )
    .join("\n");
}

function contractRef(
  documentId: string,
): CommercialSourceRef {
  return sourceRef(
    "contract-document:" +
      documentId,
  );
}

function firstRegex(
  text: string,
  patterns: RegExp[],
): RegExpExecArray | null {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match =
      pattern.exec(text);
    if (match) return match;
  }
  return null;
}

function dateFromText(
  text: string,
  patterns: RegExp[],
): string | null {
  const match =
    firstRegex(
      text,
      patterns,
    );
  return match
    ? dateIso(
        match[1] ?? "",
      )
    : null;
}

function numberFromText(
  text: string,
  patterns: RegExp[],
): number | null {
  const match =
    firstRegex(
      text,
      patterns,
    );
  return match
    ? numeric(
        match[1] ?? "",
      )
    : null;
}

function moneyFromText(
  text: string,
  patterns: RegExp[],
  vatBasis:
    MoneyAmount["vatBasis"] =
      "not_stated",
): MoneyAmount | null {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match =
      pattern.exec(text);
    if (!match) continue;
    const amount =
      numeric(
        match[2] ?? "",
      );
    if (amount === null) continue;
    const currency =
      (
        match[1] ??
        ""
      )
        .toUpperCase()
        .trim();
    if (
      currency.length !==
      3
    ) continue;
    return money(
      amount,
      currency,
      vatBasis,
    );
  }
  return null;
}

function vatBasisFromText(
  text: string,
):
  | "exclusive"
  | "inclusive"
  | null {
  if (
    /exclusive\s+of\s+vat|excluding\s+vat|vat\s+exclusive/i.test(
      text,
    )
  ) return "exclusive";
  if (
    /inclusive\s+of\s+vat|including\s+vat|vat\s+inclusive/i.test(
      text,
    )
  ) return "inclusive";
  return null;
}

function titleForContract(
  contract:
    ProjectRuntimeState["contractDocuments"][number],
): string {
  return (
    contract.result.title ??
    contract.sourceFilename ??
    contract.documentId
  );
}

function amendmentRecord(
  document:
    ProjectRuntimeState["contractDocuments"][number],
): ContractAmendmentRecord {
  const text =
    contractText(
      document.result,
    );
  const vatBasis =
    vatBasisFromText(text) ??
    "not_stated";
  const amendmentValue =
    moneyFromText(
      text,
      [
        /amendment(?:\s+(?:no\.?\s*\d+))?\s+(?:value|amount)[^A-Z0-9]{0,20}\b([A-Z]{3})\s*([\d,]+(?:\.\d+)?)/i,
      ],
      vatBasis,
    );
  const revisedValue =
    moneyFromText(
      text,
      [
        /revised\s+(?:contract\s+(?:value|sum|amount)|accepted\s+contract\s+amount)[^A-Z0-9]{0,20}\b([A-Z]{3})\s*([\d,]+(?:\.\d+)?)/i,
      ],
      vatBasis,
    );
  const effectiveDate =
    dateFromText(
      text,
      [
        /effective\s+date\s*[:\-]?\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
      ],
    );
  const eotDays =
    numberFromText(
      text,
      [
        /(?:extension\s+of\s+time|eot)(?:\s+granted)?\s*[:\-]?\s*([\d,.]+)\s*calendar\s+days/i,
        /extended\s+by\s+([\d,.]+)\s*calendar\s+days/i,
      ],
    );
  const revisedCompletion =
    dateFromText(
      text,
      [
        /revised\s+(?:contractual\s+)?completion(?:\s+date)?\s*[:\-]?\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
      ],
    );
  const noticeDays =
    numberFromText(
      text,
      [
        /(?:current|revised|amended)\s+(?:initial\s+)?claim\s+notice(?:\s+period)?\s*[:\-]?\s*([\d,.]+)\s*(?:calendar\s+)?days/i,
        /initial\s+claim\s+notice(?:\s+period)?[^\n]{0,80}?([\d,.]+)\s*(?:calendar\s+)?days/i,
      ],
    );
  const detailedDays =
    numberFromText(
      text,
      [
        /fully\s+detailed\s+claim(?:\s+period)?\s*[:\-]?\s*([\d,.]+)\s*(?:calendar\s+)?days/i,
      ],
    );
  const number =
    firstRegex(
      text,
      [
        /amendment\s+(?:no\.?\s*)?([A-Z0-9.-]+)/i,
      ],
    )?.[1] ?? null;
  const changedClauses = [
    ...(revisedValue
      ? ["contract value"]
      : []),
    ...(eotDays !== null
      ? ["extension of time"]
      : []),
    ...(revisedCompletion
      ? [
          "contractual completion",
        ]
      : []),
    ...(noticeDays !== null
      ? [
          "claim notice period",
        ]
      : []),
    ...(detailedDays !== null
      ? [
          "fully detailed claim period",
        ]
      : []),
  ];

  return {
    amendmentId:
      document.documentId,
    number,
    title:
      titleForContract(
        document,
      ),
    effectiveDateIso:
      effectiveDate,
    precedence:
      "amends_contract",
    amendmentValue:
      fact({
        value: amendmentValue,
        unit:
          amendmentValue
            ?.currency ??
          null,
        authority:
          amendmentValue
            ? "official"
            : "missing",
        effectiveAt:
          effectiveDate,
        sourceRefs: [
          contractRef(
            document.documentId,
          ),
        ],
        method:
          "explicit amendment value",
      }),
    revisedContractValue:
      fact({
        value: revisedValue,
        unit:
          revisedValue
            ?.currency ??
          null,
        authority:
          revisedValue
            ? "official"
            : "missing",
        effectiveAt:
          effectiveDate,
        sourceRefs: [
          contractRef(
            document.documentId,
          ),
        ],
        method:
          "explicit revised contract value",
      }),
    eotDays:
      fact({
        value: eotDays,
        unit:
          "calendar_day",
        authority:
          eotDays !== null
            ? "official"
            : "missing",
        effectiveAt:
          effectiveDate,
        sourceRefs: [
          contractRef(
            document.documentId,
          ),
        ],
        method:
          "explicit amendment EOT",
      }),
    revisedCompletionIso:
      fact({
        value:
          revisedCompletion,
        unit: "date",
        authority:
          revisedCompletion
            ? "official"
            : "missing",
        effectiveAt:
          effectiveDate,
        sourceRefs: [
          contractRef(
            document.documentId,
          ),
        ],
        method:
          "explicit amendment revised completion",
      }),
    claimNoticeDays:
      fact({
        value: noticeDays,
        unit:
          "calendar_day",
        authority:
          noticeDays !== null
            ? "official"
            : "missing",
        effectiveAt:
          effectiveDate,
        sourceRefs: [
          contractRef(
            document.documentId,
          ),
        ],
        method:
          "explicit amended claim notice period",
      }),
    fullyDetailedClaimDays:
      fact({
        value:
          detailedDays,
        unit:
          "calendar_day",
        authority:
          detailedDays !== null
            ? "official"
            : "missing",
        effectiveAt:
          effectiveDate,
        sourceRefs: [
          contractRef(
            document.documentId,
          ),
        ],
        method:
          "explicit amended detailed claim period",
      }),
    changedClauses,
    sourceRefs: [
      contractRef(
        document.documentId,
      ),
    ],
  };
}

function buildTerms(
  state: ProjectRuntimeState,
): CommercialTermsSnapshot {
  const mains =
    state.contractDocuments.filter(
      (document) =>
        document.role ===
          "main",
    );
  const amendments =
    state.contractDocuments.filter(
      (document) =>
        document.role ===
          "amendment",
    );
  const main =
    mains.at(-1) ??
    null;
  const mainText =
    main
      ? contractText(
          main.result,
        )
      : "";
  const amendmentRows =
    amendments.map(
      amendmentRecord,
    );
  const latestAmendment =
    [...amendmentRows]
      .sort(
        (a, b) =>
          (
            a.effectiveDateIso ??
            ""
          ).localeCompare(
            b.effectiveDateIso ??
            "",
          ),
      )
      .at(-1) ??
    null;

  const mainValueExtraction =
    main
      ? extractContractValue(
          main.result,
        )
      : null;
  const mainValue =
    mainValueExtraction
      ?.value
      ? money(
          mainValueExtraction
            .value.amount,
          mainValueExtraction
            .value.currency,
          vatBasisFromText(
            mainText,
          ) ??
          "not_stated",
        )
      : moneyFromText(
          mainText,
          [
            /accepted\s+contract\s+amount[^A-Z0-9]{0,30}\b([A-Z]{3})\s*([\d,]+(?:\.\d+)?)/i,
            /original\s+contract\s+(?:sum|value|amount)[^A-Z0-9]{0,30}\b([A-Z]{3})\s*([\d,]+(?:\.\d+)?)/i,
          ],
          vatBasisFromText(
            mainText,
          ) ??
          "not_stated",
        );

  const currentValue =
    latestAmendment
      ?.revisedContractValue
      .value ??
    mainValue;
  const vatBasis =
    (
      latestAmendment
        ?.revisedContractValue
        .value?.vatBasis ??
      mainValue?.vatBasis
    ) === "exclusive"
      ? "exclusive"
      : (
          latestAmendment
            ?.revisedContractValue
            .value?.vatBasis ??
          mainValue?.vatBasis
        ) === "inclusive"
        ? "inclusive"
        : vatBasisFromText(
            mainText,
          );

  const originalCompletion =
    dateFromText(
      mainText,
      [
        /(?:original\s+)?contractual\s+completion(?:\s+date)?\s*[:\-]?\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
        /original\s+completion(?:\s+date)?\s*[:\-]?\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
      ],
    );
  const commencement =
    dateFromText(
      mainText,
      [
        /commencement\s+date\s*[:\-]?\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
      ],
    );
  const originalNotice =
    numberFromText(
      mainText,
      [
        /initial\s+claim\s+notice(?:\s+period)?\s*[:\-]?\s*([\d,.]+)\s*(?:calendar\s+)?days/i,
      ],
    );
  const originalDetailed =
    numberFromText(
      mainText,
      [
        /fully\s+detailed\s+claim(?:\s+period)?\s*[:\-]?\s*([\d,.]+)\s*(?:calendar\s+)?days/i,
      ],
    );

  const ld =
    main
      ? extractContractLdTerms(
          main.result,
        )
      : null;
  const ldRate =
    ld?.rate?.amount !==
      null &&
    ld?.rate?.amount !==
      undefined &&
    ld.rate.currency
      ? money(
          ld.rate.amount,
          ld.rate.currency,
          vatBasis ??
            "not_stated",
        )
      : null;
  const ldCapAmount =
    ld?.cap?.amount !==
      null &&
    ld?.cap?.amount !==
      undefined &&
    ld.cap.currency
      ? money(
          ld.cap.amount,
          ld.cap.currency,
          vatBasis ??
            "not_stated",
        )
      : null;

  const currentNotice =
    latestAmendment
      ?.claimNoticeDays
      .value ??
    originalNotice;
  const currentDetailed =
    latestAmendment
      ?.fullyDetailedClaimDays
      .value ??
    originalDetailed;

  const noticeTerms:
    ContractNoticeTerm[] = [
      {
        termId:
          "claim-initial-notice",
        noticeType:
          "Initial claim notice",
        days:
          fact({
            value:
              currentNotice,
            unit:
              "calendar_day",
            authority:
              currentNotice !==
              null
                ? "official"
                : "missing",
            sourceRefs:
              latestAmendment
                ?.claimNoticeDays
                .value !== null &&
              latestAmendment
                ?.claimNoticeDays
                .value !==
                undefined
                ? latestAmendment
                    .sourceRefs
                : main
                  ? [
                      contractRef(
                        main.documentId,
                      ),
                    ]
                  : [],
            method:
              latestAmendment
                ?.claimNoticeDays
                .value !== null &&
              latestAmendment
                ?.claimNoticeDays
                .value !==
                undefined
                ? "latest amendment precedence"
                : "main contract",
          }),
        trigger:
          "claim event / awareness as defined by contract",
        clauseIdentifier:
          null,
      },
      {
        termId:
          "claim-fully-detailed",
        noticeType:
          "Fully detailed claim",
        days:
          fact({
            value:
              currentDetailed,
            unit:
              "calendar_day",
            authority:
              currentDetailed !==
              null
                ? "official"
                : "missing",
            sourceRefs:
              latestAmendment
                ?.fullyDetailedClaimDays
                .value !== null &&
              latestAmendment
                ?.fullyDetailedClaimDays
                .value !==
                undefined
                ? latestAmendment
                    .sourceRefs
                : main
                  ? [
                      contractRef(
                        main.documentId,
                      ),
                    ]
                  : [],
            method:
              latestAmendment
                ?.fullyDetailedClaimDays
                .value !== null &&
              latestAmendment
                ?.fullyDetailedClaimDays
                .value !==
                undefined
                ? "latest amendment precedence"
                : "main contract",
          }),
        trigger:
          "initial claim notice / claim event as contract states",
        clauseIdentifier:
          null,
      },
    ];

  return {
    projectId:
      state.projectId,
    currency:
      fact({
        value:
          currentValue
            ?.currency ??
          mainValue?.currency ??
          null,
        unit: null,
        authority:
          currentValue
            ? "official"
            : mainValue
              ? "governed_source"
              : "missing",
        sourceRefs:
          latestAmendment
            ?.revisedContractValue
            .value
            ? latestAmendment
                .sourceRefs
            : main
              ? [
                  contractRef(
                    main.documentId,
                  ),
                ]
              : [],
        method:
          "contract currency from current governed contract value",
      }),
    vatBasis:
      fact({
        value:
          vatBasis ===
            "exclusive" ||
          vatBasis ===
            "inclusive"
            ? vatBasis
            : null,
        unit: null,
        authority:
          vatBasis
            ? "governed_source"
            : "missing",
        sourceRefs:
          main
            ? [
                contractRef(
                  main.documentId,
                ),
              ]
            : [],
        method:
          "explicit contract VAT basis",
      }),
    originalContractValue:
      fact({
        value: mainValue,
        unit:
          mainValue
            ?.currency ??
          null,
        authority:
          mainValue
            ? "governed_source"
            : "missing",
        sourceRefs:
          main
            ? [
                contractRef(
                  main.documentId,
                ),
              ]
            : [],
        method:
          "accepted/original contract amount",
      }),
    currentContractValue:
      fact({
        value: currentValue,
        unit:
          currentValue
            ?.currency ??
          null,
        authority:
          latestAmendment
            ?.revisedContractValue
            .value
            ? "official"
            : currentValue
              ? "governed_source"
              : "missing",
        effectiveAt:
          latestAmendment
            ?.effectiveDateIso ??
          null,
        sourceRefs:
          latestAmendment
            ?.revisedContractValue
            .value
            ? latestAmendment
                .sourceRefs
            : main
              ? [
                  contractRef(
                    main.documentId,
                  ),
                ]
              : [],
        method:
          latestAmendment
            ?.revisedContractValue
            .value
            ? "latest amendment precedence"
            : "main contract",
      }),
    commencementDateIso:
      fact({
        value:
          commencement,
        unit: "date",
        authority:
          commencement
            ? "official"
            : "missing",
        sourceRefs:
          main
            ? [
                contractRef(
                  main.documentId,
                ),
              ]
            : [],
        method:
          "main contract commencement date",
      }),
    originalCompletionIso:
      fact({
        value:
          originalCompletion,
        unit: "date",
        authority:
          originalCompletion
            ? "official"
            : "missing",
        sourceRefs:
          main
            ? [
                contractRef(
                  main.documentId,
                ),
              ]
            : [],
        method:
          "main contract original completion",
      }),
    revisedCompletionIso:
      fact({
        value:
          latestAmendment
            ?.revisedCompletionIso
            .value ??
          originalCompletion,
        unit: "date",
        authority:
          latestAmendment
            ?.revisedCompletionIso
            .value
            ? "official"
            : originalCompletion
              ? "governed_source"
              : "missing",
        effectiveAt:
          latestAmendment
            ?.effectiveDateIso ??
          null,
        sourceRefs:
          latestAmendment
            ?.revisedCompletionIso
            .value
            ? latestAmendment
                .sourceRefs
            : main
              ? [
                  contractRef(
                    main.documentId,
                  ),
                ]
              : [],
        method:
          latestAmendment
            ?.revisedCompletionIso
            .value
            ? "latest amendment precedence"
            : "main contract",
      }),
    paymentTerms:
      emptyFact(
        "contract.payment_terms",
        null,
        "payment terms require governed clause extraction",
      ),
    retentionPercent:
      fact({
        value:
          numberFromText(
            mainText,
            [
              /retention(?:\s+percentage|\s+rate)?\s*[:\-]?\s*([\d.]+)\s*%/i,
            ],
          ),
        unit: "%",
        authority:
          "candidate",
        sourceRefs:
          main
            ? [
                contractRef(
                  main.documentId,
                ),
              ]
            : [],
        method:
          "contract clause extraction; promote after clause verification",
      }),
    retentionCapPercent:
      fact({
        value:
          numberFromText(
            mainText,
            [
              /retention[^\n]{0,80}?(?:cap|maximum)[^\d]{0,20}([\d.]+)\s*%/i,
            ],
          ),
        unit: "%",
        authority:
          "candidate",
        sourceRefs:
          main
            ? [
                contractRef(
                  main.documentId,
                ),
              ]
            : [],
        method:
          "contract clause extraction; promote after clause verification",
      }),
    ldRatePerDay:
      fact({
        value: ldRate,
        unit:
          ldRate?.currency ??
          null,
        authority:
          ldRate
            ? "candidate"
            : "missing",
        sourceRefs:
          main
            ? [
                contractRef(
                  main.documentId,
                ),
              ]
            : [],
        method:
          "LD extractor candidate until governed clause promotion",
        diagnostics:
          ld?.diagnostics ??
          [],
      }),
    ldCapAmount:
      fact({
        value:
          ldCapAmount,
        unit:
          ldCapAmount
            ?.currency ??
          null,
        authority:
          ldCapAmount
            ? "candidate"
            : "missing",
        sourceRefs:
          main
            ? [
                contractRef(
                  main.documentId,
                ),
              ]
            : [],
        method:
          "LD cap extractor candidate until governed clause promotion",
        diagnostics:
          ld?.diagnostics ??
          [],
      }),
    ldCapPercent:
      fact({
        value:
          ld?.cap?.percent ??
          null,
        unit: "%",
        authority:
          ld?.cap?.percent !==
            null &&
          ld?.cap?.percent !==
            undefined
            ? "candidate"
            : "missing",
        sourceRefs:
          main
            ? [
                contractRef(
                  main.documentId,
                ),
              ]
            : [],
        method:
          "LD cap extractor candidate until governed clause promotion",
      }),
    noticeTerms,
    instruments: [],
    amendments:
      amendmentRows,
    precedence: [
      "latest effective amendment overrides only explicitly amended terms",
      "unamended main-contract terms remain in force",
      "appendices do not replace contract terms unless precedence is established",
    ],
    diagnostics: [
      ...(mainValueExtraction
        ?.diagnostics ??
        []),
      ...(ld?.diagnostics ??
        []),
    ],
  };
}

function parseEvm(
  state: ProjectRuntimeState,
): EvmSnapshot | null {
  const documents =
    activeEvidence(
      state,
      [
        "cost_evm_report",
      ],
      [/^cost0?1[_-]/i],
    );
  const document =
    documents.at(-1) ??
    null;
  if (!document) return null;
  const rows =
    readCsv(document);
  if (!rows ||
      rows.length < 2) {
    return null;
  }
  const headers =
    rows[0] ?? [];
  const metricIndex =
    findColumn(
      headers,
      ["metric"],
    );
  const valueIndex =
    findColumn(
      headers,
      ["value"],
    );
  const unitIndex =
    findColumn(
      headers,
      [
        "currency unit",
        "currency",
        "unit",
      ],
    );
  const dataDateIndex =
    findColumn(
      headers,
      ["data date"],
    );
  const authorityIndex =
    findColumn(
      headers,
      ["authority"],
    );
  const map =
    new Map<
      string,
      {
        value: number;
        unit: string;
        dataDate: string | null;
        authority: string;
        row: number;
      }
    >();
  for (
    let index = 1;
    index < rows.length;
    index += 1
  ) {
    const row =
      rows[index] ?? [];
    const metric =
      norm(
        cell(
          row,
          metricIndex,
        ),
      );
    const value =
      numeric(
        cell(
          row,
          valueIndex,
        ),
      );
    if (!metric ||
        value === null) {
      continue;
    }
    map.set(
      metric,
      {
        value,
        unit:
          cell(
            row,
            unitIndex,
          ),
        dataDate:
          dateIso(
            cell(
              row,
              dataDateIndex,
            ),
          ),
        authority:
          cell(
            row,
            authorityIndex,
          ),
        row: index + 1,
      },
    );
  }
  const entry = (
    key: string,
  ) => map.get(norm(key)) ??
    null;
  const currency =
    [
      "bac",
      "pv",
      "ev",
      "ac",
      "etc",
      "eac",
      "vac",
    ]
      .map(
        (key) =>
          entry(key)?.unit,
      )
      .find(
        (value) =>
          /^[A-Z]{3}$/i.test(
            value ?? "",
          ),
      )
      ?.toUpperCase() ??
    null;
  const dataDate =
    [...map.values()]
      .map(
        (item) =>
          item.dataDate,
      )
      .find(Boolean) ??
    null;
  const source = (
    item:
      ReturnType<
        typeof entry
      >,
  ) =>
    item
      ? [
          sourceRef(
            document.documentId,
            "row:" +
              item.row,
          ),
        ]
      : [];

  const moneyFact = (
    key: string,
  ) => {
    const item =
      entry(key);
    return fact<MoneyAmount>({
      value:
        item &&
        currency
          ? money(
              item.value,
              currency,
              "exclusive",
            )
          : null,
      unit: currency,
      authority:
        item
          ? "governed_source"
          : "missing",
      effectiveAt:
        item?.dataDate ??
        null,
      sourceRefs:
        source(item),
      method:
        "documented EVM source metric",
    });
  };
  const ratioFact = (
    key: string,
  ) => {
    const item =
      entry(key);
    return fact<number>({
      value:
        item?.value ??
        null,
      unit: "ratio",
      authority:
        item
          ? "governed_source"
          : "missing",
      effectiveAt:
        item?.dataDate ??
        null,
      sourceRefs:
        source(item),
      method:
        "documented EVM source metric",
    });
  };

  return {
    dataDateIso:
      dataDate,
    currency,
    bac:
      moneyFact("BAC"),
    pv:
      moneyFact("PV"),
    ev:
      moneyFact("EV"),
    ac:
      moneyFact("AC"),
    spi:
      ratioFact("SPI"),
    cpi:
      ratioFact("CPI"),
    etc:
      moneyFact("ETC"),
    eac:
      moneyFact("EAC"),
    vac:
      moneyFact("VAC"),
    sourceRefs: [
      sourceRef(
        document.documentId,
      ),
    ],
    diagnostics: [],
  };
}

function parsePayments(
  state: ProjectRuntimeState,
  currency: string | null,
  vatBasis:
    MoneyAmount["vatBasis"],
): PaymentCertificateRecord[] {
  const document =
    activeEvidence(
      state,
      [
        "payment_certificates",
      ],
      [/^pay0?1[_-]/i],
    ).at(-1) ??
    null;
  if (!document) return [];
  const rows =
    readCsv(document);
  if (!rows ||
      rows.length < 2) {
    return [];
  }
  const headers =
    rows[0] ?? [];
  const idIndex =
    findColumn(
      headers,
      [
        "certificate no",
        "certificate",
        "ipc no",
      ],
    );
  const certificateDateIndex =
    findColumn(
      headers,
      ["certificate date"],
    );
  const grossIndex =
    findColumn(
      headers,
      ["gross certified"],
    );
  const retentionIndex =
    findColumn(
      headers,
      ["retention withheld"],
    );
  const recoveryIndex =
    findColumn(
      headers,
      ["advance recovery"],
    );
  const otherIndex =
    findColumn(
      headers,
      ["other deductions"],
    );
  const netIndex =
    findColumn(
      headers,
      ["net certified"],
    );
  const statusIndex =
    findColumn(
      headers,
      ["status"],
    );
  const currencyValue =
    currency ??
    "UNSPECIFIED";

  const toMoney = (
    row: string[],
    index: number,
  ) => {
    const value =
      numeric(
        cell(
          row,
          index,
        ),
      );
    return value === null
      ? null
      : money(
          value,
          currencyValue,
          vatBasis,
        );
  };

  return rows
    .slice(1)
    .map(
      (row, offset) => {
        const id =
          cell(
            row,
            idIndex,
          );
        if (!id) return null;
        const status =
          norm(
            cell(
              row,
              statusIndex,
            ),
          );
        const net =
          toMoney(
            row,
            netIndex,
          );
        return {
          paymentId: id,
          type:
            /advance/.test(
              status + " " + id.toLowerCase(),
            )
              ? "advance_payment"
              : /retention/.test(
                    status +
                      " " +
                      id.toLowerCase(),
                  )
                ? "retention_release"
                : /final/.test(
                      status +
                        " " +
                        id.toLowerCase(),
                    )
                  ? "final_account"
                  : "ipc",
          applicationDateIso:
            null,
          assessmentDateIso:
            null,
          certificateDateIso:
            dateIso(
              cell(
                row,
                certificateDateIndex,
              ),
            ),
          paymentDueDateIso:
            null,
          paidDateIso: null,
          grossCertified:
            toMoney(
              row,
              grossIndex,
            ),
          retentionWithheld:
            toMoney(
              row,
              retentionIndex,
            ),
          advanceRecovery:
            toMoney(
              row,
              recoveryIndex,
            ),
          otherDeductions:
            toMoney(
              row,
              otherIndex,
            ),
          netCertified: net,
          paidAmount: null,
          outstandingAmount:
            null,
          applicationStageAuthority:
            "missing",
          assessmentStageAuthority:
            "missing",
          certificationStageAuthority:
            net
              ? "certified"
              : "missing",
          receiptStageAuthority:
            "missing",
          sourceRefs: [
            sourceRef(
              document.documentId,
              "row:" +
                (offset + 2),
            ),
          ],
          diagnostics: [
            "APPLICATION_ASSESSMENT_AND_RECEIPT_STAGES_NOT_ESTABLISHED_BY_CERTIFICATE_REGISTER",
          ],
        } satisfies PaymentCertificateRecord;
      },
    )
    .filter(
      (
        value,
      ): value is PaymentCertificateRecord =>
        value !== null,
    );
}

function parseVariations(
  state: ProjectRuntimeState,
  currency: string | null,
  vatBasis:
    MoneyAmount["vatBasis"],
): VariationRecord[] {
  const document =
    activeEvidence(
      state,
      [
        "variation_register",
      ],
      [/^var0?1[_-]/i],
    ).at(-1) ??
    null;
  if (!document) return [];
  const rows =
    readCsv(document);
  if (!rows ||
      rows.length < 2) {
    return [];
  }
  const headers =
    rows[0] ?? [];
  const idIndex =
    findColumn(
      headers,
      ["variation id"],
    );
  const descriptionIndex =
    findColumn(
      headers,
      ["description"],
    );
  const approvalIndex =
    findColumn(
      headers,
      ["approval date"],
    );
  const amountIndex =
    findColumn(
      headers,
      [
        "approved amount",
        "amount",
      ],
    );
  const statusIndex =
    findColumn(
      headers,
      ["status"],
    );
  const authorityIndex =
    findColumn(
      headers,
      ["authority"],
    );
  const currencyValue =
    currency ??
    "UNSPECIFIED";

  return rows
    .slice(1)
    .map(
      (row, offset) => {
        const id =
          cell(
            row,
            idIndex,
          );
        if (!id) return null;
        const status =
          norm(
            cell(
              row,
              statusIndex,
            ),
          );
        const amount =
          numeric(
            cell(
              row,
              amountIndex,
            ),
          );
        const approved =
          status.includes(
            "approved",
          ) ||
          status.includes(
            "agreed",
          ) ||
          status.includes(
            "certified",
          );
        const lifecycleState:
          VariationRecord["lifecycleState"] =
          status.includes(
            "certified",
          )
            ? "certified"
            : status.includes(
                  "approved",
                )
              ? "approved"
              : status.includes(
                    "agreed",
                  )
                ? "agreed"
                : status.includes(
                      "assessed",
                    )
                  ? "assessed"
                  : status.includes(
                        "quoted",
                      )
                    ? "quoted"
                    : status.includes(
                          "rejected",
                        )
                      ? "rejected"
                      : status.includes(
                            "pending",
                          )
                        ? "notified"
                        : "unknown";
        const amountValue =
          amount === null
            ? null
            : money(
                amount,
                currencyValue,
                vatBasis,
              );
        return {
          variationId: id,
          description:
            cell(
              row,
              descriptionIndex,
            ) || null,
          lifecycleState,
          instructionReference:
            null,
          approvalDateIso:
            dateIso(
              cell(
                row,
                approvalIndex,
              ),
            ),
          claimedValue:
            approved
              ? null
              : amountValue,
          assessedValue:
            null,
          agreedValue:
            approved
              ? amountValue
              : null,
          approvedValue:
            approved
              ? amountValue
              : null,
          certifiedValue:
            lifecycleState ===
              "certified"
              ? amountValue
              : null,
          timeImpactDays:
            null,
          authority:
            approved
              ? "approved"
              : "candidate",
          sourceRefs: [
            sourceRef(
              document.documentId,
              "row:" +
                (offset + 2),
            ),
          ],
          diagnostics: [
            "SITE_INSTRUCTION_AND_PAYMENT_LINKAGE_NOT_ESTABLISHED_IN_VARIATION_REGISTER",
          ],
        } satisfies VariationRecord;
      },
    )
    .filter(
      (
        value,
      ): value is VariationRecord =>
        value !== null,
    );
}

function parseCbs(
  state: ProjectRuntimeState,
  currency: string | null,
  vatBasis:
    MoneyAmount["vatBasis"],
  payments:
    PaymentCertificateRecord[],
): {
  cbs: CbsNode[];
  mapping:
    CommercialMappingSummary;
} {
  const document =
    activeEvidence(
      state,
      ["boq"],
      [
        /^b0?1[_-]/i,
        /original[_ -]?boq/i,
      ],
    ).at(-1) ??
    null;
  if (!document) {
    return {
      cbs: [],
      mapping: {
        boqRowCount: 0,
        mappedBoqRowCount: 0,
        unmappedBoqRowCount:
          0,
        paymentRowCount:
          payments.length,
        mappedPaymentRowCount:
          0,
        unmappedPaymentRowCount:
          payments.length,
        wbsCount: 0,
        mappedWbsCount: 0,
        unmappedWbsCount: 0,
        completenessPercent:
          null,
      },
    };
  }
  const rows =
    readCsv(document);
  if (!rows ||
      rows.length < 2) {
    return {
      cbs: [],
      mapping: {
        boqRowCount: 0,
        mappedBoqRowCount: 0,
        unmappedBoqRowCount:
          0,
        paymentRowCount:
          payments.length,
        mappedPaymentRowCount:
          0,
        unmappedPaymentRowCount:
          payments.length,
        wbsCount: 0,
        mappedWbsCount: 0,
        unmappedWbsCount: 0,
        completenessPercent:
          null,
      },
    };
  }
  const headers =
    rows[0] ?? [];
  const codeIndex =
    findColumn(
      headers,
      ["cost code"],
    );
  const descriptionIndex =
    findColumn(
      headers,
      [
        "section",
        "description",
      ],
    );
  const amountIndex =
    findColumn(
      headers,
      ["amount"],
    );
  const currencyValue =
    currency ??
    "UNSPECIFIED";
  const groups =
    new Map<
      string,
      {
        description:
          string | null;
        amount: number;
        rows: number;
        refs:
          CommercialSourceRef[];
      }
    >();
  let boqRowCount = 0;
  let mappedBoqRowCount = 0;
  for (
    let index = 1;
    index < rows.length;
    index += 1
  ) {
    const row =
      rows[index] ?? [];
    if (
      !row.some(
        (value) =>
          value.trim(),
      )
    ) continue;
    boqRowCount += 1;
    const code =
      cell(
        row,
        codeIndex,
      );
    if (!code) continue;
    mappedBoqRowCount += 1;
    const amount =
      numeric(
        cell(
          row,
          amountIndex,
        ),
      ) ?? 0;
    const existing =
      groups.get(code) ??
      {
        description:
          cell(
            row,
            descriptionIndex,
          ) || null,
        amount: 0,
        rows: 0,
        refs: [],
      };
    existing.amount +=
      amount;
    existing.rows += 1;
    if (
      existing.refs.length <
      5
    ) {
      existing.refs.push(
        sourceRef(
          document.documentId,
          "row:" +
            (index + 1),
        ),
      );
    }
    groups.set(
      code,
      existing,
    );
  }

  const cbs =
    [...groups.entries()]
      .map(
        ([code, value]) => ({
          cbsCode: code,
          parentCbsCode:
            null,
          description:
            value.description,
          source: "boq" as const,
          budget:
            money(
              Number(
                value.amount.toFixed(
                  6,
                ),
              ),
              currencyValue,
              vatBasis,
            ),
          commitment: null,
          certified: null,
          paid: null,
          actual: null,
          etc: null,
          eac: null,
          vac: null,
          sourceRefs:
            value.refs,
        }),
      );

  const wbsCount =
    state.schedules
      .filter(
        (item) =>
          item.role !==
          "recovery",
      )
      .at(-1)
      ?.revision.model.wbs
      .length ??
    0;
  const mappedPaymentRows =
    payments.filter(
      () => false,
    ).length;
  const mappedWbsCount = 0;
  const denominator =
    boqRowCount +
    payments.length +
    wbsCount;
  const numerator =
    mappedBoqRowCount +
    mappedPaymentRows +
    mappedWbsCount;

  return {
    cbs,
    mapping: {
      boqRowCount,
      mappedBoqRowCount,
      unmappedBoqRowCount:
        boqRowCount -
        mappedBoqRowCount,
      paymentRowCount:
        payments.length,
      mappedPaymentRowCount:
        mappedPaymentRows,
      unmappedPaymentRowCount:
        payments.length -
        mappedPaymentRows,
      wbsCount,
      mappedWbsCount,
      unmappedWbsCount:
        wbsCount -
        mappedWbsCount,
      completenessPercent:
        denominator > 0
          ? Number(
              (
                (
                  numerator /
                  denominator
                ) *
                100
              ).toFixed(4),
            )
          : null,
    },
  };
}

function deriveCashFlow(
  payments:
    PaymentCertificateRecord[],
): CashFlowPeriod[] {
  return payments
    .filter(
      (payment) =>
        payment.certificateDateIso &&
        payment.netCertified,
    )
    .map(
      (payment) => ({
        periodStartIso:
          payment
            .certificateDateIso,
        currency:
          payment
            .netCertified!
            .currency,
        budget: null,
        forecast: null,
        certifiedIncome:
          payment
            .netCertified!
            .amount,
        paidIncome: null,
        actualExpenditure:
          null,
        sourceRefs:
          payment.sourceRefs,
      }),
    );
}

export function buildCommercialCanonicalModel(
  state: ProjectRuntimeState,
  dataDateIso: string | null,
): CommercialCanonicalModel {
  const terms =
    buildTerms(state);
  const currency =
    terms.currentContractValue
      .value?.currency ??
    terms.originalContractValue
      .value?.currency ??
    terms.currency.value ??
    null;
  const vatBasis:
    MoneyAmount["vatBasis"] =
    terms.vatBasis.value ??
    "not_stated";
  const evm =
    parseEvm(state);
  const payments =
    parsePayments(
      state,
      currency,
      vatBasis,
    );
  const variations =
    parseVariations(
      state,
      currency,
      vatBasis,
    );
  const {
    cbs,
    mapping,
  } =
    parseCbs(
      state,
      currency,
      vatBasis,
      payments,
    );
  const cashFlow =
    deriveCashFlow(
      payments,
    );
  const currencies = [
    ...new Set(
      [
        currency,
        evm?.currency ??
          null,
        ...payments
          .map(
            (payment) =>
              payment
                .netCertified
                ?.currency ??
              null,
          ),
        ...variations
          .map(
            (variation) =>
              variation
                .approvedValue
                ?.currency ??
              variation
                .claimedValue
                ?.currency ??
              null,
          ),
      ].filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      ),
    ),
  ];
  const sourceDocumentIds =
    [...new Set([
      ...state
        .contractDocuments
        .map(
          (document) =>
            document.documentId,
        ),
      ...activeEvidence(
        state,
        [
          "cost_evm_report",
          "payment_certificates",
          "variation_register",
          "boq",
        ],
      ).map(
        (document) =>
          document.documentId,
      ),
    ])];

  const commitments:
    CommitmentRecord[] = [];
  const accruals:
    AccrualRecord[] = [];

  return {
    schemaVersion: "1.0",
    projectId:
      state.projectId,
    dataDateIso,
    terms,
    evm,
    cbs,
    payments,
    variations,
    commitments,
    accruals,
    cashFlow,
    mapping,
    currencies,
    sourceDocumentIds,
    diagnostics: [
      ...(currencies.length > 1
        ? [
            "MULTI_CURRENCY_PRESENT_NO_FX_CONVERSION_APPLIED",
          ]
        : []),
      ...(payments.length > 0 &&
      payments.every(
        (payment) =>
          payment.paidAmount ===
          null,
      )
        ? [
            "PAYMENT_CERTIFICATES_ESTABLISHED_BUT_CASH_RECEIPTS_NOT_ESTABLISHED",
          ]
        : []),
      ...(commitments.length === 0
        ? [
            "COMMITMENT_REGISTER_NOT_ESTABLISHED",
          ]
        : []),
      ...(accruals.length === 0
        ? [
            "ACCRUAL_REGISTER_NOT_ESTABLISHED",
          ]
        : []),
    ],
  };
}
