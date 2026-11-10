import { BadgeCheck, FileText, Gavel, Send, Star, Truck, Warehouse } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dealerTenders, type TenderView } from '../../domain/bulk';
import { addDays } from '../../domain/clock';
import { usualTradePrice } from '../../domain/rules/bulk';
import type { User } from '../../domain/types';
import { Field, INPUT, Rounds, TenderCard } from '../../components/bulk';
import { Badge, Button, Card, PageHero, SectionTitle, Stat, inr } from '../../components/ui';
import { report } from '../../components/toast';
import { newId } from '../../lib/id';
import { dispatch, useApp } from '../../store';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The dealer's dashboard: quote on pooled bulk orders, follow the negotiation and deliver what you win. */
export function DealerPage({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const dealer = app.dealers[user.dealerId!]!;
  const views = dealerTenders(app, dealer.id);
  const quoted = views.filter((v) => v.tender.quotes.some((q) => q.dealerId === dealer.id));
  const won = views.filter((v) => v.awardedDealer?.id === dealer.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHero
        icon={Warehouse}
        title={dealer.name}
        subtitle={t('dealer.subtitle', { area: dealer.area, licence: dealer.wholesaleLicence })}
        aside={
          <Badge tone="amber">
            <Star className="size-3 fill-current" /> {t('dealer.rating', { rating: dealer.rating.toFixed(1) })}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('dealer.stats.open')} value={views.filter((v) => v.tender.status === 'OPEN').length} tone="blue" icon={FileText} />
        <Stat label={t('dealer.stats.quoted')} value={quoted.length} tone="amber" icon={Send} />
        <Stat label={t('dealer.stats.won')} value={won.length} tone="green" icon={BadgeCheck} />
        <Stat label={t('dealer.stats.value')} value={inr(round2(won.reduce((n, v) => n + (v.finalCost ?? 0), 0)))} tone="slate" icon={Gavel} />
      </div>

      <section>
        <SectionTitle>{t('dealer.tenders')}</SectionTitle>
        <div className="grid gap-3 lg:grid-cols-2">
          {views.length === 0 && <Card className="text-sm text-slate-500 lg:col-span-2">{t('dealer.none')}</Card>}
          {views.map((view) => (
            <TenderCard key={view.tender.id} view={view}>
              <DealerActions view={view} user={user} dealerId={dealer.id} />
            </TenderCard>
          ))}
        </div>
      </section>
    </div>
  );
}

function DealerActions({ view, user, dealerId }: { view: TenderView; user: User; dealerId: string }) {
  const { t } = useTranslation();
  const app = useApp();
  const { tender, medicine } = view;
  const mine = tender.quotes.find((q) => q.dealerId === dealerId);
  const result = tender.negotiation?.find((n) => n.dealerId === dealerId);
  const iWon = view.awardedDealer?.id === dealerId;
  const trade = usualTradePrice(medicine.mrp);

  const [ask, setAsk] = useState(mine?.askPrice ?? round2(trade * 0.98));
  const [floor, setFloor] = useState(mine?.floorPrice ?? round2(trade * 0.86));
  const [days, setDays] = useState(mine?.deliveryDays ?? 3);
  const [batchNo, setBatchNo] = useState('');
  const [expiry, setExpiry] = useState(addDays(app.today, 720));

  const sendQuote = async () =>
    report(
      await dispatch(user.id, {
        type: 'BULK_QUOTE_SUBMITTED',
        tenderId: tender.id,
        quote: { id: mine?.id ?? newId('bq'), dealerId, askPrice: ask, floorPrice: floor, deliveryDays: days },
      }),
      t('dealer.sent'),
    );

  const deliver = async () =>
    report(await dispatch(user.id, { type: 'BULK_DELIVERED', tenderId: tender.id, batchNo, expiry }), t('dealer.deliveredToast', { stores: view.stores.length }));

  const summary = mine && (
    <p className="text-xs text-slate-600">{t('dealer.yourQuote', { ask: inr(mine.askPrice), floor: inr(mine.floorPrice), days: mine.deliveryDays })}</p>
  );

  if (tender.status === 'OPEN') {
    return (
      <div className="space-y-3 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('dealer.ask')}>
            <input type="number" step="0.5" min={0} value={ask} onChange={(e) => setAsk(Number(e.target.value))} className={`${INPUT} tabular-nums`} />
          </Field>
          <Field label={t('dealer.floor')}>
            <input type="number" step="0.5" min={0} value={floor} onChange={(e) => setFloor(Number(e.target.value))} className={`${INPUT} tabular-nums`} />
          </Field>
          <Field label={t('dealer.days')}>
            <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${INPUT} tabular-nums`} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">{t('dealer.floorHint')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => void sendQuote()}>
            <Send className="size-4" /> {mine ? t('dealer.update') : t('dealer.submit')}
          </Button>
          {mine && <span className="text-xs text-slate-500">{t('dealer.waitingNegotiation')}</span>}
        </div>
        {summary}
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-slate-100 pt-3">
      {summary}
      {result && <Rounds result={result} />}
      {tender.status === 'NEGOTIATED' && <p className="text-xs text-slate-500">{t('dealer.pending')}</p>}
      {tender.status === 'AWARDED' && !iWon && <p className="text-xs text-slate-500">{t('dealer.lost')}</p>}
      {tender.status === 'AWARDED' && iWon && (
        <>
          <p className="text-sm font-semibold text-eco-dark">{t('dealer.won', { price: inr(tender.finalPrice ?? 0) })}</p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('dealer.batchNo')}>
              <input value={batchNo} onChange={(e) => setBatchNo(e.target.value.toUpperCase())} placeholder="DV30A01" className={`${INPUT} font-mono`} />
            </Field>
            <Field label={t('dealer.expiry')}>
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={INPUT} />
            </Field>
            <Button size="sm" variant="eco" onClick={() => void deliver()}>
              <Truck className="size-4" /> {t('dealer.deliver')}
            </Button>
          </div>
        </>
      )}
      {tender.status === 'DELIVERED' && <p className="text-xs font-medium text-eco-dark">{iWon ? t('dealer.deliveredDone') : t('dealer.lost')}</p>}
      {tender.status === 'DELIVERED' && iWon && (
        <p className={`rounded-xl px-3 py-2 text-sm font-semibold ${view.dealerPaid ? 'bg-eco-tint/60 text-eco-dark' : 'bg-expiry-tint text-expiry-ink'}`}>
          {view.dealerPaid ? t('dealer.paid', { amount: inr(view.finalCost ?? 0) }) : t('dealer.awaitingPayment', { amount: inr(view.finalCost ?? 0) })}
        </p>
      )}
    </div>
  );
}
