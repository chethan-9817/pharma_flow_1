import { Banknote, Boxes, CheckCircle2, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collectingTender, storeShare, storeTenders, tenderQty } from '../../domain/bulk';
import type { User } from '../../domain/types';
import { Field, INPUT, TenderCard } from '../../components/bulk';
import { Badge, Button, Card, SectionTitle, inr } from '../../components/ui';
import { report } from '../../components/toast';
import { newId } from '../../lib/id';
import { dispatch, useApp } from '../../store';

/**
 * Bulk orders. A store asks for a large quantity; PharmaFlow pools it with the same request from
 * other stores, so dealers quote on the total and every store pays the same lower price.
 */
export function BulkSection({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const storeId = user.storeId!;
  const items = Object.values(app.medicines).sort((a, b) => a.brand.localeCompare(b.brand));
  const [medicineId, setMedicineId] = useState('prd-dispovan');
  const [qty, setQty] = useState(150);
  const pool = collectingTender(app, medicineId);
  const inPool = pool?.demands.some((d) => d.storeId === storeId) ?? false;
  const mine = storeTenders(app, storeId);

  const request = async () =>
    report(
      await dispatch(user.id, { type: 'BULK_DEMAND_POSTED', tenderId: pool?.id ?? newId('bt'), storeId, medicineId, qty }),
      t('bulk.chemist.requested'),
    );

  return (
    <section id="bulk-orders">
      <SectionTitle>{t('bulk.chemist.title')}</SectionTitle>
      <Card className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-medical-tint text-medical">
            <Boxes className="size-5" />
          </span>
          <p className="text-sm text-slate-600">{t('bulk.chemist.intro')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('bulk.chemist.item')}>
            <select value={medicineId} onChange={(e) => setMedicineId(e.target.value)} className={`${INPUT} min-w-52`}>
              {items.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.brand} · {m.packSize}
                </option>
              ))}
            </select>
          </Field>
          <div className="w-32">
            <Field label={t('bulk.chemist.qty')}>
              <input type="number" min={10} step={10} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={`${INPUT} tabular-nums`} />
            </Field>
          </div>
          <Button onClick={() => void request()}>
            {pool ? <Users className="size-4" /> : <Boxes className="size-4" />}
            {inPool ? t('bulk.chemist.update') : pool ? t('bulk.chemist.join') : t('bulk.chemist.request')}
          </Button>
        </div>
        {pool && (
          <p className="rounded-xl bg-medical-tint/70 px-3 py-2 text-xs font-medium text-medical-dark">
            {inPool ? t('bulk.chemist.inPool') : t('bulk.chemist.poolOpen', { count: pool.demands.length, qty: tenderQty(pool) })}
          </p>
        )}
      </Card>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {mine.length === 0 && <Card className="text-sm text-slate-500 lg:col-span-2">{t('bulk.chemist.none')}</Card>}
        {mine.map((view) => {
          const share = view.tender.demands.find((d) => d.storeId === storeId)?.qty ?? 0;
          return (
            <TenderCard key={view.tender.id} view={view}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
                <span className="font-medium text-slate-800">{t('bulk.chemist.yourShare', { qty: share })}</span>
                {view.tender.finalPrice !== undefined && (
                  <span className="font-semibold tabular-nums text-slate-900">{t('bulk.chemist.youPay', { amount: inr(share * view.tender.finalPrice) })}</span>
                )}
              </div>
              <p className="text-xs text-slate-500">{t(`bulk.chemist.next.${view.tender.status}`)}</p>
              {view.tender.status === 'DELIVERED' &&
                (view.stores.find((x) => x.store.id === storeId)?.paid ? (
                  <Badge tone="green"><CheckCircle2 className="size-3" /> {t('bulk.pay.storePaid')}</Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={async () =>
                      report(await dispatch(user.id, { type: 'BULK_STORE_PAID', tenderId: view.tender.id, storeId }), t('bulk.pay.storePaidToast'))
                    }
                  >
                    <Banknote className="size-4" /> {t('bulk.pay.payShare', { amount: inr(storeShare(view.tender, storeId)) })}
                  </Button>
                ))}
            </TenderCard>
          );
        })}
      </div>
    </section>
  );
}
