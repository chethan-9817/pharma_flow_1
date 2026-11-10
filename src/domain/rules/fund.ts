/**
 * The NGO fund. Money in it can only ever be spent on medicines for NGOs, never paid out as cash,
 * the same closed-loop idea as MedWallet. Two things feed it:
 * - the change left over from a "Sponsor batch for NGO" payment, once the NGO has the packs, and
 * - a small share of the platform's own fee on every delivered order.
 *
 * The percentages are demo values. A real deployment would set them with the business.
 */
export const PLATFORM_FEE_PCT = 10;
/** Share of the platform fee that goes to the NGO fund. */
export const NGO_FUND_SHARE_PCT = 2;

export type FundEntryKind = 'PLATFORM_SHARE' | 'SPONSOR_CHANGE';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What the platform keeps, given the MRP value of what was sold. The fee is a share of the MRP, also on
 * Eco-Sale items: a ₹200 strip sold at ₹170 earns the platform ₹20 and the store ₹150. The chemist's
 * payout is never reduced for the fund.
 */
export function platformFee(mrpValue: number): number {
  return round2((mrpValue * PLATFORM_FEE_PCT) / 100);
}

/** The NGO fund's share of a delivered order, given its MRP value. */
export function ngoFundShare(mrpValue: number): number {
  return round2((platformFee(mrpValue) * NGO_FUND_SHARE_PCT) / 100);
}

/** The MRP value of an order's items: the base the platform fee is worked out on. */
export function mrpValue(items: { medicineId: string; qty: number }[], mrpOf: (medicineId: string) => number | undefined): number {
  return round2(items.reduce((n, i) => n + i.qty * (mrpOf(i.medicineId) ?? 0), 0));
}
