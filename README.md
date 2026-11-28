# PharmaFlow

**A shared platform for pharmacy inventory, near-expiry sales, medicine returns, and pooled purchasing.**

PharmaFlow is an academic prototype built around a pilot scenario in **Mangaluru, Karnataka**. It connects customers, medical stores, delivery riders, dealers, and administrators in one workflow.

## The problem

Pharmacies need to manage stock before it expires, customers need a convenient way to return unused medicines, and small stores often buy supplies separately. These disconnected workflows make it harder to track inventory, coordinate returns, and compare bulk purchasing offers.

## What we are building

- **Expiry-aware inventory:** track batches and identify stock approaching expiry.
- **Eco-Sale:** offer near-expiry stock at discounted prices through the customer storefront.
- **Medicine returns:** coordinate donation and disposal requests, pickup, pharmacist review, and tracking.
- **Pooled purchasing:** combine requests from several medical stores into one bulk order.
- **Agent negotiation:** let PharmaFlow and dealer agents exchange offers, then let an administrator review and award an agreed quote.
- **Shared visibility:** connect orders, deliveries, inventory updates, and an auditable event history.

## Five connected roles

| Role | Main features | Route |
|---|---|---|
| Customer | Browse products, search and filter, view Eco-Sale offers, upload prescriptions, track orders, and request medicine returns | `/customer` |
| Chemist | Manage batches and expiry, review prescriptions, pack orders, review returns, and request bulk stock | `/chemist` |
| Rider | Accept delivery and pickup missions, view routes, and complete deliveries with OTP | `/rider` |
| Dealer | Submit bulk quotes with price limits and delivery times, view negotiations, and fulfil awarded orders | `/dealer` |
| Admin | Review stores, monitor orders, run negotiations, award bulk orders, and verify the audit ledger | `/admin` |

The `/presenter` page shows customer, chemist, rider, and admin screens together. Open `/dealer` separately for the negotiation demo.

## How agent negotiation works

Two agents represent different pricing goals: PharmaFlow seeks a competitive purchase price, while each dealer works within its quoted price range.

1. **Pool demand.** At least two approved stores request the same item.
2. **Request quotes.** The admin sets a target price and maximum purchase price.
3. **Dealer quotes.** Dealers enter an asking price, minimum price, and delivery time.
4. **Exchange offers.** The admin starts negotiation. Each pair of agents responds to previous offers for up to three rounds, respecting the buyer ceiling and dealer floor.
5. **Compare results.** Agreed quotes are ranked using price, delivery time, and dealer rating. Open **Agent conversation** to inspect or replay the exchange.
6. **Admin decides.** The admin awards an agreed quote. The dealer delivers each store's allocation, and the app records payment status.

**Implementation:** these are deterministic, rule-based agents running offline. They do not call an LLM or require an AI API key. The recommendation is the best-ranked agreed quote among those submitted, not a guarantee of the lowest market price. An administrator makes the final award.

Payment actions record the prototype's workflow; they do not transfer real money.

## Interface

The customer storefront uses a dark green hero, prominent search, product imagery, and aisle filters. Shared role screens use neutral surfaces, consistent cards, and restrained status colours. Negotiation conversations and payment details can be expanded when needed to keep the main workflow readable.

The returns interface focuses on **medicine donation and disposal**. Blood donation and appointment booking have been removed from the active UI.

- Shared styling: `src/index.css`
- Shared components: `src/components/ui.tsx`
- [Figma storefront design](https://www.figma.com/design/h7QSbAidVEjCAneN5kfPyd?node-id=15-10)

## Run locally

Install **Node.js 22 or newer** and npm. Use a recent Chrome or Edge browser.

```bash
git clone https://github.com/chethan-9817/pharma_flow_1.git
cd pharma_flow_1
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. Choose a role and use a demo login. Keep the terminal running while you use the app.

For a specific port:

```bash
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

Then open `http://127.0.0.1:5175/customer`. If the port is occupied, choose another port. Use the same hostname and port in all demo tabs so they share browser data.

Windows users can also use the included `Start PharmaFlow.cmd` launcher.

### Optional server mode

Run these commands in separate terminals:

```bash
# Terminal 1: API and database
npm run server
```

```bash
# Terminal 2: frontend with API proxy
npm run dev:server
```

The API defaults to port `8787`. Server mode uses SQLite persistence and WebSocket updates; browser demo mode uses IndexedDB and cross-tab updates. See [WORKFLOW.md](WORKFLOW.md#developer-workflow) for login and configuration details.

## Demo for judges

### Show the customer and inventory experience

1. Open `/customer` and explore search, product categories, and Eco-Sale.
2. Open `/chemist` to show batch inventory, expiry status, and order handling.
3. Show **Medicine returns** to explain how pickups and pharmacist review fit into the workflow.

### Show agents negotiating a bulk order

1. Open `/chemist` in two tabs. Sign in as **Ganesh Prabhu** and **Suresh Kamath**.
2. Request the same item from both stores using **Bulk orders with other stores**.
3. Open `/admin`, select **Bulk orders**, and choose **Ask dealers for quotes**. Set the target and ceiling.
4. Open `/dealer`, sign in as **Ramesh Hegde**, and submit an asking price, minimum price, and delivery time.
5. Return to admin and select **Start agent negotiation**.
6. Expand **Agent conversation** and use **Replay chat** to show the exchange.
7. Explain the recommendation and award an agreed quote. If price limits do not overlap, the negotiation may finish without an agreement.

More scenarios: [WORKFLOW.md](WORKFLOW.md).

## Technology

| Layer | Tools |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| State and browser storage | Zustand, Dexie / IndexedDB, BroadcastChannel |
| Server | Hono, SQLite through `node:sqlite`, WebSocket, bcrypt, JWT |
| Validation | Zod and shared domain rules |
| Barcode and prescription capture | ZXing, Tesseract.js |
| Maps, charts, and documents | Leaflet, OpenStreetMap, Recharts, jsPDF, QR codes |
| Languages and installation | react-i18next (English, Kannada, Hindi), PWA / Workbox |
| Testing | Vitest and Playwright |

Actions are represented as events. Domain rules validate transitions, and a hash-chained event ledger supports replay and integrity checks. See [ARCHITECTURE.md](ARCHITECTURE.md) for implementation details.

## Development checks

```bash
npm run typecheck       # TypeScript checks
npm test                # Unit tests
npm run build           # Type check and production build
npm run test:e2e         # Browser workflows
npm run test:e2e:server  # Server-mode browser workflows
npm run test:e2e:pwa     # PWA browser checks
```

Browser tests require the browser configured in the Playwright configuration files. For a built preview, run `npm run build` followed by `npm run preview` and open the printed URL.

## Project scope

This is a demonstration prototype, not a production pharmacy service. Product data, prescription rules, financial records, and impact figures are demo models. Prescription OCR assists data capture; pharmacist review remains part of the workflow. Real deployment would require validated operating processes, regulatory review, and integrations for payments and fulfilment.

## Documentation

- [Workflow and demo guide](WORKFLOW.md)
- [Architecture](ARCHITECTURE.md)
- [Remaining work](TODO.md)

**Author:** Chethan K S — [@chethan-9817](https://github.com/chethan-9817)
