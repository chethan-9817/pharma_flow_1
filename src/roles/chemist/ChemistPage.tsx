import { motion } from 'framer-motion';
import { FileCheck, Gift, PackageCheck, PackagePlus, ShieldCheck, Store, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { suggestedDiscount } from '../../domain/rules/ecoSale';
import { bucketCounts, storeInventory, type BatchView } from '../../domain/selectors';
import type { User } from '../../domain/types';
import { Badge, BucketBadge, Button, Card, SectionTitle, Stat, inr } from '../../components/ui';
import { report } from '../../components/toast';
import { newId } from '../../lib/id';
import { dispatch, useApp } from '../../store';
import { AddInventory, type AddMode } from './AddInventory';
import { SponsoredSection } from './SponsoredSection';
import { WriteOffSection } from './WriteOffSection';

const NGO_ID = 'ngo-seva';

export function ChemistPage({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const storeId = user.storeId!;
  const store = app.stores[storeId]!;
  const inventory = storeInventory(app, storeId);
  const counts = bucketCounts(inventory);
  const [addMode, setAddMode] = useState<AddMode>('scan');

  /** Jump to the Add inventory card, optionally on a specific tab. */
  const openAddInventory = (mode?: AddMode) => {
    if (mode) setAddMode(mode);
    document.getElementById('add-inventory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const orders = Object.values(app.orders)
    .filter((o) => o.storeId === storeId && (o.status === 'PLACED' || o.status === 'RX_APPROVED'))
    .reverse();
  const qaQueue = Object.values(app.pickups).filter((p) => p.qaStoreId === storeId && p.status === 'COLLECTED');

  const rejectRx = async (orderId: string) => {
    const reason = window.prompt(t('chemist.rxRejectPrompt'), t('chemist.rxRejectDefault'));
    if (reason) report(await dispatch(user.id, { type: 'RX_REJECTED', orderId, reason }), t('chemist.rxRejectedToast'));
  };

  const rejectQa = async (pickupId: string) => {
    const note = window.prompt(t('chemist.qaRejectPrompt'), t('chemist.qaRejectDefault'));
    if (note) report(await dispatch(user.id, { type: 'PICKUP_QA_REJECTED', pickupId, note }), t('chemist.qaRejectedToast'));
  };

  const ecoSale = async (v: BatchView) =>
    report(
      await dispatch(user.id, { type: 'ECO_SALE_LISTED', batchId: v.batch.id, discountPct: suggestedDiscount(v.daysLeft) }),
      t('chemist.ecoLive', { brand: v.medicine.brand }),
    );

  const schedulePickup = async (v: BatchView, kind: 'DONATION' | 'DISPOSAL') => {
    const ngo = app.ngos[NGO_ID]!;
    const result = await dispatch(user.id, {
      type: 'PICKUP_SCHEDULED',
      pickup: {
        id: newId('pk'),
        kind,
        sourceStoreId: storeId,
        qaStoreId: kind === 'DONATION' ? storeId : undefined,
        ngoId: kind === 'DONATION' ? ngo.id : undefined,
        batchId: v.batch.id,
        items: [
          { medicineId: v.medicine.id, batchNo: v.batch.batchNo, expiry: v.batch.expiry, qty: v.batch.qty, sealed: true, openedLiquid: false },
        ],
        status: 'SCHEDULED',
        address: `${store.name}, ${store.area}`,
        lat: store.lat,
        lng: store.lng,
        scheduledAt: app.today,
      },
    });
    report(result, kind === 'DONATION' ? t('chemist.riderSummoned', { ngo: ngo.name }) : t('chemist.yellowBagScheduled'));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-medical-tint text-medical ring-1 ring-inset ring-medical-ring/70">
              <Store className="size-6" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">{store.name}</h1>
              <p className="text-sm text-slate-500">{store.area} · {t('chemist.licence')} {store.drugLicence}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={store.kyc === 'APPROVED' ? 'green' : 'amber'}>{store.kyc === 'APPROVED' ? t('chemist.kycApproved') : t('chemist.awaitingKyc')}</Badge>
            <Button onClick={() => openAddInventory()}>
              <PackagePlus className="size-4" /> {t('chemist.addInventory')}
            </Button>
          </div>
        </div>
        <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">{t('chemist.tagline')}</p>
      </motion.section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('chemist.safe')} value={counts.SAFE} hint={t('chemist.days180')} tone="green" />
        <Stat label={t('chemist.lockout')} value={counts.LOCKOUT} hint={t('chemist.days30to180')} tone="amber" />
        <Stat label={t('chemist.critical')} value={counts.CRITICAL} hint={t('chemist.days1to29')} tone="orange" />
        <Stat label={t('chemist.expired')} value={counts.EXPIRED} hint={t('chemist.bioHazard')} tone="red" />
      </div>

      <AddInventory user={user} mode={addMode} onModeChange={setAddMode} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>{t('chemist.packingDesk')}</SectionTitle>
          <div className="space-y-3">
            {orders.length === 0 && <Card className="text-sm text-slate-500">{t('chemist.noOrders')}</Card>}
            {orders.map((o) => {
              const rx = o.prescriptionId ? app.prescriptions[o.prescriptionId] : undefined;
              const canPack = o.status === 'RX_APPROVED' || (o.status === 'PLACED' && o.rxStatus === 'NOT_REQUIRED');
              return (
                <Card key={o.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{o.items.map((i) => `${app.medicines[i.medicineId]?.brand} ×${i.qty}`).join(', ')}</p>
                      <p className="text-xs text-slate-500">{app.users[o.customerId]?.name} · {inr(o.total)}</p>
                    </div>
                    {o.rxStatus === 'NOT_REQUIRED' && <Badge tone="green">{t('chemist.otc')}</Badge>}
                    {o.rxStatus === 'PENDING' && <Badge tone="amber">{t('chemist.rxToReview')}</Badge>}
                    {o.rxStatus === 'APPROVED' && <Badge tone="green">{t('chemist.rxApproved')}</Badge>}
                    {o.rxStatus === 'REJECTED' && <Badge tone="red">{t('chemist.rxRejectedBadge')}</Badge>}
                  </div>
                  {rx && (
                    <dl className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                      <div><dt className="text-slate-500">{t('chemist.doctor')}</dt><dd className="font-semibold">{rx.doctorName}</dd></div>
                      <div><dt className="text-slate-500">{t('chemist.regNo')}</dt><dd className="font-mono font-semibold">{rx.registrationNo}</dd></div>
                      <div><dt className="text-slate-500">{t('chemist.patient')}</dt><dd className="font-semibold">{rx.patientName}</dd></div>
                      <div><dt className="text-slate-500">{t('chemist.date')}</dt><dd className="font-semibold">{rx.date}</dd></div>
                    </dl>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {o.rxStatus === 'PENDING' && (
                      <>
                        <Button size="sm" variant="eco" onClick={async () => report(await dispatch(user.id, { type: 'RX_APPROVED', orderId: o.id }), t('chemist.rxApprovedToast'))}>
                          <FileCheck className="size-4" /> {t('chemist.approveRx')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void rejectRx(o.id)}>{t('chemist.rejectRx')}</Button>
                      </>
                    )}
                    {canPack && (
                      <Button size="sm" onClick={async () => report(await dispatch(user.id, { type: 'ORDER_PACKED', orderId: o.id }), t('chemist.packed'))}>
                        <PackageCheck className="size-4" /> {t('chemist.pack')}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle>{t('chemist.qaDesk')}</SectionTitle>
          <div className="space-y-3">
            {qaQueue.length === 0 && <Card className="text-sm text-slate-500">{t('chemist.noQa')}</Card>}
            {qaQueue.map((p) => (
              <Card key={p.id} className="space-y-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{p.items.map((i) => `${app.medicines[i.medicineId]?.brand} ×${i.qty}`).join(', ')}</p>
                    {p.sponsorshipId && <Badge tone="green">{t('chemist.sponsoredBadge')}</Badge>}
                  </div>
                  <p className="text-xs text-slate-500">
                    {t('chemist.batchLine', { batch: p.items[0]?.batchNo, expiry: p.items[0]?.expiry, ngo: p.ngoId ? app.ngos[p.ngoId]?.name : 'NGO' })}
                  </p>
                  {p.sponsorshipId && (
                    <p className="mt-1 text-xs text-slate-500">{t('chemist.sponsoredNote', { amount: inr(app.sponsorships[p.sponsorshipId]?.storePayout ?? 0) })}</p>
                  )}
                </div>
                <p className="text-xs text-slate-500">{t('chemist.checkSeal')}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="eco" onClick={async () => report(await dispatch(user.id, { type: 'PICKUP_QA_VERIFIED', pickupId: p.id }), t('chemist.qaVerifiedToast'))}>
                    <ShieldCheck className="size-4" /> {t('chemist.qaVerified')}
                  </Button>
                  <Button size="sm" variant="dangerSoft" onClick={() => void rejectQa(p.id)}>{t('chemist.qaReject')}</Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <section>
        <SectionTitle
          action={
            <Button size="sm" variant="soft" onClick={() => openAddInventory('pick')}>
              <PackagePlus className="size-4" /> {t('chemist.addInventory')}
            </Button>
          }
        >
          {t('chemist.ledger')}
        </SectionTitle>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-3">{t('chemist.col.medicine')}</th>
                <th className="px-4 py-3">{t('chemist.col.batch')}</th>
                <th className="px-4 py-3 text-right">{t('chemist.col.qty')}</th>
                <th className="px-4 py-3">{t('chemist.col.expiry')}</th>
                <th className="px-4 py-3">{t('chemist.col.status')}</th>
                <th className="px-4 py-3 text-right">{t('chemist.col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((v) => (
                <tr key={v.batch.id} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{v.medicine.brand}</div>
                    <div className="text-xs text-slate-500">{v.medicine.schedule === 'OTC' ? t('chemist.otcLabel') : t('chemist.scheduleLabel', { schedule: v.medicine.schedule })}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{v.batch.batchNo}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{v.batch.qty}</td>
                  <td className="px-4 py-3">
                    <div className="tabular-nums">{v.batch.expiry}</div>
                    <div className="text-xs text-slate-500">{v.daysLeft > 0 ? t('chemist.daysLeft', { count: v.daysLeft }) : t('chemist.daysAgo', { count: -v.daysLeft })}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <BucketBadge bucket={v.bucket} />
                      {v.batch.status === 'ECO_SALE' && <Badge tone="blue">{t('chemist.ecoBadge', { pct: v.batch.ecoDiscountPct })}</Badge>}
                      {v.batch.status === 'DONATION_PENDING' && <Badge tone="green">{t('chemist.donationPickup')}</Badge>}
                      {v.batch.status === 'DISPOSAL_PENDING' && <Badge tone="orange">{t('chemist.yellowBagPickup')}</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {v.batch.status === 'IN_STOCK' && v.batch.qty > 0 && (
                      <div className="flex justify-end gap-1.5">
                        {v.bucket !== 'EXPIRED' && (
                          <>
                            <Button size="sm" variant="amber" onClick={() => void ecoSale(v)}>
                              <Tag className="size-3.5" /> {t('chemist.ecoSale')}
                            </Button>
                            <Button size="sm" variant="ecoSoft" onClick={() => void schedulePickup(v, 'DONATION')}>
                              <Gift className="size-3.5" /> {t('chemist.donate')}
                            </Button>
                          </>
                        )}
                        {v.bucket === 'EXPIRED' && (
                          <Button size="sm" variant="dangerSoft" onClick={() => void schedulePickup(v, 'DISPOSAL')}>
                            <Trash2 className="size-3.5" /> {t('chemist.dispose')}
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <SponsoredSection user={user} />

      <WriteOffSection user={user} />
    </div>
  );
}
