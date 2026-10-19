import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {readableFieldLabel,readablePathLabel} from '../packages/runtime-api/src/field-labels';

// T10 wording rules W1 (no field names), W2 (no code words) and W4 (no doubled
// words) on the one shared label used by screens, issue text and downloads.
function browserHumanize(){
 const source=/function humanizeKey\(key\)\{[\s\S]*?\n\}/.exec(cmengUatHtml())?.[0];
 assert.ok(source,'browser humanizeKey found');
 return runInNewContext('('+source+')') as (key:string)=>string;
}
const doubled=(text:string)=>{const w=text.toLowerCase().split(/\s+/);return w.some((x,i)=>i>0&&x===w[i-1]);};
const fieldShape=(text:string)=>/_/.test(text)||/\b[a-z]+[A-Z][a-z]/.test(text)||/\bp[0-9]{2}[A-Z]/.test(text);

test('T10 W1/W4: field names seen in real API responses read as plain words',()=>{
 const humanize=browserHumanize();
 const cases:[string,string][]=[
  ['sourceHashSha256','Source hash SHA-256'],
  ['ldsAmount','LD amount'],['totalLds','Total LDs'],
  ['costSar','Cost SAR'],['amount_sar','Amount SAR'],
  ['isoDate','Date'],['dataDateIso','Data date'],['reportingContext.dataDateIso','Reporting context data date'],
  ['E_TAHA','e-TAHA'],['e_taha','e-TAHA'],
  ['p50CompletionIso','P50 completion date'],['p90CompletionIso','P90 completion date'],
  ['retentionCalendar_full_source','Retention calendar full source'],
  ['siteInstructions_full_source','Site instructions full source'],
  ['ld_rate_per_day_x_exposure_days','LD rate per day × exposure days'],
  ['position.contractControls.bondsInsurance.insurancePopulation.denominator','Position contract controls bonds insurance population denominator'],
 ];
 for(const [key,label] of cases){
  assert.equal(readableFieldLabel(key),label,key);
  assert.equal(fieldShape(readableFieldLabel(key)),false,key);
  assert.equal(doubled(readableFieldLabel(key)),false,key);
 }
 // The browser label (headings, cells, filters) gives the same words.
 for(const [key,label] of cases.filter(([key])=>!key.includes('.')&&key!=='ld_rate_per_day_x_exposure_days'))assert.equal(humanize(key),label,key);
 assert.equal(humanize('ld_rate_per_day_x_exposure_days'),'LD rate per day × exposure days');
 assert.equal(readablePathLabel('position.contractControls.bondsInsurance.insurancePopulation.denominator'),'Position · contract controls · bonds insurance · insurance population · denominator','path labels keep each segment');
});

test('T10 W1: IDs, units and plain words are still left as written',()=>{
 for(const value of ['act_1001','ncr_014','ASSET_17','kVA','kWh','IPC-14 Rev2.xlsx','report_final.pdf','ACT-1001','P50'])assert.equal(readableFieldLabel(value),value,value);
 assert.equal(readableFieldLabel('Insurance insurance cover'),'Insurance insurance cover','free text is never rewritten word by word');
});

test('T10 W1: commercial tables say codes and tax basis in words',()=>{
 const source=cmengUatHtml();
 assert.doesNotMatch(source,/\/\.test\(String\(row\[k\]\)\)\?planningShortDate\(row\[k\]\):fmt\(row\[k\]\)\)/,'generic capability table cells never print a raw code');
 assert.match(source,/\/\.test\(String\(row\[k\]\)\)\?planningShortDate\(row\[k\]\):readerScalarText\(row\[k\]\)\)/,'generic capability table cells use the reader label');
 assert.doesNotMatch(source,/escapeHtml\(row\.taxBasis\)|'\s*\/\s*'\+row\.taxBasis\)/,'tax basis is never printed raw');
 const fn=/function taxBasisLabel\(value\)\{[^\n]*\}/.exec(source)?.[0];
 assert.ok(fn,'tax basis label found');
 const humanize=browserHumanize();
 const taxBasisLabel=runInNewContext('('+fn+')',{humanizeKey:humanize}) as (value:unknown)=>string;
 assert.equal(taxBasisLabel('exclusive'),'Excluding tax');
 assert.equal(taxBasisLabel('inclusive'),'Including tax');
 assert.equal(taxBasisLabel('unknown'),'Tax basis not stated');
 assert.equal(taxBasisLabel(undefined),'Tax basis not stated');
});
