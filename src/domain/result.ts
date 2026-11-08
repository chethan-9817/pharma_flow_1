export type Check = { ok: true } | { ok: false; reason: string };
export const ok: Check = { ok: true };
export const fail = (reason: string): Check => ({ ok: false, reason });

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
