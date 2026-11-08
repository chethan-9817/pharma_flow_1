import type { Transport, TransportMessage } from '../transport';
import type { TokenStore } from './tokens';

interface Socket {
  send(data: string): void;
  close(): void;
  onopen: ((e: unknown) => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: ((e: { code: number }) => void) | null;
  onerror: ((e: unknown) => void) | null;
}
type SocketFactory = (url: string) => Socket;

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 10_000;

const defaultUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

/**
 * Server mode: the server pushes every new log entry to every connected browser over a WebSocket. It is
 * the same `Transport` as the BroadcastChannel one, so the store does not know the difference.
 *
 * `publish` does nothing: the server stores an entry and then tells everyone, including the browser that
 * wrote it, which simply ignores an entry it already has. After every (re)connection the store is asked to
 * reload the log, so nothing is missed while the connection was down.
 */
export class WebSocketTransport implements Transport {
  private readonly listeners = new Set<(message: TransportMessage) => void>();
  private socket: Socket | null = null;
  private token: string | undefined;
  private delay = MIN_DELAY_MS;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  constructor(
    private readonly tokens: TokenStore,
    private readonly url: () => string = defaultUrl,
    private readonly open: SocketFactory = (url) => new WebSocket(url) as unknown as Socket,
  ) {}

  publish(): void {
    /* the server broadcasts every stored entry itself */
  }

  subscribe(listener: (message: TransportMessage) => void): () => void {
    this.listeners.add(listener);
    this.connect();
    return () => this.listeners.delete(listener);
  }

  /** Opens the connection, once someone is signed in. Safe to call any time, for example right after signing in. */
  connect(): void {
    if (this.closed || this.socket) return;
    const token = this.tokens.any();
    if (!token) return; // the server only talks to signed-in browsers; try again after the next sign-in
    this.token = token;
    clearTimeout(this.timer);

    const socket = this.open(this.url());
    this.socket = socket;
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
    socket.onmessage = (event) => {
      let message: { kind?: string };
      try {
        message = JSON.parse(String(event.data)) as { kind?: string };
      } catch {
        return;
      }
      if (message.kind === 'ready') {
        this.delay = MIN_DELAY_MS;
        this.emit({ kind: 'resync' });
      } else if (message.kind === 'entry' || message.kind === 'reset') {
        this.emit(message as TransportMessage);
      }
    };
    socket.onclose = (event) => {
      if (this.socket === socket) this.socket = null;
      // 4401: the server did not accept this token. Forget it and try with another one, if there is one.
      if (event.code === 4401 && this.token) this.tokens.clearToken(this.token);
      this.scheduleReconnect();
    };
    socket.onerror = () => {
      /* followed by onclose, which reconnects */
    };
  }

  close(): void {
    this.closed = true;
    clearTimeout(this.timer);
    this.socket?.close();
    this.socket = null;
  }

  private emit(message: TransportMessage): void {
    for (const listener of this.listeners) listener(message);
  }

  private scheduleReconnect(): void {
    if (this.closed || this.timer || this.listeners.size === 0) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.connect();
    }, this.delay);
    this.delay = Math.min(this.delay * 2, MAX_DELAY_MS);
  }
}
