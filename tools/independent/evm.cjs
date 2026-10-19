'use strict';
// Independent EVM calculator (T12). Plain JS, no CMeng imports.
// Every input is a money amount in one currency and one tax basis.
// A missing input gives null, never 0. A zero denominator gives null.
// Ratios and money are rounded half away from zero to 6 decimals using
// decimal string arithmetic, so 0.1+0.2 style binary noise never shows.

function toDecimal(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));
  if (!m) return null;
  const frac = m[3] || '';
  let scale = frac.length - Number(m[4] || '0');
  let units = BigInt((m[1] || '') + m[2] + frac);
  if (scale < 0) { units = units * 10n ** BigInt(-scale); scale = 0; }
  return { units, scale };
}
function align(a, b) {
  const scale = Math.max(a.scale, b.scale);
  return [a.units * 10n ** BigInt(scale - a.scale), b.units * 10n ** BigInt(scale - b.scale), scale];
}
function sub(a, b) { if (!a || !b) return null; const [x, y, s] = align(a, b); return { units: x - y, scale: s }; }
function add(a, b) { if (!a || !b) return null; const [x, y, s] = align(a, b); return { units: x + y, scale: s }; }
function mul(a, b) { if (!a || !b) return null; return { units: a.units * b.units, scale: a.scale + b.scale }; }
// a / b rounded half away from zero to `digits` decimals, returned as a Number.
function div(a, b, digits = 6) {
  if (!a || !b || b.units === 0n) return null;
  let n = a.units * 10n ** BigInt(digits + b.scale);
  let d = b.units * 10n ** BigInt(a.scale);
  const neg = (n < 0n) !== (d < 0n);
  if (n < 0n) n = -n;
  if (d < 0n) d = -d;
  const q = (n * 2n + d) / (d * 2n);
  const v = Number(q) / 10 ** digits;
  return neg && v !== 0 ? -v : v;
}
function num(dec, digits = 6) { return dec ? div(dec, { units: 1n, scale: 0 }, digits) : null; }

/**
 * @param {{bac?:number|null,pv?:number|null,ev?:number|null,ac?:number|null,eac?:number|null}} input
 * eac is the submitted (source) EAC, kept apart from calculated EAC variants.
 */
function evm(input) {
  const bac = toDecimal(input.bac ?? null), pv = toDecimal(input.pv ?? null);
  const ev = toDecimal(input.ev ?? null), ac = toDecimal(input.ac ?? null);
  const srcEac = toDecimal(input.eac ?? null);
  const one = { units: 1n, scale: 0 };
  const sv = num(sub(ev, pv));
  const cv = num(sub(ev, ac));
  const spi = div(ev, pv);
  const cpi = div(ev, ac);
  // EAC variants. CPI and SPI are used unrounded (exact rational) inside the
  // formulas: BAC/CPI = BAC*AC/EV; CPI*SPI = EV*EV/(AC*PV).
  const eacCpi = div(mul(bac, ac), ev);
  const remaining = sub(bac, ev);
  const eacBudgetRate = num(add(ac, remaining));
  // AC + (BAC-EV)/(CPI*SPI) = AC + (BAC-EV)*AC*PV/(EV*EV)
  const cpiSpiNum = mul(remaining, mul(ac, pv));
  const cpiSpiDen = mul(ev, ev);
  const remainderCpiSpi = cpiSpiNum && cpiSpiDen && cpiSpiDen.units !== 0n
    ? toDecimal(div(cpiSpiNum, cpiSpiDen, 9)) : null;
  const eacCpiSpi = remainderCpiSpi && ac ? num(add(ac, remainderCpiSpi)) : null;
  const etcSource = num(sub(srcEac, ac));
  const etcCpi = eacCpi === null || !ac ? null : num(sub(toDecimal(eacCpi), ac));
  const vacSource = num(sub(bac, srcEac));
  const vacCpi = eacCpi === null || !bac ? null : num(sub(bac, toDecimal(eacCpi)));
  const tcpiBac = div(sub(bac, ev), sub(bac, ac));
  const tcpiEac = div(sub(bac, ev), sub(srcEac, ac));
  void one;
  return {
    sv, cv, spi, cpi,
    eac: { source: srcEac ? num(srcEac) : null, cpi: eacCpi, budgetRate: eacBudgetRate, cpiSpi: eacCpiSpi },
    etc: { source: etcSource, cpi: etcCpi },
    vac: { source: vacSource, cpi: vacCpi },
    tcpi: { bac: tcpiBac, eac: tcpiEac },
  };
}

module.exports = { evm, toDecimal, div, sub, add, mul, num };
