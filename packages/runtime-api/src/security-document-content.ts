/** Financial security needs instrument content. Folder names and confidentiality
 * labels describe access restrictions, not a bond or bank guarantee. */
export function hasFinancialSecurityContent(text:string):boolean {
  const value=text.normalize('NFKC');
  const instrument=/\b(?:performance|advance payment|retention|bid|tender)\s+(?:bond|guarantee)|\bbank\s+guarantee\b|خطاب\s+ضمان/.test(value.toLowerCase());
  const identity=/\b(?:guarantee|bond)\s+(?:no\.?|number|reference|id)\b|رقم\s+الضمان/i.test(value);
  const parties=/\b(?:beneficiary|issuing bank|issuer)\b|المستفيد|البنك\s+المصدر/i.test(value);
  const terms=/\b(?:expiry|expiration|guaranteed amount|guarantee amount|bond amount)\b|تاريخ\s+الانتهاء|مبلغ\s+الضمان/i.test(value);
  return instrument&&identity&&parties&&terms;
}
