import { daysLeft } from '../clock';
import { checkPickupTransition } from '../machines/pickup';
import { checkDonationEligible, checkNgoCanReceive } from '../rules/donation';
import { isBlocked } from '../rules/prescription';
import type { AppState } from '../state';
import type { Batch, Pickup } from '../types';
import {
  done,
  err,
  failed,
  requireApprovedStore,
  requireChemistOf,
  requireRole,
  type Ev,
  type Step,
} from './common';
import { RIDER_PAY, applyCivicReward, payRider } from './payouts';

function withPickup(s: AppState, p: Pickup): AppState {
  return { ...s, pickups: { ...s.pickups, [p.id]: p } };
}

function closeBatch(s: AppState, batchId: string | undefined): AppState {
  const batch = batchId ? s.batches[batchId] : undefined;
  if (!batch) return s;
  const closed: Batch = { ...batch, qty: 0, status: 'CLOSED' };
  return { ...s, batches: { ...s.batches, [batch.id]: closed } };
}

export function pickupScheduled(s: AppState, e: Ev<'PICKUP_SCHEDULED'>): Step {
  const p = e.pickup;
  if (s.pickups[p.id]) return err('Pickup already exists');
  if (p.status !== 'SCHEDULED') return err('New pickups must start as SCHEDULED');
  if (!!p.sourceUserId === !!p.sourceStoreId) return err('A pickup needs exactly one source: a customer or a store');

  if (p.sourceUserId) {
    const bad = failed(requireRole(s, p.sourceUserId, 'customer'));
    if (bad) return bad;
    if (e.actorId !== p.sourceUserId) return err('Customers can only schedule their own pickups');
  } else if (p.sourceStoreId) {
    const bad = failed(requireChemistOf(s, e.actorId, p.sourceStoreId)) ?? failed(requireApprovedStore(s, p.sourceStoreId));
    if (bad) return bad;
  }

  for (const item of p.items) {
    const medicine = s.medicines[item.medicineId];
    if (!medicine) return err(`Unknown medicine ${item.medicineId}`);
    if (p.kind === 'DONATION') {
      const bad = failed(checkDonationEligible(medicine, item, s.today));
      if (bad) return err(`${medicine.brand}: ${bad.ok ? '' : bad.error}`);
    } else {
      if (isBlocked(medicine)) return err(`${medicine.brand} is Schedule X / NDPS and is blocked on the platform`);
      if (daysLeft(item.expiry, s.today) > 0) {
        return err(`${medicine.brand} has not expired. Donate it or keep using it; Yellow-Bag pickup is for expired medicines`);
      }
    }
  }

  if (p.kind === 'DONATION') {
    const ngo = p.ngoId ? s.ngos[p.ngoId] : undefined;
    if (!ngo) return err('Choose a verified NGO for this donation');
    if (!p.qaStoreId) return err('A chemist must be chosen to run the QA check');
    const qa = failed(requireApprovedStore(s, p.qaStoreId));
    if (qa) return qa;
    for (const item of p.items) {
      const medicine = s.medicines[item.medicineId]!;
      const bad = failed(checkNgoCanReceive(medicine, ngo));
      if (bad) return bad;
    }
  }

  let next = s;
  if (p.batchId) {
    const batch = s.batches[p.batchId];
    if (!batch) return err('Unknown batch');
    if (batch.storeId !== p.sourceStoreId) return err('This batch belongs to a different store');
    if (batch.status !== 'IN_STOCK' && batch.status !== 'ECO_SALE') return err('This batch is already part of another action');
    const only = p.items[0]!;
    if (p.items.length !== 1 || only.medicineId !== batch.medicineId || only.qty !== batch.qty) {
      return err('A batch pickup must cover the whole batch');
    }
    const status = p.kind === 'DONATION' ? 'DONATION_PENDING' : 'DISPOSAL_PENDING';
    next = { ...next, batches: { ...next.batches, [batch.id]: { ...batch, status } } };
  }
  return done(withPickup(next, p));
}

export function pickupAccepted(s: AppState, e: Ev<'PICKUP_ACCEPTED'>): Step {
  const p = s.pickups[e.pickupId];
  if (!p) return err('Unknown pickup');
  const rider = s.riders[e.riderId];
  if (!rider) return err('Unknown rider');
  if (e.actorId !== e.riderId) return err('Riders accept missions for themselves');
  if (!rider.online) return err('Go online to accept missions');
  if (p.status !== 'SCHEDULED' || p.riderId) return err('This pickup is no longer available');
  return done(withPickup(s, { ...p, riderId: e.riderId }));
}

export function pickupArrived(s: AppState, e: Ev<'PICKUP_ARRIVED'>): Step {
  const p = s.pickups[e.pickupId];
  if (!p) return err('Unknown pickup');
  if (p.riderId !== e.actorId) return err('Only the assigned rider can do this');
  if (p.status !== 'SCHEDULED') return err('Pickup is already collected');
  return done(withPickup(s, { ...p, riderArrived: true }));
}

export function pickupCollected(s: AppState, e: Ev<'PICKUP_COLLECTED'>): Step {
  const p = s.pickups[e.pickupId];
  if (!p) return err('Unknown pickup');
  if (p.riderId !== e.actorId) return err('Only the assigned rider can do this');
  if (!p.riderArrived) return err('Mark yourself as arrived before collecting');
  const bad = failed(checkPickupTransition(p.kind, p.status, 'COLLECTED'));
  if (bad) return bad;
  return done(withPickup(s, { ...p, status: 'COLLECTED' }));
}

function qaStep(s: AppState, pickupId: string, actorId: string, to: 'QA_VERIFIED' | 'QA_REJECTED', note: string | undefined): Step {
  const p = s.pickups[pickupId];
  if (!p) return err('Unknown pickup');
  if (!p.qaStoreId) return err('This pickup has no QA step');
  const bad = failed(requireChemistOf(s, actorId, p.qaStoreId)) ?? failed(checkPickupTransition(p.kind, p.status, to));
  if (bad) return bad;
  if (to === 'QA_VERIFIED') {
    // Shelf life keeps shrinking while a pickup is in transit, so re-check at the QA desk.
    for (const item of p.items) {
      const m = s.medicines[item.medicineId];
      if (!m) return err('Unknown medicine');
      const eligible = failed(checkDonationEligible(m, item, s.today));
      if (eligible) return err(`Cannot verify ${m.brand}: ${eligible.ok ? '' : eligible.error}. Reject it for bio-disposal`);
    }
  }
  return done(withPickup(s, { ...p, status: to, ...(note ? { qaNote: note } : {}) }));
}

export function pickupQaVerified(s: AppState, e: Ev<'PICKUP_QA_VERIFIED'>): Step {
  return qaStep(s, e.pickupId, e.actorId, 'QA_VERIFIED', e.note);
}

export function pickupQaRejected(s: AppState, e: Ev<'PICKUP_QA_REJECTED'>): Step {
  if (!e.note.trim()) return err('Give a reason for rejecting the medicines');
  return qaStep(s, e.pickupId, e.actorId, 'QA_REJECTED', e.note);
}

export function pickupDeliveredToNgo(s: AppState, e: Ev<'PICKUP_DELIVERED_TO_NGO'>): Step {
  const p = s.pickups[e.pickupId];
  if (!p) return err('Unknown pickup');
  if (p.riderId !== e.actorId) return err('Only the assigned rider can do this');
  const bad = failed(checkPickupTransition(p.kind, p.status, 'DELIVERED_TO_NGO'));
  if (bad) return bad;
  let next = closeBatch(withPickup(s, { ...p, status: 'DELIVERED_TO_NGO' }), p.batchId);
  next = payRider(next, e.actorId, RIDER_PAY.PICKUP, RIDER_PAY.GREEN_INCENTIVE);
  if (p.sourceUserId) next = applyCivicReward(next, p.sourceUserId, 'DONATION', p.id);
  return done(next);
}

export function pickupIncinerated(s: AppState, e: Ev<'PICKUP_INCINERATED'>): Step {
  const p = s.pickups[e.pickupId];
  if (!p) return err('Unknown pickup');
  if (p.riderId !== e.actorId) return err('Only the assigned rider can do this');
  const bad = failed(checkPickupTransition(p.kind, p.status, 'INCINERATED'));
  if (bad) return bad;
  let next = closeBatch(withPickup(s, { ...p, status: 'INCINERATED' }), p.batchId);
  next = payRider(next, e.actorId, RIDER_PAY.PICKUP, RIDER_PAY.GREEN_INCENTIVE);
  // Only a customer's own safe disposal earns karma; rejected donations do not.
  if (p.kind === 'DISPOSAL' && p.sourceUserId) next = applyCivicReward(next, p.sourceUserId, 'DISPOSAL', p.id);
  return done(next);
}
