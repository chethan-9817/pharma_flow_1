import type { Medicine } from '../types';

/** Never "certified bioequivalent": we only claim what the label shows. */
export const GENERIC_LABEL = 'Same salt, same strength';

export interface GenericOffer {
  name: string;
  price: number;
  saving: number;
  savingPct: number;
  label: typeof GENERIC_LABEL;
}

/** Cheaper generic (priced against Jan Aushadhi) with the same salt and strength. */
export function genericOffer(m: Pick<Medicine, 'mrp' | 'generic'>): GenericOffer | null {
  if (!m.generic || m.generic.price >= m.mrp) return null;
  const saving = Math.round((m.mrp - m.generic.price) * 100) / 100;
  return {
    name: m.generic.name,
    price: m.generic.price,
    saving,
    savingPct: Math.round((saving / m.mrp) * 100),
    label: GENERIC_LABEL,
  };
}
