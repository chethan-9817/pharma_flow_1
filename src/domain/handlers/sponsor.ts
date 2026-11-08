import { planSponsorship } from '../sponsor';
import type { AppState } from '../state';
import type { Pickup, Sponsorship } from '../types';
import { addWallet, done, err, failed, requireRole, type Ev, type Step } from './common';
import { creditFund } from './fund';
import { applyCivicReward } from './payouts';

const round2 = (n: number) => Math.round(n * 100) / 100;

function withSponsorship(s: AppState, sp: Sponsorship): AppState {
  return { ...s, sponsorships: { ...s.sponsorships, [sp.id]: sp } };
}

/**
 * A customer sponsors packs from a store's Eco-Sale batch for an NGO. The packs are set aside and a
 * rider mission starts at the store. The reducer works the deal out again, so the event cannot claim
 * more packs, a lower store payout or a different split than the rules allow.
 */
export function sponsorshipPlaced(s: AppState, e: Ev<'SPONSORSHIP_PLACED'>): Step {
  const sp = e.sponsorship;
  if (s.sponsorships[sp.id]) return err('This sponsorship already exists');
  if (e.actorId !== sp.customerId) return err('Customers can only sponsor with their own payment');
  const bad = failed(requireRole(s, sp.customerId, 'customer'));
  if (bad) return bad;
  if (sp.status !== 'PLACED') return err('New sponsorships must start as PLACED');

  const plan = planSponsorship(s, { id: sp.id, customerId: sp.customerId, batchId: sp.batchId, ngoId: sp.ngoId });
  if (!plan.ok) return err(plan.error);
  const expected = plan.value;
  const same =
    sp.storeId === expected.storeId &&
    sp.medicineId === expected.medicineId &&
    sp.qty === expected.qty &&
    round2(sp.unitPrice) === round2(expected.unitPrice) &&
    round2(sp.amount) === round2(expected.amount) &&
    round2(sp.storePayout) === round2(expected.storePayout) &&
    round2(sp.fundTopUp) === round2(expected.fundTopUp) &&
    sp.pickupId === expected.pickupId;
  if (!same) return err('This deal is out of date. Please try again');

  const batch = s.batches[sp.batchId]!;
  const store = s.stores[sp.storeId]!;
  const pickup: Pickup = {
    id: sp.pickupId,
    kind: 'DONATION',
    sourceStoreId: store.id,
    // The store's own chemist checks the packs before they leave, like any donation.
    qaStoreId: store.id,
    ngoId: sp.ngoId,
    sponsorshipId: sp.id,
    items: [{ medicineId: sp.medicineId, batchNo: batch.batchNo, expiry: batch.expiry, qty: sp.qty, sealed: true, openedLiquid: false }],
    status: 'SCHEDULED',
    address: `${store.name}, ${store.area}`,
    lat: store.lat,
    lng: store.lng,
    scheduledAt: s.today,
  };

  let next: AppState = { ...s, batches: { ...s.batches, [batch.id]: { ...batch, qty: batch.qty - sp.qty } } };
  next = { ...next, pickups: { ...next.pickups, [pickup.id]: pickup } };
  return done(withSponsorship(next, { ...sp, placedAt: s.today }));
}

function sponsorshipOf(s: AppState, pickup: Pickup): Sponsorship | undefined {
  const sp = pickup.sponsorshipId ? s.sponsorships[pickup.sponsorshipId] : undefined;
  return sp?.status === 'PLACED' ? sp : undefined;
}

/**
 * The NGO has the packs. The store's payout is settled, the change tops up the NGO fund, and the
 * sponsor gets the usual donation reward: karma, a scratch card and an NGO Donor certificate.
 */
export function sponsorshipDelivered(s: AppState, pickup: Pickup): AppState {
  const sp = sponsorshipOf(s, pickup);
  if (!sp) return s;
  const medicine = s.medicines[sp.medicineId];
  const ngo = s.ngos[sp.ngoId];
  const summary = `Sponsored ${sp.qty} ${sp.qty === 1 ? 'pack' : 'packs'} of ${medicine?.brand ?? 'medicine'} for ${ngo?.name ?? 'an NGO'}`;
  let next = withSponsorship(s, { ...sp, status: 'DELIVERED' });
  next = creditFund(next, 'SPONSOR_CHANGE', sp.fundTopUp, sp.id);
  return applyCivicReward(next, sp.customerId, 'DONATION', sp.id, { summary });
}

/**
 * The packs failed the pharmacist's check, so the sponsor got nothing for their money. The whole amount
 * goes back as MedWallet credit (store credit, never cash), and the store is not paid.
 */
export function sponsorshipRefunded(s: AppState, pickup: Pickup): AppState {
  const sp = sponsorshipOf(s, pickup);
  if (!sp) return s;
  return addWallet(withSponsorship(s, { ...sp, status: 'REFUNDED' }), sp.customerId, sp.amount);
}
