import { motion } from 'framer-motion';
import { CheckCircle2, Droplets, Package, ShieldCheck, Skull, TrendingUp, XCircle } from 'lucide-react';
import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { kpis } from '../../domain/selectors';
import type { User } from '../../domain/types';
import { Badge, Button, Card, SectionTitle, Stat, inr } from '../../components/ui';
import { report, toast } from '../../components/toast';
import { dispatch, pharma, useApp, usePharma } from '../../store';
import { NgoFundCard } from './NgoFundCard';

// Recharts is a large library, so it only loads when the admin portal opens.
const AdminCharts = lazy(() => import('./AdminCharts'));

export function AdminPage({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const chain = usePharma((s) => s.chain);
  const k = kpis(app);
  const pending = Object.values(app.stores).filter((s) => s.kyc === 'PENDING_KYC');
  const recent = [...chain].reverse().slice(0, 10);
  const bookings = Object.values(app.bloodBookings).reverse();
  const bookedDonations = bookings.filter((b) => b.status === 'BOOKED');

  const verify = async () => {
    const result = await pharma.getState().verifyLedger();
    if (result.ok) toast(t('admin.chainIntact', { count: result.length }));
    else toast(t('admin.tampered', { index: result.brokenAt, reason: result.reason }), 'error');
  };

  const decide = async (storeId: string, decision: 'APPROVED' | 'REJECTED') =>
    report(
      await dispatch(user.id, { type: 'KYC_DECIDED', storeId, decision }),
      t('admin.decided', { decision: t(decision === 'APPROVED' ? 'admin.approved' : 'admin.rejected') }),
    );

  const confirmBlood = async (bookingId: string) =>
    report(await dispatch(user.id, { type: 'BLOOD_DONATION_CONFIRMED', bookingId }), t('admin.confirmedToast'));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">{t('admin.title')}</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('admin.deadStock')} value={inr(k.deadStockRecovered)} hint={t('admin.ecoRevenue')} tone="blue" />
        <Stat label={t('admin.waste')} value={`${k.hazardousKgDiverted} kg`} hint={t('admin.viaCbwtf')} tone="orange" />
        <Stat label={t('admin.toNgos')} value={inr(k.ngoMedicineValue)} hint={t('admin.atMrp')} tone="green" />
        <Stat label={t('admin.bloodDonations')} value={`${k.bloodDonationsCompleted}/${k.bloodDonationsBooked}`} hint={t('admin.completedBooked')} tone="red" />
      </div>

      <Suspense fallback={<Card className="h-72 animate-pulse bg-slate-100" />}>
        <AdminCharts app={app} chain={chain} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
        <section>
          <SectionTitle>{t('admin.kycQueue')}</SectionTitle>
          <div className="space-y-3">
            {pending.length === 0 && <Card className="text-sm text-slate-500">{t('admin.noPending')}</Card>}
            {pending.map((s) => (
              <motion.div key={s.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">{s.name}</h3>
                      <p className="text-xs text-slate-500">{s.area}</p>
                    </div>
                    <Badge tone="amber">PENDING_KYC</Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-slate-500">{t('admin.drugLicence')}</dt><dd className="font-mono font-semibold">{s.drugLicence}</dd></div>
                    <div><dt className="text-slate-500">{t('admin.gstin')}</dt><dd className="font-mono font-semibold">{s.gstin}</dd></div>
                  </dl>
                  <div className="flex gap-2">
                    <Button size="sm" variant="eco" onClick={() => void decide(s.id, 'APPROVED')}><CheckCircle2 className="size-4" /> {t('admin.approve')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => void decide(s.id, 'REJECTED')}><XCircle className="size-4" /> {t('admin.reject')}</Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Package className="size-3.5" /> {t('admin.ordersDelivered', { count: k.ordersDelivered })}
            <Skull className="ml-2 size-3.5" /> {t('admin.expiredOnlyCbwtf')}
            <Droplets className="ml-2 size-3.5" /> {t('admin.bloodNoMoney')}
          </p>
        </section>

        <NgoFundCard />

        <section>
          <SectionTitle>{t('admin.bloodBookings')}</SectionTitle>
          <div className="space-y-3">
            {bookings.length === 0 && <Card className="text-sm text-slate-500">{t('admin.noBookings')}</Card>}
            {bookings.map((b) => (
              <Card key={b.id} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-blood">
                  <Droplets className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{app.users[b.userId]?.name} · {t('admin.group', { group: b.bloodGroup })}</p>
                  <p className="truncate text-xs text-slate-500">{app.bloodBanks[b.bloodBankId]?.name} · {b.date}</p>
                </div>
                {b.status === 'BOOKED' ? (
                  <Button size="sm" variant="soft" onClick={() => void confirmBlood(b.id)}>{t('admin.confirmDonation')}</Button>
                ) : (
                  <Badge tone="green">{t('admin.donated')}</Badge>
                )}
              </Card>
            ))}
          </div>
          {bookedDonations.length > 0 && <p className="mt-2 text-xs text-slate-500">{t('admin.confirmNote')}</p>}
        </section>
        </div>

        <section>
          <SectionTitle
            action={
              <Button size="sm" onClick={() => void verify()}>
                <ShieldCheck className="size-4" /> {t('admin.verifyLedger')}
              </Button>
            }
          >
            {t('admin.audit')}
          </SectionTitle>
          <Card className="divide-y divide-slate-100 p-0">
            {recent.length === 0 && <p className="p-4 text-sm text-slate-500">{t('admin.noEvents')}</p>}
            {recent.map((e) => (
              <div key={e.hash} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <TrendingUp className="size-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{e.event.type.replaceAll('_', ' ').toLowerCase()}</p>
                  <p className="truncate text-xs text-slate-500">{app.users[e.event.actorId]?.name ?? e.event.actorId} · {e.event.at}</p>
                </div>
                <code className="text-[11px] text-slate-400">#{e.index} {e.hash.slice(0, 8)}</code>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </div>
  );
}
