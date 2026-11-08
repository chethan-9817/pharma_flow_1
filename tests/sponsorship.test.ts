import { describe, expect, it } from 'vitest';
import { impactTimeline } from '../src/domain/impact';
import { applyEvent } from '../src/domain/reducer';
import { planSponsorship } from '../src/domain/sponsor';
import { customerSponsorships, fundSummary, kpis, orderFundShare, storeSponsorships, storeWriteOffs } from '../src/domain/selectors';
import { ecoPrice } from '../src/domain/rules/ecoSale';
import type { Sponsorship } from '../src/domain/types';
import { SEED } from '../src/seed';
import { ADMIN, CHEMIST, CUSTOMER, RIDER, STORE, Sim } from './helpers';

const NGO = 'ngo-seva';

/** Okacet (₹23, 38 days left, 60 packs) on Eco-Sale at 50%: ₹11.50 a pack, so ₹99 buys 8 packs. */
function sponsorable(): Sim {
  const sim = new Sim();
  sim.must(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
  return sim;
}

function plan(sim: Sim, id = 'sp1', batchId = 'b-okacet-1', ngoId = NGO): Sponsorship {
  const planned = planSponsorship(sim.state, { id, customerId: CUSTOMER, batchId, ngoId });
  if (!planned.ok) throw new Error(planned.error);
  return planned.value;
}

function carryToNgo(sim: Sim, pickupId: string) {
  sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
  sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId, riderId: RIDER });
  sim.must(RIDER, { type: 'PICKUP_ARRIVED', pickupId });
  sim.must(RIDER, { type: 'PICKUP_COLLECTED', pickupId });
}

describe('planSponsorship', () => {
  it('works out the packs, the store payout and the fund top-up', () => {
    const sp = plan(sponsorable());
    expect(sp).toMatchObject({ qty: 8, unitPrice: 11.5, amount: 99, storePayout: 92, fundTopUp: 7, storeId: STORE, pickupId: 'pk-sp1', status: 'PLACED' });
  });

  it('explains why a batch cannot be sponsored', () => {
    const sim = new Sim(); // nothing is on Eco-Sale yet
    expect(planSponsorship(sim.state, { id: 'x', customerId: CUSTOMER, batchId: 'b-okacet-1', ngoId: NGO })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Eco-Sale/),
    });
    expect(planSponsorship(sim.state, { id: 'x', customerId: CUSTOMER, batchId: 'nope', ngoId: NGO }).ok).toBe(false);
    sim.must(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
    expect(planSponsorship(sim.state, { id: 'x', customerId: CUSTOMER, batchId: 'b-okacet-1', ngoId: 'ngo-missing' })).toMatchObject({ ok: false, error: expect.stringMatching(/NGO/) });
  });
});

describe('SPONSORSHIP_PLACED', () => {
  it('sets the packs aside and starts a rider mission at the store', () => {
    const sim = sponsorable();
    sim.must(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: plan(sim) });

    expect(sim.state.batches['b-okacet-1']!.qty).toBe(60 - 8);
    expect(sim.state.sponsorships.sp1).toMatchObject({ status: 'PLACED', qty: 8 });
    const pickup = sim.state.pickups['pk-sp1']!;
    expect(pickup).toMatchObject({
      kind: 'DONATION',
      status: 'SCHEDULED',
      sourceStoreId: STORE,
      qaStoreId: STORE,
      ngoId: NGO,
      sponsorshipId: 'sp1',
    });
    expect(pickup.sourceUserId).toBeUndefined();
    expect(pickup.items).toEqual([expect.objectContaining({ medicineId: 'med-okacet', batchNo: 'OK26A18', qty: 8, sealed: true })]);
    // Nothing is paid out or rewarded until the NGO has the packs.
    expect(sim.state.ngoFund.balance).toBe(0);
    expect(sim.state.karma[CUSTOMER] ?? 0).toBe(0);
  });

  it('rejects a deal that was changed on the way in', () => {
    const sim = sponsorable();
    const sp = plan(sim);
    expect(sim.mustFail(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: { ...sp, qty: 20 } })).toMatch(/out of date/);
    expect(sim.mustFail(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: { ...sp, storePayout: 10, fundTopUp: 89 } })).toMatch(/out of date/);
    expect(sim.mustFail(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: { ...sp, amount: 1 } })).toMatch(/out of date/);
    expect(sim.mustFail(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: { ...sp, status: 'DELIVERED' } })).toMatch(/PLACED/);
    expect(sim.state.batches['b-okacet-1']!.qty).toBe(60);
  });

  it('only lets a customer sponsor with their own payment, and only once per id', () => {
    const sim = sponsorable();
    const sp = plan(sim);
    expect(sim.mustFail(CHEMIST, { type: 'SPONSORSHIP_PLACED', sponsorship: sp })).toMatch(/own payment/);
    expect(sim.mustFail(ADMIN, { type: 'SPONSORSHIP_PLACED', sponsorship: sp })).toMatch(/own payment/);
    sim.must(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: sp });
    expect(sim.mustFail(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: sp })).toMatch(/already exists/);
  });

  it('blocks prescription-only medicines, even on Eco-Sale', () => {
    const sim = new Sim();
    sim.must(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-augmentin-1', discountPct: 50 });
    const attempt = planSponsorship(sim.state, { id: 'sp1', customerId: CUSTOMER, batchId: 'b-augmentin-1', ngoId: NGO });
    expect(attempt).toMatchObject({ ok: false, error: expect.stringMatching(/over-the-counter/) });
    // The reducer says no too, even for an event built by hand.
    const forged: Sponsorship = {
      id: 'sp1', customerId: CUSTOMER, storeId: STORE, batchId: 'b-augmentin-1', medicineId: 'med-augmentin', ngoId: NGO,
      qty: 1, unitPrice: ecoPrice(204, 50), amount: 99, storePayout: 102, fundTopUp: 0, status: 'PLACED', pickupId: 'pk-sp1', placedAt: sim.state.today,
    };
    expect(sim.mustFail(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: forged })).toMatch(/over-the-counter/);
  });

  it('stops once the packs would reach an NGO with 30 days or less of shelf life', () => {
    const sim = sponsorable();
    const sp = plan(sim);
    sim.must(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-11-18' }); // Okacet now has 28 days left
    expect(sim.mustFail(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: sp })).toMatch(/30 days/);
  });

  it('cannot sponsor more packs than the batch holds', () => {
    const sim = sponsorable();
    sim.must(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: plan(sim, 'sp1') });
    // Another customer buys nearly everything that is left through a normal order.
    sim.must(CUSTOMER, {
      type: 'ORDER_PLACED',
      order: {
        id: 'o1', customerId: CUSTOMER, storeId: STORE, status: 'PLACED', rxStatus: 'NOT_REQUIRED', deliveryOtp: '1234',
        items: [{ medicineId: 'med-okacet', batchId: 'b-okacet-1', qty: 50, unitPrice: 11.5, ecoSale: true }], total: 575, placedAt: sim.state.today,
      },
    });
    expect(sim.state.batches['b-okacet-1']!.qty).toBe(2);
    const last = plan(sim, 'sp2');
    expect(last.qty).toBe(2); // capped to what is left, and the change grows
    expect(last).toMatchObject({ storePayout: 23, fundTopUp: 76 });
    sim.must(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: last });
    expect(sim.state.batches['b-okacet-1']!.qty).toBe(0);
    expect(planSponsorship(sim.state, { id: 'sp3', customerId: CUSTOMER, batchId: 'b-okacet-1', ngoId: NGO }).ok).toBe(false);
  });
});

describe('a sponsorship through to the NGO', () => {
  function deliver(sim: Sim) {
    sim.must(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: plan(sim) });
    carryToNgo(sim, 'pk-sp1');
    sim.must(CHEMIST, { type: 'PICKUP_QA_VERIFIED', pickupId: 'pk-sp1', note: 'Seal intact, batch OK36' });
    sim.must(RIDER, { type: 'PICKUP_DELIVERED_TO_NGO', pickupId: 'pk-sp1' });
  }

  it('pays the store, tops up the fund and rewards the sponsor', () => {
    const sim = sponsorable();
    deliver(sim);
    const s = sim.state;

    expect(s.sponsorships.sp1!.status).toBe('DELIVERED');
    expect(s.pickups['pk-sp1']!.status).toBe('DELIVERED_TO_NGO');
    expect(s.ngoFund.balance).toBe(7);
    expect(s.ngoFund.entries).toEqual([expect.objectContaining({ kind: 'SPONSOR_CHANGE', amount: 7, refId: 'sp1', date: s.today })]);
    // Same reward as a donation: +200 karma, a scratch card and an NGO Donor certificate.
    expect(s.karma[CUSTOMER]).toBe(200);
    expect(s.scratchCards['sc-sp1']).toMatchObject({ userId: CUSTOMER, source: 'DONATION', revealed: false });
    expect(s.certificates).toEqual([
      expect.objectContaining({ kind: 'NGO_DONOR', userId: CUSTOMER, refId: 'sp1', sponsored: true, summary: 'Sponsored 8 packs of Okacet for Seva NGO Clinic' }),
    ]);
    // The rider is paid like any pickup, and the NGO value counts the packs at MRP.
    expect(s.riders[RIDER]).toMatchObject({ trips: 1, earnings: 30, incentives: 10 });
    expect(kpis(s).ngoMedicineValue).toBe(8 * 23);
  });

  it('is a sale, so the store gets no donation write-off receipt for it', () => {
    const sim = sponsorable();
    deliver(sim);
    expect(storeWriteOffs(sim.state, STORE)).toEqual([]);
  });

  it('lets the sponsor scratch the card for the extra reward', () => {
    const sim = sponsorable();
    deliver(sim);
    sim.must(CUSTOMER, { type: 'SCRATCH_CARD_REVEALED', cardId: 'sc-sp1' });
    expect(sim.state.scratchCards['sc-sp1']!.revealed).toBe(true);
  });

  it('refunds the sponsor as store credit when the pharmacist rejects the packs', () => {
    const sim = sponsorable();
    sim.must(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: plan(sim) });
    carryToNgo(sim, 'pk-sp1');
    sim.must(CHEMIST, { type: 'PICKUP_QA_REJECTED', pickupId: 'pk-sp1', note: 'Seal broken' });
    sim.must(RIDER, { type: 'PICKUP_INCINERATED', pickupId: 'pk-sp1' });
    const s = sim.state;

    expect(s.sponsorships.sp1!.status).toBe('REFUNDED');
    expect(s.wallet[CUSTOMER]).toBe(99);
    expect(s.ngoFund.balance).toBe(0);
    expect(s.karma[CUSTOMER] ?? 0).toBe(0);
    expect(s.certificates).toEqual([]);
    // The rejected packs are written off as bio-disposal.
    expect(storeWriteOffs(s, STORE)).toHaveLength(1);
    expect(storeWriteOffs(s, STORE)[0]!.certificate.reason).toBe('BIO_DISPOSAL');
  });

  it('does not refund twice or reward after a refund', () => {
    const sim = sponsorable();
    sim.must(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: plan(sim) });
    carryToNgo(sim, 'pk-sp1');
    sim.must(CHEMIST, { type: 'PICKUP_QA_REJECTED', pickupId: 'pk-sp1', note: 'Seal broken' });
    expect(sim.mustFail(CHEMIST, { type: 'PICKUP_QA_REJECTED', pickupId: 'pk-sp1', note: 'Again' })).toMatch(/Invalid/);
    expect(sim.state.wallet[CUSTOMER]).toBe(99);
  });
});

describe('sponsorship and fund selectors', () => {
  it('shows a customer their sponsorships and where each one is', () => {
    const sim = sponsorable();
    sim.must(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: plan(sim) });
    const [view] = customerSponsorships(sim.state, CUSTOMER);
    expect(view).toMatchObject({ storeName: 'Sri Ganesh Medicals', ngoName: 'Seva NGO Clinic', sponsorship: { qty: 8, status: 'PLACED' } });
    expect(view!.medicine.brand).toBe('Okacet');
    expect(view!.pickup?.status).toBe('SCHEDULED');
    expect(customerSponsorships(sim.state, 'u-ravi')).toEqual([]);
  });

  it('tells the store what it has been paid and what it is still owed', () => {
    const sim = sponsorable();
    sim.must(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: plan(sim, 'sp1') });
    expect(storeSponsorships(sim.state, STORE)).toMatchObject({ packsDelivered: 0, paidOut: 0, pending: 92 });

    carryToNgo(sim, 'pk-sp1');
    sim.must(CHEMIST, { type: 'PICKUP_QA_VERIFIED', pickupId: 'pk-sp1' });
    sim.must(RIDER, { type: 'PICKUP_DELIVERED_TO_NGO', pickupId: 'pk-sp1' });
    sim.must(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: plan(sim, 'sp2') });

    const totals = storeSponsorships(sim.state, STORE);
    expect(totals).toMatchObject({ packsDelivered: 8, paidOut: 92, pending: 92 });
    expect(totals.items.map((v) => v.sponsorship.id)).toEqual(['sp2', 'sp1']); // newest first
    expect(storeSponsorships(sim.state, 'store-carstreet').items).toEqual([]);
  });

  it('adds the fund up by where the money came from', () => {
    const sim = sponsorable();
    expect(fundSummary(sim.state)).toMatchObject({ balance: 0, fromSponsors: 0, fromPlatform: 0, packsSponsored: 0, recent: [] });
    sim.must(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: plan(sim) });
    expect(fundSummary(sim.state)).toMatchObject({ balance: 0, sponsorsPending: 1 });
    carryToNgo(sim, 'pk-sp1');
    sim.must(CHEMIST, { type: 'PICKUP_QA_VERIFIED', pickupId: 'pk-sp1' });
    sim.must(RIDER, { type: 'PICKUP_DELIVERED_TO_NGO', pickupId: 'pk-sp1' });
    expect(fundSummary(sim.state)).toMatchObject({ balance: 7, fromSponsors: 7, fromPlatform: 0, packsSponsored: 8, sponsorsPending: 0 });
  });

  it('reports the fund share of a delivered order, and zero for any other order', () => {
    const sim = sponsorable();
    sim.must(CUSTOMER, {
      type: 'ORDER_PLACED',
      order: {
        id: 'o1', customerId: CUSTOMER, storeId: STORE, status: 'PLACED', rxStatus: 'NOT_REQUIRED', deliveryOtp: '1234',
        items: [{ medicineId: 'med-okacet', batchId: 'b-okacet-1', qty: 40, unitPrice: 11.5, ecoSale: true }], total: 460, placedAt: sim.state.today,
      },
    });
    expect(orderFundShare(sim.state, 'o1')).toBe(0);
    sim.must(CHEMIST, { type: 'ORDER_PACKED', orderId: 'o1' });
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'ORDER_ACCEPTED', orderId: 'o1', riderId: RIDER });
    sim.must(RIDER, { type: 'ORDER_ARRIVED', orderId: 'o1' });
    sim.must(RIDER, { type: 'ORDER_OUT_FOR_DELIVERY', orderId: 'o1' });
    sim.must(RIDER, { type: 'ORDER_DELIVERED', orderId: 'o1', otp: '1234' });
    expect(orderFundShare(sim.state, 'o1')).toBe(0.92);
    expect(orderFundShare(sim.state, 'nope')).toBe(0);
  });

  it('steps the fund line up on the impact timeline when the NGO receives the packs', () => {
    const sim = sponsorable();
    sim.must(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: plan(sim) });
    carryToNgo(sim, 'pk-sp1');
    sim.must(CHEMIST, { type: 'PICKUP_QA_VERIFIED', pickupId: 'pk-sp1' });
    sim.must(RIDER, { type: 'PICKUP_DELIVERED_TO_NGO', pickupId: 'pk-sp1' });
    const points = impactTimeline(SEED, sim.log);
    const last = points[points.length - 1]!;
    expect(last).toMatchObject({ ngoFund: 7, ngoValue: 8 * 23 });
    expect(points[0]!.ngoFund).toBe(0);
  });
});

describe('the NGO fund share of a delivered order', () => {
  it('adds a small share of the platform fee when an order is delivered', () => {
    const sim = sponsorable();
    sim.must(CUSTOMER, {
      type: 'ORDER_PLACED',
      order: {
        id: 'o1', customerId: CUSTOMER, storeId: STORE, status: 'PLACED', rxStatus: 'NOT_REQUIRED', deliveryOtp: '1234',
        items: [{ medicineId: 'med-okacet', batchId: 'b-okacet-1', qty: 40, unitPrice: 11.5, ecoSale: true }], total: 460, placedAt: sim.state.today,
      },
    });
    expect(sim.state.ngoFund.balance).toBe(0); // nothing yet: the fund only grows on delivery
    sim.must(CHEMIST, { type: 'ORDER_PACKED', orderId: 'o1' });
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'ORDER_ACCEPTED', orderId: 'o1', riderId: RIDER });
    sim.must(RIDER, { type: 'ORDER_ARRIVED', orderId: 'o1' });
    sim.must(RIDER, { type: 'ORDER_OUT_FOR_DELIVERY', orderId: 'o1' });
    sim.must(RIDER, { type: 'ORDER_DELIVERED', orderId: 'o1', otp: '1234' });

    // 10% platform fee on 460 = 46.00, and 2% of that = 0.92.
    expect(sim.state.ngoFund.balance).toBe(0.92);
    expect(sim.state.ngoFund.entries).toEqual([expect.objectContaining({ kind: 'PLATFORM_SHARE', amount: 0.92, refId: 'o1' })]);
  });

  it('keeps the audit log replayable from the event stream', () => {
    const sim = sponsorable();
    sim.must(CUSTOMER, { type: 'SPONSORSHIP_PLACED', sponsorship: plan(sim) });
    carryToNgo(sim, 'pk-sp1');
    sim.must(CHEMIST, { type: 'PICKUP_QA_VERIFIED', pickupId: 'pk-sp1' });
    sim.must(RIDER, { type: 'PICKUP_DELIVERED_TO_NGO', pickupId: 'pk-sp1' });

    let replayed = new Sim().state;
    for (const event of sim.log) {
      const r = applyEvent(replayed, event);
      if (!r.ok) throw new Error(r.error);
      replayed = r.value;
    }
    expect(replayed).toEqual(sim.state);
  });
});
