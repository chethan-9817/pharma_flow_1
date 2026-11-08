import { ShieldAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { checkDisposalEligible } from '../../../domain/rules/donation';
import type { User } from '../../../domain/types';
import { Button, Card } from '../../../components/ui';
import { report, toast } from '../../../components/toast';
import { newId } from '../../../lib/id';
import { dispatch, useApp } from '../../../store';
import { StripFields, emptyStrip } from './shared';

export function DisposeCard({ user }: { user: User }) {
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
    if (!medicine) return toast('Choose the medicine you want to dispose of', 'error');
    if (!strip.batchNo.trim()) return toast('Enter the batch number from the strip', 'error');
    if (!strip.expiry) return toast('Enter the expiry date', 'error');
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
    if (report(result, 'Yellow-Bag pickup scheduled')) setStrip(emptyStrip());
  };

  return (
    <Card id="dispose-card" className="scroll-mt-24 space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600">
          <ShieldAlert className="size-5" />
        </span>
        <div>
          <h3 className="font-bold text-slate-900">Dispose of expired medicines safely</h3>
          <p className="text-sm text-slate-500">
            Expired medicines are hazardous waste. Never bin or flush them: antibiotics that leak into water feed superbugs. A rider collects a sealed Yellow Bag and takes it to the authorised incineration plant.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <StripFields draft={strip} onChange={setStrip} medicines={medicines} maxExpiry={app.today} />
        {problem && (
          <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {problem}
          </p>
        )}
        <Button type="submit" variant="danger" block disabled={busy || Boolean(problem)}>
          Schedule Yellow-Bag pickup · earn +150 karma
        </Button>
      </form>
    </Card>
  );
}
