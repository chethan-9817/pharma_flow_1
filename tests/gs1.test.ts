import { describe, expect, it } from 'vitest';
import { parseGs1, parseGs1Date, parseScan } from '../src/domain/rules/gs1';

describe('GS1 date', () => {
  it('parses YYMMDD', () => expect(parseGs1Date('271231')).toBe('2027-12-31'));
  it('treats day 00 as the end of the month', () => {
    expect(parseGs1Date('270200')).toBe('2027-02-28');
    expect(parseGs1Date('281200')).toBe('2028-12-31');
  });
  it('rejects impossible dates', () => {
    expect(parseGs1Date('271301')).toBeNull();
    expect(parseGs1Date('270231')).toBeNull();
    expect(parseGs1Date('abc')).toBeNull();
  });
});

describe('GS1 parsing', () => {
  it('reads the human-readable form', () => {
    const r = parseGs1('(01)08901234567890(17)271231(10)DL24A01');
    expect(r).toEqual({ ok: true, value: { gtin: '08901234567890', expiry: '2027-12-31', batch: 'DL24A01' } });
  });
  it('reads the raw form with a group separator after the batch', () => {
    const r = parseGs1('0108901234567890' + '10AB12' + '\u001d' + '17270630');
    expect(r).toEqual({ ok: true, value: { gtin: '08901234567890', batch: 'AB12', expiry: '2027-06-30' } });
  });
  it('reads GTIN + expiry + trailing batch', () => {
    const r = parseGs1('01089012345678901727063010XYZ9');
    expect(r).toEqual({ ok: true, value: { gtin: '08901234567890', expiry: '2027-06-30', batch: 'XYZ9' } });
  });
  it('fails without a GTIN', () => {
    expect(parseGs1('(10)ABC').ok).toBe(false);
    expect(parseGs1('').ok).toBe(false);
  });
  it('fails on unsupported identifiers and bad expiry', () => {
    expect(parseGs1('99ABC').ok).toBe(false);
    expect(parseGs1('(01)08901234567890(17)271399').ok).toBe(false);
  });
});

describe('camera scan results', () => {
  it('ignores a GS1 symbology identifier prefix', () => {
    expect(parseScan(']d2(01)08901234567890(17)271231(10)AB1')).toEqual({
      ok: true,
      value: { gtin: '08901234567890', batch: 'AB1', expiry: '2027-12-31' },
    });
    expect(parseScan(']C10108901234567890' + '17271231' + '10Z9')).toMatchObject({ ok: true, value: { batch: 'Z9' } });
  });
  it('accepts a plain EAN-13 as a GTIN with no batch or expiry', () => {
    expect(parseScan('8901234500011')).toEqual({ ok: true, value: { gtin: '08901234500011' } });
  });
  it('accepts GTIN-14 and rejects junk', () => {
    expect(parseScan('08901234500011')).toEqual({ ok: true, value: { gtin: '08901234500011' } });
    expect(parseScan('hello').ok).toBe(false);
    expect(parseScan('12345').ok).toBe(false);
  });
});
