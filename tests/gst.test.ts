import { describe, expect, it } from 'vitest';
import { buildWriteOffCertificate, itcReversal } from '../src/domain/rules/gst';

describe('GST ITC reversal', () => {
  it('reverses credit at the GST rate', () => {
    expect(itcReversal(1000, 12)).toBe(120);
    expect(itcReversal(1000, 5)).toBe(50);
  });

  it('builds the write-off certificate with totals', () => {
    const cert = buildWriteOffCertificate({
      reason: 'NGO_DONATION',
      recipient: 'Seva NGO Clinic',
      issuedOn: '2026-06-10',
      lines: [
        { brand: 'Dolo 650', batchNo: 'B1', expiry: '2026-09-01', qty: 100, mrp: 30 },
        { brand: 'Shelcal 500', batchNo: 'B2', expiry: '2026-09-15', qty: 10, mrp: 120 },
      ],
    });
    expect(cert.title).toBe('Inventory Write-Off & NGO Donation Receipt');
    expect(cert.lines[0]).toMatchObject({ costValue: 2100, itcReversal: 252 });
    expect(cert.totalCostValue).toBe(2940);
    expect(cert.totalItcReversal).toBe(352.8);
  });

  it('never presents itself as an 80G receipt', () => {
    const cert = buildWriteOffCertificate({
      reason: 'BIO_DISPOSAL',
      recipient: 'CBWTF',
      issuedOn: '2026-06-10',
      lines: [],
    });
    expect(cert.title).not.toMatch(/80G/);
    expect(cert.disclaimer).toMatch(/do not qualify/);
  });
});
