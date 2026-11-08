import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app';
import { LoginLimiter, ensureCredentials, issueToken, readToken } from '../server/auth';
import { openDb } from '../server/db';
import { Hub } from '../server/hub';
import { EventLog } from '../server/log';
import { attachWebSocket } from '../server/ws';
import type { DomainEvent, DomainEventPayload } from '../src/domain/events';
import { appendEntry, verifyChain } from '../src/domain/ledger';
import { SEED } from '../src/seed';
import { ADMIN, CHEMIST, CUSTOMER, RIDER } from './helpers';

const SECRET = 'test-secret';
const PASSWORD = 'letmein-123';
const USERS = Object.fromEntries(SEED.users.map((u) => [u.id, u]));

async function makeServer(dbPath = ':memory:') {
  const db = openDb(dbPath);
  ensureCredentials(db, SEED.users, PASSWORD, 4); // the cheapest bcrypt cost, to keep the tests fast
  const log = await EventLog.open(db, SEED);
  const hub = new Hub();
  const limiter = new LoginLimiter();
  const app = createApp({ db, log, hub, users: USERS, secret: SECRET, demoPassword: false, limiter });
  return { db, log, hub, app, limiter };
}
type Server_ = Awaited<ReturnType<typeof makeServer>>;

const json = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const bearer = (token: string, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${token}`, ...extra });

async function login(s: Server_, userId: string, password = PASSWORD) {
  return s.app.request('/api/login', json({ userId, password }));
}
async function tokenFor(s: Server_, userId: string): Promise<string> {
  return ((await (await login(s, userId)).json()) as { token: string }).token;
}

let counter = 0;
/** The entry a browser would send: the next link of the server's own chain. */
async function entryFor(s: Server_, actorId: string, payload: DomainEventPayload) {
  const event = { id: `ev-${++counter}`, at: s.log.state.today, actorId, ...payload } as DomainEvent;
  return appendEntry(s.log.chain, event);
}
async function post(s: Server_, token: string, entry: unknown) {
  return s.app.request('/api/events', { ...json({ entry }), headers: bearer(token, { 'Content-Type': 'application/json' }) });
}

describe('login', () => {
  it('signs in with the right password and returns a token and the user', async () => {
    const s = await makeServer();
    const res = await login(s, CUSTOMER);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; user: { id: string; role: string; name: string } };
    expect(body.user).toEqual({ id: CUSTOMER, role: 'customer', name: 'Asha Shetty' });
    expect(await readToken(body.token, SECRET)).toBe(CUSTOMER);
    expect(res.headers.get('set-cookie')).toMatch(/pf_token=.*HttpOnly.*SameSite=Lax/i);
  });

  it('never stores or returns the password, only a bcrypt hash', async () => {
    const s = await makeServer();
    const row = s.db.prepare('SELECT password_hash FROM credentials WHERE user_id = ?').get(CUSTOMER) as { password_hash: string };
    expect(row.password_hash).toMatch(/^\$2[aby]\$04\$/);
    expect(row.password_hash).not.toContain(PASSWORD);
  });

  it('uses a real bcrypt cost for the server itself', () => {
    const db = openDb(':memory:');
    ensureCredentials(db, [SEED.users[0]!], PASSWORD);
    const row = db.prepare('SELECT password_hash FROM credentials').get() as { password_hash: string };
    expect(row.password_hash).toMatch(/^\$2[aby]\$10\$/);
  });

  it('refuses a wrong password and an unknown user with the same message', async () => {
    const s = await makeServer();
    const wrong = await login(s, CUSTOMER, 'nope');
    const unknown = await login(s, 'u-nobody');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it('rejects malformed requests', async () => {
    const s = await makeServer();
    expect((await s.app.request('/api/login', json({ userId: 5 }))).status).toBe(400);
    expect((await s.app.request('/api/login', { method: 'POST', body: 'not json' })).status).toBe(400);
  });

  it('blocks a user after repeated wrong passwords, even for the right one, then lets them back in', async () => {
    let now = 0;
    const s = await makeServer();
    s.limiter.fail('x'); // make sure the limiter is the injected one
    const limiter = new LoginLimiter(3, 1000, () => now);
    const app = createApp({ db: s.db, log: s.log, hub: s.hub, users: USERS, secret: SECRET, demoPassword: false, limiter });
    for (let i = 0; i < 3; i++) expect((await app.request('/api/login', json({ userId: CUSTOMER, password: 'bad' }))).status).toBe(401);
    expect((await app.request('/api/login', json({ userId: CUSTOMER, password: PASSWORD }))).status).toBe(429);
    now = 1001;
    expect((await app.request('/api/login', json({ userId: CUSTOMER, password: PASSWORD }))).status).toBe(200);
  });

  it('knows tokens are forged or expired', async () => {
    expect(await readToken('abc.def.ghi', SECRET)).toBeNull();
    expect(await readToken(undefined, SECRET)).toBeNull();
    const old = await issueToken(CUSTOMER, SECRET, 1_000);
    expect(await readToken(old, SECRET)).toBeNull(); // issued in 1970, long expired
    expect(await readToken(await issueToken(CUSTOMER, 'other-secret'), SECRET)).toBeNull();
  });
});

describe('the event log API', () => {
  it('asks for a login before it shows or accepts anything', async () => {
    const s = await makeServer();
    expect((await s.app.request('/api/events')).status).toBe(401);
    expect((await s.app.request('/api/events', { ...json({}), headers: { 'Content-Type': 'application/json' } })).status).toBe(401);
    expect((await s.app.request('/api/me')).status).toBe(401);
    expect((await s.app.request('/api/events', { headers: bearer('garbage') })).status).toBe(401);
  });

  it('stores a valid event, extends a hash chain that verifies, and returns it', async () => {
    const s = await makeServer();
    const token = await tokenFor(s, CHEMIST);
    const entry = await entryFor(s, CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
    const res = await post(s, token, entry);
    expect(res.status).toBe(201);

    const list = (await (await s.app.request('/api/events', { headers: bearer(token) })).json()) as { entries: typeof s.log.chain };
    expect(list.entries).toHaveLength(1);
    expect(list.entries[0]!.hash).toBe(entry.hash);
    expect(s.log.state.batches['b-okacet-1']!.status).toBe('ECO_SALE');
    expect(await verifyChain(s.log.chain)).toEqual({ ok: true, length: 1 });

    const second = (await (await s.app.request('/api/events?after=0', { headers: bearer(token) })).json()) as { entries: unknown[] };
    expect(second.entries).toEqual([]);
  });

  it('refuses an event the rules reject, and stores nothing', async () => {
    const s = await makeServer();
    const token = await tokenFor(s, CUSTOMER);
    // A customer cannot list stock on Eco-Sale.
    const entry = await entryFor(s, CUSTOMER, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
    const res = await post(s, token, entry);
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toMatch(/chemist/i);
    expect(s.log.chain).toHaveLength(0);
  });

  it('only lets a user act as themselves', async () => {
    const s = await makeServer();
    const customerToken = await tokenFor(s, CUSTOMER);
    // Signed in as the customer, pretending to be the chemist.
    const entry = await entryFor(s, CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
    const res = await post(s, customerToken, entry);
    expect(res.status).toBe(403);
    expect(s.log.chain).toHaveLength(0);
  });

  it('only lets the admin move time, even when a customer signs the request as the admin', async () => {
    const s = await makeServer();
    const customerToken = await tokenFor(s, CUSTOMER);
    expect((await post(s, customerToken, await entryFor(s, ADMIN, { type: 'TIME_TRAVELLED', to: '2027-01-01' }))).status).toBe(403);
    expect((await post(s, customerToken, await entryFor(s, CUSTOMER, { type: 'TIME_TRAVELLED', to: '2027-01-01' }))).status).toBe(422);
    expect(s.log.state.today).toBe('2026-11-08');
    const adminToken = await tokenFor(s, ADMIN);
    expect((await post(s, adminToken, await entryFor(s, ADMIN, { type: 'TIME_TRAVELLED', to: '2027-01-01' }))).status).toBe(201);
    expect(s.log.state.today).toBe('2027-01-01');
  });

  it('answers 409 when someone else wrote first, so the browser re-syncs and retries', async () => {
    const s = await makeServer();
    const token = await tokenFor(s, CHEMIST);
    const first = await entryFor(s, CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
    const stale = await entryFor(s, CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-dolo-1', discountPct: 50 });
    expect((await post(s, token, first)).status).toBe(201);
    const res = await post(s, token, stale); // built on the same chain tip, so it is now one behind
    expect(res.status).toBe(409);
    expect(s.log.chain).toHaveLength(1);
  });

  it('rejects an entry whose hash does not match its event', async () => {
    const s = await makeServer();
    const token = await tokenFor(s, CHEMIST);
    const entry = await entryFor(s, CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
    const tampered = { ...entry, event: { ...entry.event, discountPct: 40 } };
    const res = await post(s, token, tampered);
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toMatch(/hash/);
    expect(s.log.chain).toHaveLength(0);
  });

  it('rejects malformed entries and events that would crash the reducer', async () => {
    const s = await makeServer();
    const token = await tokenFor(s, CUSTOMER);
    expect((await post(s, token, { nonsense: true })).status).toBe(422);
    expect((await post(s, token, undefined)).status).toBe(422);
    // An ORDER_PLACED with no order in it: the reducer would throw, the server must answer instead.
    const bad = await entryFor(s, CUSTOMER, { type: 'ORDER_PLACED' } as unknown as DomainEventPayload);
    expect((await post(s, token, bad)).status).toBe(422);
    expect(s.log.chain).toHaveLength(0);
  });

  it('refuses a repeated event id', async () => {
    const s = await makeServer();
    const token = await tokenFor(s, CHEMIST);
    const first = await entryFor(s, CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
    expect((await post(s, token, first)).status).toBe(201);
    const again = await appendEntry(s.log.chain, { ...first.event, discountPct: 55 } as DomainEvent);
    expect((await post(s, token, again)).status).toBeGreaterThanOrEqual(409);
    expect(s.log.chain).toHaveLength(1);
  });

  it('refuses very large requests', async () => {
    const s = await makeServer();
    const token = await tokenFor(s, CUSTOMER);
    const res = await post(s, token, { filler: 'x'.repeat(9 * 1024 * 1024) });
    expect(res.status).toBe(413);
  });

  it('serialises simultaneous writes: exactly one wins, the others get 409', async () => {
    const s = await makeServer();
    const token = await tokenFor(s, CHEMIST);
    const entries = await Promise.all(
      ['b-okacet-1', 'b-dolo-1', 'b-pand-1'].map((batchId) => entryFor(s, CHEMIST, { type: 'ECO_SALE_LISTED', batchId, discountPct: 50 })),
    );
    const statuses = (await Promise.all(entries.map((e) => post(s, token, e)))).map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409]);
    expect(await verifyChain(s.log.chain)).toEqual({ ok: true, length: 1 });
  });

  it('keeps the log across a restart and replays it with the same rules', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'pharmaflow-'));
    try {
      const path = join(dir, 'test.db');
      const s = await makeServer(path);
      const token = await tokenFor(s, CHEMIST);
      await post(s, token, await entryFor(s, CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 }));
      s.db.close();

      const again = await makeServer(path);
      expect(again.log.chain).toHaveLength(1);
      expect(again.log.state.batches['b-okacet-1']!.status).toBe('ECO_SALE');
      // The same password still works: the hashes were kept, not replaced.
      expect((await login(again, CHEMIST)).status).toBe(200);
      again.db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses to start from a log that was edited in the database', async () => {
    const s = await makeServer();
    const token = await tokenFor(s, CHEMIST);
    await post(s, token, await entryFor(s, CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 }));
    s.db.prepare('UPDATE events SET payload = replace(payload, \'"discountPct":50\', \'"discountPct":60\')').run();
    await expect(EventLog.open(s.db, SEED)).rejects.toThrow(/damaged at event #0/);
  });
});

describe('reset and certificate verification', () => {
  it('lets only an admin reset the demo, and tells every browser', async () => {
    const s = await makeServer();
    const received: string[] = [];
    s.hub.add({ send: (d) => received.push(d) });
    const chemist = await tokenFor(s, CHEMIST);
    await post(s, chemist, await entryFor(s, CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 }));

    expect((await s.app.request('/api/reset', { method: 'POST', headers: bearer(chemist) })).status).toBe(403);
    expect(s.log.chain).toHaveLength(1);

    const admin = await tokenFor(s, ADMIN);
    expect((await s.app.request('/api/reset', { method: 'POST', headers: bearer(admin) })).status).toBe(200);
    expect(s.log.chain).toHaveLength(0);
    expect(s.log.state.batches['b-okacet-1']!.status).toBe('IN_STOCK');
    expect(received.map((m) => (JSON.parse(m) as { kind: string }).kind)).toEqual(['entry', 'reset']);
  });

  it('checks a certificate code for anyone, and shows only what the certificate says', async () => {
    const s = await makeServer();
    // Run a donation to the end as the real people, through the API.
    const [customer, chemist, rider] = await Promise.all([tokenFor(s, CUSTOMER), tokenFor(s, CHEMIST), tokenFor(s, RIDER)]);
    const send = async (token: string, who: string, p: DomainEventPayload) => expect((await post(s, token, await entryFor(s, who, p))).status).toBe(201);
    await send(customer, CUSTOMER, {
      type: 'PICKUP_SCHEDULED',
      pickup: {
        id: 'p1', kind: 'DONATION', sourceUserId: CUSTOMER, qaStoreId: 'store-ganesh', ngoId: 'ngo-seva', status: 'SCHEDULED',
        items: [{ medicineId: 'med-dolo650', batchNo: 'DL27A01', expiry: '2027-08-31', qty: 1, sealed: true, openedLiquid: false }],
        address: '12, Kadri Hills, Mangaluru', lat: 12.883, lng: 74.856, scheduledAt: s.log.state.today,
      },
    });
    await send(rider, RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
    await send(rider, RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'p1', riderId: RIDER });
    await send(rider, RIDER, { type: 'PICKUP_ARRIVED', pickupId: 'p1' });
    await send(rider, RIDER, { type: 'PICKUP_COLLECTED', pickupId: 'p1' });
    await send(chemist, CHEMIST, { type: 'PICKUP_QA_VERIFIED', pickupId: 'p1' });
    await send(rider, RIDER, { type: 'PICKUP_DELIVERED_TO_NGO', pickupId: 'p1' });

    const cert = s.log.state.certificates[0]!;
    const res = await s.app.request(`/api/verify/${cert.verifyCode.toLowerCase()}`); // no login, any case
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true, kind: 'NGO_DONOR', holder: 'Asha Shetty', issuedOn: cert.issuedOn, summary: cert.summary, code: cert.verifyCode });
    expect((await s.app.request('/api/verify/NOPE123')).status).toBe(404);
  });
});

describe('the basics around it', () => {
  it('reports health without a login, and says whether the demo password is still in use', async () => {
    const s = await makeServer();
    expect(await (await s.app.request('/api/health')).json()).toEqual({ app: 'pharmaflow', mode: 'server', events: 0, demoPassword: false });
  });

  it('answers unknown API paths with JSON, not a web page', async () => {
    const s = await makeServer();
    const res = await s.app.request('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('sends safe headers', async () => {
    const s = await makeServer();
    const res = await s.app.request('/api/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN'); // the All 4 view embeds pages of this same site
  });

  it('refuses a cookie-authenticated change that comes from another site', async () => {
    const s = await makeServer();
    const cookie = ((await login(s, ADMIN)).headers.get('set-cookie') ?? '').split(';')[0]!;
    const base = { method: 'POST', headers: { Cookie: cookie, Host: 'pharma.test', 'Content-Type': 'application/json' } };
    expect((await s.app.request('/api/reset', { ...base, headers: { ...base.headers, Origin: 'https://evil.test' } })).status).toBe(403);
    expect((await s.app.request('/api/reset', base)).status).toBe(403); // no Origin at all
    expect((await s.app.request('/api/reset', { ...base, headers: { ...base.headers, Origin: 'http://pharma.test' } })).status).toBe(200);
    // Reading with the cookie needs no Origin.
    expect((await s.app.request('/api/me', { headers: { Cookie: cookie } })).status).toBe(200);
  });
});

describe('live push over a WebSocket', () => {
  /** A real HTTP server and real WebSocket connections, on a free port. */
  async function listen(s: Server_) {
    const server = serve({ fetch: s.app.fetch, port: 0, hostname: 'localhost' }) as Server;
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const handle = attachWebSocket(server, s.hub, async (t) => (await readToken(t, SECRET)) !== null);
    const { port } = server.address() as AddressInfo;
    return { port, close: () => { handle.close(); server.close(); } };
  }

  function connect(port: number, token: string | null): Promise<{ ws: WebSocket; messages: string[]; closed: Promise<number> }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const messages: string[] = [];
      const closed = new Promise<number>((r) => ws.addEventListener('close', (e) => r(e.code)));
      ws.addEventListener('error', () => reject(new Error('socket error')));
      ws.addEventListener('message', (e) => messages.push(String(e.data)));
      ws.addEventListener('open', () => {
        if (token !== null) ws.send(JSON.stringify({ type: 'auth', token }));
        resolve({ ws, messages, closed });
      });
    });
  }

  it('pushes each stored entry to every signed-in browser, and nothing to one that never signed in', async () => {
    const s = await makeServer();
    const net = await listen(s);
    try {
      const token = await tokenFor(s, CHEMIST);
      const a = await connect(net.port, token);
      const b = await connect(net.port, await tokenFor(s, CUSTOMER));
      const stranger = await connect(net.port, 'forged-token');
      await vi.waitFor(() => expect(a.messages).toEqual(['{"kind":"ready"}']));
      await vi.waitFor(() => expect(b.messages).toEqual(['{"kind":"ready"}']));
      expect(await stranger.closed).toBe(4401);

      const entry = await entryFor(s, CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
      const res = await fetch(`http://localhost:${net.port}/api/events`, { ...json({ entry }), headers: { 'Content-Type': 'application/json', ...bearer(token) } });
      expect(res.status).toBe(201);

      for (const client of [a, b]) {
        await vi.waitFor(() => expect(client.messages).toHaveLength(2));
        expect(JSON.parse(client.messages[1]!)).toMatchObject({ kind: 'entry', entry: { index: 0, hash: entry.hash } });
      }
      a.ws.close();
      b.ws.close();
    } finally {
      net.close();
    }
  });

  it('closes a connection that does not sign in with a token first', async () => {
    const s = await makeServer();
    const net = await listen(s);
    try {
      const silent = await connect(net.port, null);
      silent.ws.send('hello'); // not a sign-in message
      expect(await silent.closed).toBe(4401);
      expect(s.hub.size).toBe(0);
    } finally {
      net.close();
    }
  });
});
