/** Rendering never changes source precision or decides authority from display text. */
export type ManagementValueState='value'|'not_established'|'not_in_source'|'not_applicable'|'records_disagree'|'not_calculable'|'withheld';
export function managementValueState(input:unknown):ManagementValueState {
 const item=input as any;
 if(item&&typeof item==='object'){
  const state=item.valueState??item.state;
  // An explicit value state cannot make an absent or nonfinite quantity known.
  if(state==='value')return Object.prototype.hasOwnProperty.call(item,'value')?managementValueState(item.value):'not_established';
  if(['not_established','not_in_source','not_applicable','records_disagree','not_calculable','withheld'].includes(state))return state;
  // Explicit source states take precedence over a placeholder numeric/boolean
  // value. An unknown source quantity must never become a displayed zero.
  if(['missing','missing_information','unknown','unresolved','not_known','not_read'].includes(state))return 'not_established';
  if(['not_provided','absent_from_source'].includes(state))return 'not_in_source';
  if(['n/a','not_applicable_completed'].includes(state))return 'not_applicable';
  if(['conflicted','source_conflict','disputed'].includes(state))return 'records_disagree';
  if(['suppressed','quarantined','withheld'].includes(state))return 'withheld';
  if(['not_calculable','unavailable','calculation_failed'].includes(state))return 'not_calculable';
  if(Object.prototype.hasOwnProperty.call(item,'value'))return managementValueState(item.value);
 }
 if(input===null||input===undefined)return 'not_established';
 if(typeof input==='string'){
  const sourceToken=input.trim();
  if(sourceToken===''||/^(?:null|undefined)$/i.test(sourceToken))return 'not_established';
  // Some old source readers serialized nonfinite numeric values as text.
  // They must not become a factual quantity or acquire a unit on screen.
  if(/^[+-]?(?:nan|infinity)$/i.test(sourceToken))return 'not_calculable';
 }
 if(typeof input==='number'&&!Number.isFinite(input))return 'not_calculable';
 return 'value';
}
export function managementNumber(input:number,digits=2):string {
 if(!Number.isFinite(input))return 'Not calculable';
 if(input!==0&&Math.abs(input)<0.01)return input<0?'>-0.01':'<0.01';
 const precision=Math.max(0,Math.min(2,digits));
 // A monetary/quantity value must not disappear merely because a whole-unit
 // presentation was selected. Preserve the smallest nonzero display precision.
 const effective=precision===0&&Math.abs(input)>0&&Math.abs(input)<1?2:precision;
 return new Intl.NumberFormat('en-US',{maximumFractionDigits:effective,minimumFractionDigits:0}).format(input);
}
export function managementDate(input:unknown):string {
 if(input===null||input===undefined||input==='')return 'Not established';
 const source=String(input),match=/^(\d{4})-(\d{2})-(\d{2})(?=$|T|\s)/.exec(source);
 const text=match?match[0]!.slice(0,10):source,at=Date.parse(text);
 if(!Number.isFinite(at))return 'Not calculable';
 // Date.parse can silently roll 2030-02-30 to March. Preserve an invalid
 // contractual/programme source date as unknown instead of inventing a day.
 if(match){
  const parsed=new Date(at);
  if(parsed.getUTCFullYear()!==Number(match[1])||parsed.getUTCMonth()+1!==Number(match[2])||parsed.getUTCDate()!==Number(match[3]))return 'Not calculable';
 }
 return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(at));
}
export function managementValue(input:unknown,unit=''):string {
 const state=managementValueState(input),item=input as any;
 const labels:Record<string,string>={not_established:'Not established',not_in_source:'Not in source',not_applicable:'Not applicable',records_disagree:'Records disagree',not_calculable:'Not calculable',withheld:'Withheld'};
 if(state!=='value')return labels[state]!;
 const value=item&&typeof item==='object'&&Object.prototype.hasOwnProperty.call(item,'value')?item.value:input;
 if(value===null||value===undefined)return 'Not established';
 const display=typeof value==='number'?managementNumber(value):typeof value==='boolean'?(value?'Yes':'No'):String(value);
 return display+(unit?' '+unit:'');
}

/** Formatting of source-backed narrative text, not a substitute for missing facts. */
export function managementText(input:unknown):string {
 if(input===null||input===undefined)return 'Not established';
 return String(input)
  .replace(/\bdue\s*=\s*/gi,'Due: ')
  .replace(/\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g,match=>managementDate(match))
  .replace(/T([0-2]\d:[0-5]\d)(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?(?=$|[\s;,)])/g,' · $1')
  // Numeric-looking text can be a BOQ item, cost code or source reference.
  // Round typed measures at their value renderer, never narrative/identifier text.
  .replace(/(?:\b(?:[a-z][a-z0-9_]*_)?register|_register)\s+status\s*=\s*([a-z][a-z0-9 _-]*?)(?=[,;\n]|$)/gi,(_,value)=>'Status: '+value.trim().replaceAll('_',' ').replace(/^./,(s:string)=>s.toUpperCase()))
  .replace(/\b(?:null|undefined)\b/g,'Not established')
  .replace(/\bNaN\b/g,'Not calculable')
  .replace(/\b(Not in source|Not established|Not calculable|Withheld|Records disagree)(?:\s+(?:calendar|working))?\s+(?:days?|d|hours?|h|%)\b/gi,'$1');
}
