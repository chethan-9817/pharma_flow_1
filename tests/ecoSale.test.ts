import { describe, expect, it } from 'vitest';
import {
  checkDiscount,
  checkEcoSaleEligible,
  ecoPrice,
  fitsCourseDays,
  suggestedDiscount,
} from '../src/domain/rules/ecoSale';

const today = '2026-06-01';
const dolo = { schedule: 'OTC', courseDays: 5 } as const;

describe('Eco-Sale discount', () => {
  it.each([40, 50, 60])('accepts %i%%', (pct) => expect(checkDiscount(pct).ok).toBe(true));
  it.each([39, 61, 0, 100, NaN])('rejects %s%%', (pct) => expect(checkDiscount(pct).ok).toBe(false));
  it('prices at the discounted amount', () => expect(ecoPrice(30, 50)).toBe(15));
  it('suggests deeper discounts closer to expiry', () => {
    expect(suggestedDiscount(30)).toBe(60);
    expect(suggestedDiscount(60)).toBe(50);
    expect(suggestedDiscount(120)).toBe(40);
  });
});

describe('Eco-Sale eligibility', () => {
  it('needs days_left >= course_days + 15', () => {
    expect(checkEcoSaleEligible(dolo, '2026-06-21', today).ok).toBe(true); // 20 days
    expect(checkEcoSaleEligible(dolo, '2026-06-20', today).ok).toBe(false); // 19 days
  });
  it('never sells expired stock', () => {
    const r = checkEcoSaleEligible(dolo, '2026-06-01', today);
    expect(r.ok).toBe(false);
  });
  it('blocks Schedule X', () => {
    expect(checkEcoSaleEligible({ schedule: 'X', courseDays: 1 }, '2027-06-01', today).ok).toBe(false);
  });
  it('does not skip prescription drugs (Schedule H still eligible; Rx enforced at checkout)', () => {
    expect(checkEcoSaleEligible({ schedule: 'H', courseDays: 5 }, '2026-09-01', today).ok).toBe(true);
  });
  it('reports the longest course that fits', () => {
    expect(fitsCourseDays(38)).toBe(23);
    expect(fitsCourseDays(10)).toBe(0);
  });
});
