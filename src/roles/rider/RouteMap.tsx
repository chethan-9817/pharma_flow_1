import { Loader2 } from 'lucide-react';
import { Suspense, lazy, useEffect, useState } from 'react';
import type { LatLng, Stop } from '../../domain/route';
import { RouteMapSvg } from './RouteMapSvg';

// Leaflet is only downloaded when a rider actually has a route to show.
const LeafletRouteMap = lazy(() => import('./LeafletRouteMap'));

interface Props {
  from: LatLng;
  stops: Stop[];
  rider: LatLng;
  legKey: string;
  /** Taller map for the laptop layout. */
  tall?: boolean;
}

/**
 * The street map used by the rider and the customer's order tracker. If the device is offline, or street tiles keep failing,
 * it quietly switches to the SVG diagram so navigation never shows a blank box.
 */
export function RouteMap(props: Props) {
  const [failed, setFailed] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);

  useEffect(() => {
    const goOffline = () => setFailed(true);
    const goOnline = () => setFailed(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (failed) return <RouteMapSvg {...props} note="Offline map. Street view returns when you are back online" />;

  return (
    <Suspense
      fallback={
        <div className={`grid place-items-center rounded-xl bg-slate-100 text-slate-400 ring-1 ring-slate-200 ${props.tall ? 'h-96 lg:h-[30rem]' : 'h-64 sm:h-72'}`}>
          <Loader2 className="size-6 animate-spin" />
        </div>
      }
    >
      <LeafletRouteMap {...props} onTilesFailed={() => setFailed(true)} />
    </Suspense>
  );
}
