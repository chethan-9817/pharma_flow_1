import { Bot, Boxes, CircleSlash, Megaphone, PiggyBank, Star, Trophy, Truck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { allTenders, bulkSummary, type TenderView } from '../../domain/bulk';
import { MIN_POOL_STORES, defaultTargetPrice, usualTradePrice } from '../../domain/rules/bulk';
import type { User } from '../../domain/types';
import { Field, INPUT, Rounds, TenderCard } from '../../components/bulk';
import { Badge, Button, Card, SectionTitle, Stat, inr } from '../../components/ui';
import { report } from '../../components/toast';
import { dispatch, useApp } from '../../store';

/**
 * The admin's side of pooled bulk buying: set the buyer agent's limits, ask dealers to quote,
 * run the negotiation and award the order.
 */
export function BulkPanel({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const views = allTenders(app);
  const summary = bulkSummary(app);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label={t('bulk.admin.stats.open')} value={summary.open} tone="blue" icon={Boxes} />
        <Stat label={t('bulk.admin.stats.delivered')} value={summary.delivered} hint={t('bulk.packs', { n: summary.packsDelivered })} tone="green" icon={Truck} />
        <Stat label={t('bulk.admin.stats.savings')} value={inr(summary.savings)} tone="amber" icon={PiggyBank} />
      </div>

      <section>
        <SectionTitle>{t('bulk.admin.title')}</SectionTitle>
        <p className="mb-3 text-sm text-slate-600">{t('bulk.admin.intro')}</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {views.length === 0 && <Card className="text-sm text-slate-500 lg:col-span-2">{t('bulk.admin.none')}</Card>}
          {views.map((view) => (
            <TenderCard key={view.tender.id} view={view}>
              <AdminActions view={view} user={user} />
            </TenderCard>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminActions({ view, user }: { view: TenderView; user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const { tender, medicine } = view;
  const [target, setTarget] = useState(defaultTargetPrice(medicine.mrp));
  const [ceiling, setCeiling] = useState(usualTradePrice(medicine.mrp));
  const dealerName = (id: string) => app.dealers[id]?.name ?? id;

  const cancel = (
    <Button size="sm" variant="ghost" onClick={async () => report(await dispatch(user.id, { type: 'BULK_CANCELLED', tenderId: tender.id }), t('bulk.admin.cancelled'))}>
      <CircleSlash className="size-4" /> {t('bulk.admin.cancel')}
    </Button>
  );
  const limits = tender.targetPrice !== undefined && tender.ceilingPrice !== undefined && (
    <p className="text-xs text-slate-500">{t('bulk.admin.limits', { target: inr(tender.targetPrice), ceiling: inr(tender.ceilingPrice) })}</p>
  );

  if (tender.status === 'COLLECTING') {
    const enough = tender.demands.length >= MIN_POOL_STORES;
    return (
      <div className="space-y-3 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('bulk.admin.target')}>
            <input type="number" step="0.5" min={0} value={target} onChange={(e) => setTarget(Number(e.target.value))} className={`${INPUT} tabular-nums`} />
          </Field>
          <Field label={t('bulk.admin.ceiling')}>
            <input type="number" step="0.5" min={0} value={ceiling} onChange={(e) => setCeiling(Number(e.target.value))} className={`${INPUT} tabular-nums`} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">{enough ? t('bulk.admin.limitsHint') : t('bulk.admin.needStores', { n: MIN_POOL_STORES })}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!enough}
            onClick={async () =>
              report(await dispatch(user.id, { type: 'BULK_TENDER_OPENED', tenderId: tender.id, targetPrice: target, ceilingPrice: ceiling }), t('bulk.admin.opened'))
            }
          >
            <Megaphone className="size-4" /> {t('bulk.admin.open')}
          </Button>
          {cancel}
        </div>
      </div>
    );
  }

  if (tender.status === 'OPEN') {
    return (
      <div className="space-y-3 border-t border-slate-100 pt-3">
        {limits}
        <p className="text-sm font-medium text-slate-800">{t('bulk.admin.quotes', { n: tender.quotes.length })}</p>
        {tender.quotes.length === 0 && <p className="text-xs text-slate-500">{t('bulk.admin.noQuotes')}</p>}
        <ul className="space-y-1.5">
          {tender.quotes.map((q) => (
            <li key={q.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <b className="text-slate-900">{dealerName(q.dealerId)}</b>{' '}
              {t('bulk.admin.quoteRow', { ask: inr(q.askPrice), days: q.deliveryDays, rating: app.dealers[q.dealerId]?.rating.toFixed(1) })}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={tender.quotes.length === 0}
            onClick={async () => report(await dispatch(user.id, { type: 'BULK_NEGOTIATED', tenderId: tender.id }), t('bulk.admin.negotiated'))}
          >
            <Bot className="size-4" /> {t('bulk.admin.negotiate')}
          </Button>
          {cancel}
        </div>
      </div>
    );
  }

  if (tender.status === 'NEGOTIATED') {
    const results = [...(tender.negotiation ?? [])].sort((a, b) => Number(b.agreed) - Number(a.agreed) || a.effectivePrice - b.effectivePrice);
    return (
      <div className="space-y-3 border-t border-slate-100 pt-3">
        {limits}
        {results.map((n) => {
          const q = tender.quotes.find((x) => x.id === n.quoteId)!;
          const best = tender.recommendedQuoteId === n.quoteId;
          return (
            <div key={n.quoteId} className={`space-y-2 rounded-xl p-3 ring-1 ring-inset ${best ? 'bg-eco-tint/50 ring-emerald-300' : 'bg-slate-50 ring-slate-200'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                    {dealerName(n.dealerId)}
                    {best && (
                      <Badge tone="green">
                        <Trophy className="size-3" /> {t('bulk.admin.recommended')}
                      </Badge>
                    )}
                  </p>
                  <p className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                    {t('bulk.admin.quoteRow', { ask: inr(q.askPrice), days: q.deliveryDays, rating: app.dealers[n.dealerId]?.rating.toFixed(1) })}
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                  </p>
                </div>
                {n.agreed && (
                  <Button
                    size="sm"
                    variant={best ? 'eco' : 'ghost'}
                    onClick={async () =>
                      report(await dispatch(user.id, { type: 'BULK_AWARDED', tenderId: tender.id, quoteId: n.quoteId }), t('bulk.admin.awarded', { dealer: dealerName(n.dealerId) }))
                    }
                  >
                    <Trophy className="size-4" /> {t('bulk.admin.award')}
                  </Button>
                )}
              </div>
              <Rounds result={n} />
              {n.agreed && <p className="text-xs text-slate-600">{t('bulk.admin.effective', { price: inr(n.effectivePrice) })}</p>}
            </div>
          );
        })}
        <p className="text-xs text-slate-500">{tender.recommendedQuoteId ? t('bulk.admin.effectiveHint') : t('bulk.admin.nobody')}</p>
        {cancel}
      </div>
    );
  }

  if (tender.status === 'AWARDED') {
    return <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">{t('bulk.admin.awaitingDelivery', { dealer: view.awardedDealer?.name })}</p>;
  }
  if (tender.status === 'DELIVERED' && tender.deliveredAt) {
    return <p className="border-t border-slate-100 pt-3 text-xs font-medium text-eco-dark">{t('bulk.deliveredOn', { date: tender.deliveredAt })}</p>;
  }
  return null;
}
