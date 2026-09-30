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

export type ProgrammeControlStage = 'design' | 'procurement' | 'construction' | 'testing_commissioning' | 'handover' | 'other';

export interface ProgrammeControlStagePosition {
  stage: ProgrammeControlStage;
  label: string;
  activityCount: number;
  openActivityCount: number;
  criticalOrNegativeFloatCount: number;
  earliestStartIso: string | null;
  latestFinishIso: string | null;
  sampleActivities: Array<{activityId:string;name:string|null;wbsPath:string|null;finishIso:string|null;totalFloatHours:number|null}>;
  basis: 'observed_programme_structure';
}

const stageRules: Array<{stage:ProgrammeControlStage;label:string;pattern:RegExp}> = [
  {stage:'design',label:'Design & approvals',pattern:/\bdesign\b|\bdrawing\b|\bshop drawing\b|\brfi\b|\bsubmittal\b|\bapproval\b|\bengineering\b/i},
  {stage:'procurement',label:'Procurement & long lead',pattern:/\blong[\s-]?lead\b|\bprocurement\b|\bmaterial\b|\bvendor\b|\bmanufactur(?:e|ing)\b|\bfabrication\b|\bdelivery\b/i},
  {stage:'testing_commissioning',label:'Testing & commissioning',pattern:/\btest(?:ing)?\b|\bcommission(?:ing)?\b|\benerg(?:ise|ize|isation|ization)\b|\bstart[\s-]?up\b/i},
  {stage:'handover',label:'Handover & closeout',pattern:/\bhandover\b|\bclose[\s-]?out\b|\bsnag\b|\bas[\s-]?built\b|\bo\s*&\s*m\b|\btaking over\b/i},
  {stage:'construction',label:'Construction',pattern:/\bconstruct(?:ion)?\b|\binstall(?:ation|ing)?\b|\bcivil\b|\bstructur(?:al|e)\b|\bexcavat(?:e|ion)\b|\bconcrete\b|\bmep\b|\bmechanical\b|\belectrical\b|\bpipe(?:work)?\b/i},
];

export function programmeControlStages(model: CanonicalScheduleModel): ProgrammeControlStagePosition[] {
  const paths=wbsPathById(model);
  const buckets=new Map<ProgrammeControlStage,Array<typeof model.activities[number]>>();
  const stageFor=(activity:typeof model.activities[number]):ProgrammeControlStage=>{
    const text=[activity.name,activity.wbsId?paths.get(activity.wbsId):null].filter(Boolean).join(' | ');
    return stageRules.find(rule=>rule.pattern.test(text))?.stage??'other';
  };
  for(const activity of model.activities){
    if(['level_of_effort','wbs_summary'].includes(activity.activityType))continue;
    const stage=stageFor(activity),rows=buckets.get(stage)??[];rows.push(activity);buckets.set(stage,rows);
  }
  const ordered:ProgrammeControlStage[]=['design','procurement','construction','testing_commissioning','handover','other'];
  return ordered.flatMap(stage=>{
    const rows=buckets.get(stage)??[];if(!rows.length)return [];
    const datesStart=rows.map(r=>r.currentStartIso).filter((v):v is string=>!!v).sort();
    const datesFinish=rows.map(r=>r.forecastFinishIso??r.currentFinishIso).filter((v):v is string=>!!v).sort();
    const open=rows.filter(r=>r.status!=='completed');
    const pressure=open.filter(r=>typeof r.totalFloatHours==='number'&&r.totalFloatHours<=0);
    const rule=stageRules.find(r=>r.stage===stage);
    return [{
      stage,label:rule?.label??'Other programme scope',activityCount:rows.length,openActivityCount:open.length,
      criticalOrNegativeFloatCount:pressure.length,earliestStartIso:datesStart[0]??null,latestFinishIso:datesFinish.at(-1)??null,
      sampleActivities:[...open].sort((a,b)=>(a.totalFloatHours??Number.MAX_SAFE_INTEGER)-(b.totalFloatHours??Number.MAX_SAFE_INTEGER))
        .slice(0,5).map(r=>({activityId:r.activityId,name:r.name,wbsPath:r.wbsId?paths.get(r.wbsId)??null:null,
          finishIso:r.forecastFinishIso??r.currentFinishIso,totalFloatHours:r.totalFloatHours})),
      basis:'observed_programme_structure' as const,
    }];
  });
}

export function projectManagementContext(state: ProjectRuntimeState) {
  const schedule = projectControlSchedule(state)?.revision.model ?? null;
  const scheduleLongLead = schedule ? scheduleLongLeadEvidence(schedule) : [];
  const programmeStages = schedule ? programmeControlStages(schedule) : [];
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
      programmeStages,
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
