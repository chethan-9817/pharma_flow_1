import { describe, expect, it } from 'vitest';
import { backhaulSuggestions, bucketCounts, distanceKm, ecoListings, kpis, openMissions, storeInventory } from '../src/domain/selectors';
import { ADMIN, CHEMIST, CUSTOMER, RIDER, STORE, Sim } from './helpers';

describe('selectors', () => {
  it('summarises store inventory across all four buckets', () => {
    const sim = new Sim();
    const counts = bucketCounts(storeInventory(sim.state, STORE));
    expect(counts).toEqual({ SAFE: 4, LOCKOUT: 6, CRITICAL: 1, EXPIRED: 1 });
    expect(storeInventory(sim.state, STORE)[0]!.bucket).toBe('EXPIRED');
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
