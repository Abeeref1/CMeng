import {
  directorForProject,
  moduleForProject,
  overviewForProject,
} from "./project-projections";

type ModuleSelection = {
  issueAssessment?: import('../../truth-kernel/src').ControlIssueAssessment | undefined;
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
    /critical|near[- ]critical|float|driving path/.test(q)
  ) {
    add(
      "schedule-analytics",
      "near-critical",
      "activity-analytics",
    );
  }
  if (
    /resource|assignment|manpower|labou?r|man[- ]?hour|crew/.test(q)
  ) {
    add(
      "resource-utilization",
      "manhour-scurve",
      "lookahead-schedule",
    );
  }
  if (/commercial|exposure/.test(q)) add("commercial-overview");
  if (/variation|change order/.test(q)) add("variations-change");
  if (/payment|certificate|certified|retention/.test(q)) add("payments");
  if (/cash/.test(q)) add("cash-flow");
  if (/cost|budget|earned value|\bspi\b|\bcpi\b/.test(q)) add("cost-forecast");
  if (/contract|bond|insurance|obligation|liquidated|\bld\b/.test(q)) add("contract-particulars-bonds");
  if (/challenge/.test(q)) add("challenge-contract");
  if (/\bncr\b|\brfi\b|quality|risk register/.test(q))add('command-center');
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
      .filter(([key])=>!['issueAssessment','projectId','evidenceRevisionId','schemaVersion','projectionKey','producerVersion','generatedAt','sourceRevisionId','sourceProjections','sourceLedger','source','futureRows','undatedRows','claimsReporting','reportingContract','diagnostics','receipts','basis','sourceRefs','controlBasis','population','populationContract','challenge','systemEvidenceContract','moduleReadiness'].includes(key) && !/Ids?$/.test(key))
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

type AnswerFact = {path: string; value: string | number | boolean | null; label?: string;
  populationId?: string; dataDateIso?: string | null; authority?: string; state?: string; unit?: string};

/** Answer the requested metric from the same resolved population used by pages
 * and exports. Never infer dated approvals or cash from an aggregate source. */
function requestedFacts(question: string, projectId: string): AnswerFact[] {
  const q = question.toLowerCase(), facts: AnswerFact[] = [];
  const data = (key: string) => moduleForProject(projectId, key).data as any;
  const add = (path: string, label: string, value: AnswerFact['value'], context: Partial<AnswerFact> = {}) =>
    facts.push({path, label, value: value ?? null, ...context});
  const population = (key: string, name: string, label: string, established = true) => {
    const p = data(key)?.reportingContract?.populations?.[name];
    const context = {populationId: p?.populationId, dataDateIso: p?.dataDateIso, authority: 'calculated'};
    add(key + '.reportingContract.populations.' + name + '.denominator', label + ' on/before Data Date', established ? p?.denominator ?? null : null, context);
    add(key + '.reportingContract.populations.' + name + '.afterDataDate', label + ' after Data Date (excluded)', established && p ? p.exclusions.filter((e:any)=>e.reason==='after_data_date').length : null, context);
    add(key + '.reportingContract.populations.' + name + '.undated', label + ' without a usable date (excluded)', established && p ? p.exclusions.filter((e:any)=>/date_missing|date_invalid/.test(e.reason)).length : null, context);
  };
  if (/claim|notice/.test(q)) {
    const d = data('notices-claims');
    const submitted = d?.contractorNoticeClaimEvidenceSubmitted === true;
    if (/claim/.test(q)) population('notices-claims','claims','Claim identities',submitted);
    if (/notice/.test(q)) population('notices-claims','claim_notices','Claim notices, excluding determinations',submitted);
  }
  if(/\bncr\b|\brfi\b|quality|risk register/.test(q)){
    const d=data('command-center'),r=d?.operationalReporting;
    const context={dataDateIso:r?.dataDateIso,authority:'calculated'};
    if(/\bncr\b|quality/.test(q)){
      add('command-center.operationalReporting.counts.openCriticalMajorNcrCount','Complete open major/critical NCR count at Data Date',r?.counts?.openCriticalMajorNcrCount,context);
      add('command-center.operationalReporting.knownCounts.openCriticalMajorNcrCount','Confirmed open major/critical NCRs · known subset',r?.knownCounts?.openCriticalMajorNcrCount,context);
      add('command-center.operationalReporting.knownCounts.uncertainCriticalMajorNcrCount','Current major/critical NCRs with unresolved status or severity',r?.knownCounts?.uncertainCriticalMajorNcrCount,context);
      population('command-center','ncrs','NCR records');
    }
    if(/\brfi\b/.test(q)){
      add('command-center.operationalReporting.counts.openRfiCount','Open RFIs at Data Date',r?.counts?.openRfiCount,context);
      add('command-center.operationalReporting.counts.overdueRfiCount','Overdue RFIs at Data Date',r?.counts?.overdueRfiCount,context);
      population('command-center','rfis','RFI records');
    }
    if(/risk register/.test(q)){
      add('command-center.operationalReporting.counts.openRiskCount','Open risks at Data Date · requires dated status',r?.counts?.openRiskCount,context);
      population('command-center','risks','Risk records');
    }
  }
  if (/variation|retention|payment|certificate/.test(q)) {
    const key = /variation/.test(q) ? 'variations-change' : 'payments';
    const d = data(key), ledger = d?.position?.sourceLedger, temporal = ledger?.temporalPosition;
    const context = {dataDateIso: d?.reportingContract?.dataDateIso, authority: 'calculated'};
    if (/variation/.test(q)) {
      const established = (d?.position?.contractControls?.variations?.sourceRecordCount ?? 0) > 0;
      add(key+'.position.sourceLedger.temporalPosition.variations.asOfApprovedCount','Dated approved variations on/before Data Date',established ? temporal?.variations?.asOfApprovedCount : null,context);
      add(key+'.position.sourceLedger.temporalPosition.variations.futureApprovalCount','Approvals after Data Date (excluded)',established ? temporal?.variations?.futureApprovalCount : null,context);
      add(key+'.position.sourceLedger.temporalPosition.variations.undatedApprovalCount','Approvals without a usable date (excluded)',established ? temporal?.variations?.undatedApprovalCount : null,context);
    }
    if (/payment|certificate/.test(q)) population('payments','certificate_periods','Certificate periods (not certification/payment events)',(d?.position?.foundation?.paymentRegister?.sourceRecordCount??0)>0);
    for (const [i,m] of (temporal?.money ?? []).entries()) {
      if (!( /variation/.test(q) && m.kind==='Approved variation source values' || /retention/.test(q) && m.kind==='Retention deductions')) continue;
      const label = m.kind + ' · ' + m.currency + ' · tax ' + m.taxBasis;
      const p = d?.reportingContract?.populations?.[m.kind==='Retention deductions'?'retentionDeductions':'variations'];
      for (const [field,scope] of [['asOfValue','on/before Data Date'],['futureValue','after Data Date (excluded)']] as const)
        add(key+'.position.sourceLedger.temporalPosition.money['+i+'].'+field,label+' · '+scope,m[field],{...context,populationId:p?.populationId,unit:m.currency});
    }
    for (const [i,c] of (d?.position?.currencies ?? []).entries()) {
      if (/variation/.test(q)) add(key+'.position.currencies['+i+'].approvedVariationAmount.value','Source aggregate approved variations · '+c.currency+' · separate authority, reconcile with dated approvals',c.approvedVariationAmount?.value,{...context,authority:'source',state:c.approvedVariationAmount?.state,unit:c.currency});
      if (/retention/.test(q)) add(key+'.position.currencies['+i+'].retentionHeldAmount.value','Retention held balance · '+c.currency,c.retentionHeldAmount?.value,{...context,state:c.retentionHeldAmount?.state,unit:c.currency});
      if (/payment|certificate/.test(q)) for (const field of ['certifiedAmount','paidAmount'] as const) add(key+'.position.currencies['+i+'].'+field+'.value',factLabel(field)+' · dated events · '+c.currency,c[field]?.value,{...context,state:c[field]?.state,unit:c.currency});
    }
  }
  if (/critical|float/.test(q)) {
    const d = data('near-critical');
    const p = d?.reportingContract?.populations?.execution_control;
    add('schedule-analytics.result.float.criticalCount','Critical execution activities',data('schedule-analytics')?.result?.float?.criticalCount,{populationId:p?.populationId,dataDateIso:p?.dataDateIso,authority:'calculated'});
    for (const [field,label] of [['nearCriticalCount','Strict near-critical execution activities'],['negativeFloatCount','Negative-float execution activities']] as const)
      add('near-critical.'+field,label,d?.[field],{populationId:p?.populationId,dataDateIso:p?.dataDateIso,authority:'calculated'});
  }
  if (/resource|assignment/.test(q)) {
    const d = data('resource-utilization');
    for (const [field,name,label] of [['resourceCount','resources','P6 resource identities'],['assignmentRecordCount','assignments','P6 resource assignment records']] as const) {
      const p=d?.reportingContract?.populations?.[name];
      add('resource-utilization.'+field,label,d?.[field],{populationId:p?.populationId,dataDateIso:p?.dataDateIso,authority:'source'});
    }
  }
  return facts;
}

function summarizeFacts(
  facts: AnswerFact[],
): string {
  if (facts.length === 0) {
    return "CMeng needs more project information before it can answer this reliably.";
  }
  const lines = facts
    .slice(0, 24)
    .map(
      (fact) =>
        (fact.label ?? factLabel(
          fact.path,
        )) +
        ": " +
        (
          typeof fact.value ===
          "boolean"
            ? fact.value
              ? "Yes"
              : "No"
            : fact.value === null ? 'Not established' : typeof fact.value === 'number' ? fact.value.toLocaleString('en-US',{maximumFractionDigits:6}) : String(fact.value)
        ) + (fact.state && fact.state !== 'established' ? ' ('+fact.state.replaceAll('_',' ')+')' : ''),
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
        issueAssessment: result.issueAssessment,
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
    ...requestedFacts(question, projectId),
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
    answer: summarizeFacts(uniqueFacts.filter((fact:any)=>fact.label || fact.path === 'overview.latestDataDateIso').length > 1
      ? uniqueFacts.filter((fact:any)=>fact.label || fact.path === 'overview.latestDataDateIso') : uniqueFacts.slice(0,10)) +
      (modules.some(m=>m.status!=='ready') ? '\n\nReview required: one or more referenced modules have unresolved evidence, calculation or reconciliation checks. These figures are not an overall all-clear.' : ''),
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
