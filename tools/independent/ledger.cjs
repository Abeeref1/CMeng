'use strict';
// Independent commercial ledger (T12). Plain JS, no CMeng imports.
// Money is summed in integer minor units (fils/cents, 2 decimals) so sums are exact.
// Submitted, approved and rejected variations are kept apart; only approved ones,
// dated on or before the data date, change the current contract value.

function minor(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.round(v * 100 + (v >= 0 ? 1e-7 : -1e-7));
}
function major(m) { return m === null ? null : m / 100; }
function sumMinor(values) {
  let s = 0;
  for (const v of values) { const m = minor(v); if (m === null) return null; s += m; }
  return s;
}

/**
 * variations: [{id, state:'pending'|'approved'|'rejected', amount, approvalDate?}]
 * Pending is the submitted, not-yet-decided position.
 */
function variationPosition({ originalValue, variations, dataDateIso }) {
  const out = { submitted: { count: 0, value: 0 }, approved: { count: 0, value: 0 }, rejected: { count: 0, value: 0 }, futureApproved: { count: 0, value: 0 }, undatedApproved: 0 };
  const buckets = { pending: [], approved: [], rejected: [], future: [] };
  for (const v of variations) {
    if (v.state === 'approved') {
      if (!v.approvalDate) { out.undatedApproved += 1; continue; }
      if (dataDateIso && v.approvalDate.slice(0, 10) > dataDateIso) { buckets.future.push(v.amount); continue; }
      buckets.approved.push(v.amount);
    } else if (v.state === 'rejected') buckets.rejected.push(v.amount);
    else buckets.pending.push(v.amount);
  }
  const fill = (key, arr) => { out[key] = { count: arr.length, value: major(sumMinor(arr)) }; };
  fill('submitted', buckets.pending); fill('approved', buckets.approved); fill('rejected', buckets.rejected); fill('futureApproved', buckets.future);
  const orig = minor(originalValue ?? null);
  out.currentContractValue = orig === null || out.undatedApproved > 0 || out.approved.value === null
    ? null : major(orig + minor(out.approved.value));
  return out;
}

/** payments: [{certified, paid}] per certificate. Outstanding = certified - paid, per row and in total. */
function paymentPosition(payments) {
  const certified = sumMinor(payments.map(p => p.certified));
  const paid = sumMinor(payments.map(p => p.paid));
  return {
    certified: major(certified), paid: major(paid),
    outstanding: certified === null || paid === null ? null : major(certified - paid),
    rows: payments.map(p => {
      const c = minor(p.certified), q = minor(p.paid);
      return { outstanding: c === null || q === null ? null : major(c - q) };
    }),
  };
}

/** Retention held = sum(deducted) - sum(released); release cannot exceed what was deducted. */
function retentionPosition({ deductions, releases, capValue }) {
  const d = sumMinor(deductions), r = sumMinor(releases);
  if (d === null || r === null) return { deducted: null, released: null, held: null, overRelease: null, capExceeded: null };
  const cap = capValue === undefined || capValue === null ? null : minor(capValue);
  return { deducted: major(d), released: major(r), held: major(d - r), overRelease: r > d, capExceeded: cap === null ? null : d > cap };
}

/**
 * Sectional LD. sections: [{id, ratePerDay, delayDays, capValue|null}], overallCap|null.
 * Section LD = min(rate x delay, section cap). Total = min(sum, overall cap).
 */
function sectionalLd({ sections, overallCap }) {
  const rows = [];
  let total = 0;
  for (const s of sections) {
    const rate = minor(s.ratePerDay);
    if (rate === null || !Number.isInteger(s.delayDays)) return { rows: null, uncapped: null, total: null };
    const delay = Math.max(0, s.delayDays);
    const raw = rate * delay;
    const cap = s.capValue === null || s.capValue === undefined ? null : minor(s.capValue);
    const capped = cap === null ? raw : Math.min(raw, cap);
    rows.push({ id: s.id, raw: major(raw), capped: major(capped), capApplied: cap !== null && raw > cap });
    total += capped;
  }
  const oc = overallCap === null || overallCap === undefined ? null : minor(overallCap);
  return { rows, uncapped: major(total), total: major(oc === null ? total : Math.min(total, oc)), overallCapApplied: oc !== null && total > oc };
}

module.exports = { variationPosition, paymentPosition, retentionPosition, sectionalLd, minor, major };
