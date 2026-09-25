// Single source of page titles, purpose and navigation. Keys remain stable for saved links and API clients.
export interface ModuleDescriptor {
  key: string;
  title: string;
  apiKey?:string;
  description: string;
  group: string;
  area: "management" | "schedule" | "commercial";
  category: "management" | "analysis" | "progress" | "forecast" | "claims" | "contract" | "commercial";
}

export const moduleRegistry: ModuleDescriptor[] = [
  {"key": "master-dashboard", "title": "Master Dashboard", "description": "Completion commitments, programme pressure and commercial position.", "group": "Management Control", "area": "management", "category": "management"},
  {"key": "command-center", "title": "Command Center", "description": "Delivery priorities, suggested follow-up and decisions awaiting assignment.", "group": "Management Control", "area": "management", "category": "management"},
  {"key": "master-control-programme", "title": "Master Control Programme", "description": "Controlled revisions, project structure, specialist positions and review history.", "group": "Management Control", "area": "management", "category": "management"},
  {"key": "source-quality", "title": "Information & Actions", "description": "Documents to confirm, information to provide and actions to assign.", "group": "Management Control", "area": "management", "category": "management"},
  {"key": "pmo-analysis", "title": "Management Brief", "description": "Finish-date outlook, schedule pressure and decisions requiring management attention.", "group": "Programme & Planning", "area": "schedule", "category": "analysis"},
  {"key": "schedule-analytics", "title": "Programme Review", "description": "Programme health, logic quality, float and finish dates.", "group": "Programme & Planning", "area": "schedule", "category": "analysis"},
  {"key": "activity-analytics", "title": "Activity Review", "description": "Activity finish movement, float and programme comparisons.", "group": "Programme & Planning", "area": "schedule", "category": "analysis"},
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
export const scheduleModules = moduleRegistry.filter(m => m.area === "schedule");
export const commercialModules = moduleRegistry.filter(m => m.area === "commercial");

export function scheduleModuleSummary() {
  return {total: scheduleModules.length, keys: scheduleModules.map(m => m.key)};
}

export function commercialModuleSummary() {
  return {total: commercialModules.length, keys: commercialModules.map(m => m.key)};
}
