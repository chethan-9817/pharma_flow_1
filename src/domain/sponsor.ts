import type { Result } from './result';
import { checkNgoCanReceive } from './rules/donation';
import { ecoPrice } from './rules/ecoSale';
import { SPONSOR_AMOUNT, checkSponsorable, sponsorSplit, sponsorUnits } from './rules/sponsor';
import type { AppState } from './state';
import type { Sponsorship } from './types';

export interface SponsorInput {
  id: string;
  customerId: string;
  batchId: string;
  ngoId: string;
}

/**
 * Works out what a "Sponsor batch for NGO" tap buys: how many packs, what the store is paid and what
 * tops up the NGO fund. Used by the screen to preview the deal and by the reducer to re-check it.
 */
export function planSponsorship(s: AppState, input: SponsorInput): Result<Sponsorship> {
  const batch = s.batches[input.batchId];
  if (!batch) return { ok: false, error: 'This deal is no longer available' };
  const medicine = s.medicines[batch.medicineId];
  if (!medicine) return { ok: false, error: 'Unknown medicine' };
  const store = s.stores[batch.storeId];
  if (store?.kyc !== 'APPROVED') return { ok: false, error: 'This pharmacy is not approved to sell yet' };
  const ngo = s.ngos[input.ngoId];
  if (!ngo) return { ok: false, error: 'Choose a verified NGO' };

  const sponsorable = checkSponsorable(medicine, batch, s.today);
  if (!sponsorable.ok) return { ok: false, error: sponsorable.reason };
  const receives = checkNgoCanReceive(medicine, ngo);
  if (!receives.ok) return { ok: false, error: receives.reason };

  const unitPrice = ecoPrice(medicine.mrp, batch.ecoDiscountPct ?? 0);
  const qty = sponsorUnits(unitPrice, batch.qty);
  if (qty === 0) return { ok: false, error: 'No packs can be sponsored from this batch right now' };
  const { storePayout, fundTopUp } = sponsorSplit(qty, unitPrice);

  return {
    ok: true,
    value: {
      id: input.id,
      customerId: input.customerId,
      storeId: batch.storeId,
      batchId: batch.id,
      medicineId: medicine.id,
      ngoId: ngo.id,
      qty,
      unitPrice,
      amount: SPONSOR_AMOUNT,
      storePayout,
      fundTopUp,
      status: 'PLACED',
      pickupId: `pk-${input.id}`,
      placedAt: s.today,
    },
  };
}
