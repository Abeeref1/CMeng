import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ModuleRuntimeResult,ProjectRuntimeState} from './project-state-types';
import type {CommercialControlPosition} from '../../commercial-control/src';
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
  activityIds: string[];
  wbsIds: string[];
  wbsPaths: string[];
  controlMilestoneIds: string[];
  dependencyStages: ProgrammeControlStage[];
  earliestStartIso: string | null;
  latestFinishIso: string | null;
  earliestCurrentStartIso: string | null;
  latestCurrentFinishIso: string | null;
  latestForecastFinishIso: string | null;
  lowestFloatHours: number | null;
  sampleActivities: Array<{
    activityId:string;name:string|null;wbsPath:string|null;
    currentFinishIso:string|null;forecastFinishIso:string|null;finishIso:string|null;totalFloatHours:number|null
  }>;
  basis: 'observed_programme_structure';
}

const stageRules: Array<{stage:ProgrammeControlStage;label:string;pattern:RegExp}> = [
  {stage:'design',label:'Design & approvals',pattern:/\bdesign\b|\bdrawing\b|\bshop drawing\b|\brfi\b|\bsubmittal\b|\bapproval\b|\bengineering\b/i},
  {stage:'procurement',label:'Procurement & long lead',pattern:/\blong[\s-]?lead\b|\bprocurement\b|\bmaterial\b|\bvendor\b|\bmanufactur(?:e|ing)\b|\bfabrication\b|\bdelivery\b/i},
  {stage:'testing_commissioning',label:'Testing & commissioning',pattern:/\btest(?:ing)?\b|\bcommission(?:ing)?\b|\benerg(?:ise|ize|isation|ization)\b|\bstart[\s-]?up\b/i},
  {stage:'handover',label:'Handover & closeout',pattern:/\bhandover\b|\bclose[\s-]?out\b|\b(?:de[ -]?)?snagg?(?:ing)?\b|\bas[\s-]?built\b|\bo\s*&\s*m\b|\btaking over\b/i},
  {stage:'construction',label:'Construction',pattern:/\bconstruct(?:ion)?\b|\binstall(?:ation|ing)?\b|\bcivil\b|\bstructur(?:al|e)\b|\bexcavat(?:e|ion)\b|\bconcrete\b|\bmep\b|\bmechanical\b|\belectrical\b|\bpipe(?:work)?\b|\bblockwork\b|\bplaster(?:ing)?\b|\bpaint(?:ing)?\b|\btil(?:e|ing)\b|\bwaterproof(?:ing)?\b|\broof(?:ing)?\b|\bbackfill(?:ing)?\b|\bformwork\b|\brebar\b|\bfa[cç]ade\b|\bcladding\b|\bdoors?\b|\bwindows?\b|\bceilings?\b|\bscreed\b|\bjoinery\b/i},
];

export function programmeControlStages(model: CanonicalScheduleModel): ProgrammeControlStagePosition[] {
  const paths=wbsPathById(model);
  const buckets=new Map<ProgrammeControlStage,Array<typeof model.activities[number]>>();
  const stageByActivity=new Map<string,ProgrammeControlStage>();
  const stageFor=(activity:typeof model.activities[number]):ProgrammeControlStage=>{
    const text=[activity.name,activity.wbsId?paths.get(activity.wbsId):null].filter(Boolean).join(' | ');
    const direct=stageRules.find(rule=>rule.pattern.test(activity.name??''));
    if(direct)return direct.stage;
    if(activity.activityType==='finish_milestone'&&/complet(?:e|ion)/i.test(activity.name??''))return 'handover';
    return stageRules.find(rule=>rule.pattern.test(text))?.stage??(/\binfrastructure\b|\broads?\b|\bpaving\b|\bdrainage\b|\bsewer\b|\birrigation\b|\bvillas?\b/i.test(text)?'construction':'other');
  };
  for(const activity of model.activities){
    if(['level_of_effort','wbs_summary'].includes(activity.activityType))continue;
    const stage=stageFor(activity),rows=buckets.get(stage)??[];
    rows.push(activity);buckets.set(stage,rows);stageByActivity.set(activity.activityId,stage);
  }
  const incomingStages=new Map<ProgrammeControlStage,Set<ProgrammeControlStage>>();
  for(const rel of model.relationships){
    if(rel.external)continue;
    const from=stageByActivity.get(rel.predecessorActivityId),to=stageByActivity.get(rel.successorActivityId);
    if(!from||!to||from===to)continue;
    const set=incomingStages.get(to)??new Set<ProgrammeControlStage>();set.add(from);incomingStages.set(to,set);
  }
  const ordered:ProgrammeControlStage[]=['design','procurement','construction','testing_commissioning','handover','other'];
  return ordered.flatMap(stage=>{
    const rows=buckets.get(stage)??[];if(!rows.length)return [];
    const currentStarts=rows.map(r=>r.currentStartIso).filter((v):v is string=>!!v).sort();
    const currentFinishes=rows.map(r=>r.currentFinishIso).filter((v):v is string=>!!v).sort();
    const effectiveFinishes=rows.map(r=>r.forecastFinishIso??r.currentFinishIso).filter((v):v is string=>!!v).sort();
    const open=rows.filter(r=>r.status!=='completed');
    const pressure=open.filter(r=>typeof r.totalFloatHours==='number'&&r.totalFloatHours<=0);
    const knownFloat=open.map(r=>r.totalFloatHours).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));
    const rule=stageRules.find(r=>r.stage===stage);
    const wbsIds=[...new Set(rows.map(r=>r.wbsId).filter((v):v is string=>!!v))];
    const wbsPaths=[...new Set(wbsIds.map(id=>paths.get(id)??id))];
    const controlMilestoneIds=rows.filter(r=>['milestone','start_milestone','finish_milestone'].includes(r.activityType)).map(r=>r.activityId);
    return [{
      stage,label:rule?.label??'Other programme scope',activityCount:rows.length,openActivityCount:open.length,
      criticalOrNegativeFloatCount:pressure.length,
      activityIds:rows.map(r=>r.activityId),wbsIds,wbsPaths,controlMilestoneIds,
      dependencyStages:[...(incomingStages.get(stage)??new Set<ProgrammeControlStage>())],
      earliestStartIso:currentStarts[0]??null,latestFinishIso:effectiveFinishes.at(-1)??null,
      earliestCurrentStartIso:currentStarts[0]??null,latestCurrentFinishIso:currentFinishes.at(-1)??null,
      latestForecastFinishIso:effectiveFinishes.at(-1)??null,lowestFloatHours:knownFloat.length?Math.min(...knownFloat):null,
      sampleActivities:[...open].sort((a,b)=>(a.totalFloatHours??Number.MAX_SAFE_INTEGER)-(b.totalFloatHours??Number.MAX_SAFE_INTEGER))
        .slice(0,5).map(r=>({activityId:r.activityId,name:r.name,wbsPath:r.wbsId?paths.get(r.wbsId)??null:null,
          currentFinishIso:r.currentFinishIso,forecastFinishIso:r.forecastFinishIso,
          finishIso:r.forecastFinishIso??r.currentFinishIso,totalFloatHours:r.totalFloatHours})),
      basis:'observed_programme_structure' as const,
    }];
  });
}

export function projectManagementContext(
  state: ProjectRuntimeState,
  modules?: Map<string,ModuleRuntimeResult>,
  commercial?: CommercialControlPosition | null,
) {
  const schedule = projectControlSchedule(state)?.revision.model ?? null;
  const scheduleLongLead = schedule ? scheduleLongLeadEvidence(schedule) : [];
  const programmeStages = schedule ? programmeControlStages(schedule) : [];
  const boq = boqScopeIntelligence(state);
  const sourceInventory = managementSourceInventory(state);
  const moduleData=(key:string):any=>{
    const value=modules?.get(key)?.data;
    return value&&typeof value==='object'?value:{};
  };
  const activity=moduleData('activity-analytics');
  const independent=moduleData('independent-forecast');
  const milestones=moduleData('milestones');
  const change=moduleData('schedule-change-report');
  const revision=moduleData('revision-trend');
  const progress=moduleData('progress-report');
  const progressBreakdown=moduleData('progress-breakdown');
  const lookAhead=moduleData('lookahead-schedule');
  const quantities=moduleData('quantity-scurve');
  const delay=moduleData('delay-claims');
  const notices=moduleData('notices-claims');
  const eot=moduleData('eot-assessment');
  const resources=moduleData('resource-utilization');
  const manhours=moduleData('manhour-scurve');
  const source=(domain:string)=>sourceInventory.domains.find(row=>row.domain===domain)??null;
  const activityRows=Array.isArray(activity.rows)?activity.rows:[];
  const delayedActivities=activityRows.filter((row:any)=>row.scheduleDelayed===true||
    (typeof row.finishVarianceDays==='number'&&row.finishVarianceDays>0)).map((row:any)=>({
      activityId:row.activityId??null,name:row.name??null,wbsId:row.wbsId??null,wbsPath:row.wbsPath??null,
      currentStartIso:row.currentStartIso??null,currentFinishIso:row.forecastFinishIso??row.currentFinishIso??null,
      totalFloatHours:row.totalFloatHours??null,finishVarianceDays:row.finishVarianceDays??null,criticality:row.criticality??null,
    }));
  const milestoneRows=Array.isArray(milestones.rows)?milestones.rows:[];
  const interventions=Array.isArray(lookAhead.managementInterventions)?lookAhead.managementInterventions:[];
  const managedProgrammeStages=programmeStages.map(stage=>{
    const stageActivities=new Set(stage.activityIds??[]);
    const stageWbs=new Set(stage.wbsIds??[]);
    const relevant=interventions.filter((row:any)=>
      (row.wbsId&&stageWbs.has(row.wbsId))||
      (Array.isArray(row.activityIds)&&row.activityIds.some((id:string)=>stageActivities.has(id)))
    );
    const blockedActivities=[...new Set(relevant.flatMap((row:any)=>Array.isArray(row.activityIds)?row.activityIds:[]))];
    const owners=[...new Set(relevant.map((row:any)=>row.owner).filter((value:any)=>typeof value==='string'&&value.trim()))];
    const actions=[...new Set(relevant.map((row:any)=>row.action).filter((value:any)=>typeof value==='string'&&value.trim()))];
    const requiredDates=relevant.map((row:any)=>row.requiredByIso).filter((value:any):value is string=>typeof value==='string'&&value.length>0).sort();
    return {
      ...stage,
      readinessBlockerCount:blockedActivities.length,
      readinessBlockerTypes:[...new Set(relevant.map((row:any)=>row.blockerType).filter(Boolean))],
      readinessRequiredByIso:requiredDates[0]??null,
      owners,
      actions,
      longLeadExposure:stage.stage==='procurement'?{
        scheduleCandidateCount:scheduleLongLead.length,
        boqCandidateCount:boq.longLead.length,
        readableProcurementSourceRows:source('procurement')?.readableRowCount??null,
      }:null,
    };
  });
  return {
    projectId: state.projectId,
    dataDateIso: schedule?.dataDateIso ?? null,
    schedule: schedule ? {
      revisionId: schedule.sourceRevisionId,
      activityCount: schedule.activities.length,
      relationshipCount: schedule.relationships.length,
      longLeadEvidence: scheduleLongLead,
      programmeStages: managedProgrammeStages,
    } : null,
    boq: {
      itemCount: boq.itemCount,
      candidateLongLeadCount: boq.longLead.length,
      candidatePackageCount: boq.packages.length,
      basis: boq.basis,
    },
    sourceInventory,
    crossModule:{
      programme:{
        revisionId:schedule?.sourceRevisionId??null,
        dataDateIso:schedule?.dataDateIso??null,
        drivingNetwork:independent.drivingNetwork??null,
        delayedActivities,
        criticalCount:activity.counts?.critical?.value??null,
        nearCriticalCount:activity.counts?.nearCritical?.value??null,
        negativeFloatCount:activityRows.filter((row:any)=>typeof row.totalFloatHours==='number'&&row.totalFloatHours<0).length,
      },
      milestones:{
        rows:milestoneRows.map((row:any)=>({
          activityId:row.activityId??null,name:row.name??null,wbsId:row.wbsId??null,
          baselineDateIso:row.baselineDateIso??null,currentDateIso:row.currentDateIso??null,forecastDateIso:row.forecastDateIso??row.currentDateIso??null,
          totalFloatHours:row.totalFloatHours??null,criticality:row.criticality??null,managementPriority:row.managementPriority??null,
        })),
      },
      boq:{itemCount:boq.itemCount,candidateLongLeadCount:boq.longLead.length,candidatePackageCount:boq.packages.length,basis:boq.basis},
      quantities:{
        boqItemCount:quantities.boqItemCount??boq.itemCount??null,
        installedQuantityStatus:quantities.installedQuantityStatus??null,
        series:quantities.series??null,
      },
      procurement:{
        sourceEvidence:source('procurement'),
        scheduleLongLeadEvidence:scheduleLongLead,
        boqLongLeadCandidates:boq.longLead,
      },
      design:{sourceEvidence:source('design'),rfiSourceEvidence:source('design'),submittalSourceEvidence:source('submittal')},
      interfaces:{sourceEvidence:source('interfaces')},
      progress:{
        progressBases:progress.progressBases??null,
        scopeComparison:progress.scopeComparison??null,
        breakdown:progressBreakdown.rows??progressBreakdown.breakdown??null,
      },
      resources:{
        resourceCount:resources.resourceCount??resources.p6ResourceMasterCount??null,
        assignedResourceCount:resources.assignedResourceCount??null,
        utilization:resources.rows??null,
        plannedHours:manhours.plannedHours??manhours.plannedHoursKnown??null,
        actualHours:manhours.actualHours??manhours.actualHoursKnown??null,
        sourceEvidence:source('resources'),
      },
      commercial:commercial?{
        currencies:commercial.currencies.map(row=>({
          currency:row.currency,
          originalContractValue:row.originalContractValue.value,
          currentContractValue:row.currentContractValue.value,
          approvedVariationAmount:row.approvedVariationAmount.value,
          paidAmount:row.paidAmount.value,
        })),
      }:null,
      change:{
        fromRevisionId:change.fromRevisionId??null,toRevisionId:change.toRevisionId??null,
        addedActivityCount:change.addedActivityCount??null,removedActivityCount:change.removedActivityCount??null,modifiedActivityCount:change.modifiedActivityCount??null,
        revisionCount:revision.revisionCount??null,
      },
      claimsEot:{
        eventCount:delay.eventCount??null,
        claimCount:notices.claimCount??delay.claimCount??null,
        noticeCount:notices.noticeCount??null,
        officialApprovedEotDays:eot.officialApprovedEotDays??null,
        candidateAdditionalEotDays:eot.candidateAdditionalEotDays??null,
        sourceEvidence:source('claims'),
      },
      risk:{sourceEvidence:source('risk')},
      deliverySources:{
        procurement:source('procurement'),
        design:source('design'),
        submittal:source('submittal'),
        quality:source('quality'),
        hse:source('hse'),
        risk:source('risk'),
      },
    },
  };
}
