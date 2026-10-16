/** A populated text layer can still be unreadable (for example, a rotated scan
 * with one OCR character per line). This is a conservative rejection check, not
 * a statement that every accepted character or numeric cell is correct. */
export function fragmentedPdfText(text: string): boolean {
  // Combining vowel marks must not split a normal Arabic or accented word
  // into apparent single-character fragments. The retained text is untouched.
  const words = text.normalize('NFC').replace(/\p{M}/gu,'').match(/[\p{Script=Latin}\p{Script=Arabic}]+/gu) ?? [];
  if (words.length < 40) return false;
  const singles = words.filter(word => [...word].length === 1).length;
  const meaningful = words.filter(word => [...word].length >= 3).length;
  return singles / words.length >= 0.65 && meaningful / words.length < 0.15;
}

export function hasUnreadableNativePages(result: {pages: readonly {method: string;text: string}[]}): boolean {
  return result.pages.some(page => page.method === 'native' && fragmentedPdfText(page.text));
}

/** Retained physical reading evidence must contain real readable text, or a truly
 * blank page. Page identity and AI review are checked separately by the caller.
 * Never infer readability from the saved method label alone. */
export function legiblePdfPageEvidence(page:{method:string;text:string}):boolean {
  if(typeof page.text!=='string')return false;
  if(page.method==='blank')return page.text.trim().length===0;
  return (page.method==='native'||page.method==='ocr')&&
    /[\p{L}\p{N}]/u.test(page.text)&&!fragmentedPdfText(page.text);
}
