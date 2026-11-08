/**
 * Eco-Karma and MedWallet rules.
 * - Donation: +200 karma and a scratch card
 * - Safe disposal: +150 karma
 * - Orders earn scratch cards
 * - Blood donation: +500 karma, certificate and badge ONLY (nothing with money value)
 * - MedWallet is closed-loop store credit and can never be cashed out
 */
export type RewardSource = 'DONATION' | 'DISPOSAL' | 'BLOOD' | 'ORDER';

export interface Reward {
  karma: number;
  scratchCard: boolean;
  certificate: 'NGO_DONOR' | 'GREEN_CITIZEN' | 'BLOOD_DONOR' | null;
  badge: string | null;
}

export const KARMA = { DONATION: 200, DISPOSAL: 150, BLOOD: 500, ORDER: 0 } as const;

export function rewardFor(source: RewardSource): Reward {
  switch (source) {
    case 'DONATION':
      return { karma: KARMA.DONATION, scratchCard: true, certificate: 'NGO_DONOR', badge: null };
    case 'DISPOSAL':
      return { karma: KARMA.DISPOSAL, scratchCard: false, certificate: 'GREEN_CITIZEN', badge: null };
    case 'BLOOD':
      return { karma: KARMA.BLOOD, scratchCard: false, certificate: 'BLOOD_DONOR', badge: 'Lifesaver' };
    case 'ORDER':
      return { karma: KARMA.ORDER, scratchCard: true, certificate: null, badge: null };
  }
}

/** Fraction of the card that must be scratched before it reveals. */
export const SCRATCH_REVEAL_THRESHOLD = 0.4;

export function shouldReveal(scratchedFraction: number): boolean {
  return scratchedFraction > SCRATCH_REVEAL_THRESHOLD;
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic reward for a scratch card, so replaying events gives the same result. */
export function scratchReward(cardId: string): { karma: number; credit: number } {
  const n = hash(cardId) % 100;
  if (n < 10) return { karma: 0, credit: 50 };
  if (n < 35) return { karma: 0, credit: 20 };
  if (n < 70) return { karma: 50, credit: 0 };
  return { karma: 25, credit: 10 };
}

/** MedWallet credit can only be spent in the store, never converted to cash. */
export function applyWalletCredit(balance: number, orderTotal: number): { used: number; remaining: number; payable: number } {
  const used = Math.max(0, Math.min(balance, orderTotal));
  return { used, remaining: balance - used, payable: orderTotal - used };
}

export const WALLET_CASH_OUT_ALLOWED = false;
