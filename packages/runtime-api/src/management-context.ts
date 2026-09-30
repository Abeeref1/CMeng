import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ProjectRuntimeState} from './project-state-types';
import {projectControlSchedule} from './canonical-time-claims';
import {boqScopeIntelligence} from './boq-scope-intelligence';
import {managementSourceInventory} from './management-source-inventory';

export interface ScheduleLongLeadEvidence {
  activityId: string;
  name: string | null;
  wbsId: string | null;
  wbsPath: string | null;
  currentStartIso: string | null;
  currentFinishIso: string | null;
  totalFloatHours: number | null;
  percentComplete: number | null;
  basis: 'schedule_text';
}

function wbsPathById(model: CanonicalScheduleModel): Map<string,string> {
  const nodes = new Map(model.wbs.map(node => [node.wbsId, node]));
  const cache = new Map<string,string>();
  const pathFor = (id: string | null): string => {
    if (!id) return '';
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    const parts: string[] = [];
    const seen = new Set<string>();
    let current: string | null = id;
    while (current && !seen.has(current)) {
      seen.add(current);
      const node = nodes.get(current);
      if (!node) break;
      parts.unshift(node.name ?? node.wbsId);
      current = node.parentWbsId ?? null;
    }
    const value = parts.join(' / ');
    cache.set(id, value);
    return value;
  };
  for (const id of nodes.keys()) pathFor(id);
  return cache;
}

const longLeadPattern = /\blong[\s-]?lead\b|\bprocurement\b|\bmaterial procurement\b|\bprocure(?:ment|d)?\b|\bmanufactur(?:e|ing)\b|\bfabrication\b|\bvendor\b/i;

export function scheduleLongLeadEvidence(
  model: CanonicalScheduleModel,
): ScheduleLongLeadEvidence[] {
  const paths = wbsPathById(model);
  return model.activities
    .filter(activity => !['level_of_effort','wbs_summary'].includes(activity.activityType))
    .filter(activity => {
      const text = [
        activity.name,
        activity.wbsId ? paths.get(activity.wbsId) : null,
      ].filter(Boolean).join(' | ');
      return longLeadPattern.test(text);
    })
    .map(activity => ({
      activityId: activity.activityId,
      name: activity.name,
      wbsId: activity.wbsId,
      wbsPath: activity.wbsId ? paths.get(activity.wbsId) ?? null : null,
      currentStartIso: activity.currentStartIso,
      currentFinishIso: activity.currentFinishIso,
      totalFloatHours: activity.totalFloatHours,
      percentComplete: activity.percentComplete,
      basis: 'schedule_text' as const,
    }));
}

export function projectManagementContext(state: ProjectRuntimeState) {
  const schedule = projectControlSchedule(state)?.revision.model ?? null;
  const scheduleLongLead = schedule ? scheduleLongLeadEvidence(schedule) : [];
  const boq = boqScopeIntelligence(state);
  const sourceInventory = managementSourceInventory(state);
  return {
    projectId: state.projectId,
    dataDateIso: schedule?.dataDateIso ?? null,
    schedule: schedule ? {
      revisionId: schedule.sourceRevisionId,
      activityCount: schedule.activities.length,
      relationshipCount: schedule.relationships.length,
      longLeadEvidence: scheduleLongLead,
    } : null,
    boq: {
      itemCount: boq.itemCount,
      candidateLongLeadCount: boq.longLead.length,
      candidatePackageCount: boq.packages.length,
      basis: boq.basis,
    },
    sourceInventory,
  };
}
