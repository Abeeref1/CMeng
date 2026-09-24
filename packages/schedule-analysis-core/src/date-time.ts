/** P6 civil timestamps have no timezone. Preserve the submitted wall clock
 * independently of the operating system timezone; explicit offsets stay explicit. */
const parsedTimes = new Map<string,number>();
export function parseScheduleTime(value: string): number {
  const cached=parsedTimes.get(value);if(cached!==undefined)return cached;
  const text = value.trim().replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, '$1T$2');
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(text) ? text + 'Z' : text;
  const parsed=Date.parse(normalized);
  if(parsedTimes.size>=65536)parsedTimes.clear();parsedTimes.set(value,parsed);return parsed;
}
