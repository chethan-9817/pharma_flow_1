import { canPack } from '../rules/prescription';
import { fail, ok, type Check } from '../result';
import type { OrderStatus, RxStatus } from '../types';

/**
 * Forward order lifecycle:
 *   PLACED -> [RX_APPROVED] -> PACKED -> OUT_FOR_DELIVERY -> DELIVERED
 * RX_APPROVED is only used when the order contains Rx-only drugs.
 * Orders can be CANCELLED before packing (e.g. prescription rejected).
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ['RX_APPROVED', 'PACKED', 'CANCELLED'],
  RX_APPROVED: ['PACKED', 'CANCELLED'],
  PACKED: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export interface OrderContext {
  rxRequired: boolean;
  rxStatus: RxStatus;
}

export function allowedNext(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from];
}

export function checkOrderTransition(from: OrderStatus, to: OrderStatus, ctx: OrderContext): Check {
  if (!TRANSITIONS[from].includes(to)) return fail(`Invalid order transition ${from} -> ${to}`);

  if (to === 'RX_APPROVED' && !ctx.rxRequired) {
    return fail('This order has no prescription to approve');
  }
  if (to === 'RX_APPROVED' && ctx.rxStatus !== 'APPROVED') {
    return fail('Prescription has not been approved');
  }
  if (to === 'PACKED') {
    const gate = canPack(ctx.rxRequired, ctx.rxStatus);
    if (!gate.ok) return gate;
    if (ctx.rxRequired && from !== 'RX_APPROVED') {
      return fail('Orders with prescription drugs must pass RX_APPROVED before PACKED');
    }
  }
  return ok;
}

export const ORDER_STEPS: OrderStatus[] = ['PLACED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
