import { describe, expect, it } from 'vitest';
import { addDays } from '../src/domain/clock';
import { bulkBatchId, bulkSummary, storeShare, tenderView } from '../src/domain/bulk';
import { networkSummary, storeRows } from '../src/domain/network';
import { defaultTargetPrice, effectivePrice, negotiate, usualTradePrice } from '../src/domain/rules/bulk';
import { ADMIN, CHEMIST, CUSTOMER, STORE, Sim } from './helpers';

const SYRINGE = 'prd-dispovan'; // MRP 60
const T = 'bt-1';
const SURATHKAL = { user: 'u-chemist-surathkal', store: 'store-surathkal' };
const ULLAL = { user: 'u-chemist-ullal', store: 'store-ullal' };
const COASTAL = { user: 'u-dealer-coastal', dealer: 'dealer-coastal' };
const MALNAD = { user: 'u-dealer-malnad', dealer: 'dealer-malnad' };
const UDUPI = { user: 'u-dealer-udupi', dealer: 'dealer-udupi' };

const demand = (storeId: string, qty: number, tenderId = T) =>
  ({ type: 'BULK_DEMAND_POSTED', tenderId, storeId, medicineId: SYRINGE, qty }) as const;
const quote = (d: { dealer: string }, askPrice: number, floorPrice: number, deliveryDays: number) =>
  ({ type: 'BULK_QUOTE_SUBMITTED', tenderId: T, quote: { id: `q-${d.dealer}`, dealerId: d.dealer, askPrice, floorPrice, deliveryDays } }) as const;

/** Three stores pool 450 packs of syringes and the admin opens the tender at target 39, ceiling 48. */
function pooled(): Sim {
  const sim = new Sim();
  sim.must(CHEMIST, demand(STORE, 150));
  sim.must(SURATHKAL.user, demand(SURATHKAL.store, 200));
  sim.must(ULLAL.user, demand(ULLAL.store, 100));
  sim.must(ADMIN, { type: 'BULK_TENDER_OPENED', tenderId: T, targetPrice: 39, ceilingPrice: 48 });
  return sim;
}

describe('negotiation agents', () => {
  it('uses 80% of the MRP as the usual trade price and 65% as the default target', () => {
    expect(usualTradePrice(60)).toBe(48);
    expect(defaultTargetPrice(60)).toBe(39);
  });

  it('closes in the first round when the dealer is already at the target', () => {
    const r = negotiate(39, 48, { askPrice: 40, floorPrice: 36 });
    expect(r).toEqual({ rounds: [{ round: 1, buyerOffer: 39, dealerOffer: 38.4 }], finalPrice: 38.4, agreed: true });
  });

  it('meets in a later round: the buyer moves up while the dealer moves down', () => {
    const r = negotiate(39, 48, { askPrice: 50, floorPrice: 42 });
    expect(r.rounds).toEqual([
      { round: 1, buyerOffer: 39, dealerOffer: 46.8 },
      { round: 2, buyerOffer: 43.5, dealerOffer: 44 },
      { round: 3, buyerOffer: 48, dealerOffer: 42 },
    ]);
    expect(r).toMatchObject({ agreed: true, finalPrice: 42 });
  });

  it('ends without a deal when the dealer floor is above the ceiling', () => {
    const r = negotiate(39, 48, { askPrice: 58, floorPrice: 52 });
    expect(r).toMatchObject({ agreed: false, finalPrice: 52 });
    expect(r.rounds).toHaveLength(3);
  });

  it('never lets the dealer go below its floor or the buyer above the ceiling', () => {
    for (const [ask, floor] of [[60, 30], [45, 45], [59, 47.5]] as const) {
      const r = negotiate(39, 48, { askPrice: ask, floorPrice: floor });
      for (const round of r.rounds) {
        expect(round.dealerOffer).toBeGreaterThanOrEqual(floor);
        expect(round.buyerOffer).toBeLessThanOrEqual(48);
      }
    }
  });

  it('ranks by effective price: slow delivery and a low rating cost extra', () => {
    expect(effectivePrice(40, 2, 5)).toBe(40.4);
    expect(effectivePrice(40, 10, 5)).toBe(42);
    expect(effectivePrice(40, 2, 4)).toBeGreaterThan(effectivePrice(40, 2, 5));
  });
});

describe('pooling demand', () => {
  it('starts a pool with the first store and lets others join it', () => {
    const sim = new Sim();
    sim.must(CHEMIST, demand(STORE, 150));
    sim.must(SURATHKAL.user, demand(SURATHKAL.store, 200));
    const view = tenderView(sim.state, sim.state.bulkTenders[T]!);
    expect(view.qty).toBe(350);
    expect(view.stores.map((x) => x.store.id)).toEqual([STORE, SURATHKAL.store]);
    expect(view.usualCost).toBe(350 * 48);
  });

  it('replaces the quantity of a store that asks again', () => {
    const sim = new Sim();
    sim.must(CHEMIST, demand(STORE, 150));
    sim.must(CHEMIST, demand(STORE, 120));
    expect(sim.state.bulkTenders[T]!.demands).toEqual([{ storeId: STORE, qty: 120, postedAt: sim.state.today }]);
  });

  it('keeps one open pool per item', () => {
    const sim = new Sim();
    sim.must(CHEMIST, demand(STORE, 150));
    expect(sim.mustFail(SURATHKAL.user, demand(SURATHKAL.store, 100, 'bt-2'))).toMatch(/already pooling/);
  });

  it('rejects other people, other stores, unapproved stores and silly quantities', () => {
    const sim = new Sim();
    expect(sim.mustFail(CUSTOMER, demand(STORE, 100))).toMatch(/Only a chemist/);
    expect(sim.mustFail(CHEMIST, demand(SURATHKAL.store, 100))).toMatch(/different store/);
    expect(sim.mustFail('u-chemist-carstreet', demand('store-carstreet', 100))).toMatch(/not KYC approved/);
    expect(sim.mustFail(CHEMIST, demand(STORE, 5))).toMatch(/at least 10/);
    expect(sim.mustFail(CHEMIST, demand(STORE, 10.5))).toMatch(/whole number/);
  });

  it('needs two stores and sane prices before dealers are asked', () => {
    const sim = new Sim();
    sim.must(CHEMIST, demand(STORE, 150));
    const open = (targetPrice: number, ceilingPrice: number) => ({ type: 'BULK_TENDER_OPENED', tenderId: T, targetPrice, ceilingPrice }) as const;
    expect(sim.mustFail(ADMIN, open(39, 48))).toMatch(/at least 2 stores/);
    sim.must(SURATHKAL.user, demand(SURATHKAL.store, 200));
    expect(sim.mustFail(CHEMIST, open(39, 48))).toMatch(/Only a admin/);
    expect(sim.mustFail(ADMIN, open(50, 48))).toMatch(/below the target/);
    expect(sim.mustFail(ADMIN, open(39, 61))).toMatch(/above the MRP/);
    sim.must(ADMIN, open(39, 48));
    expect(sim.mustFail(ULLAL.user, demand(ULLAL.store, 100))).toMatch(/closed to new requests/);
  });
});

describe('quotes, negotiation and award', () => {
  it('takes one quote per dealer and checks its terms', () => {
    const sim = pooled();
    expect(sim.mustFail(CHEMIST, quote(COASTAL, 50, 42, 2))).toMatch(/Only a dealer/);
    expect(sim.mustFail(COASTAL.user, quote(MALNAD, 50, 42, 2))).toMatch(/your own company/);
    expect(sim.mustFail(COASTAL.user, quote(COASTAL, 40, 42, 2))).toMatch(/below your lowest/);
    expect(sim.mustFail(COASTAL.user, quote(COASTAL, 70, 42, 2))).toMatch(/above the MRP/);
    expect(sim.mustFail(COASTAL.user, quote(COASTAL, 50, 42, 45))).toMatch(/within 30 days/);
    sim.must(COASTAL.user, quote(COASTAL, 52, 44, 2));
    sim.must(COASTAL.user, quote(COASTAL, 50, 42, 2));
    expect(sim.state.bulkTenders[T]!.quotes).toHaveLength(1);
    expect(sim.state.bulkTenders[T]!.quotes[0]).toMatchObject({ askPrice: 50, floorPrice: 42 });
  });

  it('negotiates with every dealer and recommends the best effective price', () => {
    const sim = pooled();
    expect(sim.mustFail(ADMIN, { type: 'BULK_NEGOTIATED', tenderId: T })).toMatch(/No dealer has quoted/);
    sim.must(COASTAL.user, quote(COASTAL, 50, 42, 2)); // agrees at 42 in round 3
    sim.must(MALNAD.user, quote(MALNAD, 45, 40, 12)); // agrees at 41.25, but slow and lower rated
    sim.must(UDUPI.user, quote(UDUPI, 58, 52, 3)); // floor above the ceiling: no deal
    sim.must(ADMIN, { type: 'BULK_NEGOTIATED', tenderId: T });
    const tender = sim.state.bulkTenders[T]!;
    expect(tender.status).toBe('NEGOTIATED');
    const by = Object.fromEntries(tender.negotiation!.map((n) => [n.dealerId, n]));
    expect(by[COASTAL.dealer]).toMatchObject({ agreed: true, finalPrice: 42 });
    expect(by[MALNAD.dealer]).toMatchObject({ agreed: true, finalPrice: 41.25 });
    expect(by[UDUPI.dealer]).toMatchObject({ agreed: false, finalPrice: 52 });
    // Malnad is cheaper per pack, but Coastal wins once delivery time and rating are counted.
    expect(by[COASTAL.dealer]!.effectivePrice).toBeLessThan(by[MALNAD.dealer]!.effectivePrice);
    expect(tender.recommendedQuoteId).toBe('q-dealer-coastal');
    expect(sim.mustFail(COASTAL.user, quote(COASTAL, 45, 40, 2))).toMatch(/not open for quotes/);
  });

  it('awards only an agreed offer, and the admin may pick a dealer other than the recommended one', () => {
    const sim = pooled();
    sim.must(COASTAL.user, quote(COASTAL, 50, 42, 2));
    sim.must(MALNAD.user, quote(MALNAD, 45, 40, 12));
    sim.must(UDUPI.user, quote(UDUPI, 58, 52, 3));
    expect(sim.mustFail(ADMIN, { type: 'BULK_AWARDED', tenderId: T, quoteId: 'q-dealer-coastal' })).toMatch(/Run the negotiation/);
    sim.must(ADMIN, { type: 'BULK_NEGOTIATED', tenderId: T });
    expect(sim.mustFail(ADMIN, { type: 'BULK_AWARDED', tenderId: T, quoteId: 'q-dealer-udupi' })).toMatch(/did not come down/);
    expect(sim.mustFail(CHEMIST, { type: 'BULK_AWARDED', tenderId: T, quoteId: 'q-dealer-coastal' })).toMatch(/Only a admin/);
    sim.must(ADMIN, { type: 'BULK_AWARDED', tenderId: T, quoteId: 'q-dealer-malnad' });
    const view = tenderView(sim.state, sim.state.bulkTenders[T]!);
    expect(view.tender).toMatchObject({ status: 'AWARDED', finalPrice: 41.25 });
    expect(view.awardedDealer?.id).toBe(MALNAD.dealer);
    expect(view.finalCost).toBe(450 * 41.25);
    expect(view.savings).toBe(450 * (48 - 41.25));
  });

  it('leaves no recommendation when nobody reaches the ceiling, and can be cancelled', () => {
    const sim = pooled();
    sim.must(UDUPI.user, quote(UDUPI, 58, 52, 3));
    sim.must(ADMIN, { type: 'BULK_NEGOTIATED', tenderId: T });
    expect(sim.state.bulkTenders[T]!.recommendedQuoteId).toBeUndefined();
    sim.must(ADMIN, { type: 'BULK_CANCELLED', tenderId: T });
    expect(sim.state.bulkTenders[T]!.status).toBe('CANCELLED');
    // The item can be pooled again afterwards.
    sim.must(CHEMIST, demand(STORE, 100, 'bt-2'));
  });
});

describe('delivery', () => {
  function awarded(): Sim {
    const sim = pooled();
    sim.must(COASTAL.user, quote(COASTAL, 50, 42, 2));
    sim.must(MALNAD.user, quote(MALNAD, 45, 40, 12));
    sim.must(ADMIN, { type: 'BULK_NEGOTIATED', tenderId: T });
    sim.must(ADMIN, { type: 'BULK_AWARDED', tenderId: T, quoteId: 'q-dealer-coastal' });
    return sim;
  }

  it('lets only the winning dealer deliver, with enough shelf life', () => {
    const sim = awarded();
    const deliver = (days: number, batchNo = 'DV30A01') => ({ type: 'BULK_DELIVERED', tenderId: T, batchNo, expiry: addDays(sim.state.today, days) }) as const;
    expect(sim.mustFail(MALNAD.user, deliver(700))).toMatch(/Only the dealer that won/);
    expect(sim.mustFail(COASTAL.user, deliver(90))).toMatch(/at least 180 days/);
    expect(sim.mustFail(COASTAL.user, deliver(700, '  '))).toMatch(/batch number/);
    expect(sim.mustFail(ADMIN, { type: 'BULK_CANCELLED', tenderId: T })).toMatch(/no longer be cancelled/);
    sim.must(COASTAL.user, deliver(700));
    expect(sim.mustFail(COASTAL.user, deliver(700))).toMatch(/not waiting for delivery/);
  });

  it('puts the share of each store on its shelf as a fresh batch', () => {
    const sim = awarded();
    sim.must(COASTAL.user, { type: 'BULK_DELIVERED', tenderId: T, batchNo: 'DV30A01', expiry: addDays(sim.state.today, 700) });
    for (const [store, qty] of [[STORE, 150], [SURATHKAL.store, 200], [ULLAL.store, 100]] as const) {
      expect(sim.state.batches[bulkBatchId(T, store)]).toMatchObject({ storeId: store, medicineId: SYRINGE, qty, status: 'IN_STOCK', batchNo: 'DV30A01' });
    }
    expect(bulkSummary(sim.state)).toMatchObject({ open: 0, delivered: 1, packsDelivered: 450, savings: 450 * (48 - 42) });
  });
});

describe('payments: PharmaFlow pays the dealer, the stores pay PharmaFlow', () => {
  function delivered(): Sim {
    const sim = pooled();
    sim.must(COASTAL.user, quote(COASTAL, 50, 42, 2));
    sim.must(ADMIN, { type: 'BULK_NEGOTIATED', tenderId: T });
    sim.must(ADMIN, { type: 'BULK_AWARDED', tenderId: T, quoteId: 'q-dealer-coastal' });
    return sim;
  }
  const deliver = (sim: Sim) => sim.must(COASTAL.user, { type: 'BULK_DELIVERED', tenderId: T, batchNo: 'DV30A01', expiry: addDays(sim.state.today, 700) });

  it('pays nobody before delivery', () => {
    const sim = delivered();
    expect(sim.mustFail(ADMIN, { type: 'BULK_DEALER_PAID', tenderId: T })).toMatch(/after the order is delivered/);
    expect(sim.mustFail(CHEMIST, { type: 'BULK_STORE_PAID', tenderId: T, storeId: STORE })).toMatch(/once the stock is delivered/);
  });

  it('lets only the admin pay the dealer, once, for the whole order', () => {
    const sim = delivered();
    deliver(sim);
    expect(bulkSummary(sim.state)).toMatchObject({ paidToDealers: 0, owedToDealers: 450 * 42 });
    expect(sim.mustFail(CHEMIST, { type: 'BULK_DEALER_PAID', tenderId: T })).toMatch(/Only a admin/);
    expect(sim.mustFail(COASTAL.user, { type: 'BULK_DEALER_PAID', tenderId: T })).toMatch(/Only a admin/);
    sim.must(ADMIN, { type: 'BULK_DEALER_PAID', tenderId: T });
    expect(sim.mustFail(ADMIN, { type: 'BULK_DEALER_PAID', tenderId: T })).toMatch(/already been paid/);
    expect(tenderView(sim.state, sim.state.bulkTenders[T]!).dealerPaid).toBe(true);
    expect(bulkSummary(sim.state)).toMatchObject({ paidToDealers: 450 * 42, owedToDealers: 0 });
  });

  it('collects each store’s share at the agreed price, only from that store, once', () => {
    const sim = delivered();
    deliver(sim);
    const tender = () => sim.state.bulkTenders[T]!;
    expect(storeShare(tender(), STORE)).toBe(150 * 42);
    expect(bulkSummary(sim.state)).toMatchObject({ receivedFromStores: 0, owedByStores: 450 * 42 });
    expect(sim.mustFail(SURATHKAL.user, { type: 'BULK_STORE_PAID', tenderId: T, storeId: STORE })).toMatch(/different store/);
    expect(sim.mustFail('u-chemist-jeppu', { type: 'BULK_STORE_PAID', tenderId: T, storeId: 'store-jeppu' })).toMatch(/not part of this bulk order/);
    sim.must(CHEMIST, { type: 'BULK_STORE_PAID', tenderId: T, storeId: STORE });
    expect(sim.mustFail(CHEMIST, { type: 'BULK_STORE_PAID', tenderId: T, storeId: STORE })).toMatch(/already paid/);
    const view = tenderView(sim.state, tender());
    expect(view.stores.find((x) => x.store.id === STORE)).toMatchObject({ amount: 150 * 42, paid: true });
    expect(view).toMatchObject({ collected: 150 * 42, outstanding: 300 * 42 });
    sim.must(SURATHKAL.user, { type: 'BULK_STORE_PAID', tenderId: T, storeId: SURATHKAL.store });
    sim.must(ULLAL.user, { type: 'BULK_STORE_PAID', tenderId: T, storeId: ULLAL.store });
    expect(bulkSummary(sim.state)).toMatchObject({ receivedFromStores: 450 * 42, owedByStores: 0 });
  });
});

describe('network overview for the admin', () => {
  it('counts stores, people and orders', () => {
    const sim = new Sim();
    expect(networkSummary(sim.state)).toMatchObject({
      stores: 7, storesApproved: 6, storesPending: 1, customers: 6, riders: 3, ridersOnline: 0, dealers: 3, orders: 0, assignedOrders: 0,
    });
  });

  it('lists every store with its chemist and stock', () => {
    const rows = storeRows(new Sim().state);
    expect(rows).toHaveLength(7);
    const ganesh = rows.find((r) => r.store.id === STORE)!;
    expect(ganesh.chemist?.name).toBe('Ganesh Prabhu');
    expect(ganesh.units).toBeGreaterThan(3000);
    expect(rows.find((r) => r.store.id === 'store-carstreet')!.units).toBe(0);
  });
});
