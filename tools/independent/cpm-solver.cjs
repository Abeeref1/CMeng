'use strict';
// Independent CPM solver (T12). Plain JavaScript, no imports from packages/.
// Written to judge CMeng's engine (packages/schedule-cpm), so it uses a
// different method on purpose: every calendar is turned into a list of
// whole working hours ("slots"), and every date is a slot position.
//
// Stated rules (the basis this solver uses):
// 1. Time unit is one whole working hour. Durations, remaining durations and
//    lags must be whole hours. All instants are UTC and on the hour.
// 2. A calendar is: working weekdays (0 = Sunday .. 6 = Saturday), shift
//    start hour, working hours per day (one continuous shift, start + hours
//    <= 24), and holiday dates (whole day off). Nothing is assumed: a missing
//    field is an error, never an 8-hour default.
// 3. Position p on a calendar = number of that calendar's working hours that
//    start before the instant. A start at position p is the start of working
//    hour p; a finish at position p is the end of working hour p-1. A zero
//    duration activity (milestone) uses the start instant for both dates.
// 4. Relationship lag is counted in working hours of the SUCCESSOR calendar,
//    in both passes. Predecessor events are read on the successor calendar:
//    FS  succ start  >= pos(pred finish) + lag
//    SS  succ start  >= pos(pred start)  + lag
//    FF  succ finish >= pos(pred finish) + lag
//    SF  succ finish >= pos(pred start)  + lag
// 5. Progress (retained logic): a completed activity keeps its actual dates
//    and has no float. An in-progress activity keeps its actual start (that
//    is its start event for SS/SF successors); its remaining work starts no
//    earlier than the data date and its predecessors' logic. Not-started
//    work starts no earlier than the data date.
// 6. Open ends: an activity with no successor must finish by the project
//    finish (the latest early finish). An activity with no predecessor starts
//    at the data date (or its start-on-or-after constraint).
// 7. Total float = late finish - early finish, in working hours of the
//    activity's own calendar. Free float = how many of its own working hours
//    the activity can slip before any successor's early date or the project
//    finish moves. Days = hours / that calendar's working hours per day.
//    Critical = total float <= 0.
// 8. Constraints: 'start_on_or_after' (forward) and 'finish_on_or_before'
//    (backward) only. Anything else is rejected, never ignored.

const HOUR = 3_600_000;
const DAY = 86_400_000;

function fail(message) { throw new Error('INDEPENDENT_CPM: ' + message); }

function parseInstant(value, what) {
  if (typeof value !== 'string') fail(what + ' missing');
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(value + 'T00:00:00Z') : Date.parse(value);
  if (!Number.isFinite(ms)) fail(what + ' not a date: ' + value);
  if (ms % HOUR !== 0) fail(what + ' not on the hour: ' + value);
  return ms;
}
function iso(ms) { return new Date(ms).toISOString(); }
function wholeHours(value, what) {
  if (!Number.isInteger(value)) fail(what + ' must be whole hours, got ' + value);
  return value;
}

// One calendar = sorted list of the start instants of its working hours,
// over a window wide enough for the network. Built by stepping hour by hour.
function buildCalendar(def, fromMs, toMs) {
  if (!def || typeof def.id !== 'string') fail('calendar id missing');
  if (!Array.isArray(def.workDays)) fail('calendar ' + def.id + ' workDays missing');
  if (!Number.isInteger(def.hoursPerDay) || def.hoursPerDay < 1 || def.hoursPerDay > 24) fail('calendar ' + def.id + ' hoursPerDay missing or invalid');
  if (!Number.isInteger(def.startHour) || def.startHour < 0 || def.startHour + def.hoursPerDay > 24) fail('calendar ' + def.id + ' startHour missing or invalid');
  const holidays = new Set(def.holidays || []);
  const slots = [];
  for (let t = fromMs; t < toMs; t += HOUR) {
    const date = new Date(t);
    const dayKey = date.toISOString().slice(0, 10);
    if (holidays.has(dayKey)) continue;
    if (!def.workDays.includes(date.getUTCDay())) continue;
    const hour = date.getUTCHours();
    if (hour >= def.startHour && hour < def.startHour + def.hoursPerDay) slots.push(t);
  }
  return { id: def.id, hoursPerDay: def.hoursPerDay, slots };
}

// Number of working hours of the calendar that start before instant t.
function pos(cal, t) {
  let lo = 0, hi = cal.slots.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cal.slots[mid] < t) lo = mid + 1; else hi = mid; }
  return lo;
}
function slotStart(cal, p) {
  if (p < 0 || p >= cal.slots.length) fail('calendar ' + cal.id + ' window too small at position ' + p);
  return cal.slots[p];
}
function startInstant(cal, p) { return slotStart(cal, p); }
function finishInstant(cal, p, duration) { return duration > 0 ? slotStart(cal, p - 1) + HOUR : slotStart(cal, p); }

function solve(input) {
  const dataDate = parseInstant(input.dataDate, 'data date');
  const from = dataDate - 120 * DAY;
  const to = dataDate + (input.windowDays || 1500) * DAY;
  const calendars = new Map();
  for (const def of input.calendars || []) calendars.set(def.id, buildCalendar(def, from, to));

  const acts = new Map();
  for (const a of input.activities || []) {
    if (acts.has(a.id)) fail('duplicate activity ' + a.id);
    const cal = calendars.get(a.calendar);
    if (!cal) fail('activity ' + a.id + ' calendar ' + a.calendar + ' unknown');
    const status = a.actualFinish ? 'completed' : a.actualStart ? 'in_progress' : 'not_started';
    const duration = wholeHours(a.duration, a.id + ' duration');
    const remaining = status === 'in_progress' ? wholeHours(a.remaining, a.id + ' remaining duration') : status === 'completed' ? 0 : duration;
    const constraint = a.constraint || null;
    if (constraint && !['start_on_or_after', 'finish_on_or_before'].includes(constraint.type)) fail('constraint type not supported: ' + constraint.type);
    acts.set(a.id, {
      id: a.id, cal, status, duration, remaining, constraint,
      actualStart: a.actualStart ? parseInstant(a.actualStart, a.id + ' actual start') : null,
      actualFinish: a.actualFinish ? parseInstant(a.actualFinish, a.id + ' actual finish') : null,
      preds: [], succs: [],
    });
  }
  for (const r of input.relationships || []) {
    const p = acts.get(r.pred), s = acts.get(r.succ);
    if (!p || !s) fail('relationship ' + r.pred + '->' + r.succ + ' endpoint unknown');
    if (!['FS', 'SS', 'FF', 'SF'].includes(r.type)) fail('relationship type unknown: ' + r.type);
    const link = { pred: p, succ: s, type: r.type, lag: wholeHours(r.lag || 0, 'lag ' + r.pred + '->' + r.succ) };
    p.succs.push(link); s.preds.push(link);
  }

  // Topological order (Kahn). A loop is an error.
  const indegree = new Map([...acts.values()].map(a => [a, a.preds.length]));
  const queue = [...acts.values()].filter(a => a.preds.length === 0);
  const order = [];
  while (queue.length) {
    const a = queue.shift(); order.push(a);
    for (const l of a.succs) { indegree.set(l.succ, indegree.get(l.succ) - 1); if (indegree.get(l.succ) === 0) queue.push(l.succ); }
  }
  if (order.length !== acts.size) fail('network has a loop');

  // Event instants of an activity at its early dates.
  const startEvent = a => a.status === 'not_started' ? startInstant(a.cal, a.es) : a.actualStart;
  const finishEvent = a => a.status === 'completed' ? a.actualFinish : finishInstant(a.cal, a.ef, a.remaining);

  // Forward pass.
  for (const a of order) {
    if (a.status === 'completed') continue;
    let s = pos(a.cal, dataDate);
    const d = a.remaining;
    if (a.constraint && a.constraint.type === 'start_on_or_after') s = Math.max(s, pos(a.cal, parseInstant(a.constraint.date, a.id + ' constraint date')));
    for (const l of a.preds) {
      const p = l.pred;
      if (l.type === 'FS') s = Math.max(s, pos(a.cal, finishEvent(p)) + l.lag);
      if (l.type === 'SS') s = Math.max(s, pos(a.cal, startEvent(p)) + l.lag);
      if (l.type === 'FF') s = Math.max(s, pos(a.cal, finishEvent(p)) + l.lag - d);
      if (l.type === 'SF') s = Math.max(s, pos(a.cal, startEvent(p)) + l.lag - d);
    }
    a.es = s; a.ef = s + d;
  }
  let projectFinish = -Infinity;
  for (const a of acts.values()) projectFinish = Math.max(projectFinish, finishEvent(a));

  // Backward pass: for each unfinished activity, step its finish position
  // down from above until every successor condition (at the successor's
  // late dates) and the project finish hold. Conditions on a fixed actual
  // start (in-progress) do not depend on this activity's late dates.
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const a = order[i];
    if (a.status === 'completed') continue;
    const d = a.remaining;
    const lateStartEvent = f => a.status === 'in_progress' ? null : startInstant(a.cal, f - d);
    const lateFinishEvent = f => finishInstant(a.cal, f, d);
    const fnlt = a.constraint && a.constraint.type === 'finish_on_or_before' ? parseInstant(a.constraint.date, a.id + ' constraint date') : null;
    const ok = f => {
      const fin = lateFinishEvent(f), st = lateStartEvent(f);
      // Deadlines are read on this activity's calendar (rule 3), so a
      // milestone at the next opening equals the previous closing.
      if (pos(a.cal, fin) > pos(a.cal, projectFinish)) return false;
      if (fnlt !== null && pos(a.cal, fin) > pos(a.cal, fnlt)) return false;
      for (const l of a.succs) {
        const s = l.succ;
        if (s.status === 'completed') continue;
        const sLs = s.ls; // remaining late start (retained logic)
        if (l.type === 'FS' && pos(s.cal, fin) + l.lag > sLs) return false;
        if (l.type === 'FF' && pos(s.cal, fin) + l.lag > s.lf) return false;
        if (st === null) continue;
        if (l.type === 'SS' && pos(s.cal, st) + l.lag > sLs) return false;
        if (l.type === 'SF' && pos(s.cal, st) + l.lag > s.lf) return false;
      }
      return true;
    };
    let f = pos(a.cal, projectFinish) + d + 2;
    while (!ok(f)) {
      f -= 1;
      if (f < d + 1) fail('backward pass found no feasible late finish for ' + a.id);
    }
    a.lf = f; a.ls = f - d;
  }

  // Free float: slip this activity by k of its own working hours while every
  // successor's early dates and the project finish still hold.
  function freeFloat(a) {
    if (a.status === 'completed') return null;
    const d = a.remaining;
    const fits = k => {
      const fin = finishInstant(a.cal, a.ef + k, d);
      const st = a.status === 'in_progress' ? null : startInstant(a.cal, a.es + k);
      if (pos(a.cal, fin) > pos(a.cal, projectFinish)) return false;
      for (const l of a.succs) {
        const s = l.succ;
        if (s.status === 'completed') continue;
        const sEs = s.es; // remaining early start (retained logic)
        if (l.type === 'FS' && pos(s.cal, fin) + l.lag > sEs) return false;
        if (l.type === 'FF' && pos(s.cal, fin) + l.lag > s.ef) return false;
        if (st === null) continue;
        if (l.type === 'SS' && pos(s.cal, st) + l.lag > sEs) return false;
        if (l.type === 'SF' && pos(s.cal, st) + l.lag > s.ef) return false;
      }
      return true;
    };
    let k = 0;
    while (k < a.lf - a.ef && fits(k + 1)) k += 1;
    return k;
  }

  const activities = [];
  for (const a of acts.values()) {
    if (a.status === 'completed') {
      activities.push({ id: a.id, status: a.status, calendar: a.cal.id,
        earlyStart: iso(a.actualStart), earlyFinish: iso(a.actualFinish), lateStart: null, lateFinish: null,
        totalFloatHours: null, freeFloatHours: null, totalFloatDays: null, freeFloatDays: null, critical: null });
      continue;
    }
    const tf = a.lf - a.ef;
    const ff = freeFloat(a);
    activities.push({ id: a.id, status: a.status, calendar: a.cal.id,
      actualStart: a.actualStart === null ? null : iso(a.actualStart),
      earlyStart: iso(startInstant(a.cal, a.es)), earlyFinish: iso(finishInstant(a.cal, a.ef, a.remaining)),
      lateStart: iso(startInstant(a.cal, a.ls)), lateFinish: iso(finishInstant(a.cal, a.lf, a.remaining)),
      totalFloatHours: tf, freeFloatHours: ff,
      totalFloatDays: tf / a.cal.hoursPerDay, freeFloatDays: ff / a.cal.hoursPerDay,
      critical: tf <= 0 });
  }
  return {
    dataDate: iso(dataDate), projectFinish: iso(projectFinish),
    lagCalendarRule: 'successor_calendar_both_passes',
    criticalIds: activities.filter(a => a.critical === true).map(a => a.id).sort(),
    activities,
  };
}

module.exports = { solve };
