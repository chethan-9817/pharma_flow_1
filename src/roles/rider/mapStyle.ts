import type { StopKind } from '../../domain/route';

/** Colours match the mission radar: blue delivery, green NGO, orange bio-hazard. */
export const STOP_COLOR: Record<StopKind, string> = {
  PICKUP: '#10B981',
  STORE: '#0284C7',
  HOME: '#38BDF8',
  NGO: '#10B981',
  CBWTF: '#F97316',
};

export const STOP_KIND_LABEL: Record<StopKind, string> = {
  PICKUP: 'Pickup',
  STORE: 'Store',
  HOME: 'Customer',
  NGO: 'NGO',
  CBWTF: 'CBWTF plant',
};

export const RIDER_COLOR = '#FACC15';

/**
 * Free OpenStreetMap tiles, no API key. CARTO's dark basemap now answers with an
 * "API KEY REQUIRED" watermark, so the dark look comes from a CSS filter instead
 * (see `.pf-dark-tiles` in index.css). The public OSM servers are fine for a demo;
 * a production app should use its own tile provider or host tiles itself.
 */
export const MAP_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_CLASS = 'pf-dark-tiles';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
