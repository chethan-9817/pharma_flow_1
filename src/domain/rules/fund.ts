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

/** What the platform keeps from a delivered order. The chemist's payout is never reduced for the fund. */
export function platformFee(orderTotal: number): number {
  return round2((orderTotal * PLATFORM_FEE_PCT) / 100);
}

/** The NGO fund's share of a delivered order. */
export function ngoFundShare(orderTotal: number): number {
  return round2((platformFee(orderTotal) * NGO_FUND_SHARE_PCT) / 100);
}
