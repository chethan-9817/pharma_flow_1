import { daysLeft } from '../clock';
import { checkOrderTransition } from '../machines/order';
import { checkEcoSaleEligible, ecoPrice } from '../rules/ecoSale';
import {
  buildH1Entries,
  checkItemsSellable,
  checkRxForOrder,
  orderNeedsRx,
} from '../rules/prescription';
import type { AppState } from '../state';
import type { Order, Prescription } from '../types';
import {
  addWallet,
  done,
  err,
  failed,
  lookupMedicine,
  requireApprovedStore,
  requireChemistOf,
  requireRole,
  type Ev,
  type Step,
} from './common';
import { RIDER_PAY, applyCivicReward, payRider } from './payouts';

const round2 = (n: number) => Math.round(n * 100) / 100;

function withOrder(s: AppState, o: Order): AppState {
  return { ...s, orders: { ...s.orders, [o.id]: o } };
}

function rxCheck(s: AppState, rx: Prescription, order: Order) {
  return checkRxForOrder(rx, order.id, order.items, lookupMedicine(s), s.today);
}

/** Puts reserved units back on the shelf and refunds any MedWallet credit used. */
function releaseOrder(s: AppState, o: Order): AppState {
  let next = s;
  for (const item of o.items) {
    const batch = item.batchId ? next.batches[item.batchId] : undefined;
    if (batch && (batch.status === 'IN_STOCK' || batch.status === 'ECO_SALE')) {
      next = { ...next, batches: { ...next.batches, [batch.id]: { ...batch, qty: batch.qty + item.qty } } };
    }
  }
  return addWallet(next, o.customerId, o.walletUsed ?? 0);
}

export function orderPlaced(s: AppState, e: Ev<'ORDER_PLACED'>): Step {
  const o = e.order;
  const lookup = lookupMedicine(s);
  if (s.orders[o.id]) return err('Order already exists');
  if (o.status !== 'PLACED') return err('New orders must start as PLACED');
  if (e.actorId !== o.customerId) return err('Customers can only place their own orders');
  const bad =
    failed(requireRole(s, o.customerId, 'customer')) ??
    failed(requireApprovedStore(s, o.storeId)) ??
    failed(checkItemsSellable(o.items, lookup));
  if (bad) return bad;
  if (!/^\d{4}$/.test(o.deliveryOtp ?? '')) return err('Orders need a 4-digit delivery OTP');

  // Stock, expiry and price checks. Reserve units per batch.
  const reserved: Record<string, number> = {};
  let total = 0;
  for (const item of o.items) {
    const medicine = s.medicines[item.medicineId]!;
    const batch = item.batchId ? s.batches[item.batchId] : undefined;
    if (!batch) return err(`Choose a batch for ${medicine.brand}`);
    if (batch.storeId !== o.storeId || batch.medicineId !== item.medicineId) return err('Batch does not match the order');
    if (batch.status !== 'IN_STOCK' && batch.status !== 'ECO_SALE') return err(`${medicine.brand} is not available`);
    if (daysLeft(batch.expiry, s.today) <= 0) return err(`${medicine.brand} has expired and cannot be sold`);
    reserved[batch.id] = (reserved[batch.id] ?? 0) + item.qty;
    if (reserved[batch.id]! > batch.qty) return err(`Only ${batch.qty} of ${medicine.brand} left`);

    const isEco = batch.status === 'ECO_SALE';
    if (item.ecoSale !== isEco) return err(`${medicine.brand}: Eco-Sale flag does not match the batch`);
    if (isEco) {
      const eligible = failed(checkEcoSaleEligible(medicine, batch.expiry, s.today));
      if (eligible) return eligible;
    }
    const expected = isEco ? ecoPrice(medicine.mrp, batch.ecoDiscountPct ?? 0) : medicine.mrp;
    if (round2(item.unitPrice) !== round2(expected)) return err(`${medicine.brand}: price is out of date`);
    total += item.qty * item.unitPrice;
  }
  if (round2(total) !== round2(o.total)) return err('Order total does not match its items');

  // Prescription gate. Eco-Sale never bypasses it.
  const needsRx = orderNeedsRx(o.items, lookup);
  let next = s;
  if (needsRx) {
    const rx = e.prescription;
    if (!rx || rx.id !== o.prescriptionId) return err('A prescription is required for this order');
    if (rx.customerId !== o.customerId) return err('Prescription belongs to a different customer');
    if (s.prescriptions[rx.id]) return err('This prescription was already used');
    if (o.rxStatus !== 'PENDING') return err('Prescription orders must start with the Rx pending review');
    const rxBad = failed(rxCheck(s, rx, o));
    if (rxBad) return rxBad;
    next = { ...next, prescriptions: { ...next.prescriptions, [rx.id]: { ...rx, usedByOrderId: o.id } } };
  } else if (o.rxStatus !== 'NOT_REQUIRED') {
    return err('This order does not need a prescription');
  }

  const walletUsed = o.walletUsed ?? 0;
  if (walletUsed > (s.wallet[o.customerId] ?? 0)) return err('Not enough MedWallet credit');
  if (walletUsed > o.total) return err('Wallet credit exceeds the order total');
  next = addWallet(next, o.customerId, -walletUsed);

  for (const [batchId, qty] of Object.entries(reserved)) {
    const batch = next.batches[batchId]!;
    next = { ...next, batches: { ...next.batches, [batchId]: { ...batch, qty: batch.qty - qty } } };
  }
  return done(withOrder(next, { ...o, placedAt: s.today, walletUsed }));
}

export function rxApproved(s: AppState, e: Ev<'RX_APPROVED'>): Step {
  const o = s.orders[e.orderId];
  if (!o) return err('Unknown order');
  const rx = o.prescriptionId ? s.prescriptions[o.prescriptionId] : undefined;
  if (!rx) return err('This order has no prescription');
  const bad =
    failed(requireChemistOf(s, e.actorId, o.storeId)) ??
    failed(checkOrderTransition(o.status, 'RX_APPROVED', { rxRequired: true, rxStatus: 'APPROVED' }));
  if (bad) return bad;
  if (o.rxStatus !== 'PENDING') return err('Prescription is not waiting for review');
  // Time may have moved since upload, so validity is checked again at approval.
  const stillValid = failed(rxCheck(s, rx, o));
  if (stillValid) return stillValid;
  return done(withOrder(s, { ...o, status: 'RX_APPROVED', rxStatus: 'APPROVED' }));
}

export function rxRejected(s: AppState, e: Ev<'RX_REJECTED'>): Step {
  const o = s.orders[e.orderId];
  if (!o) return err('Unknown order');
  const bad = failed(requireChemistOf(s, e.actorId, o.storeId));
  if (bad) return bad;
  if (!e.reason.trim()) return err('Give a reason (unreadable, expired or wrong drug)');
  if (o.status !== 'PLACED' || o.rxStatus !== 'PENDING') return err('Prescription is not waiting for review');
  return done(withOrder(s, { ...o, rxStatus: 'REJECTED', rxRejectReason: e.reason }));
}

export function rxResubmitted(s: AppState, e: Ev<'RX_RESUBMITTED'>): Step {
  const o = s.orders[e.orderId];
  if (!o) return err('Unknown order');
  if (e.actorId !== o.customerId) return err('Only the customer can upload a new prescription');
  if (o.status !== 'PLACED' || o.rxStatus !== 'REJECTED') return err('The prescription was not rejected');
  const rx = e.prescription;
  if (rx.customerId !== o.customerId) return err('Prescription belongs to a different customer');
  if (s.prescriptions[rx.id]) return err('This prescription was already used');
  const bad = failed(rxCheck(s, rx, o));
  if (bad) return bad;
  const { rxRejectReason: _cleared, ...rest } = o;
  return done(
    withOrder(
      { ...s, prescriptions: { ...s.prescriptions, [rx.id]: { ...rx, usedByOrderId: o.id } } },
      { ...rest, rxStatus: 'PENDING', prescriptionId: rx.id },
    ),
  );
}

export function orderCancelled(s: AppState, e: Ev<'ORDER_CANCELLED'>): Step {
  const o = s.orders[e.orderId];
  if (!o) return err('Unknown order');
  const isOwner = e.actorId === o.customerId;
  const isStore = failed(requireChemistOf(s, e.actorId, o.storeId)) === null;
  if (!isOwner && !isStore) return err('Only the customer or the store can cancel this order');
  const needsRx = orderNeedsRx(o.items, lookupMedicine(s));
  const bad = failed(checkOrderTransition(o.status, 'CANCELLED', { rxRequired: needsRx, rxStatus: o.rxStatus }));
  if (bad) return bad;
  return done(releaseOrder(withOrder(s, { ...o, status: 'CANCELLED' }), o));
}

export function orderPacked(s: AppState, e: Ev<'ORDER_PACKED'>): Step {
  const o = s.orders[e.orderId];
  if (!o) return err('Unknown order');
  const lookup = lookupMedicine(s);
  const needsRx = orderNeedsRx(o.items, lookup);
  const bad =
    failed(requireChemistOf(s, e.actorId, o.storeId)) ??
    failed(checkOrderTransition(o.status, 'PACKED', { rxRequired: needsRx, rxStatus: o.rxStatus }));
  if (bad) return bad;
  const rx = o.prescriptionId ? s.prescriptions[o.prescriptionId] : undefined;
  const entries = rx ? buildH1Entries(o.id, rx, o.items, lookup, s.today) : [];
  return done(withOrder({ ...s, h1Register: [...s.h1Register, ...entries] }, { ...o, status: 'PACKED' }));
}

export function orderAccepted(s: AppState, e: Ev<'ORDER_ACCEPTED'>): Step {
  const o = s.orders[e.orderId];
  if (!o) return err('Unknown order');
  const rider = s.riders[e.riderId];
  if (!rider) return err('Unknown rider');
  if (e.actorId !== e.riderId) return err('Riders accept missions for themselves');
  if (!rider.online) return err('Go online to accept missions');
  if (o.status !== 'PACKED' || o.riderId) return err('This order is no longer available');
  return done(withOrder(s, { ...o, riderId: e.riderId }));
}

export function orderArrived(s: AppState, e: Ev<'ORDER_ARRIVED'>): Step {
  const o = s.orders[e.orderId];
  if (!o) return err('Unknown order');
  if (o.riderId !== e.actorId) return err('Only the assigned rider can do this');
  if (o.status !== 'PACKED') return err('Order was already collected');
  return done(withOrder(s, { ...o, riderArrived: true }));
}

export function orderOutForDelivery(s: AppState, e: Ev<'ORDER_OUT_FOR_DELIVERY'>): Step {
  const o = s.orders[e.orderId];
  if (!o) return err('Unknown order');
  if (o.riderId !== e.actorId) return err('Only the assigned rider can do this');
  if (!o.riderArrived) return err('Mark yourself as arrived before collecting');
  const bad = failed(checkOrderTransition(o.status, 'OUT_FOR_DELIVERY', { rxRequired: false, rxStatus: o.rxStatus }));
  if (bad) return bad;
  return done(withOrder(s, { ...o, status: 'OUT_FOR_DELIVERY' }));
}

export function orderDelivered(s: AppState, e: Ev<'ORDER_DELIVERED'>): Step {
  const o = s.orders[e.orderId];
  if (!o) return err('Unknown order');
  if (o.riderId !== e.actorId) return err('Only the assigned rider can do this');
  const bad = failed(checkOrderTransition(o.status, 'DELIVERED', { rxRequired: false, rxStatus: o.rxStatus }));
  if (bad) return bad;
  if (e.otp !== o.deliveryOtp) return err('Wrong OTP. Ask the customer for the 4-digit code');
  let next = withOrder(s, { ...o, status: 'DELIVERED' });
  next = payRider(next, e.actorId, RIDER_PAY.DELIVERY);
  next = applyCivicReward(next, o.customerId, 'ORDER', o.id);
  return done(next);
}
