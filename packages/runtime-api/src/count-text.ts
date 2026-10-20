/** W4: one shared rule so a count and its noun (or verb) always agree:
 * 1 record / 2 records, 1 group / 3 groups, 1 row / 0 rows.
 * Server text builders import these; browser scripts embed them with
 * `${countNoun.toString()}` so the page and the API say the same thing.
 * Both functions are self-contained so their source can be embedded. */
export function countNoun(count:unknown,singular:string,plural?:string):string{
  return Number(count)===1?singular:(typeof plural==='string'?plural:singular+'s');
}
/** The figure followed by the agreeing word. `format` keeps each caller's
 * own number formatting (thousand separators etc.); no figure is dropped. */
export function countText(count:unknown,singular:string,plural?:string,format?:(value:unknown)=>string):string{
  return (typeof format==='function'?format(count):String(count))+' '+(Number(count)===1?singular:(typeof plural==='string'?plural:singular+'s'));
}
/** A unit written in the plural ("records", "scope items", "calendar days")
 * that follows a shown figure: its last word becomes singular when the figure
 * is exactly 1. Units that are not a listed plural noun (USD, %, h) are kept. */
export function countUnit(count:unknown,unit:unknown):string{
  const text=typeof unit==='string'?unit:'';
  if(Number(count)!==1||count===null||count===undefined||count==='')return text;
  const singular:Record<string,string>={activities:'activity',items:'item',claims:'claim',records:'record',packages:'package',groups:'group',rows:'row',documents:'document',events:'event',risks:'risk',tasks:'task',issues:'issue',actions:'action',notices:'notice',letters:'letter',sources:'source',values:'value',calendars:'calendar',relationships:'relationship',candidates:'candidate',certificates:'certificate',variations:'variation',securities:'security',obligations:'obligation',assets:'asset',permits:'permit',milestones:'milestone',sections:'section',members:'member',owners:'owner',days:'day',hours:'hour',weeks:'week',months:'month',cases:'case',tests:'test',labels:'label',interfaces:'interface',deliverables:'deliverable',submittals:'submittal',suppliers:'supplier',representatives:'representative',qualifications:'qualification',references:'reference',determinations:'determination',findings:'finding',exceptions:'exception',payments:'payment',bonds:'bond',periods:'period',requirements:'requirement',areas:'area',locations:'location',workfronts:'workfront',links:'link',entries:'entry',files:'file',pages:'page',approvals:'approval'};
  return text.replace(/([A-Za-z]+)$/,word=>{const lower=word.toLowerCase(),one=singular[lower];if(!one)return word;return word===lower?one:word===word.toUpperCase()?one.toUpperCase():one.charAt(0).toUpperCase()+one.slice(1);});
}
/** Browser source for the helpers, for embedding in page scripts. */
export function countTextSource():string{return countNoun.toString()+'\n'+countText.toString()+'\n'+countUnit.toString()+'\n';}
