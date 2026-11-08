import { describe, expect, it } from 'vitest';
import { parseRxDate, parseRxText } from '../src/domain/rules/rxText';
import { MEDICINES } from '../src/seed/medicines';

const SAMPLE = `Dr. Meera Rao MBBS, MD
Reg. No: KMC-48213
Mangaluru Clinic
Date: 05/04/2027
Patient Name: Asha Shetty   Age: 34
Rx
1. Augmentin 625 Duo  1 tab BD  Qty: 10
2. Pan-D capsule once daily x 14
3. Dolo 650 SOS`;

describe('parseRxDate', () => {
  it('reads Indian DD/MM/YYYY and ISO', () => {
    expect(parseRxDate('05/04/2027')).toBe('2027-04-05');
    expect(parseRxDate('5-4-27')).toBe('2027-04-05');
    expect(parseRxDate('2027-04-05')).toBe('2027-04-05');
  });
  it('rejects impossible dates', () => {
    expect(parseRxDate('31/02/2027')).toBeUndefined();
    expect(parseRxDate('no date here')).toBeUndefined();
  });
});

describe('parseRxText', () => {
  const r = parseRxText(SAMPLE, MEDICINES);
  it('finds doctor, registration number, date and patient', () => {
    expect(r.doctorName).toBe('Dr. Meera Rao');
    expect(r.registrationNo).toBe('KMC-48213');
    expect(r.date).toBe('2027-04-05');
    expect(r.patientName).toBe('Asha Shetty');
  });
  it('matches listed drugs and reads quantities when present', () => {
    expect(r.drugs).toEqual([
      { medicineId: 'med-dolo650' },
      { medicineId: 'med-augmentin', qty: 10 },
      { medicineId: 'med-pand', qty: 14 },
    ]);
  });
  it('returns empty suggestions for unreadable text', () => {
    expect(parseRxText('~~ smudge ~~', MEDICINES)).toEqual({ drugs: [] });
  });
});
