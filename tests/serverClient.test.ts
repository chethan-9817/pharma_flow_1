import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app';
import { ensureCredentials, readToken } from '../server/auth';
import { openDb } from '../server/db';
import { Hub } from '../server/hub';
import { EventLog } from '../server/log';
import { attachWebSocket } from '../server/ws';
import { verifyChain } from '../src/domain/ledger';
import { SEED } from '../src/seed';
import { MemoryTokens, ServerStorage, WebSocketTransport } from '../src/store/server';
import { createPharmaStore } from '../src/store/store';
import { MemoryBus } from '../src/store/transport';
import { ADMIN, CHEMIST, CUSTOMER } from './helpers';

const SECRET = 'client-test-secret';
const PASSWORD = 'pw-for-tests';

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

/** A real server on a free port, and a way to open a "browser" against it. */
async function start() {
  const db = openDb(':memory:');
  ensureCredentials(db, SEED.users, PASSWORD, 4);
  const log = await EventLog.open(db, SEED);
  const hub = new Hub();
  const app = createApp({ db, log, hub, users: Object.fromEntries(SEED.users.map((u) => [u.id, u])), secret: SECRET, demoPassword: false });
  const server = serve({ fetch: app.fetch, port: 0, hostname: 'localhost' }) as Server;
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const sockets = attachWebSocket(server, hub, async (t) => (await readToken(t, SECRET)) !== null);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  cleanups.push(() => {
    sockets.close();
    server.close();
  });

  /** One browser: its own tokens, its own store, a server-backed storage and a WebSocket. */
  function browser(signedInAs: string[]) {
    const tokens = new MemoryTokens();
    const storage = new ServerStorage(tokens, (input, init) => fetch(input, init), base);
    const transport = new WebSocketTransport(tokens, () => base.replace('http', 'ws') + '/ws');
    const store = createPharmaStore({ seed: SEED, storage, transport });
    cleanups.push(() => store.getState().dispose());
    return {
      store,
      tokens,
      state: () => store.getState().app,
      async signIn(userId: string) {
        const res = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, password: PASSWORD }) });
        tokens.set(userId, ((await res.json()) as { token: string }).token);
        transport.connect();
        await store.getState().reload();
      },
      async open() {
        for (const id of signedInAs) tokens.set(id, ((await (await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id, password: PASSWORD }) })).json()) as { token: string }).token);
        await store.getState().init();
      },
    };
  }
  return { log, base, browser };
}

const listEco = (batchId: string) => ({ type: 'ECO_SALE_LISTED' as const, batchId, discountPct: 50 });
const book = (id: string) => ({
  type: 'BLOOD_BOOKED' as const,
  booking: { id, userId: CUSTOMER, bloodBankId: 'bb-wenlock', date: '2026-11-09', bloodGroup: 'O+', status: 'BOOKED' as const },
});

describe('two browsers on one server', () => {
  it('shows one browser\'s action in the other without a refresh', async () => {
    const s = await start();
    const chemist = s.browser([CHEMIST]);
    const customer = s.browser([CUSTOMER]);
    await chemist.open();
    await customer.open();
    expect(customer.state().batches['b-okacet-1']!.status).toBe('IN_STOCK');

    const result = await chemist.store.getState().dispatch(CHEMIST, listEco('b-okacet-1'));
    expect(result.ok).toBe(true);
    await vi.waitFor(() => expect(customer.state().batches['b-okacet-1']!.status).toBe('ECO_SALE'));

    // And back the other way.
    expect((await customer.store.getState().dispatch(CUSTOMER, book('bk1'))).ok).toBe(true);
    await vi.waitFor(() => expect(chemist.state().bloodBookings.bk1).toBeTruthy());

    expect(s.log.chain).toHaveLength(2);
    expect(chemist.store.getState().chain.map((e) => e.hash)).toEqual(s.log.chain.map((e) => e.hash));
    expect(await verifyChain(customer.store.getState().chain)).toEqual({ ok: true, length: 2 });
  });

  it('keeps both when two browsers write at the same moment (one retries after a 409)', async () => {
    const s = await start();
    const a = s.browser([CHEMIST]);
    const b = s.browser([CUSTOMER]);
    await a.open();
    await b.open();

    const [first, second] = await Promise.all([
      a.store.getState().dispatch(CHEMIST, listEco('b-okacet-1')),
      b.store.getState().dispatch(CUSTOMER, book('bk2')),
    ]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    await vi.waitFor(() => {
      expect(a.state().bloodBookings.bk2).toBeTruthy();
      expect(b.state().batches['b-okacet-1']!.status).toBe('ECO_SALE');
    });
    expect(s.log.chain).toHaveLength(2);
    expect(await verifyChain(s.log.chain)).toEqual({ ok: true, length: 2 });
  });

  it('loads nothing until someone signs in, and then loads the whole log', async () => {
    const s = await start();
    const early = s.browser([CHEMIST]);
    await early.open();
    await early.store.getState().dispatch(CHEMIST, listEco('b-okacet-1'));

    const late = s.browser([]);
    await late.open();
    expect(late.store.getState().ready).toBe(true);
    expect(late.state().batches['b-okacet-1']!.status).toBe('IN_STOCK'); // signed out: no data
    expect(late.store.getState().chain).toHaveLength(0);

    await late.signIn(CUSTOMER);
    expect(late.state().batches['b-okacet-1']!.status).toBe('ECO_SALE');
    expect(late.store.getState().chain).toHaveLength(1);
  });

  it('explains why a change cannot be saved instead of retrying forever', async () => {
    const s = await start();
    const customer = s.browser([CUSTOMER]);
    await customer.open();
    // Moving time is the admin's job, and this browser has no admin login.
    const result = await customer.store.getState().dispatch(ADMIN, { type: 'TIME_TRAVELLED', to: '2027-01-01' });
    expect(result).toEqual({ ok: false, error: 'Sign in as the admin first' });
    expect(s.log.chain).toHaveLength(0);
  });

  it('ends a session the server no longer accepts, and says so', async () => {
    const s = await start();
    const customer = s.browser([CUSTOMER]);
    await customer.open();
    customer.tokens.set(CUSTOMER, 'a-token-the-server-does-not-know');
    const result = await customer.store.getState().dispatch(CUSTOMER, book('bk3'));
    expect(result).toEqual({ ok: false, error: 'Your session has ended. Please sign in again.' });
    expect(customer.tokens.get(CUSTOMER)).toBeUndefined();
  });

  it('resets the demo for every browser when the admin does it, and refuses anyone else', async () => {
    const s = await start();
    const admin = s.browser([ADMIN]);
    const customer = s.browser([CUSTOMER]);
    await admin.open();
    await customer.open();
    await customer.store.getState().dispatch(CUSTOMER, book('bk4'));
    await vi.waitFor(() => expect(admin.state().bloodBookings.bk4).toBeTruthy());

    await expect(customer.store.getState().reset()).rejects.toThrow(/Sign in as the admin/);
    expect(s.log.chain).toHaveLength(1);

    await admin.store.getState().reset();
    await vi.waitFor(() => expect(customer.state().bloodBookings.bk4).toBeUndefined());
    expect(s.log.chain).toHaveLength(0);
  });

  it('catches up after the connection drops and comes back', async () => {
    const s = await start();
    const a = s.browser([CHEMIST]);
    const b = s.browser([CUSTOMER]);
    await a.open();
    await b.open();
    await a.store.getState().dispatch(CHEMIST, listEco('b-okacet-1'));
    await vi.waitFor(() => expect(b.state().batches['b-okacet-1']!.status).toBe('ECO_SALE'));

    // B misses an event while it has no way to hear about it: it only learns of it through a re-sync.
    b.store.getState().dispose();
    expect((await a.store.getState().dispatch(CHEMIST, listEco('b-pand-1'))).ok).toBe(true);
    expect(b.state().batches['b-pand-1']!.status).toBe('IN_STOCK');
    await b.store.getState().reload();
    expect(b.state().batches['b-pand-1']!.status).toBe('ECO_SALE');
  });

  it('still starts when the server cannot be reached, instead of loading forever', async () => {
    const tokens = new MemoryTokens({ [CUSTOMER]: 'whatever' });
    const storage = new ServerStorage(tokens, () => Promise.reject(new Error('connection refused')));
    const store = createPharmaStore({ seed: SEED, storage, transport: new MemoryBus().join() });
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await store.getState().init();
    expect(quiet).toHaveBeenCalled(); // the failure is reported, not hidden
    quiet.mockRestore();
    expect(store.getState().ready).toBe(true);
    expect(store.getState().chain).toEqual([]);
    store.getState().dispose();
  });

  it('asks again when the server turns out to be unreachable only for a moment', async () => {
    const s = await start();
    const tokens = new MemoryTokens();
    let reachable = false;
    const storage = new ServerStorage(tokens, (input, init) => (reachable ? fetch(input, init) : Promise.reject(new Error('offline'))), s.base);
    const store = createPharmaStore({ seed: SEED, storage, transport: new MemoryBus().join() });
    tokens.set(CHEMIST, ((await (await fetch(`${s.base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: CHEMIST, password: PASSWORD }) })).json()) as { token: string }).token);
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await store.getState().init();
    quiet.mockRestore();
    expect(store.getState().ready).toBe(true);
    reachable = true;
    await store.getState().reload();
    expect(store.getState().chain).toHaveLength(0); // reachable again, and the (empty) log was read
    store.getState().dispose();
  });
});
