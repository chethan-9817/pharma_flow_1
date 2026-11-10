import { daysLeft } from './clock';
import type { AppState } from './state';
import type { Order, Store, User } from './types';

/** One row of the admin's store table: what each medical store holds and how busy it is. */
export interface StoreRow {
  store: Store;
  chemist?: User;
  /** Packs on the shelf that have not expired. */
  units: number;
  ecoListings: number;
  orders: number;
  /** Placed or packed, not yet delivered or cancelled. */
  activeOrders: number;
  delivered: number;
  /** Value of delivered orders. */
  sales: number;
}

const ACTIVE: Order['status'][] = ['PLACED', 'RX_APPROVED', 'PACKED', 'OUT_FOR_DELIVERY'];
const round2 = (n: number) => Math.round(n * 100) / 100;

export function storeRows(s: AppState): StoreRow[] {
  const users = Object.values(s.users);
  const orders = Object.values(s.orders);
  const batches = Object.values(s.batches);
  return Object.values(s.stores)
    .map((store) => {
      const mine = orders.filter((o) => o.storeId === store.id);
      const stock = batches.filter((b) => b.storeId === store.id && b.status !== 'CLOSED' && daysLeft(b.expiry, s.today) > 0);
      return {
        store,
        chemist: users.find((u) => u.role === 'chemist' && u.storeId === store.id),
        units: stock.reduce((n, b) => n + b.qty, 0),
        ecoListings: stock.filter((b) => b.status === 'ECO_SALE').length,
        orders: mine.length,
        activeOrders: mine.filter((o) => ACTIVE.includes(o.status)).length,
        delivered: mine.filter((o) => o.status === 'DELIVERED').length,
        sales: round2(mine.filter((o) => o.status === 'DELIVERED').reduce((n, o) => n + o.total, 0)),
      };
    })
    .sort((a, b) => b.orders - a.orders || a.store.name.localeCompare(b.store.name));
}

/** The headline counts of the whole network. */
export interface NetworkSummary {
  stores: number;
  storesApproved: number;
  storesPending: number;
  customers: number;
  riders: number;
  ridersOnline: number;
  dealers: number;
  orders: number;
  activeOrders: number;
  /** Active orders a rider has accepted. */
  assignedOrders: number;
  /** Packed orders still waiting for a rider. */
  waitingForRider: number;
  delivered: number;
}

export function networkSummary(s: AppState): NetworkSummary {
  const users = Object.values(s.users);
  const stores = Object.values(s.stores);
  const orders = Object.values(s.orders);
  const active = orders.filter((o) => ACTIVE.includes(o.status));
  return {
    stores: stores.length,
    storesApproved: stores.filter((x) => x.kyc === 'APPROVED').length,
    storesPending: stores.filter((x) => x.kyc === 'PENDING_KYC').length,
    customers: users.filter((u) => u.role === 'customer').length,
    riders: users.filter((u) => u.role === 'rider').length,
    ridersOnline: Object.values(s.riders).filter((r) => r.online).length,
    dealers: Object.keys(s.dealers).length,
    orders: orders.length,
    activeOrders: active.length,
    assignedOrders: active.filter((o) => o.riderId).length,
    waitingForRider: active.filter((o) => o.status === 'PACKED' && !o.riderId).length,
    delivered: orders.filter((o) => o.status === 'DELIVERED').length,
  };
}

/** One row of the admin's order table. */
export interface OrderRow {
  order: Order;
  customer: string;
  store: string;
  /** The rider the order is assigned to, if any. */
  rider?: string;
  packs: number;
}

/** The newest orders first. */
export function orderRows(s: AppState, limit = 12): OrderRow[] {
  return Object.values(s.orders)
    .reverse()
    .slice(0, limit)
    .map((order) => ({
      order,
      customer: s.users[order.customerId]?.name ?? order.customerId,
      store: s.stores[order.storeId]?.name ?? order.storeId,
      ...(order.riderId ? { rider: s.users[order.riderId]?.name ?? order.riderId } : {}),
      packs: order.items.reduce((n, i) => n + i.qty, 0),
    }));
}
