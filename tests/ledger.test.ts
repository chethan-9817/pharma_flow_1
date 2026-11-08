import { describe, expect, it } from 'vitest';
import { GENESIS_HASH, appendEntry, canonicalize, sha256Hex, verifyChain, type LedgerEntry } from '../src/domain/ledger';

async function build(events: unknown[]): Promise<LedgerEntry[]> {
  const chain: LedgerEntry[] = [];
  for (const e of events) chain.push(await appendEntry(chain, e));
  return chain;
}

describe('canonicalize', () => {
  it('ignores key order and undefined values', () => {
    expect(canonicalize({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe(canonicalize({ a: [2, { d: 1 }], b: 1 }));
  });
});

describe('sha256', () => {
  it('matches a known digest', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('hash chain', () => {
  const events = [
    { type: 'A', n: 1 },
    { type: 'B', n: 2 },
    { type: 'C', n: 3 },
  ];

  it('starts from the genesis hash', async () => {
    const chain = await build(events);
    expect(chain[0]!.prevHash).toBe(GENESIS_HASH);
    expect(chain[1]!.prevHash).toBe(chain[0]!.hash);
  });

  it('verifies an intact chain, including an empty one', async () => {
    expect(await verifyChain(await build(events))).toEqual({ ok: true, length: 3 });
    expect(await verifyChain([])).toEqual({ ok: true, length: 0 });
  });

  it('detects an altered past event', async () => {
    const chain = await build(events);
    chain[1] = { ...chain[1]!, event: { type: 'B', n: 999 } };
    expect(await verifyChain(chain)).toMatchObject({ ok: false, brokenAt: 1 });
  });

  it('detects a removed entry', async () => {
    const chain = await build(events);
    chain.splice(1, 1);
    expect((await verifyChain(chain)).ok).toBe(false);
  });

  it('detects a recomputed hash that breaks the next link', async () => {
    const chain = await build(events);
    const forged = { type: 'A', n: 100 };
    chain[0] = { ...chain[0]!, event: forged, hash: await sha256Hex(GENESIS_HASH + canonicalize(forged)) };
    expect(await verifyChain(chain)).toMatchObject({ ok: false, brokenAt: 1 });
  });
});
