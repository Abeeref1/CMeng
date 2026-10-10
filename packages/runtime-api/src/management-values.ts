/** Rendering never changes source precision or decides authority from display text. */
export type ManagementValueState='value'|'not_in_source'|'records_disagree'|'not_calculable'|'withheld';
export function managementValueState(input:unknown):ManagementValueState {
 const item=input as any;
 if(item&&typeof item==='object'){
  const state=item.valueState??item.state;
  if(['value','not_in_source','records_disagree','not_calculable','withheld'].includes(state))return state;
  if(['conflicted','source_conflict','disputed'].includes(state))return 'records_disagree';
  if(['suppressed','quarantined','withheld'].includes(state))return 'withheld';
  if(['not_calculable','unavailable','calculation_failed'].includes(state))return 'not_calculable';
  if(Object.prototype.hasOwnProperty.call(item,'value'))return managementValueState(item.value);
 }
 if(input===null||input===undefined)return 'not_in_source';
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
 if(input===null||input===undefined||input==='')return 'Not in source';
 const source=String(input),match=/^(\d{4}-\d{2}-\d{2})/.exec(source);
 const text=match?match[1]!:source,at=Date.parse(text);
 if(!Number.isFinite(at))return 'Not calculable';
 return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(at));
}
export function managementValue(input:unknown,unit=''):string {
 const state=managementValueState(input),item=input as any;
 const labels:Record<string,string>={not_in_source:'Not in source',records_disagree:'Records disagree',not_calculable:'Not calculable',withheld:'Withheld'};
 if(state!=='value')return labels[state]!;
 const value=item&&typeof item==='object'&&Object.prototype.hasOwnProperty.call(item,'value')?item.value:input;
 if(value===null||value===undefined)return 'Not in source';
 const display=typeof value==='number'?managementNumber(value):typeof value==='boolean'?(value?'Yes':'No'):String(value);
 return display+(unit?' '+unit:'');
}
