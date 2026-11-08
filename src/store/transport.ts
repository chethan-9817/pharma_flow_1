import type { Entry } from './persistence';

/** `resync` tells the store to reload the whole log, for example after a connection to the server was re-made. */
export type TransportMessage = { kind: 'entry'; entry: Entry } | { kind: 'reset' } | { kind: 'resync' };

/**
 * Moves new log entries between open tabs. Demo mode uses BroadcastChannel;
 * server mode uses a WebSocket adapter (`WebSocketTransport`) behind the same interface.
 */
export interface Transport {
  publish(message: TransportMessage): void;
  subscribe(listener: (message: TransportMessage) => void): () => void;
  close(): void;
}

export class BroadcastTransport implements Transport {
  private channel: BroadcastChannel;

  constructor(name = 'pharmaflow-events') {
    this.channel = new BroadcastChannel(name);
  }

  publish(message: TransportMessage): void {
    this.channel.postMessage(message);
  }

  subscribe(listener: (message: TransportMessage) => void): () => void {
    const handler = (e: MessageEvent<TransportMessage>) => listener(e.data);
    this.channel.addEventListener('message', handler);
    return () => this.channel.removeEventListener('message', handler);
  }

  close(): void {
    this.channel.close();
  }
}

/** In-process bus. Every transport made from the same bus hears the others, like tabs would. */
export class MemoryBus {
  private members = new Set<MemoryTransport>();
  join(): MemoryTransport {
    const t = new MemoryTransport(this);
    this.members.add(t);
    return t;
  }
  broadcast(from: MemoryTransport, message: TransportMessage): void {
    for (const m of this.members) if (m !== from) m.deliver(message);
  }
  leave(t: MemoryTransport): void {
    this.members.delete(t);
  }
}

export class MemoryTransport implements Transport {
  private listeners = new Set<(message: TransportMessage) => void>();
  constructor(private bus: MemoryBus) {}
  publish(message: TransportMessage): void {
    this.bus.broadcast(this, message);
  }
  subscribe(listener: (message: TransportMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  deliver(message: TransportMessage): void {
    for (const l of this.listeners) l(message);
  }
  close(): void {
    this.bus.leave(this);
  }
}
