import type {ProjectRuntimeState} from './project-state-types';
import {programmeRecordsProgress} from '../../schedule-analysis-core/src/population';

/** Mechanism 4 (baseline-only state), one rule for every producer and page: how many programme files
 * the project holds and whether the current one records any progress. */
export interface ProgrammeState {
  /** Distinct programme files (by content), scenarios excluded. */
  programmeCount:number;
  /** Any actual start or finish, progress percentage or started status in the current programme. */
  progressRecorded:boolean;
  /** One programme file and no progress: the baseline is the only programme. */
  baselineOnly:boolean;
  statement:string;
}
export function programmeStateFor(state:Pick<ProjectRuntimeState,'schedules'>,model:{activities:ReadonlyArray<{status?:string|null;actualStartIso?:string|null;actualFinishIso?:string|null;percentComplete?:number|null}>}|null):ProgrammeState|null{
  if(!model)return null;
  const programmeCount=new Set(state.schedules.filter(s=>s.role!=='scenario').map(s=>s.sourceHashSha256)).size;
  const progressRecorded=programmeRecordsProgress(model.activities as never);
  const baselineOnly=programmeCount<=1&&!progressRecorded;
  return {programmeCount,progressRecorded,baselineOnly,
    statement:baselineOnly?'Only the baseline programme is supplied. Progress and programme movement can be measured after the first update.'
      :!progressRecorded?'No progress is recorded in the current programme yet.':'Progress is recorded in the current programme.'};
}

/** Mechanism 4 (matrix 15 Nov 2026, DMCC-UPD2 "Largest movement 0 days vs controlled baseline"): the baseline
 * a movement or variance is measured against. Never the current programme itself: a baseline that is the
 * current revision or the same file gives no comparison. */
export function comparisonBaseline<T extends {role:string;sourceHashSha256?:string|null;revision:{revisionId:string}}>(
  ordered:readonly T[],current:{sourceHashSha256?:string|null;revision:{revisionId:string}}|null|undefined):T|null{
  const baseline=ordered.filter(item=>item.role==='revised_baseline'||item.role==='baseline').at(-1)??null;
  if(!baseline||!current)return baseline;
  if(baseline.revision.revisionId===current.revision.revisionId)return null;
  if(baseline.sourceHashSha256&&baseline.sourceHashSha256===current.sourceHashSha256)return null;
  return baseline;
}
