import type {ProjectRuntimeState} from './project-state-types';
import {operationalReporting} from './reporting-state';
import {hseReportPosition} from './hse-report-evidence';
import {projectDataDate,canonicalTimeClaims} from './canonical-time-claims';
import {sourceTables} from '../../truth-kernel/src';
import {documentReadReview} from './document-read-review';

/** Availability is about the failed prerequisite, not a project risk score. */
export function evidenceAvailabilityReview(state:ProjectRuntimeState){
  // Presence is an inventory fact. A historical/unadopted document is still
  // supplied evidence; its reporting authority is a different question.
  const supplied=state.evidenceDocuments;
  const reports=hseReportPosition(state,projectDataDate(state));
  const hseDocs=supplied.filter(d=>/hse|safety/i.test(d.documentType+' '+d.sourceFilename));
  const permits=supplied.filter(d=>/permit/i.test(d.documentType+' '+d.sourceFilename));
  const permitRecords=state.controls.permits??[];
  const permitDocuments=permits.map(d=>{
    const read=documentReadReview(d,state);
    return {sourceFilename:d.sourceFilename,pageCount:read.pageCount,readPageCount:read.readPageCount,parserState:d.parserState,readComplete:read.complete};
  });
  const risks=operationalReporting(state).risk;
  const bonds=supplied.filter(d=>/bond|guarantee/i.test(d.documentType+' '+d.sourceFilename));
  const items = [
    {topic:'HSE report figures',state:reports.periodEndIso?'read':hseDocs.some(d=>d.hseSummary)?'read_not_adopted':hseDocs.length?'present_not_read':'not_provided',
      detail:reports.periodEndIso?'Reported period figures are available. They do not establish which incident cases remain open.':hseDocs.some(d=>d.hseSummary)?'Report figures have been read but their period or reporting basis has not been selected.':hseDocs.length?'A source report is present, but its figures have not been extracted.':'No source report was supplied.',
      action:reports.periodEndIso?'Use the reported LTI, exposure and treatment figures; request dated incident records for open-case status.':hseDocs.length?'Read the report and confirm its period and figures.':'Request the report.',documents:hseDocs.map(d=>d.sourceFilename)},
    {topic:'Permit status',state:permitRecords.length?'records_present':permitDocuments.some(d=>!d.readComplete)?'present_not_read':permits.length?'conditions_present_status_register_missing':'not_provided',
      detail:permitRecords.length?'Permit records are supplied; dates and validity require separate assessment.':permits.length?'Permit-condition documents are present. Conditions do not establish issued permits or current approval status.':'No active permit records or conditions were found.',
      action:permitDocuments.some(d=>!d.readComplete)?'Complete the document reading and request the dated permit register and activity links.':'Request permit IDs, applications, approvals, validity dates and activity links.',documents:permitDocuments},
    {topic:'Risk ratings',state:!risks.sourceRecordCount?'not_provided':risks.validation.ratingInconsistencyGroups.length?'validation_failed':risks.undatedRecordCount?'reporting_dates_missing':'read',
      detail:risks.validation.explanation,action:'Confirm the rating matrix or documented overrides and the dates on which each risk was open.',documents:[]},
    {topic:'Bonds and guarantees',state:(state.controls.bonds?.length??0)>0?'records_present':bonds.length?'present_not_read':'not_provided',
      detail:'Security values and expiry require a dated bond or guarantee record; contract wording alone does not establish current securities.',action:'Request the security register and instrument documents, with values, currency and expiry.',documents:bonds.map(d=>d.sourceFilename)},
  ];
  const extra=[{topic:'Determinations',pattern:/determination|award|decision/i},{topic:'Cost history',pattern:/cost.?history|cost.?report|cost.?ledger|cost_evm/i}];
  const tables=sourceTables(supplied,[]);
  for(const item of extra){const docs=supplied.filter(d=>item.pattern.test(d.documentType+' '+d.sourceFilename));const read=item.topic==='Determinations'?canonicalTimeClaims(state).determinations.length>0:tables.some(t=>docs.some(d=>d.documentId===t.document.documentId)&&t.headers.includes('metric')&&t.headers.includes('value')&&t.rows.length>0);items.push({topic:item.topic,state:read?'records_present':docs.length?'supplied_not_recognised':'not_provided',detail:read?'The supplied register has recognised records.':docs.length?'Supplied, not recognised: '+docs.map(d=>d.sourceFilename).join(', '):'No '+item.topic.toLowerCase()+' file was supplied.',action:read?'Review the record dates and applicable status.':'Read and confirm the records.',documents:docs.map(d=>d.sourceFilename)});}

  for(const item of items){
    const pattern=item.topic==='Risk ratings'?/risk/i:item.topic==='Bonds and guarantees'?/bond|guarantee/i:item.topic==='HSE report figures'?/hse|safety/i:null;
    if(!pattern)continue;
    const docs=supplied.filter(d=>pattern.test(d.documentType+' '+d.sourceFilename));
    if(docs.length&&['not_provided','present_not_read'].includes(item.state)){item.state='supplied_not_recognised';item.detail='Supplied, not recognised: '+docs.map(d=>d.sourceFilename).join(', ');}
  }
  return items;
}
