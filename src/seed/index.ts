import { z } from 'zod';
import { addDays } from '../domain/clock';
import type { Seed } from '../domain/state';
import { BatchSchema, BloodBankSchema, DealerSchema, MedicineSchema, NgoSchema, StoreSchema, UserSchema } from '../domain/types';
import { MEDICINES } from './medicines';
import { BLOOD_BANKS, CBWTF, DEALERS, NGOS, STORES, USERS } from './parties';

/** The demo starts on this simulated date. The presenter can time-travel forward. */
export const DEMO_START = '2026-11-08';

const STORE = 'store-ganesh';
const batch = (id: string, medicineId: string, daysFromStart: number, qty: number, batchNo: string, storeId: string = STORE) =>
  ({
    id,
    storeId,
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
  batch('b-vicks-1', 'med-vicks', 720, 40, 'VR28E03'),
  batch('b-strepsils-1', 'med-strepsils', 540, 60, 'ST28A26'),
  batch('b-liv52-1', 'med-liv52', 680, 30, 'LV28D14'),
  batch('b-revital-1', 'med-revital', 470, 50, 'RV27L19'),
  batch('b-pantocid-1', 'med-pantocid', 600, 60, 'PC28B09'),
  batch('b-montairlc-1', 'med-montairlc', 560, 45, 'ML28A05'),
  batch('b-ecosprin-1', 'med-ecosprin', 640, 150, 'EC28C21'),
  batch('b-zincovit-1', 'med-zincovit', 500, 70, 'ZV27K28'),
  // Pharmacy products: personal care, hygiene, oral care, baby care and first aid.
  batch('b-whisper-1', 'prd-whisper', 900, 40, 'WH29A11'),
  batch('b-stayfree-1', 'prd-stayfree', 880, 50, 'SF29A02'),
  batch('b-neutrogena-2', 'prd-neutrogena-spf', 640, 18, 'NU28C30'),
  batch('b-lakme-1', 'prd-lakme-spf', 560, 24, 'LK28A17'),
  batch('b-minimalist-1', 'prd-minimalist-serum', 600, 20, 'MN28B12'),
  batch('b-dermaco-2', 'prd-dermaco-vitc', 520, 15, 'DC27K25'),
  batch('b-cetaphil-1', 'prd-cetaphil', 700, 20, 'CT28D08'),
  batch('b-himalaya-1', 'prd-himalaya-facewash', 620, 35, 'HM28C02'),
  batch('b-colgate-1', 'prd-colgate-brush', 1500, 60, 'CB30L01'),
  batch('b-oralb-1', 'prd-oralb-brush', 1500, 40, 'OB30L01'),
  batch('b-sensodyne-1', 'prd-sensodyne', 660, 45, 'SD28C27'),
  batch('b-pampers-1', 'prd-pampers', 1000, 25, 'PM29E14'),
  batch('b-dispovan-1', 'prd-dispovan', 1100, 100, 'DV29H20'),
  batch('b-hansaplast-1', 'prd-hansaplast', 1000, 60, 'HP29E30'),
  batch('b-dettol-1', 'prd-dettol', 900, 40, 'DT29A23'),
  batch('b-thermometer-1', 'prd-thermometer', 1460, 15, 'TM30K05'),
];

/** Two skin-care batches nearing expiry, so the 6-month alert shows non-medicines too. */
const NEAR_EXPIRY_PRODUCTS = [
  batch('b-neutrogena-1', 'prd-neutrogena-spf', 150, 12, 'NU26F04'),
  batch('b-dermaco-1', 'prd-dermaco-vitc', 120, 10, 'DC26E19'),
];

const BATCHES = [
  ...FRESH_BATCHES,
  ...NEAR_EXPIRY_PRODUCTS,
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

/**
 * Stock for the five newer stores. Each carries the whole catalogue with more than a year of shelf
 * life, plus two batches inside the 6-month window so its expiry alerts have something to show.
 * Quantities and dates are spread with simple arithmetic, so the seed is the same on every run.
 * Syringes are kept low on purpose: they are the pooled bulk-order example.
 */
const BRANCH_STORES = [
  { id: 'store-surathkal', code: 'SK' },
  { id: 'store-ullal', code: 'UL' },
  { id: 'store-kulshekar', code: 'KS' },
  { id: 'store-kavoor', code: 'KV' },
  { id: 'store-jeppu', code: 'JP' },
] as const;

const BRANCH_BATCHES = BRANCH_STORES.flatMap((store, k) => {
  const key = store.id.replace('store-', '');
  const fresh = MEDICINES.map((m, i) =>
    batch(
      `b-${key}-${m.id}`,
      m.id,
      400 + ((i * 37 + k * 53) % 400),
      m.id === 'prd-dispovan' ? 8 : 20 + ((i * 7 + k * 11) % 60),
      `${store.code}28${String(i + 1).padStart(3, '0')}`,
      store.id,
    ),
  );
  const nearA = MEDICINES[(k * 5 + 3) % 29]!;
  const nearB = MEDICINES[(k * 7 + 11) % 29]!;
  return [
    ...fresh,
    batch(`b-${key}-near-1`, nearA.id, 150 - k * 12, 14 + k * 3, `${store.code}26N01`, store.id),
    batch(`b-${key}-near-2`, nearB.id, 96 - k * 9, 10 + k * 2, `${store.code}26N02`, store.id),
  ];
});

export function validateSeed(seed: Seed): Seed {
  z.array(MedicineSchema).parse(seed.medicines);
  z.array(StoreSchema).parse(seed.stores);
  z.array(NgoSchema).parse(seed.ngos);
  z.array(BloodBankSchema).parse(seed.bloodBanks);
  z.array(DealerSchema).parse(seed.dealers ?? []);
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
  dealers: DEALERS,
  users: USERS,
  batches: [...BATCHES, ...BRANCH_BATCHES],
  wallet: {},
});

export { MEDICINES, STORES, NGOS, BLOOD_BANKS, DEALERS, USERS, CBWTF };
