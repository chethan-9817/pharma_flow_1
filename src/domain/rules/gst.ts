import type { IsoDate } from '../clock';

/**
 * GST input-tax-credit reversal on goods written off, destroyed or given away
 * (CGST Act, Section 17(5)(h)).
 *
 * Assumptions for the demo (configurable): purchase cost is ~70% of MRP and the
 * GST rate is 12%. Check against the current GST rate schedule before real use.
 */
export const DEFAULT_GST_RATE_PCT = 12;
export const DEFAULT_COST_FRACTION_OF_MRP = 0.7;

export const CERTIFICATE_TITLE = 'Inventory Write-Off & NGO Donation Receipt';
export const CERTIFICATE_DISCLAIMER =
  'This is an inventory write-off record and an NGO receipt for goods. In-kind donations do not qualify for deduction under Section 80G.';

export type WriteOffReason = 'NGO_DONATION' | 'BIO_DISPOSAL';

export interface WriteOffLine {
  brand: string;
  batchNo: string;
  expiry: IsoDate;
  qty: number;
  mrp: number;
}

export interface WriteOffLineResult extends WriteOffLine {
  costValue: number;
  itcReversal: number;
}

export interface WriteOffCertificate {
  title: string;
  reason: WriteOffReason;
  recipient: string;
  issuedOn: IsoDate;
  gstRatePct: number;
  lines: WriteOffLineResult[];
  totalCostValue: number;
  totalItcReversal: number;
  disclaimer: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function itcReversal(costValue: number, gstRatePct = DEFAULT_GST_RATE_PCT): number {
  return round2((costValue * gstRatePct) / 100);
}

export function buildWriteOffCertificate(input: {
  reason: WriteOffReason;
  recipient: string;
  issuedOn: IsoDate;
  lines: WriteOffLine[];
  gstRatePct?: number;
  costFraction?: number;
}): WriteOffCertificate {
  const gstRatePct = input.gstRatePct ?? DEFAULT_GST_RATE_PCT;
  const costFraction = input.costFraction ?? DEFAULT_COST_FRACTION_OF_MRP;
  const lines = input.lines.map((l) => {
    const costValue = round2(l.mrp * l.qty * costFraction);
    return { ...l, costValue, itcReversal: itcReversal(costValue, gstRatePct) };
  });
  return {
    title: CERTIFICATE_TITLE,
    reason: input.reason,
    recipient: input.recipient,
    issuedOn: input.issuedOn,
    gstRatePct,
    lines,
    totalCostValue: round2(lines.reduce((s, l) => s + l.costValue, 0)),
    totalItcReversal: round2(lines.reduce((s, l) => s + l.itcReversal, 0)),
    disclaimer: CERTIFICATE_DISCLAIMER,
  };
}
