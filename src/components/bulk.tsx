import { CheckCircle2, CircleSlash, Store as StoreIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BulkNegotiation, TenderStatus, TenderView } from '../domain/bulk';
import { usualTradePrice } from '../domain/rules/bulk';
import { ProductArt } from './ProductArt';
import { Badge, Card, inr } from './ui';

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

/** The round-by-round record of one dealer's negotiation, so anyone can see how the price was reached. */
export function Rounds({ result }: { result: BulkNegotiation }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <table className="w-full text-left text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="py-1 font-medium" />
            <th className="py-1 text-right font-medium">{t('bulk.buyerAgent')}</th>
            <th className="py-1 text-right font-medium">{t('bulk.dealerAgent')}</th>
          </tr>
        </thead>
        <tbody>
          {result.rounds.map((r) => (
            <tr key={r.round} className="border-t border-slate-100">
              <td className="py-1.5 text-slate-600">{t('bulk.round', { n: r.round })}</td>
              <td className="py-1.5 text-right tabular-nums text-medical-dark">{inr(r.buyerOffer)}</td>
              <td className="py-1.5 text-right tabular-nums text-slate-900">{inr(r.dealerOffer)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`flex items-center gap-1.5 text-xs font-medium ${result.agreed ? 'text-eco-dark' : 'text-blood'}`}>
        {result.agreed ? <CheckCircle2 className="size-3.5" /> : <CircleSlash className="size-3.5" />}
        {result.agreed ? t('bulk.agreedAt', { price: inr(result.finalPrice) }) : t('bulk.noDeal', { price: inr(result.finalPrice) })}
      </p>
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
