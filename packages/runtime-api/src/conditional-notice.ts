// SW-46 (W8): one shared rule for a notice that states a fact about the project.
// The fact is printed only when the project data supports it (`supported === true`).
// When the data shows the opposite, the true statement is printed instead; when the
// data does not establish it either way, the unknown statement is printed. An empty
// string omits the notice. Unknown is never read as true.
// This function is also copied into the browser page script (ui.ts), so it must stay
// plain, self-contained JavaScript after compilation.
export function conditionalNotice(supported:boolean|null|undefined,whenTrue:string,whenFalse='',whenUnknown=whenFalse):string{
  return supported===true?whenTrue:supported===false?whenFalse:whenUnknown;
}
