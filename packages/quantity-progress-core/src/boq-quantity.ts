/** An arithmetic conflict does not identify which source field is wrong.
 * Retain its reading for review; never infer or repair a decimal here. */
export function admissibleBoqQuantity(quantity:number|null,diagnostics:readonly string[]) {
  const withheld=diagnostics.includes('BOQ_AMOUNT_ARITHMETIC_MISMATCH');
  return {
    contractQuantity:withheld?null:quantity,
    diagnostics:[...new Set([...diagnostics,...(withheld&&quantity!==null?['QUANTITY_ITEM_CANDIDATE_WITHHELD:'+quantity]:[])])],
  };
}
