import { describe, expect, it } from 'vitest';
import { daysLeft } from '../src/domain/clock';
import { parseGs1 } from '../src/domain/rules/gs1';
import { expiryBucket } from '../src/domain/rules/expiry';
import { BARCODE_PRESETS } from '../src/seed/barcodes';
import { SEED } from '../src/seed';
import { CATEGORIES, categoryOf } from '../src/domain/types';

describe('seed data', () => {
  it('has a 46-item catalog with unique GTINs and ids', () => {
    expect(SEED.medicines).toHaveLength(46);
    expect(new Set(SEED.medicines.map((m) => m.gtin)).size).toBe(46);
    expect(new Set(SEED.medicines.map((m) => m.id)).size).toBe(46);
  });

  it('stocks every shop aisle, and nothing outside Medicines needs a prescription', () => {
    const byCategory = new Map(CATEGORIES.map((c) => [c, SEED.medicines.filter((m) => categoryOf(m) === c)]));
    for (const [category, items] of byCategory) expect(items.length, category).toBeGreaterThan(0);
    // 30 drug entries, minus the Accu-Chek test strips, which sit with first aid and devices.
    expect(byCategory.get('MEDICINE')!.length).toBe(29);
    const products = SEED.medicines.filter((m) => categoryOf(m) !== 'MEDICINE');
    expect(products.every((m) => m.schedule === 'OTC' && !m.isAntibiotic)).toBe(true);
  });

  it('stocks every medicine with a fresh batch, so the shop never shows it out of stock', () => {
    for (const m of SEED.medicines) {
      const fresh = SEED.batches.filter((b) => b.medicineId === m.id && daysLeft(b.expiry, SEED.today) > 365);
      expect(fresh.length, m.brand).toBeGreaterThan(0);
    }
  });

  it('keeps most stock safe: only one expired batch to begin with', () => {
    const buckets = SEED.batches.map((b) => expiryBucket(b.expiry, SEED.today));
    expect(buckets.filter((b) => b === 'EXPIRED')).toHaveLength(1);
    expect(buckets.filter((b) => b === 'SAFE').length).toBeGreaterThan(SEED.batches.length / 2);
  });

  it('classifies drugs as the README describes', () => {
    const sched = Object.fromEntries(SEED.medicines.map((m) => [m.brand, m.schedule]));
    expect(sched['Pan-D']).toBe('H');
    expect(sched['Augmentin 625 Duo']).toBe('H');
    expect(sched['Azithral 500']).toBe('H');
    expect(sched['Dolo 650']).toBe('OTC');
    expect(SEED.medicines.some((m) => m.schedule === 'X')).toBe(false);
  });

  it('offers the Pan-D generic example: Rs 190 -> Rs 68', () => {
    const pand = SEED.medicines.find((m) => m.id === 'med-pand')!;
    expect(pand.mrp - pand.generic!.price).toBe(122);
  });

  it('covers every expiry bucket and one 38-day Okacet batch', () => {
    const buckets = new Set(SEED.batches.map((b) => expiryBucket(b.expiry, SEED.today)));
    expect(buckets).toEqual(new Set(['SAFE', 'LOCKOUT', 'CRITICAL', 'EXPIRED']));
    const okacet = SEED.batches.find((b) => b.id === 'b-okacet-1')!;
    expect(daysLeft(okacet.expiry, SEED.today)).toBe(38);
  });

  it('starts one store pending KYC and one approved', () => {
    expect(SEED.stores.map((s) => s.kyc).sort()).toEqual(['APPROVED', 'PENDING_KYC']);
  });

  it('has one NGO with and one without a registered professional', () => {
    expect(SEED.ngos.map((n) => n.hasRegisteredProfessional).sort()).toEqual([false, true]);
  });
});

describe('barcode presets', () => {
  it('all parse and map to a catalog medicine', () => {
    for (const preset of BARCODE_PRESETS) {
      const r = parseGs1(preset.code);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(SEED.medicines.some((m) => m.gtin === r.value.gtin)).toBe(true);
        expect(r.value.batch).toBeTruthy();
        expect(r.value.expiry).toBeTruthy();
      }
    }
  });
});
