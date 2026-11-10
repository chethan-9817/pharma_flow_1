import { daysLeft, type IsoDate } from '../clock';
import { fail, ok, type Check } from '../result';

/**
 * Pooled bulk buying. Several stores ask for the same item, the platform pools the demand into one
 * tender, licensed dealers quote on it, and two rule-based agents negotiate the price:
 *
 *  - the buyer's agent works for the stores. It opens at the admin's target price and moves up
 *    towards the ceiling, the most the admin will pay;
 *  - each dealer's agent opens below the dealer's asking price and moves down towards the dealer's
 *    floor, the least that dealer will accept.
 *
 * Nothing here is random and nothing calls a service, so every round can be replayed and audited.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A tender needs demand from at least this many stores before dealers are asked to quote. */
export const MIN_POOL_STORES = 2;
export const MIN_DEMAND_QTY = 10;
export const MAX_DEMAND_QTY = 5000;
export const MAX_DELIVERY_DAYS = 30;
/** Delivered bulk stock must have at least this much shelf life left. */
export const MIN_DELIVERY_SHELF_DAYS = 180;

/** Demo assumption: a store normally buys from its distributor at about 80% of the MRP. */
export const USUAL_TRADE_PRICE_PCT = 80;
/** The price the buyer's agent opens at when the admin does not choose one: 65% of the MRP. */
export const DEFAULT_TARGET_PCT = 65;

export const usualTradePrice = (mrp: number) => round2((mrp * USUAL_TRADE_PRICE_PCT) / 100);
export const defaultTargetPrice = (mrp: number) => round2((mrp * DEFAULT_TARGET_PCT) / 100);

export function checkDemandQty(qty: number): Check {
  if (!Number.isInteger(qty)) return fail('Quantity must be a whole number of packs');
  if (qty < MIN_DEMAND_QTY) return fail(`A bulk request needs at least ${MIN_DEMAND_QTY} packs`);
  if (qty > MAX_DEMAND_QTY) return fail(`A bulk request can be at most ${MAX_DEMAND_QTY} packs`);
  return ok;
}

/** The admin's limits: a positive target, a ceiling at or above it, and never above the MRP. */
export function checkTenderPrices(targetPrice: number, ceilingPrice: number, mrp: number): Check {
  if (!(targetPrice > 0)) return fail('The target price must be more than zero');
  if (ceilingPrice < targetPrice) return fail('The ceiling price cannot be below the target price');
  if (ceilingPrice > mrp) return fail('The ceiling price cannot be above the MRP');
  return ok;
}

export interface QuoteTerms {
  askPrice: number;
  floorPrice: number;
  deliveryDays: number;
}

export function checkQuote(q: QuoteTerms, mrp: number): Check {
  if (!(q.floorPrice > 0)) return fail('The lowest price you accept must be more than zero');
  if (q.askPrice < q.floorPrice) return fail('Your asking price cannot be below your lowest price');
  if (q.askPrice > mrp) return fail('Your asking price cannot be above the MRP');
  if (!Number.isInteger(q.deliveryDays) || q.deliveryDays < 1) return fail('Delivery takes at least one day');
  if (q.deliveryDays > MAX_DELIVERY_DAYS) return fail(`Delivery must be within ${MAX_DELIVERY_DAYS} days`);
  return ok;
}

export function checkDeliveryExpiry(expiry: IsoDate, today: IsoDate): Check {
  if (daysLeft(expiry, today) < MIN_DELIVERY_SHELF_DAYS) {
    return fail(`Bulk stock must have at least ${MIN_DELIVERY_SHELF_DAYS} days of shelf life left`);
  }
  return ok;
}

export const NEGOTIATION_ROUNDS = 3;
/** How far the buyer's agent has moved from the target towards the ceiling in each round. */
const BUYER_STEPS = [0, 0.5, 1] as const;
/** How far a dealer's agent has moved from the asking price towards the floor in each round. */
const DEALER_STEPS = [0.4, 0.75, 1] as const;

export interface NegotiationRound {
  round: number;
  /** What the buyer's agent offers to pay per pack. */
  buyerOffer: number;
  /** What the dealer's agent offers to sell a pack for. */
  dealerOffer: number;
}

export interface NegotiationOutcome {
  rounds: NegotiationRound[];
  /** The dealer's last offer: the agreed price, or where the dealer stopped. */
  finalPrice: number;
  /** True when the dealer's offer came down to what the buyer's agent may pay. */
  agreed: boolean;
}

/**
 * One dealer against the buyer. Each round both agents move; the deal closes at the dealer's
 * offer as soon as it is no higher than the buyer's.
 */
export function negotiate(targetPrice: number, ceilingPrice: number, q: Pick<QuoteTerms, 'askPrice' | 'floorPrice'>): NegotiationOutcome {
  const rounds: NegotiationRound[] = [];
  for (let i = 0; i < NEGOTIATION_ROUNDS; i++) {
    const buyerOffer = round2(targetPrice + (ceilingPrice - targetPrice) * BUYER_STEPS[i]!);
    const dealerOffer = round2(q.askPrice - (q.askPrice - q.floorPrice) * DEALER_STEPS[i]!);
    rounds.push({ round: i + 1, buyerOffer, dealerOffer });
    if (dealerOffer <= buyerOffer) return { rounds, finalPrice: dealerOffer, agreed: true };
  }
  return { rounds, finalPrice: rounds[rounds.length - 1]!.dealerOffer, agreed: false };
}

const DELIVERY_DAY_PENALTY = 0.005;
const RATING_STAR_PENALTY = 0.02;

/**
 * The price used to compare offers: the agreed price, plus 0.5% for every delivery day and 2% for
 * every star the dealer is short of five. Lower is better.
 */
export function effectivePrice(finalPrice: number, deliveryDays: number, rating: number): number {
  return round2(finalPrice * (1 + DELIVERY_DAY_PENALTY * deliveryDays) * (1 + RATING_STAR_PENALTY * (5 - rating)));
}
