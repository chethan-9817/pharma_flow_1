import { Clock, ExternalLink, Navigation, Phone, Route as RouteIcon } from 'lucide-react';
import { routeStats, type Route } from '../../domain/route';
import { RouteMap } from './RouteMap';
import { STOP_COLOR, STOP_KIND_LABEL } from './mapStyle';
import { useRiderPosition } from './useRiderPosition';

const km = (n: number) => `${n.toFixed(1)} km`;
const mins = (n: number) => (n < 1 ? '<1 min' : `${n} min`);

/**
 * Dark map with the whole multi-stop route, the next stop, distance and ETA,
 * a Call button for the person at the next stop, and a link to open it in a maps app.
 */
export function NavigationPanel({ route, tall }: { route: Route; tall?: boolean }) {
  const { stops, from, moving } = route;
  const stats = routeStats(from, stops);
  const next = stops[0]!;
  const legKey = `${next.id}|${moving}|${from.lat.toFixed(5)},${from.lng.toFixed(5)}`;
  const rider = useRiderPosition(from, next, moving, legKey);

  // While waiting at the first stop, the next trip is to the stop after it.
  const target = moving ? next : (stops[1] ?? next);
  const leg = moving ? stats.legs[0]! : (stats.legs[1] ?? stats.legs[0]!);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=two-wheeler`;

  return (
    <section className="space-y-3 rounded-2xl bg-slate-900 p-3 ring-1 ring-slate-800" aria-label="Navigation">
      <div className="flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Navigation className="size-3.5" /> Navigation
        </h2>
        <span className="text-xs text-slate-400">
          {stops.length} stop{stops.length > 1 ? 's' : ''} · {km(stats.totalKm)} · about {mins(stats.totalMinutes)}
        </span>
      </div>

      <RouteMap from={from} stops={stops} rider={rider} legKey={legKey} tall={tall} />

      <div className="rounded-xl bg-slate-800 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {moving ? 'Next stop' : `You are at ${STOP_KIND_LABEL[next.kind].toLowerCase()}. Next stop`}
        </p>
        <p className="mt-0.5 font-semibold text-white">{target.label}</p>
        <p className="text-xs text-slate-400">{target.detail}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-200">
          <span className="flex items-center gap-1.5">
            <RouteIcon className="size-4 text-sky-400" /> {km(leg.km)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4 text-amber-400" /> ETA {mins(leg.minutes)}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {next.phone ? (
            <a
              href={`tel:${next.phone.replace(/\s/g, '')}`}
              aria-label={`Call ${next.phone}`}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-bold text-slate-950 transition active:scale-[0.97]"
            >
              <Phone className="size-4" /> Call
            </a>
          ) : (
            <span className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-700 text-sm font-semibold text-slate-400">
              <Phone className="size-4" /> No contact
            </span>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-700 text-sm font-semibold text-white transition hover:bg-slate-600 active:scale-[0.97]"
          >
            <ExternalLink className="size-4" /> Open in Maps
          </a>
        </div>
      </div>

      <ol className="space-y-1.5">
        {stops.map((stop, i) => (
          <li key={stop.id} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${i === 0 ? 'bg-slate-800/70' : ''}`}>
            <span
              className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-white text-xs font-bold text-white"
              style={{ background: STOP_COLOR[stop.kind] }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{stop.label}</p>
              <p className="truncate text-xs text-slate-500">{stop.detail}</p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-slate-400">
              {km(stats.legs[i]!.km)} · {mins(stats.legs[i]!.minutes)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
