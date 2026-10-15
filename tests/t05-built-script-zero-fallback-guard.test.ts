import test from 'node:test';
import assert from 'node:assert/strict';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

/** Validate the assembled browser script (including injected supporting UI),
 * not a partial source text or a known list of 24 hand-picked locations. */
const rules:readonly [string,RegExp][]=[
  ['fmt(x??0)', /\bfmt\s*\(\s*[^()\n]{0,220}(?:\?\?|\|\|)\s*0\s*\)/g],
  ['["label",x??0,', /\[\s*["'\x60][^"'\x60\n]{1,90}["'\x60]\s*,\s*[^,\n]{0,160}(?:\?\?|\|\|)\s*0\s*,/g],
  ['value:x??0', /\bvalue\s*:\s*[^,}\n]{0,160}(?:\?\?|\|\|)\s*0\s*(?=[,}])/g],
  ['"0%" fallback', /(?:(?:\?\?|\|\|)\s*|:\s*)["']0%["']/g],
  ['(x??0)+" text"', /\(\s*[^(),\n]{1,160}(?:\?\?|\|\|)\s*0\s*\)\s*\+\s*["'\x60]/g],
];
function violations(source:string){
 const found:Array<{rule:string;line:number;source:string}>=[];
 for(const [rule,expression] of rules){
   for(const match of source.matchAll(expression)){
     const line=source.slice(0,match.index).split('\n').length;
     found.push({rule,line,source:match[0]});
   }
 }
 return found.sort((a,b)=>a.line-b.line||a.rule.localeCompare(b.rule));
}
test('T05 five built-script missing-to-zero forms are all prohibited',()=>{
 const html=cmengUatHtml();
 const browser=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(browser,'assembled project browser script is present');
 const examples=[
   'const label=fmt(metric.count??0);',
   'const tiles=[["Outstanding", metric.count??0, "records"]];',
   'const bars=[{label:"Late",value:source.late??0,tone:"warning"}];',
   'const percent=coverage==null?"0%":fmt(coverage)+"%";',
   'const message=(sourceCount??0)+" retained records";'
 ];
 for(let i=0;i<examples.length;i++)
   assert.ok(violations(examples[i]!).some(v=>v.rule===rules[i]![0]),
     'guard MUST detect its own independent counterexample: '+rules[i]![0]);
 const legitimate='const map=new Map();map.set(k,(map.get(k)||0)+1);const genuine={value:0};';
 assert.deepEqual(violations(legitimate),[],
   'a genuine zero in an existing internal count map is not a fabricated display result');
 assert.deepEqual(violations(browser),[],
   'Unknown counts cannot be converted to displayed zeros. Exact built-script locations: '+JSON.stringify(violations(browser).slice(0,60)));
});
