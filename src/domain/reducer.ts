import type { DomainEvent } from './events';
import type { Result } from './result';
import type { AppState } from './state';
import * as bulk from './handlers/bulk';
import * as civic from './handlers/civic';
import * as inventory from './handlers/inventory';
import * as orders from './handlers/orders';
import * as pickups from './handlers/pickups';
import * as sponsor from './handlers/sponsor';
import type { Step } from './handlers/common';

/**
 * Applies one event. Returns an error (and never throws) when the event breaks
 * a business rule, so callers can show the reason and keep the log clean.
 */
export function applyEvent(state: AppState, event: DomainEvent): Result<AppState> {
  return dispatch(state, event);
}

function dispatch(s: AppState, e: DomainEvent): Step {
  switch (e.type) {
    case 'STORE_REGISTERED':
      return inventory.storeRegistered(s, e);
    case 'KYC_DECIDED':
      return inventory.kycDecided(s, e);
    case 'STOCK_INGESTED':
      return inventory.stockIngested(s, e);
    case 'ECO_SALE_LISTED':
      return inventory.ecoSaleListed(s, e);
    case 'ECO_SALE_WITHDRAWN':
      return inventory.ecoSaleWithdrawn(s, e);
    case 'RIDER_SHIFT_CHANGED':
      return inventory.riderShiftChanged(s, e);
    case 'TIME_TRAVELLED':
      return inventory.timeTravelled(s, e);

    case 'PICKUP_SCHEDULED':
      return pickups.pickupScheduled(s, e);
    case 'PICKUP_ACCEPTED':
      return pickups.pickupAccepted(s, e);
    case 'PICKUP_ARRIVED':
      return pickups.pickupArrived(s, e);
    case 'PICKUP_COLLECTED':
      return pickups.pickupCollected(s, e);
    case 'PICKUP_QA_VERIFIED':
      return pickups.pickupQaVerified(s, e);
    case 'PICKUP_QA_REJECTED':
      return pickups.pickupQaRejected(s, e);
    case 'PICKUP_DELIVERED_TO_NGO':
      return pickups.pickupDeliveredToNgo(s, e);
    case 'PICKUP_INCINERATED':
      return pickups.pickupIncinerated(s, e);

    case 'ORDER_PLACED':
      return orders.orderPlaced(s, e);
    case 'RX_APPROVED':
      return orders.rxApproved(s, e);
    case 'RX_REJECTED':
      return orders.rxRejected(s, e);
    case 'RX_RESUBMITTED':
      return orders.rxResubmitted(s, e);
    case 'ORDER_CANCELLED':
      return orders.orderCancelled(s, e);
    case 'ORDER_PACKED':
      return orders.orderPacked(s, e);
    case 'ORDER_ACCEPTED':
      return orders.orderAccepted(s, e);
    case 'ORDER_ARRIVED':
      return orders.orderArrived(s, e);
    case 'ORDER_OUT_FOR_DELIVERY':
      return orders.orderOutForDelivery(s, e);
    case 'ORDER_DELIVERED':
      return orders.orderDelivered(s, e);

    case 'SPONSORSHIP_PLACED':
      return sponsor.sponsorshipPlaced(s, e);

    case 'BULK_DEMAND_POSTED':
      return bulk.bulkDemandPosted(s, e);
    case 'BULK_TENDER_OPENED':
      return bulk.bulkTenderOpened(s, e);
    case 'BULK_QUOTE_SUBMITTED':
      return bulk.bulkQuoteSubmitted(s, e);
    case 'BULK_NEGOTIATED':
      return bulk.bulkNegotiated(s, e);
    case 'BULK_AWARDED':
      return bulk.bulkAwarded(s, e);
    case 'BULK_DELIVERED':
      return bulk.bulkDelivered(s, e);
    case 'BULK_CANCELLED':
      return bulk.bulkCancelled(s, e);

    case 'SCRATCH_CARD_REVEALED':
      return civic.scratchCardRevealed(s, e);
    case 'BLOOD_BOOKED':
      return civic.bloodBooked(s, e);
    case 'BLOOD_DONATION_CONFIRMED':
      return civic.bloodDonationConfirmed(s, e);
  }
}

/** Replays stored events. Stored events were validated when they were appended. */
export function reduce(initial: AppState, events: readonly DomainEvent[]): AppState {
  let state = initial;
  for (const event of events) {
    const result = applyEvent(state, event);
    if (!result.ok) throw new Error(`Event ${event.id} (${event.type}) is invalid: ${result.error}`);
    state = result.value;
  }
  return state;
}
