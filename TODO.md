# PharmaFlow: what is left to do

Last updated: end of the session on 2026-11-08. Roadmap steps 1 to 7 are built and tested (187 tests). This file lists everything that is **not** done, and what to know before continuing.

## Not done yet

### 1. Decision needed first: "Sponsor batch for NGO (₹99)"
The README names a second button on Eco-Sale deals, **Sponsor batch for NGO (₹99)**, but never says how it works. Before building it, decide:
- Who pays ₹99, and for what? (a whole batch, or a fixed donation amount?)
- Does the batch leave the shop's stock and go to an NGO, and does the chemist get paid?
- Does the customer earn karma, a scratch card or a certificate?
- Does the prescription rule still apply to Schedule H drugs?

### 2. Roadmap step 8: extras
| Item | Notes |
|---|---|
| **Server mode** | Hono API + SQLite (`better-sqlite3` + Drizzle) + WebSockets. Reuse the same events and reducer. Swap `DexieStorage` and `BroadcastTransport` behind the existing `EventStorage` and `Transport` interfaces. `scripts/schema.sql` already sketches the tables. Planned endpoints are in the README. Needs real login (bcrypt + JWT cookie). |
| **PWA** | `vite-plugin-pwa`: installable app, offline shell. |
| **Languages** | `react-i18next` with English, Kannada (ಕನ್ನಡ) and Hindi (हिन्दी). |
| **Playwright** | A multi-tab test of the README demo walkthrough (the headless domain test in `tests/walkthrough.test.ts` already covers the rules). |

### 3. Smaller loose ends
- The message you started with "and one more thing" was cut off earlier in the session. If there was a further request, say it again.
- Real GPS is not planned: the rider dot is a simulation.
- Map tiles use the public OpenStreetMap servers (fine for a demo). A real deployment needs its own tile provider.
- Certificate verification only checks the browser's own data. A real deployment needs the server.

## How to pick this up again

```powershell
pharmaflow            # start the app and open the presenter view
pharmaflow stop       # stop it
pharmaflow test       # 187 tests
```
Project folder: `C:\Users\cheth\OneDrive\Desktop\ALLMY_imp(s)\Pharma-flow` (quote the path, it has parentheses).
Repo: https://github.com/chethan-9817/pharma_flow_1

## Rules to keep following
- **Keep the docs current.** Update `README.md` (including *Recent changes*), `ARCHITECTURE.md` and `WORKFLOW.md` with every feature.
- **Small, atomic commits**, one logical change each. Author is `chethanksks4@gmail.com`. **No Claude co-author line.**
- **Layouts:** a role opened on its own must be laptop-optimised. The **All 4** presenter view (`?embed=1`) keeps the compact phone-style panes. Do not change the All 4 view.
- No cloud services or API keys. Never fake "AI verified" claims. Business rules live in `src/domain`, never in React components.
- If a rule is unclear, ask.

## Gotchas learned
- Vite listens on IPv6 only on this machine, so detect the running app with an HTTP check, not `netstat`.
- CARTO's dark map tiles now need an API key. The rider map uses free OpenStreetMap tiles darkened with a CSS filter.
- jsPDF's built-in fonts cannot draw the rupee sign, so PDFs write "Rs.".
- In headless browser tests only the front tab animates: call `bringToFront()` before clicking in a page.
- Edit documents with a UTF-8-safe tool. PowerShell 5.1 `Get-Content`/`Set-Content` garbles emoji.
