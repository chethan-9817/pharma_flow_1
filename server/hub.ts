import type { Entry } from './log';

/** What the server pushes to every connected browser. */
export type HubMessage = { kind: 'entry'; entry: Entry } | { kind: 'reset' };

/** Anything that can receive a pushed message. A real WebSocket fits, and so does a plain object in a test. */
export interface HubClient {
  send(data: string): void;
}

/** Keeps the signed-in connections and tells all of them about every new log entry. */
export class Hub {
  private readonly clients = new Set<HubClient>();

  add(client: HubClient): () => void {
    this.clients.add(client);
    return () => this.clients.delete(client);
  }

  get size(): number {
    return this.clients.size;
  }

  broadcast(message: HubMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      try {
        client.send(data);
      } catch {
        // A connection that cannot be written to is already closing; the browser re-syncs when it reconnects.
        this.clients.delete(client);
      }
    }
  }
}
