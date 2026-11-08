import { describe, expect, it } from 'vitest';
import { checkDisposalEligible, checkDonationEligible, checkNgoCanReceive, routeAfterQa } from '../src/domain/rules/donation';

const today = '2026-06-01';
const otc = { schedule: 'OTC', coldChain: false, form: 'TABLET' } as const;
const good = { expiry: '2026-09-01', sealed: true, openedLiquid: false };

describe('donation eligibility', () => {
  it('accepts a sealed OTC strip with > 30 days left', () => {
    expect(checkDonationEligible(otc, good, today).ok).toBe(true);
  });
  it('requires strictly more than 30 days', () => {
    expect(checkDonationEligible(otc, { ...good, expiry: '2026-07-01' }, today).ok).toBe(false); // 30 d
    expect(checkDonationEligible(otc, { ...good, expiry: '2026-07-02' }, today).ok).toBe(true); // 31 d
  });
  it('rejects cold-chain, Schedule X, unsealed and opened liquids', () => {
    expect(checkDonationEligible({ ...otc, coldChain: true }, good, today).ok).toBe(false);
    expect(checkDonationEligible({ ...otc, schedule: 'X' }, good, today).ok).toBe(false);
    expect(checkDonationEligible(otc, { ...good, sealed: false }, today).ok).toBe(false);
    expect(checkDonationEligible({ ...otc, form: 'SYRUP' }, { ...good, openedLiquid: true }, today).ok).toBe(false);
  });
});

describe('NGO receiving rules', () => {
  const clinic = { name: 'Seva Clinic', hasRegisteredProfessional: true };
  const shelter = { name: 'Old-age home', hasRegisteredProfessional: false };
  it('sends Rx-only drugs only to NGOs with a registered professional', () => {
    expect(checkNgoCanReceive({ schedule: 'H' }, clinic).ok).toBe(true);
    expect(checkNgoCanReceive({ schedule: 'H' }, shelter).ok).toBe(false);
    expect(checkNgoCanReceive({ schedule: 'H1' }, shelter).ok).toBe(false);
  });
  it('lets OTC drugs go to any NGO', () => {
    expect(checkNgoCanReceive({ schedule: 'OTC' }, shelter).ok).toBe(true);
  });
});

describe('QA routing', () => {
  it('rejected items go to bio-disposal', () => {
    expect(routeAfterQa(true)).toBe('DELIVERED_TO_NGO');
    expect(routeAfterQa(false)).toBe('INCINERATED');
  });
});

describe('disposal eligibility', () => {
  const dolo = { brand: 'Dolo 650', schedule: 'OTC' } as const;
  it('accepts expired medicines, including ones that expire today', () => {
    expect(checkDisposalEligible(dolo, '2026-05-31', today).ok).toBe(true);
    expect(checkDisposalEligible(dolo, today, today).ok).toBe(true);
  });
  it('sends in-date medicines to donation instead', () => {
    const r = checkDisposalEligible(dolo, '2026-06-02', today);
    expect(r).toEqual({ ok: false, reason: expect.stringMatching(/has not expired/) });
  });
  it('blocks Schedule X even when expired', () => {
    expect(checkDisposalEligible({ brand: 'Narcotic', schedule: 'X' }, '2026-01-01', today).ok).toBe(false);
  });
});
