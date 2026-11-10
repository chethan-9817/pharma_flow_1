import { bulkBatchId, collectingTender, type BulkNegotiation, type BulkTender } from '../bulk';
import {
  MIN_POOL_STORES,
  checkDeliveryExpiry,
  checkDemandQty,
  checkQuote,
  checkTenderPrices,
  effectivePrice,
  negotiate,
} from '../rules/bulk';
import { isBlocked } from '../rules/prescription';
import type { AppState } from '../state';
import type { Batch } from '../types';
import { done, err, failed, requireApprovedStore, requireChemistOf, requireRole, type Ev, type Step } from './common';

const put = (s: AppState, tender: BulkTender): AppState => ({ ...s, bulkTenders: { ...s.bulkTenders, [tender.id]: tender } });

/** The dealer a user quotes for, or an error when the actor is not a dealer. */
function dealerOf(s: AppState, actorId: string): string | Step {
  const user = s.users[actorId];
  if (!user || user.role !== 'dealer' || !user.dealerId) return err('Only a dealer can do this');
  if (!s.dealers[user.dealerId]) return err('Unknown dealer');
  return user.dealerId;
}

/** A store asks for bulk stock. It joins the pool for that item, or starts one. */
export function bulkDemandPosted(s: AppState, e: Ev<'BULK_DEMAND_POSTED'>): Step {
  const bad =
    failed(requireChemistOf(s, e.actorId, e.storeId)) ??
    failed(requireApprovedStore(s, e.storeId)) ??
    failed(checkDemandQty(e.qty));
  if (bad) return bad;
  const medicine = s.medicines[e.medicineId];
  if (!medicine) return err('Unknown item');
  if (isBlocked(medicine)) return err(`${medicine.brand} is Schedule X / NDPS and cannot be ordered`);

  const demand = { storeId: e.storeId, qty: e.qty, postedAt: s.today };
  const existing = s.bulkTenders[e.tenderId];
  if (existing) {
    if (existing.medicineId !== e.medicineId) return err('This pool is for a different item');
    if (existing.status !== 'COLLECTING') return err('This pool is closed to new requests');
    // A store that asks again replaces its earlier quantity.
    const demands = [...existing.demands.filter((d) => d.storeId !== e.storeId), demand];
    return done(put(s, { ...existing, demands }));
  }
  const open = collectingTender(s, e.medicineId);
  if (open) return err(`Other stores are already pooling ${medicine.brand}. Join that pool instead`);
  return done(
    put(s, { id: e.tenderId, medicineId: e.medicineId, status: 'COLLECTING', demands: [demand], createdAt: s.today, quotes: [] }),
  );
}

/** The admin closes the pool and asks dealers to quote, with the buyer agent's two limits. */
export function bulkTenderOpened(s: AppState, e: Ev<'BULK_TENDER_OPENED'>): Step {
  const bad = failed(requireRole(s, e.actorId, 'admin'));
  if (bad) return bad;
  const tender = s.bulkTenders[e.tenderId];
  if (!tender) return err('Unknown bulk order');
  if (tender.status !== 'COLLECTING') return err('This bulk order is already open for quotes');
  if (tender.demands.length < MIN_POOL_STORES) return err(`Wait for at least ${MIN_POOL_STORES} stores to join before asking dealers`);
  const medicine = s.medicines[tender.medicineId]!;
  const prices = failed(checkTenderPrices(e.targetPrice, e.ceilingPrice, medicine.mrp));
  if (prices) return prices;
  return done(put(s, { ...tender, status: 'OPEN', targetPrice: e.targetPrice, ceilingPrice: e.ceilingPrice }));
}

/** A dealer quotes. Quoting again replaces that dealer's earlier quote while the tender is open. */
export function bulkQuoteSubmitted(s: AppState, e: Ev<'BULK_QUOTE_SUBMITTED'>): Step {
  const dealerId = dealerOf(s, e.actorId);
  if (typeof dealerId !== 'string') return dealerId;
  const tender = s.bulkTenders[e.tenderId];
  if (!tender) return err('Unknown bulk order');
  if (tender.status !== 'OPEN') return err('This bulk order is not open for quotes');
  if (e.quote.dealerId !== dealerId) return err('You can only quote for your own company');
  if (tender.quotes.some((q) => q.id === e.quote.id && q.dealerId !== dealerId)) return err('Quote already exists');
  const medicine = s.medicines[tender.medicineId]!;
  const terms = failed(checkQuote(e.quote, medicine.mrp));
  if (terms) return terms;
  const quotes = [...tender.quotes.filter((q) => q.dealerId !== dealerId), { ...e.quote, submittedAt: s.today }];
  return done(put(s, { ...tender, quotes }));
}

/** The admin starts the agents. The rounds are worked out here, so they are the same on every replay. */
export function bulkNegotiated(s: AppState, e: Ev<'BULK_NEGOTIATED'>): Step {
  const bad = failed(requireRole(s, e.actorId, 'admin'));
  if (bad) return bad;
  const tender = s.bulkTenders[e.tenderId];
  if (!tender) return err('Unknown bulk order');
  if (tender.status !== 'OPEN') return err('This bulk order is not open for quotes');
  if (tender.quotes.length === 0) return err('No dealer has quoted yet');
  const { targetPrice, ceilingPrice } = tender;
  if (targetPrice === undefined || ceilingPrice === undefined) return err('This bulk order has no price limits');

  const negotiation: BulkNegotiation[] = tender.quotes.map((q) => {
    const outcome = negotiate(targetPrice, ceilingPrice, q);
    return {
      quoteId: q.id,
      dealerId: q.dealerId,
      ...outcome,
      effectivePrice: effectivePrice(outcome.finalPrice, q.deliveryDays, s.dealers[q.dealerId]?.rating ?? 3),
    };
  });
  const best = negotiation.filter((n) => n.agreed).sort((a, b) => a.effectivePrice - b.effectivePrice || a.finalPrice - b.finalPrice)[0];
  return done(put(s, { ...tender, status: 'NEGOTIATED', negotiation, ...(best ? { recommendedQuoteId: best.quoteId } : {}) }));
}

/** The admin picks a dealer. Only an offer the agents agreed on (within the ceiling) can win. */
export function bulkAwarded(s: AppState, e: Ev<'BULK_AWARDED'>): Step {
  const bad = failed(requireRole(s, e.actorId, 'admin'));
  if (bad) return bad;
  const tender = s.bulkTenders[e.tenderId];
  if (!tender) return err('Unknown bulk order');
  if (tender.status !== 'NEGOTIATED') return err('Run the negotiation before awarding');
  const result = tender.negotiation?.find((n) => n.quoteId === e.quoteId);
  if (!result) return err('Unknown quote');
  if (!result.agreed) return err('This dealer did not come down to the ceiling price');
  return done(put(s, { ...tender, status: 'AWARDED', awardedQuoteId: e.quoteId, finalPrice: result.finalPrice, awardedAt: s.today }));
}

/** The winning dealer delivers: every store in the pool gets its share as a fresh batch. */
export function bulkDelivered(s: AppState, e: Ev<'BULK_DELIVERED'>): Step {
  const dealerId = dealerOf(s, e.actorId);
  if (typeof dealerId !== 'string') return dealerId;
  const tender = s.bulkTenders[e.tenderId];
  if (!tender) return err('Unknown bulk order');
  if (tender.status !== 'AWARDED') return err('This bulk order is not waiting for delivery');
  const awarded = tender.quotes.find((q) => q.id === tender.awardedQuoteId);
  if (awarded?.dealerId !== dealerId) return err('Only the dealer that won this order can deliver it');
  if (!e.batchNo.trim()) return err('Enter the batch number on the cartons');
  const shelf = failed(checkDeliveryExpiry(e.expiry, s.today));
  if (shelf) return shelf;

  const batches = { ...s.batches };
  for (const d of tender.demands) {
    const batch: Batch = {
      id: bulkBatchId(tender.id, d.storeId),
      storeId: d.storeId,
      medicineId: tender.medicineId,
      batchNo: e.batchNo.trim(),
      expiry: e.expiry,
      qty: d.qty,
      status: 'IN_STOCK',
    };
    batches[batch.id] = batch;
  }
  return done({ ...put(s, { ...tender, status: 'DELIVERED', deliveredAt: s.today }), batches });
}

/** The admin calls a bulk order off, at any point before a dealer is awarded. */
export function bulkCancelled(s: AppState, e: Ev<'BULK_CANCELLED'>): Step {
  const bad = failed(requireRole(s, e.actorId, 'admin'));
  if (bad) return bad;
  const tender = s.bulkTenders[e.tenderId];
  if (!tender) return err('Unknown bulk order');
  if (!['COLLECTING', 'OPEN', 'NEGOTIATED'].includes(tender.status)) return err('This bulk order can no longer be cancelled');
  return done(put(s, { ...tender, status: 'CANCELLED' }));
}
