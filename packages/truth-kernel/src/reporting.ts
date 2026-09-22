import { createHash } from 'node:crypto';
import { dateValue, reportingScope } from './index';

export type ReportingAuthority = 'source' | 'submitted' | 'calculated' | 'adjusted' | 'official' | 'scenario';
export interface PopulationContract {
  populationId: string;
  name: string;
  entity: string;
  dataDateIso: string | null;
  dateBasis: string;
  sourceRevisionId: string | null;
  authority: ReportingAuthority;
  sourceCount: number;
  denominator: number;
  memberIds: string[];
  exclusions: Array<{ id: string; reason: string }>;
  missingDatePolicy: 'withhold_from_as_of';
}

/** Population identity includes membership, exclusions, revision and date semantics.
 * A display limit is never a population limit. Forecast dates are not actual-event dates.
 */
export function populationContract(input: Omit<PopulationContract, 'populationId' | 'missingDatePolicy' | 'denominator'>): PopulationContract {
  const canonical = { ...input, dataDateIso: dateValue(input.dataDateIso ?? ''),
    memberIds: [...input.memberIds].sort(), exclusions: [...input.exclusions].sort((a,b)=>a.id.localeCompare(b.id)||a.reason.localeCompare(b.reason)) };
  return { ...canonical, denominator: canonical.memberIds.length, missingDatePolicy: 'withhold_from_as_of',
    populationId: 'population:' + createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0,24) };
}

export function partitionAsOf<T>(rows: readonly T[], input: {
  name: string; entity: string; dataDateIso: string | null; dateBasis: string;
  sourceRevisionId?: string | null; authority?: ReportingAuthority;
  id: (row: T, index: number) => string; date: (row: T) => string | null | undefined;
}) {
  const asOf: T[] = [], future: T[] = [], undated: T[] = [];
  const memberIds: string[] = [], exclusions: PopulationContract['exclusions'] = [];
  rows.forEach((row,index)=>{
    const scope = reportingScope(input.date(row),input.dataDateIso), id = input.id(row,index);
    if(scope==='as_of'){asOf.push(row);memberIds.push(id);}
    else { (scope==='future'?future:undated).push(row); exclusions.push({id,reason:scope==='future'?'after_data_date':!dateValue(input.dataDateIso??'')?'data_date_missing':'record_date_missing_or_invalid'}); }
  });
  return { asOf, future, undated, population: populationContract({ name:input.name, entity:input.entity,
    dataDateIso:input.dataDateIso, dateBasis:input.dateBasis, sourceRevisionId:input.sourceRevisionId??null,
    authority:input.authority??'source', sourceCount:rows.length, memberIds, exclusions }) };
}
