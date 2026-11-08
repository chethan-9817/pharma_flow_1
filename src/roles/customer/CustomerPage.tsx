import { motion } from 'framer-motion';
import { Gift, Leaf, Package, Sparkles, Wallet } from 'lucide-react';
import { requiresRx } from '../../domain/rules/prescription';
import { ecoListings, type EcoListing } from '../../domain/selectors';
import type { User } from '../../domain/types';
import { Badge, Button, Card, SectionTitle, inr } from '../../components/ui';
import { report } from '../../components/toast';
import { newId } from '../../lib/id';
import { dispatch, useApp } from '../../store';

const STATUS_LABEL: Record<string, string> = {
  PLACED: 'Order placed',
  RX_APPROVED: 'Prescription approved',
  PACKED: 'Packed, finding a rider',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export function CustomerPage({ user }: { user: User }) {
  const app = useApp();
  const deals = ecoListings(app);
  const orders = Object.values(app.orders).filter((o) => o.customerId === user.id).reverse();
  const cards = Object.values(app.scratchCards).filter((c) => c.userId === user.id);

  const buy = async (deal: EcoListing) => {
    const otp = String(Math.floor(1000 + Math.random() * 9000));
    const result = await dispatch(user.id, {
      type: 'ORDER_PLACED',
      order: {
        id: newId('ord'),
        customerId: user.id,
        storeId: deal.batch.storeId,
        items: [{ medicineId: deal.medicine.id, batchId: deal.batch.id, qty: 1, unitPrice: deal.price, ecoSale: true }],
        status: 'PLACED',
        rxStatus: 'NOT_REQUIRED',
        deliveryOtp: otp,
        total: deal.price,
        placedAt: app.today,
      },
    });
    report(result, `${deal.medicine.brand} ordered. Delivery OTP ${otp}`);
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col bg-canvas sm:my-4 sm:min-h-[760px] sm:overflow-hidden sm:rounded-[2rem] sm:shadow-xl sm:ring-8 sm:ring-slate-900/90">
      <header className="bg-white px-5 pb-4 pt-6 shadow-sm">
        <p className="text-sm text-slate-500">Hello,</p>
        <h1 className="text-xl font-bold text-slate-900">{user.name}</h1>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-eco-dark">
              <Leaf className="size-3.5" /> Eco-Karma
            </div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-emerald-900">{app.karma[user.id] ?? 0}</div>
          </div>
          <div className="rounded-xl bg-sky-50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-medical-dark">
              <Wallet className="size-3.5" /> MedWallet
            </div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-sky-900">{inr(app.wallet[user.id] ?? 0)}</div>
          </div>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-4">
        <section>
          <SectionTitle>Eco-Sale deals</SectionTitle>
          {deals.length === 0 && (
            <Card className="text-center text-sm text-slate-500">
              No Eco-Sale stock right now. When a chemist puts a near-expiry batch on sale, it appears here instantly.
            </Card>
          )}
          <div className="space-y-3">
            {deals.map((d, i) => (
              <motion.div key={d.batch.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">{d.medicine.brand}</h3>
                      <p className="text-xs text-slate-500">{d.medicine.salt} · {d.medicine.packSize}</p>
                    </div>
                    <Badge tone="amber">{d.discountPct}% OFF</Badge>
                  </div>
                  <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                    Expires in {d.daysLeft} days • fits a {Math.min(d.fitsCourseDays, d.medicine.courseDays)}-day course
                  </p>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-xl font-bold text-slate-900">{inr(d.price)}</span>{' '}
                      <span className="text-sm text-slate-400 line-through">{inr(d.medicine.mrp)}</span>
                    </div>
                    {requiresRx(d.medicine) ? (
                      <Badge tone="red">Prescription required</Badge>
                    ) : (
                      <Button size="sm" onClick={() => void buy(d)}>
                        Buy for myself
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {cards.length > 0 && (
          <section>
            <SectionTitle>Scratch cards</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              {cards.map((c) => (
                <Card key={c.id} className="space-y-2 text-center">
                  {c.revealed ? (
                    <>
                      <Sparkles className="mx-auto size-6 text-expiry" />
                      <p className="text-sm font-semibold text-slate-900">
                        {c.rewardCredit > 0 ? `${inr(c.rewardCredit)} MedWallet` : `${c.rewardKarma} karma`}
                      </p>
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
          <div className="space-y-2">
            {orders.map((o) => (
              <Card key={o.id} className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-medical">
                  <Package className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {o.items.map((i) => app.medicines[i.medicineId]?.brand).join(', ')}
                  </p>
                  <p className="text-xs text-slate-500">{STATUS_LABEL[o.status]}</p>
                </div>
                {o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && <Badge tone="blue">OTP {o.deliveryOtp}</Badge>}
                {o.status === 'DELIVERED' && <Badge tone="green">Done</Badge>}
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
