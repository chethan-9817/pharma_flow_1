import { StorageRejected, type Entry, type EventStorage } from '../persistence';
import type { TokenStore } from './tokens';

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** The admin's user id: only the admin may reset the demo, so that is whose token the reset uses. */
const ADMIN_ID = 'u-admin';

/**
 * Server mode: the event log lives on the server. It is the same `EventStorage` the browser store already
 * uses, so the store, the reducer and every screen are unchanged.
 *
 * - `load` reads the log (needs a login),
 * - `append` sends one entry. The server checks it with the same rules and answers 409 when another browser
 *   wrote first. That becomes a plain error, so the store catches up and tries again, exactly like two tabs.
 *   A refusal for any other reason becomes `StorageRejected` with the server's message.
 */
export class ServerStorage implements EventStorage {
  constructor(
    private readonly tokens: TokenStore,
    private readonly fetchFn: FetchFn = (input, init) => fetch(input, init),
    private readonly base = '',
    /** Called when the server says a user's session is over, so the screen can sign that role out. */
    private readonly onSessionEnded?: (userId: string) => void,
  ) {}

  async load(): Promise<Entry[]> {
    const token = this.tokens.any();
    if (!token) return []; // nobody has signed in yet, so there is nothing to show
    const res = await this.fetchFn(`${this.base}/api/events`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      this.tokens.clearToken(token);
      return [];
    }
    if (!res.ok) throw new Error(`The server answered ${res.status} when loading the data`);
    return ((await res.json()) as { entries: Entry[] }).entries;
  }

  async append(entry: Entry): Promise<void> {
    const actorId = entry.event.actorId;
    const token = this.tokens.get(actorId);
    if (!token) throw new StorageRejected(`Sign in as ${actorId === ADMIN_ID ? 'the admin' : 'this user'} first`);

    const res = await this.fetchFn(`${this.base}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entry }),
    });
    if (res.status === 201) return;
    if (res.status === 409) throw new Error('Another browser wrote first');
    if (res.status === 401) {
      this.tokens.clear(actorId);
      this.onSessionEnded?.(actorId);
      throw new StorageRejected('Your session has ended. Please sign in again.');
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new StorageRejected(body.error ?? 'The server refused this change');
  }

  async clear(): Promise<void> {
    const token = this.tokens.get(ADMIN_ID);
    if (!token) throw new StorageRejected('Sign in as the admin to reset the demo');
    const res = await this.fetchFn(`${this.base}/api/reset`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new StorageRejected(body.error ?? 'The server could not reset the demo');
    }
  }
}
