import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {readableFieldLabel,readablePathLabel} from '../packages/runtime-api/src/field-labels';

// The real browser humanizeKey, evaluated on its own (it must stay self-contained).
function browserHumanize(){
 const source=/function humanizeKey\(key\)\{[\s\S]*?\n\}/.exec(cmengUatHtml())?.[0];
 assert.ok(source,'browser humanizeKey found');
 return runInNewContext('('+source+')') as (key:string)=>string;
}
const script=()=>[...cmengUatHtml().matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]!).join('\n');
const codeName=(text:string)=>/_/.test(text)||/\b[a-z]+[A-Z][a-z]/.test(text)||/^(?:[A-Z][a-z]+ ){2,}[A-Z][a-z]+$/.test(text);

test('T10: unmapped field keys and codes read as plain sentence case, never code names',()=>{
 const humanize=browserHumanize();
 const cases:[string,string][]=[
  ['recordActionCount','Record action count'],['RECORD_ACTION_COUNT','Record action count'],
  ['memberIds','Member IDs'],['dataDateIso','Data date'],['contractualCompletionIso','Contractual completion date'],
  ['actualIssuedAt','Actual issued date'],['knownOpenCount','Open records found'],['openNcrCount','Open NCR count'],
  ['passRatePercent','Pass rate %'],['record_date_missing','Record date missing'],['sourceRefs','Source references'],
  ['wbsPath','WBS path'],['cmeng_screening_policy','CMeng screening rule'],['source_total_float','Source total float'],
  ['PAYMENT_CURRENCY_BASIS_CONFLICT:IPC_71','Payment currency basis conflict · IPC 71'],
 ];
 for(const [key,label] of cases){assert.equal(humanize(key),label,key);assert.equal(codeName(humanize(key)),false,key);}
 // The same fallback is shared with downloads.
 assert.equal(readableFieldLabel('recordActionCount'),'Record action count');
 assert.equal(readableFieldLabel('dataDateIso'),'Data date');
});

test('T10: codes seen in API responses get their curated words; free text keeps IDs and capitals',()=>{
 const humanize=browserHumanize();
 assert.equal(humanize('source_forecast'),'Submitted forecast');
 assert.equal(humanize('not_established'),'Not established');
 assert.equal(humanize('candidate'),'Needs review');
 assert.equal(humanize('execution_control'),'Execution activities');
 assert.equal(humanize('duration_weighted_progress'),'Activities in duration-weighted progress');
 assert.equal(humanize('periodEnd'),'Period end date');
 assert.equal(humanize('near_critical'),'Near-critical','curated labels win over page titles');
 assert.equal(humanize('MISSING_SOURCE_VALUE'),'Source value missing');
 assert.equal(humanize('CROSS_MODULE_CONTRADICTION'),'Pages disagree');
 assert.equal(humanize('periodEnd, not cash release'),'period end, not cash release');
 assert.equal(humanize('ACT-1001 and A1200 stay as recorded'),'ACT-1001 and A1200 stay as recorded');
 assert.equal(humanize('Source relationship records'),'Source relationship records');
});

test('T10: cells, scalar lists, record groups and population tables never print raw codes',()=>{
 const source=script();
 assert.match(source,/if\(isReaderCodeValue\(value\)\)return humanizeKey\(value\);/,'snake/camel cell values are translated');
 assert.doesNotMatch(source,/value-chip">'\+escapeHtml\(fmt\(v\)\)/,'scalar list chips use reader words');
 assert.doesNotMatch(source,/humanizeKey\(parts\.slice\(-2\)\.join\(' '\)\)/,'record groups are not two joined pointer segments');
 assert.doesNotMatch(source,/escapeHtml\(p\.dateBasis\)/,'date basis is never printed raw');
 assert.doesNotMatch(source,/escapeHtml\(p\.name\)/,'population names are never printed raw');
 assert.doesNotMatch(source,/\.replace\(\/\\b\\w\/g,c=>c\.toUpperCase\(\)\)/,'no Title Case code-name fallback remains');
});

test('T10: IDs, units, file names, emails and URLs are never rewritten',()=>{
 const humanize=browserHumanize();
 const kept=['act_1001','ncr_014','ASSET_17','kVA','kWh','kN','kPa','report_final.pdf','IPC-14 Rev2.xlsx','john.doe@example.com','https://example.com/source_records','ACT-1001'];
 for(const value of kept){assert.equal(readableFieldLabel(value),value,value);assert.equal(humanize(value),value,value);}
 assert.equal(readableFieldLabel('load 500 kVA at kWh rate, see report_final.pdf'),'load 500 kVA at kWh rate, see report_final.pdf');
 assert.equal(readableFieldLabel('mail john.doe@example.com about dataDateIso'),'mail john.doe@example.com about data date');
});

test('T10: paths keep their context and one code has one label everywhere',()=>{
 assert.equal(readablePathLabel('activityFloatReconciliation.rows'),'Activity float reconciliation · rows');
 assert.equal(readablePathLabel('completionBases[basis=actual]'),'Completion bases (actual)');
 assert.notEqual(readablePathLabel('/data/inferredMapping/sourceWbsLinks'),readablePathLabel('/data/sourceWbsLinks'));
 const source=script();
 assert.doesNotMatch(source,/humanizeKey\(value\.toLowerCase\(\)\)/,'cells use the same label as headings');
 assert.match(source,/shortLabels\.indexOf\(label\)!==shortLabels\.lastIndexOf\(label\)/,'record groups never share one name');
 assert.doesNotMatch(source,/function reportLabel\(value\)\{\n  return String\(value\|\|""\)\.replace/,'report preview uses the shared label');
 assert.doesNotMatch(source,/escapeHtml\(section\.textKey\)/,'report chart text never prints a raw key');
 assert.doesNotMatch(source,/const clean=s=>String\(s\)\.replace\(\/\(\[a-z\]\)\(\[A-Z\]\)/,'issue subjects use the shared label');
});
