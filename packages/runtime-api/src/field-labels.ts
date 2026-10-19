/**
 * T10: one reader-facing fallback for field keys and codes that have no
 * curated label. It is used on screen (inlined into the browser humanizeKey and
 * issue headings), on the server (issue summaries) and in downloads, so an
 * internal name never reaches a reader as a heading, column, filter, group or
 * cell value. Plain sentence case, no underscores, no camelCase:
 * 'recordActionCount' -> 'Record action count', 'dataDateIso' -> 'Data date',
 * 'memberIds' -> 'Member IDs', 'PAYMENT_CURRENCY_BASIS_CONFLICT' -> 'Payment currency basis conflict'.
 *
 * Only values that are field names or codes are rewritten. Anything else is
 * returned unchanged: IDs (act_1001, ncr_014, ASSET_17), units (kVA, kWh, kN,
 * kPa), file names, emails, URLs and ordinary text. Inside free text only
 * standalone field names are rewritten ('periodEnd, not cash release' ->
 * 'period end, not cash release').
 *
 * Must stay self-contained (no imports, no outer references): its source text
 * is embedded into the browser script with Function.prototype.toString().
 */
export function readableFieldLabel(key: unknown): string {
  const raw = String(key ?? '').trim();
  if (!raw) return '';
  // Field-name shapes. Every segment starts with a letter, so IDs such as
  // act_1001 or ASSET_17 are not codes. camelCase needs a lower-case run of at
  // least two letters, so units such as kVA, kWh, kN and kPa are not codes.
  const camel = '[a-z]{2,}(?:[A-Z][a-z0-9]+|[A-Z]{2,}(?=[A-Z][a-z]|$))+';
  const snake = '[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)+';
  const upper = '[A-Z][A-Z0-9]*(?:_[A-Z][A-Z0-9]*)+';
  // camelCase joined to snake_case (retentionCalendar_full_source) and
  // percentile fields (p50CompletionIso) are field names too.
  const mixed = '[a-z]{2,}(?:[A-Z][a-z0-9]+)+(?:_[a-z][a-z0-9]*)+';
  const percentile = 'p[0-9]{2}(?:[A-Z][a-z0-9]+)+';
  const fileExtension = /\.(?:pdf|xlsx|xlsm|xls|csv|xer|xml|docx|doc|txt|json|zip|png|jpe?g|dwg|html?|md|pptx?)$/i;
  if (/\s/.test(raw)) {
    // Free text: rewrite only standalone field names; never a part of a file
    // name, email, URL, path or ID.
    const embedded = new RegExp('(?<![\\w.@/:\\\\-])(?:' + camel + '|' + snake + ')(?![\\w@/\\\\-]|\\.\\w)', 'g');
    return raw.replace(embedded, (word: string) => {
      const label = readableFieldLabel(word);
      return /^[A-Z]{2,}\b/.test(label) || /^CMeng\b/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
    });
  }
  const dotted = /^[a-z][A-Za-z]*(?:\.[a-z][A-Za-z]*)+$/.test(raw) && !fileExtension.test(raw);
  const kebab = /^[a-z]{2,}(?:-[a-z]{2,})+$/.test(raw);
  const singleWord = /^[a-z]{3,}$/.test(raw) && !/^(?:kva|kwh|mwh|kpa|mpa|nos|hrs)$/.test(raw);
  const isCode = new RegExp('^(?:' + camel + '|' + snake + '|' + upper + '|' + mixed + '|' + percentile + ')$').test(raw) || dotted || kebab || singleWord;
  if (!isCode) return raw;
  const words: Record<string, string> = {
    id: 'ID', ids: 'IDs', ref: 'reference', refs: 'references', qty: 'quantity', amt: 'amount', num: 'number',
    desc: 'description', pkg: 'package', calc: 'calculation', cmeng: 'CMeng', pct: '%', percent: '%',
    ncrs: 'NCRs', rfis: 'RFIs', eots: 'EOTs', ipcs: 'IPCs', boqs: 'BOQs', kpis: 'KPIs',
    sha256: 'SHA-256', sha1: 'SHA-1', md5: 'MD5',
  };
  const acronyms = /^(?:eot|cpi|spi|ncr|rfi|cpm|wbs|eac|etc|ld|lds|boq|pmo|ai|pdf|ipc|kpi|hse|evm|tcpi|bac|vac|xer|csv|qa|qc|pv|ev|ac|sla|fx|cbs|mcp|rag|po|sv|cv|ptw|mep|vat|hvac|ocr|fidic|ltifr|trir|api|url|ifc|mir|wir|bei|sar|usd|aed|eur|gbp|qar|kwd|omr|bhd|jod|egp|p[0-9]{2})$/;
  // UPPER_SNAKE codes are read as lower-case words.
  const text = new RegExp('^' + upper + '$').test(raw) ? raw.toLowerCase() : raw;
  const parts = text
    .replace(/[_.-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  parts.forEach((word, index) => {
    const lower = word.toLowerCase();
    const previous = out.length ? String(out[out.length - 1]).toLowerCase() : '';
    const next = index + 1 < parts.length ? String(parts[index + 1]).toLowerCase() : '';
    if (lower === 'iso' || (lower === 'at' && index === parts.length - 1 && index > 0)) {
      // 'isoDate' is one date, not 'Date date'.
      if (previous !== 'date' && next !== 'date') out.push('date');
      return;
    }
    // A word repeated by joining two names ('bondsInsurance.insurancePopulation') is said once.
    if (lower === previous) return;
    // 'ld_rate_per_day_x_exposure_days': 'x' between two words is a multiplication sign.
    if (lower === 'x' && index > 0 && next) { out.push('×'); return; }
    // Liquidated damages: 'ldsAmount' -> 'LD amount', 'totalLds' -> 'Total LDs'.
    if (lower === 'lds') { out.push(next ? 'LD' : 'LDs'); return; }
    // The e-TAHA product name keeps its own spelling ('E_TAHA', 'e_taha').
    if (lower === 'e' && next === 'taha') { out.push('e-TAHA'); return; }
    if (lower === 'taha' && previous === 'e-taha') return;
    if ((lower === 'pct' || lower === 'percent') && !out.length) { out.push('percent'); return; }
    if (Object.prototype.hasOwnProperty.call(words, lower)) { out.push(words[lower] as string); return; }
    if (acronyms.test(lower)) { out.push(lower.toUpperCase()); return; }
    // Acronyms already written in capitals inside camelCase (openNCRCount) stay as written.
    if (text === raw && /^[A-Z0-9]{2,}$/.test(word)) { out.push(word); return; }
    out.push(lower);
  });
  const joined = out.join(' ');
  return /^e-TAHA\b/.test(joined) ? joined : joined.charAt(0).toUpperCase() + joined.slice(1);
}

/**
 * A data path ('activityFloatReconciliation.rows', '/data/inferredMapping/sourceWbsLinks')
 * as plain words with its context kept: 'Activity float reconciliation · rows'.
 * Numeric indexes and the 'data' root are dropped. Self-contained apart from
 * readableFieldLabel, which must be defined alongside it.
 */
export function readablePathLabel(path: unknown): string {
  const lowerFirst = (label: string) => /^[A-Z]{2,}\b/.test(label) || /^CMeng\b/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
  const segments = String(path ?? '').split(/[./]+/).filter(s => s && !/^[0-9]+$/.test(s) && s !== 'data');
  if (!segments.length) return '';
  return segments.map((segment, index) => {
    // A selector such as completionBases[basis=actual] keeps its value: 'Completion bases (actual)'.
    const selectors = Array.from(segment.matchAll(/\[(?:[^\]=]*=)?([^\]]*)\]/g), m => String(m[1] ?? '')).filter(v => v && v !== '*');
    const base = readableFieldLabel(segment.replace(/\[[^\]]*\]/g, ''));
    const label = base + (selectors.length ? ' (' + selectors.map(v => lowerFirst(readableFieldLabel(v))).join(', ') + ')' : '');
    return index === 0 ? label : lowerFirst(label);
  }).join(' · ');
}
