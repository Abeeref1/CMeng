import {cell,dateValue,sourceTables,type SourceTable} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';

const dateFields:Record<string,string[]>={
 quality_ncr_register:['raised date','issue date','status as of'],rfi_register:['raised date','issue date','status as of'],
 risk_register:['identified date','raised date','status as of'],hse_incident_register:['incident date','raised date'],
 incident_register:['incident date','raised date'],hse_report:['report date','period end','incident date'],
 procurement_register:['required on site','due date'],claims_register:['event start'],claim_register:['event start'],
 payment_certificate_register:['certificate date'],payment_certificates:['certificate date'],delay_eot_claims_register:['event start'],variation_register:['approval date'],
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
 const sameReason=['column_not_found','values_empty','values_invalid_or_missing'].some(reason=>independent(failed.filter(r=>r.state===reason))>=3);
 const likelyMappingFault=sameReason||independent(failed)>=4;
 return {rows,likelyMappingFault,releaseReady:!likelyMappingFault,affectedRegisterCount:independent(failed),message:likelyMappingFault?
  independent(failed)+' registers have no usable dates. A reading or column-matching fault may be responsible; CMeng must check the supplied files before requesting replacements.':
  failed.length?failed.length+' registers need date review.':'Register dates were read; review individual gaps below.'};
}
const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof reviewRegisterDates>}>();
export function registerDateReview(state:ProjectRuntimeState){
 const old=cache.get(state);if(old?.version===state.version)return old.value;
 const value=reviewRegisterDates(sourceTables(state.evidenceDocuments,[]));cache.set(state,{version:state.version,value});return value;
}
