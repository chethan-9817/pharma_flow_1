import { describe, expect, it } from 'vitest';
import {
  buildH1Entries,
  canPack,
  checkItemsSellable,
  checkRxFields,
  checkRxForOrder,
  orderNeedsRx,
  type MedicineLookup,
} from '../src/domain/rules/prescription';
import type { OrderItem, Prescription } from '../src/domain/types';

const meds: Record<string, { id: string; brand: string; schedule: 'OTC' | 'H' | 'H1' | 'X'; isAntibiotic: boolean }> = {
  dolo: { id: 'dolo', brand: 'Dolo 650', schedule: 'OTC', isAntibiotic: false },
  pand: { id: 'pand', brand: 'Pan-D', schedule: 'H', isAntibiotic: false },
  aug: { id: 'aug', brand: 'Augmentin 625 Duo', schedule: 'H', isAntibiotic: true },
  tb: { id: 'tb', brand: 'Anti-TB', schedule: 'H1', isAntibiotic: true },
  nar: { id: 'nar', brand: 'Narcotic', schedule: 'X', isAntibiotic: false },
};
const lookup: MedicineLookup = (id) => meds[id];
const today = '2026-06-10';

const item = (medicineId: string, qty = 1): OrderItem => ({ medicineId, qty, unitPrice: 10, ecoSale: false });
const rx = (over: Partial<Prescription> = {}): Prescription => ({
  id: 'rx1',
  customerId: 'c1',
  doctorName: 'Dr. Rao',
  registrationNo: 'KMC-12345',
  date: '2026-06-05',
  patientName: 'Asha',
  drugs: [
    { medicineId: 'aug', qty: 6 },
    { medicineId: 'pand', qty: 10 },
    { medicineId: 'tb', qty: 30 },
  ],
  ...over,
});

describe('which orders need a prescription', () => {
  it('OTC only: no Rx needed', () => expect(orderNeedsRx([item('dolo')], lookup)).toBe(false));
  it('Schedule H / H1: Rx needed', () => {
    expect(orderNeedsRx([item('dolo'), item('aug')], lookup)).toBe(true);
    expect(orderNeedsRx([item('tb')], lookup)).toBe(true);
  });
  it('Schedule X is blocked outright', () => {
    expect(checkItemsSellable([item('nar')], lookup).ok).toBe(false);
    expect(checkItemsSellable([item('dolo')], lookup).ok).toBe(true);
  });
});

describe('prescription fields', () => {
  it('requires doctor, registration no, patient, date and a drug', () => {
    expect(checkRxFields(rx()).ok).toBe(true);
    expect(checkRxFields(rx({ doctorName: ' ' })).ok).toBe(false);
    expect(checkRxFields(rx({ registrationNo: '' })).ok).toBe(false);
    expect(checkRxFields(rx({ patientName: '' })).ok).toBe(false);
    expect(checkRxFields(rx({ date: '' })).ok).toBe(false);
    expect(checkRxFields(rx({ drugs: [] })).ok).toBe(false);
  });
});

describe('prescription vs order', () => {
  it('passes for a listed drug within quantity and validity', () => {
    expect(checkRxForOrder(rx(), 'o1', [item('aug', 6)], lookup, today).ok).toBe(true);
  });
  it('fails when the drug is not listed', () => {
    const r = rx({ drugs: [{ medicineId: 'pand', qty: 5 }] });
    expect(checkRxForOrder(r, 'o1', [item('aug')], lookup, today).ok).toBe(false);
  });
  it('fails when quantity exceeds the prescription', () => {
    expect(checkRxForOrder(rx(), 'o1', [item('aug', 7)], lookup, today).ok).toBe(false);
  });
  it('antibiotic Rx is valid for 30 days, other drugs for 180', () => {
    const old = rx({ date: '2026-05-01' }); // 40 days old
    expect(checkRxForOrder(old, 'o1', [item('aug')], lookup, today).ok).toBe(false);
    expect(checkRxForOrder(old, 'o1', [item('pand')], lookup, today).ok).toBe(true);
    expect(checkRxForOrder(rx({ date: '2025-11-01' }), 'o1', [item('pand')], lookup, today).ok).toBe(false);
  });
  it('rejects a future-dated prescription', () => {
    expect(checkRxForOrder(rx({ date: '2026-06-20' }), 'o1', [item('pand')], lookup, today).ok).toBe(false);
  });
  it('antibiotic prescriptions are single-use', () => {
    const used = rx({ usedByOrderId: 'other' });
    expect(checkRxForOrder(used, 'o2', [item('aug')], lookup, today).ok).toBe(false);
    expect(checkRxForOrder(used, 'other', [item('aug')], lookup, today).ok).toBe(true);
    // a non-antibiotic Rx may be reused
    expect(checkRxForOrder(used, 'o2', [item('pand')], lookup, today).ok).toBe(true);
  });
  it('Eco-Sale items still need the Rx (no bypass)', () => {
    const eco: OrderItem = { ...item('aug'), ecoSale: true };
    expect(orderNeedsRx([eco], lookup)).toBe(true);
  });
});

describe('packing gate', () => {
  it('blocks PACKED until the Rx is approved', () => {
    expect(canPack(true, 'PENDING').ok).toBe(false);
    expect(canPack(true, 'REJECTED').ok).toBe(false);
    expect(canPack(true, 'APPROVED').ok).toBe(true);
    expect(canPack(false, 'NOT_REQUIRED').ok).toBe(true);
  });
});

describe('H1 register', () => {
  it('logs only H1 lines and retains them for 3 years', () => {
    const entries = buildH1Entries('o1', rx(), [item('tb', 10), item('pand')], lookup, today);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ medicineId: 'tb', qty: 10, patientName: 'Asha', doctorRegNo: 'KMC-12345' });
    expect(entries[0]!.retainUntil).toBe('2029-06-09');
  });
});
