import { daysLeft } from './clock';
import type { Result } from './result';
import { ecoPrice } from './rules/ecoSale';
import { checkItemsSellable, orderNeedsRx } from './rules/prescription';
import { applyWalletCredit } from './rules/rewards';
import { distanceKm } from './selectors';
import type { AppState } from './state';
import type { Batch, Order, OrderItem } from './types';

/** A cart line. With a batchId it is an Eco-Sale (or specific-batch) line, otherwise the shop picks the batch. */
export interface CartLine {
  medicineId: string;
  qty: number;
  batchId?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** First-expiry-first-out among batches that can be sold at full price today. */
export function regularBatches(s: AppState, storeId: string, medicineId: string): Batch[] {
  return Object.values(s.batches)
    .filter((b) => b.storeId === storeId && b.medicineId === medicineId && b.status === 'IN_STOCK' && b.qty > 0 && daysLeft(b.expiry, s.today) > 0)
    .sort((a, b) => a.expiry.localeCompare(b.expiry));
}

export function stockFor(s: AppState, storeId: string, medicineId: string): number {
  return regularBatches(s, storeId, medicineId).reduce((n, b) => n + b.qty, 0);
}

/** Nearest KYC-approved store to the customer. */
export function nearestStoreId(s: AppState, userId: string): string | undefined {
  const user = s.users[userId];
  const stores = Object.values(s.stores).filter((x) => x.kyc === 'APPROVED');
  if (user?.lat === undefined || user.lng === undefined) return stores[0]?.id;
  const here = { lat: user.lat, lng: user.lng };
  return [...stores].sort((a, b) => distanceKm(here, a) - distanceKm(here, b))[0]?.id;
}

export interface Quote {
  items: OrderItem[];
  subtotal: number;
  /** How much cheaper than full MRP because of Eco-Sale. */
  ecoSavings: number;
  needsRx: boolean;
}

/** Resolves cart lines into order items with real batches and prices. Fails when stock is short. */
export function quoteCart(s: AppState, storeId: string, lines: CartLine[]): Result<Quote> {
  if (lines.length === 0) return { ok: false, error: 'Your cart is empty' };
  const items: OrderItem[] = [];
  const used: Record<string, number> = {};
  let ecoSavings = 0;

  for (const line of lines) {
    const medicine = s.medicines[line.medicineId];
    if (!medicine) return { ok: false, error: `Unknown medicine ${line.medicineId}` };
    if (!Number.isInteger(line.qty) || line.qty <= 0) return { ok: false, error: `${medicine.brand}: choose a valid quantity` };

    if (line.batchId) {
      const batch = s.batches[line.batchId];
      if (!batch || batch.storeId !== storeId) return { ok: false, error: `${medicine.brand}: this deal is no longer available` };
      const free = batch.qty - (used[batch.id] ?? 0);
      if (batch.status !== 'ECO_SALE' && batch.status !== 'IN_STOCK') return { ok: false, error: `${medicine.brand}: this deal is no longer available` };
      if (line.qty > free) return { ok: false, error: `Only ${free} of ${medicine.brand} left in this batch` };
      const eco = batch.status === 'ECO_SALE';
      const unitPrice = eco ? ecoPrice(medicine.mrp, batch.ecoDiscountPct ?? 0) : medicine.mrp;
      used[batch.id] = (used[batch.id] ?? 0) + line.qty;
      if (eco) ecoSavings += (medicine.mrp - unitPrice) * line.qty;
      items.push({ medicineId: medicine.id, batchId: batch.id, qty: line.qty, unitPrice, ecoSale: eco });
      continue;
    }

    let remaining = line.qty;
    for (const batch of regularBatches(s, storeId, medicine.id)) {
      if (remaining === 0) break;
      const free = batch.qty - (used[batch.id] ?? 0);
      const take = Math.min(free, remaining);
      if (take <= 0) continue;
      used[batch.id] = (used[batch.id] ?? 0) + take;
      items.push({ medicineId: medicine.id, batchId: batch.id, qty: take, unitPrice: medicine.mrp, ecoSale: false });
      remaining -= take;
    }
    if (remaining > 0) return { ok: false, error: `Only ${line.qty - remaining} of ${medicine.brand} in stock` };
  }

  const sellable = checkItemsSellable(items, (id) => s.medicines[id]);
  if (!sellable.ok) return { ok: false, error: sellable.reason };

  return {
    ok: true,
    value: {
      items,
      subtotal: round2(items.reduce((n, i) => n + i.qty * i.unitPrice, 0)),
      ecoSavings: round2(ecoSavings),
      needsRx: orderNeedsRx(items, (id) => s.medicines[id]),
    },
  };
}

export interface CheckoutInput {
  customerId: string;
  storeId: string;
  lines: CartLine[];
  /** How much MedWallet credit the customer wants to use. */
  walletToUse: number;
  orderId: string;
  otp: string;
  /** Id for the prescription that will be uploaded, when the cart needs one. */
  prescriptionId?: string;
}

/** Builds the order for an ORDER_PLACED event. The reducer re-checks every rule. */
export function planOrder(s: AppState, input: CheckoutInput): Result<{ order: Order; quote: Quote }> {
  const quote = quoteCart(s, input.storeId, input.lines);
  if (!quote.ok) return quote;
  const q = quote.value;
  if (q.needsRx && !input.prescriptionId) return { ok: false, error: 'Upload a prescription to check out' };
  const wallet = applyWalletCredit(s.wallet[input.customerId] ?? 0, q.subtotal);
  const walletUsed = Math.min(wallet.used, Math.max(0, input.walletToUse));
  const order: Order = {
    id: input.orderId,
    customerId: input.customerId,
    storeId: input.storeId,
    items: q.items,
    status: 'PLACED',
    rxStatus: q.needsRx ? 'PENDING' : 'NOT_REQUIRED',
    ...(q.needsRx ? { prescriptionId: input.prescriptionId } : {}),
    walletUsed,
    deliveryOtp: input.otp,
    total: q.subtotal,
    placedAt: s.today,
  };
  return { ok: true, value: { order, quote: q } };
}
