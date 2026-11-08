import { HeartHandshake } from 'lucide-react';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { planSponsorship } from '../../domain/sponsor';
import { KARMA } from '../../domain/rules/rewards';
import type { User } from '../../domain/types';
import { Button, inr } from '../../components/ui';
import { report } from '../../components/toast';
import { newId } from '../../lib/id';
import { dispatch, useApp } from '../../store';
import { Field, inputCls } from './civic/shared';

/**
 * "Sponsor batch for NGO (₹99)": the packs come out of this store's Eco-Sale batch, the store is paid its
 * Eco-Sale price, and the change tops up the NGO fund. The preview uses the same planner the reducer re-checks.
 */
export function SponsorPanel({ user, batchId, onDone }: { user: User; batchId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const app = useApp();
  const ngos = Object.values(app.ngos);
  const [ngoId, setNgoId] = useState(ngos[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const planned = planSponsorship(app, { id: 'preview', customerId: user.id, batchId, ngoId });

  const confirm = async () => {
    // Plan again with the real id so the event carries exactly what the reducer will work out.
    const final = planSponsorship(app, { id: newId('sp'), customerId: user.id, batchId, ngoId });
    if (!final.ok) return report({ ok: false, error: final.error });
    setBusy(true);
    const result = await dispatch(user.id, { type: 'SPONSORSHIP_PLACED', sponsorship: final.value });
    setBusy(false);
    if (report(result, t('customer.sponsor.done'))) onDone();
  };

  return (
    <div className="space-y-3 rounded-xl bg-emerald-50/70 p-3 ring-1 ring-emerald-200">
      <Field label={t('customer.sponsor.for')}>
        <select className={inputCls} value={ngoId} onChange={(e) => setNgoId(e.target.value)}>
          {ngos.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name} · {n.area}
            </option>
          ))}
        </select>
      </Field>

      {!planned.ok && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {planned.error}
        </p>
      )}

      {planned.ok && (
        <>
          <ul className="space-y-1 text-sm text-slate-700">
            <li>
              <Trans
                i18nKey="customer.sponsor.buys"
                count={planned.value.qty}
                values={{ amount: inr(planned.value.amount), ngo: app.ngos[planned.value.ngoId]?.name }}
                components={{ b: <b /> }}
              />
            </li>
            <li>{t('customer.sponsor.paysStore', { amount: inr(planned.value.storePayout), store: app.stores[planned.value.storeId]?.name })}</li>
            {planned.value.fundTopUp > 0 && <li>{t('customer.sponsor.topsUp', { amount: inr(planned.value.fundTopUp) })}</li>}
          </ul>
          <p className="text-xs text-slate-600">{t('customer.sponsor.reward', { karma: KARMA.DONATION, amount: inr(planned.value.amount) })}</p>
          <div className="flex gap-2">
            <Button variant="eco" size="sm" disabled={busy} onClick={() => void confirm()}>
              <HeartHandshake className="size-4" /> {t('customer.sponsor.confirm', { amount: inr(planned.value.amount) })}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDone}>
              {t('common.cancel')}
            </Button>
          </div>
        </>
      )}
      {!planned.ok && (
        <Button variant="ghost" size="sm" onClick={onDone}>
          {t('common.close')}
        </Button>
      )}
    </div>
  );
}
