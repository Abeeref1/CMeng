/** OCR agreement is an observation, not independent source confirmation.
 * These flags apply to every value, regardless of project, magnitude or zero. */
export const BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED='BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED';
export function boqNumericsNeedConfirmation(diagnostics:readonly string[]=[]):boolean{
 return diagnostics.some(code=>code==='BOQ_AMOUNT_ARITHMETIC_MISMATCH'||code===BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED||code==='BOQ_OFFLINE_RASTER_CELL_EVIDENCE');
}
