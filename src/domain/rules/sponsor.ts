import type { IsoDate } from '../clock';
import { fail, ok, type Check } from '../result';
import type { Batch, Medicine } from '../types';
import { checkDonationEligible, isRxOnly } from './donation';
import { checkEcoSaleEligible, ecoPrice } from './ecoSale';

/** The flat price of the "Sponsor batch for NGO" button, in rupees. */
export const SPONSOR_AMOUNT = 99;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * How many packs the sponsor amount buys at the Eco-Sale price, at least one and never more than the
 * batch has left. Returns 0 when a single pack costs more than the sponsor amount.
 */
export function sponsorUnits(unitPrice: number, available: number): number {
  if (available <= 0 || unitPrice > SPONSOR_AMOUNT) return 0;
  if (unitPrice <= 0) return available;
  return Math.max(1, Math.min(available, Math.floor(SPONSOR_AMOUNT / unitPrice)));
}

/** Where the sponsor amount goes: the store gets the Eco-Sale price of the packs, the rest tops up the NGO fund. */
export function sponsorSplit(units: number, unitPrice: number): { storePayout: number; fundTopUp: number } {
  const storePayout = round2(units * unitPrice);
  return { storePayout, fundTopUp: round2(SPONSOR_AMOUNT - storePayout) };
}

/**
 * A batch can be sponsored when it is on Eco-Sale, the packs will reach an NGO in good shape, and the
 * medicine is over the counter. Prescription-only drugs are left out: the sponsor has no prescription and
 * the NGO hand-over for those needs a registered professional on site.
 */
export function checkSponsorable(
  medicine: Pick<Medicine, 'brand' | 'schedule' | 'coldChain' | 'form' | 'courseDays' | 'mrp'>,
  batch: Pick<Batch, 'status' | 'expiry' | 'qty' | 'ecoDiscountPct'>,
  today: IsoDate,
): Check {
  if (batch.status !== 'ECO_SALE') return fail('Only Eco-Sale deals can be sponsored');
  if (isRxOnly(medicine)) return fail(`${medicine.brand} needs a prescription, so only over-the-counter medicines can be sponsored`);
  const eco = checkEcoSaleEligible(medicine, batch.expiry, today);
  if (!eco.ok) return eco;
  const donatable = checkDonationEligible(medicine, { expiry: batch.expiry, sealed: true, openedLiquid: false }, today);
  if (!donatable.ok) return donatable;
  if (batch.qty <= 0) return fail('No packs are left in this batch');
  if (ecoPrice(medicine.mrp, batch.ecoDiscountPct ?? 0) > SPONSOR_AMOUNT) {
    return fail(`One pack costs more than the sponsor amount of ₹${SPONSOR_AMOUNT}`);
  }
  return ok;
}
