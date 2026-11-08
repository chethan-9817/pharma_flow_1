import { addDays, daysBetween, daysLeft, type IsoDate } from './clock';
import { ecoPrice, checkEcoSaleEligible } from './rules/ecoSale';
import { bucketForDaysLeft, type ExpiryBucket } from './rules/expiry';
import type { FundEntryKind } from './rules/fund';
import { buildWriteOffCertificate, type WriteOffCertificate } from './rules/gst';
import type { AppState, NgoFund } from './state';
import type { Batch, Medicine, Order, Pickup, Sponsorship } from './types';

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

export interface CourseReminder {
  orderId: string;
  medicineId: string;
  /** The day the course ended, counted from the order date. */
  endedOn: IsoDate;
  courseDays: number;
}

/**
 * "Finished your 5-day course of Dolo 650? Donate the unopened tablets left to an NGO."
 * A reminder appears for each delivered, non-cold-chain medicine once its course length has
 * passed on the simulated clock, so time travel makes reminders show up during a demo.
 */
export function courseReminders(s: AppState, userId: string): CourseReminder[] {
  const out: CourseReminder[] = [];
  for (const o of Object.values(s.orders)) {
    if (o.customerId !== userId || o.status !== 'DELIVERED') continue;
    const seen = new Set<string>();
    for (const item of o.items) {
      const m = s.medicines[item.medicineId];
      if (!m || m.coldChain || m.schedule === 'X' || seen.has(m.id)) continue;
      seen.add(m.id);
      if (daysBetween(o.placedAt, s.today) >= m.courseDays) {
        out.push({ orderId: o.id, medicineId: m.id, endedOn: addDays(o.placedAt, m.courseDays), courseDays: m.courseDays });
      }
    }
  }
  return out.sort((a, b) => b.endedOn.localeCompare(a.endedOn));
}

export interface SponsorshipView {
  sponsorship: Sponsorship;
  medicine: Medicine;
  storeName: string;
  ngoName: string;
  pickup: Pickup | undefined;
}

function viewSponsorship(s: AppState, sponsorship: Sponsorship): SponsorshipView {
  return {
    sponsorship,
    medicine: s.medicines[sponsorship.medicineId]!,
    storeName: s.stores[sponsorship.storeId]?.name ?? sponsorship.storeId,
    ngoName: s.ngos[sponsorship.ngoId]?.name ?? 'an NGO',
    pickup: s.pickups[sponsorship.pickupId],
  };
}

/** A customer's sponsorships, newest first. */
export function customerSponsorships(s: AppState, userId: string): SponsorshipView[] {
  return Object.values(s.sponsorships)
    .filter((sp) => sp.customerId === userId)
    .map((sp) => viewSponsorship(s, sp))
    .reverse();
}

export interface StoreSponsorships {
  items: SponsorshipView[];
  /** Packs the store has handed over for NGOs (delivered sponsorships only). */
  packsDelivered: number;
  /** What the store has been paid for those packs. */
  paidOut: number;
  /** Money the store will be paid once the NGO has the packs. */
  pending: number;
}

/** Sponsorships that draw on a store's stock, with what the store has earned and is still owed. */
export function storeSponsorships(s: AppState, storeId: string): StoreSponsorships {
  const items = Object.values(s.sponsorships)
    .filter((sp) => sp.storeId === storeId)
    .map((sp) => viewSponsorship(s, sp))
    .reverse();
  const sum = (status: Sponsorship['status'], pick: (sp: Sponsorship) => number) =>
    round2(items.filter((v) => v.sponsorship.status === status).reduce((n, v) => n + pick(v.sponsorship), 0));
  return {
    items,
    packsDelivered: sum('DELIVERED', (sp) => sp.qty),
    paidOut: sum('DELIVERED', (sp) => sp.storePayout),
    pending: sum('PLACED', (sp) => sp.storePayout),
  };
}

export interface FundSummary {
  balance: number;
  /** Change from "Sponsor batch for NGO" payments. */
  fromSponsors: number;
  /** The platform's share of its fee on delivered orders. */
  fromPlatform: number;
  /** Packs sponsored for NGOs and already in their hands. */
  packsSponsored: number;
  sponsorsPending: number;
  /** Newest first. */
  recent: NgoFund['entries'];
}

export function fundSummary(s: AppState): FundSummary {
  const entries = s.ngoFund.entries;
  const total = (kind: FundEntryKind) => round2(entries.filter((e) => e.kind === kind).reduce((n, e) => n + e.amount, 0));
  const sponsorships = Object.values(s.sponsorships);
  return {
    balance: s.ngoFund.balance,
    fromSponsors: total('SPONSOR_CHANGE'),
    fromPlatform: total('PLATFORM_SHARE'),
    packsSponsored: sponsorships.filter((sp) => sp.status === 'DELIVERED').reduce((n, sp) => n + sp.qty, 0),
    sponsorsPending: sponsorships.filter((sp) => sp.status === 'PLACED').length,
    recent: [...entries].reverse(),
  };
}

/** What the NGO fund received from one delivered order, so the customer can see where their order helped. */
export function orderFundShare(s: AppState, orderId: string): number {
  return s.ngoFund.entries.find((e) => e.kind === 'PLATFORM_SHARE' && e.refId === orderId)?.amount ?? 0;
}

export interface StoreWriteOff {
  pickup: Pickup;
  certificate: WriteOffCertificate;
}

/**
 * Write-off receipts for a store's finished donations and disposals. Each carries the GST ITC
 * reversal (CGST Sec 17(5)(h)). A donation that failed the pharmacist's check ends in incineration,
 * so it is written off as bio-disposal instead.
 */
export function storeWriteOffs(s: AppState, storeId: string): StoreWriteOff[] {
  return Object.values(s.pickups)
    .filter((p) => p.sourceStoreId === storeId && (p.status === 'DELIVERED_TO_NGO' || p.status === 'INCINERATED'))
    // Packs a customer sponsored were sold to that customer (and paid for), so they are not a write-off.
    .filter((p) => !(p.sponsorshipId && p.status === 'DELIVERED_TO_NGO'))
    .map((pickup) => {
      const donated = pickup.status === 'DELIVERED_TO_NGO';
      const recipient = donated ? (pickup.ngoId ? s.ngos[pickup.ngoId]?.name : undefined) ?? 'NGO' : s.cbwtf.name;
      const certificate = buildWriteOffCertificate({
        reason: donated ? 'NGO_DONATION' : 'BIO_DISPOSAL',
        recipient,
        issuedOn: s.today,
        lines: pickup.items.map((i) => ({
          brand: s.medicines[i.medicineId]?.brand ?? i.medicineId,
          batchNo: i.batchNo,
          expiry: i.expiry,
          qty: i.qty,
          mrp: s.medicines[i.medicineId]?.mrp ?? 0,
        })),
      });
      return { pickup, certificate };
    })
    .reverse();
}
