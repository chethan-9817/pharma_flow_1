import { describe, expect, it } from 'vitest';
import {
  WALLET_CASH_OUT_ALLOWED,
  applyWalletCredit,
  rewardFor,
  scratchReward,
  shouldReveal,
} from '../src/domain/rules/rewards';

describe('rewards', () => {
  it('donation gives +200 karma and a scratch card', () => {
    expect(rewardFor('DONATION')).toMatchObject({ karma: 200, scratchCard: true });
  });
  it('safe disposal gives +150 karma', () => {
    expect(rewardFor('DISPOSAL')).toMatchObject({ karma: 150, certificate: 'GREEN_CITIZEN' });
  });
  it('orders earn scratch cards', () => {
    expect(rewardFor('ORDER').scratchCard).toBe(true);
  });
  it('blood donation: +500 karma, certificate and badge only, no scratch card or money', () => {
    const r = rewardFor('BLOOD');
    expect(r).toMatchObject({ karma: 500, certificate: 'BLOOD_DONOR', scratchCard: false });
    expect(r.badge).toBeTruthy();
  });
});

describe('scratch cards', () => {
  it('reveal only after more than 40% is scratched', () => {
    expect(shouldReveal(0.4)).toBe(false);
    expect(shouldReveal(0.41)).toBe(true);
  });
  it('rewards are deterministic per card', () => {
    expect(scratchReward('card-1')).toEqual(scratchReward('card-1'));
  });
  it('always gives something', () => {
    for (let i = 0; i < 50; i++) {
      const r = scratchReward(`c${i}`);
      expect(r.karma + r.credit).toBeGreaterThan(0);
    }
  });
});

describe('MedWallet', () => {
  it('spends up to the balance and leaves the rest payable', () => {
    expect(applyWalletCredit(30, 100)).toEqual({ used: 30, remaining: 0, payable: 70 });
    expect(applyWalletCredit(200, 100)).toEqual({ used: 100, remaining: 100, payable: 0 });
  });
  it('is closed-loop: no cash-out', () => {
    expect(WALLET_CASH_OUT_ALLOWED).toBe(false);
  });
});
