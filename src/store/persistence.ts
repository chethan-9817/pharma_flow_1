import Dexie, { type Table } from 'dexie';
import type { DomainEvent } from '../domain/events';
import type { LedgerEntry } from '../domain/ledger';

export type Entry = LedgerEntry<DomainEvent>;

/**
 * Thrown by `append` when the change was refused for a reason that retrying cannot fix, for example the
 * server's rules said no or the session ended. Its message is shown to the person. Any other error from
 * `append` means "another tab wrote first": the store catches up and tries again.
 */
export class StorageRejected extends Error {}

/** Where the hash-chained event log lives. */
export interface EventStorage {
  load(): Promise<Entry[]>;
  /** Must reject if an entry with the same index already exists (another tab won the race). */
  append(entry: Entry): Promise<void>;
  clear(): Promise<void>;
}

class PharmaDb extends Dexie {
  events!: Table<Entry, number>;
  constructor() {
    super('pharmaflow');
    this.version(1).stores({ events: 'index' });
  }
}

/** Demo mode: the event log is kept in IndexedDB, so a refresh keeps everything. */
export class DexieStorage implements EventStorage {
  private db = new PharmaDb();

  load(): Promise<Entry[]> {
    return this.db.events.orderBy('index').toArray();
  }

  async append(entry: Entry): Promise<void> {
    await this.db.events.add(entry);
  }

  async clear(): Promise<void> {
    await this.db.events.clear();
  }
}

/** Used by tests, and as a fallback when IndexedDB is unavailable. Pass a shared array to simulate two tabs. */
export class MemoryStorage implements EventStorage {
  constructor(private entries: Entry[] = []) {}

  async load(): Promise<Entry[]> {
    return [...this.entries];
  }

  async append(entry: Entry): Promise<void> {
    if (this.entries.some((e) => e.index === entry.index)) throw new Error('Entry index already exists');
    this.entries.push(entry);
  }

  async clear(): Promise<void> {
    this.entries.length = 0;
  }
}
