import {evidenceAvailabilityReview} from './evidence-availability-review';
import type {ProjectRuntimeState} from './project-state-types';
import type {ProgressReportProjection} from '../../progress-report/src';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {sourceProductivityForecastEvidence} from './source-productivity-forecast';
import {reviewScheduleCalendarBasis} from './schedule-calendar-review';
import {operationalReporting} from './reporting-state';
import {hseReportPosition} from './hse-report-evidence';
import {commercialPositionForState} from './commercial-runtime';

/** Shared source meaning accompanies API, management, reporting and AI results. */
export function sourceInterpretation(state:ProjectRuntimeState,progress?:ProgressReportProjection['progressBases'],calendarCompletionIso:string|null=null,scopeComparison:ProgressReportProjection['scopeComparison']=null){
  const model=projectControlSchedule(state)?.revision.model;
  const calendar=model?reviewScheduleCalendarBasis(model):null;
  const p=sourceProductivityForecastEvidence(state);
  const commercial=commercialPositionForState(state);
  const certificateGroups=commercial.certificateProfile?.groups??[];
  const risk=operationalReporting(state).risk.validation;
  const baseline=progress?.baselinePlanned.valuePercent??null,snapshot=progress?.scheduleSnapshot?.valuePercent??null;
  return {
    calendarRecalculatedFinishIso:calendarCompletionIso,
    calendarReview:calendar?{...calendar,rows:undefined}:null,
    productivityForecast:{completionIso:p.completionIso,authority:p.state==='official'?'governed_source':p.state,method:p.method,
      driverWorkPackageIds:p.driverWorkPackageIds,workPackageCount:p.workPackageCount,coveragePercent:p.calculationCoveragePercent,concentration:p.concentration??null,sourceRefs:p.sourceRefs,
      interpretation:'Productivity forecast; approval of the model does not amend contractual completion. Calendar-calculated rows and supplied model finish dates retain their own method.'},
    riskValidation:{...risk,scoreRows:undefined},
    actions:operationalReporting(state).actions,
    availability:evidenceAvailabilityReview(state),
    hse:hseReportPosition(state,projectDataDate(state)),
    progressMeasures:{baselinePlannedPercent:baseline,scheduleSnapshotPercent:snapshot,
      scopeComparison,
      snapshotMinusBaselinePercentagePoints:scopeComparison?.gapPercentagePoints??null,
      scheduleIndicativeRatio:scopeComparison?.ratio??null,
      mixedScopeDifferencePercentagePoints:baseline!==null&&snapshot!==null?snapshot-baseline:null,
      evm:(commercial.performance.costControl?.positions??[]).map(r=>({currency:r.currency,taxBasis:r.taxBasis,bac:r.bac.value,ev:r.ev.value,pv:r.pv.value,ac:r.ac.value,
        earnedValuePercentOfBac:r.ev.value!==null&&r.bac.value!==null&&r.bac.value>0?r.ev.value/r.bac.value*100:null,spi:r.spi.value})),
      certificatePeriods:certificateGroups.map(g=>({currency:g.currency,taxBasis:g.taxBasis,grossWork:g.totals?.grossWork??null,net:g.totals?.netCertifiedAmount??null,
        count:g.as_of.length,basis:g.totalLabel,certificationUnconfirmedCount:g.certificationUnconfirmedIds.length})),
      interpretation:'Schedule snapshot, time-phased baseline plan, earned value and certificate-period amounts use different weights and populations. The schedule ratio is an indicative comparison, not EVM SPI. Source certificate sums do not establish physical progress or cash.'},
  };
}
export type SourceInterpretation=ReturnType<typeof sourceInterpretation>;
