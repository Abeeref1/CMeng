/**
 * Mechanism 14: the shared saved schedule analysis. Every page, fact and
 * commercial control that analyses a programme model reads the one saved
 * result for that exact model and configuration (see programme-results.ts).
 */
import {analyzeSchedule,type CanonicalScheduleModel,type ScheduleAnalysisConfig} from '../../schedule-analysis-core/src';
import {savedProgrammeResult} from './programme-results';

export function savedScheduleAnalysis(model:CanonicalScheduleModel,config?:ScheduleAnalysisConfig|undefined){
  return savedProgrammeResult('schedule-analysis',[model,config??null],()=>analyzeSchedule(model,config));
}
