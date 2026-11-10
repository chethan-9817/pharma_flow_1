-- PharmaFlow sample database (preview of the planned server-mode SQLite schema).
-- Demo mode keeps the same data as an event log in IndexedDB; this file shows it as tables.

PRAGMA foreign_keys = ON;

CREATE TABLE medicines (
  id            TEXT PRIMARY KEY,
  brand         TEXT NOT NULL,
  salt          TEXT NOT NULL,
  strength      TEXT NOT NULL,
  pack_size     TEXT NOT NULL,
  manufacturer  TEXT NOT NULL,
  mrp           REAL NOT NULL CHECK (mrp >= 0),
  schedule      TEXT NOT NULL CHECK (schedule IN ('OTC','H','H1','X')),
  is_antibiotic INTEGER NOT NULL,
  cold_chain    INTEGER NOT NULL,
  form          TEXT NOT NULL,
  course_days   INTEGER NOT NULL,
  gtin          TEXT NOT NULL UNIQUE,
  generic_name  TEXT,
  generic_price REAL
);

CREATE TABLE stores (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  area         TEXT NOT NULL,
  drug_licence TEXT NOT NULL,
  gstin        TEXT NOT NULL,
  kyc          TEXT NOT NULL CHECK (kyc IN ('PENDING_KYC','APPROVED','REJECTED')),
  lat          REAL NOT NULL,
  lng          REAL NOT NULL
);

CREATE TABLE ngos (
  id                           TEXT PRIMARY KEY,
  name                         TEXT NOT NULL,
  area                         TEXT NOT NULL,
  has_registered_professional  INTEGER NOT NULL
);

CREATE TABLE blood_banks (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  area          TEXT NOT NULL,
  urgent_groups TEXT NOT NULL
);

CREATE TABLE users (
  id       TEXT PRIMARY KEY,
  role     TEXT NOT NULL CHECK (role IN ('customer','chemist','rider','admin','dealer')),
  name     TEXT NOT NULL,
  store_id TEXT REFERENCES stores(id),
  address  TEXT,
  karma    INTEGER NOT NULL DEFAULT 0,
  wallet   REAL NOT NULL DEFAULT 0
);

CREATE TABLE batches (
  id               TEXT PRIMARY KEY,
  store_id         TEXT NOT NULL REFERENCES stores(id),
  medicine_id      TEXT NOT NULL REFERENCES medicines(id),
  batch_no         TEXT NOT NULL,
  expiry           TEXT NOT NULL,
  qty              INTEGER NOT NULL CHECK (qty >= 0),
  status           TEXT NOT NULL,
  eco_discount_pct REAL
);

CREATE TABLE prescriptions (
  id               TEXT PRIMARY KEY,
  customer_id      TEXT NOT NULL REFERENCES users(id),
  doctor_name      TEXT NOT NULL,
  registration_no  TEXT NOT NULL,
  rx_date          TEXT NOT NULL,
  patient_name     TEXT NOT NULL,
  used_by_order_id TEXT
);

CREATE TABLE prescription_drugs (
  prescription_id TEXT NOT NULL REFERENCES prescriptions(id),
  medicine_id     TEXT NOT NULL REFERENCES medicines(id),
  qty             INTEGER NOT NULL,
  PRIMARY KEY (prescription_id, medicine_id)
);

CREATE TABLE orders (
  id              TEXT PRIMARY KEY,
  customer_id     TEXT NOT NULL REFERENCES users(id),
  store_id        TEXT NOT NULL REFERENCES stores(id),
  status          TEXT NOT NULL,
  rx_status       TEXT NOT NULL,
  prescription_id TEXT REFERENCES prescriptions(id),
  rider_id        TEXT REFERENCES users(id),
  wallet_used     REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL,
  placed_at       TEXT NOT NULL
);

CREATE TABLE order_items (
  order_id    TEXT NOT NULL REFERENCES orders(id),
  medicine_id TEXT NOT NULL REFERENCES medicines(id),
  batch_id    TEXT REFERENCES batches(id),
  qty         INTEGER NOT NULL,
  unit_price  REAL NOT NULL,
  eco_sale    INTEGER NOT NULL
);

CREATE TABLE pickups (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('DONATION','DISPOSAL')),
  status          TEXT NOT NULL,
  source_user_id  TEXT REFERENCES users(id),
  source_store_id TEXT REFERENCES stores(id),
  qa_store_id     TEXT REFERENCES stores(id),
  ngo_id          TEXT REFERENCES ngos(id),
  rider_id        TEXT REFERENCES users(id),
  batch_id        TEXT REFERENCES batches(id),
  sponsorship_id  TEXT,  -- set when a customer sponsored the packs; the pickup then starts at the store
  address         TEXT NOT NULL,
  scheduled_at    TEXT NOT NULL,
  qa_note         TEXT
);

CREATE TABLE pickup_items (
  pickup_id   TEXT NOT NULL REFERENCES pickups(id),
  medicine_id TEXT NOT NULL REFERENCES medicines(id),
  batch_no    TEXT NOT NULL,
  expiry      TEXT NOT NULL,
  qty         INTEGER NOT NULL,
  sealed      INTEGER NOT NULL
);

-- "Sponsor batch for NGO": a customer pays a flat amount, packs leave a store's Eco-Sale batch for an NGO,
-- the store is paid the Eco-Sale price on delivery and the change tops up the NGO fund.
CREATE TABLE sponsorships (
  id           TEXT PRIMARY KEY,
  customer_id  TEXT NOT NULL REFERENCES users(id),
  store_id     TEXT NOT NULL REFERENCES stores(id),
  batch_id     TEXT NOT NULL REFERENCES batches(id),
  medicine_id  TEXT NOT NULL REFERENCES medicines(id),
  ngo_id       TEXT NOT NULL REFERENCES ngos(id),
  qty          INTEGER NOT NULL CHECK (qty > 0),
  unit_price   REAL NOT NULL,
  amount       REAL NOT NULL,
  store_payout REAL NOT NULL,
  fund_top_up  REAL NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('PLACED','DELIVERED','REFUNDED')),
  pickup_id    TEXT NOT NULL REFERENCES pickups(id),
  placed_at    TEXT NOT NULL
);

-- Money set aside for medicines for NGOs. It is never paid out as cash.
CREATE TABLE ngo_fund_entries (
  id      TEXT PRIMARY KEY,
  kind    TEXT NOT NULL CHECK (kind IN ('PLATFORM_SHARE','SPONSOR_CHANGE')),
  amount  REAL NOT NULL CHECK (amount > 0),
  ref_id  TEXT NOT NULL,  -- the order or sponsorship that put the money in
  entry_date TEXT NOT NULL
);

CREATE TABLE h1_register (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL REFERENCES orders(id),
  patient_name TEXT NOT NULL,
  doctor_name  TEXT NOT NULL,
  doctor_reg   TEXT NOT NULL,
  medicine_id  TEXT NOT NULL REFERENCES medicines(id),
  qty          INTEGER NOT NULL,
  sale_date    TEXT NOT NULL,
  retain_until TEXT NOT NULL
);

CREATE TABLE scratch_cards (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  source        TEXT NOT NULL,
  revealed      INTEGER NOT NULL,
  reward_karma  INTEGER NOT NULL,
  reward_credit REAL NOT NULL
);

CREATE TABLE certificates (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id),
  ref_id      TEXT NOT NULL,
  issued_on   TEXT NOT NULL,
  verify_code TEXT NOT NULL,
  summary     TEXT NOT NULL
);

CREATE TABLE blood_bookings (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  blood_bank_id TEXT NOT NULL REFERENCES blood_banks(id),
  booking_date  TEXT NOT NULL,
  blood_group   TEXT NOT NULL,
  status        TEXT NOT NULL
);

CREATE TABLE rider_profiles (
  user_id    TEXT PRIMARY KEY REFERENCES users(id),
  online     INTEGER NOT NULL,
  earnings   REAL NOT NULL,
  incentives REAL NOT NULL,
  trips      INTEGER NOT NULL
);

-- The source of truth in PharmaFlow: every action is an immutable event,
-- chained with sha256(prev_hash + payload). All tables above are views of this log.
CREATE TABLE events (
  idx       INTEGER PRIMARY KEY,
  id        TEXT NOT NULL UNIQUE,
  type      TEXT NOT NULL,
  actor_id  TEXT NOT NULL,
  sim_date  TEXT NOT NULL,
  payload   TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash      TEXT NOT NULL UNIQUE
);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- Handy views for browsing the sample
CREATE VIEW v_expiry_ledger AS
SELECT s.name AS store, m.brand, b.batch_no, b.expiry, b.qty, b.status,
       CAST(julianday(b.expiry) - julianday((SELECT value FROM meta WHERE key = 'sim_today')) AS INTEGER) AS days_left,
       CASE
         WHEN julianday(b.expiry) - julianday((SELECT value FROM meta WHERE key = 'sim_today')) <= 0   THEN 'EXPIRED'
         WHEN julianday(b.expiry) - julianday((SELECT value FROM meta WHERE key = 'sim_today')) < 30   THEN 'CRITICAL'
         WHEN julianday(b.expiry) - julianday((SELECT value FROM meta WHERE key = 'sim_today')) <= 180 THEN 'LOCKOUT'
         ELSE 'SAFE'
       END AS bucket
FROM batches b
JOIN medicines m ON m.id = b.medicine_id
JOIN stores s ON s.id = b.store_id;

CREATE VIEW v_ngo_fund AS
SELECT kind, COUNT(*) AS entries, ROUND(SUM(amount), 2) AS total
FROM ngo_fund_entries
GROUP BY kind;

CREATE VIEW v_order_summary AS
SELECT o.id, u.name AS customer, o.status, o.rx_status, o.total,
       group_concat(m.brand || ' x' || i.qty, ', ') AS items
FROM orders o
JOIN users u ON u.id = o.customer_id
JOIN order_items i ON i.order_id = o.id
JOIN medicines m ON m.id = i.medicine_id
GROUP BY o.id;
