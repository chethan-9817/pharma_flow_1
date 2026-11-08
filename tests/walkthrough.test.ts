import { describe, expect, it } from 'vitest';
import { appendEntry, verifyChain, type LedgerEntry } from '../src/domain/ledger';
import { ecoPrice } from '../src/domain/rules/ecoSale';
import { expiryBucket } from '../src/domain/rules/expiry';
import { parseGs1 } from '../src/domain/rules/gs1';
import type { Batch, Order, Prescription } from '../src/domain/types';
import { BARCODE_PRESETS } from '../src/seed/barcodes';
import { ADMIN, CHEMIST, CUSTOMER, RIDER, STORE, Sim } from './helpers';

/** Headless run of the README "Demo Walkthrough", steps 1-9. */
describe('demo walkthrough', () => {
  it('runs end to end and keeps the ledger intact', async () => {
    const sim = new Sim();
    const med = (id: string) => sim.state.medicines[id]!;

    // 1. Chemist scans Dolo 650 and Augmentin -> SAFE / sellable
    const scan = (preset: number, id: string, qty: number): Batch => {
      const parsed = parseGs1(BARCODE_PRESETS[preset]!.code);
      if (!parsed.ok) throw new Error(parsed.error);
      const medicine = Object.values(sim.state.medicines).find((m) => m.gtin === parsed.value.gtin)!;
      const batch: Batch = {
        id,
        storeId: STORE,
        medicineId: medicine.id,
        batchNo: parsed.value.batch!,
        expiry: parsed.value.expiry!,
        qty,
        status: 'IN_STOCK',
      };
      sim.must(CHEMIST, { type: 'STOCK_INGESTED', batch });
      return batch;
    };
    const dolo = scan(0, 'b-dolo-demo', 100);
    const augmentin = scan(1, 'b-aug-demo', 20);
    expect(expiryBucket(dolo.expiry, sim.state.today)).toBe('SAFE');

    // 2. Presenter time-travels +5 months -> LOCKOUT
    sim.must(ADMIN, { type: 'TIME_TRAVELLED', to: '2027-04-07' });
    expect(expiryBucket(dolo.expiry, sim.state.today)).toBe('LOCKOUT');

    // 3. Chemist puts Dolo on Eco-Sale at 50%
    sim.must(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: dolo.id, discountPct: 50 });
    expect(sim.state.batches[dolo.id]!.status).toBe('ECO_SALE');

    // 4. Customer adds Eco-Sale Dolo + Augmentin; checkout needs a prescription
    const ecoUnit = ecoPrice(med('med-dolo650').mrp, 50);
    const items = [
      { medicineId: 'med-dolo650', batchId: dolo.id, qty: 2, unitPrice: ecoUnit, ecoSale: true },
      { medicineId: 'med-augmentin', batchId: augmentin.id, qty: 6, unitPrice: med('med-augmentin').mrp, ecoSale: false },
    ];
    const total = 2 * ecoUnit + 6 * med('med-augmentin').mrp;
    const order: Order = {
      id: 'o1',
      customerId: CUSTOMER,
      storeId: STORE,
      items,
      status: 'PLACED',
      rxStatus: 'PENDING',
      prescriptionId: 'rx1',
      deliveryOtp: '4821',
      total,
      placedAt: sim.state.today,
    };
    expect(sim.mustFail(CUSTOMER, { type: 'ORDER_PLACED', order: { ...order, prescriptionId: undefined } })).toMatch(/prescription is required/i);

    const rx: Prescription = {
      id: 'rx1',
      customerId: CUSTOMER,
      doctorName: 'Dr. Meera Rao',
      registrationNo: 'KMC-48213',
      date: '2027-04-05',
      patientName: 'Asha Shetty',
      drugs: [{ medicineId: 'med-augmentin', qty: 6 }],
    };
    sim.must(CUSTOMER, { type: 'ORDER_PLACED', order, prescription: rx });
    expect(sim.state.orders.o1!.status).toBe('PLACED');
    expect(sim.state.batches[dolo.id]!.qty).toBe(98);

    // 5. Chemist cannot pack before approval, then approves and packs
    expect(sim.mustFail(CHEMIST, { type: 'ORDER_PACKED', orderId: 'o1' })).toMatch(/RX_APPROVED|prescription/i);
    sim.must(CHEMIST, { type: 'RX_APPROVED', orderId: 'o1' });
    sim.must(CHEMIST, { type: 'ORDER_PACKED', orderId: 'o1' });
    expect(sim.state.orders.o1!.status).toBe('PACKED');

    // 6. Rider: accept -> arrived -> collected -> delivered with OTP
    sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    sim.must(RIDER, { type: 'ORDER_ACCEPTED', orderId: 'o1', riderId: RIDER });
    sim.must(RIDER, { type: 'ORDER_ARRIVED', orderId: 'o1' });
    sim.must(RIDER, { type: 'ORDER_OUT_FOR_DELIVERY', orderId: 'o1' });
    expect(sim.mustFail(RIDER, { type: 'ORDER_DELIVERED', orderId: 'o1', otp: '0000' })).toMatch(/OTP/);
    sim.must(RIDER, { type: 'ORDER_DELIVERED', orderId: 'o1', otp: '4821' });
    expect(sim.state.orders.o1!.status).toBe('DELIVERED');
    expect(sim.state.riders[RIDER]).toMatchObject({ trips: 1, earnings: 40 });

    // 7. Customer receives a scratch card and scratches it
    const card = sim.state.scratchCards['sc-o1']!;
    expect(card.revealed).toBe(false);
    sim.must(CUSTOMER, { type: 'SCRATCH_CARD_REVEALED', cardId: card.id });
    expect(sim.state.karma[CUSTOMER] ?? 0).toBe(card.rewardKarma);
    expect(sim.state.wallet[CUSTOMER] ?? 0).toBe(card.rewardCredit);

    // 8. Customer donates leftovers -> rider collects -> chemist QA -> NGO -> certificate
    const karmaBefore = sim.state.karma[CUSTOMER] ?? 0;
    sim.must(CUSTOMER, {
      type: 'PICKUP_SCHEDULED',
      pickup: {
        id: 'p1',
        kind: 'DONATION',
        sourceUserId: CUSTOMER,
        qaStoreId: STORE,
        ngoId: 'ngo-seva',
        items: [{ medicineId: 'med-dolo650', batchNo: 'DL27A01', expiry: '2027-08-31', qty: 1, sealed: true, openedLiquid: false }],
        status: 'SCHEDULED',
        address: '12, Kadri Hills, Mangaluru',
        lat: 12.883,
        lng: 74.856,
        scheduledAt: sim.state.today,
      },
    });
    sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'p1', riderId: RIDER });
    sim.must(RIDER, { type: 'PICKUP_ARRIVED', pickupId: 'p1' });
    sim.must(RIDER, { type: 'PICKUP_COLLECTED', pickupId: 'p1' });
    expect(sim.mustFail(RIDER, { type: 'PICKUP_DELIVERED_TO_NGO', pickupId: 'p1' })).toMatch(/Invalid/);
    sim.must(CHEMIST, { type: 'PICKUP_QA_VERIFIED', pickupId: 'p1' });
    sim.must(RIDER, { type: 'PICKUP_DELIVERED_TO_NGO', pickupId: 'p1' });
    expect(sim.state.karma[CUSTOMER]).toBe(karmaBefore + 200);
    expect(sim.state.scratchCards['sc-p1']).toBeTruthy();
    expect(sim.state.certificates.find((c) => c.kind === 'NGO_DONOR')).toMatchObject({ userId: CUSTOMER, refId: 'p1' });

    // 9. Admin verifies the ledger
    const chain: LedgerEntry[] = [];
    for (const event of sim.log) chain.push(await appendEntry(chain, event));
    expect(await verifyChain(chain)).toEqual({ ok: true, length: sim.log.length });
    chain[3] = { ...chain[3]!, event: { ...(chain[3]!.event as object), actorId: 'someone-else' } };
    expect((await verifyChain(chain)).ok).toBe(false);
  });
});
