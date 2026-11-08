import { isTerminal } from './machines/pickup';
import { distanceKm } from './selectors';
import type { AppState } from './state';
import type { Order, Pickup, Store } from './types';

export interface LatLng {
  lat: number;
  lng: number;
}

export type StopKind = 'PICKUP' | 'STORE' | 'HOME' | 'NGO' | 'CBWTF';

/** One place the rider has to go to. */
export interface Stop extends LatLng {
  /** Unique within a route: mission id + stop kind. */
  id: string;
  kind: StopKind;
  label: string;
  /** Short line shown under the label, such as the address. */
  detail: string;
  /** Demo phone number for the Call button, when there is someone to call. */
  phone?: string;
  missionId: string;
}

/** Where the rider is now, and whether they are travelling toward the first stop. */
export interface Route {
  stops: Stop[];
  from: LatLng;
  /** False while the rider is waiting at the first stop (arrived, not yet collected). */
  moving: boolean;
}

export interface RouteStats {
  /** Distance and time from the previous point to each stop. */
  legs: { km: number; minutes: number }[];
  totalKm: number;
  totalMinutes: number;
}

/** Average speed of a city scooter, used for ETAs. */
export const RIDER_SPEED_KMH = 25;
/** Stops closer than this are treated as the same place. */
const SAME_PLACE_KM = 0.05;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The rider's starting point: about 800 m from the first approved store. */
export function riderHome(s: AppState): LatLng {
  const store = Object.values(s.stores).find((x) => x.kyc === 'APPROVED') ?? Object.values(s.stores)[0];
  return store ? { lat: store.lat - 0.006, lng: store.lng + 0.005 } : { lat: 12.8698, lng: 74.843 };
}

function chemistPhone(s: AppState, storeId: string): string | undefined {
  return Object.values(s.users).find((u) => u.role === 'chemist' && u.storeId === storeId)?.phone;
}

function storeStop(s: AppState, store: Store, missionId: string, label: string): Stop {
  return {
    id: `${missionId}:STORE`,
    kind: 'STORE',
    label,
    detail: `${store.name}, ${store.area}`,
    lat: store.lat,
    lng: store.lng,
    missionId,
    ...(chemistPhone(s, store.id) ? { phone: chemistPhone(s, store.id) } : {}),
  };
}

interface Plan {
  stops: Stop[];
  /** Where the rider is coming from once past a pickup. Null means the rider's home. */
  origin: LatLng | null;
  /** True when the rider has arrived at stops[0] and is waiting there. */
  atFirst: boolean;
}

function planOrder(s: AppState, o: Order): Plan | null {
  const store = s.stores[o.storeId];
  const customer = s.users[o.customerId];
  if (!store || !customer || customer.lat === undefined || customer.lng === undefined) return null;
  const home: Stop = {
    id: `${o.id}:HOME`,
    kind: 'HOME',
    label: `Deliver to ${customer.name}`,
    detail: customer.address ?? 'Customer address',
    lat: customer.lat,
    lng: customer.lng,
    missionId: o.id,
    ...(customer.phone ? { phone: customer.phone } : {}),
  };
  if (o.status === 'PACKED') {
    return {
      stops: [storeStop(s, store, o.id, `Collect at ${store.name}`), home],
      origin: null,
      atFirst: Boolean(o.riderArrived),
    };
  }
  if (o.status === 'OUT_FOR_DELIVERY') {
    return { stops: [home], origin: { lat: store.lat, lng: store.lng }, atFirst: false };
  }
  return null;
}

function planPickup(s: AppState, p: Pickup): Plan | null {
  const at = { lat: p.lat, lng: p.lng };
  const sourceUser = p.sourceUserId ? s.users[p.sourceUserId] : undefined;
  const pickupStop: Stop = {
    id: `${p.id}:PICKUP`,
    kind: 'PICKUP',
    label: p.kind === 'DONATION' ? 'Collect medicines to donate' : 'Collect Yellow Bag',
    detail: p.address,
    ...at,
    missionId: p.id,
    ...(sourceUser?.phone ? { phone: sourceUser.phone } : {}),
  };
  const qaStore = p.qaStoreId ? s.stores[p.qaStoreId] : undefined;
  const ngo = p.ngoId ? s.ngos[p.ngoId] : undefined;
  const ngoStop: Stop | null = ngo
    ? { id: `${p.id}:NGO`, kind: 'NGO', label: `Hand over to ${ngo.name}`, detail: ngo.area, lat: ngo.lat, lng: ngo.lng, missionId: p.id }
    : null;
  const cbwtfStop: Stop = {
    id: `${p.id}:CBWTF`,
    kind: 'CBWTF',
    label: 'Drop at the CBWTF plant',
    detail: `${s.cbwtf.name}, ${s.cbwtf.area}`,
    lat: s.cbwtf.lat,
    lng: s.cbwtf.lng,
    missionId: p.id,
  };
  // The chemist's QA stop is skipped when the pickup is already at that store.
  const qaStop =
    qaStore && distanceKm(at, qaStore) > SAME_PLACE_KM ? storeStop(s, qaStore, p.id, `Chemist QA at ${qaStore.name}`) : null;
  const keep = (list: (Stop | null)[]) => list.filter((x): x is Stop => x !== null);

  if (p.kind === 'DISPOSAL') {
    if (p.status === 'SCHEDULED') return { stops: [pickupStop, cbwtfStop], origin: null, atFirst: Boolean(p.riderArrived) };
    if (p.status === 'COLLECTED') return { stops: [cbwtfStop], origin: at, atFirst: false };
    return null;
  }

  switch (p.status) {
    case 'SCHEDULED':
      return { stops: keep([pickupStop, qaStop, ngoStop]), origin: null, atFirst: Boolean(p.riderArrived) };
    case 'COLLECTED':
      return { stops: keep([qaStop, ngoStop]), origin: at, atFirst: false };
    case 'QA_VERIFIED':
      return { stops: keep([ngoStop]), origin: qaStore ? { lat: qaStore.lat, lng: qaStore.lng } : at, atFirst: false };
    case 'QA_REJECTED':
      return { stops: [cbwtfStop], origin: qaStore ? { lat: qaStore.lat, lng: qaStore.lng } : at, atFirst: false };
    default:
      return null;
  }
}

/** The ordered stops for everything this rider is currently carrying out. */
export function riderRoute(s: AppState, riderId: string): Route {
  const plans: Plan[] = [];
  for (const o of Object.values(s.orders)) {
    if (o.riderId !== riderId) continue;
    const plan = planOrder(s, o);
    if (plan) plans.push(plan);
  }
  for (const p of Object.values(s.pickups)) {
    if (p.riderId !== riderId || isTerminal(p.kind, p.status)) continue;
    const plan = planPickup(s, p);
    if (plan) plans.push(plan);
  }

  const stops = plans.flatMap((p) => p.stops);
  const first = plans[0];
  if (!first || stops.length === 0) return { stops: [], from: riderHome(s), moving: false };
  if (first.atFirst) return { stops, from: { lat: stops[0]!.lat, lng: stops[0]!.lng }, moving: false };
  return { stops, from: first.origin ?? riderHome(s), moving: true };
}

/** Distance and ETA along the route, starting from `from`. */
export function routeStats(from: LatLng, stops: Pick<Stop, 'lat' | 'lng'>[], speedKmh = RIDER_SPEED_KMH): RouteStats {
  let previous = from;
  let totalKm = 0;
  let totalMinutes = 0;
  const legs = stops.map((stop) => {
    const km = distanceKm(previous, stop);
    const minutes = km === 0 ? 0 : Math.max(1, Math.round((km / speedKmh) * 60));
    previous = stop;
    totalKm += km;
    totalMinutes += minutes;
    return { km: round1(km), minutes };
  });
  return { legs, totalKm: round1(totalKm), totalMinutes };
}

/** A point part-way between two places, for the animated rider marker (progress 0 to 1). */
export function interpolate(a: LatLng, b: LatLng, progress: number): LatLng {
  const t = Math.min(1, Math.max(0, progress));
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}
