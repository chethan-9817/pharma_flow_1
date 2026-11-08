import { daysLeft, type IsoDate } from '../clock';

export type ExpiryBucket = 'SAFE' | 'LOCKOUT' | 'CRITICAL' | 'EXPIRED';

export const SAFE_MIN_DAYS = 180;
export const LOCKOUT_MIN_DAYS = 30;

/** SAFE > 180 d · LOCKOUT 30–180 d · CRITICAL 1–29 d · EXPIRED <= 0 d */
export function bucketForDaysLeft(days: number): ExpiryBucket {
  if (days <= 0) return 'EXPIRED';
  if (days < LOCKOUT_MIN_DAYS) return 'CRITICAL';
  if (days <= SAFE_MIN_DAYS) return 'LOCKOUT';
  return 'SAFE';
}

export function expiryBucket(expiry: IsoDate, today: IsoDate): ExpiryBucket {
  return bucketForDaysLeft(daysLeft(expiry, today));
}

export const BUCKET_LABEL: Record<ExpiryBucket, string> = {
  SAFE: 'Safe',
  LOCKOUT: 'Lockout',
  CRITICAL: 'Critical',
  EXPIRED: 'Expired',
};
