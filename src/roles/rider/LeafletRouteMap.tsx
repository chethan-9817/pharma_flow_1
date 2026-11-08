import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import type { LatLng, Stop } from '../../domain/route';
import { MAP_TILES, RIDER_COLOR, STOP_COLOR, TILE_ATTRIBUTION, TILE_CLASS } from './mapStyle';

interface Props {
  from: LatLng;
  stops: Stop[];
  rider: LatLng;
  /** Changes when the leg changes, so the map re-centres on the new route. */
  legKey: string;
  tall?: boolean;
  /** Called when street tiles keep failing (for example, no internet). */
  onTilesFailed: () => void;
}

const MAX_TILE_ERRORS = 4;

/** Numbered round pin, drawn with a divIcon so no image files are needed. */
function stopIcon(stop: Stop, index: number): L.DivIcon {
  return L.divIcon({
    className: 'pf-pin',
    html: `<span style="background:${STOP_COLOR[stop.kind]}">${index + 1}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const riderIcon = L.divIcon({
  className: 'pf-rider',
  html: `<span class="pf-rider-pulse" style="background:${RIDER_COLOR}"></span><span class="pf-rider-dot" style="background:${RIDER_COLOR}"></span>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/** Fits the map to the whole route whenever the leg changes. */
function FitRoute({ points, trigger }: { points: LatLng[]; trigger: string }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.fitBounds(
      points.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [40, 40], maxZoom: 16, animate: false },
    );
    // Only re-fit when the leg changes, not on every animation frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, map]);
  return null;
}

export default function LeafletRouteMap({ from, stops, rider, legKey, tall, onTilesFailed }: Props) {
  const errors = useRef(0);
  const route = useMemo(() => [from, ...stops].map((p) => [p.lat, p.lng] as [number, number]), [from, stops]);

  return (
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-slate-800" data-testid="leaflet-map">
      <MapContainer
        center={[from.lat, from.lng]}
        zoom={14}
        scrollWheelZoom={false}
        zoomControl
        attributionControl
        className={tall ? 'h-96 w-full lg:h-[30rem]' : 'h-64 w-full sm:h-72'}
        style={{ background: '#0f172a' }}
      >
        <TileLayer
          url={MAP_TILES}
          attribution={TILE_ATTRIBUTION}
          className={TILE_CLASS}
          maxZoom={19}
          eventHandlers={{
            tileerror: () => {
              errors.current += 1;
              if (errors.current === MAX_TILE_ERRORS) onTilesFailed();
            },
            tileload: () => {
              errors.current = 0;
            },
          }}
        />
        <Polyline positions={route} pathOptions={{ color: '#38BDF8', weight: 4, opacity: 0.9, dashArray: '8 8' }} />
        {stops.map((stop, i) => (
          <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={stopIcon(stop, i)} title={stop.label} />
        ))}
        <Marker position={[rider.lat, rider.lng]} icon={riderIcon} title="You" zIndexOffset={1000} />
        <FitRoute points={[from, ...stops]} trigger={legKey} />
      </MapContainer>
    </div>
  );
}
