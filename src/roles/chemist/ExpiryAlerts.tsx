import { BellRing, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { expiryAlerts } from '../../domain/selectors';
import type { User } from '../../domain/types';
import { Badge, BucketBadge, Button, inr } from '../../components/ui';
import { report } from '../../components/toast';
import { dispatch, useApp } from '../../store';

/**
 * The 6-month notice. Every full-price batch that will expire within 6 months shows up here with the
 * Eco-Sale offer that would clear it and who gets what: on a ₹200 strip at 15% off the customer pays
 * ₹170, PharmaFlow keeps ₹20 and the store gets ₹150.
 */
export function ExpiryAlerts({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const alerts = expiryAlerts(app, user.storeId!);
  const actionable = alerts.filter((a) => !a.blocked).length;

  const list = async (batchId: string, discountPct: number, brand: string) =>
    report(await dispatch(user.id, { type: 'ECO_SALE_LISTED', batchId, discountPct }), t('chemist.ecoLive', { brand }));

  return (
    <section aria-labelledby="expiry-alerts-title" className="rounded-2xl bg-amber-50 p-5 shadow-card ring-1 ring-amber-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow-card">
            <BellRing className="size-5" />
          </span>
          <div>
            <h2 id="expiry-alerts-title" className="text-[15px] font-semibold text-slate-900">{t('chemist.alerts.title')}</h2>
            <p className="text-sm text-slate-700">{alerts.length > 0 ? t('chemist.alerts.intro') : t('chemist.alerts.none')}</p>
          </div>
        </div>
        {actionable > 0 && <Badge tone="amber">{t('chemist.alerts.count', { count: actionable })}</Badge>}
      </div>

      {alerts.length > 0 && (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {alerts.map((a) => (
            <li key={a.batch.id} className="flex flex-col gap-2 rounded-xl bg-white p-3.5 ring-1 ring-amber-200/80">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{a.medicine.brand}</p>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono">{a.batch.batchNo}</span> · {t('chemist.col.qty')} {a.batch.qty} · {t('chemist.daysLeft', { count: a.daysLeft })}
                  </p>
                </div>
                <BucketBadge bucket={a.bucket} />
              </div>
              {a.blocked ? (
                <p className="text-xs text-rose-700">{t('chemist.alerts.blocked')}</p>
              ) : (
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {t('chemist.alerts.offer', { mrp: inr(a.medicine.mrp), price: inr(a.split.price), pct: a.discountPct })}
                    </p>
                    <p className="text-xs text-slate-600">{t('chemist.alerts.split', { fee: inr(a.split.commission), store: inr(a.split.storeGets) })}</p>
                  </div>
                  <Button size="sm" variant="amber" onClick={() => void list(a.batch.id, a.discountPct, a.medicine.brand)}>
                    <Tag className="size-3.5" /> {t('chemist.alerts.action')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
