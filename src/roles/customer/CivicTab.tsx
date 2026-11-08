import { motion } from 'framer-motion';
import { Leaf, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { courseReminders } from '../../domain/selectors';
import type { User } from '../../domain/types';
import { Button } from '../../components/ui';
import { useApp } from '../../store';
import { BloodCard } from './civic/BloodCard';
import { CivicActivity } from './civic/CivicActivity';
import { DisposeCard } from './civic/DisposeCard';
import { DonateCard } from './civic/DonateCard';

/**
 * Civic Hub: donate unused medicines, dispose of expired ones safely and book a blood donation,
 * with a reminder when a medicine course has finished and the leftovers could help someone.
 */
export function CivicTab({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [prefill, setPrefill] = useState<{ medicineId: string; key: number } | null>(null);

  const reminders = courseReminders(app, user.id).filter((r) => !dismissed.includes(`${r.orderId}:${r.medicineId}`));
  const ngo = Object.values(app.ngos).find((n) => n.hasRegisteredProfessional) ?? Object.values(app.ngos)[0];

  const donateLeftovers = (medicineId: string) => {
    setPrefill({ medicineId, key: Date.now() });
    document.getElementById('donate-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6">
      {reminders.map((r) => {
        const m = app.medicines[r.medicineId]!;
        return (
          <motion.div
            key={`${r.orderId}:${r.medicineId}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-sky-50 p-4 ring-1 ring-emerald-200"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-eco-dark shadow-sm">
              <Leaf className="size-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-semibold text-slate-900">{t('customer.civic.reminder', { days: r.courseDays, brand: m.brand })}</p>
              <p className="text-sm text-slate-600">
                {t('customer.civic.reminderBody', {
                  what: m.form === 'TABLET' || m.form === 'CAPSULE' ? t('customer.civic.tablets') : t('customer.civic.packs'),
                  ngo: ngo?.name ?? t('customer.civic.anNgo'),
                })}
              </p>
              <Button size="sm" variant="eco" onClick={() => donateLeftovers(m.id)}>
                {t('customer.civic.donateLeftovers')}
              </Button>
            </div>
            <button
              aria-label={t('customer.civic.dismiss')}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
              onClick={() => setDismissed((d) => [...d, `${r.orderId}:${r.medicineId}`])}
            >
              <X className="size-4" />
            </button>
          </motion.div>
        );
      })}

      <div className="grid gap-6 @3xl:grid-cols-2">
        <DonateCard user={user} prefillMedicineId={prefill?.medicineId} prefillKey={prefill?.key} />
        <div className="space-y-6">
          <DisposeCard user={user} />
          <BloodCard user={user} />
        </div>
      </div>

      <CivicActivity user={user} />
    </div>
  );
}
