import { addDays, daysBetween, type IsoDate } from '../clock';
import { fail, ok, type Check } from '../result';
import type { H1Entry, Medicine, OrderItem, Prescription, RxStatus } from '../types';

export const ANTIBIOTIC_VALIDITY_DAYS = 30;
export const DEFAULT_VALIDITY_DAYS = 180;
/** H1 register entries must be retained for 3 years. */
export const H1_RETENTION_DAYS = 3 * 365;

type RxMedicine = Pick<Medicine, 'id' | 'brand' | 'schedule' | 'isAntibiotic'>;
export type MedicineLookup = (id: string) => RxMedicine | undefined;

export function requiresRx(m: Pick<Medicine, 'schedule'>): boolean {
  return m.schedule === 'H' || m.schedule === 'H1';
}

export function isBlocked(m: Pick<Medicine, 'schedule'>): boolean {
  return m.schedule === 'X';
}

export function validityDays(m: Pick<Medicine, 'isAntibiotic'>): number {
  return m.isAntibiotic ? ANTIBIOTIC_VALIDITY_DAYS : DEFAULT_VALIDITY_DAYS;
}

/** Schedule X / NDPS can never be sold, donated or listed. */
export function checkItemsSellable(items: OrderItem[], lookup: MedicineLookup): Check {
  for (const item of items) {
    const m = lookup(item.medicineId);
    if (!m) return fail(`Unknown medicine ${item.medicineId}`);
    if (isBlocked(m)) return fail(`${m.brand} is Schedule X / NDPS and is blocked on the platform`);
  }
  return ok;
}

export function orderNeedsRx(items: OrderItem[], lookup: MedicineLookup): boolean {
  return items.some((i) => {
    const m = lookup(i.medicineId);
    return m ? requiresRx(m) : false;
  });
}

/** The prescription must show doctor, registration number, date, patient and drug. */
export function checkRxFields(rx: Prescription): Check {
  if (!rx.doctorName.trim()) return fail('Prescription is missing the doctor name');
  if (!rx.registrationNo.trim()) return fail('Prescription is missing the doctor registration number');
  if (!rx.patientName.trim()) return fail('Prescription is missing the patient name');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rx.date)) return fail('Prescription is missing a valid date');
  if (rx.drugs.length === 0) return fail('Prescription does not list any drug');
  return ok;
}

/**
 * Full validation of a prescription against an order. OCR never approves:
 * this only tells the pharmacist whether the Rx passes the automatic checks.
 */
export function checkRxForOrder(
  rx: Prescription,
  orderId: string,
  items: OrderItem[],
  lookup: MedicineLookup,
  today: IsoDate,
): Check {
  const fields = checkRxFields(rx);
  if (!fields.ok) return fields;
  if (daysBetween(today, rx.date) > 0) return fail('Prescription is dated in the future');

  const age = daysBetween(rx.date, today);
  for (const item of items) {
    const m = lookup(item.medicineId);
    if (!m) return fail(`Unknown medicine ${item.medicineId}`);
    if (!requiresRx(m)) continue;

    const line = rx.drugs.find((d) => d.medicineId === m.id);
    if (!line) return fail(`${m.brand} is not listed on the prescription`);
    if (item.qty > line.qty) {
      return fail(`${m.brand}: ordered ${item.qty} but the prescription covers ${line.qty}`);
    }
    const limit = validityDays(m);
    if (age > limit) {
      return fail(`Prescription is ${age} days old; ${m.brand} needs one issued within ${limit} days`);
    }
    if (m.isAntibiotic && rx.usedByOrderId && rx.usedByOrderId !== orderId) {
      return fail('This prescription already covers an antibiotic course and cannot be reused');
    }
  }
  return ok;
}

/** An order with any Rx-only item cannot move to PACKED until the Rx is approved. */
export function canPack(rxRequired: boolean, rxStatus: RxStatus): Check {
  if (!rxRequired) return ok;
  return rxStatus === 'APPROVED' ? ok : fail('Prescription must be approved by the chemist before packing');
}

/** Schedule H1 sales are logged in a register (patient, doctor, drug, quantity). */
export function buildH1Entries(
  orderId: string,
  rx: Prescription,
  items: OrderItem[],
  lookup: MedicineLookup,
  today: IsoDate,
): H1Entry[] {
  return items.flatMap((item) => {
    const m = lookup(item.medicineId);
    if (!m || m.schedule !== 'H1') return [];
    return [
      {
        id: `h1-${orderId}-${m.id}`,
        orderId,
        patientName: rx.patientName,
        doctorName: rx.doctorName,
        doctorRegNo: rx.registrationNo,
        medicineId: m.id,
        qty: item.qty,
        date: today,
        retainUntil: addDays(today, H1_RETENTION_DAYS),
      },
    ];
  });
}
