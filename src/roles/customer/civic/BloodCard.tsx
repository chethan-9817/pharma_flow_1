import { Droplets } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from '../../../domain/types';
import { Badge, Button, Card } from '../../../components/ui';
import { report, toast } from '../../../components/toast';
import { newId } from '../../../lib/id';
import { dispatch, useApp } from '../../../store';
import { Field, inputCls } from './shared';

const GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export function BloodCard({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const banks = Object.values(app.bloodBanks);
  const [bankId, setBankId] = useState(banks[0]?.id ?? '');
  const [group, setGroup] = useState('O+');
  const [date, setDate] = useState(app.today);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!bankId) return toast(t('customer.civic.chooseBank'), 'error');
    setBusy(true);
    const result = await dispatch(user.id, {
      type: 'BLOOD_BOOKED',
      booking: { id: newId('bk'), userId: user.id, bloodBankId: bankId, date, bloodGroup: group, status: 'BOOKED' },
    });
    setBusy(false);
    report(result, t('customer.civic.booked'));
  };

  return (
    <Card id="blood-card" className="scroll-mt-24 space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-blood">
          <Droplets className="size-5" />
        </span>
        <div>
          <h3 className="font-bold text-slate-900">{t('customer.civic.bloodTitle')}</h3>
          <p className="text-sm text-slate-500">{t('customer.civic.bloodBody')}</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-slate-600">{t('customer.civic.bloodBank')}</legend>
          {banks.map((b) => (
            <label
              key={b.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                bankId === b.id ? 'border-blood bg-rose-50/60 ring-2 ring-blood/20' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input type="radio" name="blood-bank" className="size-4 accent-blood" checked={bankId === b.id} onChange={() => setBankId(b.id)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{b.name}</p>
                <p className="text-xs text-slate-500">{b.area}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                <span className="text-[11px] text-slate-500">{t('customer.civic.urgent')}</span>
                {b.urgentGroups.map((g) => (
                  <Badge key={g} tone="red">{g}</Badge>
                ))}
              </div>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('customer.civic.bloodGroup')}>
            <select className={inputCls} value={group} onChange={(e) => setGroup(e.target.value)}>
              {GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
          <Field label={t('customer.civic.appointmentDate')}>
            <input type="date" className={inputCls} value={date} min={app.today} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Button type="submit" variant="danger" block disabled={busy}>
          {t('customer.civic.book')}
        </Button>
      </form>
    </Card>
  );
}
