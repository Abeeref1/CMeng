import {canonicalHeader,numberValue} from '../../truth-kernel/src';
import type {DeliveryFields,DeliveryKind} from '../../delivery-core/src/types';

/** Apply the same input rules to new reviews and retained historical records.
 * Working/source values remain intact; invalid values cannot establish totals. */
export function deliveryNumericIssues(kind:DeliveryKind,fields:DeliveryFields){
 const issues:Array<{field:string;message:string}>=[];
 for(const [rawKey,raw] of Object.entries(fields)){
  const key=canonicalHeader(rawKey),text=String(raw??'').trim();if(!text)continue;
  const injury=kind==='hse'&&key==='lost time injuries';
  const quantity=(kind==='spare'||kind==='package')&&/^(required|ordered|manufactured|shipped|delivered|accepted|released|stored|handed over|asset linked) (quantity|qty)$/.test(key);
  if(!injury&&!quantity)continue;
  const value=numberValue(text);
  if(text.includes('%')||value===null||value<0||injury&&!Number.isSafeInteger(value))issues.push({field:key,message:injury?'Lost-time injuries must be a non-negative whole number.':key+' must be a non-negative quantity.'});
 }
 return issues;
}
