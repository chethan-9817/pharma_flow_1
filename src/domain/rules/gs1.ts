import { addDays, formatIsoDate, type IsoDate } from '../clock';
import type { Result } from '../result';

export interface Gs1Data {
  gtin: string;
  batch?: string;
  expiry?: IsoDate;
}

const GS = '\u001d'; // FNC1 / group separator
const FIXED: Record<string, number> = { '01': 14, '17': 6, '11': 6, '15': 6, '02': 14 };
const VARIABLE = new Set(['10', '21']);

/** YYMMDD -> ISO date. Day "00" means the last day of that month (GS1 convention). */
export function parseGs1Date(yymmdd: string): IsoDate | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12) return null;
  const year = 2000 + yy;
  if (dd === 0) {
    const firstOfNext = Date.UTC(mm === 12 ? year + 1 : year, mm === 12 ? 0 : mm, 1);
    return addDays(formatIsoDate(firstOfNext), -1);
  }
  const date = new Date(Date.UTC(year, mm - 1, dd));
  if (date.getUTCMonth() !== mm - 1) return null;
  return formatIsoDate(date.getTime());
}

/**
 * Parses GS1 element strings. Accepts human-readable "(01)...(10)...(17)..." and
 * the raw form where variable-length fields end at a group separator.
 * Extracts AI 01 (GTIN), 10 (batch) and 17 (expiry, YYMMDD).
 */
export function parseGs1(input: string): Result<Gs1Data> {
  // Scanners may prefix a symbology identifier such as ]C1 (GS1-128) or ]d2 (GS1 DataMatrix).
  const text = input.trim().replace(/^\][A-Za-z]\d/, '');
  if (!text) return { ok: false, error: 'Empty barcode' };

  const fields = new Map<string, string>();

  if (text.includes('(')) {
    const re = /\((\d{2,4})\)([^(]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) fields.set(m[1]!, m[2]!.replace(GS, '').trim());
  } else {
    let i = 0;
    while (i < text.length) {
      if (text[i] === GS) {
        i++;
        continue;
      }
      const ai = text.slice(i, i + 2);
      i += 2;
      const fixed = FIXED[ai];
      if (fixed !== undefined) {
        fields.set(ai, text.slice(i, i + fixed));
        i += fixed;
      } else if (VARIABLE.has(ai)) {
        const end = text.indexOf(GS, i);
        const stop = end === -1 ? text.length : end;
        fields.set(ai, text.slice(i, stop).slice(0, 20));
        i = stop;
      } else {
        return { ok: false, error: `Unsupported application identifier (${ai})` };
      }
    }
  }

  const gtin = fields.get('01');
  if (!gtin || !/^\d{14}$/.test(gtin)) return { ok: false, error: 'Missing or invalid GTIN (01)' };

  const data: Gs1Data = { gtin };
  const batch = fields.get('10');
  if (batch) data.batch = batch;
  const rawExpiry = fields.get('17');
  if (rawExpiry) {
    const expiry = parseGs1Date(rawExpiry);
    if (!expiry) return { ok: false, error: `Invalid expiry date (17) ${rawExpiry}` };
    data.expiry = expiry;
  }
  return { ok: true, value: data };
}

/**
 * Reads whatever a camera scanner returns: a full GS1 element string, or a plain
 * retail barcode (EAN-8/EAN-13/UPC/GTIN-14) that carries the GTIN only, so batch
 * and expiry have to be typed in.
 */
export function parseScan(input: string): Result<Gs1Data> {
  const text = input.trim().replace(/^\][A-Za-z]\d/, '');
  if (/^\d{8}$|^\d{12,14}$/.test(text)) return { ok: true, value: { gtin: text.padStart(14, '0') } };
  return parseGs1(text);
}
