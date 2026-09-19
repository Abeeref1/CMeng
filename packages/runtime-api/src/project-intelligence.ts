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
    depth > 3 ||
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

function summarizeFacts(
  facts: Array<{
    path: string;
    value: string | number | boolean | null;
  }>,
): string {
  if (facts.length === 0) {
    return "CMeng does not yet have enough established evidence to answer this from governed project data.";
  }
  const lines = facts
    .slice(0, 8)
    .map(
      (fact) =>
        fact.path +
        ": " +
        String(fact.value),
    );
  return (
    "Evidence-grounded project position:\n" +
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
      return result.data
        ? scalarFacts(
            result.data,
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
    ...directorFacts,
    ...moduleFacts,
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
    managementActions: actions,
    sources: [
      "project overview",
      "governed project director position",
      ...keys.map(
        (key) =>
          "module:" + key,
      ),
    ],
    suggestedQuestions: [
      "What changed since the previous schedule update?",
      "What is driving the current completion forecast?",
      "Which delay events have the strongest time impact?",
      "What evidence is missing from the look-ahead?",
      "What commercial exposure is linked to schedule delay?",
    ],
    governance:
      "Ask CMeng is advisory. It reads established CMeng project projections and does not promote recommendations or candidate evidence into the governed basis.",
  };
}
