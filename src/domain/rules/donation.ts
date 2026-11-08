import { daysLeft, type IsoDate } from '../clock';
import { fail, ok, type Check } from '../result';
import type { Medicine, Ngo, PickupItem } from '../types';

/** A donated medicine must have strictly more than this many days left. */
export const DONATION_MIN_DAYS_LEFT = 30;

export function isRxOnly(medicine: Pick<Medicine, 'schedule'>): boolean {
  return medicine.schedule === 'H' || medicine.schedule === 'H1';
}

/** Rx-only drugs may only go to NGOs with a registered doctor or pharmacist on site. */
export function checkNgoCanReceive(
  medicine: Pick<Medicine, 'schedule'>,
  ngo: Pick<Ngo, 'hasRegisteredProfessional' | 'name'>,
): Check {
  if (isRxOnly(medicine) && !ngo.hasRegisteredProfessional) {
    return fail(`${ngo.name} has no registered doctor or pharmacist, so it cannot receive prescription-only drugs`);
  }
  return ok;
}

/** Sealed, > 30 days left, not cold-chain, not Schedule X, not an opened liquid. */
export function checkDonationEligible(
  medicine: Pick<Medicine, 'schedule' | 'coldChain' | 'form'>,
  item: Pick<PickupItem, 'expiry' | 'sealed' | 'openedLiquid'>,
  today: IsoDate,
): Check {
  if (medicine.schedule === 'X') return fail('Schedule X / NDPS drugs cannot be donated');
  if (medicine.coldChain) return fail('Cold-chain medicines (e.g. insulin) cannot be donated');
  if (!item.sealed) return fail('Only sealed, unopened strips can be donated');
  if (item.openedLiquid) return fail('Opened liquids cannot be donated');
  const left = daysLeft(item.expiry, today);
  if (left <= DONATION_MIN_DAYS_LEFT) {
    return fail(`Needs more than ${DONATION_MIN_DAYS_LEFT} days of shelf life; only ${left} remain`);
  }
  return ok;
}

/** Donated medicines must pass chemist QA; rejected items go to bio-disposal. */
export function routeAfterQa(passed: boolean): 'DELIVERED_TO_NGO' | 'INCINERATED' {
  return passed ? 'DELIVERED_TO_NGO' : 'INCINERATED';
}
