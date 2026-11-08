# PharmaFlow: what is left to do

Last updated: end of the session on 2026-11-08. Roadmap steps 1 to 8 are built and tested: 275 unit tests and 14 browser tests. This file lists what is **not** done, the decisions that were made without you, and what to know before continuing.

## Done since the last version of this file

- **Sponsor batch for NGO (₹99)** and the **NGO fund** (Phase A of the NGO plan).
- **Server mode** (`pharmaflow server`), the installable **PWA**, **English / Kannada / Hindi**, and the **Playwright** tests.

## Decisions I made without a final answer from you

These are written into the code and the docs. Change them if they are wrong.

| Decision | What I chose | Where |
|---|---|---|
| Sponsor: which medicines | **OTC only.** Prescription-only (Schedule H) deals cannot be sponsored. You did not answer this question; I picked the safe default | `src/domain/rules/sponsor.ts` (`checkSponsorable`) |
| Sponsor: what ₹99 buys | As many packs of the deal as ₹99 covers at the Eco-Sale price (at least one). The store is paid that price, the change tops up the NGO fund | `sponsorUnits`, `sponsorSplit` |
| Platform fee and the NGO share | **10%** of each delivered order is the platform's fee and **2% of that** goes to the NGO fund. These are demo numbers, there is no real revenue model yet | `src/domain/rules/fund.ts` (one constant each) |
| Failed pharmacist check on sponsored packs | The sponsor gets the full ₹99 back as MedWallet credit, the store is not paid | `sponsorshipRefunded` |
| Server database | Node's built-in `node:sqlite`, not better-sqlite3 + Drizzle, so nothing needs compiling | `server/db.ts` |
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

### 4. Smaller loose ends
- The message you started an earlier session with, "and one more thing", was cut off. If there was a further request, say it again.
- Real GPS is not planned: the rider dot is a simulation.
- Map tiles use the public OpenStreetMap servers (fine for a demo). A real deployment needs its own tile provider.
- In demo mode, certificate verification only checks the browser's own data. Server mode checks with the server.

## How to pick this up again

```powershell
pharmaflow            # start the app and open the presenter view
pharmaflow stop       # stop it
pharmaflow test       # 275 unit tests
pharmaflow server     # server mode: real logins, data on the server (http://localhost:8787)
npm run test:e2e      # browser tests: four tabs and languages (uses your Chrome)
npm run test:e2e:pwa  # builds the app, checks installability and offline use
npm run test:e2e:server   # builds and starts the real server, checks logins and live sync
```
Project folder: `C:\Users\cheth\OneDrive\Desktop\ALLMY_imp(s)\Pharma-flow` (quote the path, it has parentheses).
Repo: https://github.com/chethan-9817/pharma_flow_1

## Rules to keep following
- **Keep the docs current.** Keep `README.md` a short overview; put feature detail in `ARCHITECTURE.md` and `WORKFLOW.md`, and update them with every feature.
- **Small, atomic commits**, one logical change each. Author is `chethanksks4@gmail.com`. **No Claude co-author line.**
- **Layouts:** a role opened on its own must be laptop-optimised. The **All 4** presenter view (`?embed=1`) keeps the compact phone-style panes. Do not change the All 4 view.
- No cloud services or API keys. Never fake "AI verified" claims. Business rules live in `src/domain`, never in React components.
- New screen text goes into all three of `src/i18n/en.json`, `kn.json` and `hi.json`.
- If a rule is unclear, ask.

## Gotchas learned
- Vite listens on IPv6 only on this machine, so detect the running app with an HTTP check, not `netstat`. The server binds to `localhost` for the same reason.
- CARTO's dark map tiles now need an API key. The rider map uses free OpenStreetMap tiles darkened with a CSS filter.
- jsPDF's built-in fonts cannot draw the rupee sign, so PDFs write "Rs.".
- In headless browser tests only the front tab animates: call `bringToFront()` before clicking in a page.
- Chrome never offers to install an app in an incognito-like context, which is what Playwright uses, so the PWA test accepts that one reason (`in-incognito`) and nothing else.
- Playwright tests run in separate browser contexts when they must prove the server (not BroadcastChannel) is doing the syncing.
- `run.ps1` must stay ASCII-only (Windows PowerShell 5.1). Edit documents with a UTF-8-safe tool: PowerShell 5.1 `Get-Content`/`Set-Content` garbles emoji and rupee signs.
- The server's tests lower bcrypt's cost to 4 so they stay fast; the real server uses 10.
