/** The model proposes intent and commentary. These contracts carry CMeng facts. */
export type Cell = string | number | boolean | null;
export type EvidenceState = 'established' | 'partial' | 'missing' | 'candidate' | 'stale' | 'conflicting' | 'scenario' | 'unavailable';
export type Domain = 'schedule' | 'boq' | 'delivery' | 'commercial' | 'claims' | 'evidence';
export interface AskSession {
  userId: string; workspaceId: string; name: string | null; title: string | null; company: string | null;
  allowModel: boolean;
  allowedAuthorityIds?: string[];
}
export interface PageContext {
  projectId: string; page: string | null; filters: Record<string, string>;
  selectedActivity: string | null; selectedWbs: string | null; selectedLocation: string | null; selectedPackage: string | null;
}
export interface ProjectScope {
  scopeType: 'project'; projectId: string; projectName: string; workspaceId: string; userId: string;
  projectVersion: number; dataDate: string | null; authorityState: string;
  programmeRevision: string | null; pageContext: PageContext | null;
}
export interface Trace {
  id: string; authorityId: string; projectId: string; module: string; path: string; sourceRefs: string[];
  dataDate: string | null; basis: string; exclusions: string[]; state: EvidenceState;
}
export interface Metric {
  id: string; label: string; value: Cell; unit: string | null; state: EvidenceState;
  classification: 'project_fact' | 'calculated_intelligence'; traceId: string; basis: string;
}
export interface Column {
  key: string; label: string; type: 'text' | 'number' | 'date' | 'boolean'; unit: string | null;
  aggregate: 'sum' | 'none'; dimension: boolean;
}
export interface AnalysisTable {
  id: string; title: string; authorityId: string; columns: Column[]; rows: Record<string, Cell>[];
  population: number; excluded: number; state: EvidenceState; basis: string; traceId: string;
  selection?: {matching: number; ranked: boolean; requested: number | null; rankBy: string | null; direction: 'asc' | 'desc'};
}
export interface AnalysisChart {
  id: string; title: string; type: 'bar' | 'line'; tableId: string; category: string; series: string[];
  unit: string; basis: string; population: number; dataDate: string | null;
}
export interface Finding {
  id: string; severity: 'action' | 'review' | 'information'; title: string; explanation: string;
  traceIds: string[]; values: Record<string, Cell>; action: string; owner: string | null; dueBasis: string | null;
}
export interface AuthorityResult {
  authorityId: string; title: string; state: EvidenceState; explanation: string;
  metrics: Metric[]; tables: AnalysisTable[]; charts: AnalysisChart[]; findings: Finding[]; traces: Trace[];
}
export interface Filter {
  field: string; operator: 'eq' | 'contains' | 'lt' | 'lte' | 'gt' | 'gte' | 'between'; value: Cell; upper: Cell;
}
export interface AnalysisPlan {
  questionRecipe?: import('./question-recipes').ProjectQuestionRecipe;
  diagnosisActivityFilters?: Filter[];
  objective: string; kind: 'facts' | 'analysis' | 'reconcile' | 'report' | 'document' | 'draft' | 'scenario' | 'historical' | 'proposal';
  authorities: string[]; filters: Filter[]; groupBy: string[]; rankBy: string | null; rankDirection: 'asc' | 'desc';
  limit: number | null; metricIds: string[]; issuesOnly: boolean; criticalOnly: boolean;
  nextDays: number | null; deliveryBelowPercent: number | null; asOf: string | null;
  scenario: {field: string; value: number; unit: string; target: string | null} | null;
  attachmentIds: string[];
  countRows?: boolean;
  rankings?: {authorityId: string; field: string; direction: 'asc' | 'desc'; limit: number}[];
  authorityFilters?: Record<string,Filter[]>;
}
export interface Presentation {
  title: string; audience: 'project' | 'planner' | 'commercial' | 'director' | 'executive';
  language: 'en' | 'ar' | 'bilingual'; detail: 'short' | 'normal' | 'detailed'; charts: boolean;
  preparedBy: string | null; jobTitle: string | null; company: string | null; reportNumber: string | null;
  confidentiality: string; status: 'Draft / Prepared'; format: 'interactive' | 'xlsx' | 'pdf' | 'docx' | 'csv' | 'json' | 'powerbi';
}
export interface NarrativeBlock {
  heading: string; text: string; classification: 'project_fact' | 'calculated_intelligence' | 'ai_recommendation' | 'professional_guidance'; traceIds: string[];
}
export interface AnalysisResult {
  schemaVersion: 1; id: string; conversationId: string; createdAt: string; scope: ProjectScope;
  plan: AnalysisPlan; presentation: Presentation; mode: 'Deterministic CMeng Summary' | 'CMeng AI Analysis';
  sections: AuthorityResult[]; narrative: NarrativeBlock[]; unresolved: string[];
  referenceFiles: {id: string; filename: string; hash: string; state: 'reference_only'; reading: string}[];
  snapshotHash: string; factsHash: string; providerStatus: 'not_configured' | 'not_permitted' | 'available' | 'failed' | 'not_needed';
  route?: RequestRoute;
  coverage?: CoverageManifest;
  telemetry?: AskTelemetry;
}
export type RequestRoute = 'social' | 'deterministic_fact' | 'local_data' | 'local_visual_export' | 'ai_explanation' | 'cross_domain_diagnostic' | 'complex_report' | 'document_analysis' | 'scenario' | 'historical' | 'unsupported_enterprise';
export interface EvidenceCoverage {
  id: string; authorityId: string; sourcePopulation: number; applicablePopulation: number; relevantPopulation: number;
  directlyRepresented: number; aggregated: number; supportingOmitted: number; mandatoryPopulation: number;
  mandatoryRepresented: number; omissionBasis: string; state: 'complete' | 'partial' | 'unavailable';
}
export interface CoverageManifest {
  version: 1; projectId: string; projectVersion: number; dataDate: string | null;
  entries: EvidenceCoverage[]; materialComplete: boolean; sourceComplete: boolean;
  evidenceHash: string; representedToModel: boolean;
}
export interface AskTelemetry {
  route: RequestRoute; aiInvoked: boolean; authorities: string[]; retrievalRounds: number; retrievedRecords: number;
  calls: {stage: string; estimatedInputTokens: number; inputTokens: number | null; outputTokens: number | null}[];
  providerFailures: string[]; validationFailures: string[]; criticUsed: boolean;
}
export interface AuthorityDescriptor {
  id: string; title: string; description: string; module: string; domains: Domain[];
  concepts: string[]; fields: string[]; historical: boolean;
}
export interface AuthorityProvider<C> extends AuthorityDescriptor {
  produce(context: C, scope: ProjectScope, plan: AnalysisPlan): AuthorityResult | Promise<AuthorityResult>;
}
export interface AskRequest {
  question: string; scopeType?: string; conversationId?: string; analysisId?: string;
  pageContext?: PageContext; attachmentIds?: string[];
}
export interface SavedView {
  schemaVersion: 1; id: string; projectId: string; workspaceId: string; ownerId: string;
  name: string; visibility: 'personal' | 'project'; plan: AnalysisPlan; presentation: Presentation;
  createdAt: string; updatedAt: string;
}
