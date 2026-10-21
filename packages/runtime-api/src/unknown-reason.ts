/** S1 / N2 / N3: one shared rule for an unknown value on a tile, line or table.
 * - An unknown value says why it is unknown and what is needed. The reason is the
 *   fact's own stated reason or missing input; this module never invents one.
 * - An unknown value never carries a unit ("Not established", never "Not established days").
 * - A count of missing / unknown / unconfirmed items that is truly zero reads "None".
 * Every function is self-contained so browser scripts embed the same source
 * (`unknownReasonSource()`) and pages, downloads and answers say the same thing. */

/** True when a displayed value is an unknown state rather than a figure. */
export function unknownScreenValue(value:unknown):boolean{
  if(value===null||value===undefined)return true;
  if(typeof value==='number')return !Number.isFinite(value);
  if(typeof value==='string'){
    const text=value.trim();
    return text===''||text==='—'||/^(?:Not established|Not in source|Not available|Not assessable|Not calculated|Not calculable|Not provided|Not recorded|Not confirmed|Unknown|Withheld|Records disagree)\b/i.test(text);
  }
  if(typeof value==='object'&&!Array.isArray(value)){
    const item=value as Record<string,unknown>,state=item.valueState??item.state;
    if(typeof state==='string'&&/^(?:not_established|not_in_source|not_calculable|withheld|records_disagree|missing|missing_information|unknown|unresolved|not_known|not_read|not_provided|absent_from_source|unavailable|calculation_failed|suppressed|quarantined)$/.test(state))return true;
    if(Object.prototype.hasOwnProperty.call(item,'value'))return unknownScreenValue(item.value);
  }
  return false;
}

/** Plain reason text: a leading diagnostic code ("SOME_CODE: ...") is not shown,
 * and a reason starts with a capital letter. */
export function unknownReasonText(reason:unknown):string{
  if(typeof reason!=='string')return '';
  const text=reason.replace(/^[A-Z][A-Z0-9_]{3,}:\s*/,'').replace(/\s+/g,' ').trim();
  return text?text.charAt(0).toUpperCase()+text.slice(1):'';
}

/** The fact's own reason or missing input, when the value object carries one. */
export function unknownFactReason(value:unknown):string{
  if(!value||typeof value!=='object'||Array.isArray(value))return '';
  const item=value as Record<string,unknown>;
  for(const key of ['reason','unknownReason','missingReason','unavailableReason','nextStep','requiredAction','action']){
    const text=unknownReasonText(item[key]);
    if(text)return text;
  }
  for(const key of ['missingInputs','requiredInputs']){
    const inputs=item[key];
    if(Array.isArray(inputs)&&inputs.length)return 'Needs '+inputs.map(input=>String(input)).join(', ');
  }
  // S1: a fact that states what it requires only as a diagnostic code says it in words.
  const needs:Record<string,string>={
    CERTIFIED_UNPAID_REQUIRES_PAID_AMOUNT_FOR_EVERY_CERTIFICATE:'Needs the paid amount for every issued certificate',
    CERTIFIED_UNPAID_REQUIRES_NET_CERTIFIED_CERTIFICATES_STATE_GROSS_ONLY:'Needs net certified amounts; the certificates state gross only',
    ADVANCE_BALANCE_REQUIRES_CONTRACT_ADVANCE_AND_CERTIFIED_RECOVERIES:'Needs the contract advance and the certified recoveries',
    CURRENT_CONTRACT_VALUE_REQUIRES_COMMITTED_CONTRACT_VALUE:'Needs a confirmed contract value',
    CASH_FLOW_TIME_SERIES_REQUIRES_DATED_CERTIFICATE_AND_PAYMENT_TRANSACTIONS:'Needs dated certificate and payment records',
    ADJUSTED_COMPLETION_REQUIRES_CONTRACTUAL_COMPLETION_AND_APPROVED_EOT:'Needs the contract completion date and the approved EOT',
    ADJUSTED_COMPLETION_REQUIRES_CONTRACTUAL_COMPLETION:'Needs the contract completion date',
    LD_SCENARIO_REQUIRES_RATE:'Needs the delay damages rate',
    LD_SCENARIO_REQUIRES_SCHEDULE_DELAY:'Needs a programme delay to apply the rate to',
    LD_PERCENT_CAP_REQUIRES_CONTRACT_VALUE_CANDIDATE:'Needs a contract value to apply the percentage cap',
    LD_PERCENT_RATE_REQUIRES_CONTRACT_VALUE_CANDIDATE:'Needs a contract value to apply the percentage rate',
    SCHEDULE_CHANGE_REQUIRES_AT_LEAST_TWO_REVISIONS:'Needs at least two programme revisions',
    PRODUCTIVITY_FORECAST_REQUIRES_ACTIVE_PROGRAMME:'Needs a current programme',
    PRODUCTIVITY_FORECAST_REQUIRES_DATA_DATE:'Needs a programme Data Date',
    CLAIM_ACTIVITY_CORRESPONDENCE_REQUIRES_ACTIVE_PROGRAMME:'Needs a current programme',
    FLOAT_RISK_SOURCE_RECONCILIATION_REQUIRES_CURRENT_PROGRAMME:'Needs a current programme',
  };
  const diagnostics=Array.isArray(item.diagnostics)?item.diagnostics:[];
  for(const code of diagnostics){
    const text=needs[String(code).split(':')[0]!];
    if(text)return text;
  }
  return '';
}

/** The note under an unknown value: the reason first, then the measure's basis.
 * A known value keeps its basis unchanged. */
export function unknownTileNote(value:unknown,basis:unknown,reason?:unknown):string{
  const base=typeof basis==='string'?basis.trim():'';
  if(!unknownScreenValue(value))return base;
  const why=unknownReasonText(reason)||unknownFactReason(value);
  if(!why||base.toLowerCase().includes(why.toLowerCase()))return base;
  return base?why+' · '+base:why;
}

/** A unit is shown only after a known value. */
export function unknownWithUnit(shown:string,value:unknown,unit:unknown):string{
  return unknownScreenValue(value)||typeof unit!=='string'||!unit.trim()?shown:shown+' '+unit.trim();
}

/** A zero count of missing / unknown / unconfirmed items reads "None", so a real
 * zero is never mistaken for an unknown value. Any other value is returned as is. */
export function noneWhenZeroGap(value:unknown,label:unknown,basis?:unknown):unknown{
  if(value!==0)return value;
  const words=String(label??'')+' '+String(basis??'');
  return /\b(?:missing|unknown|not confirmed|unconfirmed|not established|not dated|undated|not supplied|incomplete|unclear|unquoted|without|awaiting)\b/i.test(words)?'None':value;
}

/** Why a register-based count is unknown, from the register's own reading state
 * (state, source rows, undated rows, unclear status, register issues). */
export function registerScopeReason(scope:unknown,register:string):string{
  if(!scope||typeof scope!=='object')return register?'Needs '+register:'';
  const s=scope as Record<string,unknown>;
  const n=(key:string)=>typeof s[key]==='number'&&Number.isFinite(s[key] as number)?s[key] as number:0;
  if(s.state==='missing'||(n('sourceRecordCount')===0&&n('currentRecordCount')===0&&n('undatedRecordCount')===0))return register?'Needs '+register:'';
  const parts:string[]=[];
  if(n('undatedRecordCount'))parts.push(n('undatedRecordCount')+' '+(n('undatedRecordCount')===1?'record needs a raised':'records need raised')+' or status date');
  if(n('unknownStatusCount'))parts.push(n('unknownStatusCount')+' '+(n('unknownStatusCount')===1?'record needs a clear':'records need a clear')+' open or closed status');
  if(s.sourceAnalyticalOnly===true)parts.push('confirm the register as a project source');
  const diagnostics=Array.isArray(s.diagnostics)?s.diagnostics.length:0;
  if(diagnostics)parts.push('review '+diagnostics+' register '+(diagnostics===1?'issue':'issues'));
  return unknownReasonText(parts.join('; '));
}

/** Why a control count is unknown, from the register's evidence coverage state. */
export function evidenceStateReason(state:unknown,register:string):string{
  if(state==='not_submitted'||state===null||state===undefined)return register?'Needs '+register:'';
  if(state==='submitted_unparsed')return register?register.replace(/^(?:an?|the) /,'').replace(/^./,c=>c.toUpperCase())+' supplied but not yet read':'';
  if(state==='partial')return register?'Confirm '+register.replace(/^(?:an?) /,'the ')+' is complete and dated':'';
  return '';
}

/** Why claim / delay-event counts are unknown, from the claim population state. */
export function delayPopulationReason(state:unknown):string{
  if(state==='quarantined')return 'Review the quarantined claim rows before they are counted';
  if(state==='missing')return 'Needs a claim or delay-event register';
  if(state==='partial')return 'Confirm the claim register is complete';
  return '';
}

/** Why a programme movement between revisions is unknown: windows need two
 * comparable revisions, and a movement needs the submitted completion date in both. */
export function programmeRevisionReason(revisionCount:unknown,windowCount?:unknown):string{
  if((typeof revisionCount==='number'&&revisionCount<2)||windowCount===0)return 'Needs a second comparable programme revision';
  return 'Needs a submitted completion date in the first and latest revisions';
}

/** Why a comparison against the baseline is unknown, from the baseline state. */
export function baselineReason(comparison:unknown):string{
  const c=comparison&&typeof comparison==='object'?comparison as Record<string,unknown>:null;
  return c&&(c.state==='established'||c.state==='confirmed'||c.state==='adopted')?'':'Needs a confirmed baseline programme';
}

/** Why a movement against the controlled baseline is unknown, read from the
 * baseline state and the revision's own comparison counts: no confirmed baseline,
 * no activity of the revision matched to a baseline activity, or (for the project
 * finish) a finish date missing on one side. Empty when the movement is not
 * unknown for one of these reasons. */
export function baselineMovementReason(comparison:unknown,point?:unknown,measure?:unknown):string{
  const base=baselineReason(comparison);
  if(base)return base;
  const p=point&&typeof point==='object'?point as Record<string,unknown>:null;
  if(!p)return '';
  if(measure==='project_finish')return p.forecastCompletionIso?'Needs a finish date in the baseline programme':'Needs a submitted finish date in this revision';
  if(p.comparableActivities!==0)return '';
  const total=typeof p.sourceActivityCount==='number'&&Number.isFinite(p.sourceActivityCount)&&p.sourceActivityCount>0?p.sourceActivityCount:null;
  return 'Needs activities matched to the baseline'+(total!==null?' (0 of '+total+' matched)':'');
}

/** Browser source for every helper above. */
export function unknownReasonSource():string{
  return [unknownScreenValue,unknownReasonText,unknownFactReason,unknownTileNote,unknownWithUnit,noneWhenZeroGap,registerScopeReason,evidenceStateReason,delayPopulationReason,programmeRevisionReason,baselineReason,baselineMovementReason].map(fn=>fn.toString()).join('\n')+'\n';
}
