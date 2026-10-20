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
/** Browser source for both helpers, for embedding in page scripts. */
export function countTextSource():string{return countNoun.toString()+'\n'+countText.toString()+'\n';}
