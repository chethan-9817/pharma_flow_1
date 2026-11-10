import { motion } from 'framer-motion';
import { Leaf, MapPin, Package, Power, Skull, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isTerminal } from '../../domain/machines/pickup';
import { RIDER_PAY } from '../../domain/handlers/payouts';
import { riderRoute } from '../../domain/route';
import { backhaulSuggestions, openMissions, type Mission } from '../../domain/selectors';
import type { Order, Pickup, User } from '../../domain/types';
import { Button, Card, SectionTitle, inr } from '../../components/ui';
import { report } from '../../components/toast';
import { dispatch, useApp } from '../../store';
import { useEmbedded } from '../../components/layout';
import { NavigationPanel } from './NavigationPanel';

/** Each kind of mission has its own tinted icon tile and label; the card itself stays white. */
const KIND = {
  DELIVERY: { chip: 'bg-sky-50 text-sky-700 ring-sky-600/15', icon: Package },
  NGO_PICKUP: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15', icon: Leaf },
  BIO_PICKUP: { chip: 'bg-orange-50 text-orange-700 ring-orange-600/15', icon: Skull },
} as const;

function MissionHeader({ kind, title, where }: { kind: keyof typeof KIND; title: string; where: string }) {
  const { t } = useTranslation();
  const k = KIND[kind];
  const Icon = k.icon;
  return (
    <div className="flex items-start gap-3">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${k.chip}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${k.chip}`}>{t(`rider.kind.${kind}`)}</span>
        <p className="mt-1 truncate font-semibold text-slate-900">{title}</p>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="size-3" /> {where}
        </p>
      </div>
    </div>
  );
}

export function RiderPage({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const embedded = useEmbedded();
  const [otp, setOtp] = useState('');
  const profile = app.riders[user.id]!;
  const open = openMissions(app);
  const route = riderRoute(app, user.id);
  const activeOrders = Object.values(app.orders).filter((o) => o.riderId === user.id && (o.status === 'PACKED' || o.status === 'OUT_FOR_DELIVERY'));
  const activePickups = Object.values(app.pickups).filter((p) => p.riderId === user.id && !isTerminal(p.kind, p.status));

  const act = async (payload: Parameters<typeof dispatch>[1], ok?: string) => report(await dispatch(user.id, payload), ok);
  const itemsLabel = (p: Pickup) => p.items.map((i) => `${app.medicines[i.medicineId]?.brand} ×${i.qty}`).join(', ');
  const orderLabel = (o: Order) => o.items.map((i) => app.medicines[i.medicineId]?.brand).join(', ');

  const accept = (m: Mission) =>
    m.kind === 'DELIVERY'
      ? act({ type: 'ORDER_ACCEPTED', orderId: m.order.id, riderId: user.id }, t('rider.accepted'))
      : act({ type: 'PICKUP_ACCEPTED', pickupId: m.pickup.id, riderId: user.id }, t('rider.accepted'));

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Compact single column in the "All 4" panes; two columns (missions left, big map right) on a laptop. */}
      <div className={embedded ? 'mx-auto max-w-lg space-y-5 p-4' : 'mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0'}>
        <header className={`space-y-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200 ${embedded ? '' : 'lg:col-span-2'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">{t('rider.title')}</p>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">{user.name}</h1>
            </div>
            <button
              onClick={() => act({ type: 'RIDER_SHIFT_CHANGED', riderId: user.id, online: !profile.online })}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-inset transition-colors ${
                profile.online ? 'bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'
              }`}
              aria-pressed={profile.online}
            >
              <Power className="size-4" />
              {profile.online ? t('rider.online') : t('rider.offline')}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-100">
              <Wallet className="mx-auto size-4 text-medical" />
              <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{inr(profile.earnings)}</div>
              <div className="text-[11px] text-slate-500">{t('rider.earnings')}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-100">
              <Leaf className="mx-auto size-4 text-eco" />
              <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{inr(profile.incentives)}</div>
              <div className="text-[11px] text-slate-500">{t('rider.greenBonus')}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-100">
              <Package className="mx-auto size-4 text-orange-600" />
              <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{profile.trips}</div>
              <div className="text-[11px] text-slate-500">{t('rider.trips')}</div>
            </div>
          </div>
        </header>

        {route.stops.length > 0 && (
          <div className={embedded ? '' : 'lg:col-start-2 lg:row-start-2 lg:sticky lg:top-20'}>
            <NavigationPanel route={route} tall={!embedded} />
          </div>
        )}

        <div className={`space-y-5 ${embedded ? '' : route.stops.length > 0 ? 'lg:col-start-1 lg:row-start-2' : 'lg:col-span-2'}`}>

        {(activeOrders.length > 0 || activePickups.length > 0) && (
          <section className="space-y-3">
            <SectionTitle>{t('rider.activeMission')}</SectionTitle>

            {activeOrders.map((o) => {
              const near = o.status === 'OUT_FOR_DELIVERY' ? backhaulSuggestions(app, o) : [];
              return (
                <motion.div key={o.id} layout className="space-y-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200">
                  <MissionHeader kind="DELIVERY" title={orderLabel(o)} where={app.users[o.customerId]?.address ?? 'Customer'} />
                  {o.status === 'PACKED' && !o.riderArrived && (
                    <Button size="lg" block onClick={() => act({ type: 'ORDER_ARRIVED', orderId: o.id })}>{t('rider.arrivedStore')}</Button>
                  )}
                  {o.status === 'PACKED' && o.riderArrived && (
                    <Button size="lg" block onClick={() => act({ type: 'ORDER_OUT_FOR_DELIVERY', orderId: o.id }, t('rider.onYourWay'))}>{t('rider.collectedStart')}</Button>
                  )}
                  {o.status === 'OUT_FOR_DELIVERY' && (
                    <div className="space-y-2">
                      <input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        inputMode="numeric"
                        placeholder={t('rider.otpPlaceholder')}
                        className="h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-center text-2xl font-semibold tracking-[0.5em] outline-none transition placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-medical focus:ring-4 focus:ring-medical/15"
                      />
                      <Button size="lg" block disabled={otp.length < 4} onClick={async () => { await act({ type: 'ORDER_DELIVERED', orderId: o.id, otp }, t('rider.delivered')); setOtp(''); }}>
                        {t('rider.confirm')}
                      </Button>
                    </div>
                  )}
                  {near.map((p) => (
                    <div key={p.id} className="rounded-xl bg-emerald-50 p-3 text-sm ring-1 ring-inset ring-emerald-200">
                      <p className="font-semibold text-emerald-800">{t('rider.backhaul')}</p>
                      <p className="text-xs text-slate-600">{t('rider.backhaulBody', { items: itemsLabel(p), address: p.address, pay: inr(RIDER_PAY.PICKUP + RIDER_PAY.GREEN_INCENTIVE) })}</p>
                      <Button size="sm" variant="eco" className="mt-2" onClick={() => act({ type: 'PICKUP_ACCEPTED', pickupId: p.id, riderId: user.id }, t('rider.addedToRoute'))}>{t('rider.addToRoute')}</Button>
                    </div>
                  ))}
                </motion.div>
              );
            })}

            {activePickups.map((p) => {
              const kind = p.kind === 'DONATION' ? 'NGO_PICKUP' : 'BIO_PICKUP';
              const ngo = p.ngoId ? app.ngos[p.ngoId] : undefined;
              return (
                <motion.div key={p.id} layout className="space-y-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200">
                  <MissionHeader kind={kind} title={itemsLabel(p)} where={p.address} />
                  {p.status === 'SCHEDULED' && !p.riderArrived && <Button size="lg" block onClick={() => act({ type: 'PICKUP_ARRIVED', pickupId: p.id })}>{t('rider.arrived')}</Button>}
                  {p.status === 'SCHEDULED' && p.riderArrived && <Button size="lg" block onClick={() => act({ type: 'PICKUP_COLLECTED', pickupId: p.id }, t('rider.collectedToast'))}>{t('rider.collected')}</Button>}
                  {p.status === 'COLLECTED' && p.kind === 'DONATION' && (
                    <p className="rounded-xl bg-slate-50 p-3 text-center text-sm text-slate-600 ring-1 ring-inset ring-slate-100">{t('rider.waitingQa')}</p>
                  )}
                  {p.status === 'COLLECTED' && p.kind === 'DISPOSAL' && (
                    <Button size="lg" block onClick={() => act({ type: 'PICKUP_INCINERATED', pickupId: p.id }, t('rider.handedCbwtf'))}>{t('rider.handedCbwtf')}</Button>
                  )}
                  {p.status === 'QA_VERIFIED' && <Button size="lg" block variant="eco" onClick={() => act({ type: 'PICKUP_DELIVERED_TO_NGO', pickupId: p.id }, t('rider.deliveredNgo'))}>{t('rider.handOver', { ngo: ngo?.name ?? 'NGO' })}</Button>}
                  {p.status === 'QA_REJECTED' && <Button size="lg" block variant="danger" onClick={() => act({ type: 'PICKUP_INCINERATED', pickupId: p.id }, t('rider.sentDisposal'))}>{t('rider.qaRejected')}</Button>}
                </motion.div>
              );
            })}
          </section>
        )}

        <section className="space-y-3">
          <SectionTitle>{t('rider.radar')}</SectionTitle>
          {open.length === 0 && <Card className="text-center text-sm text-slate-500">{t('rider.nothingNearby')}</Card>}
          {open.map((m) => {
            const id = m.kind === 'DELIVERY' ? m.order.id : m.pickup.id;
            const title = m.kind === 'DELIVERY' ? orderLabel(m.order) : itemsLabel(m.pickup);
            const where = m.kind === 'DELIVERY' ? (app.users[m.order.customerId]?.address ?? '') : m.pickup.address;
            return (
              <Card key={id} className="space-y-3">
                <MissionHeader kind={m.kind} title={title} where={where} />
                <Button size="lg" block variant="soft" disabled={!profile.online} onClick={() => accept(m)}>
                  {profile.online ? t('rider.accept') : t('rider.goOnline')}
                </Button>
              </Card>
            );
          })}
        </section>
        </div>
      </div>
    </div>
  );
}
