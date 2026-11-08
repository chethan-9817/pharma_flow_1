import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sign, verify } from 'hono/jwt';
import type { User } from '../src/domain/types';
import type { Db } from './db';

/** The password every demo user gets, unless PHARMAFLOW_DEMO_PASSWORD says otherwise. */
export const DEFAULT_DEMO_PASSWORD = 'pharmaflow';
const BCRYPT_ROUNDS = 10;
const TOKEN_HOURS = 12;
export const COOKIE_NAME = 'pf_token';

/**
 * Gives every user without a password the demo password. Existing passwords are never overwritten.
 * `rounds` is bcrypt's cost; tests lower it to stay fast, the server always uses the default.
 */
export function ensureCredentials(db: Db, users: User[], password: string, rounds = BCRYPT_ROUNDS): void {
  const has = db.prepare('SELECT 1 FROM credentials WHERE user_id = ?');
  const insert = db.prepare('INSERT INTO credentials (user_id, password_hash) VALUES (?, ?)');
  for (const user of users) {
    if (!has.get(user.id)) insert.run(user.id, bcrypt.hashSync(password, rounds));
  }
}

// Checked even for unknown users, so a wrong user name takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export async function checkPassword(db: Db, userId: string, password: string): Promise<boolean> {
  const row = db.prepare('SELECT password_hash FROM credentials WHERE user_id = ?').get(userId) as { password_hash: string } | undefined;
  const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  return Boolean(row) && ok;
}

/** Whether somebody still uses the built-in demo password, so the login screen can hint at it. */
export async function usesDemoPassword(db: Db, userId: string): Promise<boolean> {
  return checkPassword(db, userId, DEFAULT_DEMO_PASSWORD);
}

/** The key that signs login tokens. It is made once and kept in the database, so logins survive a restart. */
export function tokenSecret(db: Db, fromEnv: string | undefined): string {
  if (fromEnv) return fromEnv;
  const row = db.prepare("SELECT value FROM meta WHERE key = 'jwt_secret'").get() as { value: string } | undefined;
  if (row) return row.value;
  const secret = randomBytes(32).toString('hex');
  db.prepare("INSERT INTO meta (key, value) VALUES ('jwt_secret', ?)").run(secret);
  return secret;
}

export interface TokenClaims {
  sub: string;
  exp: number;
}

export function issueToken(userId: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  return sign({ sub: userId, iat: nowSeconds, exp: nowSeconds + TOKEN_HOURS * 3600 }, secret, 'HS256');
}

/** The user a token was issued to, or null when it is missing, forged or expired. */
export async function readToken(token: string | undefined, secret: string): Promise<string | null> {
  if (!token) return null;
  try {
    const claims = (await verify(token, secret, 'HS256')) as unknown as TokenClaims;
    return typeof claims.sub === 'string' ? claims.sub : null;
  } catch {
    return null;
  }
}

/** Counts failed logins, so a password cannot be guessed at speed. */
export class LoginLimiter {
  private failures = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max = 5,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  blocked(key: string): boolean {
    const entry = this.failures.get(key);
    if (!entry) return false;
    if (entry.resetAt <= this.now()) {
      this.failures.delete(key);
      return false;
    }
    return entry.count >= this.max;
  }

  fail(key: string): void {
    const entry = this.failures.get(key);
    if (!entry || entry.resetAt <= this.now()) this.failures.set(key, { count: 1, resetAt: this.now() + this.windowMs });
    else entry.count += 1;
  }

  clear(key: string): void {
    this.failures.delete(key);
  }
}
