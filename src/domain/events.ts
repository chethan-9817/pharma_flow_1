import type { BulkQuote } from './bulk';
import type { IsoDate } from './clock';
import type {
  BloodBooking,
} from './state';
import type { Batch, Order, Pickup, Prescription, Sponsorship, Store } from './types';

/**
 * Every action in PharmaFlow is an immutable, typed domain event.
 * state = reduce(events). The reducer validates every event against the
 * business rules, so only valid events ever reach the log.
 */
interface Base {
  /** Unique event id. */
  id: string;
  /** Simulated date at which the event happened. */
  at: IsoDate;
  /** User who triggered the event. */
  actorId: string;
}

export type DomainEventPayload =
  // Admin and KYC
  | { type: 'STORE_REGISTERED'; store: Store }
  | { type: 'KYC_DECIDED'; storeId: string; decision: 'APPROVED' | 'REJECTED' }
  // Chemist inventory
  | { type: 'STOCK_INGESTED'; batch: Batch }
  | { type: 'ECO_SALE_LISTED'; batchId: string; discountPct: number }
  | { type: 'ECO_SALE_WITHDRAWN'; batchId: string }
  // Pickups (donation and bio-disposal)
  | { type: 'PICKUP_SCHEDULED'; pickup: Pickup }
  | { type: 'PICKUP_ACCEPTED'; pickupId: string; riderId: string }
  | { type: 'PICKUP_ARRIVED'; pickupId: string }
  | { type: 'PICKUP_COLLECTED'; pickupId: string }
  | { type: 'PICKUP_QA_VERIFIED'; pickupId: string; note?: string }
  | { type: 'PICKUP_QA_REJECTED'; pickupId: string; note: string }
  | { type: 'PICKUP_DELIVERED_TO_NGO'; pickupId: string }
  | { type: 'PICKUP_INCINERATED'; pickupId: string }
  // Orders
  | { type: 'ORDER_PLACED'; order: Order; prescription?: Prescription }
  | { type: 'RX_APPROVED'; orderId: string }
  | { type: 'RX_REJECTED'; orderId: string; reason: string }
  | { type: 'RX_RESUBMITTED'; orderId: string; prescription: Prescription }
  | { type: 'ORDER_CANCELLED'; orderId: string }
  | { type: 'ORDER_PACKED'; orderId: string }
  | { type: 'ORDER_ACCEPTED'; orderId: string; riderId: string }
  | { type: 'ORDER_ARRIVED'; orderId: string }
  | { type: 'ORDER_OUT_FOR_DELIVERY'; orderId: string }
  | { type: 'ORDER_DELIVERED'; orderId: string; otp: string }
  // Sponsor a batch for an NGO (the packs then travel as a pickup that starts at the store)
  | { type: 'SPONSORSHIP_PLACED'; sponsorship: Sponsorship }
  // Pooled bulk buying: stores ask, dealers quote, agents negotiate, the admin awards, the dealer delivers
  | { type: 'BULK_DEMAND_POSTED'; tenderId: string; storeId: string; medicineId: string; qty: number }
  | { type: 'BULK_TENDER_OPENED'; tenderId: string; targetPrice: number; ceilingPrice: number }
  | { type: 'BULK_QUOTE_SUBMITTED'; tenderId: string; quote: Omit<BulkQuote, 'submittedAt'> }
  | { type: 'BULK_NEGOTIATED'; tenderId: string }
  | { type: 'BULK_AWARDED'; tenderId: string; quoteId: string }
  | { type: 'BULK_DELIVERED'; tenderId: string; batchNo: string; expiry: IsoDate }
  | { type: 'BULK_CANCELLED'; tenderId: string }
  // Rewards
  | { type: 'SCRATCH_CARD_REVEALED'; cardId: string }
  // Blood
  | { type: 'BLOOD_BOOKED'; booking: BloodBooking }
  | { type: 'BLOOD_DONATION_CONFIRMED'; bookingId: string }
  // Riders
  | { type: 'RIDER_SHIFT_CHANGED'; riderId: string; online: boolean }
  // Presenter
  | { type: 'TIME_TRAVELLED'; to: IsoDate };

export type DomainEvent = Base & DomainEventPayload;
export type EventType = DomainEventPayload['type'];
