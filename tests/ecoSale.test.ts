import { describe, expect, it } from 'vitest';
import {
  ECO_WINDOW_DAYS,
  checkDiscount,
  checkEcoSaleEligible,
  ecoPrice,
  ecoSplit,
  fitsCourseDays,
  suggestedDiscount,
} from '../src/domain/rules/ecoSale';

const today = '2026-06-01';
const dolo = { schedule: 'OTC', courseDays: 5 } as const;

describe('Eco-Sale discount', () => {
  it.each([15, 40, 50, 60])('accepts %i%%', (pct) => expect(checkDiscount(pct).ok).toBe(true));
  it.each([14, 61, 0, 100, NaN])('rejects %s%%', (pct) => expect(checkDiscount(pct).ok).toBe(false));
  it('prices at the discounted amount', () => expect(ecoPrice(30, 50)).toBe(15));
  it('starts at 15% at the 6-month alert and goes deeper closer to expiry', () => {
    expect(suggestedDiscount(180)).toBe(15);
    expect(suggestedDiscount(120)).toBe(15);
    expect(suggestedDiscount(60)).toBe(50);
    expect(suggestedDiscount(30)).toBe(60);
  });
  it('splits a ₹200 pack at 15% off: ₹170 paid, ₹20 to PharmaFlow, ₹150 to the store', () => {
    expect(ecoSplit(200, 15)).toEqual({ price: 170, commission: 20, storeGets: 150 });
  });
  it('takes the fee on the MRP, so a deeper discount leaves the store less', () => {
    expect(ecoSplit(200, 60)).toEqual({ price: 80, commission: 20, storeGets: 60 });
  });
});

describe('Eco-Sale eligibility', () => {
  it('opens exactly 6 months (180 days) before expiry', () => {
    expect(ECO_WINDOW_DAYS).toBe(180);
    expect(checkEcoSaleEligible(dolo, '2026-11-28', today).ok).toBe(true); // 180 days left
    expect(checkEcoSaleEligible(dolo, '2026-11-29', today)).toMatchObject({ ok: false, reason: expect.stringMatching(/6 months/) }); // 181
  });
  it('needs days_left >= course_days + 15', () => {
    expect(checkEcoSaleEligible(dolo, '2026-06-21', today).ok).toBe(true); // 20 days
    expect(checkEcoSaleEligible(dolo, '2026-06-20', today).ok).toBe(false); // 19 days
  });
  it('never sells expired stock', () => {
    const r = checkEcoSaleEligible(dolo, '2026-06-01', today);
    expect(r.ok).toBe(false);
  });
  it('blocks Schedule X', () => {
    expect(checkEcoSaleEligible({ schedule: 'X', courseDays: 1 }, '2026-10-01', today).ok).toBe(false);
  });
  it('does not skip prescription drugs (Schedule H still eligible; Rx enforced at checkout)', () => {
    expect(checkEcoSaleEligible({ schedule: 'H', courseDays: 5 }, '2026-09-01', today).ok).toBe(true);
  });
  it('reports the longest course that fits', () => {
    expect(fitsCourseDays(38)).toBe(23);
    expect(fitsCourseDays(10)).toBe(0);
  });
});
