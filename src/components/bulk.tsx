import { ArrowRight, Bot, CheckCircle2, CircleSlash, Clock, MessagesSquare, Play, Store as StoreIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BulkNegotiation, TenderStatus, TenderView } from '../domain/bulk';
import { usualTradePrice } from '../domain/rules/bulk';
import { ProductArt } from './ProductArt';
import { Badge, Button, Card, inr } from './ui';

const STATUS_TONE = {
  COLLECTING: 'slate',
  OPEN: 'blue',
  NEGOTIATED: 'amber',
  AWARDED: 'green',
  DELIVERED: 'green',
  CANCELLED: 'red',
} as const satisfies Record<TenderStatus, string>;

export function TenderStatusBadge({ status }: { status: TenderStatus }) {
  const { t } = useTranslation();
  return <Badge tone={STATUS_TONE[status]}>{t(`bulk.status.${status}`)}</Badge>;
}

/**
 * One pooled bulk order: the item, how much the stores want between them, and who is in the pool.
 * Each role adds its own actions as children.
 */
export function TenderCard({ view, children }: { view: TenderView; children?: ReactNode }) {
  const { t } = useTranslation();
  const { tender, medicine } = view;
  return (
    <Card className="animate-fade-up space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
          <ProductArt medicine={medicine} className="size-12" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{medicine.brand}</h3>
            <TenderStatusBadge status={tender.status} />
          </div>
          <p className="text-xs text-slate-500">
            {medicine.packSize} · {t('bulk.mrp', { price: inr(medicine.mrp) })} · {t('bulk.usual', { price: inr(usualTradePrice(medicine.mrp)) })}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">{t('bulk.poolLine', { qty: view.qty, count: view.stores.length })}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {view.stores.map(({ store, qty }) => (
          <span key={store.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
            <StoreIcon className="size-3 text-slate-400" />
            {store.name}
            <b className="tabular-nums text-slate-900">×{qty}</b>
          </span>
        ))}
      </div>
      {view.finalCost !== undefined && tender.finalPrice !== undefined && (
        <div className="rounded-xl bg-eco-tint/60 px-3 py-2.5 text-sm ring-1 ring-inset ring-emerald-200">
          <p className="font-semibold text-eco-dark">
            {view.awardedDealer?.name} · {t('bulk.perPack', { price: inr(tender.finalPrice) })} · {t('bulk.total', { amount: inr(view.finalCost) })}
          </p>
          {(view.savings ?? 0) > 0 && <p className="text-xs text-emerald-800">{t('bulk.savings', { amount: inr(view.savings ?? 0) })}</p>}
        </div>
      )}
      {children}
    </Card>
  );
}

type ChatTurn = { speaker: 'buyer' | 'dealer'; text: string; round: number; opensRound: boolean };

/** Conversation drawn from the recorded bids and counteroffers. */
export function Rounds({ result }: { result: BulkNegotiation }) {
  const { t } = useTranslation();
  const [replayStep, setReplayStep] = useState<number | null>(null);
  const turns = result.rounds.flatMap((round, index): ChatTurn[] => {
    const previous = result.rounds[index - 1];
    const bid = { price: inr(round.buyerOffer) };
    const ask = { price: inr(round.dealerOffer) };
    const buyerText = !previous
      ? t('bulk.chat.open', bid)
      : round.buyerOffer === previous.buyerOffer
        ? t('bulk.chat.hold', bid)
        : t('bulk.chat.raise', bid);
    return [
      { speaker: 'buyer', round: round.round, opensRound: true, text: buyerText },
      {
        speaker: 'dealer', round: round.round, opensRound: false,
        text: round.dealerOffer <= round.buyerOffer ? t('bulk.chat.accept', ask) : t('bulk.chat.counter', ask),
      },
    ];
  });

  useEffect(() => {
    if (replayStep === null) return;
    const timer = window.setTimeout(() => setReplayStep(replayStep + 1 < turns.length ? replayStep + 1 : null), 650);
    return () => window.clearTimeout(timer);
  }, [replayStep, turns.length]);

  return (
    <div className="space-y-2">
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${result.agreed ? 'text-eco-dark' : 'text-slate-600'}`}>
        {result.agreed ? <CheckCircle2 aria-hidden className="size-4 shrink-0" /> : <CircleSlash aria-hidden className="size-4 shrink-0" />}
        {result.agreed ? t('bulk.agreedAt', { price: inr(result.finalPrice) }) : t('bulk.noDeal', { price: inr(result.finalPrice) })}
      </p>
      <details className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-inset ring-slate-200">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">
          <MessagesSquare aria-hidden className="mr-1.5 inline-block size-4 text-medical" />
          {t('bulk.chat.title')}
        </summary>
        <div className="mt-3 flex justify-end motion-reduce:hidden">
          <Button type="button" variant="ghost" size="sm" onClick={() => {
            setReplayStep(replayStep === null ? 0 : null);
          }}>
            <Play aria-hidden className="size-3.5" />
            {replayStep === null ? t('bulk.chat.replay') : t('bulk.chat.showAll')}
          </Button>
        </div>
        <ol className="space-y-2 pt-3" aria-live={replayStep === null ? 'off' : 'polite'}>
          {turns.slice(0, replayStep === null ? undefined : replayStep + 1).map((turn) => (
            <li key={`${turn.round}-${turn.speaker}`} className="space-y-2">
              {turn.opensRound && <p className="pt-1 text-center text-xs font-medium text-slate-500">{t('bulk.round', { n: turn.round })}</p>}
              <div className={`rounded-xl px-3 py-2 text-sm text-slate-900 ${turn.speaker === 'buyer' ? 'mr-5 bg-medical-tint/70' : 'ml-5 bg-slate-100'}`}>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Bot aria-hidden className="size-3.5 shrink-0" />
                  {turn.speaker === 'buyer' ? t('bulk.buyerAgent') : t('bulk.dealerAgent')}
                </p>
                <p>{turn.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

/**
 * Where the money goes once an order is delivered: PharmaFlow pays the dealer for the whole order,
 * then each store pays PharmaFlow its own share.
 */
export function PaymentTrail({ view, action }: { view: TenderView; action?: ReactNode }) {
  const { t } = useTranslation();
  const Paid = ({ paid }: { paid: boolean }) =>
    paid ? (
      <Badge tone="green"><CheckCircle2 className="size-3" /> {t('bulk.pay.paid')}</Badge>
    ) : (
      <Badge tone="amber"><Clock className="size-3" /> {t('bulk.pay.due')}</Badge>
    );
  return (
    <div className="space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          PharmaFlow <ArrowRight className="size-3.5 text-slate-400" /> {view.awardedDealer?.name}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-slate-900">{inr(view.finalCost ?? 0)}</span>
          <Paid paid={view.dealerPaid} />
        </div>
      </div>
      {action}
      <ul className="space-y-1.5 border-t border-slate-200 pt-3">
        {view.stores.map((s) => (
          <li key={s.store.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-slate-700">
              {s.store.name} <ArrowRight className="size-3 text-slate-400" /> PharmaFlow
            </span>
            <span className="flex items-center gap-2">
              <span className="font-medium tabular-nums text-slate-900">{inr(s.amount ?? 0)}</span>
              <Paid paid={s.paid} />
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">{t('bulk.pay.received', { collected: inr(view.collected), outstanding: inr(view.outstanding) })}</p>
    </div>
  );
}

/** A labelled input used by the bulk forms. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      {children}
    </label>
  );
}

export const INPUT =
  'h-10 w-full rounded-xl bg-white px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 outline-none transition-shadow focus:ring-2 focus:ring-medical';
