import { HeartHandshake } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { nearestStoreId } from '../../../domain/checkout';
import { checkDonationEligible, checkNgoCanReceive } from '../../../domain/rules/donation';
import type { User } from '../../../domain/types';
import { Button, Card } from '../../../components/ui';
import { report, toast } from '../../../components/toast';
import { newId } from '../../../lib/id';
import { dispatch, useApp } from '../../../store';
import { Field, StripFields, emptyStrip, inputCls } from './shared';

interface Props {
  user: User;
  /** Set by the course reminder to pre-fill the medicine. `prefillKey` changes on each click. */
  prefillMedicineId?: string;
  prefillKey?: number;
}

export function DonateCard({ user, prefillMedicineId, prefillKey }: Props) {
  const app = useApp();
  const medicines = Object.values(app.medicines).sort((a, b) => a.brand.localeCompare(b.brand));
  const ngos = Object.values(app.ngos);
  const stores = Object.values(app.stores).filter((s) => s.kyc === 'APPROVED');

  const [strip, setStrip] = useState(emptyStrip());
  const [sealed, setSealed] = useState(true);
  const [opened, setOpened] = useState(false);
  const [ngoId, setNgoId] = useState(ngos[0]?.id ?? '');
  const [qaStoreId, setQaStoreId] = useState(nearestStoreId(app, user.id) ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (prefillMedicineId) setStrip((s) => ({ ...s, medicineId: prefillMedicineId }));
  }, [prefillMedicineId, prefillKey]);

  const medicine = app.medicines[strip.medicineId];
  const ngo = app.ngos[ngoId];

  // Live feedback from the same rules the reducer enforces. The reducer still has the last word.
  let problem: string | null = null;
  if (medicine) {
    const ngoCheck = ngo ? checkNgoCanReceive(medicine, ngo) : { ok: true as const };
    if (!ngoCheck.ok) problem = ngoCheck.reason;
    else if (strip.expiry) {
      const check = checkDonationEligible(medicine, { expiry: strip.expiry, sealed, openedLiquid: opened }, app.today);
      if (!check.ok) problem = check.reason;
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!medicine) return toast('Choose the medicine you want to donate', 'error');
    if (!strip.batchNo.trim()) return toast('Enter the batch number from the strip', 'error');
    if (!strip.expiry) return toast('Enter the expiry date', 'error');
    if (!ngoId || !qaStoreId) return toast('Choose an NGO and a pharmacy for the quality check', 'error');
    setBusy(true);
    const result = await dispatch(user.id, {
      type: 'PICKUP_SCHEDULED',
      pickup: {
        id: newId('pk'),
        kind: 'DONATION',
        sourceUserId: user.id,
        qaStoreId,
        ngoId,
        items: [{ medicineId: medicine.id, batchNo: strip.batchNo.trim(), expiry: strip.expiry, qty: strip.qty, sealed, openedLiquid: opened }],
        status: 'SCHEDULED',
        address: user.address ?? 'Customer address',
        lat: user.lat ?? 0,
        lng: user.lng ?? 0,
        scheduledAt: app.today,
      },
    });
    setBusy(false);
    if (report(result, 'Free pickup scheduled. A rider will collect it.')) {
      setStrip(emptyStrip());
      setSealed(true);
      setOpened(false);
    }
  };

  return (
    <Card id="donate-card" className="scroll-mt-24 space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-eco-dark">
          <HeartHandshake className="size-5" />
        </span>
        <div>
          <h3 className="font-bold text-slate-900">Donate unused medicines</h3>
          <p className="text-sm text-slate-500">Sealed strips with more than 30 days left go to a verified NGO clinic after a pharmacist checks them. Pickup is free.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <StripFields draft={strip} onChange={setStrip} medicines={medicines} />

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sealed} onChange={(e) => setSealed(e.target.checked)} className="size-4 accent-eco" />
            Sealed and unopened
          </label>
          {medicine?.form === 'SYRUP' && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={opened} onChange={(e) => setOpened(e.target.checked)} className="size-4 accent-eco" />
              Bottle already opened
            </label>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Donate to">
            <select className={inputCls} value={ngoId} onChange={(e) => setNgoId(e.target.value)}>
              {ngos.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} · {n.area}
                  {n.hasRegisteredProfessional ? '' : ' (no doctor or pharmacist)'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pharmacy that checks the strips">
            <select className={inputCls} value={qaStoreId} onChange={(e) => setQaStoreId(e.target.value)}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.area}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <p className="text-xs text-slate-500">
          Pickup from: <b>{user.address ?? 'your address'}</b>. Cold-chain medicines such as insulin cannot be donated.
        </p>
        {problem && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {problem}
          </p>
        )}
        <Button type="submit" variant="eco" block disabled={busy || Boolean(problem)}>
          Schedule free pickup · earn +200 karma
        </Button>
      </form>
    </Card>
  );
}
