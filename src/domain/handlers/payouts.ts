import { rewardFor, scratchReward, type RewardSource } from '../rules/rewards';
import type { AppState, Certificate } from '../state';
import { addKarma, verifyCode } from './common';

/** Rider pay per completed mission (demo values, in rupees). */
export const RIDER_PAY = { DELIVERY: 40, PICKUP: 30, GREEN_INCENTIVE: 10 } as const;

export function payRider(s: AppState, riderId: string, base: number, incentive = 0): AppState {
  const rider = s.riders[riderId];
  if (!rider) return s;
  return {
    ...s,
    riders: {
      ...s.riders,
      [riderId]: {
        ...rider,
        trips: rider.trips + 1,
        earnings: rider.earnings + base,
        incentives: rider.incentives + incentive,
      },
    },
  };
}

export function grantScratchCard(s: AppState, userId: string, cardId: string, source: string): AppState {
  if (s.scratchCards[cardId]) return s;
  const reward = scratchReward(cardId);
  return {
    ...s,
    scratchCards: {
      ...s.scratchCards,
      [cardId]: {
        id: cardId,
        userId,
        source,
        revealed: false,
        rewardKarma: reward.karma,
        rewardCredit: reward.credit,
      },
    },
  };
}

const CERT_SUMMARY: Record<NonNullable<Certificate['kind']>, string> = {
  NGO_DONOR: 'Donated unused medicines to a verified NGO clinic',
  GREEN_CITIZEN: 'Disposed of expired medicines safely through a CBWTF',
  BLOOD_DONOR: 'Donated blood voluntarily',
};

/**
 * Applies the standard reward (karma, scratch card, certificate) for a civic action.
 * `summary` replaces the certificate's usual one-line description, for example for a sponsorship.
 */
export function applyCivicReward(s: AppState, userId: string, source: RewardSource, refId: string, summary?: string): AppState {
  const reward = rewardFor(source);
  let next = addKarma(s, userId, reward.karma);
  if (reward.scratchCard) next = grantScratchCard(next, userId, `sc-${refId}`, source);
  if (reward.certificate) {
    const cert: Certificate = {
      id: `cert-${refId}`,
      kind: reward.certificate,
      userId,
      refId,
      issuedOn: s.today,
      verifyCode: verifyCode(`cert-${refId}`),
      summary: summary ?? CERT_SUMMARY[reward.certificate],
    };
    next = { ...next, certificates: [...next.certificates, cert] };
  }
  return next;
}
