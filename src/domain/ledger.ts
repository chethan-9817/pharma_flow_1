/**
 * Tamper-evident audit ledger. Every entry stores sha256(prevHash + payload),
 * so changing any past event breaks the chain from that point on.
 */
export const GENESIS_HASH = '0'.repeat(64);

export interface LedgerEntry<E = unknown> {
  index: number;
  event: E;
  prevHash: string;
  hash: string;
}

export type VerifyResult = { ok: true; length: number } | { ok: false; brokenAt: number; reason: string };

/** JSON with sorted keys, so the same event always hashes the same. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hashEvent(prevHash: string, event: unknown): Promise<string> {
  return sha256Hex(prevHash + canonicalize(event));
}

export async function appendEntry<E>(chain: readonly LedgerEntry<E>[], event: E): Promise<LedgerEntry<E>> {
  const prevHash = chain.length ? chain[chain.length - 1]!.hash : GENESIS_HASH;
  return { index: chain.length, event, prevHash, hash: await hashEvent(prevHash, event) };
}

export async function verifyChain<E>(chain: readonly LedgerEntry<E>[]): Promise<VerifyResult> {
  let prev = GENESIS_HASH;
  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i]!;
    if (entry.index !== i) return { ok: false, brokenAt: i, reason: 'Entry index out of sequence' };
    if (entry.prevHash !== prev) return { ok: false, brokenAt: i, reason: 'Previous hash does not match' };
    const expected = await hashEvent(prev, entry.event);
    if (entry.hash !== expected) return { ok: false, brokenAt: i, reason: 'Event content was altered' };
    prev = entry.hash;
  }
  return { ok: true, length: chain.length };
}
