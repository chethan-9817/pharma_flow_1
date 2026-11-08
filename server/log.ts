import { z } from 'zod';
import type { DomainEvent } from '../src/domain/events';
import { hashEvent, verifyChain, type LedgerEntry } from '../src/domain/ledger';
import { applyEvent, reduce } from '../src/domain/reducer';
import { createInitialState, type AppState, type Seed } from '../src/domain/state';
import type { Db } from './db';

export type Entry = LedgerEntry<DomainEvent>;

export type AppendResult =
  | { ok: true; entry: Entry }
  | {
      ok: false;
      /** 403 wrong user, 409 someone else wrote first (the client re-syncs and retries), 422 the entry is not valid. */
      status: 403 | 409 | 422;
      error: string;
    };

const EntrySchema = z.object({
  index: z.number().int().nonnegative(),
  event: z
    .object({ id: z.string().min(1), type: z.string().min(1), actorId: z.string().min(1), at: z.string().min(1) })
    .passthrough(),
  prevHash: z.string().length(64),
  hash: z.string().length(64),
});

interface EventRow {
  idx: number;
  payload: string;
  prev_hash: string;
  hash: string;
}

/**
 * The server's copy of the hash-chained event log and the state built from it. Every event is checked
 * with the same reducer the browser uses, so the server never stores anything the rules would reject.
 */
export class EventLog {
  state: AppState;
  chain: Entry[];
  /** Appends run one at a time, in arrival order. */
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly db: Db,
    private readonly seed: Seed,
    chain: Entry[],
    state: AppState,
  ) {
    this.chain = chain;
    this.state = state;
  }

  /** Loads and re-checks everything stored so far. A broken chain, or one the rules no longer accept, stops the server. */
  static async open(db: Db, seed: Seed): Promise<EventLog> {
    const rows = db.prepare('SELECT idx, payload, prev_hash, hash FROM events ORDER BY idx').all() as unknown as EventRow[];
    const chain: Entry[] = rows.map((r) => ({ index: r.idx, event: JSON.parse(r.payload) as DomainEvent, prevHash: r.prev_hash, hash: r.hash }));
    const verdict = await verifyChain(chain);
    if (!verdict.ok) {
      throw new Error(`The stored event log is damaged at event #${verdict.brokenAt} (${verdict.reason}). Move the database file aside to start fresh.`);
    }
    let state = createInitialState(seed);
    try {
      state = reduce(state, chain.map((e) => e.event));
    } catch (error) {
      throw new Error(
        `The stored event log no longer replays with the current rules (${error instanceof Error ? error.message : String(error)}). Move the database file aside to start fresh.`,
      );
    }
    return new EventLog(db, seed, chain, state);
  }

  /** Entries with an index above `after` (pass -1 for all of them). */
  entriesAfter(after: number): Entry[] {
    return this.chain.slice(after + 1);
  }

  /** Checks a client's entry and, when it is valid, stores it as the next link of the chain. */
  append(raw: unknown, actorId: string): Promise<AppendResult> {
    const run = this.queue.then(() => this.appendNow(raw, actorId));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async appendNow(raw: unknown, actorId: string): Promise<AppendResult> {
    const parsed = EntrySchema.safeParse(raw);
    if (!parsed.success) return { ok: false, status: 422, error: 'This is not a valid log entry' };
    const entry = parsed.data as unknown as Entry;
    const { event } = entry;

    // Logged in as one person, a client may only act as that person.
    if (event.actorId !== actorId) return { ok: false, status: 403, error: 'You can only act as yourself' };

    const tail = this.chain[this.chain.length - 1];
    if (entry.index !== this.chain.length || entry.prevHash !== (tail?.hash ?? '0'.repeat(64))) {
      return { ok: false, status: 409, error: 'Someone else changed the data first' };
    }
    if ((await hashEvent(entry.prevHash, event)) !== entry.hash) {
      return { ok: false, status: 422, error: 'The entry hash does not match its event' };
    }

    let result;
    try {
      result = applyEvent(this.state, event);
    } catch {
      return { ok: false, status: 422, error: 'This event could not be applied' };
    }
    if (!result.ok) return { ok: false, status: 422, error: result.error };

    try {
      this.db
        .prepare('INSERT INTO events (idx, id, type, actor_id, sim_date, payload, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(entry.index, event.id, event.type, event.actorId, event.at, JSON.stringify(event), entry.prevHash, entry.hash);
    } catch {
      // The only way to get here is a repeated event id: treat it like losing the race, so the client re-syncs.
      return { ok: false, status: 409, error: 'This event was already recorded' };
    }
    this.state = result.value;
    this.chain.push(entry);
    return { ok: true, entry };
  }

  /** Throws away the whole log: the presenter's "Reset demo". */
  reset(): void {
    this.db.exec('DELETE FROM events');
    this.chain = [];
    this.state = createInitialState(this.seed);
  }
}
