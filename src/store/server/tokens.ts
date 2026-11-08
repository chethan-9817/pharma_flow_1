/**
 * Login tokens for server mode, one per signed-in user. The browser holds several at once because the
 * presenter signs in as a customer, a chemist, a rider and an admin in different tabs or panes.
 */
export interface TokenStore {
  get(userId: string): string | undefined;
  set(userId: string, token: string): void;
  /** Forget one user's token (they signed out, or it expired). */
  clear(userId: string): void;
  /** Forget a token by value, when only the token is known (the server said it is no longer valid). */
  clearToken(token: string): void;
  /** Any token at all, for reading the log. */
  any(): string | undefined;
}

/** Tokens kept in a plain object. Used by tests. */
export class MemoryTokens implements TokenStore {
  constructor(private readonly map: Record<string, string> = {}) {}
  get = (userId: string) => this.map[userId];
  set = (userId: string, token: string) => {
    this.map[userId] = token;
  };
  clear = (userId: string) => {
    delete this.map[userId];
  };
  clearToken = (token: string) => {
    for (const [id, t] of Object.entries(this.map)) if (t === token) delete this.map[id];
  };
  any = () => Object.values(this.map)[0];
}

const KEY = 'pharmaflow-tokens';

/**
 * Tokens in localStorage, so every tab and every "All 4" pane of this browser shares them: the presenter bar
 * can then move time once the admin has signed in anywhere. Which role a tab shows is still per tab.
 * They expire on the server after 12 hours.
 */
export class BrowserTokens implements TokenStore {
  private read(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>;
    } catch {
      return {};
    }
  }
  private write(map: Record<string, string>): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(map));
    } catch {
      /* storage blocked: the person just has to sign in again after a reload */
    }
  }
  get = (userId: string) => this.read()[userId];
  set = (userId: string, token: string) => this.write({ ...this.read(), [userId]: token });
  clear = (userId: string) => {
    const { [userId]: _removed, ...rest } = this.read();
    this.write(rest);
  };
  clearToken = (token: string) => this.write(Object.fromEntries(Object.entries(this.read()).filter(([, t]) => t !== token)));
  any = () => Object.values(this.read())[0];
}
