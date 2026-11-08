import { motion } from 'framer-motion';
import { Leaf, MapPin, Package, Power, Skull, Wallet } from 'lucide-react';
import { useState } from 'react';
import { isTerminal } from '../../domain/machines/pickup';
import { RIDER_PAY } from '../../domain/handlers/payouts';
import { backhaulSuggestions, openMissions, type Mission } from '../../domain/selectors';
import type { Order, Pickup, User } from '../../domain/types';
import { Button, inr } from '../../components/ui';
import { report } from '../../components/toast';
import { dispatch, useApp } from '../../store';

const KIND = {
  DELIVERY: { label: 'Delivery', color: 'border-sky-500', chip: 'bg-sky-500/15 text-sky-300', icon: Package },
  NGO_PICKUP: { label: 'NGO pickup', color: 'border-emerald-500', chip: 'bg-emerald-500/15 text-emerald-300', icon: Leaf },
  BIO_PICKUP: { label: 'Yellow-Bag bio-hazard', color: 'border-orange-500', chip: 'bg-orange-500/15 text-orange-300', icon: Skull },
} as const;

function MissionHeader({ kind, title, where }: { kind: keyof typeof KIND; title: string; where: string }) {
  const k = KIND[kind];
  const Icon = k.icon;
  return (
    <div className="flex items-start gap-3">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${k.chip}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${k.chip}`}>{k.label}</span>
        <p className="mt-1 truncate font-semibold text-white">{title}</p>
        <p className="flex items-center gap-1 text-xs text-slate-400">
          <MapPin className="size-3" /> {where}
        </p>
      </div>
    </div>
  );
}

export function RiderPage({ user }: { user: User }) {
  const app = useApp();
  const [otp, setOtp] = useState('');
  const profile = app.riders[user.id]!;
  const open = openMissions(app);
  const activeOrders = Object.values(app.orders).filter((o) => o.riderId === user.id && (o.status === 'PACKED' || o.status === 'OUT_FOR_DELIVERY'));
  const activePickups = Object.values(app.pickups).filter((p) => p.riderId === user.id && !isTerminal(p.kind, p.status));

  const act = async (payload: Parameters<typeof dispatch>[1], ok?: string) => report(await dispatch(user.id, payload), ok);
  const itemsLabel = (p: Pickup) => p.items.map((i) => `${app.medicines[i.medicineId]?.brand} ×${i.qty}`).join(', ');
  const orderLabel = (o: Order) => o.items.map((i) => app.medicines[i.medicineId]?.brand).join(', ');

  const accept = (m: Mission) =>
    m.kind === 'DELIVERY'
      ? act({ type: 'ORDER_ACCEPTED', orderId: m.order.id, riderId: user.id }, 'Mission accepted')
      : act({ type: 'PICKUP_ACCEPTED', pickupId: m.pickup.id, riderId: user.id }, 'Mission accepted');

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-lg space-y-5 p-4">
        <header className="space-y-4 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Rider</p>
              <h1 className="text-lg font-bold">{user.name}</h1>
            </div>
            <button
              onClick={() => act({ type: 'RIDER_SHIFT_CHANGED', riderId: user.id, online: !profile.online })}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                profile.online ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 ring-1 ring-slate-700'
              }`}
              aria-pressed={profile.online}
            >
              <Power className="size-4" />
              {profile.online ? 'Online' : 'Offline'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-800 p-3">
              <Wallet className="mx-auto size-4 text-sky-400" />
              <div className="mt-1 text-lg font-bold tabular-nums">{inr(profile.earnings)}</div>
              <div className="text-[11px] text-slate-400">Earnings</div>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <Leaf className="mx-auto size-4 text-emerald-400" />
              <div className="mt-1 text-lg font-bold tabular-nums">{inr(profile.incentives)}</div>
              <div className="text-[11px] text-slate-400">Green bonus</div>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <Package className="mx-auto size-4 text-orange-400" />
              <div className="mt-1 text-lg font-bold tabular-nums">{profile.trips}</div>
              <div className="text-[11px] text-slate-400">Trips</div>
            </div>
          </div>
        </header>

        {(activeOrders.length > 0 || activePickups.length > 0) && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Active mission</h2>

            {activeOrders.map((o) => {
              const near = o.status === 'OUT_FOR_DELIVERY' ? backhaulSuggestions(app, o) : [];
              return (
                <motion.div key={o.id} layout className="space-y-4 rounded-2xl border-l-4 border-sky-500 bg-slate-900 p-4">
                  <MissionHeader kind="DELIVERY" title={orderLabel(o)} where={app.users[o.customerId]?.address ?? 'Customer'} />
                  {o.status === 'PACKED' && !o.riderArrived && (
                    <Button size="lg" block onClick={() => act({ type: 'ORDER_ARRIVED', orderId: o.id })}>Arrived at store</Button>
                  )}
                  {o.status === 'PACKED' && o.riderArrived && (
                    <Button size="lg" block onClick={() => act({ type: 'ORDER_OUT_FOR_DELIVERY', orderId: o.id }, 'On your way')}>Collected, start delivery</Button>
                  )}
                  {o.status === 'OUT_FOR_DELIVERY' && (
                    <div className="space-y-2">
                      <input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        inputMode="numeric"
                        placeholder="Customer OTP"
                        className="h-14 w-full rounded-2xl bg-slate-800 px-4 text-center text-2xl font-bold tracking-[0.5em] outline-none ring-1 ring-slate-700 focus:ring-2 focus:ring-sky-500"
                      />
                      <Button size="lg" block disabled={otp.length < 4} onClick={async () => { await act({ type: 'ORDER_DELIVERED', orderId: o.id, otp }, 'Delivered!'); setOtp(''); }}>
                        Confirm handover
                      </Button>
                    </div>
                  )}
                  {near.map((p) => (
                    <div key={p.id} className="rounded-xl bg-emerald-500/10 p-3 text-sm ring-1 ring-emerald-500/30">
                      <p className="font-semibold text-emerald-300">Backhaul: pickup nearby</p>
                      <p className="text-xs text-slate-300">{itemsLabel(p)} at {p.address}. Collect it on this trip for +{inr(RIDER_PAY.PICKUP + RIDER_PAY.GREEN_INCENTIVE)}.</p>
                      <Button size="sm" variant="eco" className="mt-2" onClick={() => act({ type: 'PICKUP_ACCEPTED', pickupId: p.id, riderId: user.id }, 'Pickup added to your route')}>Add to route</Button>
                    </div>
                  ))}
                </motion.div>
              );
            })}

            {activePickups.map((p) => {
              const kind = p.kind === 'DONATION' ? 'NGO_PICKUP' : 'BIO_PICKUP';
              const ngo = p.ngoId ? app.ngos[p.ngoId] : undefined;
              return (
                <motion.div key={p.id} layout className={`space-y-4 rounded-2xl border-l-4 bg-slate-900 p-4 ${KIND[kind].color}`}>
                  <MissionHeader kind={kind} title={itemsLabel(p)} where={p.address} />
                  {p.status === 'SCHEDULED' && !p.riderArrived && <Button size="lg" block onClick={() => act({ type: 'PICKUP_ARRIVED', pickupId: p.id })}>Arrived</Button>}
                  {p.status === 'SCHEDULED' && p.riderArrived && <Button size="lg" block onClick={() => act({ type: 'PICKUP_COLLECTED', pickupId: p.id }, 'Collected')}>Collected</Button>}
                  {p.status === 'COLLECTED' && p.kind === 'DONATION' && (
                    <p className="rounded-xl bg-slate-800 p-3 text-center text-sm text-slate-300">Take it to the chemist. Waiting for the QA check.</p>
                  )}
                  {p.status === 'COLLECTED' && p.kind === 'DISPOSAL' && (
                    <Button size="lg" block onClick={() => act({ type: 'PICKUP_INCINERATED', pickupId: p.id }, 'Handed to CBWTF')}>Handed to CBWTF</Button>
                  )}
                  {p.status === 'QA_VERIFIED' && <Button size="lg" block variant="eco" onClick={() => act({ type: 'PICKUP_DELIVERED_TO_NGO', pickupId: p.id }, 'Delivered to NGO')}>Hand over to {ngo?.name ?? 'NGO'}</Button>}
                  {p.status === 'QA_REJECTED' && <Button size="lg" block variant="danger" onClick={() => act({ type: 'PICKUP_INCINERATED', pickupId: p.id }, 'Sent to bio-disposal')}>QA rejected: take to CBWTF</Button>}
                </motion.div>
              );
            })}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mission radar</h2>
          {open.length === 0 && <p className="rounded-2xl bg-slate-900 p-4 text-center text-sm text-slate-400">Nothing nearby. New missions appear here live.</p>}
          {open.map((m) => {
            const id = m.kind === 'DELIVERY' ? m.order.id : m.pickup.id;
            const title = m.kind === 'DELIVERY' ? orderLabel(m.order) : itemsLabel(m.pickup);
            const where = m.kind === 'DELIVERY' ? (app.users[m.order.customerId]?.address ?? '') : m.pickup.address;
            return (
              <div key={id} className={`space-y-3 rounded-2xl border-l-4 bg-slate-900 p-4 ${KIND[m.kind].color}`}>
                <MissionHeader kind={m.kind} title={title} where={where} />
                <Button size="lg" block variant="dark" disabled={!profile.online} onClick={() => accept(m)}>
                  {profile.online ? 'Accept mission' : 'Go online to accept'}
                </Button>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
