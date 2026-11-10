import { describe, expect, it } from 'vitest';
import { backhaulSuggestions, bucketCounts, courseReminders, distanceKm, ecoListings, expiryAlerts, kpis, openMissions, storeInventory, storeWriteOffs } from '../src/domain/selectors';
import { ADMIN, CHEMIST, CUSTOMER, RIDER, STORE, Sim } from './helpers';

describe('selectors', () => {
  it('summarises store inventory across all four buckets', () => {
    const sim = new Sim();
    const counts = bucketCounts(storeInventory(sim.state, STORE));
    expect(counts).toEqual({ SAFE: 4, LOCKOUT: 6, CRITICAL: 1, EXPIRED: 1 });
    expect(storeInventory(sim.state, STORE)[0]!.bucket).toBe('EXPIRED');
  });

  it('alerts the chemist to full-price batches within 6 months of expiry, with the Eco-Sale split', () => {
    const sim = new Sim();
    const alerts = expiryAlerts(sim.state, STORE);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((a) => a.daysLeft > 0 && a.daysLeft <= 180 && a.batch.status === 'IN_STOCK')).toBe(true);
    // Fresh stock is not on the list, and neither is the expired Becosules batch.
    expect(alerts.map((a) => a.batch.id)).not.toContain('b-dolo-1');
    expect(alerts.map((a) => a.batch.id)).not.toContain('b-becosules-1');
    // Augmentin (₹204, 143 days left): 15% off, ₹173.40 paid, ₹20.40 to PharmaFlow, ₹153 to the store.
    expect(alerts.find((a) => a.batch.id === 'b-augmentin-1')).toMatchObject({ discountPct: 15, split: { price: 173.4, commission: 20.4, storeGets: 153 } });
    // Limcee (22 days) is too close to expiry to sell for a 15-day course, so it is flagged, not offered.
    expect(alerts.find((a) => a.batch.id === 'b-limcee-1')?.blocked).toMatch(/at least 30 days/);
    // Once on Eco-Sale, a batch leaves the alert list.
    sim.must(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-augmentin-1', discountPct: 15 });
    expect(expiryAlerts(sim.state, STORE).map((a) => a.batch.id)).not.toContain('b-augmentin-1');
  });

  it('lists Eco-Sale batches with price and the longest course that fits', () => {
    const sim = new Sim();
    expect(ecoListings(sim.state)).toHaveLength(0);
    sim.must(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
    const [listing] = ecoListings(sim.state);
    expect(listing).toMatchObject({ discountPct: 50, price: 11.5, daysLeft: 38, fitsCourseDays: 23 });
  });

  it('hides Eco-Sale listings once the course no longer fits', () => {
    const sim = new Sim();
    sim.must(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
    sim.must(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-12-05' });
    expect(ecoListings(sim.state)).toHaveLength(0);
  });

  it('computes impact KPIs from state', () => {
    const sim = new Sim();
    expect(kpis(sim.state)).toMatchObject({ deadStockRecovered: 0, hazardousKgDiverted: 0, ngoMedicineValue: 0 });
    const expired = {
      id: 'p1',
      kind: 'DISPOSAL' as const,
      sourceUserId: CUSTOMER,
      items: [{ medicineId: 'med-dolo650', batchNo: 'OLD', expiry: '2026-09-01', qty: 5, sealed: true, openedLiquid: false }],
      status: 'SCHEDULED' as const,
      address: 'Kadri',
      lat: 12.883,
      lng: 74.856,
      scheduledAt: sim.state.today,
    };
    sim.must(CUSTOMER, { type: 'PICKUP_SCHEDULED', pickup: expired });
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'p1', riderId: RIDER });
    sim.must(RIDER, { type: 'PICKUP_ARRIVED', pickupId: 'p1' });
    sim.must(RIDER, { type: 'PICKUP_COLLECTED', pickupId: 'p1' });
    sim.must(RIDER, { type: 'PICKUP_INCINERATED', pickupId: 'p1' });
    expect(kpis(sim.state).hazardousKgDiverted).toBe(0.1);
  });

  it('offers a nearby pickup as a backhaul after a delivery', () => {
    const sim = new Sim();
    sim.must(CUSTOMER, {
      type: 'PICKUP_SCHEDULED',
      pickup: {
        id: 'p1',
        kind: 'DONATION',
        sourceUserId: CUSTOMER,
        qaStoreId: STORE,
        ngoId: 'ngo-seva',
        items: [{ medicineId: 'med-dolo650', batchNo: 'X', expiry: '2027-06-01', qty: 1, sealed: true, openedLiquid: false }],
        status: 'SCHEDULED',
        address: '12, Kadri Hills',
        lat: 12.883,
        lng: 74.856,
        scheduledAt: sim.state.today,
      },
    });
    const order = { id: 'o1', customerId: CUSTOMER, storeId: STORE, items: [], status: 'PACKED' as const, rxStatus: 'NOT_REQUIRED' as const, total: 0, placedAt: sim.state.today };
    expect(backhaulSuggestions(sim.state, order).map((p) => p.id)).toEqual(['p1']);
    expect(openMissions(sim.state).map((m) => m.kind)).toEqual(['NGO_PICKUP']);
    expect(backhaulSuggestions(sim.state, { ...order, customerId: 'u-ravi' })).toEqual([]);
  });

  it('measures distance', () => {
    expect(distanceKm({ lat: 12.87, lng: 74.84 }, { lat: 12.87, lng: 74.84 })).toBe(0);
    expect(distanceKm({ lat: 12.87, lng: 74.84 }, { lat: 12.97, lng: 74.84 })).toBeCloseTo(11.1, 0);
  });
});

describe('course reminders', () => {
  const deliver = (sim: Sim) => {
    sim.must(CUSTOMER, {
      type: 'ORDER_PLACED',
      order: {
        id: 'o1', customerId: CUSTOMER, storeId: STORE, status: 'PLACED', rxStatus: 'NOT_REQUIRED', deliveryOtp: '1234', total: 31, placedAt: sim.state.today,
        items: [{ medicineId: 'med-dolo650', batchId: 'b-dolo-1', qty: 1, unitPrice: 31, ecoSale: false }],
      },
    });
    sim.must(CHEMIST, { type: 'ORDER_PACKED', orderId: 'o1' });
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'ORDER_ACCEPTED', orderId: 'o1', riderId: RIDER });
    sim.must(RIDER, { type: 'ORDER_ARRIVED', orderId: 'o1' });
    sim.must(RIDER, { type: 'ORDER_OUT_FOR_DELIVERY', orderId: 'o1' });
    sim.must(RIDER, { type: 'ORDER_DELIVERED', orderId: 'o1', otp: '1234' });
  };

  it('appears only after the course length has passed on the simulated clock', () => {
    const sim = new Sim();
    deliver(sim);
    expect(courseReminders(sim.state, CUSTOMER)).toEqual([]);
    sim.must(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-11-12' }); // 4 days in, Dolo course is 5
    expect(courseReminders(sim.state, CUSTOMER)).toEqual([]);
    sim.must(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-11-14' });
    expect(courseReminders(sim.state, CUSTOMER)).toEqual([
      { orderId: 'o1', medicineId: 'med-dolo650', endedOn: '2026-11-13', courseDays: 5 },
    ]);
  });

  it('is empty for other customers and for undelivered orders', () => {
    const sim = new Sim();
    deliver(sim);
    sim.must(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-11-20' });
    expect(courseReminders(sim.state, 'u-ravi')).toEqual([]);
    expect(courseReminders(new Sim().state, CUSTOMER)).toEqual([]);
  });
});

describe('store write-offs', () => {
  const storePickup = (id: string, batchId: string, med: string, batchNo: string, expiry: string, qty: number, kind: 'DONATION' | 'DISPOSAL') => ({
    id,
    kind,
    sourceStoreId: STORE,
    ...(kind === 'DONATION' ? { qaStoreId: STORE, ngoId: 'ngo-seva' } : {}),
    batchId,
    items: [{ medicineId: med, batchNo, expiry, qty, sealed: true, openedLiquid: false }],
    status: 'SCHEDULED' as const,
    address: 'Sri Ganesh Medicals',
    lat: 12.8698,
    lng: 74.843,
    scheduledAt: '2026-11-08',
  });

  it('lists finished donations with the GST ITC reversal and ignores unfinished ones', () => {
    const sim = new Sim();
    sim.must(CHEMIST, { type: 'PICKUP_SCHEDULED', pickup: storePickup('p1', 'b-shelcal-1', 'med-shelcal500', 'SH26J11', '2027-08-30', 50, 'DONATION') });
    expect(storeWriteOffs(sim.state, STORE)).toEqual([]);
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'p1', riderId: RIDER });
    sim.must(RIDER, { type: 'PICKUP_ARRIVED', pickupId: 'p1' });
    sim.must(RIDER, { type: 'PICKUP_COLLECTED', pickupId: 'p1' });
    sim.must(CHEMIST, { type: 'PICKUP_QA_VERIFIED', pickupId: 'p1' });
    sim.must(RIDER, { type: 'PICKUP_DELIVERED_TO_NGO', pickupId: 'p1' });
    const [w] = storeWriteOffs(sim.state, STORE);
    expect(w!.certificate).toMatchObject({ reason: 'NGO_DONATION', recipient: 'Seva NGO Clinic', totalCostValue: 4690, totalItcReversal: 562.8 });
    expect(w!.certificate.title).toBe('Inventory Write-Off & NGO Donation Receipt');
    expect(storeWriteOffs(sim.state, 'store-carstreet')).toEqual([]);
  });

  it('writes a disposed batch off to the CBWTF', () => {
    const sim = new Sim();
    sim.must(CHEMIST, { type: 'PICKUP_SCHEDULED', pickup: storePickup('p2', 'b-becosules-1', 'med-becosules', 'BC25K12', '2026-11-01', 18, 'DISPOSAL') });
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'p2', riderId: RIDER });
    sim.must(RIDER, { type: 'PICKUP_ARRIVED', pickupId: 'p2' });
    sim.must(RIDER, { type: 'PICKUP_COLLECTED', pickupId: 'p2' });
    sim.must(RIDER, { type: 'PICKUP_INCINERATED', pickupId: 'p2' });
    const [w] = storeWriteOffs(sim.state, STORE);
    expect(w!.certificate.reason).toBe('BIO_DISPOSAL');
    expect(w!.certificate.recipient).toBe(sim.state.cbwtf.name);
  });
});
