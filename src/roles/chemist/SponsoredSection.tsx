import { HeartHandshake } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { storeSponsorships } from '../../domain/selectors';
import type { SponsorshipStatus, User } from '../../domain/types';
import { Badge, Card, SectionTitle, Stat, inr } from '../../components/ui';
import { useApp } from '../../store';

const TONE: Record<SponsorshipStatus, 'blue' | 'green' | 'orange'> = { PLACED: 'blue', DELIVERED: 'green', REFUNDED: 'orange' };

/**
 * Customers can sponsor packs from a store's Eco-Sale batches for an NGO. The store hands the packs to a rider,
 * checks them at its QA desk, and is paid the Eco-Sale price once the NGO has them.
 */
export function SponsoredSection({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const totals = storeSponsorships(app, user.storeId!);

  return (
    <section className="@container space-y-3">
      <SectionTitle>{t('chemist.sponsored.title')}</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t('chemist.sponsored.packs')} value={totals.packsDelivered} hint={t('chemist.sponsored.delivered')} tone="green" />
        <Stat label={t('chemist.sponsored.paid')} value={inr(totals.paidOut)} hint={t('chemist.sponsored.atEco')} tone="blue" />
        <Stat label={t('chemist.sponsored.onTheWay')} value={inr(totals.pending)} hint={t('chemist.sponsored.paidOnDelivery')} tone="amber" />
      </div>
      <div className="grid gap-3 @3xl:grid-cols-2">
        {totals.items.length === 0 && <Card className="text-sm text-slate-500 @3xl:col-span-2">{t('chemist.sponsored.empty')}</Card>}
        {totals.items.map(({ sponsorship: sp, medicine, ngoName }) => (
          <Card key={sp.id} className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-eco-dark">
              <HeartHandshake className="size-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate font-semibold text-slate-900">{t('chemist.sponsored.line', { brand: medicine.brand, qty: sp.qty, ngo: ngoName })}</p>
              <p className="text-xs text-slate-500">
                {t('chemist.sponsored.by', { name: app.users[sp.customerId]?.name ?? t('chemist.sponsored.aCustomer'), price: inr(sp.unitPrice) })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={TONE[sp.status]}>{t(`chemist.sponsored.status.${sp.status}`)}</Badge>
                {sp.status !== 'REFUNDED' && <span className="text-xs font-semibold text-slate-700">{inr(sp.storePayout)}</span>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
