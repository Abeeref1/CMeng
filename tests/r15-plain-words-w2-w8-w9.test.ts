import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {readableFieldLabel,readablePathLabel} from '../packages/runtime-api/src/field-labels';
import {auditActorDisplayName} from '../packages/runtime-api/src/audit-context';

// Guard rules W2 (no internal words), W8 (no phrase from the do-not-use list) and
// W9 (one unknown word per value), checked at the shared sources: the label map used
// on screen and in downloads, the audit actor name, the browser helpers and every
// server text literal.
const W8=/do not blame|gap is that the contractor did not submit|this is not a zero result|not derivable|no canonical management action|management truth|fail-closed|causation unproven|identity association|temporal association|calculation withheld|scenario only|immutable determination|cutoff-controlled|money-linked claim population|correction route requires review|review classification is not yet available|source details are paged|next step: review the figures for this page|not necessarily records disagree|compare the records disagree|information still required|governed (?:records|amendment|programme)|requires? correction and repeat the check|unresolved source semantics|check pending/i;
const UNK='(?:Not established|Not in source|Not available|Not assessable|Not calculated|Not provided|Not recorded|Not confirmed|Unknown)';
const W9=new RegExp(UNK+'\\s*[·/:+|]\\s*'+UNK);
const html=cmengUatHtml();
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]!).join('\n');
function browserFunction(name:string){
 // One-line helpers end on their own line; longer ones end with a closing brace on a new line.
 const source=new RegExp('function '+name+'\\([^)]*\\)\\{[^\\n]*\\}(?=\\n)').exec(script)?.[0]??new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}').exec(script)?.[0];
 assert.ok(source,name+' found in the browser script');
 return source!;
}

test('W2: an upload session is named without its session id; a named user keeps the name',()=>{
 assert.equal(auditActorDisplayName({kind:'anonymous_session',label:'Session 48827426 (identity unverified)',identityVerified:false}),'Upload session');
 assert.equal(auditActorDisplayName({kind:'user',label:'Abeer',identityVerified:true}),'Abeer');
 assert.equal(auditActorDisplayName({kind:'system',label:'CMeng background process',identityVerified:true}),'CMeng background process');
 assert.equal(auditActorDisplayName(null),null);
 // The history state code reads as plain words on screen and in downloads.
 assert.equal(readableFieldLabel('session_identity_unverified'),'Name not recorded');
});

test('W2/W8: shared labels never print population, Not derivable or session identity words',()=>{
 const humanize=runInNewContext('('+/function humanizeKey\(key\)\{[\s\S]*?\n\}/.exec(html)![0]+')') as (key:string)=>string;
 const cases:[string,string][]=[['not_derivable','Cannot be worked out from the current records'],['session_identity_unverified','Name not recorded'],
  ['population','Record set'],['populationState','Record set state'],['populationId','Record set ID'],['sourcePopulation','Source record set'],
  ['scenario_only','What-if only'],['deterministic_source_calendar','Calculated on the source calendar'],['elapsed_fallback','Elapsed time (no working calendar)'],
  ['deterministicFinishIso','Calculated finish date'],['rerunReceipt','Run again receipt']];
 for(const [key,label] of cases){
  assert.equal(readableFieldLabel(key),label,key);
  // The browser label is the same words, or a curated screen label; never an internal word.
  assert.doesNotMatch(humanize(key),/population|deterministic|fallback|rerun|derivable|scenario only|identity unverified/i,'browser '+key);
 }
 assert.equal(readablePathLabel('population.exclusions'),'Record set · exclusions');
 for(const key of ['not_derivable','session_identity_unverified','population','scenario_only'])assert.equal(humanize(key),readableFieldLabel(key),'browser '+key);
 const deliveryLabel=runInNewContext('const deliveryUnknownText="Not established";'+/const deliveryLabel=[^\n]*/.exec(script)![0]+';deliveryLabel') as (key:string)=>string;
 assert.equal(deliveryLabel('population'),'Record set');
 assert.equal(deliveryLabel('populationState'),'Record set State');
 assert.equal(deliveryLabel('populationId'),'Record set Id');
});

test('W9: a pair or a known part never repeats an unknown word',()=>{
 const pair=runInNewContext('('+browserFunction('unknownPairText')+')') as (a:unknown,b:unknown)=>string;
 assert.equal(pair('Not established','Not established'),'Not established');
 assert.equal(pair(2,'Not established'),'2 / Not established');
 assert.equal(pair(2,0),'2 / 0');
 const known=runInNewContext(browserFunction('knownScreenCount')+';const fmt=String;('+browserFunction('unknownWithKnownText')+')') as (v:unknown,s:string)=>string;
 assert.equal(known(null,'known'),'Not established');
 assert.equal(known(3,'known'),'Not established · 3 known');
 assert.doesNotMatch(known(undefined,'identified open'),W9);
 // The three paired tiles use the shared helper.
 assert.match(script,/\["Future \/ undated periods",unknownPairText\(/);
 assert.match(script,/\["Future \/ undated records",unknownPairText\(/);
 assert.match(script,/\["Future \/ undated notices",unknownPairText\(/);
});

test('W8: no do-not-use phrase in the browser script or in any server text literal',()=>{
 // The stored owner value "<role> — individual not designated" is shown through
 // ownerDisplayState as a missing owner, so it is not part of this list.
 const hits=[...script.matchAll(new RegExp(W8.source,'gi'))].map(m=>script.slice(Math.max(0,m.index!-40),m.index!+60));
 assert.deepEqual(hits,[],'browser script');
 const files:string[]=[];
 const walk=(dir:string)=>{for(const name of readdirSync(dir)){const path=join(dir,name);if(statSync(path).isDirectory())walk(path);else if(path.endsWith('.ts'))files.push(path);}};
 for(const pkg of readdirSync('packages'))try{walk(join('packages',pkg,'src'));}catch{}
 const literal=/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;
 const found:string[]=[];
 for(const file of files){
  if(/\/ui[-a-z]*\.ts$/.test(file))continue; // browser text is checked above as the built script
  const source=readFileSync(file,'utf8');
  for(const m of source.matchAll(literal))if(W8.test(m[0]))found.push(file+': '+m[0].slice(0,100));
 }
 assert.deepEqual(found,[],'server text literals');
});

test('W2: server sentences say records, items or activities, never population or deterministic',()=>{
 const files:string[]=[];
 const walk=(dir:string)=>{for(const name of readdirSync(dir)){const path=join(dir,name);if(statSync(path).isDirectory())walk(path);else if(path.endsWith('.ts'))files.push(path);}};
 for(const pkg of readdirSync('packages'))try{walk(join('packages',pkg,'src'));}catch{}
 // Not reader text: AI planner prompts and an internal export invariant.
 const notShown=/packages\/project-ask\/src\/provider\.ts$|packages\/export-model\/src\/coverage\.ts$/;
 const literal=/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;
 const found:string[]=[];
 for(const file of files){
  if(/\/ui[-a-z]*\.ts$/.test(file)||notShown.test(file))continue;
  const source=readFileSync(file,'utf8');
  for(const m of source.matchAll(literal)){
   const text=m[0];
   if(!/\s/.test(text))continue; // keys, codes and enum values
   // 'Deterministic CMeng Summary' is a stored answer mode shown as "CMeng calculated answer".
   if(/\bpopulations?\b/i.test(text)||(/\bdeterministic\b/i.test(text)&&!/Deterministic CMeng Summary/.test(text))||/\brerun\b/i.test(text)||/identity unverified/i.test(text)&&!/audit-context\.ts$/.test(file))found.push(file+': '+text.slice(0,110));
  }
 }
 assert.deepEqual(found,[]);
});
