import { daysBetween, daysLeft } from '../clock';
import { isTerminal } from '../machines/pickup';
import { checkDiscount, checkEcoSaleEligible } from '../rules/ecoSale';
import { isBlocked } from '../rules/prescription';
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
import type { AppState } from '../state';

export function storeRegistered(s: AppState, e: Ev<'STORE_REGISTERED'>): Step {
  if (s.stores[e.store.id]) return err('Store already exists');
  if (e.store.kyc !== 'PENDING_KYC') return err('New stores must start as PENDING_KYC');
  return done({ ...s, stores: { ...s.stores, [e.store.id]: e.store } });
}

export function kycDecided(s: AppState, e: Ev<'KYC_DECIDED'>): Step {
  const bad = failed(requireRole(s, e.actorId, 'admin'));
  if (bad) return bad;
  const store = s.stores[e.storeId];
  if (!store) return err('Unknown store');
  if (store.kyc !== 'PENDING_KYC') return err('This store has already been reviewed');
  return done({ ...s, stores: { ...s.stores, [store.id]: { ...store, kyc: e.decision } } });
}

export function stockIngested(s: AppState, e: Ev<'STOCK_INGESTED'>): Step {
  const { batch } = e;
  const bad = failed(requireChemistOf(s, e.actorId, batch.storeId)) ?? failed(requireApprovedStore(s, batch.storeId));
  if (bad) return bad;
  const medicine = s.medicines[batch.medicineId];
  if (!medicine) return err('Unknown medicine');
  if (isBlocked(medicine)) return err(`${medicine.brand} is Schedule X / NDPS and cannot be listed`);
  if (s.batches[batch.id]) return err('Batch already exists');
  if (batch.qty <= 0) return err('Quantity must be positive');
  if (batch.status !== 'IN_STOCK') return err('New stock must start as IN_STOCK');
  if (daysLeft(batch.expiry, s.today) <= 0) {
    return err('This batch is already expired. Schedule Yellow-Bag disposal instead of stocking it');
  }
  return done({ ...s, batches: { ...s.batches, [batch.id]: batch } });
}

export function ecoSaleListed(s: AppState, e: Ev<'ECO_SALE_LISTED'>): Step {
  const batch = s.batches[e.batchId];
  if (!batch) return err('Unknown batch');
  const bad =
    failed(requireChemistOf(s, e.actorId, batch.storeId)) ??
    failed(requireApprovedStore(s, batch.storeId)) ??
    failed(checkDiscount(e.discountPct));
  if (bad) return bad;
  if (batch.status !== 'IN_STOCK') return err('Only batches in stock can be put on Eco-Sale');
  const medicine = s.medicines[batch.medicineId];
  if (!medicine) return err('Unknown medicine');
  const eligible = failed(checkEcoSaleEligible(medicine, batch.expiry, s.today));
  if (eligible) return eligible;
  return done({
    ...s,
    batches: { ...s.batches, [batch.id]: { ...batch, status: 'ECO_SALE', ecoDiscountPct: e.discountPct } },
  });
}

export function ecoSaleWithdrawn(s: AppState, e: Ev<'ECO_SALE_WITHDRAWN'>): Step {
  const batch = s.batches[e.batchId];
  if (!batch) return err('Unknown batch');
  const bad = failed(requireChemistOf(s, e.actorId, batch.storeId));
  if (bad) return bad;
  if (batch.status !== 'ECO_SALE') return err('This batch is not on Eco-Sale');
  const { ecoDiscountPct: _removed, ...rest } = batch;
  return done({ ...s, batches: { ...s.batches, [batch.id]: { ...rest, status: 'IN_STOCK' } } });
}

export function riderShiftChanged(s: AppState, e: Ev<'RIDER_SHIFT_CHANGED'>): Step {
  const rider = s.riders[e.riderId];
  if (!rider) return err('Unknown rider');
  if (e.actorId !== e.riderId) return err('Riders can only change their own shift');
  if (!e.online) {
    const busy =
      Object.values(s.orders).some((o) => o.riderId === e.riderId && (o.status === 'PACKED' || o.status === 'OUT_FOR_DELIVERY')) ||
      Object.values(s.pickups).some((p) => p.riderId === e.riderId && !isTerminal(p.kind, p.status));
    if (busy) return err('Finish your active missions before going offline');
  }
  return done({ ...s, riders: { ...s.riders, [e.riderId]: { ...rider, online: e.online } } });
}

export function timeTravelled(s: AppState, e: Ev<'TIME_TRAVELLED'>): Step {
  // The simulated clock is the presenter's tool. With real logins, a customer must not be able to move it.
  const bad = failed(requireRole(s, e.actorId, 'admin'));
  if (bad) return bad;
  if (daysBetween(s.today, e.to) <= 0) return err('Time can only move forward. Use Reset demo data to go back');
  return done({ ...s, today: e.to });
}
