import { pharma } from '../store';
import { serverTransport, tokens } from '../store/server';

export type SignInResult = { ok: true } | { ok: false; error: string };

/** Signs a user in on the server and, when that works, starts the live connection and loads the data. */
export async function signIn(userId: string, password: string): Promise<SignInResult> {
  let res: Response;
  try {
    res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, password }) });
  } catch {
    return { ok: false, error: 'The PharmaFlow server cannot be reached. Is it running?' };
  }
  const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !body.token) return { ok: false, error: body.error ?? 'Could not sign in' };
  tokens.set(userId, body.token);
  serverTransport.connect();
  await pharma.getState().reload();
  return { ok: true };
}

/** Signs a user out everywhere in this browser and on the server's cookie. */
export function signOut(userId: string): void {
  tokens.clear(userId);
  void fetch('/api/logout', { method: 'POST' }).catch(() => undefined);
}

/** Whether the server still uses the built-in demo password (so the login screen may show it). Null when it cannot be reached. */
export async function fetchHealth(): Promise<{ demoPassword: boolean } | null> {
  try {
    const res = await fetch('/api/health');
    const body = (await res.json()) as { app?: string; demoPassword?: boolean };
    return body.app === 'pharmaflow' ? { demoPassword: Boolean(body.demoPassword) } : null;
  } catch {
    return null;
  }
}

export type CertificateCheck =
  | { status: 'valid'; kind: 'NGO_DONOR' | 'GREEN_CITIZEN' | 'BLOOD_DONOR'; holder: string | null; issuedOn: string; summary: string; code: string }
  | { status: 'invalid' }
  | { status: 'unreachable' };

/** Asks the server whether a certificate code is real. Public: no login needed. */
export async function checkCertificate(code: string): Promise<CertificateCheck> {
  try {
    const res = await fetch(`/api/verify/${encodeURIComponent(code)}`);
    if (res.status === 404) return { status: 'invalid' };
    if (!res.ok) return { status: 'unreachable' };
    const body = (await res.json()) as Omit<Extract<CertificateCheck, { status: 'valid' }>, 'status'>;
    return { status: 'valid', ...body };
  } catch {
    return { status: 'unreachable' };
  }
}
