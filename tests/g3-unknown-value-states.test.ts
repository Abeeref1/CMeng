import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from './browser-context';
import {unknownTileNote,unknownWithUnit,noneWhenZeroGap,registerScopeReason,evidenceStateReason,unknownFactReason,unknownReasonText} from '../packages/runtime-api/src/unknown-reason';

// Guard rules S1 / N2 / N3 (sysguard.py): the same shared text rule on every tile.
const UNK=/(?:Not established|Not in source|Not available|Not assessable|Not calculated|Not provided|Not recorded|Not confirmed|Unknown)/;
const REASON=/\b(because|until|needs?|require[sd]?|upload|confirm|missing|not supplied|no supplied|supply|provide|awaiting|pending|enter|add |select|choose|review|no .{0,30}(register|file|record|value|date|column)|without|cannot|not (yet )?(read|linked|mapped|supplied|dated))/i;
const N3=/(?:Not established|Not in source|Not available|Not assessable|Not calculated|Not provided|Not recorded|Not confirmed|Unknown)\s*(days?|d|h|hours?|%|SAR|USD|AED|activities|records)\b/;
const text=(html:string)=>html.replace(/<[^>]+>/g,'\n').replace(/\n+/g,'\n');
const tiles=(html:string)=>[...html.matchAll(/<div class="planning-kpi(?: [^"]*)?">([\s\S]*?)<\/div>/g)].map(m=>text(m[1]!).trim().split('\n').join(' | '));

test('S1: an unknown value carries the fact reason before its basis; a known value keeps its basis',()=>{
  assert.equal(unknownTileNote('Not established','dated RFI lifecycle','Needs an RFI register'),'Needs an RFI register · dated RFI lifecycle');
  assert.equal(unknownTileNote(12,'dated RFI lifecycle','Needs an RFI register'),'dated RFI lifecycle');
  assert.equal(unknownTileNote({value:null,state:'missing',reason:'Needs the contractual completion date from the contract'},'Contract evidence'),'Needs the contractual completion date from the contract · Contract evidence');
  assert.equal(unknownTileNote('Not established','basis',''),'basis','no reason is invented when the fact states none');
  assert.equal(unknownReasonText('EVENT_POPULATION_NOT_ESTABLISHED_NO_EVENT_SOURCE: only claims register rows cite these events'),'Only claims register rows cite these events','a diagnostic code is not shown');
  assert.equal(unknownFactReason({action:'Confirm the governing contract clause.'}),'Confirm the governing contract clause.');
});

test('S1: register reasons come from the register reading state',()=>{
  assert.equal(registerScopeReason({state:'missing',sourceRecordCount:0},'an RFI register'),'Needs an RFI register');
  assert.equal(registerScopeReason({state:'partial',sourceRecordCount:4,currentRecordCount:3,undatedRecordCount:1,unknownStatusCount:2,diagnostics:[]},'an RFI register'),'1 record needs a raised or status date; 2 records need a clear open or closed status');
  assert.equal(registerScopeReason({state:'established',sourceRecordCount:4,currentRecordCount:4,undatedRecordCount:0,unknownStatusCount:0,diagnostics:[]},'an RFI register'),'');
  assert.equal(evidenceStateReason('not_submitted','a permit register'),'Needs a permit register');
  assert.equal(evidenceStateReason('submitted_unparsed','a permit register'),'Permit register supplied but not yet read');
  assert.equal(evidenceStateReason('established','a permit register'),'');
});

test('N2 / N3: a unit never follows an unknown word; a zero count of missing items reads None',()=>{
  assert.equal(unknownWithUnit('Not established',null,'activities'),'Not established');
  assert.equal(unknownWithUnit('12',12,'activities'),'12 activities');
  assert.equal(noneWhenZeroGap(0,'Missing submitted values'),'None');
  assert.equal(noneWhenZeroGap(0,'Unquoted','quotation missing'),'None');
  assert.equal(noneWhenZeroGap(0,'Windows','established revision intervals'),0,'an ordinary zero stays a zero');
  assert.equal(noneWhenZeroGap(3,'Missing submitted values'),3);
});

test('S1 / N2: the shared tile renderer applies the rule to every tile on a page',()=>{
  const html=runInNewContext(`planningKpis([
    ["RFIs open at DD","Not established","dated RFI lifecycle","",registerScopeReason({state:"missing",sourceRecordCount:0},"an RFI register")],
    ["Active bonds",null,"security register"],
    ["Unquoted",0,"quotation missing"],
    ["Windows",2,"established revision intervals"]
  ],{reason:"Needs a bond / security register"})`,{escapeHtml:(s:unknown)=>String(s),humanizeIsoText:(s:unknown)=>String(s??'')}) as string;
  const shown=tiles(html);
  assert.deepEqual(shown,[
    'RFIs open at DD | Not established | Needs an RFI register · dated RFI lifecycle',
    'Unquoted | None | quotation missing',
    'Windows | 2 | established revision intervals',
    'Active bonds | Not established | Needs a bond / security register · security register'
  ]);
  for(const tile of shown){
    if(UNK.test(tile))assert.match(tile,REASON,'S1: '+tile);
    assert.doesNotMatch(tile,/(^|\| )0( \||$)/,'N2: '+tile);
  }
});

test('N3 / S1: the delivery figure card drops the unit of an unknown value and shows its reason',()=>{
  const html=runInNewContext(`kpi("Overdue records","Not established","From supplied register","Needs a due date and a clear status on every current record")+kpi("Open records",4,"records · From supplied register")`,
    {escapeHtml:(s:unknown)=>String(s)}) as string;
  const plain=text(html);
  assert.doesNotMatch(plain,N3);
  assert.match(plain,/Not established\nNeeds a due date and a clear status on every current record · From supplied register/);
  assert.match(plain,/4\nrecords · From supplied register/,'a known value keeps its unit');
});

test('N3: the submitted-versus-CMeng check shows no unit after an unknown value',()=>{
  const html=runInNewContext(`renderUniversalChallenge({items:[{metric:"critical",label:"Critical activities",submitted:{state:"submitted",value:107,unit:"activities"},independent:{state:"not_calculable",value:null,unit:"activities"},gap:{value:null,unit:"activities"}}],submittedEvidenceState:"partial",independentState:"missing",notSubmittedCount:0,unavailableCheckCount:1,scenarioCount:0,challengedCount:0})`,
    {escapeHtml:(s:unknown)=>String(s),humanizeKey:String,reconciliationSummary:()=>'',readerAuditAction:String}) as string;
  const plain=text(html);
  assert.doesNotMatch(plain,N3,'no "Not established activities"');
  assert.match(plain,/107 activities/,'a known value keeps its unit');
  assert.match(plain,/Missing submitted values\nNone/,'N2: a true zero of missing values reads None');
});
