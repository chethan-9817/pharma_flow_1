import { fail, ok, type Check } from '../result';
import type { PickupKind, PickupStatus } from '../types';

/**
 * Reverse pickup (donation):
 *   SCHEDULED -> COLLECTED -> QA_VERIFIED -> DELIVERED_TO_NGO
 *                          \-> QA_REJECTED -> INCINERATED
 * Bio-disposal:
 *   SCHEDULED -> COLLECTED (sealed Yellow Bag) -> INCINERATED
 */
const DONATION: Record<PickupStatus, PickupStatus[]> = {
  SCHEDULED: ['COLLECTED'],
  COLLECTED: ['QA_VERIFIED', 'QA_REJECTED'],
  QA_VERIFIED: ['DELIVERED_TO_NGO'],
  QA_REJECTED: ['INCINERATED'],
  DELIVERED_TO_NGO: [],
  INCINERATED: [],
};

const DISPOSAL: Record<PickupStatus, PickupStatus[]> = {
  SCHEDULED: ['COLLECTED'],
  COLLECTED: ['INCINERATED'],
  QA_VERIFIED: [],
  QA_REJECTED: [],
  DELIVERED_TO_NGO: [],
  INCINERATED: [],
};

export function allowedNextPickup(kind: PickupKind, from: PickupStatus): PickupStatus[] {
  return (kind === 'DONATION' ? DONATION : DISPOSAL)[from];
}

export function checkPickupTransition(kind: PickupKind, from: PickupStatus, to: PickupStatus): Check {
  if (!allowedNextPickup(kind, from).includes(to)) {
    return fail(`Invalid ${kind.toLowerCase()} pickup transition ${from} -> ${to}`);
  }
  return ok;
}

export function isTerminal(kind: PickupKind, status: PickupStatus): boolean {
  return allowedNextPickup(kind, status).length === 0;
}
