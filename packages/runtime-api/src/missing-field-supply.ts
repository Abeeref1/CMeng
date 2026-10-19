import type {ControlIssue} from '../../truth-kernel/src';
import {missingValueInputKind,type MissingValueInputKind} from './missing-value-inputs';

/** F30: the control that supplies one missing field. A value the user can type
 * is entered inline at the T04 decision place; any other missing field names
 * the document type and the column/field that supplies it, with an upload.
 * It is offered only for a missing field (never for a correct file), so it is
 * not a re-upload request. Machine data only: group key and raw field. */
export type MissingFieldSupply=
  |{type:'input';kind:MissingValueInputKind|'contract-completion';label:string}
  |{type:'upload';documentType:string;field:string;label:string;uploadHint:string;uploadMode:'schedule'|'evidence'};

/** Reader words of a raw field name: 'position.dataDateIso' -> 'data date'. */
export function rawFieldLabel(field:string|undefined|null):string|null{
  if(!field)return null;
  const [path='',...topic]=field.split('|');
  const last=path.split('.').filter(Boolean).at(-1)??'';
  const words=last.replace(/\[[^\]]*\]/g,'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/\s+(?:Iso|Ids?)$/,'').trim().toLowerCase();
  return words?words+(topic.length?' ('+topic.join(' ')+')':''):null;
}

/** Document type that records the fields of each review group. */
const groupDocuments:Record<string,{documentType:string;uploadMode:'schedule'|'evidence'}>={
  'programme-information':{documentType:'Current programme (XER or XML)',uploadMode:'schedule'},
  'programme-comparison':{documentType:'Baseline or earlier programme revision (XER or XML)',uploadMode:'schedule'},
  'schedule-calculation':{documentType:'Current programme (XER or XML)',uploadMode:'schedule'},
  'programme-logic':{documentType:'Current programme (XER or XML)',uploadMode:'schedule'},
  'productivity':{documentType:'Dated quantity or production-rate record',uploadMode:'evidence'},
  'quantities':{documentType:'BOQ or dated quantity measurement',uploadMode:'evidence'},
  'resources':{documentType:'Resource-loaded programme or manhour record',uploadMode:'evidence'},
  'risks':{documentType:'Risk register',uploadMode:'evidence'},
  'hse':{documentType:'HSE register with exposure hours',uploadMode:'evidence'},
  'quality':{documentType:'NCR or inspection register',uploadMode:'evidence'},
  'design-permits':{documentType:'RFI, design or permit register',uploadMode:'evidence'},
  'claims':{documentType:'Claim, notice, delay-event or determination record',uploadMode:'evidence'},
  'payments':{documentType:'IPC, payment or retention register',uploadMode:'evidence'},
  'commercial':{documentType:'Contract, variation, bond, insurance or cost record',uploadMode:'evidence'},
  'procurement-date-check':{documentType:'Procurement register',uploadMode:'evidence'},
  'register-date-check':{documentType:'RFI or NCR register',uploadMode:'evidence'},
  'contract-completion':{documentType:'Contract or contract amendment',uploadMode:'evidence'},
};

export function missingFieldSupply(groupKey:string,issue:Pick<ControlIssue,'kind'|'field'|'evidencePaths'|'summary'|'code'>,openInputs:ReadonlySet<MissingValueInputKind>):MissingFieldSupply{
  const input=missingValueInputKind(issue as ControlIssue);
  if(input&&openInputs.has(input))return {type:'input',kind:input,label:input==='contract-value'?'Enter the contract value and currency':'Enter the approved EOT days'};
  if(groupKey==='contract-completion')return {type:'input',kind:'contract-completion',label:'Confirm the contractual completion date'};
  const document=groupDocuments[groupKey]??{documentType:'Source document that records this field',uploadMode:'evidence' as const};
  const field=rawFieldLabel(issue.field)??(issue.summary?.trim()||issue.code.replaceAll('_',' ').toLowerCase());
  return {type:'upload',documentType:document.documentType,field,uploadMode:document.uploadMode,
    label:'Upload: '+document.documentType,
    uploadHint:document.documentType+' with the '+field+' column or field'};
}
