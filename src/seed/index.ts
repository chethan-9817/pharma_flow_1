import { z } from 'zod';
import { addDays } from '../domain/clock';
import type { Seed } from '../domain/state';
import { BatchSchema, BloodBankSchema, MedicineSchema, NgoSchema, StoreSchema, UserSchema } from '../domain/types';
import { MEDICINES } from './medicines';
import { BLOOD_BANKS, CBWTF, NGOS, STORES, USERS } from './parties';

/** The demo starts on this simulated date. The presenter can time-travel forward. */
export const DEMO_START = '2026-11-08';

const STORE = 'store-ganesh';
const batch = (id: string, medicineId: string, daysFromStart: number, qty: number, batchNo: string) =>
  ({
    id,
    storeId: STORE,
    medicineId,
    batchNo,
    expiry: addDays(DEMO_START, daysFromStart),
    qty,
    status: 'IN_STOCK' as const,
  });

/**
 * Starting stock covers every expiry bucket so each action has something to show:
 * SAFE (Dolo, Shelcal), LOCKOUT (Augmentin, Pan-D, Azithral), CRITICAL (Limcee),
 * EXPIRED (Becosules) and a 38-day Okacet batch for the Eco-Sale example.
 */
const BATCHES = [
  batch('b-dolo-1', 'med-dolo650', 330, 120, 'DL26K01'),
  batch('b-shelcal-1', 'med-shelcal500', 295, 50, 'SH26J11'),
  batch('b-electral-1', 'med-electral', 200, 80, 'EL26H05'),
  batch('b-volini-1', 'med-volini', 234, 25, 'VO26G02'),
  batch('b-accuchek-1', 'med-accuchek', 112, 12, 'AC26F09'),
  batch('b-benadryl-1', 'med-benadryl', 173, 20, 'BE26E14'),
  batch('b-augmentin-1', 'med-augmentin', 143, 40, 'AU26D07'),
  batch('b-pand-1', 'med-pand', 84, 30, 'PD26C21'),
  batch('b-azithral-1', 'med-azithral500', 112, 20, 'AZ26B03'),
  batch('b-okacet-1', 'med-okacet', 38, 60, 'OK26A18'),
  batch('b-limcee-1', 'med-limcee', 22, 25, 'LM25L30'),
  batch('b-becosules-1', 'med-becosules', -7, 18, 'BC25K12'),
];

export function validateSeed(seed: Seed): Seed {
  z.array(MedicineSchema).parse(seed.medicines);
  z.array(StoreSchema).parse(seed.stores);
  z.array(NgoSchema).parse(seed.ngos);
  z.array(BloodBankSchema).parse(seed.bloodBanks);
  z.array(UserSchema).parse(seed.users);
  z.array(BatchSchema).parse(seed.batches);
  return seed;
}

export const SEED: Seed = validateSeed({
  today: DEMO_START,
  cbwtf: CBWTF,
  medicines: MEDICINES,
  stores: STORES,
  ngos: NGOS,
  bloodBanks: BLOOD_BANKS,
  users: USERS,
  batches: BATCHES,
  wallet: {},
});

export { MEDICINES, STORES, NGOS, BLOOD_BANKS, USERS, CBWTF };
