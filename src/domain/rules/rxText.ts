import type { IsoDate } from '../clock';
import type { Medicine } from '../types';

/**
 * Suggestions pulled from OCR text. These only pre-fill the upload form.
 * OCR never approves a prescription: the chemist always makes the final call.
 */
export interface RxSuggestion {
  doctorName?: string;
  registrationNo?: string;
  date?: IsoDate;
  patientName?: string;
  drugs: { medicineId: string; qty?: number }[];
}

const pad = (n: number) => String(n).padStart(2, '0');

function validDate(y: number, m: number, d: number): IsoDate | undefined {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Reads YYYY-MM-DD or Indian-style DD/MM/YYYY (also DD-MM-YY and DD.MM.YYYY). */
export function parseRxDate(text: string): IsoDate | undefined {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (dmy) {
    const year = dmy[3]!.length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return validDate(year, Number(dmy[2]), Number(dmy[1]));
  }
  return undefined;
}

export function parseRxText(text: string, medicines: Pick<Medicine, 'id' | 'brand' | 'salt'>[]): RxSuggestion {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: RxSuggestion = { drugs: [] };

  const doctor = lines.find((l) => /^dr\.?\s+\S/i.test(l));
  if (doctor) out.doctorName = doctor.replace(/\b(mbbs|md|ms|dnb|bams|bds)\b.*$/i, '').replace(/[,.\s]+$/, '').trim();

  const reg = text.match(/reg(?:istration)?\.?\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Z]{2,6}[-\s]?\d{3,8})/i);
  if (reg) out.registrationNo = reg[1]!.replace(/\s+/g, '-').toUpperCase();

  const dateLine = lines.find((l) => /date|dt\b/i.test(l) && parseRxDate(l)) ?? lines.find((l) => parseRxDate(l));
  if (dateLine) out.date = parseRxDate(dateLine);

  const patient = text.match(/(?:patient(?:\s*name)?|pt\.?\s*name|name)\s*[:-]\s*([A-Za-z][A-Za-z .]{1,40})/i);
  if (patient) out.patientName = patient[1]!.split(/\s{2,}|\bage\b|\bsex\b/i)[0]!.trim();

  for (const m of medicines) {
    const line = lines.find((l) => l.toLowerCase().includes(m.brand.toLowerCase()));
    if (!line) continue;
    const qty = line.match(/(?:qty|quantity|x)\s*[:-]?\s*(\d{1,3})\b/i) ?? line.match(/\b(\d{1,3})\s*(?:tabs?|tablets?|caps?|capsules?)\b/i);
    out.drugs.push({ medicineId: m.id, ...(qty ? { qty: Number(qty[1]) } : {}) });
  }
  return out;
}
