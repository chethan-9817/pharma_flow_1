import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Hub } from './hub';

const AUTH_TIMEOUT_MS = 5_000;
const PING_EVERY_MS = 30_000;

/**
 * Lets browsers connect at `/ws` and receive every new log entry the moment it is stored.
 *
 * A browser cannot set headers on a WebSocket, and a token in the address would end up in logs, so the
 * first message must be `{ "type": "auth", "token": "..." }`. The server answers `{ "kind": "ready" }`
 * and from then on pushes entries. A connection that does not sign in within a few seconds is closed.
 */
export function attachWebSocket(server: Server, hub: Hub, isValidToken: (token: string) => Promise<boolean>): { close(): void } {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 });
  const alive = new WeakSet<WebSocket>();

  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path !== '/ws') {
      socket.destroy();
      return;
    }
    // Only pages served by this server may connect (browsers always send Origin for WebSockets).
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      let leave: (() => void) | undefined;
      alive.add(ws);
      const timer = setTimeout(() => ws.close(4401, 'Sign in first'), AUTH_TIMEOUT_MS);

      ws.on('pong', () => alive.add(ws));
      ws.once('message', (data) => {
        clearTimeout(timer);
        void (async () => {
          let token: unknown;
          try {
            const message = JSON.parse(data.toString()) as { type?: string; token?: unknown };
            if (message.type === 'auth') token = message.token;
          } catch {
            /* not JSON: treated as no token */
          }
          if (typeof token !== 'string' || !(await isValidToken(token))) {
            ws.close(4401, 'Sign in first');
            return;
          }
          leave = hub.add(ws);
          ws.send(JSON.stringify({ kind: 'ready' }));
        })();
      });
      ws.on('close', () => {
        clearTimeout(timer);
        leave?.();
      });
      ws.on('error', () => ws.close());
    });
  });

  // Drop connections whose browser vanished without saying goodbye.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) {
        ws.terminate();
        continue;
      }
      alive.delete(ws);
      ws.ping();
    }
  }, PING_EVERY_MS);
  heartbeat.unref();

  return {
    close() {
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    },
  };
}
