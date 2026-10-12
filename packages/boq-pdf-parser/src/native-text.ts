import type {BoqPdfLineItem} from './types';
import {parseStrictNumeric} from '../../boq-parser/src/numeric';

/** A native four-column BOQ may have double rules that defeat table geometry.
 * Accept only an explicit header, same-line quantity/unit/amount triples and a
 * closing budget/total. A detached or malformed numeric line rejects this path.
 * No OCR text, calculated quantity or inferred unit enters this recovery. */
export function parseAlignedNativeBoqText(page:number,text:string):BoqPdfLineItem[]{
 const lines=text.split(/\r?\n/).map(line=>line.trim());
 const header=lines.findIndex(line=>/^(?:items of work|description)\s+quantity\s+unit\s+amount$/i.test(line));
 if(header<0)return [];
 const number='[+-]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
 const unit='(?:lot|sets?|pcs?\\.?|no\\.?|nos\\.?|m[23²³]?|cu\\.?\\s*m\\.?|sq\\.?\\s*m\\.?|kgs?\\.?|man\\.?\\s*days?\\.?)';
 const row=new RegExp('^(.+?)\\s+('+number+')\\s+('+unit+')\\s+('+number+')$','i');
 const closing=new RegExp('^(?:approved budget for (?:the )?contract|total(?: contract cost)?)\\s+('+number+')$','i');
 const items:BoqPdfLineItem[]=[];let section:string|null=null,closed=false;
 for(let i=header+1;i<lines.length;i++){
  const line=lines[i]!;if(!line)continue;
  const total=closing.exec(line);
  if(total){closed=true;break;}
  const match=row.exec(line);
  if(!match){
   if(/\d[.,]\d/.test(line)||new RegExp('\\b'+unit+'$','i').test(line)||/^[-+\d.,\s]+$/.test(line))return [];
   section=line;continue;
  }
  const quantity=parseStrictNumeric(match[2]!),amount=parseStrictNumeric(match[4]!);
  if(quantity.status!=='valid'||amount.status!=='valid')return [];
  const code=/^([A-Z])\.\s+(.+)$/.exec(match[1]!);
  const description=code?.[2]??match[1]!;
  if(/^(?:total|subtotal|carried|brought forward|summary)\b/i.test(description))return [];
  const locator=(column:number)=>({page,table:0,row:i+1,column});
  items.push({page,table:0,row:i+1,rowKind:'line_item',itemNumber:code?.[1]??null,section,description,unit:match[3]!,quantity:quantity.value,rate:null,amount:amount.value,currency:null,
   sourceCells:{description:locator(1),quantity:locator(2),unit:locator(3),amount:locator(4)},status:'verified',diagnostics:['BOQ_NATIVE_ALIGNED_ROW_RECOVERED']});
 }
 return closed?items:[];
}

/** Conservative recovery for native PDFs whose ruled-table detector misses the
 * text. Only explicit item/unit/rate/amount lines qualify. Detached quantities
 * are deliberately not assigned by extraction order or inferred from amount.
 * This is partial source evidence, never a claim of a reconciled complete BOQ. */
export function parseNativeBoqText(page:number,text:string):BoqPdfLineItem[]{
 if(!/Item\s+Description\s+Unit\s+(?:Quantity\s+)?Rate\s+Amount/i.test(text)||!/\bQuantity\b/i.test(text))return [];
 const currency=/\b(?:UAE\s+Dirhams|AED)\b/i.test(text)?'AED':/\b(?:Saudi\s+Riyals?|SAR)\b/i.test(text)?'SAR':null;
 const lines=text.split(/\r?\n/),items:BoqPdfLineItem[]=[];
 const section=/\bSECTION\s+[A-Z0-9]+\s*[-–]\s*([^\n]+)/i.exec(text)?.[0]??null;
 const bill=/\bBill No\.?\s*([^\n]+)\n([^\n]+)/i.exec(text);
 const context=[bill?'Bill '+bill[1]+' / '+bill[2]:null,section].filter(Boolean).join(' / ')||null;
 const money='[+-]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)\\.\\d{2}';
 const tail=new RegExp('\\s+(m2|m3|m²|m³|m|nr|no\\.?|nos\\.?|item|sum|ls|kg|tonnes?|t|set|sets|lot)\\s+(?:('+money+'|LS)\\s+)?('+money+'|Included|Rate only|Excluded|Scope Deleted)\\s*$','i');
 let current:{id:string;description:string;line:number}|null=null;
 for(let i=0;i<lines.length;i++){
  const line=lines[i]!.trim();if(/^(?:Total\s*-|COLLECTION|GENERAL SUMMARY)/i.test(line)){current=null;continue;}
  const start=/^([A-HJ-NP-Z]|\d+(?:\.\d+)*)\s+(.+)$/.exec(line)??/^([A-HJ-NP-Z])$/.exec(line);
  if(start)current={id:start[1]!,description:start[2]??'',line:i+1};
  else if(current)current.description+=' '+line;
  if(!current)continue;
  // Unit and price cells must share the physical text line. Joining a trailing
  // unpriced item to a following bare page total would invent an item amount.
  const match=tail.exec(' '+line);if(!match)continue;
  const description=current.description.slice(0,current.description.length-match[0].length).trim();
  // A heading or a collection total cannot become a priced item.
  if(!description||/^(?:total|subtotal|carried|brought forward|page:|section\b)/i.test(description)){current=null;continue;}
  const rate=match[2]&&new RegExp('^'+money+'$').test(match[2])?Number(match[2].replaceAll(',','')):null;
  const amount=new RegExp('^'+money+'$').test(match[3]!)?Number(match[3]!.replaceAll(',','')):null;
  const locator={page,table:0,row:current.line,column:1};
  items.push({page,table:0,row:current.line,rowKind:'line_item',itemNumber:current.id,section:context,description,unit:match[1]!,quantity:null,rate,amount,currency,
    sourceCells:{description:locator,unit:locator,...rate!==null?{rate:locator}:{},...amount!==null?{amount:locator}:{}},status:'unresolved',
    diagnostics:['BOQ_NATIVE_TEXT_ROW_RECOVERED','BOQ_QUANTITY_COLUMN_ALIGNMENT_UNRESOLVED',...amount===null?['BOQ_AMOUNT_NOT_NUMERIC:'+match[3]]:[]]});
  current=null;
 }
 return items;
}

export function nativeBoqReportedTotals(pages:readonly {pageNumber:number;method:string;text:string}[]){
 return pages.filter(p=>p.method==='native'&&/GENERAL SUMMARY/i.test(p.text)).flatMap(p=>{
  const matches=[...p.text.matchAll(/Total\s*[-–]\s*(UAE\s+Dirhams|AED|Saudi\s+Riyals?|SAR)\s*[-–]\s*(Exclusive of VAT|Inclusive of VAT)\s+([\d,]+\.\d{2})/gi)];
  return matches.map(m=>({page:p.pageNumber,label:'General summary total stated in the source',amount:Number(m[3]!.replaceAll(',','')),currency:/UAE|AED/i.test(m[1]!)?'AED':'SAR',taxBasis:/Exclusive/i.test(m[2]!)?'exclusive_of_vat':'inclusive_of_vat',sourceText:m[0]}));
 });
}
