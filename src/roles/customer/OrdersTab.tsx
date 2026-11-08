import { Gift, Package, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { requiresRx } from '../../domain/rules/prescription';
import type { Order, User } from '../../domain/types';
import { Badge, Button, Card, SectionTitle, inr } from '../../components/ui';
import { report } from '../../components/toast';
import { newId } from '../../lib/id';
import { dispatch, useApp } from '../../store';
import { RxForm, draftToPrescription, emptyDraft, type RxDraft } from './RxForm';

const STATUS_LABEL: Record<string, string> = {
  PLACED: 'Order placed',
  RX_APPROVED: 'Prescription approved',
  PACKED: 'Packed, finding a rider',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

function ResubmitRx({ user, order }: { user: User; order: Order }) {
  const app = useApp();
  const needs = order.items.filter((i) => requiresRx(app.medicines[i.medicineId]!));
  const [draft, setDraft] = useState<RxDraft>(() => emptyDraft(user.name, app.today, needs.map((i) => ({ medicineId: i.medicineId, qty: i.qty }))));
  const drugs = [...new Set(needs.map((i) => i.medicineId))].map((id) => app.medicines[id]!);

  return (
    <div className="space-y-3">
      <RxForm draft={draft} onChange={setDraft} drugs={drugs} catalog={Object.values(app.medicines)} />
      <Button
        block
        onClick={async () =>
          report(await dispatch(user.id, { type: 'RX_RESUBMITTED', orderId: order.id, prescription: draftToPrescription(draft, newId('rx'), user.id) }), 'New prescription sent for review')
        }
      >
        Send new prescription
      </Button>
    </div>
  );
}

export function OrdersTab({ user }: { user: User }) {
  const app = useApp();
  const orders = Object.values(app.orders).filter((o) => o.customerId === user.id).reverse();
  const cards = Object.values(app.scratchCards).filter((c) => c.userId === user.id);

  return (
    <div className="space-y-6">
      {cards.length > 0 && (
        <section>
          <SectionTitle>Scratch cards</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {cards.map((c) => (
              <Card key={c.id} className="space-y-2 text-center">
                {c.revealed ? (
                  <>
                    <Sparkles className="mx-auto size-6 text-expiry" />
                    <p className="text-sm font-semibold text-slate-900">{c.rewardCredit > 0 ? `${inr(c.rewardCredit)} MedWallet` : `${c.rewardKarma} karma`}</p>
                  </>
                ) : (
                  <>
                    <Gift className="mx-auto size-6 text-eco" />
                    <Button size="sm" variant="eco" block onClick={async () => report(await dispatch(user.id, { type: 'SCRATCH_CARD_REVEALED', cardId: c.id }), 'Reward added')}>
                      Reveal
                    </Button>
                  </>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>My orders</SectionTitle>
        {orders.length === 0 && <p className="text-sm text-slate-500">No orders yet.</p>}
        <div className="space-y-3">
          {orders.map((o) => {
            const rejected = o.status === 'PLACED' && o.rxStatus === 'REJECTED';
            const open = o.status !== 'DELIVERED' && o.status !== 'CANCELLED';
            return (
              <Card key={o.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-medical">
                    <Package className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {o.items.map((i) => `${app.medicines[i.medicineId]?.brand} ×${i.qty}`).join(', ')}
                    </p>
                    <p className="text-xs text-slate-500">{rejected ? 'Prescription rejected' : STATUS_LABEL[o.status]} · {inr(o.total)}</p>
                  </div>
                  {open && !rejected && o.rxStatus !== 'PENDING' && <Badge tone="blue">OTP {o.deliveryOtp}</Badge>}
                  {o.rxStatus === 'PENDING' && <Badge tone="amber">Rx under review</Badge>}
                  {o.status === 'DELIVERED' && <Badge tone="green">Done</Badge>}
                </div>
                {rejected && (
                  <div className="space-y-3">
                    <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Reason: {o.rxRejectReason}. Upload a clearer or correct prescription.</p>
                    <ResubmitRx user={user} order={o} />
                  </div>
                )}
                {(o.status === 'PLACED' || o.status === 'RX_APPROVED') && (
                  <Button size="sm" variant="ghost" onClick={async () => report(await dispatch(user.id, { type: 'ORDER_CANCELLED', orderId: o.id }), 'Order cancelled')}>
                    Cancel order
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
