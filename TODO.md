# PharmaFlow: what is left to do

Last updated: 2026-11-10 (light-theme refresh, 6-month Eco-Sale alerts). Roadmap steps 1 to 8 are built and tested: 284 unit tests and 14 browser tests. This file lists what is **not** done, the decisions that were made without you, and what to know before continuing.

## Done since the last version of this file

- **Sponsor batch for NGO (₹99)** and the **NGO fund** (Phase A of the NGO plan).
- **Server mode** (`pharmaflow server`), the installable **PWA**, **English / Kannada / Hindi**, and the **Playwright** tests.
- **Light-theme refresh (2026-11-10).** All four roles and the shared pieces (top bar, sign-in gate, toasts, dialogs) use one calm light design. The rider screen is no longer dark, the chemist banner is a white card, and repeated actions use soft tinted buttons. Tokens and the rules are in ARCHITECTURE.md → Design system. Logic, text and layouts (including the All 4 view) were not changed.
- **More colour (2026-11-10, same day).** You found the first pass too white, so the theme stays light but now has clear colour: a blue-grey background, light-blue header cards, a solid blue active tab, and stat tiles tinted by meaning with icon chips (green, amber, orange, red). The Figma "after" captures and component sheet show the earlier, paler version.
- **6-month Eco-Sale alerts and more stock (2026-11-10).** Your model: 6 months before expiry the chemist is alerted and the medicine goes on Eco-Sale; a ₹200 strip sells for ₹170, PharmaFlow keeps ₹20 and the store gets ₹150. Eco-Sale now opens only inside that window. The store has 22 medicines (10 new), each with a fresh batch, so the customer shop no longer shows "out of stock" when an old batch goes on Eco-Sale; if the Eco-Sale batch is the only stock, the shop sells it at the Eco-Sale price.
- **Pharmacy products and pictures (2026-11-10).** 46 items in six aisles: 29 medicines, plus sanitary pads, sunscreens, face serums, face washes, toothbrushes, toothpaste, diaper pants, syringes, bandages, antiseptic and a thermometer. Every item has a drawn picture, and aisle chips filter the shop.

- **Pooled bulk orders and dealers (2026-11-11).** A fifth role, **Dealer**. Stores pool bulk requests, the admin sets a target and a ceiling, dealers quote, rule-based agents negotiate in up to 3 rounds, the admin awards and the dealer delivers a fresh batch to each store. The admin portal now has tabs: Overview, **Stores and orders** (every store, its chemist, stock and orders; recent orders with their rider) and **Bulk orders**. Demo data grew to 6 customers, 7 stores, 3 riders and 3 dealers.

## Decisions I made without a final answer from you

These are written into the code and the docs. Change them if they are wrong.

| Decision | What I chose | Where |
|---|---|---|
| Sponsor: which medicines | **OTC only.** Prescription-only (Schedule H) deals cannot be sponsored. You did not answer this question; I picked the safe default | `src/domain/rules/sponsor.ts` (`checkSponsorable`) |
| Sponsor: what ₹99 buys | As many packs of the deal as ₹99 covers at the Eco-Sale price (at least one). The store is paid that price, the change tops up the NGO fund | `sponsorUnits`, `sponsorSplit` |
| Platform fee and the NGO share | **10% of the MRP** of each delivered order is the platform's fee and **2% of that** goes to the NGO fund. Taking it on the MRP matches your example (₹20 on a ₹200 strip sold for ₹170). These are demo numbers, there is no real revenue model yet | `src/domain/rules/fund.ts` (one constant each) |
| Eco-Sale discount after the first offer | You gave 15% at 6 months (₹200 → ₹170). I kept the deeper suggestions closer to expiry: **50% under 90 days, 60% under 45 days**, so stock still clears. The chemist can be offered any discount from 15% to 60% | `src/domain/rules/ecoSale.ts` (`suggestedDiscount`) |
| Product pictures | **Drawn illustrations**, not brand photos. Real pack shots are the brands' copyrighted images, and the app must work offline with no image service. Swap in licensed photos later if you get them | `src/components/ProductArt.tsx` |
| Which products and prices | A typical Indian pharmacy mix with **indicative MRPs**. All non-medicine products are over the counter; Ecosprin, Pantocid and Montair LC are marked Schedule H. Check schedules against CDSCO before real use | `src/seed/medicines.ts`, `src/seed/products.ts` |
| Sponsor batch payout | Unchanged: the store is paid the full Eco-Sale price for sponsored packs, with no PharmaFlow fee taken from it | `src/domain/rules/sponsor.ts` |
| Failed pharmacist check on sponsored packs | The sponsor gets the full ₹99 back as MedWallet credit, the store is not paid | `sponsorshipRefunded` |
| Server database | Node's built-in `node:sqlite`, not better-sqlite3 + Drizzle, so nothing needs compiling | `server/db.ts` |
| Bulk negotiation | **Rule-based agents, not an AI model**: replayable, explainable and offline. Usual trade price = 80% of MRP, default target = 65%. Effective price adds 0.5% per delivery day and 2% per rating star below five. Needs 2+ stores before dealers are asked | `src/domain/rules/bulk.ts` |
| Bulk delivery | The dealer's stock goes straight onto each store's shelf as a fresh batch. Payments between stores and the dealer are not modelled | `src/domain/handlers/bulk.ts` |
| Server demo password | Every demo user shares `pharmaflow` (shown on the login screen only while it still works) | `server/auth.ts` |

## Not done yet

### 1. NGO plan, phases B and C (designed, not built)
You approved Phase A only. The idea is that three sources feed one **NGO needs list**, and each need is filled from the cheapest source first:

1. Donated stock that passed the pharmacist's check (free).
2. Near-expiry stock from a chemist (the chemist gets a write-off receipt).
3. A chemist at cost, or a distributor bulk quote, paid from the NGO fund (sponsor change plus the platform share).

| Piece | Notes |
|---|---|
| **NGO login and needs list** | An NGO role that posts what it needs ("20 strips of cetirizine"). Today an NGO is only a place a pickup ends at. Needs a fifth role, screens and events |
| **Chemist "NGO price" opt-in** | A store pledges a near-cost margin on NGO orders and earns a "Community Partner" badge |
| **Bulk buying from distributors** | Group the needs, ask distributors for a quote, buy at a cheaper rate. Purchases must be against a licensed seller's invoice, and prescription-only drugs still need an NGO with a registered doctor or pharmacist. The distributor side would be simulated in the demo |
| **Spending the NGO fund** | The fund can only grow today. It must stay closed-loop: only ever buys medicines for NGOs, never cash |

Questions to settle first: is an NGO a real user with a login? What is the real platform fee and NGO share? Holding real donated money needs a registered trust or partner NGO, and any 80G claim needs a CA.

### 2. Languages: the rest, and a native review
Still English: the chemist's **Add inventory** card and camera scanner, the customer's **prescription form**, the rider's navigation panel and map, the demo barcodes page, the PDFs, and the messages from the business rules (they come from `src/domain`, which has no UI language; translating them means returning message keys instead of text). The Kannada and Hindi text has not been read by a native speaker.

### 3. Server mode: beyond demo grade
Not built: registering new accounts, password reset, per-role views of the log (any signed-in user can read every event, including prescriptions), HTTPS (put it behind a proxy), backups of `data/pharmaflow.db`, and the extra projection tables from `scripts/schema.sql` (the server keeps only the `events` table, which is the source of truth).

### 4. Figma file: real component sets
The file *PharmaFlow UI - light theme refresh* (https://www.figma.com/design/h7QSbAidVEjCAneN5kfPyd) has:
- the variable collections (`Primitives`, `Color`, `Shape and spacing`), the `Type/*` text styles and the shadow styles;
- the four "before" captures and the four "after" captures (customer, chemist, rider, admin), taken on 2026-11-10;
- a **component sheet** captured from the live app: Button (8 variants × 3 sizes), Badge (6 tones), Card and Stat, drawn from the exact classes in `src/components/ui.tsx`.

The sheet is plain frames, not Figma components. Turning it into real **component sets with variant properties**, and adding the Type/Button, Type/Button small and Type/Badge text styles, needs Figma's `use_figma` tool. On a Starter plan with a View seat that tool allows **20 calls a month**, and they are used up. It needs the monthly reset, or a Professional plan with a Full or Dev seat (200 calls a day). You can also select each frame in the sheet and use *Create component* by hand. Nothing in the app depends on the Figma file.

### 5. Smaller loose ends
- The message you started an earlier session with, "and one more thing", was cut off. If there was a further request, say it again.
- Real GPS is not planned: the rider dot is a simulation.
- Map tiles use the public OpenStreetMap servers (fine for a demo). A real deployment needs its own tile provider.
- In demo mode, certificate verification only checks the browser's own data. Server mode checks with the server.

## How to pick this up again

```powershell
pharmaflow            # start the app and open the presenter view
pharmaflow stop       # stop it
pharmaflow test       # 284 unit tests
pharmaflow server     # server mode: real logins, data on the server (http://localhost:8787)
npm run test:e2e      # browser tests: four tabs and languages (uses your Chrome)
npm run test:e2e:pwa  # builds the app, checks installability and offline use
npm run test:e2e:server   # builds and starts the real server, checks logins and live sync
```
Project folder: `C:\Users\cheth\OneDrive\Desktop\ALLMY_imp(s)\Pharma-flow` (quote the path, it has parentheses).
Repo: https://github.com/chethan-9817/pharma_flow_1
Figma: https://www.figma.com/design/h7QSbAidVEjCAneN5kfPyd

## Rules to keep following
- **Keep the docs current.** Keep `README.md` a short overview; put feature detail in `ARCHITECTURE.md` and `WORKFLOW.md`, and update them with every feature.
- **Small, atomic commits**, one logical change each. Author is `chethanksks4@gmail.com`. **No Claude co-author line.**
- **Layouts:** a role opened on its own must be laptop-optimised. The **All 4** presenter view (`?embed=1`) keeps the compact phone-style panes. Do not change the All 4 view.
- No cloud services or API keys. Never fake "AI verified" claims. Business rules live in `src/domain`, never in React components.
- New screen text goes into all three of `src/i18n/en.json`, `kn.json` and `hi.json`.
- If a rule is unclear, ask.

## Gotchas learned
- Vite listens on IPv6 only on this machine, so detect the running app with an HTTP check, not `netstat`. The server binds to `localhost` for the same reason.
- CARTO's map tiles now need an API key. The rider and order-tracker maps use free OpenStreetMap tiles in their normal colours.
- Figma capture from a local page: do not `await` `window.figma.captureForDesign(...)` in Playwright, its promise never resolves and the script hangs. Fire it, wait about 15 seconds, then poll `generate_figma_design` with the capture id. Each id is single-use.
- The Figma MCP on a Starter plan (View seat) allows 20 calls a month to the tools that read or edit a file, such as `use_figma`. Page captures (`generate_figma_design`) do not count, so screens can still be captured after the limit is hit. Batch library work into few calls.
- When capturing from Playwright, wait for `load`, not `networkidle`: the dev app sometimes never goes idle and the script times out.
- jsPDF's built-in fonts cannot draw the rupee sign, so PDFs write "Rs.".
- In headless browser tests only the front tab animates: call `bringToFront()` before clicking in a page.
- Chrome never offers to install an app in an incognito-like context, which is what Playwright uses, so the PWA test accepts that one reason (`in-incognito`) and nothing else.
- Playwright tests run in separate browser contexts when they must prove the server (not BroadcastChannel) is doing the syncing.
- `run.ps1` must stay ASCII-only (Windows PowerShell 5.1). Edit documents with a UTF-8-safe tool: PowerShell 5.1 `Get-Content`/`Set-Content` garbles emoji and rupee signs.
- The server's tests lower bcrypt's cost to 4 so they stay fast; the real server uses 10.
