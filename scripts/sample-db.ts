/**
 * Builds data/pharmaflow-sample.db (SQLite) by running a realistic scenario through the
 * real domain reducer, then prints every table. Run it with: npm run db:sample
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { appendEntry, verifyChain, type LedgerEntry } from '../src/domain/ledger';
import { ecoPrice } from '../src/domain/rules/ecoSale';
import { parseGs1 } from '../src/domain/rules/gs1';
import type { AppState } from '../src/domain/state';
import type { Batch, Order, Prescription } from '../src/domain/types';
import { BARCODE_PRESETS } from '../src/seed/barcodes';
import { ADMIN, CHEMIST, CUSTOMER, RIDER, STORE, Sim } from '../tests/helpers';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dbPath = join(root, 'data', 'pharmaflow-sample.db');

/** A day in the life: scan, time travel, Eco-Sale, Rx order, delivery, donation, disposal, blood, KYC. */
function runScenario(): Sim {
  const sim = new Sim();
  const scan = (preset: number, id: string, qty: number): Batch => {
    const p = parseGs1(BARCODE_PRESETS[preset]!.code);
    if (!p.ok) throw new Error(p.error);
    const med = Object.values(sim.state.medicines).find((m) => m.gtin === p.value.gtin)!;
    const batch: Batch = { id, storeId: STORE, medicineId: med.id, batchNo: p.value.batch!, expiry: p.value.expiry!, qty, status: 'IN_STOCK' };
    sim.must(CHEMIST, { type: 'STOCK_INGESTED', batch });
    return batch;
  };
  const dolo = scan(0, 'b-dolo-demo', 100);
  const aug = scan(1, 'b-aug-demo', 20);

  sim.must(ADMIN, { type: 'KYC_DECIDED', storeId: 'store-carstreet', decision: 'APPROVED' });
  sim.must(ADMIN, { type: 'TIME_TRAVELLED', to: '2027-04-07' });
  sim.must(CHEMIST, { type: 'ECO_SALE_LISTED', batchId: dolo.id, discountPct: 50 });

  const mrp = (id: string) => sim.state.medicines[id]!.mrp;
  const unit = ecoPrice(mrp('med-dolo650'), 50);
  const items = [
    { medicineId: 'med-dolo650', batchId: dolo.id, qty: 2, unitPrice: unit, ecoSale: true },
    { medicineId: 'med-augmentin', batchId: aug.id, qty: 6, unitPrice: mrp('med-augmentin'), ecoSale: false },
  ];
  const order: Order = {
    id: 'ord-1001', customerId: CUSTOMER, storeId: STORE, items, status: 'PLACED', rxStatus: 'PENDING',
    prescriptionId: 'rx-5001', deliveryOtp: '4821', total: 2 * unit + 6 * mrp('med-augmentin'), placedAt: sim.state.today,
  };
  const rx: Prescription = {
    id: 'rx-5001', customerId: CUSTOMER, doctorName: 'Dr. Meera Rao', registrationNo: 'KMC-48213', date: '2027-04-05',
    patientName: 'Asha Shetty', drugs: [{ medicineId: 'med-augmentin', qty: 6 }],
  };
  sim.must(CUSTOMER, { type: 'ORDER_PLACED', order, prescription: rx });
  sim.must(CHEMIST, { type: 'RX_APPROVED', orderId: order.id });
  sim.must(CHEMIST, { type: 'ORDER_PACKED', orderId: order.id });
  sim.must(RIDER, { type: 'RIDER_SHIFT_CHANGED', riderId: RIDER, online: true });
  sim.must(RIDER, { type: 'ORDER_ACCEPTED', orderId: order.id, riderId: RIDER });
  sim.must(RIDER, { type: 'ORDER_ARRIVED', orderId: order.id });
  sim.must(RIDER, { type: 'ORDER_OUT_FOR_DELIVERY', orderId: order.id });
  sim.must(RIDER, { type: 'ORDER_DELIVERED', orderId: order.id, otp: '4821' });
  sim.must(CUSTOMER, { type: 'SCRATCH_CARD_REVEALED', cardId: 'sc-ord-1001' });

  const pickupBase = { sourceUserId: CUSTOMER, address: '12, Kadri Hills, Mangaluru', lat: 12.883, lng: 74.856, scheduledAt: sim.state.today, status: 'SCHEDULED' as const };
  sim.must(CUSTOMER, {
    type: 'PICKUP_SCHEDULED',
    pickup: { ...pickupBase, id: 'pk-2001', kind: 'DONATION', qaStoreId: STORE, ngoId: 'ngo-seva',
      items: [{ medicineId: 'med-dolo650', batchNo: 'DL27A01', expiry: '2027-08-31', qty: 1, sealed: true, openedLiquid: false }] },
  });
  sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'pk-2001', riderId: RIDER });
  sim.must(RIDER, { type: 'PICKUP_ARRIVED', pickupId: 'pk-2001' });
  sim.must(RIDER, { type: 'PICKUP_COLLECTED', pickupId: 'pk-2001' });
  sim.must(CHEMIST, { type: 'PICKUP_QA_VERIFIED', pickupId: 'pk-2001', note: 'Seal intact, batch matches' });
  sim.must(RIDER, { type: 'PICKUP_DELIVERED_TO_NGO', pickupId: 'pk-2001' });

  sim.must(CUSTOMER, {
    type: 'PICKUP_SCHEDULED',
    pickup: { ...pickupBase, id: 'pk-2002', kind: 'DISPOSAL',
      items: [{ medicineId: 'med-becosules', batchNo: 'OLD1', expiry: '2027-01-10', qty: 3, sealed: true, openedLiquid: false }] },
  });
  sim.must(RIDER, { type: 'PICKUP_ACCEPTED', pickupId: 'pk-2002', riderId: RIDER });
  sim.must(RIDER, { type: 'PICKUP_ARRIVED', pickupId: 'pk-2002' });
  sim.must(RIDER, { type: 'PICKUP_COLLECTED', pickupId: 'pk-2002' });
  sim.must(RIDER, { type: 'PICKUP_INCINERATED', pickupId: 'pk-2002' });

  sim.must(CUSTOMER, { type: 'BLOOD_BOOKED', booking: { id: 'bk-3001', userId: CUSTOMER, bloodBankId: 'bb-wenlock', date: '2027-04-10', bloodGroup: 'O-', status: 'BOOKED' } });
  sim.must(ADMIN, { type: 'BLOOD_DONATION_CONFIRMED', bookingId: 'bk-3001' });
  return sim;
}

type Row = Record<string, SQLInputValue>;

function insert(db: DatabaseSync, table: string, rows: Row[]): void {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]!);
  const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
  for (const r of rows) stmt.run(...cols.map((c) => r[c] ?? null));
}

const bool = (b: boolean | undefined) => (b ? 1 : 0);

function writeState(db: DatabaseSync, s: AppState): void {
  insert(db, 'medicines', Object.values(s.medicines).map((m) => ({
    id: m.id, brand: m.brand, salt: m.salt, strength: m.strength, pack_size: m.packSize, manufacturer: m.manufacturer, mrp: m.mrp,
    schedule: m.schedule, is_antibiotic: bool(m.isAntibiotic), cold_chain: bool(m.coldChain), form: m.form, course_days: m.courseDays,
    gtin: m.gtin, generic_name: m.generic?.name ?? null, generic_price: m.generic?.price ?? null,
  })));
  insert(db, 'stores', Object.values(s.stores).map((x) => ({ id: x.id, name: x.name, area: x.area, drug_licence: x.drugLicence, gstin: x.gstin, kyc: x.kyc, lat: x.lat, lng: x.lng })));
  insert(db, 'ngos', Object.values(s.ngos).map((n) => ({ id: n.id, name: n.name, area: n.area, has_registered_professional: bool(n.hasRegisteredProfessional) })));
  insert(db, 'blood_banks', Object.values(s.bloodBanks).map((b) => ({ id: b.id, name: b.name, area: b.area, urgent_groups: b.urgentGroups.join(',') })));
  insert(db, 'users', Object.values(s.users).map((u) => ({
    id: u.id, role: u.role, name: u.name, store_id: u.storeId ?? null, address: u.address ?? null, karma: s.karma[u.id] ?? 0, wallet: s.wallet[u.id] ?? 0,
  })));
  insert(db, 'batches', Object.values(s.batches).map((b) => ({
    id: b.id, store_id: b.storeId, medicine_id: b.medicineId, batch_no: b.batchNo, expiry: b.expiry, qty: b.qty, status: b.status, eco_discount_pct: b.ecoDiscountPct ?? null,
  })));
  insert(db, 'prescriptions', Object.values(s.prescriptions).map((p) => ({
    id: p.id, customer_id: p.customerId, doctor_name: p.doctorName, registration_no: p.registrationNo, rx_date: p.date, patient_name: p.patientName, used_by_order_id: p.usedByOrderId ?? null,
  })));
  insert(db, 'prescription_drugs', Object.values(s.prescriptions).flatMap((p) => p.drugs.map((d) => ({ prescription_id: p.id, medicine_id: d.medicineId, qty: d.qty }))));
  insert(db, 'orders', Object.values(s.orders).map((o) => ({
    id: o.id, customer_id: o.customerId, store_id: o.storeId, status: o.status, rx_status: o.rxStatus, prescription_id: o.prescriptionId ?? null,
    rider_id: o.riderId ?? null, wallet_used: o.walletUsed ?? 0, total: o.total, placed_at: o.placedAt,
  })));
  insert(db, 'order_items', Object.values(s.orders).flatMap((o) => o.items.map((i) => ({
    order_id: o.id, medicine_id: i.medicineId, batch_id: i.batchId ?? null, qty: i.qty, unit_price: i.unitPrice, eco_sale: bool(i.ecoSale),
  }))));
  insert(db, 'pickups', Object.values(s.pickups).map((p) => ({
    id: p.id, kind: p.kind, status: p.status, source_user_id: p.sourceUserId ?? null, source_store_id: p.sourceStoreId ?? null, qa_store_id: p.qaStoreId ?? null,
    ngo_id: p.ngoId ?? null, rider_id: p.riderId ?? null, batch_id: p.batchId ?? null, address: p.address, scheduled_at: p.scheduledAt, qa_note: p.qaNote ?? null,
  })));
  insert(db, 'pickup_items', Object.values(s.pickups).flatMap((p) => p.items.map((i) => ({
    pickup_id: p.id, medicine_id: i.medicineId, batch_no: i.batchNo, expiry: i.expiry, qty: i.qty, sealed: bool(i.sealed),
  }))));
  insert(db, 'h1_register', s.h1Register.map((h) => ({
    id: h.id, order_id: h.orderId, patient_name: h.patientName, doctor_name: h.doctorName, doctor_reg: h.doctorRegNo, medicine_id: h.medicineId, qty: h.qty, sale_date: h.date, retain_until: h.retainUntil,
  })));
  insert(db, 'scratch_cards', Object.values(s.scratchCards).map((c) => ({
    id: c.id, user_id: c.userId, source: c.source, revealed: bool(c.revealed), reward_karma: c.rewardKarma, reward_credit: c.rewardCredit,
  })));
  insert(db, 'certificates', s.certificates.map((c) => ({ id: c.id, kind: c.kind, user_id: c.userId, ref_id: c.refId, issued_on: c.issuedOn, verify_code: c.verifyCode, summary: c.summary })));
  insert(db, 'blood_bookings', Object.values(s.bloodBookings).map((b) => ({
    id: b.id, user_id: b.userId, blood_bank_id: b.bloodBankId, booking_date: b.date, blood_group: b.bloodGroup, status: b.status,
  })));
  insert(db, 'rider_profiles', Object.entries(s.riders).map(([id, r]) => ({ user_id: id, online: bool(r.online), earnings: r.earnings, incentives: r.incentives, trips: r.trips })));
  insert(db, 'meta', [{ key: 'sim_today', value: s.today }, { key: 'schema', value: 'pharmaflow-sample-v1' }]);
}

async function main(): Promise<void> {
  const sim = runScenario();
  const chain: LedgerEntry[] = [];
  for (const e of sim.log) chain.push(await appendEntry(chain, e));
  const verdict = await verifyChain(chain);

  mkdirSync(dirname(dbPath), { recursive: true });
  rmSync(dbPath, { force: true });
  const db = new DatabaseSync(dbPath);
  db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));
  writeState(db, sim.state);
  insert(db, 'events', chain.map((c) => {
    const e = c.event as { id: string; type: string; actorId: string; at: string };
    return { idx: c.index, id: e.id, type: e.type, actor_id: e.actorId, sim_date: e.at, payload: JSON.stringify(c.event), prev_hash: c.prevHash, hash: c.hash };
  }));

  const show = (title: string, sql: string) => {
    console.log(`\n=== ${title} ===`);
    console.table(db.prepare(sql).all());
  };

  console.log(`PharmaFlow sample database written to:\n  ${dbPath}`);
  console.log(`Events: ${chain.length} · hash chain: ${verdict.ok ? 'intact' : 'BROKEN'} · simulated date: ${sim.state.today}`);

  show('Row counts', `SELECT 'medicines' AS tbl, COUNT(*) AS rows FROM medicines UNION ALL SELECT 'stores', COUNT(*) FROM stores UNION ALL SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'batches', COUNT(*) FROM batches UNION ALL SELECT 'orders', COUNT(*) FROM orders UNION ALL SELECT 'pickups', COUNT(*) FROM pickups UNION ALL SELECT 'certificates', COUNT(*) FROM certificates UNION ALL SELECT 'events', COUNT(*) FROM events`);
  show('medicines (first 6)', `SELECT brand, schedule, strength, mrp, generic_price, gtin FROM medicines LIMIT 6`);
  show('stores', `SELECT id, name, kyc, drug_licence FROM stores`);
  show('users', `SELECT id, role, name, karma, wallet FROM users`);
  show('v_expiry_ledger (soonest expiry first)', `SELECT brand, batch_no, expiry, qty, status, days_left, bucket FROM v_expiry_ledger ORDER BY days_left LIMIT 8`);
  show('v_order_summary', `SELECT * FROM v_order_summary`);
  show('prescriptions', `SELECT id, doctor_name, registration_no, rx_date, patient_name, used_by_order_id FROM prescriptions`);
  show('pickups', `SELECT id, kind, status, ngo_id, rider_id, qa_note FROM pickups`);
  show('certificates', `SELECT id, kind, user_id, verify_code, summary FROM certificates`);
  show('rider_profiles', `SELECT * FROM rider_profiles`);
  show('events (hash-chained audit log, first 8)', `SELECT idx, type, actor_id, sim_date, substr(hash, 1, 12) AS hash, substr(prev_hash, 1, 12) AS prev_hash FROM events LIMIT 8`);
  db.close();
  console.log('\nOpen it with any SQLite viewer (e.g. DB Browser for SQLite), or run: npm run db:sample');
}

void main();
