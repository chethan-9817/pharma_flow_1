import type { IsoDate } from './clock';
import type { DomainEvent, EventType } from './events';
import { applyEvent } from './reducer';
import { bucketForDaysLeft, type ExpiryBucket } from './rules/expiry';
import { kpis } from './selectors';
import { createInitialState, type AppState, type Seed } from './state';
import { daysLeft } from './clock';

export interface ImpactPoint {
  date: IsoDate;
  /** Eco-Sale revenue from delivered orders, in rupees. */
  ecoRevenue: number;
  /** Medicines delivered to NGOs, at MRP, in rupees. */
  ngoValue: number;
  /** Hazardous waste sent to incineration, in kg. */
  wasteKg: number;
  bloodDonations: number;
}

/**
 * Cumulative impact after each simulated day, found by replaying the event log.
 * The first point is the starting date with everything at zero, so a chart always has a baseline.
 */
export function impactTimeline(seed: Seed, events: readonly DomainEvent[]): ImpactPoint[] {
  let state = createInitialState(seed);
  const zero: ImpactPoint = { date: seed.today, ecoRevenue: 0, ngoValue: 0, wasteKg: 0, bloodDonations: 0 };
  const byDate = new Map<IsoDate, ImpactPoint>([[seed.today, zero]]);

  for (const event of events) {
    const result = applyEvent(state, event);
    if (!result.ok) continue;
    state = result.value;
    const k = kpis(state);
    byDate.set(event.at, {
      date: event.at,
      ecoRevenue: k.deadStockRecovered,
      ngoValue: k.ngoMedicineValue,
      wasteKg: k.hazardousKgDiverted,
      bloodDonations: k.bloodDonationsCompleted,
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type ActivityFamily = 'Inventory' | 'Orders' | 'Prescriptions' | 'Pickups' | 'Civic' | 'Admin';

export const ACTIVITY_FAMILIES: ActivityFamily[] = ['Inventory', 'Orders', 'Prescriptions', 'Pickups', 'Civic', 'Admin'];

const FAMILY: Record<EventType, ActivityFamily> = {
  STORE_REGISTERED: 'Admin',
  KYC_DECIDED: 'Admin',
  TIME_TRAVELLED: 'Admin',
  RIDER_SHIFT_CHANGED: 'Admin',
  STOCK_INGESTED: 'Inventory',
  ECO_SALE_LISTED: 'Inventory',
  ECO_SALE_WITHDRAWN: 'Inventory',
  ORDER_PLACED: 'Orders',
  ORDER_CANCELLED: 'Orders',
  ORDER_PACKED: 'Orders',
  ORDER_ACCEPTED: 'Orders',
  ORDER_ARRIVED: 'Orders',
  ORDER_OUT_FOR_DELIVERY: 'Orders',
  ORDER_DELIVERED: 'Orders',
  RX_APPROVED: 'Prescriptions',
  RX_REJECTED: 'Prescriptions',
  RX_RESUBMITTED: 'Prescriptions',
  PICKUP_SCHEDULED: 'Pickups',
  PICKUP_ACCEPTED: 'Pickups',
  PICKUP_ARRIVED: 'Pickups',
  PICKUP_COLLECTED: 'Pickups',
  PICKUP_QA_VERIFIED: 'Pickups',
  PICKUP_QA_REJECTED: 'Pickups',
  PICKUP_DELIVERED_TO_NGO: 'Pickups',
  PICKUP_INCINERATED: 'Pickups',
  SCRATCH_CARD_REVEALED: 'Civic',
  BLOOD_BOOKED: 'Civic',
  BLOOD_DONATION_CONFIRMED: 'Civic',
};

/** How many events fall in each area of the platform. Always returns every family, in a fixed order. */
export function activityByFamily(events: readonly Pick<DomainEvent, 'type'>[]): { family: ActivityFamily; count: number }[] {
  const counts = new Map<ActivityFamily, number>(ACTIVITY_FAMILIES.map((f) => [f, 0]));
  for (const e of events) counts.set(FAMILY[e.type], (counts.get(FAMILY[e.type]) ?? 0) + 1);
  return ACTIVITY_FAMILIES.map((family) => ({ family, count: counts.get(family) ?? 0 }));
}

/** Units on the shelves of approved stores, by expiry bucket. Pending pickups and closed batches are not counted. */
export function stockByBucket(s: AppState): Record<ExpiryBucket, number> {
  const out: Record<ExpiryBucket, number> = { SAFE: 0, LOCKOUT: 0, CRITICAL: 0, EXPIRED: 0 };
  for (const b of Object.values(s.batches)) {
    if (b.status !== 'IN_STOCK' && b.status !== 'ECO_SALE') continue;
    if (s.stores[b.storeId]?.kyc !== 'APPROVED') continue;
    out[bucketForDaysLeft(daysLeft(b.expiry, s.today))] += b.qty;
  }
  return out;
}
