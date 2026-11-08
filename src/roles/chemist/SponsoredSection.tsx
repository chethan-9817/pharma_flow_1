import { HeartHandshake } from 'lucide-react';
import { storeSponsorships } from '../../domain/selectors';
import type { SponsorshipStatus, User } from '../../domain/types';
import { Badge, Card, SectionTitle, Stat, inr } from '../../components/ui';
import { useApp } from '../../store';

const STATUS: Record<SponsorshipStatus, { label: string; tone: 'blue' | 'green' | 'orange' }> = {
  PLACED: { label: 'Packs on the way to the NGO', tone: 'blue' },
  DELIVERED: { label: 'Paid', tone: 'green' },
  REFUNDED: { label: 'Failed the check, not paid', tone: 'orange' },
};

/**
 * Customers can sponsor packs from a store's Eco-Sale batches for an NGO. The store hands the packs to a rider,
 * checks them at its QA desk, and is paid the Eco-Sale price once the NGO has them.
 */
export function SponsoredSection({ user }: { user: User }) {
  const app = useApp();
  const totals = storeSponsorships(app, user.storeId!);

  return (
    <section className="@container space-y-3">
      <SectionTitle>Sponsored for NGOs</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Packs for NGOs" value={totals.packsDelivered} hint="Delivered" tone="green" />
        <Stat label="Paid" value={inr(totals.paidOut)} hint="At the Eco-Sale price" tone="blue" />
        <Stat label="On the way" value={inr(totals.pending)} hint="Paid on delivery" tone="amber" />
      </div>
      <div className="grid gap-3 @3xl:grid-cols-2">
        {totals.items.length === 0 && (
          <Card className="text-sm text-slate-500 @3xl:col-span-2">
            When a customer sponsors a batch of yours for an NGO, it appears here. You hand the packs to the rider, check them at the QA desk,
            and are paid the Eco-Sale price once the NGO has them.
          </Card>
        )}
        {totals.items.map(({ sponsorship: sp, medicine, ngoName }) => {
          const status = STATUS[sp.status];
          return (
            <Card key={sp.id} className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-eco-dark">
                <HeartHandshake className="size-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-semibold text-slate-900">
                  {medicine.brand} ×{sp.qty} for {ngoName}
                </p>
                <p className="text-xs text-slate-500">
                  Sponsored by {app.users[sp.customerId]?.name ?? 'a customer'} · {inr(sp.unitPrice)} a pack
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {sp.status !== 'REFUNDED' && <span className="text-xs font-semibold text-slate-700">{inr(sp.storePayout)}</span>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
