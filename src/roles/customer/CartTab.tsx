import { Minus, Plus, ShoppingBag, Trash2, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nearestStoreId, planOrder, quoteCart } from '../../domain/checkout';
import { requiresRx } from '../../domain/rules/prescription';
import type { Medicine, User } from '../../domain/types';
import { Badge, Button, Card, inr } from '../../components/ui';
import { report, toast } from '../../components/toast';
import { newId } from '../../lib/id';
import { dispatch, useApp } from '../../store';
import { lineKey, useCart } from './cart';
import { RxForm, draftToPrescription, emptyDraft, type RxDraft } from './RxForm';

export function CartTab({ user, onPlaced }: { user: User; onPlaced: () => void }) {
  const { t } = useTranslation();
  const app = useApp();
  const { lines, setQty, remove, clear } = useCart();
  const storeId = nearestStoreId(app, user.id);
  const balance = app.wallet[user.id] ?? 0;
  const [useWallet, setUseWallet] = useState(true);
  const [busy, setBusy] = useState(false);

  const quote = storeId ? quoteCart(app, storeId, lines) : ({ ok: false, error: t('customer.cart.noPharmacy') } as const);

  // Rx-only medicines in the cart, with the total quantity ordered for each.
  const rxNeeds = useMemo(() => {
    if (!quote.ok) return [] as { medicine: Medicine; qty: number }[];
    const map = new Map<string, number>();
    for (const i of quote.value.items) {
      const m = app.medicines[i.medicineId];
      if (m && requiresRx(m)) map.set(m.id, (map.get(m.id) ?? 0) + i.qty);
    }
    return [...map].map(([id, qty]) => ({ medicine: app.medicines[id]!, qty }));
  }, [quote, app.medicines]);

  const [draft, setDraft] = useState<RxDraft>(() => emptyDraft(user.name, app.today, []));
  // A stable key, so the effect below runs only when the Rx drugs or their quantities really change.
  const rxKey = rxNeeds.map((n) => `${n.medicine.id}:${n.qty}`).join('|');
  useEffect(() => {
    // Keep one quantity per Rx drug, never below what is in the cart.
    setDraft((d) => {
      const qty: Record<string, number> = {};
      let changed = Object.keys(d.qty).length !== rxNeeds.length;
      for (const n of rxNeeds) {
        const next = Math.max(d.qty[n.medicine.id] ?? 0, n.qty);
        if (next !== d.qty[n.medicine.id]) changed = true;
        qty[n.medicine.id] = next;
      }
      // Returning the same object tells React nothing changed, so there is no re-render.
      return changed ? { ...d, qty } : d;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rxKey]);

  if (lines.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500">
        <ShoppingBag className="size-8 text-slate-300" />
        {t('customer.cart.empty')}
      </Card>
    );
  }

  const needsRx = quote.ok && quote.value.needsRx;
  const total = quote.ok ? quote.value.subtotal : 0;
  const walletUsed = useWallet ? Math.min(balance, total) : 0;

  const place = async () => {
    if (!storeId || !quote.ok) return;
    const rxId = needsRx ? newId('rx') : undefined;
    const otp = String(Math.floor(1000 + Math.random() * 9000));
    const plan = planOrder(app, {
      customerId: user.id,
      storeId,
      lines,
      walletToUse: walletUsed,
      orderId: newId('ord'),
      otp,
      ...(rxId ? { prescriptionId: rxId } : {}),
    });
    if (!plan.ok) return report(plan);
    setBusy(true);
    const prescription = rxId ? draftToPrescription(draft, rxId, user.id) : undefined;
    const result = await dispatch(user.id, { type: 'ORDER_PLACED', order: plan.value.order, ...(prescription ? { prescription } : {}) });
    setBusy(false);
    if (report(result)) {
      clear();
      toast(needsRx ? t('customer.cart.placedRx') : t('customer.cart.placedOtp', { otp }));
      onPlaced();
    }
  };

  // One column in the phone layout; items and prescription on the left, summary on the right on a laptop.
  return (
    <div className="space-y-4 @3xl:grid @3xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] @3xl:items-start @3xl:gap-6 @3xl:space-y-0">
      <div className="space-y-4">
      <div className="space-y-2">
        {lines.map((l) => {
          const m = app.medicines[l.medicineId]!;
          const batch = l.batchId ? app.batches[l.batchId] : undefined;
          const eco = batch?.status === 'ECO_SALE';
          return (
            <Card key={lineKey(l)} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{m.brand}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  {eco && <Badge tone="amber">{t('customer.cart.ecoOff', { pct: batch?.ecoDiscountPct })}</Badge>}
                  {requiresRx(m) && <Badge tone="red">{t('customer.cart.rx')}</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button aria-label={t('customer.cart.decrease')} className="grid size-8 place-items-center rounded-lg ring-1 ring-slate-200 hover:bg-slate-50" onClick={() => setQty(lineKey(l), l.qty - 1)}>
                  <Minus className="size-3.5" />
                </button>
                <span className="w-7 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                <button aria-label={t('customer.cart.increase')} className="grid size-8 place-items-center rounded-lg ring-1 ring-slate-200 hover:bg-slate-50" onClick={() => setQty(lineKey(l), l.qty + 1)}>
                  <Plus className="size-3.5" />
                </button>
              </div>
              <button aria-label={t('customer.cart.remove', { brand: m.brand })} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => remove(lineKey(l))}>
                <Trash2 className="size-4" />
              </button>
            </Card>
          );
        })}
      </div>

      {!quote.ok && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{quote.error}</p>}

      {needsRx && (
        <RxForm draft={draft} onChange={setDraft} drugs={rxNeeds.map((n) => n.medicine)} catalog={Object.values(app.medicines)} />
      )}
      </div>

      <div className="space-y-4 @3xl:sticky @3xl:top-20">
      {quote.ok && (
        <Card className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">{t('customer.cart.subtotal')}</span><span className="tabular-nums">{inr(total)}</span></div>
          {quote.value.ecoSavings > 0 && (
            <div className="flex justify-between text-eco-dark"><span>{t('customer.cart.ecoSavings')}</span><span className="tabular-nums">−{inr(quote.value.ecoSavings)}</span></div>
          )}
          {balance > 0 && (
            <label className="flex cursor-pointer items-center justify-between rounded-xl bg-sky-50 px-3 py-2">
              <span className="flex items-center gap-2 text-medical-dark"><Wallet className="size-4" /> {t('customer.cart.useWallet', { amount: inr(balance) })}</span>
              <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} className="size-4 accent-medical" />
            </label>
          )}
          {walletUsed > 0 && <div className="flex justify-between text-medical-dark"><span>{t('customer.cart.walletCredit')}</span><span className="tabular-nums">−{inr(walletUsed)}</span></div>}
          <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold"><span>{t('customer.cart.toPay')}</span><span className="tabular-nums">{inr(total - walletUsed)}</span></div>
          <p className="text-xs text-slate-500">{t('customer.cart.payNote')}</p>
        </Card>
      )}

      <Button block size="lg" disabled={!quote.ok || busy} onClick={() => void place()}>
        {needsRx ? t('customer.cart.placeRx') : t('customer.cart.place')}
      </Button>
      </div>
    </div>
  );
}
