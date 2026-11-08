import { describe, expect, it } from 'vitest';
import { nearestStoreId, planOrder, quoteCart, stockFor } from '../src/domain/checkout';
import { genericOffer } from '../src/domain/rules/generic';
import { ADMIN, CHEMIST, CUSTOMER, STORE, Sim } from './helpers';

const base = { customerId: CUSTOMER, storeId: STORE, walletToUse: 0, orderId: 'o1', otp: '1234' };

describe('generic offer', () => {
  it('shows the Pan-D example: Rs 190 -> Rs 68, save Rs 122, with the honest label', () => {
    const sim = new Sim();
    const offer = genericOffer(sim.state.medicines['med-pand']!)!;
    expect(offer).toMatchObject({ price: 68, saving: 122, savingPct: 64, label: 'Same salt, same strength' });
  });
  it('offers nothing when no cheaper generic exists', () => {
    const sim = new Sim();
    expect(genericOffer(sim.state.medicines['med-electral']!)).toBeNull();
  });
});

describe('quoteCart', () => {
  it('prices regular lines at MRP from the earliest-expiring batch', () => {
    const sim = new Sim();
    const q = quoteCart(sim.state, STORE, [{ medicineId: 'med-dolo650', qty: 2 }]);
    expect(q).toMatchObject({ ok: true, value: { subtotal: 62, ecoSavings: 0, needsRx: false } });
  });

  it('splits a line across batches in expiry order when one batch is not enough', () => {
    const sim = new Sim();
    sim.must(CHEMIST, { type: 'STOCK_INGESTED', batch: { id: 'b2', storeId: STORE, medicineId: 'med-limcee', batchNo: 'X', expiry: '2027-12-01', qty: 50, status: 'IN_STOCK' } });
    const q = quoteCart(sim.state, STORE, [{ medicineId: 'med-limcee', qty: 40 }]);
    expect(q.ok && q.value.items.map((i) => [i.batchId, i.qty])).toEqual([['b-limcee-1', 25], ['b2', 15]]);
  });

  it('flags prescription drugs and Eco-Sale savings', () => {
    const sim = new Sim();
    sim.must(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
    const q = quoteCart(sim.state, STORE, [
      { medicineId: 'med-okacet', qty: 2, batchId: 'b-okacet-1' },
      { medicineId: 'med-augmentin', qty: 5 },
    ]);
    expect(q.ok && q.value).toMatchObject({ needsRx: true, ecoSavings: 23, subtotal: 23 + 1020 });
  });

  it('fails clearly when stock is short, the cart is empty or the deal vanished', () => {
    const sim = new Sim();
    expect(quoteCart(sim.state, STORE, [{ medicineId: 'med-dolo650', qty: 500 }])).toMatchObject({ ok: false, error: expect.stringMatching(/Only 120/) });
    expect(quoteCart(sim.state, STORE, [])).toMatchObject({ ok: false });
    expect(quoteCart(sim.state, STORE, [{ medicineId: 'med-okacet', qty: 1, batchId: 'nope' }])).toMatchObject({ ok: false });
  });

  it('never sells expired batches', () => {
    const sim = new Sim();
    expect(stockFor(sim.state, STORE, 'med-becosules')).toBe(0);
  });
});

describe('planOrder', () => {
  it('builds an order the reducer accepts, using wallet credit up to the balance', async () => {
    const sim = new Sim();
    sim.state = { ...sim.state, wallet: { [CUSTOMER]: 20 } };
    const plan = planOrder(sim.state, { ...base, lines: [{ medicineId: 'med-dolo650', qty: 1 }], walletToUse: 50 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.order).toMatchObject({ rxStatus: 'NOT_REQUIRED', walletUsed: 20, total: 31 });
    sim.must(CUSTOMER, { type: 'ORDER_PLACED', order: plan.value.order });
    expect(sim.state.wallet[CUSTOMER]).toBe(0);
  });

  it('requires a prescription id for Rx carts and marks the order PENDING', () => {
    const sim = new Sim();
    const lines = [{ medicineId: 'med-augmentin', qty: 5 }];
    expect(planOrder(sim.state, { ...base, lines })).toMatchObject({ ok: false, error: expect.stringMatching(/prescription/i) });
    const plan = planOrder(sim.state, { ...base, lines, prescriptionId: 'rx1' });
    expect(plan.ok && plan.value.order).toMatchObject({ rxStatus: 'PENDING', prescriptionId: 'rx1' });
  });

  it('blocks Eco-Sale from skipping the gate: an Eco-Sale Rx drug still needs a prescription', () => {
    const sim = new Sim();
    sim.must(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-augmentin-1', discountPct: 40 });
    const lines = [{ medicineId: 'med-augmentin', qty: 2, batchId: 'b-augmentin-1' }];
    expect(planOrder(sim.state, { ...base, lines })).toMatchObject({ ok: false });
  });
});

describe('nearestStoreId', () => {
  it('only offers KYC-approved stores', () => {
    const sim = new Sim();
    expect(nearestStoreId(sim.state, CUSTOMER)).toBe(STORE);
    sim.must(ADMIN, { type: 'KYC_DECIDED', storeId: 'store-carstreet', decision: 'APPROVED' });
    expect(['store-ganesh', 'store-carstreet']).toContain(nearestStoreId(sim.state, CUSTOMER));
  });
});
