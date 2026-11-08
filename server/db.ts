import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

/**
 * Opens the server's SQLite file (Node's built-in `node:sqlite`, so there is nothing to compile).
 *
 * `events` is the source of truth, with the same columns as the sample database in scripts/schema.sql:
 * every action is an immutable event chained with sha256(prev_hash + payload). `credentials` holds the
 * bcrypt password hashes, and `meta` holds the signing secret for login tokens.
 */
export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      idx       INTEGER PRIMARY KEY,
      id        TEXT NOT NULL UNIQUE,
      type      TEXT NOT NULL,
      actor_id  TEXT NOT NULL,
      sim_date  TEXT NOT NULL,
      payload   TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      hash      TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS credentials (
      user_id       TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}
