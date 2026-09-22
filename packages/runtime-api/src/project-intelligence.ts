import {
  directorForProject,
  moduleForProject,
  overviewForProject,
} from "./project-projections";

type ModuleSelection = {
  key: string;
  status: "ready" | "partial" | "blocked";
  reason: string | null;
};

function relevantKeys(
  question: string,
): string[] {
  const q = question.toLowerCase();
  const keys = new Set<string>();

  const add = (...values: string[]) =>
    values.forEach((value) => keys.add(value));

  if (
    /delay|eot|extension|claim|notice|window|concurr/.test(q)
  ) {
    add(
      "delay-claims",
      "notices-claims",
      "windows-analysis",
      "eot-assessment",
    );
  }
  if (
    /progress|slippage|variance|behind|ahead|s[- ]?curve/.test(q)
  ) {
    add(
      "progress-report",
      "progress-scurve",
      "progress-breakdown",
      "variance-trends",
    );
  }
  if (
    /forecast|finish|completion|p50|p80|p90/.test(q)
  ) {
    add(
      "independent-forecast",
      "forecast-history",
    );
  }
  if (
    /change|revision|update|baseline|programme|schedule/.test(q)
  ) {
    add(
      "schedule-analytics",
      "schedule-change-report",
      "revision-trend",
    );
  }
  if (
    /critical|near critical|float|driving path/.test(q)
  ) {
    add(
      "schedule-analytics",
      "near-critical",
      "activity-analytics",
    );
  }
  if (
    /resource|manpower|labou?r|man[- ]?hour|crew/.test(q)
  ) {
    add(
      "resource-utilization",
      "manhour-scurve",
      "lookahead-schedule",
    );
  }
  if (
    /contract|commercial|ld|liquidated|exposure|variation/.test(q)
  ) {
    add(
      "challenge-contract",
      "notices-claims",
      "eot-assessment",
    );
  }
  if (
    /lookahead|readiness|permit|material|submittal|rfi/.test(q)
  ) {
    add("lookahead-schedule");
  }

  if (keys.size === 0) {
    add(
      "pmo-analysis",
      "progress-report",
      "independent-forecast",
      "windows-analysis",
      "challenge-contract",
    );
  }

  return [...keys];
}

function scalarFacts(
  value: unknown,
  path = "",
  depth = 0,
): Array<{
  path: string;
  value: string | number | boolean | null;
}> {
  if (
    depth > 6 ||
    value === undefined
  ) {
    return [];
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return path
      ? [{
          path,
          value,
        }]
      : [];
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 5)
      .flatMap((item, index) =>
        scalarFacts(
          item,
          path + "[" + index + "]",
          depth + 1,
        ),
      );
  }
  if (typeof value === "object") {
    return Object.entries(
      value as Record<string, unknown>,
    )
      .filter(([key])=>!['schemaVersion','projectionKey','producerVersion','generatedAt','sourceRevisionId','sourceProjections','sourceLedger','source','futureRows','undatedRows','claimsReporting','reportingContract','diagnostics','receipts','basis','sourceRefs','controlBasis','population','populationContract','challenge','systemEvidenceContract'].includes(key))
      .slice(0, 24)
      .flatMap(([key, child]) =>
        scalarFacts(
          child,
          path
            ? path + "." + key
            : key,
          depth + 1,
        ),
      );
  }
  return [];
}

function projectControlName(
  key: string,
): string {
  const names: Record<string, string> = {
    "pmo-analysis":
      "Management Position",
    "schedule-analytics":
      "Programme Review",
    "activity-analytics":
      "Activity Review",
    "resource-utilization":
      "Resources",
    "lookahead-schedule":
      "Look-Ahead",
    "progress-report":
      "Progress Position",
    "schedule-change-report":
      "Programme Changes",
    "revision-trend":
      "Revision History",
    "variance-trends":
      "Variance Trend",
    "progress-scurve":
      "Progress S-Curve",
    "quantity-scurve":
      "Installed Quantities",
    "progress-breakdown":
      "WBS Progress",
    milestones:
      "Milestones",
    "near-critical":
      "Near-Critical Activities",
    "manhour-scurve":
      "Man-Hour S-Curve",
    "forecast-history":
      "Completion Forecast History",
    "independent-forecast":
      "CMeng Completion Forecast",
    "delay-claims":
      "Delay Events & Claims",
    "notices-claims":
      "Notices, EOT & Claims",
    "windows-analysis":
      "Delay Windows",
    "eot-assessment":
      "EOT Position",
    "challenge-contract":
      "Challenge the Contract",
  };
  return names[key] ?? key;
}

function factLabel(
  path: string,
): string {
  const exact:
    Record<string, string> = {
      "overview.latestDataDateIso":
        "Current data date",
      "overview.evidenceDocumentCount":
        "Project documents",
      "overview.minimumEvidenceBasis.ready":
        "Core project records",
      "director.schedule.dataDateIso":
        "Programme data date",
      "director.schedule.independentForecastCompletionIso":
        "CMeng forecast completion",
      "director.schedule.officialAdjustedCompletionIso":
        "Official completion",
      "director.schedule.contractualCompletionIso":
        "Contract completion",
      "director.claims.observedProgrammeMovementDays":
        "Programme movement",
      "director.claims.analyticalTimeImpactCandidateDays":
        "Time-impact candidate",
      "director.claims.attributableCandidateEotDays":
        "Attributable EOT candidate",
      "director.claims.officialApprovedEotDays":
        "Approved EOT",
      "director.ld.cappedAmount":
        "LD exposure",
    };
  if (exact[path]) {
    return exact[path]!;
  }

  const raw =
    path
      .split(".")
      .at(-1)
      ?.replace(
        /\[\d+\]/g,
        "",
      ) ??
    path;

  return raw
    .replace(
      /([a-z0-9])([A-Z])/g,
      "$1 $2",
    )
    .replace(
      /[_-]+/g,
      " ",
    )
    .replace(
      /\bIso\b/g,
      "",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim()
    .replace(
      /^./,
      (value) =>
        value.toUpperCase(),
    );
}

function summarizeFacts(
  facts: Array<{
    path: string;
    value: string | number | boolean | null;
  }>,
): string {
  if (facts.length === 0) {
    return "CMeng needs more project information before it can answer this reliably.";
  }
  const lines = facts
    .slice(0, 8)
    .map(
      (fact) =>
        factLabel(
          fact.path,
        ) +
        ": " +
        (
          typeof fact.value ===
          "boolean"
            ? fact.value
              ? "Yes"
              : "No"
            : String(
                fact.value,
              )
        ),
    );
  return (
    "Current project position:\n" +
    lines
      .map((line) => "• " + line)
      .join("\n")
  );
}

export function answerProjectQuestion(
  projectId: string,
  question: string,
) {
  const overview =
    overviewForProject(projectId);
  if (!overview) {
    return null;
  }

  const keys =
    relevantKeys(question);
  const modules: ModuleSelection[] =
    keys.map((key) => {
      const result =
        moduleForProject(
          projectId,
          key,
        );
      return {
        key,
        status: result.status,
        reason: result.reason,
      };
    });

  const moduleFacts =
    keys.flatMap((key) => {
      const result =
        moduleForProject(
          projectId,
          key,
        );
      const data=result.data as Record<string,unknown>|null;
      return data
        ? scalarFacts(
            data.focus??data,
            key,
          )
        : [];
    });

  const director =
    directorForProject(projectId);
  const directorFacts =
    director
      ? scalarFacts(
          director,
          "director",
        )
      : [];

  const facts = [
    {
      path:
        "overview.latestDataDateIso",
      value:
        overview.latestDataDateIso,
    },
    {
      path:
        "overview.evidenceDocumentCount",
      value:
        overview.evidenceDocumentCount,
    },
    {
      path:
        "overview.minimumEvidenceBasis.ready",
      value:
        overview.minimumEvidenceBasis.ready,
    },
    ...moduleFacts,
    ...directorFacts,
  ].filter(
    (fact) =>
      fact.value !== undefined,
  );

  const uniqueFacts = [
    ...new Map(
      facts.map((fact) => [
        fact.path +
          "|" +
          String(fact.value),
        fact,
      ]),
    ).values(),
  ].slice(0, 40);

  const actions =
    director &&
    Array.isArray(
      director.managementActions,
    )
      ? director.managementActions
      : [];

  return {
    projectId,
    question,
    generatedAt:
      new Date().toISOString(),
    engine:
      "cmeng_grounded_project_intelligence_v1",
    modelBacked: false,
    authority: "advisory_only",
    answer:
      summarizeFacts(
        uniqueFacts,
      ),
    relevantModules: modules,
    facts: uniqueFacts,
    reportingContexts:keys.map(key=>{
      const data=moduleForProject(projectId,key).data as any;
      const c=data?.reportingContract;
      return {moduleKey:key,dataDateIso:c?.dataDateIso??null,programmeRevisionId:c?.programmeRevisionId??null,
        populations:Object.values(c?.populations??{}).map((p:any)=>({populationId:p.populationId,name:p.name,denominator:p.denominator,sourceCount:p.sourceCount,excludedCount:p.exclusions.length,authority:p.authority,dateBasis:p.dateBasis})),
        metricContracts:c?.metricContracts??{}};
    }),
    managementActions: actions,
    sources: [
      "Project overview",
      "Project Director position",
      ...keys.map(
        (key) =>
          projectControlName(
            key,
          ),
      ),
    ],
    suggestedQuestions: [
      "What changed since the previous schedule update?",
      "What is driving the current completion forecast?",
      "Which delay events have the strongest time impact?",
      "What project information is missing from the look-ahead?",
      "What commercial exposure is linked to schedule delay?",
    ],
    governance:
      "CMeng AI provides advice from the current project records and calculated position. Recommendations do not change the adopted project position unless they are approved.",
  };
}
