export interface ScheduleModuleDescriptor {
  key: string;
  title: string;
  category: "analysis" | "progress" | "forecast" | "claims" | "contract";
}

export const scheduleModules: ScheduleModuleDescriptor[] = [
  { key: "pmo-analysis", title: "PMO Analysis", category: "analysis" },
  { key: "schedule-analytics", title: "Schedule Analytics", category: "analysis" },
  { key: "activity-analytics", title: "Activity Analytics", category: "analysis" },
  { key: "resource-utilization", title: "Resource Utilization", category: "progress" },
  { key: "lookahead-schedule", title: "Look-Ahead Schedule", category: "analysis" },
  { key: "progress-report", title: "Progress Report", category: "progress" },
  { key: "schedule-change-report", title: "Schedule Change Report", category: "analysis" },
  { key: "revision-trend", title: "Revision Trend", category: "analysis" },
  { key: "variance-trends", title: "Variance Trends", category: "progress" },
  { key: "progress-scurve", title: "Progress S-Curve", category: "progress" },
  { key: "quantity-scurve", title: "Quantity Installed S-Curve", category: "progress" },
  { key: "progress-breakdown", title: "Progress Breakdown", category: "progress" },
  { key: "milestones", title: "Milestones", category: "analysis" },
  { key: "near-critical", title: "Near-Critical Activities", category: "analysis" },
  { key: "manhour-scurve", title: "Man-Hour S-Curve", category: "progress" },
  { key: "forecast-history", title: "Forecast History", category: "forecast" },
  { key: "independent-forecast", title: "Independent Forecast", category: "forecast" },
  { key: "delay-claims", title: "Delay & Claims", category: "claims" },
  { key: "notices-claims", title: "Notices, EOT & Claims", category: "claims" },
  { key: "windows-analysis", title: "Windows Analysis", category: "claims" },
  { key: "eot-assessment", title: "EOT Assessment", category: "claims" },
  { key: "challenge-contract", title: "Challenge the Contract", category: "contract" }
];

export function scheduleModuleSummary() {
  return {
    total: scheduleModules.length,
    keys: scheduleModules.map((module) => module.key)
  };
}

export interface CommercialModuleDescriptor {
  key: string;
  title: string;
  tier: 1 | 2 | 3 | 4;
  category:
    | "foundation"
    | "cost"
    | "payments"
    | "contract_admin"
    | "risk"
    | "closeout"
    | "cross_cutting";
}

export const commercialModules:
  CommercialModuleDescriptor[] = [
  { key: "commercial-terms", title: "Commercial Terms", tier: 1, category: "foundation" },
  { key: "cost-register", title: "Cost Register", tier: 1, category: "cost" },
  { key: "payment-register", title: "Payment Register (IPC)", tier: 1, category: "payments" },
  { key: "cbs-breakdown", title: "CBS Breakdown", tier: 1, category: "cost" },

  { key: "cost-control", title: "Cost Control", tier: 2, category: "cost" },
  { key: "evm-performance", title: "EVM Curves & Performance", tier: 2, category: "cost" },
  { key: "cash-flow", title: "Cash Flow Register", tier: 2, category: "payments" },
  { key: "cost-scurve", title: "Cost S-Curve", tier: 2, category: "cost" },
  { key: "variations", title: "Variations", tier: 2, category: "contract_admin" },
  { key: "site-instructions", title: "Site Instructions", tier: 2, category: "contract_admin" },
  { key: "contract-obligations", title: "Contract Obligations", tier: 2, category: "contract_admin" },
  { key: "liquidated-damages", title: "Liquidated Damages", tier: 2, category: "contract_admin" },
  { key: "bonds-insurance", title: "Bonds & Insurance", tier: 2, category: "contract_admin" },
  { key: "retention-calendar", title: "Retention Calendar", tier: 2, category: "payments" },

  { key: "final-account", title: "Final Account / Closeout", tier: 3, category: "closeout" },
  { key: "earned-schedule", title: "Earned Schedule", tier: 3, category: "cost" },
  { key: "evm-by-wbs", title: "EVM by WBS", tier: 3, category: "cost" },
  { key: "commercial-risk-register", title: "Risk Register", tier: 3, category: "risk" },
  { key: "monte-carlo-risk", title: "Monte Carlo Risk", tier: 3, category: "risk" },
  { key: "contract-risk", title: "Contract Risk", tier: 3, category: "risk" },
  { key: "tender-readiness", title: "Tender Readiness", tier: 3, category: "contract_admin" },

  { key: "commitment-tracking", title: "Commitment Tracking", tier: 4, category: "cross_cutting" },
  { key: "accruals", title: "Accruals", tier: 4, category: "cross_cutting" },
  { key: "contingency-reserve", title: "Contingency & Management Reserve", tier: 4, category: "cross_cutting" },
  { key: "price-adjustment", title: "Escalation & Price Adjustment", tier: 4, category: "cross_cutting" },
  { key: "vat-tax", title: "VAT & Tax", tier: 4, category: "cross_cutting" },
  { key: "multi-currency", title: "Multi-Currency", tier: 4, category: "cross_cutting" },
  { key: "cost-audit-trail", title: "Cost Audit Trail", tier: 4, category: "cross_cutting" },
  { key: "commercial-reconciliation", title: "Reconciliation Report", tier: 4, category: "cross_cutting" },
  { key: "cost-position", title: "Cost Position", tier: 4, category: "cross_cutting" },
];

export function commercialModuleSummary() {
  return {
    total: commercialModules.length,
    keys: commercialModules.map(
      (module) => module.key,
    ),
  };
}
