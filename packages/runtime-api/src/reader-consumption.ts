import type {ProjectRuntimeState} from './project-state-types';
import {canonicalTimeClaims,projectDataDate} from './canonical-time-claims';
import {commercialCanonical} from './commercial-canonical';
import {operationalControlsAsOf} from './operational-reporting';
import {deliveryRecords} from './delivery-records';

/** M2.1: run the shared register readers for the current project version, so
 * the column report reflects what each reader consumed. Each reader is cached
 * per project version; this only reads what has not been read yet. */
export function runRegisterReaders(state:ProjectRuntimeState):void{
  for(const read of [()=>canonicalTimeClaims(state),()=>commercialCanonical(state),()=>operationalControlsAsOf(state,projectDataDate(state)),()=>deliveryRecords(state)]){
    try{read();}catch{/* a reader that cannot run reads nothing; its columns stay not used */}
  }
}
