import { WifiOff } from 'lucide-react';
import type { LatLng, Stop } from '../../domain/route';
import { RIDER_COLOR, STOP_COLOR } from './mapStyle';

interface Props {
  from: LatLng;
  stops: Stop[];
  rider: LatLng;
  /** Why the real map is not shown, for the caption. */
  note?: string;
}

const W = 360;
const H = 240;
const PAD = 36;

/**
 * Schematic map drawn with SVG. It needs no internet, so the rider screen still works
 * offline: the same stops, route line and rider marker, just without street tiles.
 */
export function RouteMapSvg({ from, stops, rider, note = 'Offline map' }: Props) {
  const points = [from, rider, ...stops];
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  // Longitude degrees are shorter than latitude degrees away from the equator.
  const lngScale = Math.cos((midLat * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * lngScale, 0.002);
  const spanY = Math.max(maxLat - minLat, 0.002);
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const offsetX = (W - spanX * scale) / 2;
  const offsetY = (H - spanY * scale) / 2;

  const project = (p: LatLng) => ({
    x: offsetX + (p.lng - minLng) * lngScale * scale,
    y: H - (offsetY + (p.lat - minLat) * scale),
  });

  const path = [from, ...stops].map(project);
  const riderXY = project(rider);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-800">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Route diagram" className="block h-auto w-full">
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1e293b" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        <polyline points={path.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#38BDF8" strokeWidth="3" strokeDasharray="7 6" strokeLinecap="round" />
        {stops.map((stop, i) => {
          const { x, y } = project(stop);
          return (
            <g key={stop.id}>
              <circle cx={x} cy={y} r="14" fill={STOP_COLOR[stop.kind]} stroke="#fff" strokeWidth="2" />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
                {i + 1}
              </text>
            </g>
          );
        })}
        <circle cx={riderXY.x} cy={riderXY.y} r="14" fill={RIDER_COLOR} fillOpacity="0.25" />
        <circle cx={riderXY.x} cy={riderXY.y} r="7" fill={RIDER_COLOR} stroke="#0f172a" strokeWidth="2" />
      </svg>
      <p className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-slate-950/80 px-2.5 py-1 text-[11px] font-medium text-slate-300">
        <WifiOff className="size-3" /> {note}
      </p>
    </div>
  );
}
