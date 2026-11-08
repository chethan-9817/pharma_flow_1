import { useEffect, useState } from 'react';
import { interpolate, routeStats, type LatLng } from '../../domain/route';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);

/**
 * Where to draw the rider. While the rider is travelling toward `to`, the marker glides
 * along the straight line and slows down to rest at 90% ("almost there"). This is only
 * a visual: it is local to this tab and never written to the event log.
 */
export function useRiderPosition(from: LatLng, to: LatLng | undefined, moving: boolean, legKey: string): LatLng {
  const [progress, setProgress] = useState(0);
  const km = to ? routeStats(from, [to]).totalKm : 0;
  const durationMs = Math.min(30000, Math.max(10000, km * 6000));

  useEffect(() => {
    setProgress(0);
    if (!moving || !to) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setProgress(0.9 * easeOut(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // legKey changes whenever the leg changes, which restarts the glide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legKey, moving, durationMs]);

  return moving && to ? interpolate(from, to, progress) : from;
}
