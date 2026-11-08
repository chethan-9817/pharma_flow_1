import { fail, type Check, type Result } from '../result';
import type { DomainEvent, EventType } from '../events';
import type { AppState } from '../state';
import type { Role } from '../types';

export type Ev<T extends EventType> = Extract<DomainEvent, { type: T }>;
export type Step = Result<AppState>;

export const err = (error: string): Step => ({ ok: false, error });
export const done = (value: AppState): Step => ({ ok: true, value });

/** Turns a failed Check into an error Step, or null when the check passed. */
export function failed(check: Check): Step | null {
  return check.ok ? null : err(check.reason);
}

export function lookupMedicine(state: AppState) {
  return (id: string) => state.medicines[id];
}

export function requireRole(state: AppState, actorId: string, role: Role): Check {
  const user = state.users[actorId];
  if (!user) return fail(`Unknown user ${actorId}`);
  if (user.role !== role) return fail(`Only a ${role} can do this`);
  return { ok: true };
}

/** The actor must be the chemist who owns this store. */
export function requireChemistOf(state: AppState, actorId: string, storeId: string): Check {
  const user = state.users[actorId];
  if (!user || user.role !== 'chemist') return fail('Only a chemist can do this');
  if (user.storeId !== storeId) return fail('This belongs to a different store');
  return { ok: true };
}

export function requireApprovedStore(state: AppState, storeId: string): Check {
  const store = state.stores[storeId];
  if (!store) return fail(`Unknown store ${storeId}`);
  if (store.kyc !== 'APPROVED') return fail(`${store.name} is not KYC approved yet`);
  return { ok: true };
}

export function addKarma(state: AppState, userId: string, points: number): AppState {
  if (points === 0) return state;
  return { ...state, karma: { ...state.karma, [userId]: (state.karma[userId] ?? 0) + points } };
}

export function addWallet(state: AppState, userId: string, amount: number): AppState {
  if (amount === 0) return state;
  return { ...state, wallet: { ...state.wallet, [userId]: (state.wallet[userId] ?? 0) + amount } };
}

/** Short deterministic verification code for certificates. */
export function verifyCode(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(7, '0');
}
