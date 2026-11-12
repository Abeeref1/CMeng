/** One shared reader for retained source references, so no page shows an
 * internal span code ("pdf_page:1:65:102") as if it were a location. The exact
 * references stay in the record for audit; people see "page 1", "pages 1, 2",
 * "row 14" or "paragraph 3". Self-contained so its source can be embedded in
 * the browser scripts, the same way the count helpers are. */
export function readableSourceLocations(refs:readonly unknown[]):string{
  const pages=new Set<number>(),rows=new Set<number>(),paragraphs=new Set<number>(),lines=new Set<number>(),other:string[]=[];
  for(const ref of refs){
    const text=String(ref??'').trim();if(!text)continue;
    const page=/(?:^|:)(?:pdf_page|page)[:\s]+(\d+)/i.exec(text);
    if(page){pages.add(Number(page[1]));continue;}
    const row=/(?:^|:)(?:sheet_row|csv_row|row)[:\s]+(\d+)/i.exec(text);
    if(row){rows.add(Number(row[1]));continue;}
    const block=/(?:^|:)(?:docx_block|paragraph|docx_table_cell)[:\s]+(\d+)/i.exec(text);
    if(block){paragraphs.add(Number(block[1]));continue;}
    const line=/(?:^|:)(?:text_line|line)[:\s]+(\d+)/i.exec(text);
    if(line){lines.add(Number(line[1]));continue;}
    // An internal identifier is never shown; a plain written location is.
    if(!/[_:]/.test(text)&&!/^[0-9a-f-]{16,}$/i.test(text))other.push(text);
  }
  const list=(label:string,values:Set<number>)=>{
    const sorted=[...values].sort((a,b)=>a-b);if(!sorted.length)return '';
    const shown=sorted.slice(0,6).join(', ')+(sorted.length>6?' and '+(sorted.length-6)+' more':'');
    return (sorted.length===1?label:label+'s')+' '+shown;
  };
  const parts=[list('page',pages),list('row',rows),list('paragraph',paragraphs),list('line',lines),...[...new Set(other)].slice(0,3)].filter(Boolean);
  return parts.length?parts.join('; '):'retained source text';
}
/** A money amount as people read it: 5840000000 becomes 5,840,000,000. */
export function readableAmount(value:unknown):string{
  const number=Number(value);
  if(value===null||value===undefined||value===''||!Number.isFinite(number))return String(value??'');
  return number.toLocaleString('en-US',{maximumFractionDigits:2});
}
/** Browser source for the helpers, for embedding in page scripts. */
export function sourceLocationsSource():string{return readableSourceLocations.toString()+'\n'+readableAmount.toString()+'\n';}
