import {prepareRegisterRows} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';

export type ManagementSourceDomain =
  | 'procurement'|'design'|'submittal'|'quality'|'hse'|'claims'|'variations'
  | 'payments'|'cost'|'boq'|'resources'|'risk'|'contract';

export interface ManagementSourceDomainSummary {
  domain: ManagementSourceDomain;
  label: string;
  documentCount: number;
  parsedDocumentCount: number;
  readableRowCount: number | null;
  recognisedRowCount: number | null;
  filenames: string[];
  state: 'not_provided'|'source_file_available'|'source_read'|'source_rows_available';
  basis: string;
}

const definitions:Array<{domain:ManagementSourceDomain;label:string;pattern:RegExp}>=[
  {domain:'procurement',label:'Procurement / suppliers / materials',pattern:/procurement|purchase order|\bpo\b|supplier|vendor|material|long.?lead/i},
  {domain:'design',label:'Design / engineering / RFI',pattern:/design|engineering|deliverable|\brfi\b/i},
  {domain:'submittal',label:'Submittals',pattern:/submittal|shop.?drawing|material.?approval/i},
  {domain:'quality',label:'Quality / NCR / inspection',pattern:/quality|\bncr\b|inspection|\bwir\b|\bmir\b/i},
  {domain:'hse',label:'HSE / safety',pattern:/\bhse\b|safety|incident|near.?miss/i},
  {domain:'claims',label:'Claims / EOT / notices',pattern:/claim|\beot\b|notice|delay.?event|determination/i},
  {domain:'variations',label:'Variations / change',pattern:/variation|change.?order|\bvo\b|site.?instruction/i},
  {domain:'payments',label:'Payments / IPC',pattern:/payment|\bipc\b|certificate|invoice|retention|advance/i},
  {domain:'cost',label:'Cost / EVM / forecast',pattern:/cost|\bevm\b|budget|forecast|cash.?flow/i},
  {domain:'boq',label:'BOQ / quantities',pattern:/\bboq\b|bill.?of.?quantities|quantity/i},
  {domain:'resources',label:'Resources / manpower',pattern:/resource|manpower|man.?hour|labou?r|staffing/i},
  {domain:'risk',label:'Risk',pattern:/risk/i},
  {domain:'contract',label:'Contract / amendments',pattern:/contract|amendment|particular.?conditions|commercial.?terms|employer.?requirements|\brfp\b|\bitt\b/i},
];

const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof build>}>();

function build(state:ProjectRuntimeState){
  const documents=state.evidenceDocuments.filter(document=>document.basisState!=='superseded');
  const domains=definitions.map(definition=>{
    const matched=documents.filter(document=>definition.pattern.test(
      [document.documentType,document.category,document.sourceFilename,document.familyKey].filter(Boolean).join(' ')
    ));
    let readableRows=0,recognisedRows=0,hasReadableRows=false,hasRecognisedRows=false;
    for(const document of matched){
      for(const sheet of document.tabularRead?.sheets??[]){
        const prepared=prepareRegisterRows(sheet.rows,document.documentType);
        readableRows+=prepared.readRowCount;
        hasReadableRows=hasReadableRows||prepared.readRowCount>0;
        if(prepared.recognized){
          recognisedRows+=prepared.readRowCount;
          hasRecognisedRows=hasRecognisedRows||prepared.readRowCount>0;
        }
      }
    }
    const parsedDocumentCount=matched.filter(document=>document.parserState==='parsed').length;
    const stateValue:ManagementSourceDomainSummary['state']=!matched.length?'not_provided'
      :hasReadableRows?'source_rows_available'
      :parsedDocumentCount?'source_read'
      :'source_file_available';
    const basis=!matched.length?'No relevant source file is retained.'
      :hasReadableRows
        ?(hasRecognisedRows
          ?'Source rows are readable. This establishes source availability only; completeness, authority and cross-domain mapping remain separate.'
          :'Source rows are readable but the register schema is not fully recognised. Preserve the rows and review field mapping before using dependent calculations.')
        :parsedDocumentCount
          ?'Relevant source documents were read, but a structured row population is not available from the current extraction.'
          :'Relevant source files are retained. Their structured records have not yet been established.';
    return {
      domain:definition.domain,label:definition.label,documentCount:matched.length,parsedDocumentCount,
      readableRowCount:hasReadableRows?readableRows:null,recognisedRowCount:hasRecognisedRows?recognisedRows:null,
      filenames:matched.map(document=>document.sourceFilename),state:stateValue,basis
    } satisfies ManagementSourceDomainSummary;
  });
  return {schemaVersion:'1.0',domains};
}

export function managementSourceInventory(state:ProjectRuntimeState){
  const prior=cache.get(state);if(prior?.version===state.version)return prior.value;
  const value=build(state);cache.set(state,{version:state.version,value});return value;
}
