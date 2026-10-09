import {prepareRegisterRows,sourceTables} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';

export type ManagementSourceDomain =
  | 'procurement'|'design'|'submittal'|'interfaces'|'quality'|'hse'|'claims'|'variations'
  | 'payments'|'cost'|'boq'|'resources'|'risk'|'contract';

export interface ManagementSourceDomainSummary {
  domain: ManagementSourceDomain;
  label: string;
  documentCount: number;
  parsedDocumentCount: number;
  readableRowCount: number | null;
  recognisedRowCount: number | null;
  filenames: string[];
  signals: {
    longLeadMarkedCount: number | null;
    longLeadSamples: Array<{reference:string|null;description:string|null;status:string|null;requiredOnSite:string|null;forecastDelivery:string|null;source:string}>;
  };
  state: 'not_provided'|'source_file_available'|'source_read'|'source_rows_available';
  basis: string;
}

const definitions:Array<{domain:ManagementSourceDomain;label:string;pattern:RegExp}>=[
  {domain:'procurement',label:'Procurement / suppliers / materials',pattern:/procurement|purchase order|\bpo\b|supplier|vendor|material|long.?lead/i},
  {domain:'design',label:'Design / engineering / RFI',pattern:/design|engineering|deliverable|\brfi\b/i},
  {domain:'submittal',label:'Submittals',pattern:/submittal|shop.?drawing|material.?approval/i},
  {domain:'interfaces',label:'Interfaces / coordination',pattern:/interface|coordination.?register|interface.?register|giving.?party|receiving.?party/i},
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
  const tables=sourceTables(documents,[],{includeHistorical:true});
  const normalizeSourceText=(values:Array<string|null|undefined>)=>values.filter(Boolean).join(' ').normalize('NFKC').replace(/[_/\\.-]+/g,' ').replace(/\s+/g,' ').trim();
  const specificDomains=(document:ProjectRuntimeState['evidenceDocuments'][number])=>{
    const semanticTypes=tables.filter(table=>table.document.documentId===document.documentId).map(table=>table.document.documentType);
    const typed=definitions.filter(definition=>definition.pattern.test(normalizeSourceText(semanticTypes))).map(definition=>definition.domain);
    if(typed.length)return typed;
    const specific=normalizeSourceText([document.documentType,document.sourceFilename,document.familyKey]);
    const matches=definitions.filter(definition=>definition.pattern.test(specific)).map(definition=>definition.domain);
    if(matches.length)return matches;
    // Broad storage categories such as risk_claims_procurement and hse_quality_fm
    // are routing buckets, not proof that one document belongs to every domain.
    // Use the category only when the specific document identity gives no signal.
    const fallback=normalizeSourceText([document.category]);
    return definitions.filter(definition=>definition.pattern.test(fallback)).map(definition=>definition.domain);
  };
  const domains=definitions.map(definition=>{
    const matched=documents.filter(document=>specificDomains(document).includes(definition.domain));
    let readableRows=0,recognisedRows=0,hasReadableRows=false,hasRecognisedRows=false,longLeadMarkedCount=0,longLeadObserved=false;
    const longLeadSamples:ManagementSourceDomainSummary['signals']['longLeadSamples']=[];
    for(const document of matched){
      const retained=tables.filter(table=>table.document.documentId===document.documentId);
      const preparedTables=retained.length?retained.map(table=>({headers:table.headers,rows:table.rows.map(row=>table.headers.map(header=>row.cells[header]??'')),readRowCount:table.rows.length,recognized:table.recognition?.recognized??false})):(document.tabularRead?.sheets??[]).map(sheet=>prepareRegisterRows(sheet.rows,document.documentType));
      for(const prepared of preparedTables){
        readableRows+=prepared.readRowCount;
        hasReadableRows=hasReadableRows||prepared.readRowCount>0;
        if(prepared.recognized){
          recognisedRows+=prepared.readRowCount;
          hasRecognisedRows=hasRecognisedRows||prepared.readRowCount>0;
        }
        if(definition.domain==='procurement'){
          const longLeadIndex=prepared.headers.indexOf('long lead');
          if(longLeadIndex>=0){
            longLeadObserved=true;
            const index=(name:string)=>prepared.headers.indexOf(name);
            const refIndex=index('package id'),descriptionIndex=index('description'),statusIndex=index('status'),requiredIndex=index('required on site'),forecastIndex=index('forecast delivery');
            for(const row of prepared.rows){
              const raw=String(row[longLeadIndex]??'').trim();
              const marked=/^(?:yes|y|true|1|long\s*lead|ll|critical)$/i.test(raw);
              if(!marked)continue;
              longLeadMarkedCount++;
              if(longLeadSamples.length<12)longLeadSamples.push({
                reference:refIndex>=0?String(row[refIndex]??'').trim()||null:null,
                description:descriptionIndex>=0?String(row[descriptionIndex]??'').trim()||null:null,
                status:statusIndex>=0?String(row[statusIndex]??'').trim()||null:null,
                requiredOnSite:requiredIndex>=0?String(row[requiredIndex]??'').trim()||null:null,
                forecastDelivery:forecastIndex>=0?String(row[forecastIndex]??'').trim()||null:null,
                source:document.sourceFilename,
              });
            }
          }
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
      filenames:matched.map(document=>document.sourceFilename),
      signals:{longLeadMarkedCount:longLeadObserved?longLeadMarkedCount:null,longLeadSamples},
      state:stateValue,basis
    } satisfies ManagementSourceDomainSummary;
  });
  return {schemaVersion:'1.0',domains};
}

export function managementSourceInventory(state:ProjectRuntimeState){
  const prior=cache.get(state);if(prior?.version===state.version)return prior.value;
  const value=build(state);cache.set(state,{version:state.version,value});return value;
}
