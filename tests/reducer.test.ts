import { describe, expect, it } from 'vitest';
import type { Batch, Order, OrderItem, Pickup, Prescription } from '../src/domain/types';
import { ADMIN, CHEMIST, CUSTOMER, RIDER, STORE, Sim } from './helpers';

const newBatch = (over: Partial<Batch> = {}): Batch => ({
  id: 'b-new',
  storeId: STORE,
  medicineId: 'med-dolo650',
  batchNo: 'N1',
  expiry: '2027-10-01',
  qty: 10,
  status: 'IN_STOCK',
  ...over,
});

const order = (items: OrderItem[], over: Partial<Order> = {}): Order => ({
  id: 'o1',
  customerId: CUSTOMER,
  storeId: STORE,
  items,
  status: 'PLACED',
  rxStatus: 'NOT_REQUIRED',
  deliveryOtp: '1234',
  total: items.reduce((s, i) => s + i.qty * i.unitPrice, 0),
  placedAt: '2026-11-08',
  ...over,
});

const doloItem = (qty = 1): OrderItem => ({ medicineId: 'med-dolo650', batchId: 'b-dolo-1', qty, unitPrice: 31, ecoSale: false });
const augItem = (qty = 5): OrderItem => ({ medicineId: 'med-augmentin', batchId: 'b-augmentin-1', qty, unitPrice: 204, ecoSale: false });

const rx = (over: Partial<Prescription> = {}): Prescription => ({
  id: 'rx1',
  customerId: CUSTOMER,
  doctorName: 'Dr. Rao',
  registrationNo: 'KMC-1',
  date: '2026-11-05',
  patientName: 'Asha',
  drugs: [{ medicineId: 'med-augmentin', qty: 10 }],
  ...over,
});

describe('KYC', () => {
  it('lets a new store register only as PENDING_KYC and blocks stock until approved', () => {
    const sim = new Sim();
    const store = { id: 's-new', name: 'New Chemist', area: 'Surathkal', drugLicence: 'KA-1', gstin: 'G1', kyc: 'APPROVED' as const, lat: 1, lng: 1 };
    expect(sim.mustFail(ADMIN, { type: 'STORE_REGISTERED', store })).toMatch(/PENDING_KYC/);
    sim.must(ADMIN, { type: 'STORE_REGISTERED', store: { ...store, kyc: 'PENDING_KYC' } });
    expect(sim.state.stores['s-new']!.kyc).toBe('PENDING_KYC');
  });

  it('only an admin can decide, and stock needs an approved store', () => {
    const sim = new Sim();
    expect(sim.mustFail(CHEMIST, { type: 'KYC_DECIDED', storeId: 'store-carstreet', decision: 'APPROVED' })).toMatch(/admin/);
    sim.must(ADMIN, { type: 'KYC_DECIDED', storeId: 'store-carstreet', decision: 'REJECTED' });
    expect(sim.mustFail(ADMIN, { type: 'KYC_DECIDED', storeId: 'store-carstreet', decision: 'APPROVED' })).toMatch(/already/);
    expect(sim.state.stores['store-carstreet']!.kyc).toBe('REJECTED');
  });
});

describe('stock and Eco-Sale', () => {
  it('rejects expired stock, Schedule X and other stores', () => {
    const sim = new Sim();
    expect(sim.mustFail(CHEMIST, { type: 'STOCK_INGESTED', batch: newBatch({ expiry: '2026-11-01' }) })).toMatch(/expired/);
    expect(sim.mustFail(CHEMIST, { type: 'STOCK_INGESTED', batch: newBatch({ storeId: 'store-carstreet' }) })).toMatch(/different store/);
    sim.must(CHEMIST, { type: 'STOCK_INGESTED', batch: newBatch() });
    expect(sim.state.batches['b-new']).toBeTruthy();
  });

  it('enforces the 40-60% discount and the course-length rule', () => {
    const sim = new Sim();
    expect(sim.mustFail(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-dolo-1', discountPct: 70 })).toMatch(/between 40% and 60%/);
    // Limcee has 22 days left but needs 15 + 15 days
    expect(sim.mustFail(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-limcee-1', discountPct: 50 })).toMatch(/at least 30 days/);
    // Expired stock can never be sold
    expect(sim.mustFail(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-becosules-1', discountPct: 50 })).toMatch(/Expired/);
    sim.must(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
    sim.must(CHEMIST, { type: 'ECO_SALE_WITHDRAWN', batchId: 'b-okacet-1' });
    expect(sim.state.batches['b-okacet-1']!.status).toBe('IN_STOCK');
  });

  it('stops selling an Eco-Sale batch once time travel makes the course not fit', () => {
    const sim = new Sim();
    sim.must(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
    sim.must(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-12-05' }); // 11 days left
    const item: OrderItem = { medicineId: 'med-okacet', batchId: 'b-okacet-1', qty: 1, unitPrice: 11.5, ecoSale: true };
    expect(sim.mustFail(CUSTOMER, { type: 'ORDER_PLACED', order: order([item]) })).toMatch(/at least 20 days/);
  });
});

describe('orders and prescriptions', () => {
  it('sells OTC without a prescription and reserves stock', () => {
    const sim = new Sim();
    sim.must(CUSTOMER, { type: 'ORDER_PLACED', order: order([doloItem(3)]) });
    expect(sim.state.batches['b-dolo-1']!.qty).toBe(117);
  });

  it('rejects sales beyond stock, expired batches and stale prices', () => {
    const sim = new Sim();
    expect(sim.mustFail(CUSTOMER, { type: 'ORDER_PLACED', order: order([doloItem(500)]) })).toMatch(/left/);
    const expired: OrderItem = { medicineId: 'med-becosules', batchId: 'b-becosules-1', qty: 1, unitPrice: 46, ecoSale: false };
    expect(sim.mustFail(CUSTOMER, { type: 'ORDER_PLACED', order: order([expired]) })).toMatch(/expired/);
    expect(sim.mustFail(CUSTOMER, { type: 'ORDER_PLACED', order: order([{ ...doloItem(), unitPrice: 5 }]) })).toMatch(/price/);
  });

  it('locks checkout for Rx drugs without a prescription and blocks a prescription for another drug', () => {
    const sim = new Sim();
    const o = order([augItem()], { rxStatus: 'PENDING', prescriptionId: 'rx1' });
    expect(sim.mustFail(CUSTOMER, { type: 'ORDER_PLACED', order: o })).toMatch(/prescription is required/i);
    const wrong = rx({ drugs: [{ medicineId: 'med-pand', qty: 5 }] });
    expect(sim.mustFail(CUSTOMER, { type: 'ORDER_PLACED', order: o, prescription: wrong })).toMatch(/not listed/);
  });

  it('keeps Eco-Sale from bypassing the prescription gate', () => {
    const sim = new Sim();
    sim.must(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-augmentin-1', discountPct: 40 });
    const eco: OrderItem = { medicineId: 'med-augmentin', batchId: 'b-augmentin-1', qty: 2, unitPrice: 122.4, ecoSale: true };
    const o = order([eco], { rxStatus: 'NOT_REQUIRED' });
    expect(sim.mustFail(CUSTOMER, { type: 'ORDER_PLACED', order: o })).toMatch(/does not need|prescription/i);
  });

  it('lets the chemist reject, the customer re-upload, and restocks on cancel', () => {
    const sim = new Sim();
    sim.must(CUSTOMER, { type: 'ORDER_PLACED', order: order([doloItem()], { id: 'o0' }) });
    const items = [augItem(5)];
    const o = order(items, { rxStatus: 'PENDING', prescriptionId: 'rx1' });
    sim.must(CUSTOMER, { type: 'ORDER_PLACED', order: o, prescription: rx() });
    expect(sim.mustFail(CHEMIST, { type: 'RX_REJECTED', orderId: 'o1', reason: ' ' })).toMatch(/reason/);
    sim.must(CHEMIST, { type: 'RX_REJECTED', orderId: 'o1', reason: 'Unreadable' });
    expect(sim.state.orders.o1).toMatchObject({ status: 'PLACED', rxStatus: 'REJECTED', rxRejectReason: 'Unreadable' });
    expect(sim.mustFail(CHEMIST, { type: 'ORDER_PACKED', orderId: 'o1' })).toBeTruthy();
    sim.must(CUSTOMER, { type: 'RX_RESUBMITTED', orderId: 'o1', prescription: rx({ id: 'rx2' }) });
    expect(sim.state.orders.o1).toMatchObject({ rxStatus: 'PENDING', prescriptionId: 'rx2' });
    sim.must(CHEMIST, { type: 'RX_APPROVED', orderId: 'o1' });
    expect(sim.state.batches['b-augmentin-1']!.qty).toBe(35);
    sim.must(CUSTOMER, { type: 'ORDER_CANCELLED', orderId: 'o1' });
    expect(sim.state.batches['b-augmentin-1']!.qty).toBe(40);
    expect(sim.mustFail(CUSTOMER, { type: 'ORDER_CANCELLED', orderId: 'o1' })).toMatch(/Invalid/);
  });

  it('expires an approved-but-unpacked antibiotic Rx once time passes its validity window', () => {
    const sim = new Sim();
    const o = order([augItem(5)], { rxStatus: 'PENDING', prescriptionId: 'rx1' });
    sim.must(CUSTOMER, { type: 'ORDER_PLACED', order: o, prescription: rx({ date: '2026-11-01' }) });
    sim.must(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-12-20' });
    expect(sim.mustFail(CHEMIST, { type: 'RX_APPROVED', orderId: 'o1' })).toMatch(/days old/);
  });

  it('keeps an antibiotic prescription single-use across orders', () => {
    const sim = new Sim();
    const o1 = order([augItem(5)], { rxStatus: 'PENDING', prescriptionId: 'rx1' });
    sim.must(CUSTOMER, { type: 'ORDER_PLACED', order: o1, prescription: rx() });
    const o2 = order([augItem(5)], { id: 'o2', rxStatus: 'PENDING', prescriptionId: 'rx1' });
    expect(sim.mustFail(CUSTOMER, { type: 'ORDER_PLACED', order: o2, prescription: rx() })).toMatch(/already used/);
  });

  it('only lets riders who are online accept, and only the assigned rider progress an order', () => {
    const sim = new Sim();
    sim.must(CUSTOMER, { type: 'ORDER_PLACED', order: order([doloItem()]) });
    sim.must(CHEMIST, { type: 'ORDER_PACKED', orderId: 'o1' });
    expect(sim.mustFail(RIDER, { type: 'ORDER_ACCEPTED', orderId: 'o1', riderId: RIDER })).toMatch(/online/);
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'ORDER_ACCEPTED', orderId: 'o1', riderId: RIDER });
    expect(sim.mustFail(RIDER, { type: 'ORDER_OUT_FOR_DELIVERY', orderId: 'o1' })).toMatch(/arrived/);
    expect(sim.mustFail(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: false })).toMatch(/active missions/);
  });
});

describe('H1 register', () => {
  it('logs H1 sales when the order is packed', () => {
    const sim = new Sim();
    // Add an H1 medicine to this simulation's catalog only.
    const base = sim.state.medicines['med-augmentin']!;
    sim.state = {
      ...sim.state,
      medicines: { ...sim.state.medicines, 'med-h1': { ...base, id: 'med-h1', brand: 'Demo H1', schedule: 'H1', gtin: '08901234599999' } },
    };
    sim.must(CHEMIST, { type: 'STOCK_INGESTED', batch: newBatch({ id: 'b-h1', medicineId: 'med-h1' }) });
    const item: OrderItem = { medicineId: 'med-h1', batchId: 'b-h1', qty: 2, unitPrice: 204, ecoSale: false };
    sim.must(CUSTOMER, {
      type: 'ORDER_PLACED',
      order: order([item], { rxStatus: 'PENDING', prescriptionId: 'rx1' }),
      prescription: rx({ drugs: [{ medicineId: 'med-h1', qty: 5 }] }),
    });
    sim.must(CHEMIST, { type: 'RX_APPROVED', orderId: 'o1' });
    sim.must(CHEMIST, { type: 'ORDER_PACKED', orderId: 'o1' });
    expect(sim.state.h1Register).toHaveLength(1);
    expect(sim.state.h1Register[0]).toMatchObject({ patientName: 'Asha', qty: 2, doctorRegNo: 'KMC-1', retainUntil: '2029-11-07' });
  });
});

const pickup = (over: Partial<Pickup> = {}): Pickup => ({
  id: 'p1',
  kind: 'DONATION',
  sourceUserId: CUSTOMER,
  qaStoreId: STORE,
  ngoId: 'ngo-seva',
  items: [{ medicineId: 'med-dolo650', batchNo: 'X1', expiry: '2027-06-01', qty: 1, sealed: true, openedLiquid: false }],
  status: 'SCHEDULED',
  address: 'Kadri',
  lat: 1,
  lng: 1,
  scheduledAt: '2026-11-08',
  ...over,
});

describe('donations and disposal', () => {
  it('blocks ineligible donations at scheduling', () => {
    const sim = new Sim();
    const item = pickup().items[0]!;
    expect(sim.mustFail(CUSTOMER, { type: 'PICKUP_SCHEDULED', pickup: pickup({ items: [{ ...item, sealed: false }] }) })).toMatch(/sealed/);
    expect(sim.mustFail(CUSTOMER, { type: 'PICKUP_SCHEDULED', pickup: pickup({ items: [{ ...item, expiry: '2026-12-01' }] }) })).toMatch(/30 days/);
  });

  it('sends Rx-only drugs only to NGOs with a registered professional', () => {
    const sim = new Sim();
    const aug = { medicineId: 'med-augmentin', batchNo: 'A', expiry: '2027-06-01', qty: 1, sealed: true, openedLiquid: false };
    expect(sim.mustFail(CUSTOMER, { type: 'PICKUP_SCHEDULED', pickup: pickup({ ngoId: 'ngo-karunya', items: [aug] }) })).toMatch(/registered doctor or pharmacist/);
    sim.must(CUSTOMER, { type: 'PICKUP_SCHEDULED', pickup: pickup({ items: [aug] }) });
  });

  it('sends QA-rejected medicines to incineration with no donor reward', () => {
    const sim = new Sim();
    sim.must(CUSTOMER, { type: 'PICKUP_SCHEDULED', pickup: pickup() });
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'p1', riderId: RIDER });
    expect(sim.mustFail(RIDER, { type: 'PICKUP_COLLECTED', pickupId: 'p1' })).toMatch(/arrived/);
    sim.must(RIDER, { type: 'PICKUP_ARRIVED', pickupId: 'p1' });
    sim.must(RIDER, { type: 'PICKUP_COLLECTED', pickupId: 'p1' });
    expect(sim.mustFail(CHEMIST, { type: 'PICKUP_QA_REJECTED', pickupId: 'p1', note: '' })).toMatch(/reason/);
    sim.must(CHEMIST, { type: 'PICKUP_QA_REJECTED', pickupId: 'p1', note: 'Seal broken' });
    sim.must(RIDER, { type: 'PICKUP_INCINERATED', pickupId: 'p1' });
    expect(sim.state.pickups.p1!.status).toBe('INCINERATED');
    expect(sim.state.karma[CUSTOMER] ?? 0).toBe(0);
    expect(sim.state.certificates).toHaveLength(0);
  });

  it('re-checks shelf life at the QA desk after time travel', () => {
    const sim = new Sim();
    sim.must(CUSTOMER, { type: 'PICKUP_SCHEDULED', pickup: pickup({ items: [{ ...pickup().items[0]!, expiry: '2026-12-20' }] }) });
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'p1', riderId: RIDER });
    sim.must(RIDER, { type: 'PICKUP_ARRIVED', pickupId: 'p1' });
    sim.must(RIDER, { type: 'PICKUP_COLLECTED', pickupId: 'p1' });
    sim.must(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-12-01' });
    expect(sim.mustFail(CHEMIST, { type: 'PICKUP_QA_VERIFIED', pickupId: 'p1' })).toMatch(/Cannot verify/);
  });

  it('only accepts expired medicines for Yellow-Bag disposal and rewards the customer', () => {
    const sim = new Sim();
    const fresh = pickup({ kind: 'DISPOSAL', ngoId: undefined, qaStoreId: undefined });
    expect(sim.mustFail(CUSTOMER, { type: 'PICKUP_SCHEDULED', pickup: fresh })).toMatch(/not expired/);
    const expired = pickup({
      kind: 'DISPOSAL',
      ngoId: undefined,
      qaStoreId: undefined,
      items: [{ medicineId: 'med-dolo650', batchNo: 'OLD', expiry: '2026-09-01', qty: 2, sealed: true, openedLiquid: false }],
    });
    sim.must(CUSTOMER, { type: 'PICKUP_SCHEDULED', pickup: expired });
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'p1', riderId: RIDER });
    sim.must(RIDER, { type: 'PICKUP_ARRIVED', pickupId: 'p1' });
    sim.must(RIDER, { type: 'PICKUP_COLLECTED', pickupId: 'p1' });
    sim.must(RIDER, { type: 'PICKUP_INCINERATED', pickupId: 'p1' });
    expect(sim.state.karma[CUSTOMER]).toBe(150);
    expect(sim.state.certificates[0]).toMatchObject({ kind: 'GREEN_CITIZEN' });
  });

  it('lets the chemist donate or dispose a whole batch and closes it', () => {
    const sim = new Sim();
    sim.must(CHEMIST, {
      type: 'PICKUP_SCHEDULED',
      pickup: pickup({
        id: 'p2',
        sourceUserId: undefined,
        sourceStoreId: STORE,
        batchId: 'b-shelcal-1',
        items: [{ medicineId: 'med-shelcal500', batchNo: 'SH26J11', expiry: '2027-08-30', qty: 50, sealed: true, openedLiquid: false }],
      }),
    });
    expect(sim.state.batches['b-shelcal-1']!.status).toBe('DONATION_PENDING');
    expect(sim.mustFail(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-shelcal-1', discountPct: 50 })).toMatch(/in stock/);
    sim.must(CHEMIST, {
      type: 'PICKUP_SCHEDULED',
      pickup: pickup({
        id: 'p3',
        kind: 'DISPOSAL',
        ngoId: undefined,
        qaStoreId: undefined,
        sourceUserId: undefined,
        sourceStoreId: STORE,
        batchId: 'b-becosules-1',
        items: [{ medicineId: 'med-becosules', batchNo: 'BC25K12', expiry: '2026-11-01', qty: 18, sealed: true, openedLiquid: false }],
      }),
    });
    expect(sim.state.batches['b-becosules-1']!.status).toBe('DISPOSAL_PENDING');
  });
});

describe('blood donation', () => {
  it('rewards karma, a certificate and a badge, and never money', () => {
    const sim = new Sim();
    const booking = { id: 'bk1', userId: CUSTOMER, bloodBankId: 'bb-wenlock', date: '2026-11-10', bloodGroup: 'O-', status: 'BOOKED' as const };
    sim.must(CUSTOMER, { type: 'BLOOD_BOOKED', booking });
    expect(sim.mustFail(CUSTOMER, { type: 'BLOOD_DONATION_CONFIRMED', bookingId: 'bk1' })).toMatch(/admin/);
    sim.must(ADMIN, { type: 'BLOOD_DONATION_CONFIRMED', bookingId: 'bk1' });
    expect(sim.state.karma[CUSTOMER]).toBe(500);
    expect(sim.state.wallet[CUSTOMER] ?? 0).toBe(0);
    expect(Object.keys(sim.state.scratchCards)).toHaveLength(0);
    expect(sim.state.certificates[0]).toMatchObject({ kind: 'BLOOD_DONOR' });
  });

  it('rejects bookings in the past', () => {
    const sim = new Sim();
    const booking = { id: 'bk2', userId: CUSTOMER, bloodBankId: 'bb-wenlock', date: '2026-11-01', bloodGroup: 'A+', status: 'BOOKED' as const };
    expect(sim.mustFail(CUSTOMER, { type: 'BLOOD_BOOKED', booking })).toMatch(/later date/);
  });
});

describe('time travel', () => {
  it('only moves forward', () => {
    const sim = new Sim();
    sim.must(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-12-01' });
    expect(sim.mustFail(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-11-20' })).toMatch(/forward/);
  });

  it('is the admin presenter\'s tool: no other role can move the clock', () => {
    const sim = new Sim();
    for (const actor of [CUSTOMER, CHEMIST, RIDER]) {
      expect(sim.mustFail(actor, { type: 'TIME_TRAVELLED', to: '2026-12-01' })).toMatch(/Only a admin/);
    }
    expect(sim.mustFail('nobody', { type: 'TIME_TRAVELLED', to: '2026-12-01' })).toMatch(/Unknown user/);
    expect(sim.state.today).toBe('2026-11-08');
  });
});
