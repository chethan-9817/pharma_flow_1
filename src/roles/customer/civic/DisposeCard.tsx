import { ShieldAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { checkDisposalEligible } from '../../../domain/rules/donation';
import { KARMA } from '../../../domain/rules/rewards';
import type { User } from '../../../domain/types';
import { Button, Card } from '../../../components/ui';
import { report, toast } from '../../../components/toast';
import { newId } from '../../../lib/id';
import { dispatch, useApp } from '../../../store';
import { StripFields, emptyStrip } from './shared';

export function DisposeCard({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const medicines = Object.values(app.medicines).sort((a, b) => a.brand.localeCompare(b.brand));
  const [strip, setStrip] = useState(emptyStrip());
  const [busy, setBusy] = useState(false);

  const medicine = app.medicines[strip.medicineId];
  let problem: string | null = null;
  if (medicine && strip.expiry) {
    const check = checkDisposalEligible(medicine, strip.expiry, app.today);
    if (!check.ok) problem = check.reason;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!medicine) return toast(t('customer.civic.disposeChoose'), 'error');
    if (!strip.batchNo.trim()) return toast(t('customer.civic.enterBatch'), 'error');
    if (!strip.expiry) return toast(t('customer.civic.enterExpiry'), 'error');
    setBusy(true);
    const result = await dispatch(user.id, {
      type: 'PICKUP_SCHEDULED',
      pickup: {
        id: newId('pk'),
        kind: 'DISPOSAL',
        sourceUserId: user.id,
        items: [{ medicineId: medicine.id, batchNo: strip.batchNo.trim(), expiry: strip.expiry, qty: strip.qty, sealed: true, openedLiquid: false }],
        status: 'SCHEDULED',
        address: user.address ?? 'Customer address',
        lat: user.lat ?? 0,
        lng: user.lng ?? 0,
        scheduledAt: app.today,
      },
    });
    setBusy(false);
    if (report(result, t('customer.civic.disposeScheduled'))) setStrip(emptyStrip());
  };

  return (
    <Card id="dispose-card" className="scroll-mt-24 space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600">
          <ShieldAlert className="size-5" />
        </span>
        <div>
          <h3 className="font-semibold text-slate-900">{t('customer.civic.disposeTitle')}</h3>
          <p className="text-sm text-slate-500">{t('customer.civic.disposeBody')}</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <StripFields draft={strip} onChange={setStrip} medicines={medicines} maxExpiry={app.today} />
        {problem && (
          <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {problem}
          </p>
        )}
        <Button type="submit" block disabled={busy || Boolean(problem)}>
          {t('customer.civic.disposeButton', { karma: KARMA.DISPOSAL })}
        </Button>
      </form>
    </Card>
  );
}
