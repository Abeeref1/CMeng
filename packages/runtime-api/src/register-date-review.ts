import {cell,dateValue,sourceTables,type SourceTable} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';

const dateFields:Record<string,string[]>={
 quality_ncr_register:['raised date','issue date','status as of','closed date'],
 rfi_register:['raised date','due date','issue date','status as of'],
 risk_register:['identified date','raised date','status as of','closed date'],
 hse_incident_register:['incident date','raised date'],
 incident_register:['incident date','raised date'],
 hse_report:['report date','period end','incident date'],
 procurement_register:['required on site','forecast delivery','actual delivery','due date'],
 claims_register:['event start','notice date','submitted date'],
 claim_register:['event start','notice date','submitted date'],
 payment_certificate_register:['certificate date','period end','payment date'],
 payment_certificates:['certificate date','period end','payment date'],
 delay_eot_claims_register:['event start','notice date','determination date','submitted date'],
 variation_register:['approval date','submitted date'],
 design_deliverables:['planned issue','actual issue','due date'],
 testing_commissioning_register:['planned date','actual date'],
};
export function inspectRegisterDate(table:SourceTable,fields:string[]){
 const columns=fields.filter(f=>table.headers.includes(f));
 const total=table.rows.length;
 const populated=table.rows.filter(r=>cell(r,...fields)!=='').length;
 const valid=table.rows.filter(r=>dateValue(cell(r,...fields))!==null).length;
 const state=!columns.length?'column_not_found':!populated&&total?'values_empty':valid<total?'values_invalid_or_missing':'complete';
 return {documentId:table.document.documentId,filename:table.document.sourceFilename,documentType:table.document.documentType,
  fields,columns,total,populated,valid,missingPercent:total?(total-valid)/total*100:null,state,
  message:!columns.length?'Column not found: '+fields.join(' or '):!populated&&total?'Column found, values empty: '+columns.join(', '):valid===total?'Date column read: '+valid+' of '+total+' rows; 0% missing.':(total-valid)+' of '+total+' rows have empty or invalid dates in '+columns.join(', ')};
}
export function reviewRegisterDates(tables:SourceTable[]){
 const rows=tables.flatMap(t=>{const fields=dateFields[t.document.documentType??''];return fields?[inspectRegisterDate(t,fields)]:[];});
 const failed=rows.filter(r=>r.total>0&&r.valid===0);
 const independent=(items:typeof rows)=>new Set(items.map(r=>r.documentType)).size;
 const columnFailures=failed.filter(r=>r.state==='column_not_found');
 const valueFailures=failed.filter(r=>r.state!=='column_not_found');
 // A mapping fault is a reader concern only when several *different* register
 // families cannot match any expected date column. Registers that genuinely
 // contain no required lifecycle date stay as evidence gaps, not CMeng defects.
 const likelyMappingFault=independent(columnFailures)>=3;
 return {rows,likelyMappingFault,releaseReady:!likelyMappingFault,affectedRegisterCount:independent(failed),
  mappingFailureRegisterCount:independent(columnFailures),sourceDateGapRegisterCount:independent(valueFailures),
  message:likelyMappingFault?
    independent(columnFailures)+' register families have date columns that CMeng could not match. CMeng must check the reader before requesting replacement files.':
    failed.length?failed.length+' register file(s) need date review; missing source dates remain evidence gaps and are not treated as reader faults.':
    'Register dates were read; review individual gaps below.'};
}

const claimsDates = ['claims_register','claim_register','delay_eot_claims_register'];
const paymentDates = ['payment_certificate_register','payment_certificates'];
const operationalDates = ['quality_ncr_register','rfi_register','risk_register','hse_incident_register','incident_register','hse_report','procurement_register','design_deliverables','testing_commissioning_register'];
const dateDependencies: Record<string, readonly string[]> = {
  'payments': paymentDates, 'cash-flow': paymentDates,
  'variations-change': ['variation_register'],
  'cost-forecast': [...paymentDates,'variation_register'],
  'commercial-overview': [...paymentDates,'variation_register',...claimsDates],
  'contract-particulars-bonds': ['variation_register',...claimsDates],
  'commercial-claims-notices': claimsDates, 'notices-claims': claimsDates,
  'delay-claims': claimsDates, 'eot-assessment': claimsDates, 'windows-analysis': claimsDates,
  'lookahead-schedule': operationalDates,
};
const projectReviewOwners = new Set(['management-surfaces','master-dashboard','command-center','source-quality','director','board-report']);

/** Project diagnostics remain available to the project review. Only a module's
 * actual register dependencies may affect its readiness or primary warning. */
export function scopeRegisterDateReview(review: ReturnType<typeof reviewRegisterDates>, moduleKey: string) {
  if (projectReviewOwners.has(moduleKey)) return review;
  const families = dateDependencies[moduleKey] ?? [];
  const rows = (review.rows ?? []).filter(row => families.includes(row.documentType ?? ''));
  const failed = rows.filter(row => row.total > 0 && row.valid === 0);
  const mapping = failed.filter(row => row.state === 'column_not_found');
  const count = (items: typeof rows) => new Set(items.map(row => row.documentType)).size;
  const likelyMappingFault = review.likelyMappingFault && mapping.length > 0;
  return {...review, rows, likelyMappingFault, releaseReady: !likelyMappingFault,
    affectedRegisterCount: count(failed), mappingFailureRegisterCount: count(mapping),
    sourceDateGapRegisterCount: count(failed.filter(row => row.state !== 'column_not_found')),
    message: likelyMappingFault ? count(mapping)+' required register families have date columns that CMeng could not match. Check the reader for these sources.'
      : failed.length ? failed.length+' required register file(s) need date review.' : 'No date-reading fault affects this module\'s register dependencies.'};
}
const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof reviewRegisterDates>}>();
export function registerDateReview(state:ProjectRuntimeState){
 const old=cache.get(state);if(old?.version===state.version)return old.value;
 const value=reviewRegisterDates(sourceTables(state.evidenceDocuments,[]));cache.set(state,{version:state.version,value});return value;
}
