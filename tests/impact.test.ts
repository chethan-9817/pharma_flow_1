import { describe, expect, it } from 'vitest';
import { ACTIVITY_FAMILIES, activityByFamily, impactTimeline, stockByBucket } from '../src/domain/impact';
import { ecoPrice } from '../src/domain/rules/ecoSale';
import { SEED } from '../src/seed';
import { ADMIN, CHEMIST, CUSTOMER, RIDER, STORE, Sim } from './helpers';

function sellEcoOkacet(sim: Sim) {
  sim.must(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
  sim.must(CUSTOMER, {
    type: 'ORDER_PLACED',
    order: {
      id: 'o1', customerId: CUSTOMER, storeId: STORE, status: 'PLACED', rxStatus: 'NOT_REQUIRED', deliveryOtp: '1234',
      items: [{ medicineId: 'med-okacet', batchId: 'b-okacet-1', qty: 2, unitPrice: ecoPrice(23, 50), ecoSale: true }],
      total: 2 * ecoPrice(23, 50), placedAt: sim.state.today,
    },
  });
  sim.must(CHEMIST, { type: 'ORDER_PACKED', orderId: 'o1' });
  sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
  sim.must(RIDER, { type: 'ORDER_ACCEPTED', orderId: 'o1', riderId: RIDER });
  sim.must(RIDER, { type: 'ORDER_ARRIVED', orderId: 'o1' });
  sim.must(RIDER, { type: 'ORDER_OUT_FOR_DELIVERY', orderId: 'o1' });
  sim.must(RIDER, { type: 'ORDER_DELIVERED', orderId: 'o1', otp: '1234' });
}

describe('impactTimeline', () => {
  it('starts at zero on the first day even with no events', () => {
    expect(impactTimeline(SEED, [])).toEqual([{ step: 0, date: SEED.today, ecoRevenue: 0, ngoValue: 0, wasteKg: 0, bloodDonations: 0, ngoFund: 0 }]);
  });

  it('records a point whenever a number changes, even within a single day', () => {
    const sim = new Sim();
    sellEcoOkacet(sim); // 8 events; revenue changes on the 8th, the delivery
    sim.must(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-11-09' }); // 9th: no number changes
    sim.must(CUSTOMER, { type: 'BLOOD_BOOKED', booking: { id: 'bk1', userId: CUSTOMER, bloodBankId: 'bb-wenlock', date: '2026-11-09', bloodGroup: 'O+', status: 'BOOKED' } }); // 10th
    sim.must(ADMIN, { type: 'BLOOD_DONATION_CONFIRMED', bookingId: 'bk1' }); // 11th: blood donation counted

    const points = impactTimeline(SEED, sim.log);
    expect(points.map((p) => p.step)).toEqual([0, 8, 11]);
    expect(points[0]).toMatchObject({ ecoRevenue: 0, bloodDonations: 0, date: '2026-11-08' });
    // Delivering the ₹23 order (2 packs, ₹46 at MRP) also puts 2% of the 10% platform fee on the MRP (₹4.60), so ₹0.09, into the NGO fund.
    expect(points[1]).toMatchObject({ ecoRevenue: 23, bloodDonations: 0, ngoFund: 0.09, date: '2026-11-08' });
    expect(points[2]).toMatchObject({ ecoRevenue: 23, bloodDonations: 1, date: '2026-11-09' });
  });

  it('extends the line to the newest event when nothing changed after the last point', () => {
    const sim = new Sim();
    sellEcoOkacet(sim);
    sim.must(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-11-09' });
    const points = impactTimeline(SEED, sim.log);
    expect(points.map((p) => p.step)).toEqual([0, 8, 9]);
    expect(points[2]).toMatchObject({ ecoRevenue: 23, date: '2026-11-09' });
  });
});

describe('activityByFamily', () => {
  it('always lists every family in a fixed order', () => {
    expect(activityByFamily([]).map((a) => a.family)).toEqual(ACTIVITY_FAMILIES);
    expect(activityByFamily([]).every((a) => a.count === 0)).toBe(true);
  });

  it('counts events by the area of the platform they belong to', () => {
    const sim = new Sim();
    sellEcoOkacet(sim);
    const counts = Object.fromEntries(activityByFamily(sim.log).map((a) => [a.family, a.count]));
    expect(counts).toMatchObject({ Inventory: 1, Orders: 6, Admin: 1, Pickups: 0, Prescriptions: 0 });
    expect(Object.values(counts).reduce((n, c) => n + c, 0)).toBe(sim.log.length);
  });
});

describe('stockByBucket', () => {
  /** Units in the fresh batch every catalogue item has (one year or more left). */
  const FRESH = 2586;
  /** Two skin-care batches within 6 months of expiry (sunscreen 12, vitamin C serum 10). */
  const NEAR_EXPIRY_PRODUCTS = 12 + 10;
  /** The five newer stores: the whole catalogue with over a year left, plus two near-expiry batches each. */
  const BRANCH_SAFE = 11185;
  const BRANCH_LOCKOUT = 170;

  it('sums units by expiry bucket for approved stores', () => {
    const sim = new Sim();
    expect(stockByBucket(sim.state)).toEqual({
      SAFE: 120 + 50 + 80 + 25 + FRESH + BRANCH_SAFE,
      LOCKOUT: 12 + 20 + 40 + 30 + 20 + 60 + NEAR_EXPIRY_PRODUCTS + BRANCH_LOCKOUT,
      CRITICAL: 25,
      EXPIRED: 18,
    });
  });

  it('moves units into the expired bucket as time passes while the total stays the same', () => {
    const sim = new Sim();
    sim.must(ADMIN, { type: 'TIME_TRAVELLED', to: '2027-04-07' });
    const later = stockByBucket(sim.state);
    expect(later.EXPIRED).toBeGreaterThan(18);
    // Five months on, the fresh batches are still safe to sell.
    expect(later.SAFE).toBeGreaterThanOrEqual(FRESH);
    expect(Object.values(later).reduce((n, c) => n + c, 0)).toBe(120 + 50 + 80 + 25 + 12 + 20 + 40 + 30 + 20 + 60 + 25 + 18 + FRESH + NEAR_EXPIRY_PRODUCTS + BRANCH_SAFE + BRANCH_LOCKOUT);
  });
});
