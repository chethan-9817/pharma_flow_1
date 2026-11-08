import { daysLeft, type IsoDate } from '../clock';
import { fail, ok, type Check } from '../result';
import type { Medicine } from '../types';

export const ECO_MIN_DISCOUNT = 40;
export const ECO_MAX_DISCOUNT = 60;
/** Buffer so a patient can finish the course before the medicine expires. */
export const COURSE_BUFFER_DAYS = 15;

export function checkDiscount(pct: number): Check {
  if (!Number.isFinite(pct)) return fail('Discount must be a number');
  if (pct < ECO_MIN_DISCOUNT || pct > ECO_MAX_DISCOUNT) {
    return fail(`Eco-Sale discount must be between ${ECO_MIN_DISCOUNT}% and ${ECO_MAX_DISCOUNT}%`);
  }
  return ok;
}

/** days_left >= course_days + 15, never expired, never Schedule X. */
export function checkEcoSaleEligible(
  medicine: Pick<Medicine, 'schedule' | 'courseDays'>,
  expiry: IsoDate,
  today: IsoDate,
): Check {
  if (medicine.schedule === 'X') return fail('Schedule X / NDPS drugs are blocked on the platform');
  const left = daysLeft(expiry, today);
  if (left <= 0) return fail('Expired medicines cannot be sold. Use Yellow-Bag disposal');
  const needed = medicine.courseDays + COURSE_BUFFER_DAYS;
  if (left < needed) {
    return fail(`Needs at least ${needed} days left (course ${medicine.courseDays}d + ${COURSE_BUFFER_DAYS}d buffer); only ${left} remain`);
  }
  return ok;
}

/** Deeper discount the closer the batch is to expiry. */
export function suggestedDiscount(days: number): number {
  if (days < 45) return ECO_MAX_DISCOUNT;
  if (days < 90) return 50;
  return ECO_MIN_DISCOUNT;
}

export function ecoPrice(mrp: number, discountPct: number): number {
  return Math.round(mrp * (1 - discountPct / 100) * 100) / 100;
}

/** Longest course (in days) that still fits before expiry, with the buffer applied. */
export function fitsCourseDays(days: number): number {
  return Math.max(0, days - COURSE_BUFFER_DAYS);
}
