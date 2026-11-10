import { afterEach, describe, expect, it } from 'vitest';
import { SEED } from '../src/seed';
import { MemoryStorage, type Entry } from '../src/store/persistence';
import { createPharmaStore, type PharmaStore } from '../src/store/store';
import { MemoryBus } from '../src/store/transport';
import { ADMIN, CHEMIST } from './helpers';

/** Two "tabs": separate stores that share one event log and one bus. */
function twoTabs() {
  const log: Entry[] = [];
  const bus = new MemoryBus();
  let n = 0;
  const make = (): PharmaStore =>
    createPharmaStore({ seed: SEED, storage: new MemoryStorage(log), transport: bus.join(), newId: (p) => `${p}-${++n}` });
  return { log, bus, a: make(), b: make(), make };
}

const flush = () => new Promise((r) => setTimeout(r, 10));
const stores: PharmaStore[] = [];
afterEach(() => stores.splice(0).forEach((s) => s.getState().dispose()));

async function tabs() {
  const t = twoTabs();
  stores.push(t.a, t.b);
  await t.a.getState().init();
  await t.b.getState().init();
  return t;
}

describe('store', () => {
  it('starts from the seed and becomes ready', async () => {
    const { a } = await tabs();
    expect(a.getState().ready).toBe(true);
    expect(a.getState().app.today).toBe(SEED.today);
    expect(a.getState().chain).toHaveLength(0);
  });

  it('syncs an event to another tab without a refresh', async () => {
    const { a, b } = await tabs();
    const r = await a.getState().dispatch(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 });
    expect(r.ok).toBe(true);
    await flush();
    expect(b.getState().app.batches['b-okacet-1']!.status).toBe('ECO_SALE');
    expect(b.getState().chain).toHaveLength(1);
  });

  it('never stores events that break a business rule', async () => {
    const { a, log } = await tabs();
    const r = await a.getState().dispatch(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-limcee-1', discountPct: 50 });
    expect(r.ok).toBe(false);
    expect(log).toHaveLength(0);
    expect(a.getState().chain).toHaveLength(0);
  });

  it('re-validates when two tabs write at the same moment', async () => {
    const { a, b, log } = await tabs();
    const [ra, rb] = await Promise.all([
      a.getState().dispatch(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-12-01' }),
      b.getState().dispatch(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-12-01' }),
    ]);
    expect([ra.ok, rb.ok].filter(Boolean)).toHaveLength(1);
    const loser = ra.ok ? rb : ra;
    expect(loser.ok === false && loser.error).toMatch(/forward/);
    await flush();
    expect(log).toHaveLength(1);
    expect(a.getState().app.today).toBe('2026-12-01');
    expect(b.getState().app.today).toBe('2026-12-01');
  });

  it('keeps both writes when tabs act on different things at once', async () => {
    const { a, b, log } = await tabs();
    await Promise.all([
      a.getState().dispatch(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-okacet-1', discountPct: 50 }),
      b.getState().dispatch(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-11-20' }),
    ]);
    await flush();
    expect(log).toHaveLength(2);
    for (const s of [a, b]) {
      expect(s.getState().app.today).toBe('2026-11-20');
      expect(s.getState().app.batches['b-okacet-1']!.status).toBe('ECO_SALE');
    }
  });

  it('restores state from the stored log in a new tab', async () => {
    const { a, make } = await tabs();
    await a.getState().dispatch(ADMIN, { type: 'TIME_TRAVELLED', to: '2027-01-15' });
    const fresh = make();
    stores.push(fresh);
    await fresh.getState().init();
    expect(fresh.getState().app.today).toBe('2027-01-15');
  });

  it('resets every tab and clears the log', async () => {
    const { a, b, log } = await tabs();
    await a.getState().dispatch(ADMIN, { type: 'TIME_TRAVELLED', to: '2027-01-15' });
    await flush();
    await b.getState().reset();
    await flush();
    expect(log).toHaveLength(0);
    expect(a.getState().app.today).toBe(SEED.today);
    expect(a.getState().chain).toHaveLength(0);
  });

  it('verifies the ledger and spots tampering', async () => {
    const { a } = await tabs();
    await a.getState().dispatch(ADMIN, { type: 'TIME_TRAVELLED', to: '2026-12-01' });
    await a.getState().dispatch(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: 'b-augmentin-1', discountPct: 40 });
    expect(await a.getState().verifyLedger()).toEqual({ ok: true, length: 2 });
    const chain = a.getState().chain;
    const tampered = { ...chain[0]!, event: { ...chain[0]!.event, at: '2020-01-01' } };
    a.setState({ chain: [tampered, chain[1]!] });
    expect((await a.getState().verifyLedger()).ok).toBe(false);
  });

  it('keeps sessions per role without syncing them', async () => {
    const { a, b } = await tabs();
    a.getState().login('customer', 'u-asha');
    expect(a.getState().sessions).toEqual({ customer: 'u-asha' });
    expect(b.getState().sessions).toEqual({});
    a.getState().logout('customer');
    expect(a.getState().sessions).toEqual({});
  });
});
