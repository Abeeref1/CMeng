import {parseCsv as parseDelimitedCsv} from "../../tabular-parser/src";
import {canonicalHeader,prepareRegisterRows} from './register-schema';
export * from './register-schema';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
export * from './reporting';
export * from './issues';
export * from './aggregates';

export type FactState = 'official' | 'candidate' | 'missing' | 'partial' | 'conflicted';
export interface SourceReceipt {
  documentId: string; sourceHash: string; revision: string; locator: string;
  basisState: string; authority: 'source_record' | 'source_approved' | 'engineer_determination';
}
export interface EvidenceDocument {
  documentId: string; sourceHashSha256: string; storedPath: string;
  sourceFilename: string; mediaType: string; basisState: string;
  linkedArtifactId: string | null; uploadedAt: string; familyKey?: string; documentType?: string;
  tabularRead?: {producerVersion:string;sourceHashSha256:string;sheets:Array<{name:string;rows:string[][]}>} | undefined;
}
export interface SourceRow { cells: Readonly<Record<string, string>>; receipt: SourceReceipt }
export interface SourceTable { headers: string[]; rows: SourceRow[]; document: EvidenceDocument; recognition?: {headerRow:number;readRowCount:number;recognized:boolean;unknown:string[]}; }
export interface Fact<T> {
  value: T | null; state: FactState; receipts: SourceReceipt[];
  diagnostics: string[]; method: string; coverage: { known: number; total: number };
}
export const norm = (value: string): string => value.normalize('NFKC').replace(/^\uFEFF/, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function csv(text: string): string[][] {
  const parsed = parseDelimitedCsv(Buffer.from(text, 'utf8'));
  if (parsed.diagnostics.includes('CSV_UNTERMINATED_QUOTED_FIELD')) throw new Error('CSV_UNCLOSED_QUOTE');
  return parsed.rows.map(row => row.cells).filter(row => row.some(value => value.trim()));
}

const headerNames = new Map<string,string>();
const headerKey = (name:string) => {
  const cached=headerNames.get(name);if(cached!==undefined)return cached;
  const key=canonicalHeader(name);if(headerNames.size>=4096)headerNames.clear();headerNames.set(name,key);return key;
};
export const cell = (row: SourceRow, ...names: string[]): string => {
  for (const name of names) { const v = row.cells[headerKey(name)]; if (v !== undefined && v.trim() !== '') return v.trim(); }
  return '';
};
export function numberValue(value: string): number | null {
  const v = value.trim().replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[٬]/g, ',').replace(/[٫]/g, '.');
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?%?$/.test(v)) return null;
  const n = Number(v.replace(/[, %]/g, '')); return Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER ? n : null;
}
const dateResults=new Map<string,string|null>();
export function dateValue(value: string): string | null {
  if(dateResults.has(value))return dateResults.get(value)!;
  const result=parseDateValue(value);
  if(dateResults.size>=16384)dateResults.clear();
  dateResults.set(value,result);return result;
}
function parseDateValue(value: string): string | null {
  const s = value.trim(); let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)?)?$/.exec(s);
  const words = /^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i.exec(s);
  if (iso) { y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3]); }
  else if (words) { y = Number(words[3]); m = ['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(words[2]!.toLowerCase()) + 1; d = Number(words[1]); }
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0,10) : null;
}
export const sumKnown = (values: readonly (number | null)[]): number | null => {
  if (!values.length || values.some(v => v === null)) return null;
  let sum = 0, correction = 0;
  for (const n of values as number[]) { const v = n - correction; const next = sum + v; correction = (next - sum) - v; sum = next; }
  return Number(sum.toFixed(8));
};
export const ratio = (n: number | null, d: number | null): number | null => n === null || d === null || d <= 0 ? null : n / d;
export const round = (n: number | null, decimals = 4): number | null => n === null ? null : Number(n.toFixed(decimals));
export function fact<T>(value: T | null, receipts: SourceReceipt[], method: string, diagnostics: string[] = []): Fact<T> {
  return { value, state: value === null ? 'missing' : receipts.length > 0 && receipts.every(r => ['active','additive'].includes(r.basisState)) ? 'official' : 'candidate', receipts, method, diagnostics, coverage: {known: value === null ? 0 : 1, total: 1} };
}
const tableCache = new Map<string, SourceTable>();
export function sourceTables(documents: readonly EvidenceDocument[], diagnostics: string[], options: {includeHistorical?: boolean} = {}): SourceTable[] {
  const result: SourceTable[] = [], hashes = new Set<string>();
  for (const doc of [...documents].sort((a,b)=>Number(b.basisState!=='candidate')-Number(a.basisState!=='candidate'))) {
    if ((!options.includeHistorical && !['active','additive','candidate'].includes(doc.basisState)) || (!/csv/i.test(doc.mediaType + ' ' + doc.sourceFilename)&&!doc.tabularRead)) continue;
    const identity = doc.sourceHashSha256;
    if (hashes.has(identity)) continue;
    hashes.add(identity);
    try {
      const stat = statSync(doc.storedPath);
      const key = [doc.documentId, identity, doc.documentType, doc.tabularRead?.producerVersion, doc.basisState, doc.linkedArtifactId, doc.storedPath, stat.size, stat.mtimeMs, stat.ctimeMs].join(':');
      const cached = tableCache.get(key); if (cached) { result.push(cached); continue; }
      const bytes = readFileSync(doc.storedPath);
      if (createHash('sha256').update(bytes).digest('hex') !== identity) { diagnostics.push('SOURCE_HASH_MISMATCH:' + doc.documentId); continue; }
      const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf16le' : 'utf8';
      const sheets=doc.tabularRead?.sourceHashSha256===identity?doc.tabularRead.sheets:[{name:'CSV',rows:csv(bytes.toString(encoding))}];
      for(const sheet of sheets){
        const prepared=prepareRegisterRows(sheet.rows,doc.documentType),{headers,rows}=prepared;
        if(!headers.length||headers.some(h=>!h)||new Set(headers).size!==headers.length){diagnostics.push('DUPLICATE_NORMALIZED_HEADERS:'+doc.documentId);continue;}
        if(rows.some(row=>row.length!==headers.length)){diagnostics.push('CSV_ROW_WIDTH_MISMATCH:'+doc.documentId);continue;}
        if(!prepared.recognized)diagnostics.push('REGISTER_COLUMNS_NOT_RECOGNISED:'+doc.documentId+':'+prepared.rawHeaders.join(', '));
        const table:SourceTable={headers,document:doc,recognition:{headerRow:prepared.headerRow,readRowCount:prepared.readRowCount,recognized:prepared.recognized,unknown:prepared.unknown},rows:rows.map((r,i)=>({
          cells:Object.freeze(Object.fromEntries(headers.map((h,j)=>[h,r[j]??'']))),
          receipt:{documentId:doc.documentId,sourceHash:identity,revision:doc.linkedArtifactId??identity,locator:(sheet.name==='CSV'?'':'sheet:'+sheet.name+':')+'row:'+(i+prepared.headerRow+1),basisState:doc.basisState,authority:'source_record'},
        }))};
        // Multi-sheet workbooks remain distinct and retain their sheet/row references.
        if(sheets.length===1){if(tableCache.size>=64)tableCache.delete(tableCache.keys().next().value!);tableCache.set(key,table);}result.push(table);
      }
    } catch (error) { diagnostics.push('SOURCE_READ_FAILURE:' + doc.documentId + ':' + (error instanceof Error ? error.message : 'unknown')); }
  }
  return result;
}
export const has = (table: SourceTable, ...headers: string[]): boolean => headers.every(h => table.headers.includes(headerKey(h)));

/** A pending revision cannot displace an established source of the same role. */
export function governedTables(documents: readonly EvidenceDocument[], diagnostics: string[]): SourceTable[] {
  const tables = sourceTables(documents, diagnostics);
  const established = new Set(tables.filter(t => ['active','additive'].includes(t.document.basisState)).map(t => t.document.familyKey).filter(Boolean));
  return tables.filter(t => {
    if (t.document.basisState === 'candidate' && t.document.familyKey && established.has(t.document.familyKey)) {
      diagnostics.push('CANDIDATE_REVISION_NOT_APPLIED:' + t.document.documentId); return false;
    }
    return true;
  });
}

/** Date-only reporting cutoff. Missing dates never acquire current-period authority. */
export function reportingScope(date: string | null | undefined, dataDate: string | null | undefined): 'as_of' | 'future' | 'undated' {
  const d=dateValue(date??''),cutoff=dateValue(dataDate??'');
  return !d||!cutoff?'undated':d<=cutoff?'as_of':'future';
}
