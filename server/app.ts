import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context, type Next } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import type { User } from '../src/domain/types';
import { COOKIE_NAME, LoginLimiter, checkPassword, issueToken, readToken } from './auth';
import type { Db } from './db';
import type { Hub } from './hub';
import type { EventLog } from './log';

/** Prescription photos travel inside events (shrunk by the browser), so a request can be a few MB. */
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const SESSION_SECONDS = 12 * 3600;

export interface AppDeps {
  db: Db;
  log: EventLog;
  hub: Hub;
  /** Reference users from the seed. Logins are for these users. */
  users: Record<string, User>;
  /** Signs login tokens. */
  secret: string;
  /** True while the built-in demo password is still in use, so the login screen can say what it is. */
  demoPassword: boolean;
  limiter?: LoginLimiter;
  /** Set the cookie's Secure flag. Turn it on when the site is served over HTTPS. */
  secureCookie?: boolean;
  /** Folder with the built app, relative to the working directory. Leave out to serve only the API. */
  staticRoot?: string;
}

type Env = { Variables: { user: User } };

const LoginSchema = z.object({ userId: z.string().min(1).max(64), password: z.string().min(1).max(200) });

const publicUser = (u: User) => ({ id: u.id, role: u.role, name: u.name, ...(u.storeId ? { storeId: u.storeId } : {}) });

/**
 * The server-mode API. It is a plain Hono app, so tests can call it without opening a port.
 *
 * - `POST /api/login`  bcrypt password check, returns a JWT (also set as an HttpOnly cookie)
 * - `GET  /api/events` the log (needs login)
 * - `POST /api/events` append one entry; the same reducer as the browser checks it
 * - `POST /api/reset`  admin only: "Reset demo"
 * - `GET  /api/verify/:code` public: is this certificate code real?
 */
export function createApp(deps: AppDeps): Hono<Env> {
  const app = new Hono<Env>();
  const limiter = deps.limiter ?? new LoginLimiter();

  app.use('*', secureHeaders());
  app.use('/api/*', bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: 'That request is too large' }, 413) }));

  /** The token from the Authorization header (one per signed-in role in the browser) or else the cookie. */
  async function authenticate(c: Context<Env>, next: Next) {
    const header = c.req.header('Authorization');
    const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    const userId = await readToken(bearer ?? getCookie(c, COOKIE_NAME), deps.secret);
    const user = userId ? deps.users[userId] : undefined;
    if (!user) return c.json({ error: 'Please sign in' }, 401);

    // A cookie is sent by the browser on its own, so a change made with one must come from this site.
    if (!bearer && c.req.method !== 'GET') {
      const origin = c.req.header('Origin');
      if (!origin || new URL(origin).host !== c.req.header('Host')) return c.json({ error: 'Cross-site request refused' }, 403);
    }
    c.set('user', user);
    await next();
  }

  app.get('/api/health', (c) =>
    c.json({ app: 'pharmaflow', mode: 'server', events: deps.log.chain.length, demoPassword: deps.demoPassword }),
  );

  app.post('/api/login', async (c) => {
    const body = LoginSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'Enter a user and a password' }, 400);
    const { userId, password } = body.data;
    // Per user rather than per address: the server often sits behind a proxy, where every address looks the same.
    if (limiter.blocked(userId)) return c.json({ error: 'Too many wrong passwords. Wait a minute and try again.' }, 429);

    const user = deps.users[userId];
    if (!user || !(await checkPassword(deps.db, userId, password))) {
      limiter.fail(userId);
      return c.json({ error: 'Wrong user or password' }, 401);
    }
    limiter.clear(userId);
    const token = await issueToken(user.id, deps.secret);
    setCookie(c, COOKIE_NAME, token, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: SESSION_SECONDS, secure: deps.secureCookie ?? false });
    return c.json({ token, user: publicUser(user) });
  });

  app.post('/api/logout', (c) => {
    deleteCookie(c, COOKIE_NAME, { path: '/' });
    return c.json({ ok: true });
  });

  app.get('/api/me', authenticate, (c) => c.json({ user: publicUser(c.var.user) }));

  app.get('/api/events', authenticate, (c) => {
    const after = Number(c.req.query('after') ?? -1);
    return c.json({ entries: deps.log.entriesAfter(Number.isInteger(after) ? after : -1) });
  });

  app.post('/api/events', authenticate, async (c) => {
    const body = (await c.req.json().catch(() => null)) as { entry?: unknown } | null;
    const result = await deps.log.append(body?.entry, c.var.user.id);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    deps.hub.broadcast({ kind: 'entry', entry: result.entry });
    return c.json({ ok: true, index: result.entry.index }, 201);
  });

  app.post('/api/reset', authenticate, (c) => {
    if (c.var.user.role !== 'admin') return c.json({ error: 'Only an admin can reset the demo' }, 403);
    deps.log.reset();
    deps.hub.broadcast({ kind: 'reset' });
    return c.json({ ok: true });
  });

  // Public on purpose: the QR code on a certificate must work for anyone, and it reveals only what the certificate says.
  app.get('/api/verify/:code', (c) => {
    const code = c.req.param('code').trim().toUpperCase();
    const state = deps.log.state;
    const cert = state.certificates.find((x) => x.verifyCode.toUpperCase() === code);
    if (!cert) return c.json({ valid: false }, 404);
    return c.json({
      valid: true,
      kind: cert.kind,
      holder: state.users[cert.userId]?.name ?? null,
      issuedOn: cert.issuedOn,
      summary: cert.summary,
      code: cert.verifyCode,
    });
  });

  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

  if (deps.staticRoot) {
    // The built single-page app: files first, then index.html for every other path (React Router handles it).
    app.use('*', serveStatic({ root: deps.staticRoot }));
    app.get('*', serveStatic({ path: `${deps.staticRoot}/index.html` }));
  }

  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: 'Something went wrong on the server' }, 500);
  });

  return app;
}
