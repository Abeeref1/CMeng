/** P6 civil timestamps have no timezone. Preserve the submitted wall clock
 * independently of the operating system timezone; explicit offsets stay explicit. */
export function parseScheduleTime(value: string): number {
  const text = value.trim().replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, '$1T$2');
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(text) ? text + 'Z' : text;
  return Date.parse(normalized);
}
