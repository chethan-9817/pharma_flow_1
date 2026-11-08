import { daysBetween } from '../clock';
import { applyCivicReward } from './payouts';
import { addKarma, addWallet, done, err, failed, requireRole, type Ev, type Step } from './common';
import type { AppState } from '../state';

export function scratchCardRevealed(s: AppState, e: Ev<'SCRATCH_CARD_REVEALED'>): Step {
  const card = s.scratchCards[e.cardId];
  if (!card) return err('Unknown scratch card');
  if (card.userId !== e.actorId) return err('This card belongs to someone else');
  if (card.revealed) return err('Already scratched');
  let next: AppState = { ...s, scratchCards: { ...s.scratchCards, [card.id]: { ...card, revealed: true } } };
  next = addKarma(next, card.userId, card.rewardKarma);
  // MedWallet credit is closed-loop store credit: it can be spent in the store, never cashed out.
  next = addWallet(next, card.userId, card.rewardCredit);
  return done(next);
}

export function bloodBooked(s: AppState, e: Ev<'BLOOD_BOOKED'>): Step {
  const b = e.booking;
  if (s.bloodBookings[b.id]) return err('Booking already exists');
  const bad = failed(requireRole(s, b.userId, 'customer'));
  if (bad) return bad;
  if (e.actorId !== b.userId) return err('Customers can only book for themselves');
  if (!s.bloodBanks[b.bloodBankId]) return err('Unknown blood bank');
  if (b.status !== 'BOOKED') return err('New bookings must start as BOOKED');
  if (daysBetween(s.today, b.date) < 0) return err('Choose today or a later date');
  return done({ ...s, bloodBookings: { ...s.bloodBookings, [b.id]: b } });
}

/**
 * Blood donation is voluntary and unpaid in India: the reward is karma, a
 * certificate and a badge only. Nothing with money value is ever granted.
 */
export function bloodDonationConfirmed(s: AppState, e: Ev<'BLOOD_DONATION_CONFIRMED'>): Step {
  const booking = s.bloodBookings[e.bookingId];
  if (!booking) return err('Unknown booking');
  const bad = failed(requireRole(s, e.actorId, 'admin'));
  if (bad) return bad;
  if (booking.status !== 'BOOKED') return err('Donation was already confirmed');
  const next: AppState = {
    ...s,
    bloodBookings: { ...s.bloodBookings, [booking.id]: { ...booking, status: 'DONATED' } },
  };
  return done(applyCivicReward(next, booking.userId, 'BLOOD', booking.id));
}
