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
 * Starting stock. The older batches cover every expiry bucket so each action has something to show:
 * SAFE (Dolo, Shelcal), within 6 months of expiry (Augmentin, Pan-D, Azithral), CRITICAL (Limcee),
 * EXPIRED (Becosules) and a 38-day Okacet batch for the Eco-Sale example.
 * Like a real shop, every medicine also has a fresh batch with one to two years left, so the shop
 * never runs dry when an old batch goes on Eco-Sale, is donated or expires.
 */
const FRESH_BATCHES = [
  batch('b-dolo-2', 'med-dolo650', 620, 200, 'DL28C04'),
  batch('b-augmentin-2', 'med-augmentin', 540, 60, 'AU28A12'),
  batch('b-pand-2', 'med-pand', 600, 45, 'PD28B19'),
  batch('b-okacet-2', 'med-okacet', 700, 90, 'OK28D02'),
  batch('b-azithral-2', 'med-azithral500', 480, 30, 'AZ27L08'),
  batch('b-shelcal-2', 'med-shelcal500', 650, 40, 'SH28C15'),
  batch('b-becosules-2', 'med-becosules', 560, 60, 'BC28A07'),
  batch('b-benadryl-2', 'med-benadryl', 520, 24, 'BE27K21'),
  batch('b-electral-2', 'med-electral', 690, 150, 'EL28D11'),
  batch('b-volini-2', 'med-volini', 610, 30, 'VO28B05'),
  batch('b-limcee-2', 'med-limcee', 450, 60, 'LM27J16'),
  batch('b-accuchek-2', 'med-accuchek', 500, 10, 'AC27K30'),
  batch('b-crocin-1', 'med-crocin', 640, 180, 'CR28C09'),
  batch('b-allegra-1', 'med-allegra', 560, 35, 'AL28A23'),
  batch('b-glycomet-1', 'med-glycomet', 600, 120, 'GL28B14'),
  batch('b-telma40-1', 'med-telma40', 580, 60, 'TE28A30'),
  batch('b-thyronorm-1', 'med-thyronorm', 420, 25, 'TH27I18'),
  batch('b-digene-1', 'med-digene', 660, 70, 'DG28C27'),
  batch('b-betadine-1', 'med-betadine', 700, 30, 'BT28D06'),
  batch('b-cifran-1', 'med-cifran', 510, 40, 'CF27K13'),
  batch('b-calpol-1', 'med-calpol', 400, 35, 'CP27H22'),
  batch('b-omez-1', 'med-omez', 590, 80, 'OM28B01'),
];

const BATCHES = [
  ...FRESH_BATCHES,
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
