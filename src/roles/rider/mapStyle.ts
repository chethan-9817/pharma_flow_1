import type { StopKind } from '../../domain/route';

/** Colours match the mission radar: blue delivery, green NGO, orange bio-hazard. Deep enough to read on a light map. */
export const STOP_COLOR: Record<StopKind, string> = {
  PICKUP: '#059669',
  STORE: '#0369A1',
  HOME: '#0EA5E9',
  NGO: '#059669',
  CBWTF: '#EA580C',
};

/** The dashed route line. */
export const ROUTE_COLOR = '#0369A1';

export const STOP_KIND_LABEL: Record<StopKind, string> = {
  PICKUP: 'Pickup',
  STORE: 'Store',
  HOME: 'Customer',
  NGO: 'NGO',
  CBWTF: 'CBWTF plant',
};

export const RIDER_COLOR = '#FACC15';

/**
 * Free OpenStreetMap tiles, no API key. The public OSM servers are fine for a demo;
 * a production app should use its own tile provider or host tiles itself.
 */
export const MAP_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
