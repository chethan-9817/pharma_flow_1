import { describe, expect, it } from 'vitest';
import { checkOrderTransition } from '../src/domain/machines/order';
import { checkPickupTransition, isTerminal } from '../src/domain/machines/pickup';

const noRx = { rxRequired: false, rxStatus: 'NOT_REQUIRED' } as const;
const rxPending = { rxRequired: true, rxStatus: 'PENDING' } as const;
const rxOk = { rxRequired: true, rxStatus: 'APPROVED' } as const;

describe('order state machine', () => {
  it('walks the happy path without a prescription', () => {
    expect(checkOrderTransition('PLACED', 'PACKED', noRx).ok).toBe(true);
    expect(checkOrderTransition('PACKED', 'OUT_FOR_DELIVERY', noRx).ok).toBe(true);
    expect(checkOrderTransition('OUT_FOR_DELIVERY', 'DELIVERED', noRx).ok).toBe(true);
  });
  it('requires RX_APPROVED before PACKED when a prescription is needed', () => {
    expect(checkOrderTransition('PLACED', 'PACKED', rxPending).ok).toBe(false);
    expect(checkOrderTransition('PLACED', 'PACKED', rxOk).ok).toBe(false);
    expect(checkOrderTransition('PLACED', 'RX_APPROVED', rxOk).ok).toBe(true);
    expect(checkOrderTransition('RX_APPROVED', 'PACKED', rxOk).ok).toBe(true);
  });
  it('cannot approve a prescription that was not approved, or one that does not exist', () => {
    expect(checkOrderTransition('PLACED', 'RX_APPROVED', rxPending).ok).toBe(false);
    expect(checkOrderTransition('PLACED', 'RX_APPROVED', noRx).ok).toBe(false);
  });
  it('rejects skipped and backward jumps', () => {
    expect(checkOrderTransition('PLACED', 'DELIVERED', noRx).ok).toBe(false);
    expect(checkOrderTransition('PACKED', 'PLACED', noRx).ok).toBe(false);
    expect(checkOrderTransition('PLACED', 'OUT_FOR_DELIVERY', noRx).ok).toBe(false);
  });
  it('cannot leave a terminal state', () => {
    expect(checkOrderTransition('DELIVERED', 'PACKED', noRx).ok).toBe(false);
    expect(checkOrderTransition('CANCELLED', 'PLACED', noRx).ok).toBe(false);
  });
  it('allows cancelling before packing only', () => {
    expect(checkOrderTransition('PLACED', 'CANCELLED', rxPending).ok).toBe(true);
    expect(checkOrderTransition('PACKED', 'CANCELLED', noRx).ok).toBe(false);
  });
});

describe('pickup state machine', () => {
  it('donation: collect, then QA verify and hand over', () => {
    expect(checkPickupTransition('DONATION', 'SCHEDULED', 'COLLECTED').ok).toBe(true);
    expect(checkPickupTransition('DONATION', 'COLLECTED', 'QA_VERIFIED').ok).toBe(true);
    expect(checkPickupTransition('DONATION', 'QA_VERIFIED', 'DELIVERED_TO_NGO').ok).toBe(true);
  });
  it('donation: rejected items go to incineration', () => {
    expect(checkPickupTransition('DONATION', 'COLLECTED', 'QA_REJECTED').ok).toBe(true);
    expect(checkPickupTransition('DONATION', 'QA_REJECTED', 'INCINERATED').ok).toBe(true);
    expect(checkPickupTransition('DONATION', 'QA_REJECTED', 'DELIVERED_TO_NGO').ok).toBe(false);
  });
  it('donation: cannot skip QA', () => {
    expect(checkPickupTransition('DONATION', 'COLLECTED', 'DELIVERED_TO_NGO').ok).toBe(false);
    expect(checkPickupTransition('DONATION', 'SCHEDULED', 'QA_VERIFIED').ok).toBe(false);
  });
  it('disposal: collect then incinerate, no QA step', () => {
    expect(checkPickupTransition('DISPOSAL', 'SCHEDULED', 'COLLECTED').ok).toBe(true);
    expect(checkPickupTransition('DISPOSAL', 'COLLECTED', 'INCINERATED').ok).toBe(true);
    expect(checkPickupTransition('DISPOSAL', 'COLLECTED', 'QA_VERIFIED').ok).toBe(false);
    expect(checkPickupTransition('DISPOSAL', 'SCHEDULED', 'INCINERATED').ok).toBe(false);
  });
  it('knows terminal states', () => {
    expect(isTerminal('DONATION', 'DELIVERED_TO_NGO')).toBe(true);
    expect(isTerminal('DISPOSAL', 'INCINERATED')).toBe(true);
    expect(isTerminal('DONATION', 'COLLECTED')).toBe(false);
  });
});
