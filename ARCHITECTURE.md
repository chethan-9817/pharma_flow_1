# PharmaFlow Architecture

This document explains how PharmaFlow is put together and why. For the business flows see [WORKFLOW.md](WORKFLOW.md); for the product overview see the [README](README.md).

## Contents

1. [Big picture](#big-picture)
2. [Layers and the one-way dependency rule](#layers-and-the-one-way-dependency-rule)
3. [Event sourcing](#event-sourcing)
4. [What happens when you click a button](#what-happens-when-you-click-a-button)
5. [Real-time sync across tabs](#real-time-sync-across-tabs)
6. [The audit ledger](#the-audit-ledger)
7. [Where each rule lives](#where-each-rule-lives)
8. [State shape](#state-shape)
9. [Simulated clock and time travel](#simulated-clock-and-time-travel)
10. [UI layer](#ui-layer)
11. [Launcher and the pharmaflow command](#launcher-and-the-pharmaflow-command)
12. [Libraries that load on demand](#libraries-that-load-on-demand)
13. [Sample database](#sample-database-and-server-mode)
14. [Server mode](#server-mode)
15. [Languages and the installable app](#languages-and-the-installable-app)
16. [Testing](#testing)
17. [Design decisions and trade-offs](#design-decisions-and-trade-offs)
18. [Known limits](#known-limits)

---

## Big picture

PharmaFlow is a single-page React app. There is **no backend** in demo mode. Every user action becomes an immutable, typed **event**. The current state of the whole platform is `reduce(events)`. The events are stored in the browser (IndexedDB) and shared between open tabs with `BroadcastChannel`. **Server mode** keeps the same events on a server instead (see [Server mode](#server-mode)): same reducer, same screens, different storage and transport.

```mermaid
flowchart TB
    subgraph Browser tab
        UI["Role screens<br/>Customer · Chemist · Rider · Admin"]
        ST["Zustand store<br/>app state + event chain"]
        DOM["Domain<br/>rules · state machines · reducer"]
    end
    UI -->|"dispatch(actor, payload)"| ST
    ST -->|"applyEvent(state, event)"| DOM
    DOM -->|"Result: new state or rule error"| ST
    ST -->|"append hash-chained entry"| IDB[("IndexedDB<br/>Dexie: events table")]
    ST -->|"publish entry"| BC{{"BroadcastChannel<br/>pharmaflow-events"}}
    BC -->|"entry"| OTHER["Other tabs<br/>(own store, same code)"]
    IDB -->|"load on start / resync"| ST
```

Because every tab runs the same pure reducer over the same log, all tabs converge on the same state without a server.

## Layers and the one-way dependency rule

```mermaid
flowchart LR
    domain["src/domain<br/>pure TypeScript"] --> store["src/store<br/>Zustand, Dexie, transport"]
    store --> ui["src/roles · src/components<br/>React"]
    seed["src/seed"] --> domain
    lib["src/lib<br/>OCR, scanner, images"] --> ui
```

| Layer | Folder | May import | Must not |
|---|---|---|---|
| Domain | `src/domain` | Itself, `zod` | Import React, the store, `localStorage`, `Date.now()` or `Math.random()` |
| Seed | `src/seed` | Domain types | Contain logic |
| Store | `src/store` | Domain, Zustand, Dexie | Contain business rules |
| UI | `src/roles`, `src/components` | Domain (selectors, rules for display), store | Decide whether an action is allowed |
| Lib | `src/lib` | Browser APIs, lazily loaded libraries | Touch application state |
| Server | `server` | Domain and seed (it runs the same reducer), Hono, `ws`, `bcryptjs`, `node:sqlite` | Import React or `src/store` |

The rule that matters most: **business rules never live in React components**. A component calls `dispatch(...)`. If the action breaks a rule, the reducer returns an error message and the component only shows it.

## Event sourcing

Every action is a member of the `DomainEvent` union in `src/domain/events.ts`. Each event carries `id`, `at` (the simulated date), `actorId` and a typed payload.

| Family | Events |
|---|---|
| Admin and KYC | `STORE_REGISTERED`, `KYC_DECIDED` |
| Inventory | `STOCK_INGESTED`, `ECO_SALE_LISTED`, `ECO_SALE_WITHDRAWN` |
| Orders | `ORDER_PLACED`, `RX_APPROVED`, `RX_REJECTED`, `RX_RESUBMITTED`, `ORDER_CANCELLED`, `ORDER_PACKED`, `ORDER_ACCEPTED`, `ORDER_ARRIVED`, `ORDER_OUT_FOR_DELIVERY`, `ORDER_DELIVERED` |
| Pickups | `PICKUP_SCHEDULED`, `PICKUP_ACCEPTED`, `PICKUP_ARRIVED`, `PICKUP_COLLECTED`, `PICKUP_QA_VERIFIED`, `PICKUP_QA_REJECTED`, `PICKUP_DELIVERED_TO_NGO`, `PICKUP_INCINERATED` |
| Rewards and civic | `SCRATCH_CARD_REVEALED`, `BLOOD_BOOKED`, `BLOOD_DONATION_CONFIRMED` |
| Riders and presenter | `RIDER_SHIFT_CHANGED`, `TIME_TRAVELLED` |

The reducer (`src/domain/reducer.ts`) exposes two functions:

- `applyEvent(state, event)` returns `{ ok: true, value: newState }` or `{ ok: false, error }`. It never throws.
- `reduce(initialState, events)` replays stored events. Stored events were validated when they were appended, so a failure here means the log was written by incompatible code.

The reducer is a thin `switch` that hands each event to a handler module in `src/domain/handlers/`:

| Module | Handles |
|---|---|
| `inventory.ts` | KYC, stock, Eco-Sale, rider shifts, time travel |
| `orders.ts` | Placing, prescription review, packing, delivery, cancellation |
| `pickups.ts` | Donation and bio-disposal pickups, QA |
| `civic.ts` | Scratch cards and blood donation |
| `payouts.ts` | Rider pay, scratch-card grants, certificates (used by the others) |
| `common.ts` | Role guards (`requireRole`, `requireChemistOf`, `requireApprovedStore`) and small helpers |

## What happens when you click a button

Example: the chemist presses **Put on Eco-Sale**.

```mermaid
sequenceDiagram
    participant C as ChemistPage
    participant S as store.dispatch
    participant R as reducer
    participant D as IndexedDB
    participant B as BroadcastChannel
    participant T as Customer tab

    C->>S: dispatch(chemistId, ECO_SALE_LISTED)
    S->>S: build event (id, simulated date, actor)
    S->>R: applyEvent(state, event)
    alt a rule fails
        R-->>S: error "needs at least 20 days left"
        S-->>C: result.ok = false, toast shows the reason
    else valid
        R-->>S: new state
        S->>S: hash entry = sha256(prevHash + event)
        S->>D: add(entry)
        S->>S: set(state, chain)
        S->>B: publish(entry)
        B-->>T: entry
        T->>T: apply the same event, UI re-renders
    end
```

Nothing is written unless every rule passes, so the log only ever contains valid history.

## Real-time sync across tabs

Each tab has its own store instance (`src/store/index.ts`). Three small interfaces keep the pieces swappable:

| Interface | Demo implementation | Test implementation | Server mode |
|---|---|---|---|
| `EventStorage` | `DexieStorage` (IndexedDB, table `events` keyed by `index`) | `MemoryStorage` | `ServerStorage` (HTTP to the API; SQLite on the server) |
| `Transport` | `BroadcastTransport` (channel `pharmaflow-events`) | `MemoryTransport` on a shared `MemoryBus` | `WebSocketTransport` (pushed by the server) |
| Sessions | `sessionStorage`, per tab (which role a tab shows) | none | the same, plus a JWT per user in `localStorage` and a password check on the server |

How a tab behaves:

1. **Start:** load every entry from storage, replay it with `reduce`, subscribe to the transport.
2. **Local action:** the store runs `dispatch` through a **serial queue**, so two quick clicks in one tab never interleave.
3. **Incoming entry:** if `entry.index` is exactly the next one and its `prevHash` matches the local tail, apply it. If it is older, ignore it. Otherwise **resync** from storage.
4. **Conflict:** if two tabs write entry *N* at the same moment, `storage.append` rejects the second one (the primary key is `index`). That tab resyncs, **validates its event again against the newer state**, and retries up to three times. Example: two tabs both travel to the same date; the second is rejected with "Time can only move forward".
5. **Reset:** clears storage and publishes `{ kind: 'reset' }`. Every tab returns to the seed.

The `/presenter` page embeds each role as an `<iframe src="/role?embed=1">`. Each iframe is a separate document with its own store, so it syncs exactly like a separate browser tab.

## The audit ledger

`src/domain/ledger.ts` wraps events in entries:

```
entry[i] = { index: i, event, prevHash: entry[i-1].hash, hash: sha256(prevHash + canonicalJSON(event)) }
```

- Entry 0 starts from a fixed genesis hash of 64 zeros.
- `canonicalize` sorts object keys and drops `undefined`, so the same event always hashes the same.
- `verifyChain` recomputes every hash. It reports the first broken index and why: index out of sequence, previous hash mismatch, or altered content.
- Hashing uses Web Crypto (`crypto.subtle`), so no dependency is needed.

The Admin portal's **Verify ledger integrity** button calls `verifyChain` on the live chain. The Audit trail list is simply the last ten entries.

## Where each rule lives

All rules are pure functions in `src/domain/rules/`, each with its own unit tests.

| File | Rule |
|---|---|
| `expiry.ts` | SAFE > 180 d, LOCKOUT 30–180, CRITICAL 1–29, EXPIRED ≤ 0 |
| `ecoSale.ts` | 40–60% discount; eligible only if `days_left ≥ course_days + 15`; never expired; never Schedule X; deeper discount closer to expiry |
| `donation.ts` | Sealed, more than 30 days left, not cold-chain, not Schedule X, not an opened liquid; Rx-only drugs only to NGOs with a registered professional |
| `prescription.ts` | Schedule H/H1 need an Rx; required fields; validity 30 days (antibiotics) or 180 days; antibiotic Rx single-use; quantity cap; packing gate; H1 register with 3-year retention; Schedule X blocked |
| `rxText.ts` | Turns OCR text into **suggestions** for the Rx form. OCR never approves anything |
| `generic.ts` | Cheaper generic offer, always labelled "Same salt, same strength" |
| `rewards.ts` | Donation +200 karma and a scratch card; disposal +150; blood +500 with a certificate and badge only; closed-loop wallet; deterministic scratch rewards |
| `gst.ts` | Write-off certificate with the GST ITC reversal (CGST Sec 17(5)(h)); never called 80G |
| `gs1.ts` | Parses GS1 element strings (GTIN, batch, expiry), symbology prefixes and plain EAN barcodes. `parseScan` is used for both camera results and typed barcodes (spaces and hyphens ignored) |
| `sponsor.ts` | "Sponsor batch for NGO": flat ₹99 buys as many packs as it covers at the Eco-Sale price (at least one, at most the batch); store payout and fund top-up always add up to ₹99; only Eco-Sale, OTC, non-cold-chain batches with more than 30 days left |
| `fund.ts` | The NGO fund: a 10% platform fee on delivered orders, of which 2% goes to the fund (demo values, one constant each) |

State machines are in `src/domain/machines/`:

- `order.ts`: `PLACED → [RX_APPROVED] → PACKED → OUT_FOR_DELIVERY → DELIVERED`, plus `CANCELLED` before packing.
- `pickup.ts`: donation `SCHEDULED → COLLECTED → QA_VERIFIED | QA_REJECTED → DELIVERED_TO_NGO | INCINERATED`; disposal `SCHEDULED → COLLECTED → INCINERATED`. Invalid jumps are rejected.

Two modules sit on top of the rules:

- `checkout.ts` quotes a cart (first-expiry-first-out batch picking, Eco-Sale pricing, stock checks) and plans an order.
- `selectors.ts` derives everything the screens show: store inventory with buckets, Eco-Sale listings, impact KPIs, open rider missions and backhaul suggestions.
- `route.ts` turns a rider's active orders and pickups into an ordered list of stops (store or pickup point, customer, chemist QA, NGO, CBWTF), the rider's current position, and distance and ETA at 25 km/h. It is pure and tested; the map only draws what it returns.
- `impact.ts` feeds the admin charts: `impactTimeline` replays the event log and records a point whenever a number changes (including the NGO fund balance), `activityByFamily` counts events by area, and `stockByBucket` sums shelf units by expiry bucket.
- `sponsor.ts` plans a sponsorship (`planSponsorship`). The Deals screen uses it to preview the deal, and the reducer runs it again and compares, so an event cannot claim more packs or a different split than the rules give.

**A sponsorship reuses the pickup machine instead of adding a new one.** `SPONSORSHIP_PLACED` sets packs aside from a store's Eco-Sale batch and creates a donation `Pickup` that starts at the store (`sourceStoreId`, `qaStoreId` = the same store, `sponsorshipId`). From there the normal events carry it: the rider collects, the store's chemist verifies or rejects at the QA desk, the rider hands it to the NGO. Two hooks in `handlers/pickups.ts` finish the money side: `PICKUP_DELIVERED_TO_NGO` calls `sponsorshipDelivered` (store payout settled, change added to the NGO fund, sponsor rewarded), and `PICKUP_QA_REJECTED` calls `sponsorshipRefunded` (the whole ₹99 returns as MedWallet credit). Money only moves on those two events, so a sponsorship that is still on its way has paid nobody. Sponsored packs are a sale, so `storeWriteOffs` skips them.

The reducer **re-checks every rule** even when the UI already checked. For example, `ORDER_PLACED` recomputes prices from the batches, re-validates the prescription and re-checks stock, so a stale or tampered client cannot slip an invalid order into the log.

## State shape

`AppState` (`src/domain/state.ts`) is built from a `Seed` and then changed only by events.

| Group | Fields |
|---|---|
| Clock | `today` |
| Reference data (seed) | `medicines`, `stores`, `ngos`, `bloodBanks`, `users`, `cbwtf` (the incineration plant) |
| Transactions | `batches`, `orders`, `pickups`, `prescriptions`, `h1Register`, `scratchCards`, `bloodBookings`, `sponsorships` |
| Balances | `karma`, `wallet` (per user), `ngoFund` (balance and its entries) |
| Outputs | `certificates`, `riders` (online flag, earnings, incentives, trips) |

Everything is stored as plain records keyed by id, so state is easy to diff, serialise and map to SQL tables.

## Simulated clock and time travel

Domain code never reads the real time. Every rule takes `today` as an ISO date (`YYYY-MM-DD`). `state.today` starts at the seed date (2026-11-08) and moves only through `TIME_TRAVELLED`, which can go **forward only**. That is what lets the presenter jump +5 months and watch batches change bucket live.

Some rules are deliberately re-checked after time passes:

- Eco-Sale listings disappear once `days_left` no longer fits the course.
- A prescription's validity is re-checked when the chemist approves it.
- A donation's shelf life is re-checked at the QA desk.

Going back means **Reset demo data**, which clears the log.

## UI layer

| Piece | Purpose |
|---|---|
| `PresenterBar` | Role switch, time-travel slider and jump buttons, language picker, reset |
| `RoleGate` | 1-tap demo login per role (a password form, `ServerLogin`, in server mode); sessions are per tab |
| `toast` | Shows rule errors and confirmations |
| `ui.tsx` | Button, Card, Badge, Stat primitives with the design tokens |
| `roles/customer` | Shop, Deals, Cart, Orders (live tracker, scratch cards) and Civic hub tabs. Cart state is local to the tab (not part of the event log) |
| `roles/chemist` | Dashboard: expiry ledger, **Add inventory** (scan, type or choose medicine), packing desk, QA desk (sponsored packs are marked), **Sponsored for NGOs** (what the store is paid and what is on the way) |
| `roles/rider` | Dark mission radar with large lifecycle buttons, plus the navigation panel and map |
| `roles/admin` | KYC queue, KPI cards, three charts (the money chart has an NGO fund line), the NGO fund card, blood donation confirmations, audit trail |

**Two layouts, one codebase.** `components/layout.ts` exports `useEmbedded()`, which is true for `?embed=1`, the URL each pane of the `/presenter` page loads. A role opened on its own gets the wide **laptop layout** (customer sidebar, rider missions beside a large map). Embedded panes keep the compact **phone-style** layout so four fit side by side. Inside a layout, content adapts to the width it is actually given using Tailwind container queries (`@container`, `@2xl:`, `@3xl:`), so the same Shop, Cart or Civic components are one column in a phone frame and two or three on a laptop.

Styling is Tailwind CSS v4 with design tokens in `src/index.css` (medical blue, emerald, amber, crimson). Framer Motion is used for short, subtle transitions only.

## Launcher and the pharmaflow command

`pharmaflow` is a small Windows command that starts and stops the app without a terminal window left open.

```mermaid
flowchart LR
    A["pharmaflow (any folder)"] --> B["pharmaflow.cmd<br/>maps the word to a switch"]
    B --> C["run.ps1<br/>bypasses the execution policy"]
    C -->|"already up?"| D["open the browser only"]
    C -->|"no"| E["cmd /c node vite.js > data/dev-server.log"]
    E --> F["hidden Vite dev server on :5173"]
    C --> G["poll http://localhost:5173 until PharmaFlow answers"]
    G --> H["open /presenter in the browser"]
```

Details that were learned the hard way and are worth keeping:

- **"Is it running?" is an HTTP check**, not a port check. On this setup Vite listens on IPv6 only (`[::1]`), and `netstat` and `Get-NetTCPConnection` report that listener unreliably. The launcher asks `http://localhost:5173/` and looks for "PharmaFlow" in the page.
- **`stop` finds the process by command line**, and only touches `node.exe` processes whose command line contains this project's folder and `vite --port 5173`. It never kills a program that merely uses the same port.
- **The server is started through `cmd /c ... > log 2>&1`** instead of `Start-Process -RedirectStandardOutput`. That way the hidden server inherits none of the launcher's handles, so the terminal (or any pipe reading it) is released immediately.
- `scripts/install-command.ps1` adds the project folder to the **user** Path only (no administrator rights), keeps existing entries untouched, and `-Remove` takes it out again.
- `Start PharmaFlow.cmd` is the double-click version and keeps its window open only if something fails.

## Libraries that load on demand

Heavy libraries are imported dynamically, so they cost nothing until used:

| Library | File | Loaded when | Network |
|---|---|---|---|
| **ZXing** (`@zxing/browser`) | `src/lib/scanner.ts` | The chemist opens the camera scanner | None. Needs the camera and a secure context (`localhost` or HTTPS) |
| **Leaflet** (`leaflet`, `react-leaflet` v4) | `src/roles/rider/RouteMap.tsx` | A rider has a route to show (its own lazy chunk of about 150 kB) | Street tiles come from the free OpenStreetMap servers. Offline, or after repeated tile errors, `RouteMapSvg` takes over |
| **jsPDF** | `src/lib/certificatePdf.ts` | The user presses a PDF button | None. Certificates and write-off receipts are built in the browser (amounts are written "Rs." because jsPDF's built-in fonts cannot draw the rupee sign) |
| **Recharts** | `src/roles/admin/AdminCharts.tsx` | The admin portal opens (its own lazy chunk) | None |
| **canvas-confetti** | `src/lib/confetti.ts` | A scratch card is revealed | None. Skipped when the user prefers reduced motion |
| **Tesseract.js** | `src/lib/ocr.ts` | The customer presses "Read with OCR" | Downloads about 10 MB of English language data on first use, then the browser caches it |

The map darkens OpenStreetMap tiles with a CSS filter (`.pf-dark-tiles`) because CARTO's dark basemap now answers with an "API KEY REQUIRED" watermark, and the project must work with no keys. The rider's moving dot is a local animation (`useRiderPosition`) and is never written to the event log.

All three fail gracefully: the scanner dialog explains camera problems and offers typing the barcode (or a preset), the map falls back to a route diagram, and the Rx form falls back to typing. Prescription photos are shrunk (`src/lib/image.ts`) before they enter the event log.

## Sample database and server mode

`npm run db:sample` (`scripts/sample-db.ts`) runs a scripted day through the real reducer and writes `data/pharmaflow-sample.db` using Node's built-in `node:sqlite`. `scripts/schema.sql` defines the tables.

| SQL table | Comes from |
|---|---|
| `medicines`, `stores`, `ngos`, `blood_banks`, `users` | Seed / reference data |
| `batches`, `orders` + `order_items`, `pickups` + `pickup_items`, `prescriptions` + `prescription_drugs`, `h1_register`, `scratch_cards`, `certificates`, `blood_bookings`, `rider_profiles`, `sponsorships`, `ngo_fund_entries` | `AppState` after replay |
| `events` | The hash-chained log (`idx`, `type`, `actor_id`, `sim_date`, `payload` JSON, `prev_hash`, `hash`) |

The `events` table is the source of truth; every other table is a projection of it. The views `v_expiry_ledger`, `v_order_summary` and `v_ngo_fund` show how reporting queries become plain SQL. The scenario includes a sponsorship, so the sample shows the store payout and the fund entry.

The server's `events` table has the same columns as `scripts/schema.sql`, so the sample database is a faithful preview of what the server stores.

## Server mode

`npm run server` (or `pharmaflow server`) starts `server/index.ts`. It serves the API, the WebSocket and, if `npm run build:server` has been run, the app itself, on one port (8787).

```mermaid
flowchart LR
    B1["Browser A<br/>store + reducer"] -->|"POST /api/events (JWT)"| API["Hono API"]
    B2["Browser B<br/>store + reducer"] -->|"POST /api/events (JWT)"| API
    API -->|"same reducer: applyEvent"| LOG["EventLog<br/>state + hash chain"]
    LOG -->|"INSERT"| DB[("SQLite<br/>data/pharmaflow.db")]
    API -->|"broadcast entry"| HUB["Hub"]
    HUB -->|"WebSocket /ws"| B1
    HUB -->|"WebSocket /ws"| B2
```

| File | Job |
|---|---|
| `server/app.ts` | The Hono app: login, events, reset, certificate check, health, secure headers, body limit. It is a plain object, so tests call `app.request(...)` with no port |
| `server/log.ts` | `EventLog`: the server's hash chain and its `AppState`. `append` runs one at a time and checks, in order: shape, the actor is the signed-in user (403), the entry is the next link (409), the hash matches the event (422), the reducer accepts it (422), then it is stored. On start it replays and verifies everything stored, and refuses to run on a damaged or no-longer-valid log |
| `server/auth.ts` | bcrypt hashing (cost 10), JWT signing (HS256, 12 hours), the signing key kept in `meta`, a login rate limiter |
| `server/ws.ts`, `server/hub.ts` | WebSocket at `/ws`. The first message must be `{type:"auth", token}` (a token in the address would end up in logs). Connections that skip it are closed after 5 s. `Hub.broadcast` pushes each stored entry to every signed-in connection |
| `server/db.ts` | Opens SQLite with Node's built-in `node:sqlite` and creates `events`, `credentials` and `meta` |

**The browser side** (`src/store/server/`) is three small classes behind the interfaces the store already had:

- `ServerStorage` implements `EventStorage`. `append` posts the entry. A `409` is thrown as a plain error, which the store already treats as "another writer won": it re-syncs and tries again, exactly as with two tabs. A refusal for any other reason is a `StorageRejected` carrying the server's message, which the store returns as a normal rule error.
- `WebSocketTransport` implements `Transport`. `publish` does nothing, because the server tells everyone, the writer included (a browser ignores an entry it already has). After every connection the store is asked to `resync`, so nothing is missed while it was down. It reconnects with a back-off.
- `BrowserTokens` keeps one JWT per user in `localStorage`, shared by every tab and pane of that browser, so the presenter bar can move time once the admin has signed in anywhere. Which role a tab shows is still per tab (`sessionStorage`).

The build chooses the mode: `vite build --mode server` (`npm run build:server`, output `dist-server/`) sets `SERVER_MODE`, and `src/store/index.ts` picks `ServerStorage` and `WebSocketTransport` instead of Dexie and BroadcastChannel. In server mode `RoleGate` shows a password form (`ServerLogin`), and `/verify` asks `GET /api/verify/:code`.

**Security decisions worth knowing**

- The reducer is the authority on rules, so the server never trusts a client: it re-runs it. A customer's browser cannot list stock, confirm a donation or act as another user, whatever it sends. This also made one rule explicit in the domain: `TIME_TRAVELLED` requires an admin.
- Login tokens are sent as `Authorization: Bearer`, because one browser holds several users at once. The HttpOnly cookie that `/api/login` also sets is a convenience for plain requests, and a change authenticated only by that cookie must carry a same-site `Origin`.
- Failed logins are counted per user (the server often sits behind a proxy, where every address looks alike), so a burst of wrong passwords locks that user out for a minute.
- WebSocket connections must come from this site (`Origin` equals `Host`) and must sign in with a token.
- The demo password is shown on the login screen only while the server still has the built-in one (`/api/health` reports it).

## Languages and the installable app

**i18n.** `react-i18next` with the three languages bundled as JSON (`src/i18n/en.json`, `kn.json`, `hi.json`), so there is no loading flash. The choice is in `localStorage`; a `storage` listener makes the "All 4" iframes and other tabs follow it live. The browser's own language is deliberately not used, so a demo always starts in English. Plurals use `_one` / `_other` keys, and text with bold parts uses `<Trans>`. The domain layer stays language-free, so a rule's error message (for example "needs more than 30 days of shelf life") is English everywhere. `tests/i18n.test.ts` compares the three files (keys, placeholders, empty text, plural pairs) and scans the source, so a key a screen asks for but is missing, or a key nothing uses, fails the build.

**PWA.** `vite-plugin-pwa` generates a Workbox service worker only for `vite build`. It precaches the app shell and answers every navigation with `index.html`, except `/api` and `/ws`, which always go to the network. Rider map tiles and fonts are cached at runtime. Icons come from `scripts/make-icons.mjs`, which draws them with no image library.

## Testing

Vitest runs 275 tests in 24 files, in about two seconds.

| Area | What is covered |
|---|---|
| Rules | Every boundary: 180/30/1-day buckets, 40–60% discounts, course buffer, donation exclusions, Rx validity and single-use, GS1 parsing, rewards, GST, the sponsor and NGO fund rules |
| State machines | Allowed and rejected transitions for orders and pickups |
| Reducer | KYC, stock, Eco-Sale, orders, prescription review, H1 register, donations, disposal, blood, time travel (admin only), sponsorships (success, tampering, refund) |
| Checkout | Cart quoting, batch splitting, order planning |
| Store | Cross-tab sync, simultaneous writes, reset, restore, ledger tamper detection (two stores on a shared in-memory log and bus) |
| Server | Logins, the event API (every status code), restart and tamper detection, certificate check, security checks, and a real HTTP server with real WebSocket clients |
| Server client | Two stores on a real server: live sync, simultaneous writes, signed-out loading, ended sessions, reset, reconnecting, an unreachable server |
| Translations | Same keys and placeholders in all three languages, no unused or missing keys |
| Walkthrough | `tests/walkthrough.test.ts` runs the full demo walkthrough (see [WORKFLOW.md](WORKFLOW.md#demo-script)) headlessly |

**Playwright** (14 tests, in your installed Chrome) drives the real UI:

| Command | Covers |
|---|---|
| `npm run test:e2e` | The walkthrough across four tabs, a prescription order, the sponsor flow (success, QA refund, Rx blocked), and switching languages |
| `npm run test:e2e:pwa` | Builds the app; checks the manifest, icons, installability and that pages and data work offline |
| `npm run test:e2e:server` | Builds the server version, starts the real server, and uses **separate browser contexts**, which share no storage, so staying in sync proves it is the server doing it |

Playwright tabs are throttled when in the background, so the tests bring a tab to the front before using it.

## Design decisions and trade-offs

| Decision | Why | Cost |
|---|---|---|
| Event sourcing | Audit trail, KPIs, time travel and sync fall out of one log | State is rebuilt by replay; a rule change can invalidate old logs (the store then resets safely) |
| Pure domain, no `Date.now()` | Deterministic tests and demo time travel | Everything must pass `today` explicitly |
| Reducer re-validates everything | UI is never trusted | Some checks run twice |
| Two swappable interfaces (storage, transport) | Same code for demo and server mode | A little indirection |
| `Result` values instead of exceptions | Rule failures are normal and carry a user-facing message | Call sites must check `ok` |
| BroadcastChannel + IndexedDB | Zero setup, no accounts, no cloud | Works only on one browser profile |
| Dynamic imports for OCR and camera | Fast first load | A first-use delay for OCR |

## Known limits

- **Demo trust model.** In the default demo, roles are chosen with 1-tap logins and the reducer checks the `actorId` it is given. Server mode authenticates users and runs the same reducer on the server, but it is demo-grade: fixed users with a shared demo password, no registration or password reset, and every signed-in user can read the whole log (prescriptions included).
- **One browser profile in demo mode.** Tabs sync only within the same browser profile and origin. Server mode has no such limit.
- **Translations are partial.** Kannada and Hindi cover the main screens; Add inventory, the scanner, the prescription form, the rider's map panel, PDFs and rule messages are English. They also have not been reviewed by a native speaker.
- **Drug schedules are demo data.** Check them against the latest CDSCO and Drugs & Cosmetics Rules before any real use.
- **GST and costs are assumptions.** The write-off certificate uses a 12% default rate and a cost of 70% of MRP, both configurable.
- **Map tiles use the public OpenStreetMap servers.** That is fine for a demo and light use. A production app should use its own tile provider or host tiles itself, following the OSM tile usage policy.
- **Certificate verification in demo mode checks only the browser's own log.** In server mode `/verify` asks the server, so it works for anyone.
- **The NGO fund can only grow for now.** Sponsor change and the platform share go in, but nothing spends it yet. Using it for bulk, discounted medicines through distributors is designed (see TODO.md) but not built, and it needs an NGO login and a needs list first.
- **The platform fee is a demo number.** There is no real revenue model: a 10% fee on delivered orders is assumed so the NGO share has something to be a share of. Holding real donated money also needs a registered trust or partner NGO.
- **The rider position is simulated.** There is no GPS: the dot glides between stops for display only.
- **Camera needs a secure context.** Use `http://localhost`, not a LAN IP over plain HTTP.
- **Prescription OCR is a suggestion engine.** A pharmacist always makes the final decision.
