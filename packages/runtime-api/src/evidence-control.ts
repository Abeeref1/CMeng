import type {
  EvidenceBasisEffect,
  EvidenceBasisRecord,
  EvidenceBasisState,
  EvidenceFamilyBehavior,
  EvidenceUploadIntent,
  ProjectRuntimeState,
  StoredEvidenceDocument,
  StoredScheduleRevision,
} from "./project-state-types";

function norm(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function documentIdentifier(
  documentType: string,
  text: string,
  filename: string,
): string | null {
  const corpus =
    text + "\n" + filename;
  const patterns: Array<
    [string, RegExp]
  > = [
    [
      "amendment",
      /\b(?:contract\s+)?amendment\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9._/-]+)/i,
    ],
    [
      "vo",
      /\bvo\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9._/-]*\d[A-Z0-9._/-]*)/i,
    ],
    [
      "vo",
      /\b(?:variation\s+order|change\s+order)\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9._/-]*\d[A-Z0-9._/-]*)/i,
    ],
    [
      "vo",
      /\b(?:vo|variation\s+order|change\s+order)\s*[:\-]?\s*([A-Z0-9._/-]*\d[A-Z0-9._/-]*)/i,
    ],
    [
      "payment",
      /\b(?:payment\s+certificate|certificate)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9._/-]+)/i,
    ],
    [
      "letter",
      /\b(?:letter|ref(?:erence)?)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9._/-]+)/i,
    ],
    [
      "notice",
      /\bnotice\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9._/-]+)/i,
    ],
    [
      "claim",
      /\bclaim\s*(?:id|no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9._/-]+)/i,
    ],
    [
      "meeting",
      /\b(?:meeting\s+minutes|minutes\s+of\s+meeting|mom)\b[^\n]{0,80}?\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})\b/i,
    ],
  ];

  for (const [prefix, regex] of patterns) {
    const match = regex.exec(corpus);
    if (match?.[1]) {
      return (
        prefix +
        ":" +
        norm(match[1])
          .replace(/\s+/g, "-")
      );
    }
  }

  if (
    documentType ===
      "variation_order" ||
    documentType ===
      "payment_certificate" ||
    documentType ===
      "letters_notices" ||
    documentType ===
      "meeting_minutes"
  ) {
    const base =
      filename
        .toLowerCase()
        .replace(/\.[^.]+$/, "")
        .replace(
          /(?:rev(?:ision)?|r)\s*[-_. ]*\d+\b/gi,
          "",
        )
        .replace(
          /[^a-z0-9]+/g,
          "-",
        )
        .replace(
          /^-+|-+$/g,
          "",
        );
    return base
      ? documentType +
          ":" +
          base
      : null;
  }

  return null;
}

export function evidenceFamily(
  input: {
    category: string;
    documentType: string;
    scheduleRole:
      | StoredScheduleRevision["role"]
      | null;
    textSample: string;
    sourceFilename: string;
  },
): {
  familyKey: string;
  behavior: EvidenceFamilyBehavior;
  logicalDocumentKey: string;
} {
  const {
    category,
    documentType,
    scheduleRole,
    textSample,
    sourceFilename,
  } = input;

  if (category === "schedule") {
    if (scheduleRole === "recovery") {
      return {
        familyKey:
          "schedule:recovery",
        behavior:
          "schedule_special",
        logicalDocumentKey:
          "schedule:recovery:" +
          norm(sourceFilename),
      };
    }
    if (scheduleRole === "baseline") {
      return {
        familyKey:
          "schedule:baseline",
        behavior:
          "schedule_special",
        logicalDocumentKey:
          "schedule:baseline",
      };
    }
    return {
      familyKey:
        "schedule:control",
      behavior:
        "schedule_special",
      logicalDocumentKey:
        "schedule:control",
    };
  }

  if (
    category === "boq_cost" &&
    documentType === "boq"
  ) {
    return {
      familyKey: "boq:quantity",
      behavior: "boq_special",
      logicalDocumentKey:
        "boq:quantity",
    };
  }

  if (
    documentType ===
      "contract_amendment"
  ) {
    return {
      familyKey:
        "contract:amendments",
      behavior:
        "contract_delta",
      logicalDocumentKey:
        documentIdentifier(
          documentType,
          textSample,
          sourceFilename,
        ) ??
        "contract:amendment:" +
          norm(
            sourceFilename.replace(
              /(?:rev(?:ision)?|r)\s*[-_. ]*\d+\b/gi,
              "",
            ),
          ),
    };
  }

  if (
    documentType ===
      "contract_replacement"
  ) {
    return {
      familyKey: "contract:base",
      behavior:
        "contract_replacement",
      logicalDocumentKey:
        "contract:base",
    };
  }

  if (
    documentType ===
      "main_contract"
  ) {
    return {
      familyKey: "contract:base",
      behavior:
        "contract_replacement",
      logicalDocumentKey:
        "contract:base",
    };
  }

  const additive =
    new Set([
      "variation_order",
      "letters_notices",
      "meeting_minutes",
      "notice",
      "claim_notice",
      "correspondence",
    ]);

  if (
    additive.has(documentType) ||
    category ===
      "correspondence"
  ) {
    return {
      familyKey:
        documentType ===
          "variation_order"
          ? "commercial:variations"
          : category +
            ":" +
            documentType,
      behavior: "additive",
      logicalDocumentKey:
        documentIdentifier(
          documentType,
          textSample,
          sourceFilename,
        ) ??
        category +
          ":" +
          documentType +
          ":" +
          norm(sourceFilename),
    };
  }

  const snapshotTypes =
    new Set([
      "risk_register",
      "procurement_register",
      "rfi_register",
      "submittal_register",
      "design_deliverables",
      "quality_ncr_register",
      "asset_register",
      "testing_commissioning_register",
      "cost_evm_report",
      "payment_certificates",
      "variation_register",
      "delay_eot_claims_register",
      "contractor_manpower_plan",
      "schedule_metric_register",
      "schedule_activity_comparison",
      "longest_path_register",
      "resource_register",
      "wbs_dictionary",
      "obs_responsibility_matrix",
      "project_data_book",
      "hse_report",
    ]);

  if (
    snapshotTypes.has(
      documentType,
    )
  ) {
    return {
      familyKey:
        category +
        ":" +
        documentType,
      behavior: "snapshot",
      logicalDocumentKey:
        category +
        ":" +
        documentType,
    };
  }

  return {
    familyKey:
      category +
      ":" +
      documentType,
    behavior: "reference",
    logicalDocumentKey:
      category +
      ":" +
      documentType +
      ":" +
      norm(sourceFilename),
  };
}

function revisionHint(
  document:
    StoredEvidenceDocument,
): {
  revision: number | null;
  date: string | null;
} {
  const text = [
    document.sourceFilename,
    document.sourceRelativePath ??
      "",
    document.identification
      .detectedTitle ??
      "",
  ].join(" ");

  const rev =
    /(?:^|[^A-Za-z0-9])(?:rev(?:ision)?|r)\s*[-_. ]*0*(\d{1,6})(?=$|[^A-Za-z0-9])/i.exec(
      text,
    );
  const isoDate =
    /(?:^|[^0-9])(20\d{2})[-_. ]?(0[1-9]|1[0-2])[-_. ]?([0-2]\d|3[01])(?=$|[^0-9])/.exec(
      text,
    );

  return {
    revision:
      rev?.[1]
        ? Number(
            rev[1],
          )
        : null,
    date:
      isoDate
        ? [
            isoDate[1],
            isoDate[2],
            isoDate[3],
          ].join("-")
        : null,
  };
}

function snapshotComparison(
  current:
    StoredEvidenceDocument | null,
  incoming:
    StoredEvidenceDocument,
): {
  promote: boolean;
  reason: string;
} {
  if (!current) {
    return {
      promote: true,
      reason:
        "First established snapshot becomes active.",
    };
  }

  const before =
    revisionHint(current);
  const after =
    revisionHint(incoming);

  if (
    before.revision !== null &&
    after.revision !== null
  ) {
    return {
      promote:
        after.revision >
        before.revision,
      reason:
        after.revision >
        before.revision
          ? "Incoming snapshot has a higher explicit revision number."
          : "Incoming snapshot does not have a higher explicit revision number and is retained as candidate/history.",
    };
  }

  if (
    before.date !== null &&
    after.date !== null
  ) {
    return {
      promote:
        after.date >
        before.date,
      reason:
        after.date >
        before.date
          ? "Incoming snapshot has a later explicit document date."
          : "Incoming snapshot does not have a later explicit document date and is retained as candidate/history.",
    };
  }

  if (
    before.revision === null &&
    after.revision !== null
  ) {
    return {
      promote: true,
      reason:
        "Incoming snapshot carries an explicit revision number while the current basis did not.",
    };
  }

  if (
    before.date === null &&
    after.date !== null
  ) {
    return {
      promote: true,
      reason:
        "Incoming snapshot carries an explicit document date while the current basis did not.",
    };
  }

  return {
    promote: false,
    reason:
      "Relative snapshot chronology cannot be proven from document content/metadata. Add/Update retains the file as candidate; use Replace to promote it explicitly.",
  };
}

function scheduleComparison(
  state: ProjectRuntimeState,
  current:
    StoredEvidenceDocument | null,
  incoming:
    StoredEvidenceDocument,
): {
  promote: boolean;
  reason: string;
} {
  if (!current) {
    return {
      promote: true,
      reason:
        "First control schedule for the family becomes active.",
    };
  }

  const currentRevision =
    state.schedules.find(
      (item) =>
        item.revision
          .revisionId ===
        current.linkedArtifactId,
    );
  const incomingRevision =
    state.schedules.find(
      (item) =>
        item.revision
          .revisionId ===
        incoming.linkedArtifactId,
    );

  const before =
    currentRevision
      ?.revision.model
      .dataDateIso ??
    currentRevision
      ?.revision.effectiveAt ??
    null;
  const after =
    incomingRevision
      ?.revision.model
      .dataDateIso ??
    incomingRevision
      ?.revision.effectiveAt ??
    null;

  if (
    before &&
    after
  ) {
    return {
      promote:
        after > before,
      reason:
        after > before
          ? "Incoming control schedule has a later Data Date/effective date."
          : "Incoming control schedule is not later than the active control schedule and remains historical/candidate.",
    };
  }

  return snapshotComparison(
    current,
    incoming,
  );
}

function markSuperseded(
  state: ProjectRuntimeState,
  documentId: string,
  supersededByDocumentId: string,
): void {
  const document =
    state.evidenceDocuments.find(
      (item) =>
        item.documentId ===
        documentId,
    );
  if (!document) return;
  document.basisState =
    "superseded";
  document.supersededByDocumentId =
    supersededByDocumentId;
}

function activeDocument(
  state: ProjectRuntimeState,
  familyKey: string,
): StoredEvidenceDocument | null {
  const id =
    state.activeEvidenceBasis[
      familyKey
    ]?.activeDocumentId ??
    null;
  if (!id) return null;
  return (
    state.evidenceDocuments.find(
      (item) =>
        item.documentId === id,
    ) ?? null
  );
}

function updateBasisRecord(
  state: ProjectRuntimeState,
  input: {
    document: StoredEvidenceDocument;
    familyKey: string;
    behavior: EvidenceFamilyBehavior;
    reason: string;
    previousActiveDocumentId:
      string | null;
  },
): void {
  const prior =
    state.activeEvidenceBasis[
      input.familyKey
    ];
  const history =
    new Set([
      ...(prior
        ?.previousDocumentIds ??
        []),
      ...(input.previousActiveDocumentId
        ? [
            input
              .previousActiveDocumentId,
          ]
        : []),
    ]);
  state.activeEvidenceBasis[
    input.familyKey
  ] = {
    familyKey:
      input.familyKey,
    behavior:
      input.behavior,
    activeDocumentId:
      input.document.documentId,
    activeArtifactId:
      input.document
        .linkedArtifactId,
    updatedAt:
      input.document.uploadedAt,
    reason: input.reason,
    previousDocumentIds: [
      ...history,
    ],
  };
}

export function applyEvidenceBasis(
  state: ProjectRuntimeState,
  document: StoredEvidenceDocument,
  intent: EvidenceUploadIntent,
): EvidenceBasisEffect {
  const familyKey =
    document.familyKey;
  const behavior =
    evidenceFamily({
      category:
        document.category,
      documentType:
        document.documentType,
      scheduleRole:
        document.scheduleRole,
      textSample:
        document.assertions
          .map(
            (assertion) =>
              assertion.sourceText,
          )
          .join("\n"),
      sourceFilename:
        document.sourceFilename,
    }).behavior;

  const current =
    activeDocument(
      state,
      familyKey,
    );
  const previousActiveDocumentId =
    current?.documentId ??
    null;

  const result = (
    basisState: EvidenceBasisState,
    changedActiveBasis: boolean,
    reason: string,
  ): EvidenceBasisEffect => ({
    familyKey,
    behavior,
    intent,
    logicalDocumentKey:
      document.logicalDocumentKey,
    basisState,
    previousActiveDocumentId,
    activeDocumentId:
      changedActiveBasis
        ? document.documentId
        : state.activeEvidenceBasis[
            familyKey
          ]?.activeDocumentId ??
          null,
    changedActiveBasis,
    reason,
  });

  if (
    behavior ===
      "schedule_special" &&
    document.scheduleRole ===
      "recovery"
  ) {
    document.basisState =
      "scenario";
    return result(
      "scenario",
      false,
      "Recovery schedule retained as scenario; current control programme is unchanged.",
    );
  }

  if (
    behavior ===
    "contract_delta"
  ) {
    const priorVersion =
      state.evidenceDocuments
        .filter(
          (item) =>
            item.documentId !==
              document.documentId &&
            item.familyKey ===
              familyKey &&
            item.logicalDocumentKey ===
              document
                .logicalDocumentKey &&
            item.basisState !==
              "superseded",
        )
        .sort(
          (a, b) =>
            a.uploadedAt.localeCompare(
              b.uploadedAt,
            ),
        )
        .at(-1);

    if (
      intent ===
        "replace_current_basis" &&
      priorVersion
    ) {
      markSuperseded(
        state,
        priorVersion.documentId,
        document.documentId,
      );
      document.supersedesDocumentIds =
        [
          ...new Set([
            ...document
              .supersedesDocumentIds,
            priorVersion
              .documentId,
          ]),
        ];
    }
    document.basisState =
      "additive";
    return result(
      "additive",
      false,
      "Contract amendment is additive/delta evidence and does not replace the contract family.",
    );
  }

  if (behavior === "additive") {
    const priorVersion =
      state.evidenceDocuments
        .filter(
          (item) =>
            item.documentId !==
              document.documentId &&
            item.familyKey ===
              familyKey &&
            item.logicalDocumentKey ===
              document
                .logicalDocumentKey &&
            item.basisState !==
              "superseded",
        )
        .sort(
          (a, b) =>
            a.uploadedAt.localeCompare(
              b.uploadedAt,
            ),
        )
        .at(-1);

    if (
      intent ===
        "replace_current_basis" &&
      priorVersion
    ) {
      markSuperseded(
        state,
        priorVersion.documentId,
        document.documentId,
      );
      document.supersedesDocumentIds =
        [
          ...new Set([
            ...document
              .supersedesDocumentIds,
            priorVersion
              .documentId,
          ]),
        ];
    }
    document.basisState =
      "additive";
    return result(
      "additive",
      false,
      priorVersion &&
      intent ===
        "replace_current_basis"
        ? "Only the earlier revision of the same logical additive document was superseded; the rest of the family remains cumulative."
        : "Additive evidence appended to the cumulative family.",
    );
  }

  if (behavior === "reference") {
    document.basisState =
      "historical";
    return result(
      "historical",
      false,
      "Reference evidence is retained without replacing another evidence family.",
    );
  }

  let promote = false;
  let reason = "";
  const replaceIntent =
    intent ===
    "replace_current_basis";

  if (!current) {
    promote = true;
    reason =
      "First established evidence for this family becomes the active basis.";
  } else if (
    replaceIntent
  ) {
    promote = true;
    reason =
      "User selected Replace current basis for this matching evidence family.";
  } else if (
    behavior ===
      "snapshot"
  ) {
    const comparison =
      snapshotComparison(
        current,
        document,
      );
    promote =
      comparison.promote;
    reason =
      comparison.reason;
  } else if (
    behavior ===
      "schedule_special"
  ) {
    if (
      document.scheduleRole ===
        "update"
    ) {
      const comparison =
        scheduleComparison(
          state,
          current,
          document,
        );
      promote =
        comparison.promote;
      reason =
        comparison.reason;
    } else if (
      document.scheduleRole ===
        "revised_baseline"
    ) {
      promote =
        replaceIntent;
      reason = promote
        ? "Revised baseline explicitly promoted by Replace intent."
        : "Revised baseline retained as candidate until explicitly promoted/effective.";
    } else if (
      document.scheduleRole ===
        "baseline"
    ) {
      const comparison =
        scheduleComparison(
          state,
          current,
          document,
        );
      promote =
        familyKey ===
          "schedule:baseline" &&
        comparison.promote;
      reason =
        comparison.reason;
    } else {
      promote = false;
      reason =
        "Schedule role is not eligible to replace the active control programme automatically.";
    }
  } else if (
    behavior ===
      "boq_special"
  ) {
    promote =
      replaceIntent;
    reason =
      "Later BOQ revisions remain candidate evidence unless explicitly promoted with Replace intent.";
  } else if (
    behavior ===
      "contract_replacement"
  ) {
    promote =
      !current ||
      replaceIntent;
    reason = promote
      ? "Contract base established/promoted for this family."
      : "Replacement/restated contract retained as candidate until explicitly promoted.";
  }

  if (promote) {
    if (
      previousActiveDocumentId &&
      previousActiveDocumentId !==
        document.documentId
    ) {
      markSuperseded(
        state,
        previousActiveDocumentId,
        document.documentId,
      );
      document.supersedesDocumentIds =
        [
          ...new Set([
            ...document
              .supersedesDocumentIds,
            previousActiveDocumentId,
          ]),
        ];
    }
    document.basisState =
      "active";
    updateBasisRecord(
      state,
      {
        document,
        familyKey,
        behavior,
        reason,
        previousActiveDocumentId,
      },
    );
    return result(
      "active",
      previousActiveDocumentId !==
        document.documentId,
      reason,
    );
  }

  document.basisState =
    "candidate";
  return result(
    "candidate",
    false,
    reason ||
      "Evidence retained as candidate without changing the active family basis.",
  );
}


export function rebuildEvidenceFamily(
  state: ProjectRuntimeState,
  familyKey: string,
): void {
  const documents =
    state.evidenceDocuments
      .filter(
        (document) =>
          document.familyKey ===
          familyKey,
      )
      .sort((a, b) => {
        const byTime =
          a.uploadedAt.localeCompare(
            b.uploadedAt,
          );
        return byTime !== 0
          ? byTime
          : a.documentId.localeCompare(
              b.documentId,
            );
      });

  delete state.activeEvidenceBasis[
    familyKey
  ];

  for (const document of documents) {
    document.basisState =
      "candidate";
    document.supersededByDocumentId =
      null;
    document.supersedesDocumentIds =
      [];
  }

  for (const document of documents) {
    applyEvidenceBasis(
      state,
      document,
      document.uploadIntent,
    );
  }
}
