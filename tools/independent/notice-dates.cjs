'use strict';
// Independent notice and contract-date calculator (T12). Plain JS, no CMeng imports.
// Dates are civil dates (YYYY-MM-DD). A time of day on a notice does not move it
// to another day: "within 28 days" is met by any notice issued on or before the
// 28th civil day after the trigger date. Unknown input gives null, never a guess.

const DAY = 86400000;
function civil(iso) {
  if (typeof iso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return t;
}
function iso(t) { return new Date(t).toISOString().slice(0, 10); }
function addCalendarDays(dateIso, days) {
  const t = civil(dateIso);
  if (t === null || !Number.isInteger(days)) return null;
  return iso(t + days * DAY);
}
function isWorking(t, rule) {
  const wd = new Date(t).getUTCDay();
  return !rule.weekendDays.includes(wd) && !(rule.holidays || []).includes(iso(t));
}
/** N working days after the trigger; the trigger day itself is not counted. */
function addWorkingDays(dateIso, days, rule) {
  const t0 = civil(dateIso);
  if (t0 === null || !Number.isInteger(days) || days < 0) return null;
  if (!rule || !Array.isArray(rule.weekendDays)) return null; // weekend not stated: unknown
  let t = t0, left = days;
  while (left > 0) { t += DAY; if (isWorking(t, rule)) left -= 1; }
  return iso(t);
}
function civilDaysBetween(fromIso, toIso) {
  const a = civil(fromIso), b = civil(toIso);
  return a === null || b === null ? null : Math.round((b - a) / DAY);
}
/**
 * @param {{triggerIso:string|null, issuedIso:string|null,
 *   rule:{periodDays:number, dayBasis:'calendar'|'working', weekendDays?:number[], holidays?:string[]}|null}} input
 */
function noticeDeadline(input) {
  const rule = input.rule;
  if (!rule || !Number.isInteger(rule.periodDays)) return { deadlineIso: null, timeliness: 'rule_missing', elapsedCalendarDays: null };
  if (civil(input.triggerIso) === null) return { deadlineIso: null, timeliness: 'trigger_missing', elapsedCalendarDays: null };
  const deadlineIso = rule.dayBasis === 'working'
    ? addWorkingDays(input.triggerIso, rule.periodDays, rule)
    : rule.dayBasis === 'calendar' ? addCalendarDays(input.triggerIso, rule.periodDays) : null;
  if (deadlineIso === null) return { deadlineIso: null, timeliness: 'day_basis_unknown', elapsedCalendarDays: null };
  if (civil(input.issuedIso) === null) return { deadlineIso, timeliness: 'not_issued', elapsedCalendarDays: null };
  const issuedDay = input.issuedIso.slice(0, 10);
  return {
    deadlineIso,
    elapsedCalendarDays: civilDaysBetween(input.triggerIso, issuedDay),
    timeliness: issuedDay <= deadlineIso ? 'timely' : 'late',
  };
}
/** Union of inclusive [fromIso,toIso] award periods, in calendar days. */
function unionDays(periods) {
  const spans = [];
  for (const p of periods) {
    const a = civil(p.fromIso), b = civil(p.toIso);
    if (a === null || b === null || b < a) return null; // an unreadable award makes the total unknown
    spans.push([a, b]);
  }
  spans.sort((x, y) => x[0] - y[0]);
  let total = 0, cur = null;
  for (const s of spans) {
    if (!cur || s[0] > cur[1] + DAY) { if (cur) total += (cur[1] - cur[0]) / DAY + 1; cur = [s[0], s[1]]; }
    else cur[1] = Math.max(cur[1], s[1]);
  }
  if (cur) total += (cur[1] - cur[0]) / DAY + 1;
  return total;
}
/**
 * Revised completion = original completion + awarded EOT (calendar days).
 * awards: [{days}] summed when no periods are stated; [{fromIso,toIso}] counted once by union.
 */
function revisedCompletion(originalIso, awards) {
  if (civil(originalIso) === null) return { awardedDays: null, revisedIso: null };
  if (!Array.isArray(awards)) return { awardedDays: null, revisedIso: null };
  const withPeriods = awards.filter(a => a.fromIso || a.toIso);
  if (withPeriods.length && withPeriods.length !== awards.length) return { awardedDays: null, revisedIso: null };
  let days;
  if (withPeriods.length) days = unionDays(withPeriods);
  else {
    if (awards.some(a => !Number.isInteger(a.days))) return { awardedDays: null, revisedIso: null };
    days = awards.reduce((s, a) => s + a.days, 0);
  }
  return { awardedDays: days, revisedIso: days === null ? null : addCalendarDays(originalIso, days) };
}

module.exports = { addCalendarDays, addWorkingDays, civilDaysBetween, noticeDeadline, unionDays, revisedCompletion };
