import {deliveryPages} from '../../delivery-core/src/registry';
// Single source of page titles, purpose and navigation. Keys remain stable for saved links and API clients.
export interface ModuleDescriptor {
  key: string;
  title: string;
  apiKey?:string;
  description: string;
  group: string;
  area: "management" | "schedule" | "commercial" | "delivery";
  category: "management" | "analysis" | "progress" | "forecast" | "claims" | "contract" | "commercial" | "delivery";
  /** Heavy or specialist pages are resolved only when opened and are excluded
   * from the all-module certification/cold-load bundle. */
  onDemand?: boolean;
}

export const moduleRegistry: ModuleDescriptor[] = [
  {"key": "master-dashboard", "title": "Master Dashboard", "description": "Completion commitments, programme pressure and commercial position.", "group": "Management Control", "area": "management", "category": "management"},
  {"key": "command-center", "title": "Command Center", "description": "Delivery priorities, suggested follow-up and decisions awaiting assignment.", "group": "Management Control", "area": "management", "category": "management"},
  {"key": "master-control-programme", "title": "Master Control Programme", "description": "Controlled revisions, project structure, specialist positions and review history.", "group": "Management Control", "area": "management", "category": "management"},
  {"key": "source-quality", "title": "Actions required", "description": "Your pending confirmations, reviews and information requests in one place.", "group": "Management Control", "area": "management", "category": "management"},
  {"key": "pmo-analysis", "title": "Management Brief", "description": "Finish-date outlook, schedule pressure and decisions requiring management attention.", "group": "Programme & Planning", "area": "schedule", "category": "analysis"},
  {"key": "schedule-analytics", "title": "Programme Review", "description": "Programme health, logic quality, float and finish dates.", "group": "Programme & Planning", "area": "schedule", "category": "analysis"},
  {"key": "activity-analytics", "title": "Activity Review", "description": "Activity finish movement, float and programme comparisons.", "group": "Programme & Planning", "area": "schedule", "category": "analysis"},
  {"key": "scope-classification", "title": "Scope & Classification", "description": "WBS, zone, floor, level, building, workfront, discipline and package classification coverage used by schedule filters and Ask CMeng.", "group": "Programme & Planning", "area": "schedule", "category": "analysis"},
  {"key": "lookahead-schedule", "title": "Look-Ahead", "description": "The next six weeks, readiness blockers and overdue work.", "group": "Programme & Planning", "area": "schedule", "category": "analysis"},
  {"key": "schedule-change-report", "title": "Programme Changes", "description": "What changed between the latest controlled programme submissions.", "group": "Programme & Planning", "area": "schedule", "category": "analysis"},
  {"key": "revision-trend", "title": "Revision History", "description": "How progress, forecast finish and schedule pressure have moved over time.", "group": "Programme & Planning", "area": "schedule", "category": "analysis"},
  {"key": "milestones", "title": "Milestones", "description": "Milestone status, submitted float, due dates, baseline movement and required management review.", "group": "Programme & Planning", "area": "schedule", "category": "analysis"},
  {"key": "near-critical", "title": "Near-Critical & Float Risk", "description": "Strict near-critical activities and the wider float-risk watchlist, kept separate and reconciled to the submitted source position.", "group": "Programme & Planning", "area": "schedule", "category": "analysis"},
  {"key": "resource-utilization", "title": "Resources", "description": "Weekly demand, actual usage and available capacity by resource.", "group": "Progress & Resources", "area": "schedule", "category": "progress"},
  {"key": "progress-report", "title": "Progress Status", "description": "Baseline, current schedule, physical, contractor-reported and certified progress kept separate.", "group": "Progress & Resources", "area": "schedule", "category": "progress"},
  {"key": "variance-trends", "title": "Variance Trend", "description": "Activity finish movement and schedule pressure across controlled programme revisions.", "group": "Progress & Resources", "area": "schedule", "category": "progress"},
  {"key": "progress-scurve", "title": "Progress S-Curve", "description": "Derived baseline/current plans and schedule snapshot history on one time axis.", "group": "Progress & Resources", "area": "schedule", "category": "progress"},
  {"key": "quantity-scurve", "title": "Installed Quantities", "description": "BOQ and measured installations by unit; planned quantities require a defensible schedule mapping.", "group": "Progress & Resources", "area": "schedule", "category": "progress"},
  {"key": "progress-breakdown", "title": "WBS Progress", "description": "Duration-weighted progress and schedule pressure by WBS.", "group": "Progress & Resources", "area": "schedule", "category": "progress"},
  {"key": "manhour-scurve", "title": "Man-Hour S-Curve", "description": "Planned, actual and forecast labor hours, with history coverage stated explicitly.", "group": "Progress & Resources", "area": "schedule", "category": "progress"},
  {"key": "forecast-history", "title": "Completion History", "description": "How submitted finishes and calendar recalculations move across programme revisions.", "group": "Forecast & Finish", "area": "schedule", "category": "forecast"},
  {"key": "independent-forecast", "title": "Completion Forecast", "description": "Submitted completion, calendar recalculation and the productivity outlook, with each calculation basis and unresolved limit stated.", "group": "Forecast & Finish", "area": "schedule", "category": "forecast"},
  {"key": "monte-carlo-risk", "title": "Monte Carlo Schedule Risk", "description": "Activity-by-activity probabilistic network simulation with P10/P50/P80/P90/P95 completion dates, criticality index and explicit uncertainty assumptions.", "group": "Forecast & Finish", "area": "schedule", "category": "forecast", "onDemand": true},
  {"key": "earned-schedule", "title": "Earned Schedule", "description": "Time-based schedule performance using the source PV curve and earned value, with SV(t) and SPI(t) separated from value-based EVM.", "group": "Forecast & Finish", "area": "schedule", "category": "forecast", "onDemand": true},
  {"key": "challenge-contract", "title": "Challenge the Contract", "description": "Tests the submitted manpower plan and current schedule against project evidence and required milestones, then combines the gaps, consequences and actions.", "group": "Forecast & Finish", "area": "schedule", "category": "forecast"},
  {"key": "delay-claims", "title": "Delay Event Register", "description": "Recorded delay events, affected activities and linked records for investigation. Causation requires supporting evidence.", "group": "Delay & Time Entitlement", "area": "schedule", "category": "claims"},
  {"key": "notices-claims", "title": "Notice Compliance", "description": "Event dates, notice deadlines and issue dates checked against the applicable contract version.", "group": "Delay & Time Entitlement", "area": "schedule", "category": "claims"},
  {"key": "windows-analysis", "title": "Delay Windows", "description": "Revision-to-revision programme movement kept separate from causation and entitlement.", "group": "Delay & Time Entitlement", "area": "schedule", "category": "claims"},
  {"key": "eot-assessment", "title": "EOT Assessment", "description": "Time-impact evidence, entitlement assessment and dated EOT determinations, with unresolved overlap stated.", "group": "Delay & Time Entitlement", "area": "schedule", "category": "claims"},
  {"key": "commercial-overview", "title": "Commercial Overview", "description": "Integrated contract value, change, payment, retention, bond, claim and time position by currency.", "group": "Commercial", "area": "commercial", "category": "commercial"},
  {"key": "cost-forecast", "title": "Cost Outlook", "description": "Original and current contract value, approved/pending change and claim exposure without cross-currency arithmetic.", "group": "Commercial", "area": "commercial", "category": "commercial"},
  {"key": "variations-change", "title": "Variations & Change", "description": "Approved and pending variation exposure with approval status and dates.", "group": "Commercial", "area": "commercial", "category": "commercial"},
  {"key": "payments", "title": "Payments", "description": "Interim certificates, certified value, payments, unpaid certified balance, retention and advance evidence.", "group": "Commercial", "area": "commercial", "category": "commercial"},
  {"key": "cash-flow", "title": "Cash Flow", "description": "Actual cash availability, certificate reconciliation and the future certificate plan.", "group": "Commercial", "area": "commercial", "category": "commercial"},
  {"key": "commercial-claims-notices", "title": "Financial Claims", "description": "Claimed and assessed money by currency, financial exposure and recovery status, linked to the supporting time and notice records.", "group": "Commercial", "area": "commercial", "category": "commercial"},
  {"key": "contract-particulars-bonds", "title": "Contract Particulars & Bonds", "description": "Contract value, contractual completion, approved EOT and active security position.", "group": "Commercial", "area": "commercial", "category": "commercial"},
  {"key": "commercial-terms", "title": "Commercial Terms", "description": "Dated contract terms, amendments, payment periods, retention, security and notice provisions.", "group": "Commercial Controls", "area": "commercial", "category": "contract", "onDemand": true},
  {"key": "cost-register", "title": "Cost Register", "description": "Source cost records by cost code, WBS, currency, tax basis and reporting date.", "group": "Commercial Controls", "area": "commercial", "category": "commercial", "onDemand": true},
  {"key": "payment-register", "title": "Payment Register (IPC)", "description": "Application, assessment, certification, payment and SLA lifecycle by certificate.", "group": "Commercial Controls", "area": "commercial", "category": "commercial", "onDemand": true},
  {"key": "cbs-breakdown", "title": "CBS Breakdown", "description": "Cost breakdown hierarchy with explicit WBS, BOQ and payment links where established.", "group": "Commercial Controls", "area": "commercial", "category": "commercial", "onDemand": true},
  {"key": "cost-control", "title": "Cost Control", "description": "BAC, PV, EV, AC, CPI, SPI, EAC scenarios, VAC, TCPI and variance decomposition.", "group": "Commercial Controls", "area": "commercial", "category": "commercial", "onDemand": true},
  {"key": "evm-performance", "title": "EVM Curves & Performance", "description": "Time-phased PV, EV, AC, SPI, CPI, SV and CV with compatible currency and tax basis.", "group": "Commercial Controls", "area": "commercial", "category": "commercial", "onDemand": true},
  {"key": "cash-flow-register", "title": "Cash Flow Register", "description": "Dated receipts, expenditure, funding movement and cash-series readiness.", "group": "Commercial Controls", "area": "commercial", "category": "commercial", "onDemand": true},
  {"key": "cost-scurve", "title": "Cost S-Curve", "description": "PV, EV, AC and source EAC time series, kept separate by currency and tax basis.", "group": "Commercial Controls", "area": "commercial", "category": "commercial", "onDemand": true},
  {"key": "site-instructions", "title": "Site Instructions", "description": "Instructions, quotation status, linked variations, activities, claims and commercial exposure.", "group": "Contract Control", "area": "commercial", "category": "contract", "onDemand": true},
  {"key": "contract-obligations", "title": "Contract Obligations", "description": "Dated contractual obligations, responsible party, status and supporting evidence.", "group": "Contract Control", "area": "commercial", "category": "contract", "onDemand": true},
  {"key": "liquidated-damages", "title": "Liquidated Damages", "description": "Contract LD terms and schedule scenarios without converting exposure into liability.", "group": "Contract Control", "area": "commercial", "category": "contract", "onDemand": true},
  {"key": "bonds-insurance", "title": "Bonds & Insurance", "description": "Security instruments, insurance coverage, expiry position and contract requirements.", "group": "Contract Control", "area": "commercial", "category": "contract", "onDemand": true},
  {"key": "retention-calendar", "title": "Retention Calendar", "description": "Retention deductions, release triggers, due dates, releases and unresolved balances.", "group": "Contract Control", "area": "commercial", "category": "contract", "onDemand": true},
  {"key": "evm-by-wbs", "title": "EVM by WBS", "description": "PV, EV, AC, SPI and CPI by explicit WBS linkage, currency and tax basis.", "group": "Commercial Controls", "area": "commercial", "category": "commercial", "onDemand": true},
  {"key": "risk-register", "title": "Risk Register", "description": "Dated project risks, owners, linked activities and probability × impact validation without inventing rating thresholds.", "group": "Risk & Uncertainty", "area": "commercial", "category": "commercial", "onDemand": true},
  {"key": "contract-risk", "title": "Contract Risk", "description": "Deterministic contract-control exceptions across obligations, notices, instructions, variations, securities, retention and LD scenarios.", "group": "Risk & Uncertainty", "area": "commercial", "category": "contract", "onDemand": true},
  {"key": "final-account", "title": "Final Account / Closeout", "description": "Commercial closeout readiness across variations, payments, retention, obligations and construction handover.", "group": "Contract Control", "area": "commercial", "category": "commercial", "onDemand": true},
  ...deliveryPages.map(([key,title,description])=>({key,title,description,group:"Delivery",area:"delivery" as const,category:"delivery" as const})),
];

export const pageApiKey=(key:string)=>moduleRegistry.find(m=>m.key===key||m.apiKey===key)?.apiKey??key;
export const resolveModuleKey=(key:string)=>moduleRegistry.find(m=>m.key===key||m.apiKey===key)?.key??key;
for(const m of moduleRegistry)m.apiKey=m.title.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function publicModuleResult<T extends {key:string}>(result:T,requestedKey:string){
  const page=moduleRegistry.find(m=>m.key===result.key);
  return {...result,key:page?.apiKey===requestedKey?requestedKey:result.key,legacyKey:result.key,page:{key:page?.apiKey??result.key,title:page?.title??result.key,group:page?.group??null}};
}
export const moduleTitles = Object.fromEntries(moduleRegistry.map(m => [m.key, m.title]));
export const moduleDescriptions = Object.fromEntries(moduleRegistry.map(m => [m.key, m.description]));
export const moduleGroups = moduleRegistry.reduce<Record<string, string[]>>((groups, m) => {
  (groups[m.group] ??= []).push(m.key);
  return groups;
}, {});

export function titleForModule(key: string): string {
  return moduleTitles[resolveModuleKey(key)] ?? key;
}

export type ScheduleModuleDescriptor = ModuleDescriptor;
export type CommercialModuleDescriptor = ModuleDescriptor;
export const scheduleModules = moduleRegistry.filter(m => m.area === "schedule" && !m.onDemand);
export const commercialModules = moduleRegistry.filter(m => m.area === "commercial" && !m.onDemand);
export const schedulePageModules = moduleRegistry.filter(m => m.area === "schedule");
export const commercialPageModules = moduleRegistry.filter(m => m.area === "commercial");

export function scheduleModuleSummary() {
  return {total: scheduleModules.length, keys: scheduleModules.map(m => m.key)};
}

export function commercialModuleSummary() {
  return {total: commercialModules.length, keys: commercialModules.map(m => m.key)};
}
