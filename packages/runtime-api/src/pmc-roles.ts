/** M12.1: the one PMC discipline role table. Every owner fallback (actions,
 * accountability groups and the browser review list) reads this table, so the
 * same record never gets two different accountable roles. Order matters: the
 * first matching rule wins. */
export const PMC_ROLE_RULES:ReadonlyArray<readonly [string,string]>=[
  ['risk','Risk Manager'],
  ['rfi|design|submittal|interface','Design Manager'],
  ['ncr|quality|inspection','Quality Manager'],
  ['procure|long-lead|material|purchase|supplier','Procurement Manager'],
  ['claim|notice|eot|contract','Contracts Manager'],
  ['bond|insurance|security|commercial|payment|certificate|cost|variation|cash|retention|advance','Commercial Manager'],
  ['hse|safety|permit','HSE Manager'],
  ['site|delivery|resource|construction','Construction Manager'],
  ['schedule|programme|planning|activity|cpm|float|forecast|critical|delay','Planning Manager'],
];
export const PMC_DEFAULT_ROLE='Project Controls Manager';
const compiled=PMC_ROLE_RULES.map(([pattern,role])=>[new RegExp(pattern),role] as const);
/** The accountable PMC role for a domain, page key or scope text. */
export function pmcRoleFor(scope:string):string{
  const text=String(scope??'').toLowerCase();
  return compiled.find(([pattern])=>pattern.test(text))?.[1]??PMC_DEFAULT_ROLE;
}
/** Browser source for the same table (inlined into page scripts). */
export function pmcRoleSource():string{
  return 'var PMC_ROLE_RULES='+JSON.stringify(PMC_ROLE_RULES)+';function pmcRoleFor(scope){var t=String(scope||"").toLowerCase();for(var i=0;i<PMC_ROLE_RULES.length;i++){if(new RegExp(PMC_ROLE_RULES[i][0]).test(t))return PMC_ROLE_RULES[i][1];}return '+JSON.stringify(PMC_DEFAULT_ROLE)+';}\n';
}
