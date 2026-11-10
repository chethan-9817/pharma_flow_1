import { motion } from 'framer-motion';
import { HeartHandshake, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SPONSOR_AMOUNT } from '../../domain/rules/sponsor';
import { requiresRx } from '../../domain/rules/prescription';
import { ecoListings } from '../../domain/selectors';
import type { User } from '../../domain/types';
import { Badge, Button, Card, inr } from '../../components/ui';
import { toast } from '../../components/toast';
import { useApp } from '../../store';
import { useCart } from './cart';
import { SponsorPanel } from './SponsorPanel';

export function DealsTab({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const add = useCart((s) => s.add);
  const deals = ecoListings(app);
  const [sponsoring, setSponsoring] = useState<string | null>(null);

  if (deals.length === 0) {
    return <Card className="text-center text-sm text-slate-500">{t('customer.deals.empty')}</Card>;
  }

  return (
    <div className="grid items-start gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
      <p className="text-xs text-slate-500 @2xl:col-span-2 @5xl:col-span-3">{t('customer.deals.intro', { amount: inr(SPONSOR_AMOUNT) })}</p>
      {deals.map((d, i) => (
        <motion.div key={d.batch.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900">{d.medicine.brand}</h3>
                <p className="text-xs text-slate-500">{d.medicine.salt} · {d.medicine.packSize}</p>
              </div>
              <Badge tone="amber">{t('customer.deals.off', { pct: d.discountPct })}</Badge>
            </div>
            <p className="rounded-lg bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200/60">
              {t('customer.deals.expires', { days: d.daysLeft, course: Math.min(d.fitsCourseDays, d.medicine.courseDays), qty: d.batch.qty })}
            </p>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-xl font-semibold tabular-nums text-slate-900">{inr(d.price)}</span>{' '}
                <span className="text-sm text-slate-400 line-through">{inr(d.medicine.mrp)}</span>
                {requiresRx(d.medicine) && <div className="mt-1"><Badge tone="red">{t('customer.deals.rxRequired')}</Badge></div>}
              </div>
              <Button
                size="sm"
                variant="soft"
                onClick={() => {
                  add({ medicineId: d.medicine.id, qty: 1, batchId: d.batch.id });
                  toast(t('customer.shop.added', { brand: d.medicine.brand }));
                }}
              >
                <Plus className="size-4" /> {t('customer.deals.buy')}
              </Button>
            </div>
            {sponsoring === d.batch.id ? (
              <SponsorPanel user={user} batchId={d.batch.id} onDone={() => setSponsoring(null)} />
            ) : (
              <Button size="sm" variant="ecoSoft" block onClick={() => setSponsoring(d.batch.id)}>
                <HeartHandshake className="size-4" /> {t('customer.deals.sponsorButton', { amount: inr(SPONSOR_AMOUNT) })}
              </Button>
            )}
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
