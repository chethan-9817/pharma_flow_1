import { ServerStorage } from './storage';
import { BrowserTokens } from './tokens';
import { WebSocketTransport } from './transport';

/**
 * True for a build made with `--mode server` (npm run dev:server, npm run build:server). That build keeps
 * the event log on the PharmaFlow server and asks for a password; the normal build is the browser-only demo.
 */
export const SERVER_MODE = import.meta.env.MODE === 'server';

/** The password the demo users have until someone sets PHARMAFLOW_DEMO_PASSWORD. The login screen shows it only while it still works. */
export const DEMO_PASSWORD = 'pharmaflow';

export const tokens = new BrowserTokens();
export const serverStorage = new ServerStorage(tokens);
export const serverTransport = new WebSocketTransport(tokens);

export { ServerStorage, WebSocketTransport, BrowserTokens };
export { MemoryTokens, type TokenStore } from './tokens';
