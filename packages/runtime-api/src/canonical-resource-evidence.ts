import { cell, has, numberValue, dateValue, governedTables, sumKnown, ratio, round, type SourceReceipt, type SourceRow, type SourceTable } from '../../truth-kernel/src';
import type { StoredEvidenceDocument } from './project-state-types';
export interface WeeklyResourceCapacityPoint {
  resourceId: string; resourceName: string | null; weekStartIso: string | null;
  resourceClass: string; availableCapacity: number | null; plannedDemand: number | null;
  actualApprovedUsage: number | null; forecastDemand: number | null;
  unit: string | null; sourceRef: string; receipts: SourceReceipt[];
}
export interface ResourceMasterRecord {
  resourceId: string; resourceUid: string; name: string; resourceClass: string;
  unit: string; utilizationApplicable: boolean | null; receipt: SourceReceipt;
}
export interface WeeklyResourceCapacitySummary {
  state: 'available' | 'partial' | 'candidate' | 'not_found';
  rowCount: number; comparableRowCount: number; resourceCount: number; weekCount: number; expectedResourceWeekCount: number; observedResourceCount: number;
  overloadedRowCount: number; actualOverloadedRowCount: number;
  capacityCoveragePercent: number | null; unitLabels: string[]; sourceBasisStates: string[];
  candidateDocumentCount: number; points: WeeklyResourceCapacityPoint[];
  weeklyTotals: Array<{ unit: string; resourceClass: string; weekStartIso: string | null; availableCapacity: number | null; plannedDemand: number | null; actualApprovedUsage: number | null; comparableResourceCount: number; sourceResourceCount: number; actualKnownResourceCount: number; plannedKnownResourceCount: number }>;
  masterResources: ResourceMasterRecord[]; approvedActualUsageRowCount: number;
  assignmentTimephaseRowCount: number; monthlySummaryRowCount: number;
  dataDateIso: string | null; plannedAverageToDataDate: number | null; actualAverageToDataDate: number | null;
  resourceSummaries: Array<{ resourceId: string; resourceName: string | null; resourceClass: string; unit: string | null; periodCount: number; plannedPeriodCountToDataDate: number; actualPeriodCountToDataDate: number; plannedOverloadOccurrences: number; actualOverloadOccurrencesToDataDate: number; plannedUtilizationPercent: number | null; actualUtilizationPercent: number | null }>;
  reconciliation: Array<{ metric: string; reported: number | null; computed: number | null; state: 'matched' | 'conflicted' | 'unresolved'; receipt: SourceReceipt }>;
  aggregationMethod?: string;
  overloadPeriods?: { planned: "full_source_horizon"; actual: "through_data_date" };
  plannedComparablePeriodsToDataDate?: number; actualComparablePeriodsToDataDate?: number;
  actualPeriodCoveragePercent?: number | null;
  diagnostics: string[];
}
const n = (row: SourceRow, ...names: string[]) => numberValue(cell(row, ...names));
const masterClass = (s: string): string => /^(labor|labour)$/i.test(s) ? 'labor' : /^(equipment|nonlabor|nonlabour)$/i.test(s) ? 'equipment' : /^(material|mat)$/i.test(s) ? 'material' : 'unknown';
const unitClass = (unit: string): string => /^(labor_hour|labour_hour)$/i.test(unit) ? 'labor' : unit === 'equipment_hour' ? 'equipment' : 'unknown';
function key(row: SourceRow): string { return [cell(row,'resource id'), dateValue(cell(row,'week start','period start')), cell(row,'unit','uom')].join('|'); }
function collectUnique(tables: SourceTable[], predicate: (t: SourceTable) => boolean, diagnostics: string[]): SourceRow[] {
  const byKey = new Map<string, SourceRow>(); const conflicted = new Set<string>();
  for (const t of tables.filter(predicate)) for (const row of t.rows) {
    const k = key(row); const previous = byKey.get(k);
    if (previous && JSON.stringify(previous.cells) !== JSON.stringify(row.cells)) { conflicted.add(k); diagnostics.push('CONFLICTING_RESOURCE_PERIOD:' + k); }
    else byKey.set(k, row);
  }
  return [...byKey.entries()].filter(([k]) => !conflicted.has(k)).map(([,r]) => r);
}
export function weeklyResourceCapacityEvidence(documents: readonly StoredEvidenceDocument[], dataDateIso: string | null = null): WeeklyResourceCapacitySummary {
  const diagnostics: string[] = [], tables = governedTables(documents, diagnostics);
  const masterTables = tables.filter(t => has(t,'resource id','utilization applicable','class','unit'));
  const masterResources: ResourceMasterRecord[] = masterTables.flatMap(t => t.rows.map(r => ({
    resourceId: cell(r,'resource id'), resourceUid: cell(r,'resource uid'), name: cell(r,'resource name'),
    resourceClass: masterClass(cell(r,'class')), unit: cell(r,'unit'), utilizationApplicable: /^(yes|true|1)$/i.test(cell(r,'utilization applicable')) ? true : /^(no|false|0)$/i.test(cell(r,'utilization applicable')) ? false : null, receipt: r.receipt,
  })));
  const master = new Map(masterResources.map(r => [r.resourceId,r]));
  const weeklySchema = (t: SourceTable) => has(t,'resource id','available capacity','planned demand') && (has(t,'week start') || has(t,'period start'));
  const weekly = collectUnique(tables, weeklySchema, diagnostics);
  const actualRows = collectUnique(tables, t => has(t,'resource id','week start','actual approved usage','source status') && !has(t,'available capacity'), diagnostics);
  const actual = new Map(actualRows.filter(r => /^approved$/i.test(cell(r,'source status'))).map(r => [key(r),r]));
  const points: WeeklyResourceCapacityPoint[] = [];
  for (const r of weekly) {
    const id = cell(r,'resource id'), definition = master.get(id), unit = cell(r,'unit','uom') || definition?.unit || null;
    const resourceClass = definition?.resourceClass ?? masterClass(cell(r,'class','resource class'));
    const resolvedClass = resourceClass === 'unknown' && unit ? unitClass(unit) : resourceClass;
    if (!id || definition?.utilizationApplicable === false || resolvedClass === 'material') continue;
    const expectedClass = unit ? unitClass(unit) : 'unknown';
    const unitConflict = !!definition && definition.unit !== unit || expectedClass !== 'unknown' && resolvedClass !== expectedClass;
    if (unitConflict) diagnostics.push('RESOURCE_UNIT_CLASS_CONFLICT:' + id);
    const approved = actual.get(key(r));
    const embeddedUsage = n(r,'actual approved usage');
    let usage: number | null = null;
    if (approved) {
      const measured = n(approved,'actual approved usage');
      if (embeddedUsage !== null && measured !== null && Math.abs(embeddedUsage - measured) > 0.000001) {
        diagnostics.push('ACTUAL_USAGE_RECONCILIATION_CONFLICT:' + key(r));
      } else {
        usage = measured;
      }
    } else if (embeddedUsage !== null && embeddedUsage !== 0) {
      diagnostics.push('UNAPPROVED_EMBEDDED_ACTUAL_USAGE_WITHHELD:' + key(r));
    }
    const period = dateValue(cell(r,'week start','period start'));
    const cutoffDate = dataDateIso ? dateValue(dataDateIso) : null;
    if (usage !== null && (!cutoffDate || !period || period > cutoffDate)) {
      diagnostics.push('ACTUAL_USAGE_OUTSIDE_ESTABLISHED_DATA_DATE_WITHHELD:' + key(r));
      usage = null;
    }
    const capacity = n(r,'available capacity'), demand = n(r,'planned demand');
    const valid = !unitConflict && unit !== null && resolvedClass !== 'unknown';
    // Unclassified resources remain visible, but never join a comparable aggregate.
    points.push({ resourceId:id, resourceName:definition?.name ?? (cell(r,'resource name') || null),
      resourceClass:resolvedClass, weekStartIso:dateValue(cell(r,'week start','period start')),
      availableCapacity:valid && capacity !== null && capacity >= 0 ? capacity : null,
      plannedDemand:valid && demand !== null && demand >= 0 ? demand : null,
      actualApprovedUsage:valid && usage !== null && usage >= 0 ? usage : null,
      forecastDemand:valid ? n(r,'forecast demand') : null, unit,
      sourceRef:'evidence-document:' + r.receipt.documentId + ':' + r.receipt.locator,
      receipts:[r.receipt, ...(approved ? [approved.receipt] : []), ...(definition ? [definition.receipt] : [])],
    });
  }
  const comparable = points.filter(p => p.weekStartIso !== null && p.availableCapacity !== null && p.plannedDemand !== null);
  const groups = new Map<string,WeeklyResourceCapacityPoint[]>();
  for (const p of points) { const k = [p.resourceClass,p.unit,p.weekStartIso].join('|'); const group=groups.get(k) ?? []; group.push(p); groups.set(k,group); }
  const sumComplete = (values: Array<number | null>): number | null => values.length && values.every(v => v !== null) ? sumKnown(values) : null;
  const weeklyTotals = [...groups.values()].map(rows => ({ unit:rows[0]!.unit ?? 'UNSPECIFIED', resourceClass:rows[0]!.resourceClass, weekStartIso:rows[0]!.weekStartIso,
    availableCapacity:sumComplete(rows.map(p=>p.availableCapacity)), plannedDemand:sumComplete(rows.map(p=>p.plannedDemand)), actualApprovedUsage:sumComplete(rows.map(p=>p.actualApprovedUsage)), sourceResourceCount:rows.length, actualKnownResourceCount:rows.filter(p=>p.actualApprovedUsage!==null).length, plannedKnownResourceCount:rows.filter(p=>p.plannedDemand!==null).length, comparableResourceCount:rows.filter(p=>p.availableCapacity!==null && p.plannedDemand!==null).length,
  })).sort((a,b)=>a.unit.localeCompare(b.unit)||(a.weekStartIso??'').localeCompare(b.weekStartIso??''));
  const cutoff = dataDateIso ? dateValue(dataDateIso) : null;
  const toDate = cutoff ? points.filter(p=>p.weekStartIso!==null && p.weekStartIso<=cutoff) : [];
  const mean = (rows: WeeklyResourceCapacityPoint[], field:'plannedDemand'|'actualApprovedUsage') => {
    const rates = rows.map(p=>ratio(p[field],p.availableCapacity)).filter((v):v is number=>v!==null);
    return rates.length ? round(rates.reduce((a,b)=>a+b,0)/rates.length*100) : null;
  };
  if (!cutoff && points.length) diagnostics.push('RESOURCE_DATA_DATE_NOT_ESTABLISHED_AVERAGES_WITHHELD');
  const byResource = new Map<string,WeeklyResourceCapacityPoint[]>();
  for (const p of points) { const list=byResource.get(p.resourceId)??[];list.push(p);byResource.set(p.resourceId,list); }
  const expectedResourceCount = masterResources.filter(m=>m.utilizationApplicable===true&&m.resourceClass!=='material').length || byResource.size;
  const weekCount = new Set(points.map(p=>p.weekStartIso).filter(Boolean)).size;
  const expectedResourceWeekCount = expectedResourceCount * weekCount;
  if (expectedResourceWeekCount > comparable.length) diagnostics.push('RESOURCE_PERIOD_POPULATION_INCOMPLETE');
  const contributingDocs = new Set(points.flatMap(p=>p.receipts.map(r=>r.documentId)));
  const contributors = documents.filter(d=>contributingDocs.has(d.documentId));
  const candidateCount = contributors.filter(d=>d.basisState==='candidate').length;
  const result: WeeklyResourceCapacitySummary = {
    state: !points.length ? 'not_found' : candidateCount ? 'candidate' : diagnostics.some(d=>/CONFLICT|MISMATCH|FAILURE/.test(d)) || comparable.length!==points.length || expectedResourceWeekCount>comparable.length || !cutoff ? 'partial':'available',
    rowCount:points.length, comparableRowCount:comparable.length, resourceCount:expectedResourceCount, observedResourceCount:byResource.size, expectedResourceWeekCount,
    weekCount:new Set(points.map(p=>p.weekStartIso).filter(Boolean)).size,
    overloadedRowCount:comparable.filter(p=>p.plannedDemand!>p.availableCapacity!).length,
    actualOverloadedRowCount:points.filter(p=>p.actualApprovedUsage!==null && p.availableCapacity!==null && p.actualApprovedUsage>p.availableCapacity).length,
    capacityCoveragePercent:expectedResourceWeekCount ? round(comparable.length/expectedResourceWeekCount*100):null,
    unitLabels:[...new Set(points.map(p=>p.unit).filter((v):v is string=>v!==null))],
    sourceBasisStates:[...new Set(contributors.map(d=>d.basisState))],candidateDocumentCount:candidateCount,points,weeklyTotals,masterResources,
    approvedActualUsageRowCount:actual.size,
    assignmentTimephaseRowCount:tables.filter(t=>has(t,'assignment id','activity id','week start','planned quantity')).reduce((n,t)=>n+t.rows.length,0),
    monthlySummaryRowCount:tables.filter(t=>has(t,'resource id','month','planned utilization %')).reduce((n,t)=>n+t.rows.length,0),
    dataDateIso:cutoff,plannedAverageToDataDate:mean(toDate,'plannedDemand'),actualAverageToDataDate:mean(toDate,'actualApprovedUsage'),
    resourceSummaries:[...byResource.values()].map(rows=>({ resourceId:rows[0]!.resourceId,resourceName:rows[0]!.resourceName,resourceClass:rows[0]!.resourceClass,unit:rows[0]!.unit,periodCount:rows.length,
      plannedPeriodCountToDataDate: rows.filter(p=>cutoff&&p.weekStartIso&&p.weekStartIso<=cutoff&&p.plannedDemand!==null&&p.availableCapacity!==null&&p.availableCapacity>0).length,
      actualPeriodCountToDataDate: rows.filter(p=>cutoff&&p.weekStartIso&&p.weekStartIso<=cutoff&&p.actualApprovedUsage!==null&&p.availableCapacity!==null&&p.availableCapacity>0).length,
      plannedOverloadOccurrences: rows.filter(p=>p.plannedDemand!==null&&p.availableCapacity!==null&&p.plannedDemand>p.availableCapacity).length,
      actualOverloadOccurrencesToDataDate: rows.filter(p=>p.actualApprovedUsage!==null&&p.availableCapacity!==null&&p.actualApprovedUsage>p.availableCapacity).length,
      plannedUtilizationPercent:mean(cutoff?rows.filter(p=>p.weekStartIso!==null && p.weekStartIso<=cutoff):[],'plannedDemand'),actualUtilizationPercent:mean(cutoff?rows.filter(p=>p.weekStartIso!==null && p.weekStartIso<=cutoff):[],'actualApprovedUsage') })),
    aggregationMethod: "Arithmetic mean of individual known resource-week demand/capacity ratios; positive capacity required. Periods are included by source week start on or before the Data Date. Ratios are not a ratio of mixed-unit totals.",
    overloadPeriods: { planned: "full_source_horizon", actual: "through_data_date" },
    plannedComparablePeriodsToDataDate: toDate.filter(p=>p.availableCapacity!==null&&p.availableCapacity>0&&p.plannedDemand!==null).length,
    actualComparablePeriodsToDataDate: toDate.filter(p=>p.availableCapacity!==null&&p.availableCapacity>0&&p.actualApprovedUsage!==null).length,
    actualPeriodCoveragePercent: toDate.length ? round(toDate.filter(p=>p.actualApprovedUsage!==null).length/toDate.length*100) : null,
    reconciliation:[],diagnostics,
  };
  const metrics:Record<string,number|null>={ 'utilization applicable resources':result.resourceCount,'weekly utilization rows':result.rowCount,'approved actual usage rows':result.approvedActualUsageRowCount,
    'planned overallocated resource weeks':result.overloadedRowCount,'actual overallocated resource weeks':result.actualOverloadedRowCount,
    'average planned utilization to data date':result.plannedAverageToDataDate,'average actual utilization to data date':result.actualAverageToDataDate };
  for (const t of tables.filter(t=>has(t,'metric','value','source'))) for (const r of t.rows) {
    const metric=cell(r,'metric').toLowerCase().replace(/-/g,' '); if (!(metric in metrics)) continue;
    const computed=metrics[metric]??null, reported=n(r,'value');
    const state=computed===null||reported===null?'unresolved':Math.abs(computed-reported)<0.005?'matched':'conflicted';
    result.reconciliation.push({metric,computed,reported,state,receipt:r.receipt});
    if(state==='conflicted'){result.state='partial';diagnostics.push('RESOURCE_HEADLINE_MISMATCH:'+metric);}
  }
  return result;
}
