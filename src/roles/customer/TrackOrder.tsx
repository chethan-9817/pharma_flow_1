import { Check, Clock } from 'lucide-react';
import { ORDER_STEPS } from '../../domain/machines/order';
import { riderRoute, routeStats } from '../../domain/route';
import type { Order } from '../../domain/types';
import { RouteMap } from '../rider/RouteMap';
import { useRiderPosition } from '../rider/useRiderPosition';
import { useApp } from '../../store';

const STEP_LABEL: Record<string, string> = {
  PLACED: 'Placed',
  PACKED: 'Packed',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered',
};

/**
 * Live tracker for an open order: a 4-step progress bar, and once a rider has accepted it, a map with
 * the pharmacy, your home and the rider moving between them. The rider's movement is a simulation.
 */
export function TrackOrder({ order }: { order: Order }) {
  const app = useApp();
  // Approved prescriptions are still in the first step; only packing moves the order on.
  const status = order.status === 'RX_APPROVED' ? 'PLACED' : order.status;
  const current = ORDER_STEPS.indexOf(status);

  const route = order.riderId ? riderRoute(app, order.riderId) : null;
  const stops = route?.stops.filter((s) => s.missionId === order.id) ?? [];
  const from = route?.from ?? { lat: 0, lng: 0 };
  const moving = Boolean(route?.moving);
  const legKey = `${order.id}|${stops[0]?.id ?? ''}|${moving}|${from.lat.toFixed(5)},${from.lng.toFixed(5)}`;
  const rider = useRiderPosition(from, stops[0], moving, legKey);

  if (current < 0) return null;
  const stats = stops.length > 0 ? routeStats(from, stops) : null;

  return (
    <div className="space-y-3">
      <ol className="flex items-start" aria-label="Order progress">
        {ORDER_STEPS.map((step, i) => {
          const done = i < current || status === 'DELIVERED';
          const active = i === current && status !== 'DELIVERED';
          return (
            <li key={step} className="flex flex-1 flex-col items-center gap-1 text-center">
              <div className="flex w-full items-center">
                <span className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : done || active ? 'bg-medical' : 'bg-slate-200'}`} />
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ring-2 transition ${
                    done ? 'bg-medical text-white ring-medical' : active ? 'bg-white text-medical ring-medical' : 'bg-white text-slate-400 ring-slate-200'
                  }`}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={`h-0.5 flex-1 ${i === ORDER_STEPS.length - 1 ? 'opacity-0' : done ? 'bg-medical' : 'bg-slate-200'}`} />
              </div>
              <span className={`text-[11px] font-semibold ${active ? 'text-medical' : done ? 'text-slate-700' : 'text-slate-400'}`}>{STEP_LABEL[step]}</span>
            </li>
          );
        })}
      </ol>

      {stops.length > 0 && stats && (
        <>
          <RouteMap from={from} stops={stops} rider={rider} legKey={legKey} light />
          <p className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <Clock className="size-4 shrink-0" />
            {status === 'OUT_FOR_DELIVERY'
              ? `Your rider is on the way. Arriving in about ${Math.max(1, stats.totalMinutes)} min.`
              : 'A rider has accepted your order and is heading to the pharmacy.'}
          </p>
          <p className="text-xs text-slate-500">
            Pins: {stops.map((s, i) => `${i + 1} ${s.kind === 'STORE' ? 'pharmacy' : 'your home'}`).join(' · ')}. The moving dot is your rider (simulated).
          </p>
        </>
      )}
    </div>
  );
}
