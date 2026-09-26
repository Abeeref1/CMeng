import {buildQuantityScheduleMapping, type QuantityScheduleMappingResult} from '../../cross-domain-mapping/src';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ProjectRuntimeState} from './project-state-types';

const mappings = new WeakMap<ProjectRuntimeState, {
  version: number;
  quantities: ProjectRuntimeState['quantities'];
  schedule: CanonicalScheduleModel;
  result: QuantityScheduleMappingResult | null;
}>();

/** All pages in one project version share the same mapping calculation. Source
 * changes advance the version; replacing either model also invalidates reuse. */
export function quantityMappingForState(state: ProjectRuntimeState, schedule: CanonicalScheduleModel) {
  const cached = mappings.get(state);
  if (cached?.version === state.version && cached.quantities === state.quantities && cached.schedule === schedule) {
    return cached.result;
  }
  const result = state.quantities ? buildQuantityScheduleMapping(state.quantities, schedule) : null;
  mappings.set(state, {version: state.version, quantities: state.quantities, schedule, result});
  return result;
}
