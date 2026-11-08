import { describe, expect, it } from 'vitest';
import { addDays, daysLeft } from '../src/domain/clock';
import { bucketForDaysLeft, expiryBucket } from '../src/domain/rules/expiry';

describe('clock', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-01-30', 5)).toBe('2026-02-04');
  });
  it('computes days left, negative once past expiry', () => {
    expect(daysLeft('2026-03-01', '2026-02-01')).toBe(28);
    expect(daysLeft('2026-02-01', '2026-02-03')).toBe(-2);
  });
  it('rejects invalid dates', () => {
    expect(() => daysLeft('nope', '2026-01-01')).toThrow();
  });
});

describe('expiry buckets', () => {
  it.each([
    [365, 'SAFE'],
    [181, 'SAFE'],
    [180, 'LOCKOUT'],
    [30, 'LOCKOUT'],
    [29, 'CRITICAL'],
    [1, 'CRITICAL'],
    [0, 'EXPIRED'],
    [-10, 'EXPIRED'],
  ])('%i days left -> %s', (days, bucket) => {
    expect(bucketForDaysLeft(days)).toBe(bucket);
  });

  it('moves a batch between buckets as simulated time advances', () => {
    const expiry = '2027-01-01';
    expect(expiryBucket(expiry, '2026-01-01')).toBe('SAFE');
    expect(expiryBucket(expiry, '2026-08-01')).toBe('LOCKOUT');
    expect(expiryBucket(expiry, '2026-12-10')).toBe('CRITICAL');
    expect(expiryBucket(expiry, '2027-01-02')).toBe('EXPIRED');
  });
});
