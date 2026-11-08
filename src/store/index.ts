import { useStore } from 'zustand';
import { SEED } from '../seed';
import type { DomainEventPayload } from '../domain/events';
import type { Result } from '../domain/result';
import type { AppState } from '../domain/state';
import { DexieStorage, MemoryStorage, type EventStorage } from './persistence';
import { SERVER_MODE, serverStorage, serverTransport } from './server';
import { createPharmaStore, type PharmaActions, type PharmaState, type Sessions } from './store';
import { BroadcastTransport, MemoryBus, type Transport } from './transport';

const SESSION_KEY = 'pharmaflow-sessions';

function loadSessions(): Sessions {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '{}') as Sessions;
  } catch {
    return {};
  }
}

function saveSessions(sessions: Sessions): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
  } catch {
    /* private mode: sessions just last until the tab closes */
  }
}

function makeStorage(): EventStorage {
  return typeof indexedDB === 'undefined' ? new MemoryStorage() : new DexieStorage();
}

function makeTransport(): Transport {
  return typeof BroadcastChannel === 'undefined' ? new MemoryBus().join() : new BroadcastTransport();
}

/**
 * One store per tab. In the demo build, tabs stay in sync through the shared IndexedDB log and BroadcastChannel.
 * In the server build the same store keeps its log on the server and hears about changes over a WebSocket.
 */
export const pharma = createPharmaStore({
  seed: SEED,
  storage: SERVER_MODE ? serverStorage : makeStorage(),
  transport: SERVER_MODE ? serverTransport : makeTransport(),
  loadSessions,
  saveSessions,
});

type Full = PharmaState & PharmaActions;

export function usePharma<T>(selector: (state: Full) => T): T {
  return useStore(pharma, selector);
}

export const useApp = (): AppState => usePharma((s) => s.app);

export type Dispatch = (actorId: string, payload: DomainEventPayload) => Promise<Result<AppState>>;
export const dispatch: Dispatch = (actorId, payload) => pharma.getState().dispatch(actorId, payload);
