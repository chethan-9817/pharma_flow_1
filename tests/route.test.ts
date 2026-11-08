import { describe, expect, it } from 'vitest';
import { interpolate, riderHome, riderRoute, routeStats } from '../src/domain/route';
import type { Order, Pickup } from '../src/domain/types';
import { CHEMIST, CUSTOMER, RIDER, STORE, Sim } from './helpers';

const kinds = (sim: Sim) => riderRoute(sim.state, RIDER).stops.map((s) => s.kind);

function placedAndPacked(sim: Sim): Order {
  const order: Order = {
    id: 'o1',
    customerId: CUSTOMER,
    storeId: STORE,
    items: [{ medicineId: 'med-dolo650', batchId: 'b-dolo-1', qty: 1, unitPrice: 31, ecoSale: false }],
    status: 'PLACED',
    rxStatus: 'NOT_REQUIRED',
    deliveryOtp: '1234',
    total: 31,
    placedAt: sim.state.today,
  };
  sim.must(CUSTOMER, { type: 'ORDER_PLACED', order });
  sim.must(CHEMIST, { type: 'ORDER_PACKED', orderId: 'o1' });
  sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
  return order;
}

const customerPickup = (over: Partial<Pickup> = {}): Pickup => ({
  id: 'p1',
  kind: 'DONATION',
  sourceUserId: CUSTOMER,
  qaStoreId: STORE,
  ngoId: 'ngo-seva',
  items: [{ medicineId: 'med-dolo650', batchNo: 'X', expiry: '2027-06-01', qty: 1, sealed: true, openedLiquid: false }],
  status: 'SCHEDULED',
  address: '12, Kadri Hills, Mangaluru',
  lat: 12.883,
  lng: 74.856,
  scheduledAt: '2026-11-08',
  ...over,
});

describe('rider route', () => {
  it('is empty when the rider has nothing to do', () => {
    const sim = new Sim();
    const route = riderRoute(sim.state, RIDER);
    expect(route.stops).toEqual([]);
    expect(route.moving).toBe(false);
    expect(route.from).toEqual(riderHome(sim.state));
  });

  it('puts the rider about 800 m from the store at the start', () => {
    const sim = new Sim();
    const home = riderHome(sim.state);
    const store = sim.state.stores[STORE]!;
    const km = routeStats(home, [store]).totalKm;
    expect(km).toBeGreaterThan(0.5);
    expect(km).toBeLessThan(1.2);
  });

  it('follows a delivery: store, then the customer, with the rider moving then waiting', () => {
    const sim = new Sim();
    placedAndPacked(sim);
    sim.must(RIDER, { type: 'ORDER_ACCEPTED', orderId: 'o1', riderId: RIDER });

    let route = riderRoute(sim.state, RIDER);
    expect(route.stops.map((s) => s.kind)).toEqual(['STORE', 'HOME']);
    expect(route.moving).toBe(true);
    expect(route.from).toEqual(riderHome(sim.state));

    sim.must(RIDER, { type: 'ORDER_ARRIVED', orderId: 'o1' });
    route = riderRoute(sim.state, RIDER);
    expect(route.moving).toBe(false);
    expect(route.from).toEqual({ lat: sim.state.stores[STORE]!.lat, lng: sim.state.stores[STORE]!.lng });

    sim.must(RIDER, { type: 'ORDER_OUT_FOR_DELIVERY', orderId: 'o1' });
    route = riderRoute(sim.state, RIDER);
    expect(route.stops.map((s) => s.kind)).toEqual(['HOME']);
    expect(route.moving).toBe(true);
    expect(route.from.lat).toBe(sim.state.stores[STORE]!.lat);

    sim.must(RIDER, { type: 'ORDER_DELIVERED', orderId: 'o1', otp: '1234' });
    expect(riderRoute(sim.state, RIDER).stops).toEqual([]);
  });

  it('gives each stop a contact number for the Call button', () => {
    const sim = new Sim();
    placedAndPacked(sim);
    sim.must(RIDER, { type: 'ORDER_ACCEPTED', orderId: 'o1', riderId: RIDER });
    const [store, home] = riderRoute(sim.state, RIDER).stops;
    expect(store!.phone).toBe(sim.state.users[CHEMIST]!.phone);
    expect(home!.phone).toBe(sim.state.users[CUSTOMER]!.phone);
    expect(home!.label).toContain('Asha Shetty');
  });

  it('plans a customer donation as pickup, chemist QA, then the NGO', () => {
    const sim = new Sim();
    sim.must(CUSTOMER, { type: 'PICKUP_SCHEDULED', pickup: customerPickup() });
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'p1', riderId: RIDER });
    expect(kinds(sim)).toEqual(['PICKUP', 'STORE', 'NGO']);

    sim.must(RIDER, { type: 'PICKUP_ARRIVED', pickupId: 'p1' });
    expect(riderRoute(sim.state, RIDER).moving).toBe(false);

    sim.must(RIDER, { type: 'PICKUP_COLLECTED', pickupId: 'p1' });
    let route = riderRoute(sim.state, RIDER);
    expect(route.stops.map((s) => s.kind)).toEqual(['STORE', 'NGO']);
    expect(route.from).toEqual({ lat: 12.883, lng: 74.856 });

    sim.must(CHEMIST, { type: 'PICKUP_QA_VERIFIED', pickupId: 'p1' });
    route = riderRoute(sim.state, RIDER);
    expect(route.stops.map((s) => s.kind)).toEqual(['NGO']);
    expect(route.from.lat).toBe(sim.state.stores[STORE]!.lat);
  });

  it('sends QA-rejected medicines to the CBWTF', () => {
    const sim = new Sim();
    sim.must(CUSTOMER, { type: 'PICKUP_SCHEDULED', pickup: customerPickup() });
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'p1', riderId: RIDER });
    sim.must(RIDER, { type: 'PICKUP_ARRIVED', pickupId: 'p1' });
    sim.must(RIDER, { type: 'PICKUP_COLLECTED', pickupId: 'p1' });
    sim.must(CHEMIST, { type: 'PICKUP_QA_REJECTED', pickupId: 'p1', note: 'Seal broken' });
    const stops = riderRoute(sim.state, RIDER).stops;
    expect(stops.map((s) => s.kind)).toEqual(['CBWTF']);
    expect(stops[0]!.lat).toBe(sim.state.cbwtf.lat);
  });

  it('skips the QA stop when a chemist donates from their own store', () => {
    const sim = new Sim();
    const store = sim.state.stores[STORE]!;
    sim.must(CHEMIST, {
      type: 'PICKUP_SCHEDULED',
      pickup: customerPickup({
        id: 'p2',
        sourceUserId: undefined,
        sourceStoreId: STORE,
        batchId: 'b-shelcal-1',
        address: `${store.name}, ${store.area}`,
        lat: store.lat,
        lng: store.lng,
        items: [{ medicineId: 'med-shelcal500', batchNo: 'SH26J11', expiry: '2027-08-30', qty: 50, sealed: true, openedLiquid: false }],
      }),
    });
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'p2', riderId: RIDER });
    expect(kinds(sim)).toEqual(['PICKUP', 'NGO']);
  });

  it('plans a Yellow-Bag pickup as pickup then the CBWTF', () => {
    const sim = new Sim();
    sim.must(CUSTOMER, {
      type: 'PICKUP_SCHEDULED',
      pickup: customerPickup({
        id: 'p3',
        kind: 'DISPOSAL',
        qaStoreId: undefined,
        ngoId: undefined,
        items: [{ medicineId: 'med-dolo650', batchNo: 'OLD', expiry: '2026-09-01', qty: 2, sealed: true, openedLiquid: false }],
      }),
    });
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'p3', riderId: RIDER });
    expect(kinds(sim)).toEqual(['PICKUP', 'CBWTF']);
    sim.must(RIDER, { type: 'PICKUP_ARRIVED', pickupId: 'p3' });
    sim.must(RIDER, { type: 'PICKUP_COLLECTED', pickupId: 'p3' });
    expect(kinds(sim)).toEqual(['CBWTF']);
  });

  it('chains stops when a backhaul pickup is added during a delivery', () => {
    const sim = new Sim();
    placedAndPacked(sim);
    sim.must(RIDER, { type: 'ORDER_ACCEPTED', orderId: 'o1', riderId: RIDER });
    sim.must(RIDER, { type: 'ORDER_ARRIVED', orderId: 'o1' });
    sim.must(RIDER, { type: 'ORDER_OUT_FOR_DELIVERY', orderId: 'o1' });
    sim.must(CUSTOMER, { type: 'PICKUP_SCHEDULED', pickup: customerPickup() });
    sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'p1', riderId: RIDER });
    const route = riderRoute(sim.state, RIDER);
    expect(route.stops.map((s) => s.kind)).toEqual(['HOME', 'PICKUP', 'STORE', 'NGO']);
    expect(new Set(route.stops.map((s) => s.id)).size).toBe(4);
  });
});

describe('routeStats', () => {
  it('measures legs, total distance and an ETA at city speed', () => {
    const a = { lat: 12.87, lng: 74.84 };
    const b = { lat: 12.97, lng: 74.84 }; // about 11.1 km north
    const stats = routeStats(a, [b, { lat: 13.07, lng: 74.84 }]);
    expect(stats.legs[0]).toEqual({ km: 11.1, minutes: 27 });
    expect(stats.legs).toHaveLength(2);
    expect(stats.totalKm).toBeCloseTo(22.2, 0);
    expect(stats.totalMinutes).toBe(stats.legs[0]!.minutes + stats.legs[1]!.minutes);
  });

  it('is zero for an empty route or a stop at the same place', () => {
    const a = { lat: 12.87, lng: 74.84 };
    expect(routeStats(a, [])).toEqual({ legs: [], totalKm: 0, totalMinutes: 0 });
    expect(routeStats(a, [a]).legs[0]).toEqual({ km: 0, minutes: 0 });
  });

  it('shows at least one minute for a very short hop', () => {
    const a = { lat: 12.87, lng: 74.84 };
    expect(routeStats(a, [{ lat: 12.8701, lng: 74.84 }]).legs[0]!.minutes).toBe(1);
  });
});

describe('interpolate', () => {
  const a = { lat: 10, lng: 20 };
  const b = { lat: 20, lng: 40 };
  it('moves part of the way and clamps at the ends', () => {
    expect(interpolate(a, b, 0.5)).toEqual({ lat: 15, lng: 30 });
    expect(interpolate(a, b, -1)).toEqual(a);
    expect(interpolate(a, b, 5)).toEqual(b);
  });
});
