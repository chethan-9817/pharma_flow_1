/**
 * PharmaFlow server mode. Run it with: npm run server
 *
 * It serves the API and, when the server build exists (npm run build:server), the app itself, on one port.
 * Settings come from environment variables:
 *   PORT                       default 8787
 *   HOST                       default localhost (use 0.0.0.0 to reach it from other devices)
 *   PHARMAFLOW_DB              default data/pharmaflow.db
 *   PHARMAFLOW_DEMO_PASSWORD   password for every demo user on the first start (default "pharmaflow")
 *   PHARMAFLOW_JWT_SECRET      signing key for login tokens (default: made once and kept in the database)
 */
import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import { join, relative, resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { SEED } from '../src/seed';
import { createApp } from './app';
import { DEFAULT_DEMO_PASSWORD, ensureCredentials, readToken, tokenSecret, usesDemoPassword } from './auth';
import { openDb } from './db';
import { Hub } from './hub';
import { EventLog } from './log';
import { attachWebSocket } from './ws';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? 'localhost';
const dbPath = process.env.PHARMAFLOW_DB ?? join(root, 'data', 'pharmaflow.db');
const demoPassword = process.env.PHARMAFLOW_DEMO_PASSWORD ?? DEFAULT_DEMO_PASSWORD;
const distDir = join(root, 'dist-server');

const db = openDb(dbPath);
ensureCredentials(db, SEED.users, demoPassword);
const secret = tokenSecret(db, process.env.PHARMAFLOW_JWT_SECRET);
const log = await EventLog.open(db, SEED);
const hub = new Hub();

const app = createApp({
  db,
  log,
  hub,
  users: Object.fromEntries(SEED.users.map((u) => [u.id, u])),
  secret,
  demoPassword: await usesDemoPassword(db, 'u-admin'),
  secureCookie: process.env.PHARMAFLOW_SECURE_COOKIE === '1',
  // serveStatic wants a path relative to where the process was started.
  ...(existsSync(join(distDir, 'index.html')) ? { staticRoot: relative(process.cwd(), distDir).replaceAll('\\', '/') } : {}),
});

const server = serve({ fetch: app.fetch, port, hostname: host }, (info) => {
  console.log(`PharmaFlow server listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${info.port}`);
  console.log(`  database: ${dbPath} (${log.chain.length} events)`);
  console.log(existsSync(join(distDir, 'index.html')) ? '  app: serving dist-server/' : '  app: dist-server/ not built yet. Run "npm run build:server", or use "npm run dev:server" with Vite.');
  if (demoPassword === DEFAULT_DEMO_PASSWORD) console.log(`  demo users sign in with the password "${DEFAULT_DEMO_PASSWORD}" (set PHARMAFLOW_DEMO_PASSWORD to change it)`);
});

attachWebSocket(server as Server, hub, async (token) => (await readToken(token, secret)) !== null);
