import { createStore, type StoreApi } from 'zustand/vanilla';
import type { DomainEvent, DomainEventPayload } from '../domain/events';
import { appendEntry, verifyChain, type VerifyResult } from '../domain/ledger';
import { applyEvent, reduce } from '../domain/reducer';
import type { Result } from '../domain/result';
import { createInitialState, type AppState, type Seed } from '../domain/state';
import type { Role } from '../domain/types';
import { StorageRejected, type Entry, type EventStorage } from './persistence';
import type { Transport, TransportMessage } from './transport';

export type Sessions = Partial<Record<Role, string>>;

export interface PharmaState {
  app: AppState;
  chain: Entry[];
  ready: boolean;
  /** Logged-in user per role. Local to this tab, never synced. */
  sessions: Sessions;
}

export interface PharmaActions {
  init(): Promise<void>;
  /** Loads the log again, for example right after signing in to the server. */
  reload(): Promise<void>;
  /** Validates the event against the business rules, then appends it to the shared log. */
  dispatch(actorId: string, payload: DomainEventPayload): Promise<Result<AppState>>;
  reset(): Promise<void>;
  verifyLedger(): Promise<VerifyResult>;
  login(role: Role, userId: string): void;
  logout(role: Role): void;
  dispose(): void;
}

export type PharmaStore = StoreApi<PharmaState & PharmaActions>;

export interface StoreDeps {
  seed: Seed;
  storage: EventStorage;
  transport: Transport;
  /** Optional per-tab session persistence (sessionStorage). */
  loadSessions?: () => Sessions;
  saveSessions?: (sessions: Sessions) => void;
  newId?: (prefix: string) => string;
}

const defaultId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const MAX_ATTEMPTS = 3;

export function createPharmaStore(deps: StoreDeps): PharmaStore {
  const { seed, storage, transport } = deps;
  const newId = deps.newId ?? defaultId;
  const initial = () => createInitialState(seed);

  // Everything that touches the log runs one at a time, in order.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  let unsubscribe: (() => void) | null = null;

  const store = createStore<PharmaState & PharmaActions>((set, get) => {
    async function resync(): Promise<void> {
      let entries: Entry[];
      try {
        entries = await storage.load();
      } catch (error) {
        // The log could not be read (for example the server is unreachable). Keep what is on screen: the
        // transport asks for a re-sync again when the connection is back.
        console.error('Could not load the event log.', error);
        return;
      }
      try {
        set({ app: reduce(initial(), entries.map((e) => e.event)), chain: entries });
      } catch (error) {
        // A stored log that no longer replays means it was written by an older version of the rules.
        console.error('Stored event log could not be replayed; starting fresh.', error);
        await storage.clear();
        set({ app: initial(), chain: [] });
      }
    }

    async function receive(message: TransportMessage): Promise<void> {
      if (message.kind === 'reset') {
        set({ app: initial(), chain: [] });
        return;
      }
      if (message.kind === 'resync') {
        await resync();
        return;
      }
      const { app, chain } = get();
      const { entry } = message;
      if (entry.index < chain.length) return;
      const tail = chain.length ? chain[chain.length - 1]!.hash : null;
      if (entry.index === chain.length && (tail === null || entry.prevHash === tail)) {
        const result = applyEvent(app, entry.event);
        if (result.ok) {
          set({ app: result.value, chain: [...chain, entry] });
          return;
        }
      }
      await resync();
    }

    return {
      app: initial(),
      chain: [],
      ready: false,
      sessions: deps.loadSessions?.() ?? {},

      async init() {
        await serial(async () => {
          await resync();
          unsubscribe?.();
          unsubscribe = transport.subscribe((m) => void serial(() => receive(m)));
          set({ ready: true });
        });
      },

      reload() {
        return serial(resync);
      },

      dispatch(actorId, payload) {
        return serial(async (): Promise<Result<AppState>> => {
          for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const { app, chain } = get();
            const event = { id: newId('ev'), at: app.today, actorId, ...payload } as DomainEvent;
            const result = applyEvent(app, event);
            if (!result.ok) return result;
            const entry = await appendEntry(chain, event);
            try {
              await storage.append(entry);
            } catch (error) {
              // The storage refused the change for a reason that retrying cannot fix: tell the person why.
              if (error instanceof StorageRejected) return { ok: false, error: error.message };
              // Another tab wrote entry N first. Catch up and validate the event again.
              await resync();
              continue;
            }
            set({ app: result.value, chain: [...chain, entry] });
            transport.publish({ kind: 'entry', entry });
            return result;
          }
          return { ok: false, error: 'Another tab changed the data at the same time. Please try again.' };
        });
      },

      reset() {
        return serial(async () => {
          await storage.clear();
          set({ app: initial(), chain: [] });
          transport.publish({ kind: 'reset' });
        });
      },

      verifyLedger() {
        return verifyChain(get().chain);
      },

      login(role, userId) {
        const sessions = { ...get().sessions, [role]: userId };
        set({ sessions });
        deps.saveSessions?.(sessions);
      },

      logout(role) {
        const { [role]: _removed, ...rest } = get().sessions;
        set({ sessions: rest });
        deps.saveSessions?.(rest);
      },

      dispose() {
        unsubscribe?.();
        unsubscribe = null;
        transport.close();
      },
    };
  });

  return store;
}
