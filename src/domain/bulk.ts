import type { IsoDate } from './clock';
import { usualTradePrice, type NegotiationRound } from './rules/bulk';
import type { AppState } from './state';
import type { Dealer, Medicine, Store } from './types';

/** One store's share of a pooled bulk order. */
export interface BulkDemand {
  storeId: string;
  qty: number;
  postedAt: IsoDate;
  /** When this store paid PharmaFlow for its share. */
  paidAt?: IsoDate;
}

/** A dealer's sealed quote. The floor is the dealer's private limit for its negotiating agent. */
export interface BulkQuote {
  id: string;
  dealerId: string;
  /** Opening price per pack. */
  askPrice: number;
  /** The lowest price per pack the dealer's agent may go down to. */
  floorPrice: number;
  deliveryDays: number;
  submittedAt: IsoDate;
}

export interface BulkNegotiation {
  quoteId: string;
  dealerId: string;
  rounds: NegotiationRound[];
  finalPrice: number;
  agreed: boolean;
  /** Price adjusted for delivery time and dealer rating. Lower is better. */
  effectivePrice: number;
}

/**
 * COLLECTING: stores are still joining. OPEN: dealers may quote. NEGOTIATED: the agents have run.
 * AWARDED: the admin picked a dealer. DELIVERED: the stock is on the stores' shelves.
 */
export type TenderStatus = 'COLLECTING' | 'OPEN' | 'NEGOTIATED' | 'AWARDED' | 'DELIVERED' | 'CANCELLED';

export interface BulkTender {
  id: string;
  medicineId: string;
  status: TenderStatus;
  demands: BulkDemand[];
  createdAt: IsoDate;
  /** Set when the admin opens the tender for quotes. */
  targetPrice?: number;
  ceilingPrice?: number;
  quotes: BulkQuote[];
  negotiation?: BulkNegotiation[];
  /** The agreed offer with the best effective price. */
  recommendedQuoteId?: string;
  awardedQuoteId?: string;
  /** Price per pack every store pays. */
  finalPrice?: number;
  awardedAt?: IsoDate;
  deliveredAt?: IsoDate;
  /** When PharmaFlow paid the winning dealer for the whole order. */
  dealerPaidAt?: IsoDate;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const tenderQty = (t: BulkTender): number => t.demands.reduce((n, d) => n + d.qty, 0);

/** The tender for this item that stores can still join, if there is one. */
export function collectingTender(s: AppState, medicineId: string): BulkTender | undefined {
  return Object.values(s.bulkTenders).find((t) => t.medicineId === medicineId && t.status === 'COLLECTING');
}

export interface TenderView {
  tender: BulkTender;
  medicine: Medicine;
  qty: number;
  stores: { store: Store; qty: number; /** What this store owes PharmaFlow, once a price is agreed. */ amount?: number; paid: boolean }[];
  /** What the stores would normally pay their own distributors for this quantity. */
  usualCost: number;
  /** Set once a dealer is awarded. */
  finalCost?: number;
  savings?: number;
  awardedDealer?: Dealer;
  /** PharmaFlow pays the dealer the whole order (finalCost) once it is delivered. */
  dealerPaid: boolean;
  /** Received so far from the stores, and what they still owe. Both 0 until a price is agreed. */
  collected: number;
  outstanding: number;
}

export function tenderView(s: AppState, tender: BulkTender): TenderView {
  const medicine = s.medicines[tender.medicineId]!;
  const qty = tenderQty(tender);
  const usualCost = round2(usualTradePrice(medicine.mrp) * qty);
  const awarded = tender.quotes.find((q) => q.id === tender.awardedQuoteId);
  const finalCost = tender.finalPrice === undefined ? undefined : round2(tender.finalPrice * qty);
  const collected = round2(tender.demands.filter((d) => d.paidAt).reduce((n, d) => n + storeShare(tender, d.storeId), 0));
  return {
    tender,
    medicine,
    qty,
    stores: tender.demands.map((d) => ({
      store: s.stores[d.storeId]!,
      qty: d.qty,
      ...(tender.finalPrice === undefined ? {} : { amount: storeShare(tender, d.storeId) }),
      paid: Boolean(d.paidAt),
    })),
    dealerPaid: Boolean(tender.dealerPaidAt),
    collected,
    outstanding: finalCost === undefined ? 0 : round2(finalCost - collected),
    usualCost,
    ...(finalCost === undefined ? {} : { finalCost, savings: round2(usualCost - finalCost) }),
    ...(awarded ? { awardedDealer: s.dealers[awarded.dealerId] } : {}),
  };
}

const ORDER: Record<TenderStatus, number> = { NEGOTIATED: 0, OPEN: 1, COLLECTING: 2, AWARDED: 3, DELIVERED: 4, CANCELLED: 5 };

/** Every tender, the ones that need a decision first. */
export function allTenders(s: AppState): TenderView[] {
  return Object.values(s.bulkTenders)
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.createdAt.localeCompare(a.createdAt))
    .map((t) => tenderView(s, t));
}

export const storeTenders = (s: AppState, storeId: string): TenderView[] =>
  allTenders(s).filter((v) => v.tender.demands.some((d) => d.storeId === storeId));

/** What a dealer sees: tenders open for quotes, plus everything this dealer has quoted on. */
export const dealerTenders = (s: AppState, dealerId: string): TenderView[] =>
  allTenders(s).filter((v) => v.tender.status === 'OPEN' || v.tender.quotes.some((q) => q.dealerId === dealerId));

export interface BulkSummary {
  open: number;
  delivered: number;
  packsDelivered: number;
  /** Saved against the usual trade price, across delivered and awarded tenders. */
  savings: number;
  /** Money PharmaFlow has paid dealers for delivered orders. */
  paidToDealers: number;
  /** Delivered orders PharmaFlow still has to pay the dealer for. */
  owedToDealers: number;
  /** Money the stores have paid PharmaFlow for their shares. */
  receivedFromStores: number;
  /** Shares of delivered orders the stores have not paid yet. */
  owedByStores: number;
}

export function bulkSummary(s: AppState): BulkSummary {
  const views = allTenders(s);
  const won = views.filter((v) => v.tender.status === 'AWARDED' || v.tender.status === 'DELIVERED');
  const delivered = views.filter((v) => v.tender.status === 'DELIVERED');
  const sum = (list: TenderView[], f: (v: TenderView) => number) => round2(list.reduce((n, v) => n + f(v), 0));
  return {
    paidToDealers: sum(delivered.filter((v) => v.dealerPaid), (v) => v.finalCost ?? 0),
    owedToDealers: sum(delivered.filter((v) => !v.dealerPaid), (v) => v.finalCost ?? 0),
    receivedFromStores: sum(delivered, (v) => v.collected),
    owedByStores: sum(delivered, (v) => v.outstanding),
    open: views.filter((v) => ['COLLECTING', 'OPEN', 'NEGOTIATED'].includes(v.tender.status)).length,
    delivered: views.filter((v) => v.tender.status === 'DELIVERED').length,
    packsDelivered: views.filter((v) => v.tender.status === 'DELIVERED').reduce((n, v) => n + v.qty, 0),
    savings: round2(won.reduce((n, v) => n + (v.savings ?? 0), 0)),
  };
}

/** What one store owes PharmaFlow for its share: its packs at the agreed price. */
export function storeShare(tender: BulkTender, storeId: string): number {
  const d = tender.demands.find((x) => x.storeId === storeId);
  return d && tender.finalPrice !== undefined ? round2(d.qty * tender.finalPrice) : 0;
}

/** The id of the batch a delivered tender puts on a store's shelf. */
export const bulkBatchId = (tenderId: string, storeId: string) => `b-${tenderId}-${storeId}`;
