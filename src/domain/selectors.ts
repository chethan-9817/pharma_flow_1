import { daysLeft } from './clock';
import { ecoPrice, checkEcoSaleEligible } from './rules/ecoSale';
import { bucketForDaysLeft, type ExpiryBucket } from './rules/expiry';
import type { AppState } from './state';
import type { Batch, Medicine, Order, Pickup } from './types';

export interface BatchView {
  batch: Batch;
  medicine: Medicine;
  daysLeft: number;
  bucket: ExpiryBucket;
}

/** Batches of a store with their medicine, days left and expiry bucket. */
export function storeInventory(s: AppState, storeId: string): BatchView[] {
  return Object.values(s.batches)
    .filter((b) => b.storeId === storeId && b.status !== 'CLOSED')
    .map((batch) => {
      const medicine = s.medicines[batch.medicineId]!;
      const days = daysLeft(batch.expiry, s.today);
      return { batch, medicine, daysLeft: days, bucket: bucketForDaysLeft(days) };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function bucketCounts(views: BatchView[]): Record<ExpiryBucket, number> {
  const counts: Record<ExpiryBucket, number> = { SAFE: 0, LOCKOUT: 0, CRITICAL: 0, EXPIRED: 0 };
  for (const v of views) counts[v.bucket] += 1;
  return counts;
}

export interface EcoListing extends BatchView {
  discountPct: number;
  price: number;
  /** Longest course that still finishes before the medicine expires. */
  fitsCourseDays: number;
}

/** Eco-Sale batches customers can buy right now. */
export function ecoListings(s: AppState): EcoListing[] {
  return Object.values(s.batches)
    .filter((b) => b.status === 'ECO_SALE' && b.qty > 0)
    .flatMap((batch) => {
      const medicine = s.medicines[batch.medicineId];
      const store = s.stores[batch.storeId];
      if (!medicine || store?.kyc !== 'APPROVED') return [];
      if (!checkEcoSaleEligible(medicine, batch.expiry, s.today).ok) return [];
      const days = daysLeft(batch.expiry, s.today);
      const discountPct = batch.ecoDiscountPct ?? 0;
      return [
        {
          batch,
          medicine,
          daysLeft: days,
          bucket: bucketForDaysLeft(days),
          discountPct,
          price: ecoPrice(medicine.mrp, discountPct),
          fitsCourseDays: Math.max(0, days - 15),
        },
      ];
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Rough weight of one donated or incinerated pack, in kg. */
export const KG_PER_PACK = 0.02;

export interface Kpis {
  deadStockRecovered: number;
  hazardousKgDiverted: number;
  ngoMedicineValue: number;
  bloodDonationsBooked: number;
  bloodDonationsCompleted: number;
  ordersDelivered: number;
}

/** Impact numbers shown on the admin dashboard. Everything is a view of the state. */
export function kpis(s: AppState): Kpis {
  let deadStockRecovered = 0;
  for (const o of Object.values(s.orders)) {
    if (o.status !== 'DELIVERED') continue;
    for (const i of o.items) if (i.ecoSale) deadStockRecovered += i.qty * i.unitPrice;
  }
  let kg = 0;
  let ngoValue = 0;
  for (const p of Object.values(s.pickups)) {
    const packs = p.items.reduce((n, i) => n + i.qty, 0);
    if (p.status === 'INCINERATED') kg += packs * KG_PER_PACK;
    if (p.status === 'DELIVERED_TO_NGO') {
      ngoValue += p.items.reduce((n, i) => n + i.qty * (s.medicines[i.medicineId]?.mrp ?? 0), 0);
    }
  }
  const bookings = Object.values(s.bloodBookings);
  return {
    deadStockRecovered: round2(deadStockRecovered),
    hazardousKgDiverted: round2(kg),
    ngoMedicineValue: round2(ngoValue),
    bloodDonationsBooked: bookings.length,
    bloodDonationsCompleted: bookings.filter((b) => b.status === 'DONATED').length,
    ordersDelivered: Object.values(s.orders).filter((o) => o.status === 'DELIVERED').length,
  };
}

export type Mission =
  | { kind: 'DELIVERY'; order: Order }
  | { kind: 'NGO_PICKUP'; pickup: Pickup }
  | { kind: 'BIO_PICKUP'; pickup: Pickup };

/** Missions waiting for any rider: packed orders and scheduled pickups. */
export function openMissions(s: AppState): Mission[] {
  const deliveries: Mission[] = Object.values(s.orders)
    .filter((o) => o.status === 'PACKED' && !o.riderId)
    .map((order) => ({ kind: 'DELIVERY', order }));
  const pickups: Mission[] = Object.values(s.pickups)
    .filter((p) => p.status === 'SCHEDULED' && !p.riderId)
    .map((pickup) => ({ kind: pickup.kind === 'DONATION' ? 'NGO_PICKUP' : 'BIO_PICKUP', pickup }));
  return [...deliveries, ...pickups];
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Pending pickups close to a delivery address, so a return rides along on the same trip. */
export function backhaulSuggestions(s: AppState, order: Order, radiusKm = 0.6): Pickup[] {
  const customer = s.users[order.customerId];
  if (!customer || customer.lat === undefined || customer.lng === undefined) return [];
  const here = { lat: customer.lat, lng: customer.lng };
  return Object.values(s.pickups)
    .filter((p) => p.status === 'SCHEDULED' && !p.riderId && distanceKm(here, p) <= radiusKm)
    .sort((a, b) => distanceKm(here, a) - distanceKm(here, b));
}
