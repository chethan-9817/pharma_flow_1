import { describe, expect, it } from 'vitest';
import { buildCertificatePdf, buildWriteOffPdf, verifyUrl } from '../src/lib/certificatePdf';
import { buildWriteOffCertificate } from '../src/domain/rules/gst';
import type { Certificate } from '../src/domain/state';

const cert = (kind: Certificate['kind']): Certificate => ({
  id: 'cert-pk-1',
  kind,
  userId: 'u-asha',
  refId: 'pk-1',
  issuedOn: '2026-11-08',
  verifyCode: '0KOJDAF',
  summary: 'Test certificate',
});

describe('verifyUrl', () => {
  it('builds the link the QR code points to', () => {
    expect(verifyUrl('0KOJDAF', 'http://localhost:5173')).toBe('http://localhost:5173/verify?code=0KOJDAF');
    expect(verifyUrl('A B', 'http://x.test/')).toBe('http://x.test/verify?code=A%20B');
  });
});

describe('certificate PDF', () => {
  it.each(['NGO_DONOR', 'GREEN_CITIZEN', 'BLOOD_DONOR'] as const)('builds a one-page %s certificate with a QR code', async (kind) => {
    const doc = await buildCertificatePdf(cert(kind), { holderName: 'Asha Shetty', origin: 'http://localhost:5173' });
    expect(doc.getNumberOfPages()).toBe(1);
    const text = doc.output();
    expect(text).toContain('Asha Shetty');
    expect(text).toContain('0KOJDAF');
    expect(text).toContain('PharmaFlow');
    expect(text).toContain('/Subtype /Image'); // the QR code
  });

  it('says a blood certificate carries no cash value', async () => {
    const doc = await buildCertificatePdf(cert('BLOOD_DONOR'), { holderName: 'Asha Shetty', origin: 'http://localhost:5173' });
    expect(doc.output()).toContain('no cash value');
  });
});

describe('write-off PDF', () => {
  const write = buildWriteOffCertificate({
    reason: 'NGO_DONATION',
    recipient: 'Seva NGO Clinic',
    issuedOn: '2026-11-08',
    lines: [{ brand: 'Shelcal 500', batchNo: 'SH26J11', expiry: '2027-08-30', qty: 50, mrp: 134 }],
  });
  const store = { storeName: 'Sri Ganesh Medicals', storeArea: 'Hampankatta', drugLicence: 'KA-MNG-2026-8841', gstin: '29ABCDE1234F1Z5', reference: 'WO-pk-2' };

  it('builds the receipt with the ITC reversal, the right title and a QR code', async () => {
    const doc = await buildWriteOffPdf(write, store);
    const text = doc.output();
    expect(doc.getNumberOfPages()).toBe(1);
    expect(text).toContain('Inventory Write-Off & NGO Donation Receipt');
    expect(text).toContain('Seva NGO Clinic');
    expect(text).toContain('CGST Act Section 17'); // the PDF escapes the brackets that follow
    expect(text).toContain('/Subtype /Image');
  });

  it('never calls itself an 80G receipt and avoids the rupee sign that the PDF font cannot draw', async () => {
    const text = (await buildWriteOffPdf(write, store)).output();
    expect(text).toContain('do not qualify for deduction under Section 80G');
    expect(text).toContain('Rs.');
    expect(text).not.toContain('₹');
  });
});
