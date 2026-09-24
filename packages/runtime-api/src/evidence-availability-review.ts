import type {ProjectRuntimeState} from './project-state-types';
import {operationalReporting} from './reporting-state';
import {hseReportPosition} from './hse-report-evidence';
import {projectDataDate} from './canonical-time-claims';

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
    const contract=state.contractDocuments.find(c=>c.documentId===d.documentId);
    const pages=contract?.result.pdf?.pages??[];
    return {sourceFilename:d.sourceFilename,pageCount:pages.length,readPageCount:pages.filter(p=>p.text.trim().length>50).length,parserState:d.parserState};
  });
  const risks=operationalReporting(state).risk;
  const bonds=supplied.filter(d=>/bond|guarantee/i.test(d.documentType));
  return [
    {topic:'HSE report figures',state:reports.periodEndIso?'read':hseDocs.some(d=>d.hseSummary)?'read_not_adopted':hseDocs.length?'present_not_read':'not_provided',
      detail:reports.periodEndIso?'Reported period figures are available. They do not establish which incident cases remain open.':hseDocs.some(d=>d.hseSummary)?'Report figures have been read but their period or reporting basis has not been selected.':hseDocs.length?'A source report is present, but its figures have not been extracted.':'No source report was supplied.',
      action:reports.periodEndIso?'Use the reported LTI, exposure and treatment figures; request dated incident records for open-case status.':hseDocs.length?'Read the report and confirm its period and figures.':'Request the report.',documents:hseDocs.map(d=>d.sourceFilename)},
    {topic:'Permit status',state:permitRecords.length?'records_present':permitDocuments.some(d=>d.readPageCount<d.pageCount)?'present_not_read':permits.length?'conditions_present_status_register_missing':'not_provided',
      detail:permitRecords.length?'Permit records are supplied; dates and validity require separate assessment.':permits.length?'Permit-condition documents are present. Conditions do not establish issued permits or current approval status.':'No active permit records or conditions were found.',
      action:permitDocuments.some(d=>d.readPageCount<d.pageCount)?'Read the image pages and request the dated permit register and activity links.':'Request permit IDs, applications, approvals, validity dates and activity links.',documents:permitDocuments},
    {topic:'Risk ratings',state:!risks.sourceRecordCount?'not_provided':risks.validation.ratingInconsistencyGroups.length?'validation_failed':risks.undatedRecordCount?'reporting_dates_missing':'read',
      detail:risks.validation.explanation,action:'Confirm the rating matrix or documented overrides and the dates on which each risk was open.',documents:[]},
    {topic:'Bonds and guarantees',state:(state.controls.bonds?.length??0)>0?'records_present':bonds.length?'present_not_read':'not_provided',
      detail:'Security values and expiry require a dated bond or guarantee record; contract wording alone does not establish current securities.',action:'Request the security register and instrument documents, with values, currency and expiry.',documents:bonds.map(d=>d.sourceFilename)},
  ];
}
