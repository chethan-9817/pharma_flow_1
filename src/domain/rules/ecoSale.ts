import { daysLeft, type IsoDate } from '../clock';
import { fail, ok, type Check } from '../result';
import type { Medicine } from '../types';
import { PLATFORM_FEE_PCT } from './fund';
import { SAFE_MIN_DAYS } from './expiry';

/** The first Eco-Sale offer, made 6 months before expiry: a ₹200 strip sells for ₹170. */
export const ECO_MIN_DISCOUNT = 15;
export const ECO_MAX_DISCOUNT = 60;
/** Eco-Sale opens, and the chemist is alerted, this many days (6 months) before a batch expires. */
export const ECO_WINDOW_DAYS = SAFE_MIN_DAYS;
/** Buffer so a patient can finish the course before the medicine expires. */
export const COURSE_BUFFER_DAYS = 15;

export function checkDiscount(pct: number): Check {
  if (!Number.isFinite(pct)) return fail('Discount must be a number');
  if (pct < ECO_MIN_DISCOUNT || pct > ECO_MAX_DISCOUNT) {
    return fail(`Eco-Sale discount must be between ${ECO_MIN_DISCOUNT}% and ${ECO_MAX_DISCOUNT}%`);
  }
  return ok;
}

/** Within 6 months of expiry, days_left >= course_days + 15, never expired, never Schedule X. */
export function checkEcoSaleEligible(
  medicine: Pick<Medicine, 'schedule' | 'courseDays'>,
  expiry: IsoDate,
  today: IsoDate,
): Check {
  if (medicine.schedule === 'X') return fail('Schedule X / NDPS drugs are blocked on the platform');
  const left = daysLeft(expiry, today);
  if (left <= 0) return fail('Expired medicines cannot be sold. Use Yellow-Bag disposal');
  if (left > ECO_WINDOW_DAYS) return fail(`Eco-Sale opens 6 months before expiry; this batch has ${left} days left and sells at full price`);
  const needed = medicine.courseDays + COURSE_BUFFER_DAYS;
  if (left < needed) {
    return fail(`Needs at least ${needed} days left (course ${medicine.courseDays}d + ${COURSE_BUFFER_DAYS}d buffer); only ${left} remain`);
  }
  return ok;
}

/** 15% off when the 6-month alert goes out, deeper the closer the batch gets to expiry. */
export function suggestedDiscount(days: number): number {
  if (days < 45) return ECO_MAX_DISCOUNT;
  if (days < 90) return 50;
  return ECO_MIN_DISCOUNT;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function ecoPrice(mrp: number, discountPct: number): number {
  return round2(mrp * (1 - discountPct / 100));
}

export interface EcoSplit {
  /** What the customer pays. */
  price: number;
  /** PharmaFlow's fee: a share of the MRP, not of the discounted price. */
  commission: number;
  /** What the store keeps. */
  storeGets: number;
}

/** Who gets what from one Eco-Sale pack. ₹200 MRP at 15% off: customer pays ₹170, PharmaFlow ₹20, store ₹150. */
export function ecoSplit(mrp: number, discountPct: number): EcoSplit {
  const price = ecoPrice(mrp, discountPct);
  const commission = round2((mrp * PLATFORM_FEE_PCT) / 100);
  return { price, commission, storeGets: round2(price - commission) };
}

/** Longest course (in days) that still fits before expiry, with the buffer applied. */
export function fitsCourseDays(days: number): number {
  return Math.max(0, days - COURSE_BUFFER_DAYS);
}
