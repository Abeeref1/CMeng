import {parseCsv as parseDelimitedCsv} from "../../tabular-parser/src";
import {canonicalHeader,prepareRegisterRows} from './register-schema';
import {analyzeEvidenceTable, type EvidenceTableIntelligence, type EvidenceColumnConfirmation} from './table-intelligence';
export * from './register-schema';
export * from './table-intelligence';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
export * from './reporting';
export * from './issues';
export * from './aggregates';

export type FactState = 'official' | 'candidate' | 'missing' | 'partial' | 'conflicted';
export type ManagementFactState = FactState | 'not_applicable' | 'quarantined';
export interface SourceReceipt {
  documentId: string; sourceHash: string; revision: string; locator: string;
  basisState: string; authority: 'source_record' | 'source_approved' | 'engineer_determination';
}
export interface EvidenceSemanticColumnMeaning {
  columnIndex:number;
  rawHeader:string;
  meaning:string;
  confidence:number;
  source:'ai_grounded';
}
export interface EvidenceTableSemantic {
  documentType:string;
  category:string;
  confidence:number;
  method:'tabular_content'|'ai_grounded';
  signals:string[];
  columnMeanings?:EvidenceSemanticColumnMeaning[];
}
export interface EvidenceDocument {
  documentId: string; sourceHashSha256: string; storedPath: string;
  sourceFilename: string; mediaType: string; basisState: string;
  linkedArtifactId: string | null; uploadedAt: string; familyKey?: string; documentType?: string;
  tabularRead?: {producerVersion:string;sourceHashSha256:string;sheets:Array<{name:string;rows:string[][];intelligence?:EvidenceTableIntelligence;semantic?:EvidenceTableSemantic}>} | undefined;
  csvSemantic?:EvidenceTableSemantic;
  tableConfirmations?: EvidenceColumnConfirmation[] | undefined;
}
export interface SourceRow { cells: Readonly<Record<string, string>>; receipt: SourceReceipt }
export interface SourceTable { headers: string[]; rows: SourceRow[]; document: EvidenceDocument; intelligence: EvidenceTableIntelligence; recognition?: {headerRow:number;readRowCount:number;recognized:boolean;unknown:string[]}; }
export interface Fact<T> {
  value: T | null; state: FactState; receipts: SourceReceipt[];
  diagnostics: string[]; method: string; coverage: { known: number; total: number };
}

export type PopulationState =
  | 'established'
  | 'partial'
  | 'source_only'
  | 'candidate'
  | 'missing'
  | 'not_applicable'
  | 'quarantined'
  | 'conflicted';

export interface PopulationAuthority {
  state: PopulationState;
  sourceCount: number | null;
  applicableCount: number | null;
  currentCount: number | null;
  excludedCount: number | null;
  coveragePercent: number | null;
  basis: string;
}

export type ManagementFactAuthority =
  | 'official'
  | 'source'
  | 'calculated'
  | 'candidate'
  | 'scenario'
  | 'none';

export interface ManagementFactView<T> {
  key: string;
  label: string;
  value: T | null;
  state: ManagementFactState;
  authority: ManagementFactAuthority;
  basis: string;
  limitation: string | null;
  receipts: SourceReceipt[];
  coverage: { known: number; total: number };
  /** Reporting cutoff used for this management fact. Never infer it from display time. */
  dataDateIso: string | null;
  /** Business-safe calculation/source qualifications attached to this fact. */
  diagnostics: string[];
  /** Population authority controlling whether zero/rates can be asserted. */
  population: PopulationAuthority | null;
}

export function managementFactView<T>(input: {
  key: string;
  label: string;
  value: T | null;
  state: ManagementFactState;
  authority: ManagementFactAuthority;
  basis: string;
  limitation?: string | null;
  receipts?: SourceReceipt[];
  coverage?: { known: number; total: number };
  dataDateIso?: string | null;
  diagnostics?: string[];
  population?: PopulationAuthority | null;
}): ManagementFactView<T> {
  return {
    key: input.key,
    label: input.label,
    value: input.value,
    state: input.state,
    authority: input.authority,
    basis: input.basis,
    limitation: input.limitation ?? null,
    receipts: [...(input.receipts ?? [])],
    coverage: input.coverage ?? {known: input.value === null ? 0 : 1, total: 1},
    dataDateIso: input.dataDateIso ?? null,
    diagnostics: [...(input.diagnostics ?? [])],
    population: input.population ?? null,
  };
}

const factStateRank: Record<ManagementFactState, number> = {
  official: 700,
  partial: 600,
  conflicted: 500,
  candidate: 400,
  quarantined: 300,
  not_applicable: 100,
  missing: 0,
};

export function bestAvailableFact<T>(
  candidates: readonly ManagementFactView<T>[],
): ManagementFactView<T> | null {
  if (!candidates.length) return null;
  const ranked = [...candidates].sort((a, b) => {
    const aHasValue = a.value !== null ? 1 : 0;
    const bHasValue = b.value !== null ? 1 : 0;
    return (
      bHasValue - aHasValue ||
      factStateRank[b.state] - factStateRank[a.state] ||
      (b.coverage.total > 0 ? b.coverage.known / b.coverage.total : 0) -
        (a.coverage.total > 0 ? a.coverage.known / a.coverage.total : 0)
    );
  });
  return ranked[0] ?? null;
}

export function populationAuthority(input: {
  state: PopulationState;
  sourceCount?: number | null;
  applicableCount?: number | null;
  currentCount?: number | null;
  excludedCount?: number | null;
  coveragePercent?: number | null;
  basis: string;
}): PopulationAuthority {
  const clean=(value:number|null|undefined)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
  const sourceCount=clean(input.sourceCount),applicableCount=clean(input.applicableCount),currentCount=clean(input.currentCount),excludedCount=clean(input.excludedCount);
  const coverage=typeof input.coveragePercent==='number'&&Number.isFinite(input.coveragePercent)
    ?Math.max(0,Math.min(100,input.coveragePercent)):null;
  return {
    state:input.state,sourceCount,applicableCount,currentCount,excludedCount,
    coveragePercent:coverage,basis:input.basis,
  };
}

export function populationCanAssertCompleteValue(
  population: PopulationAuthority | null | undefined,
): boolean {
  return population?.state === 'established';
}

export function populationCanAssertZero(
  population: PopulationAuthority | null | undefined,
): boolean {
  return populationCanAssertCompleteValue(population);
}

export function establishedPopulationCount(
  value: number | null | undefined,
  population: PopulationAuthority | null | undefined,
): number | null {
  if (!populationCanAssertCompleteValue(population)) return null;
  return value === null || value === undefined ? null : value;
}

export interface ManagementAction {
  actionId: string;
  issue: string;
  consequence: string | null;
  affectedScope: string[];
  affectedMilestones: string[];
  owner: string | null;
  organisation: string | null;
  requiredAction: string;
  dueIso: string | null;
  escalation: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'information';
  authority: ManagementFactAuthority;
  /** Confidence in the action linkage, distinct from source/decision authority. */
  confidence: 'high' | 'medium' | 'low' | null;
  sourceRefs: string[];
  owningModule?: string | null;
}

export function managementAction(
  value: Omit<ManagementAction,'confidence'> & {confidence?: ManagementAction['confidence']},
): ManagementAction {
  return {
    ...value,
    confidence:value.confidence??null,
    affectedScope: [...new Set(value.affectedScope.filter(Boolean))],
    affectedMilestones: [...new Set(value.affectedMilestones.filter(Boolean))],
    sourceRefs: [...new Set(value.sourceRefs.filter(Boolean))],
  };
}

export type FeatureAvailability =
  | 'active'
  | 'useful_partial'
  | 'evidence_only'
  | 'not_applicable'
  | 'blocked';

export function featureAvailability(input: {
  applicable?: boolean;
  hasEstablishedResult?: boolean;
  hasUsefulEvidence?: boolean;
  prerequisitesSatisfied?: boolean;
}): FeatureAvailability {
  if (input.applicable === false) return 'not_applicable';
  if (input.hasEstablishedResult) return 'active';
  if (input.hasUsefulEvidence && input.prerequisitesSatisfied === false) return 'evidence_only';
  if (input.hasUsefulEvidence) return 'useful_partial';
  return 'blocked';
}

export const MANAGEMENT_DIAGNOSTIC_LABELS: Readonly<Record<string, string>> = Object.freeze({
  CALENDAR_SEMANTICS_UNRESOLVED:
    'Programme calendar working days, shifts or exceptions are not sufficiently defined.',
  CALENDAR_WORK_PATTERN_NOT_ESTABLISHED:
    'Programme calendar work pattern is not sufficiently defined.',
  SCHEDULE_GRAPH_CYCLES:
    'Schedule logic contains a circular relationship.',
  SCHEDULE_GRAPH_DUPLICATE_ACTIVITY_IDS:
    'The programme contains duplicate activity IDs.',
  SCHEDULE_GRAPH_SELF_LOOPS:
    'The programme contains a self-referencing relationship.',
  SCHEDULE_GRAPH_BROKEN_PREDECESSORS:
    'A schedule relationship references a predecessor that is not present in the programme.',
  INDEPENDENT_FORECAST_ACTIVITY_NOT_CALCULATED:
    'This activity could not be included in the programme calendar recalculation.',
  INDEPENDENT_CPM_NOT_CALCULATED_IN_THIS_FAST_VIEW:
    'The independent CPM calculation is not available in this fast view.',
  CPM_ACTIVITY_CALENDAR_UNRESOLVED:
    'An activity cannot be recalculated because its source calendar is unresolved.',
  CPM_DURATION_RAW_UNSUPPORTED:
    'A source duration value cannot be used by the CPM calculation.',
  CPM_DAY_DURATION_REQUIRES_UNIFORM_CALENDAR_DAY_HOURS:
    'A day-based duration cannot be converted because the source calendar does not establish uniform working hours per day.',
  CPM_WEEK_DURATION_REQUIRES_CALENDAR_WEEK_HOURS:
    'A week-based duration cannot be converted because the source calendar does not establish working hours per week.',
  CPM_DURATION_UNIT_UNKNOWN:
    'A source activity duration unit is unknown.',
  CPM_REMAINING_DURATION_UNRESOLVED:
    'An activity remaining duration cannot be established.',
  CPM_RELATIONSHIP_TYPE_UNRESOLVED:
    'A schedule relationship type cannot be established.',
  CPM_RELATIONSHIP_LAG_UNRESOLVED:
    'A schedule relationship lag cannot be established.',
  CPM_EXTERNAL_RELATIONSHIP_UNRESOLVED:
    'An external schedule relationship cannot be resolved inside the current programme.',
  CPM_RELATIONSHIP_UNRESOLVED:
    'A schedule relationship cannot be resolved for CPM calculation.',
  CPM_PROJECT_START_UNRESOLVED:
    'The CPM project start cannot be established.',
  CPM_NETWORK_NOT_CALCULABLE:
    'The schedule network cannot be recalculated from the current source inputs.',
  CPM_RELATIONSHIP_ENDPOINT_UNRESOLVED:
    'A schedule relationship endpoint cannot be resolved.',
  CPM_COMPLETED_ACTIVITY_FINISH_UNRESOLVED:
    'A completed activity does not have a usable actual finish for CPM calculation.',
  CPM_PREDECESSOR_TIMING_UNRESOLVED:
    'A predecessor timing position cannot be resolved.',
  CPM_UNKNOWN_ACTIVITY_STATUS_TREATED_AS_INCOMPLETE:
    'An unknown activity status is retained as incomplete for CPM calculation.',
  CPM_ACTIVITY_UNRESOLVED:
    'An activity cannot be fully recalculated.',
  CPM_COMPLETED_ACTIVITY_FLOAT_NOT_RECALCULATED:
    'Float is not recalculated for a completed activity.',
  CPM_LATE_PASS_UNRESOLVED:
    'The CPM late-pass calculation cannot be completed for an activity.',
});

export function diagnosticBusinessLabel(code: string): string {
  const key = String(code ?? '').split(':', 1)[0] ?? '';
  return MANAGEMENT_DIAGNOSTIC_LABELS[key] ?? 'Additional calculation qualification';
}
export const norm = (value: string): string => value.normalize('NFKC').replace(/^\uFEFF/, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function csv(text: string): string[][] {
  const parsed = parseDelimitedCsv(Buffer.from(text, 'utf8'));
  if (parsed.diagnostics.includes('CSV_UNTERMINATED_QUOTED_FIELD')) throw new Error('CSV_UNCLOSED_QUOTE');
  return parsed.rows.map(row => row.cells).filter(row => row.some(value => value.trim()));
}

const headerNames = new Map<string,string>();
const headerKey = (name:string) => {
  const cached=headerNames.get(name);if(cached!==undefined)return cached;
  const key=canonicalHeader(name);if(headerNames.size>=4096)headerNames.clear();headerNames.set(name,key);return key;
};
export const cell = (row: SourceRow, ...names: string[]): string => {
  for (const name of names) { const v = row.cells[headerKey(name)]; if (v !== undefined && v.trim() !== '') return v.trim(); }
  return '';
};
export function numberValue(value: string): number | null {
  const v = value.trim().replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[٬]/g, ',').replace(/[٫]/g, '.');
  const accounting=/^\((.*)\)$/.exec(v);
  const candidate=(accounting?.[1]??v).trim();
  // Parentheses are an accounting negative convention. A sign inside
  // parentheses is ambiguous and remains unresolved rather than being guessed.
  if (accounting&&/^[+-]/.test(candidate)) return null;
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?%?$/.test(candidate)) return null;
  const n = Number(candidate.replace(/[, %]/g, ''));
  if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER) return null;
  const result=accounting?-n:n;
  return Object.is(result,-0)?0:result;
}
const dateResults=new Map<string,string|null>();
export function dateValue(value: string): string | null {
  if(dateResults.has(value))return dateResults.get(value)!;
  const result=parseDateValue(value);
  if(dateResults.size>=16384)dateResults.clear();
  dateResults.set(value,result);return result;
}
function parseDateValue(value: string): string | null {
  const s = value.trim(); let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)?)?$/.exec(s);
  const words = /^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i.exec(s);
  if (iso) { y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3]); }
  else if (words) { y = Number(words[3]); m = ['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(words[2]!.toLowerCase()) + 1; d = Number(words[1]); }
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0,10) : null;
}
export const sumKnown = (values: readonly (number | null)[]): number | null => {
  if (!values.length || values.some(v => v === null)) return null;
  let sum = 0, correction = 0;
  for (const n of values as number[]) { const v = n - correction; const next = sum + v; correction = (next - sum) - v; sum = next; }
  return Number(sum.toFixed(8));
};
export const ratio = (n: number | null, d: number | null): number | null => n === null || d === null || d <= 0 ? null : n / d;
export const round = (n: number | null, decimals = 4): number | null => n === null ? null : Number(n.toFixed(decimals));
export function fact<T>(value: T | null, receipts: SourceReceipt[], method: string, diagnostics: string[] = []): Fact<T> {
  return { value, state: value === null ? 'missing' : receipts.length > 0 && receipts.every(r => ['active','additive'].includes(r.basisState)) ? 'official' : 'candidate', receipts, method, diagnostics, coverage: {known: value === null ? 0 : 1, total: 1} };
}
export interface TableSemanticRoute {
  documentType:string;
  category:string;
  confidence:number;
  basis:string[];
}

export interface TableSemanticSchema {documentType:string;category:string;required:string[][];optional:string[]}
export const tableSemanticSchemas:readonly TableSemanticSchema[]=[
  {documentType:'payment_certificates',category:'boq_cost',required:[['certificate no'],['net certified','gross work','paid amount','retention','advance recovery']],optional:['period end','certificate date','payment date','currency','status']},
  {documentType:'variation_register',category:'boq_cost',required:[['variation id'],['approved amount','submitted amount','agreed amount','assessed amount','status']],optional:['approval date','currency','description']},
  {documentType:'site_instruction_register',category:'boq_cost',required:[['instruction id','site instruction id','si id'],['issue date','instruction date']],optional:['status','quotation due date','quotation date','description','variation id','estimated amount','currency']},
  {documentType:'contract_obligation_register',category:'contract',required:[['obligation id'],['due date']],optional:['clause','description','responsible party','status','evidence reference']},
  {documentType:'retention_register',category:'boq_cost',required:[['retention id','certificate no'],['retention','retention amount','held amount']],optional:['status','currency','payment date']},
  {documentType:'bond_register',category:'boq_cost',required:[['bond id'],['amount','bond amount','guarantee amount']],optional:['expiry date','status','currency','bond type']},
  {documentType:'risk_register',category:'risk_claims_procurement',required:[['risk id'],['status','description','owner','due date']],optional:['rating','probability','impact','identified date','status as of']},
  {documentType:'rfi_register',category:'engineering',required:[['rfi id'],['status','due date','description']],optional:['raised date','closed date','linked activity']},
  {documentType:'quality_ncr_register',category:'hse_quality_fm',required:[['ncr id'],['status','description']],optional:['severity','raised date','closed date','owner','linked activity']},
  {documentType:'permit_register',category:'engineering',required:[['permit id'],['status','authority','issue date','expiry date','required by']],optional:['description','submission date','review date','valid from','owner','linked activity','blocker']},
  {documentType:'procurement_register',category:'risk_claims_procurement',required:[['package id'],['required on site','forecast delivery','actual delivery','status']],optional:['description','supplier','linked activity']},
  {documentType:'delay_eot_claims_register',category:'risk_claims_procurement',required:[['claim id'],['event','notice date','days claimed','assessed days','net assessed impact days']],optional:['status','linked activity','determination id','awarded eot days']},
  {documentType:'determination_register',category:'risk_claims_procurement',required:[['determination id'],['claim id'],['awarded eot days']],optional:['determination date','status','authority']},
  {documentType:'resource_register',category:'schedule_control',required:[['resource id'],['available capacity','planned demand','actual approved usage','utilization applicable','class','unit']],optional:['week start','assignment id','resource name','forecast demand']},
  {documentType:'installed_measurement_register',category:'boq_cost',required:[['measurement date'],['item no'],['cumulative installed qty'],['unit']],optional:['actual quantity','description']},
  {documentType:'hse_report',category:'hse_quality_fm',required:[['man hours'],['lost time injuries','trir','medical treatment cases','first aid cases','near misses']],optional:['report date','reporting month']},
  {documentType:'design_deliverables',category:'engineering',required:[['deliverable id'],['planned issue','actual issue','status']],optional:['discipline','revision','due date']},
  {documentType:'interface_register',category:'risk_claims_procurement',required:[['interface id'],['giving party','receiving party','required deliverable','status']],optional:['affected workfront','linked activity','due date']},
  {documentType:'submittal_register',category:'engineering',required:[['submittal id'],['submitted date','approval date','status']],optional:['procurement package','linked activity','due date']},
  {documentType:'asset_register',category:'hse_quality_fm',required:[['asset id'],['system','tag installed','commissioned']],optional:['o m manual','warranty','status']},
  {documentType:'testing_commissioning_register',category:'tender_commissioning',required:[['test id'],['test','planned date','actual date','authority witness','status']],optional:['linked activity']},
  {documentType:'cost_evm_report',category:'boq_cost',required:[['metric'],['value'],['as of'],['unit','currency']],optional:['status','vat basis','tax basis']},
  {documentType:'cost_evm_report',category:'boq_cost',required:[['as of','period end','date'],['pv'],['ev'],['ac']],optional:['bac','eac','etc','sv','cv','currency','status','vat basis','tax basis']},
  {documentType:'wbs_dictionary',category:'schedule_control',required:[['wbs id','wbs code'],['wbs name'],['parent wbs id','parent wbs']],optional:['level']},
  {documentType:'obs_responsibility_matrix',category:'schedule_control',required:[['obs code'],['obs name','responsible manager']],optional:['parent obs','primary wbs']},
  {documentType:'longest_path_register',category:'schedule_control',required:[['activity id'],['float path','total float days','total float']],optional:['float path order','sequence']},
  {documentType:'schedule_activity_comparison',category:'schedule_control',required:[['activity id'],['baseline start','baseline finish'],['current start','current finish']],optional:['baseline status','current status','total float days']},
  {documentType:'contractor_manpower_plan',category:'schedule_control',required:[['trade'],['planned manpower','planned headcount','headcount']],optional:['week start','work front']},
  {documentType:'productivity_work_package_register',category:'schedule_control',required:[['work package','work package id'],['remaining quantity'],['recent achieved rate day','conservative achievable rate day'],['independent forecast finish']],optional:['unit']},
  {documentType:'delivery_register',category:'other',required:[['delivery record type'],['record reference']],optional:['description','linked activity','package id','asset id']},
];

/** Infer a business register role from table content. The stored document type is
 * only a tie-breaker; it is never permission to read a table. Ambiguous tables
 * remain unrouted rather than being forced into a specialist engine. */
export function inferTableSemanticRoute(
  input:readonly string[][],
  hintedDocumentType='',
  confirmations:readonly EvidenceColumnConfirmation[]=[],
):TableSemanticRoute|null{
  if(!input.length)return null;
  const intelligence=analyzeEvidenceTable(input,confirmations);
  if(!intelligence.structurallyReadable)return null;
  const raw=input[intelligence.headerRowIndex]??[];
  const confirmed=new Map(confirmations.map(c=>[c.columnIndex,c.meaning] as const));
  const candidates=tableSemanticSchemas.map(schema=>{
    const headers=raw.map((value,index)=>canonicalHeader(confirmed.get(index)??value,schema.documentType));
    const keys=new Set(headers);
    // A variation reference on an instruction identifies its relationship. It
    // cannot turn the instruction's status into a duplicate variation status.
    if(schema.documentType==='variation_register'&&['instruction id','site instruction id','si id'].some(key=>keys.has(key))&&
      ['issue date','instruction date'].some(key=>keys.has(key))&&
      !['approved amount','submitted amount','claimed amount','agreed amount','assessed amount','approval date','submitted date','assessment date'].some(key=>keys.has(key)))return null;
    const groupHit=(group:string[])=>group.some(field=>keys.has(canonicalHeader(field,schema.documentType)));
    const requiredHits=schema.required.filter(groupHit).length;
    if(requiredHits!==schema.required.length)return null;
    const optionalHits=schema.optional.filter(field=>keys.has(canonicalHeader(field,schema.documentType))).length;
    const base=0.9+Math.min(0.06,optionalHits*0.015)+(schema.documentType===hintedDocumentType?0.02:0);
    return {route:{documentType:schema.documentType,category:schema.category,confidence:Math.min(0.99,Number(base.toFixed(3))),basis:[...schema.required.map(group=>'required:'+group.join('|')),...schema.optional.filter(field=>keys.has(canonicalHeader(field,schema.documentType))).map(field=>'optional:'+field)]},optionalHits};
  }).filter((value):value is {route:TableSemanticRoute;optionalHits:number}=>value!==null)
    .sort((a,b)=>b.route.confidence-a.route.confidence||b.optionalHits-a.optionalHits||a.route.documentType.localeCompare(b.route.documentType));
  if(!candidates.length)return null;
  if(candidates.length>1&&candidates[0]!.route.confidence-candidates[1]!.route.confidence<0.015){
    const hinted=candidates.find(c=>c.route.documentType===hintedDocumentType);
    if(hinted&&hinted.route.confidence>=0.92)return hinted.route;
    return null;
  }
  return candidates[0]!.route;
}

export function prepareEvidenceRows(
  input:readonly string[][],
  documentType='',
  confirmations:readonly EvidenceColumnConfirmation[]=[],
  semanticMeanings:readonly EvidenceSemanticColumnMeaning[]=[],
){
  const intelligence=analyzeEvidenceTable(input,confirmations);
  const meaningByColumn=new Map<number,string>();
  for(const item of semanticMeanings)meaningByColumn.set(item.columnIndex,item.meaning);
  for(const item of confirmations)meaningByColumn.set(item.columnIndex,item.meaning);
  const scoped=input.slice(intelligence.headerRowIndex).map((row,index)=>index===0
    ?row.map((value,columnIndex)=>meaningByColumn.get(columnIndex)??value)
    :[...row]);
  const prepared=prepareRegisterRows(scoped,documentType);
  return {
    ...prepared,
    headerRow:intelligence.headerRowIndex+prepared.headerRow,
    intelligence,
  };
}

const tableCache = new Map<string, SourceTable>();
export function sourceTables(documents: readonly EvidenceDocument[], diagnostics: string[], options: {includeHistorical?: boolean} = {}): SourceTable[] {
  const result: SourceTable[] = [], hashes = new Set<string>();
  for (const doc of [...documents].sort((a,b)=>Number(b.basisState!=='candidate')-Number(a.basisState!=='candidate'))) {
    const semanticReferenceCandidate=doc.basisState==='historical'&&['supporting_document','mixed_register_workbook'].includes(doc.documentType??'')&&(/csv/i.test(doc.mediaType+' '+doc.sourceFilename)||Boolean(doc.tabularRead));
    if ((!options.includeHistorical && !['active','additive','candidate'].includes(doc.basisState)&&!semanticReferenceCandidate) || (!/csv/i.test(doc.mediaType + ' ' + doc.sourceFilename)&&!doc.tabularRead)) continue;
    const identity = doc.sourceHashSha256;
    if (hashes.has(identity)) continue;
    hashes.add(identity);
    try {
      const stat = statSync(doc.storedPath);
      const confirmationFingerprint=createHash('sha256').update(JSON.stringify(doc.tableConfirmations??[])).digest('hex').slice(0,16);
      const semanticFingerprint=createHash('sha256').update(JSON.stringify([doc.csvSemantic??null,...(doc.tabularRead?.sheets.map(sheet=>('semantic' in sheet?sheet.semantic:null))??[])])).digest('hex').slice(0,16);
      const key = [doc.documentId, identity, doc.documentType, doc.tabularRead?.producerVersion, semanticFingerprint, doc.basisState, doc.linkedArtifactId, confirmationFingerprint, doc.storedPath, stat.size, stat.mtimeMs, stat.ctimeMs].join(':');
      const cached = tableCache.get(key); if (cached) { result.push(cached); continue; }
      const bytes = readFileSync(doc.storedPath);
      if (createHash('sha256').update(bytes).digest('hex') !== identity) { diagnostics.push('SOURCE_HASH_MISMATCH:' + doc.documentId); continue; }
      const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf16le' : 'utf8';
      const sheets=doc.tabularRead?.sourceHashSha256===identity?doc.tabularRead.sheets:[{name:'CSV',rows:csv(bytes.toString(encoding)),...(doc.csvSemantic?{semantic:doc.csvSemantic}:{})}];
      for(const sheet of sheets){
        const confirmations=(doc.tableConfirmations??[]).filter(c=>c.sheetName===sheet.name);
        const storedSemantic=('semantic' in sheet&&sheet.semantic?.documentType)?sheet.semantic:undefined;
        const inferred=storedSemantic?null:inferTableSemanticRoute(sheet.rows,doc.documentType,confirmations);
        const semanticType=storedSemantic?.documentType??inferred?.documentType??doc.documentType;
        const prepared=prepareEvidenceRows(sheet.rows,semanticType,confirmations,storedSemantic?.columnMeanings??[]),{headers,rows,intelligence}=prepared;
        const effectiveDocument=(storedSemantic||inferred)
          ?({...doc,documentType:semanticType} as EvidenceDocument)
          :doc;
        if(inferred&&inferred.documentType!==doc.documentType)diagnostics.push('TABLE_SEMANTIC_ROUTE:'+doc.documentId+':'+sheet.name+':'+doc.documentType+'->'+inferred.documentType);
        const absoluteHeaderRow=prepared.headerRow;
        if(!headers.length){diagnostics.push('TABLE_HEADERS_MISSING:'+doc.documentId+':'+sheet.name);continue;}
        if(rows.some(row=>row.length!==headers.length)){diagnostics.push('CSV_ROW_WIDTH_MISMATCH:'+doc.documentId);continue;}
        // A readable source table must never disappear merely because two raw
        // headings map to the same canonical meaning or one heading is blank.
        // Preserve every physical column with a stable unique internal key, but
        // fail closed for specialist recognition when the canonical meaning is
        // ambiguous: duplicate meanings are all suffixed, so has()/cell() cannot
        // silently select one of them as the authoritative field.
        const totals=new Map<string,number>();
        for(const [index,header] of headers.entries()){
          const base=header||('unlabelled column '+(index+1));
          totals.set(base,(totals.get(base)??0)+1);
        }
        const seen=new Map<string,number>();
        const sourceHeaders=headers.map((header,index)=>{
          const base=header||('unlabelled column '+(index+1)),total=totals.get(base)??1;
          if(total===1)return base;
          const ordinal=(seen.get(base)??0)+1;seen.set(base,ordinal);
          return base+' ['+ordinal+']';
        });
        const hasDuplicate=[...totals.values()].some(count=>count>1),hasBlank=headers.some(h=>!h);
        if(hasDuplicate)diagnostics.push('DUPLICATE_NORMALIZED_HEADERS:'+doc.documentId+':'+sheet.name);
        if(hasBlank)diagnostics.push('UNLABELLED_SOURCE_HEADERS:'+doc.documentId+':'+sheet.name);
        if(!prepared.recognized||hasDuplicate||hasBlank)diagnostics.push('REGISTER_COLUMNS_NOT_RECOGNISED:'+doc.documentId+':'+prepared.rawHeaders.join(', '));
        if(!intelligence.structurallyReadable)diagnostics.push('TABLE_STRUCTURE_REVIEW_REQUIRED:'+doc.documentId+':'+sheet.name);
        const table:SourceTable={headers:sourceHeaders,document:effectiveDocument,intelligence,recognition:{headerRow:absoluteHeaderRow,readRowCount:prepared.readRowCount,recognized:prepared.recognized&&!hasDuplicate&&!hasBlank,unknown:prepared.unknown},rows:rows.map((r,i)=>({
          cells:Object.freeze(Object.fromEntries(sourceHeaders.map((h,j)=>[h,r[j]??'']))),
          receipt:{documentId:doc.documentId,sourceHash:identity,revision:doc.linkedArtifactId??identity,locator:(sheet.name==='CSV'?'':'sheet:'+sheet.name+':')+'row:'+(i+absoluteHeaderRow+1),basisState:doc.basisState,authority:'source_record'},
        }))};
        // Multi-sheet workbooks remain distinct and retain their sheet/row references.
        if(sheets.length===1){if(tableCache.size>=64)tableCache.delete(tableCache.keys().next().value!);tableCache.set(key,table);}result.push(table);
      }
    } catch (error) { diagnostics.push('SOURCE_READ_FAILURE:' + doc.documentId + ':' + (error instanceof Error ? error.message : 'unknown')); }
  }
  return result;
}
export const has = (table: SourceTable, ...headers: string[]): boolean => headers.every(h => table.headers.includes(headerKey(h)));

/** A pending revision cannot displace an established source of the same role. */
export function governedTables(documents: readonly EvidenceDocument[], diagnostics: string[]): SourceTable[] {
  const tables = sourceTables(documents, diagnostics);
  const established = new Set(tables.filter(t => ['active','additive'].includes(t.document.basisState)).map(t => t.document.familyKey).filter(Boolean));
  return tables.filter(t => {
    if (t.document.basisState === 'candidate' && t.document.familyKey && established.has(t.document.familyKey)) {
      diagnostics.push('CANDIDATE_REVISION_NOT_APPLIED:' + t.document.documentId); return false;
    }
    return true;
  });
}

/** Date-only reporting cutoff. Missing dates never acquire current-period authority. */
export function reportingScope(date: string | null | undefined, dataDate: string | null | undefined): 'as_of' | 'future' | 'undated' {
  const d=dateValue(date??''),cutoff=dateValue(dataDate??'');
  return !d||!cutoff?'undated':d<=cutoff?'as_of':'future';
}
