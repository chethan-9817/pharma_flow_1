import { applyEvent } from '../src/domain/reducer';
import type { DomainEvent, DomainEventPayload } from '../src/domain/events';
import type { Result } from '../src/domain/result';
import { createInitialState, type AppState, type Seed } from '../src/domain/state';
import { SEED } from '../src/seed';

/** Tiny test harness that applies events the way the store does. */
export class Sim {
  state: AppState;
  log: DomainEvent[] = [];
  private n = 0;

  constructor(seed: Seed = SEED) {
    this.state = createInitialState(seed);
  }

  emit(actorId: string, payload: DomainEventPayload): Result<AppState> {
    const event = { id: `e${++this.n}`, at: this.state.today, actorId, ...payload } as DomainEvent;
    const result = applyEvent(this.state, event);
    if (result.ok) {
      this.state = result.value;
      this.log.push(event);
    }
    return result;
  }

  /** Emit an event that must succeed. */
  must(actorId: string, payload: DomainEventPayload): AppState {
    const r = this.emit(actorId, payload);
    if (!r.ok) throw new Error(`${payload.type} failed: ${r.error}`);
    return r.value;
  }

  /** Emit an event that must be rejected, returning the reason. */
  mustFail(actorId: string, payload: DomainEventPayload): string {
    const r = this.emit(actorId, payload);
    if (r.ok) throw new Error(`${payload.type} should have been rejected`);
    return r.error;
  }
}

export const CHEMIST = 'u-chemist';
export const CUSTOMER = 'u-asha';
export const RIDER = 'u-rider';
export const ADMIN = 'u-admin';
export const STORE = 'store-ganesh';
