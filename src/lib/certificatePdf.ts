import QRCode from 'qrcode';
import type { jsPDF, jsPDFOptions } from 'jspdf';
import type { WriteOffCertificate } from '../domain/rules/gst';
import type { Certificate } from '../domain/state';

/**
 * PDF certificates with a QR code, built with jsPDF.
 * jsPDF's built-in fonts cannot draw the rupee sign, so amounts are written "Rs." in PDFs.
 */
const TITLES: Record<Certificate['kind'], string> = {
  NGO_DONOR: 'NGO Donor Certificate',
  GREEN_CITIZEN: 'Green Citizen Certificate',
  BLOOD_DONOR: 'Blood Donor Certificate',
};

const BODY: Record<Certificate['kind'], string> = {
  NGO_DONOR: 'for donating unused, sealed medicines to a verified NGO clinic through PharmaFlow, so they reach people who need them.',
  GREEN_CITIZEN: 'for disposing of expired medicines safely through an authorised bio-medical waste plant, keeping them out of bins and drains.',
  BLOOD_DONOR: 'for donating blood voluntarily. Blood donation in India is voluntary and unpaid, so this certificate carries no cash value.',
};

const ACCENT: Record<Certificate['kind'], [number, number, number]> = {
  NGO_DONOR: [16, 185, 129],
  GREEN_CITIZEN: [5, 150, 105],
  BLOOD_DONOR: [225, 29, 72],
};

const rs = (n: number) => `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The address a certificate QR points to. The Verify page looks the code up. */
export function verifyUrl(code: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}/verify?code=${encodeURIComponent(code)}`;
}

async function newDoc(options: jsPDFOptions): Promise<jsPDF> {
  const { jsPDF: JsPdf } = await import('jspdf');
  return new JsPdf(options);
}

async function qrPng(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 360, margin: 1, errorCorrectionLevel: 'M' });
}

export interface CertificateOptions {
  holderName: string;
  /** Used to build the verification link in the QR code. */
  origin: string;
}

/** Builds a landscape A4 certificate. Nothing is saved yet. */
export async function buildCertificatePdf(cert: Certificate, { holderName, origin }: CertificateOptions): Promise<jsPDF> {
  const doc = await newDoc({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const [r, g, b] = ACCENT[cert.kind];
  const W = 297;
  const H = 210;

  doc.setDrawColor(r, g, b);
  doc.setLineWidth(1.6);
  doc.rect(8, 8, W - 16, H - 16);
  doc.setLineWidth(0.4);
  doc.rect(12, 12, W - 24, H - 24);

  doc.setFillColor(r, g, b);
  doc.rect(12, 12, W - 24, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('PharmaFlow', W / 2, 28, { align: 'center' });

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(30);
  doc.text(TITLES[cert.kind], W / 2, 62, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(100, 116, 139);
  doc.text('This certificate is proudly presented to', W / 2, 80, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.setTextColor(r, g, b);
  doc.text(holderName, W / 2, 102, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(51, 65, 85);
  doc.text(doc.splitTextToSize(BODY[cert.kind], 200), W / 2, 120, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(`Issued on ${cert.issuedOn}`, 24, 168);
  doc.text(`Reference ${cert.refId}`, 24, 175);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Verification code: ${cert.verifyCode}`, 24, 184);

  doc.addImage(await qrPng(verifyUrl(cert.verifyCode, origin)), 'PNG', W - 62, H - 66, 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Scan to verify', W - 42, H - 22, { align: 'center' });
  return doc;
}

export interface WriteOffOptions {
  storeName: string;
  storeArea: string;
  drugLicence: string;
  gstin: string;
  /** Short reference printed on the receipt and encoded in its QR code. */
  reference: string;
}

/** Builds the "Inventory Write-Off & NGO Donation Receipt" as a portrait A4 page. */
export async function buildWriteOffPdf(cert: WriteOffCertificate, store: WriteOffOptions): Promise<jsPDF> {
  const doc = await newDoc({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(2, 132, 199);
  doc.text('PHARMAFLOW', 15, y);
  y += 8;
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(cert.title, 15, y);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const info: [string, string][] = [
    ['Store', `${store.storeName}, ${store.storeArea}`],
    ['Drug licence', store.drugLicence],
    ['GSTIN', store.gstin],
    ['Issued on', cert.issuedOn],
    [cert.reason === 'NGO_DONATION' ? 'Donated to' : 'Sent for incineration to', cert.recipient],
    ['Reference', store.reference],
  ];
  for (const [label, value] of info) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(value, 120), 52, y);
    y += 6;
  }

  y += 4;
  const cols = [15, 62, 88, 112, 124, 142, 170];
  const heads = ['Medicine', 'Batch', 'Expiry', 'Qty', 'MRP', 'Cost value', 'ITC reversal'];
  doc.setFillColor(241, 245, 249);
  doc.rect(15, y - 5, W - 30, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  heads.forEach((h, i) => doc.text(h, cols[i]!, y));
  y += 7;

  doc.setFont('helvetica', 'normal');
  for (const l of cert.lines) {
    const cells = [l.brand, l.batchNo, l.expiry, String(l.qty), rs(l.mrp), rs(l.costValue), rs(l.itcReversal)];
    cells.forEach((c, i) => doc.text(i === 0 ? doc.splitTextToSize(c, 44)[0]! : c, cols[i]!, y));
    y += 6.5;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(15, y - 2, W - 15, y - 2);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Totals', 15, y);
  doc.text(rs(cert.totalCostValue), 142, y);
  doc.text(rs(cert.totalItcReversal), 170, y);
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const notes = [
    `GST input tax credit reversal under CGST Act Section 17(5)(h) at ${cert.gstRatePct}% of the cost value.`,
    'Cost value is estimated at 70% of MRP. Check the rate and values with your accountant.',
    cert.disclaimer,
  ];
  for (const n of notes) {
    const lines = doc.splitTextToSize(n, W - 90);
    doc.text(lines, 15, y);
    y += lines.length * 4.5 + 2;
  }

  doc.addImage(await qrPng(`PHARMAFLOW-WRITEOFF:${store.reference}`), 'PNG', W - 55, y - 28, 38, 38);
  return doc;
}

const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, '-');

export async function downloadCertificate(cert: Certificate, options: CertificateOptions): Promise<void> {
  const doc = await buildCertificatePdf(cert, options);
  doc.save(`PharmaFlow-${safe(TITLES[cert.kind])}-${cert.verifyCode}.pdf`);
}

export async function downloadWriteOff(cert: WriteOffCertificate, store: WriteOffOptions): Promise<void> {
  const doc = await buildWriteOffPdf(cert, store);
  doc.save(`PharmaFlow-Write-Off-${safe(store.reference)}.pdf`);
}
