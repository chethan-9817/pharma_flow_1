import { Package } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { requiresRx } from '../../domain/rules/prescription';
import { orderFundShare } from '../../domain/selectors';
import type { Order, User } from '../../domain/types';
import { Badge, Button, Card, SectionTitle, inr } from '../../components/ui';
import { report } from '../../components/toast';
import { newId } from '../../lib/id';
import { dispatch, useApp } from '../../store';
import { RxForm, draftToPrescription, emptyDraft, type RxDraft } from './RxForm';
import { ScratchCardView } from './ScratchCardView';
import { TrackOrder } from './TrackOrder';

function ResubmitRx({ user, order }: { user: User; order: Order }) {
  const { t } = useTranslation();
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
          report(await dispatch(user.id, { type: 'RX_RESUBMITTED', orderId: order.id, prescription: draftToPrescription(draft, newId('rx'), user.id) }), t('customer.orders.rxSent'))
        }
      >
        {t('customer.orders.sendRx')}
      </Button>
    </div>
  );
}

export function OrdersTab({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const orders = Object.values(app.orders).filter((o) => o.customerId === user.id).reverse();
  const cards = Object.values(app.scratchCards).filter((c) => c.userId === user.id);

  return (
    <div className="space-y-6">
      {cards.length > 0 && (
        <section>
          <SectionTitle>{t('customer.orders.scratchCards')}</SectionTitle>
          <div className="grid gap-4 @lg:grid-cols-2 @4xl:grid-cols-3">
            {cards.map((c) => (
              <Card key={c.id} className="p-4">
                <ScratchCardView card={c} userId={user.id} />
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>{t('customer.orders.myOrders')}</SectionTitle>
        {orders.length === 0 && <p className="text-sm text-slate-500">{t('customer.orders.none')}</p>}
        <div className="grid items-start gap-3 @3xl:grid-cols-2">
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
                    <p className="text-xs text-slate-500">{rejected ? t('customer.orders.rxRejected') : t(`customer.orders.status.${o.status}`)} · {inr(o.total)}</p>
                  </div>
                  {open && !rejected && o.rxStatus !== 'PENDING' && <Badge tone="blue">{t('customer.orders.otp', { otp: o.deliveryOtp })}</Badge>}
                  {o.rxStatus === 'PENDING' && <Badge tone="amber">{t('customer.orders.rxReview')}</Badge>}
                  {o.status === 'DELIVERED' && <Badge tone="green">{t('customer.orders.done')}</Badge>}
                </div>
                {open && !rejected && <TrackOrder order={o} />}
                {o.status === 'DELIVERED' && orderFundShare(app, o.id) > 0 && (
                  <p className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
                    {t('customer.orders.fundShare', { amount: inr(orderFundShare(app, o.id)) })}
                  </p>
                )}
                {rejected && (
                  <div className="space-y-3">
                    <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{t('customer.orders.reason', { reason: o.rxRejectReason })}</p>
                    <ResubmitRx user={user} order={o} />
                  </div>
                )}
                {(o.status === 'PLACED' || o.status === 'RX_APPROVED') && (
                  <Button size="sm" variant="ghost" onClick={async () => report(await dispatch(user.id, { type: 'ORDER_CANCELLED', orderId: o.id }), t('customer.orders.cancelled'))}>
                    {t('customer.orders.cancel')}
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
