import { describe, expect, it } from 'vitest';
import { NGO_FUND_SHARE_PCT, PLATFORM_FEE_PCT, ngoFundShare, platformFee } from '../src/domain/rules/fund';
import { SPONSOR_AMOUNT, checkSponsorable, sponsorSplit, sponsorUnits } from '../src/domain/rules/sponsor';
import { MEDICINES } from '../src/seed/medicines';

const med = (id: string) => MEDICINES.find((m) => m.id === id)!;
const TODAY = '2026-11-08';
const ecoBatch = (daysLeft: number, qty = 60, pct = 50) => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + daysLeft);
  return { status: 'ECO_SALE' as const, expiry: d.toISOString().slice(0, 10), qty, ecoDiscountPct: pct };
};

describe('sponsorUnits', () => {
  it('buys as many packs as the amount covers', () => {
    expect(sponsorUnits(11.5, 60)).toBe(8); // 8 x 11.50 = 92
    expect(sponsorUnits(15.5, 60)).toBe(6); // 6 x 15.50 = 93
  });

  it('never gives more than the batch has left, and always at least one pack', () => {
    expect(sponsorUnits(11.5, 3)).toBe(3);
    expect(sponsorUnits(99, 10)).toBe(1);
    expect(sponsorUnits(60, 10)).toBe(1);
  });

  it('gives nothing when a pack costs more than the amount or the batch is empty', () => {
    expect(sponsorUnits(100, 10)).toBe(0);
    expect(sponsorUnits(11.5, 0)).toBe(0);
  });
});

describe('sponsorSplit', () => {
  it('pays the store the Eco-Sale price and puts the change in the NGO fund', () => {
    expect(sponsorSplit(8, 11.5)).toEqual({ storePayout: 92, fundTopUp: 7 });
    expect(sponsorSplit(3, 11.5)).toEqual({ storePayout: 34.5, fundTopUp: 64.5 });
  });

  it('always adds up to the sponsor amount', () => {
    for (const [units, price] of [[8, 11.5], [1, 99], [6, 15.5], [4, 23.33]] as const) {
      const { storePayout, fundTopUp } = sponsorSplit(units, price);
      expect(Math.round((storePayout + fundTopUp) * 100) / 100).toBe(SPONSOR_AMOUNT);
    }
  });
});

describe('checkSponsorable', () => {
  it('accepts an over-the-counter Eco-Sale batch with plenty of shelf life', () => {
    expect(checkSponsorable(med('med-okacet'), ecoBatch(38), TODAY).ok).toBe(true);
  });

  it('only accepts batches that are on Eco-Sale', () => {
    const r = checkSponsorable(med('med-okacet'), { ...ecoBatch(38), status: 'IN_STOCK' as never }, TODAY);
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/Eco-Sale/) });
  });

  it('blocks prescription-only medicines', () => {
    const r = checkSponsorable(med('med-augmentin'), ecoBatch(143), TODAY);
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/over-the-counter/) });
  });

  it('needs more than 30 days left, because the packs go on to an NGO', () => {
    // Eco-Sale itself only needs course + 15 days (20 for Okacet), but a donation needs more than 30.
    const r = checkSponsorable(med('med-okacet'), ecoBatch(25), TODAY);
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/30 days/) });
  });

  it('refuses cold-chain medicines', () => {
    const insulinLike = { ...med('med-okacet'), coldChain: true };
    expect(checkSponsorable(insulinLike, ecoBatch(60), TODAY)).toMatchObject({ ok: false, reason: expect.stringMatching(/Cold-chain/) });
  });

  it('refuses an empty batch and a pack that costs more than the amount', () => {
    expect(checkSponsorable(med('med-okacet'), ecoBatch(38, 0), TODAY).ok).toBe(false);
    const dear = { ...med('med-okacet'), mrp: 400 };
    expect(checkSponsorable(dear, ecoBatch(60, 10, 40), TODAY)).toMatchObject({ ok: false, reason: expect.stringMatching(/more than/) });
  });
});

describe('NGO fund share', () => {
  it('is a small share of the platform fee, not of the whole order', () => {
    expect(PLATFORM_FEE_PCT).toBe(10);
    expect(NGO_FUND_SHARE_PCT).toBe(2);
    expect(platformFee(1000)).toBe(100);
    expect(ngoFundShare(1000)).toBe(2);
    expect(ngoFundShare(23)).toBe(0.05);
  });

  it('rounds to paise and is zero for a zero order', () => {
    expect(ngoFundShare(0)).toBe(0);
    expect(Number.isInteger(ngoFundShare(37.7) * 100)).toBe(true);
  });
});
