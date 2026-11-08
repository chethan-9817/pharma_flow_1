# PharmaFlow Workflows

Every business flow in PharmaFlow, who does what, and which rule can stop it. For how the code is organised see [ARCHITECTURE.md](ARCHITECTURE.md).

## Contents

1. [Who can do what](#who-can-do-what)
2. [Flow status at a glance](#flow-status-at-a-glance)
3. [Stock arrives: scan to ingest](#1-stock-arrives-scan-to-ingest)
4. [Eco-Sale: rescuing near-expiry stock](#2-eco-sale-rescuing-near-expiry-stock)
5. [Buying: forward order (OTC)](#3-buying-forward-order-otc)
6. [Buying with a prescription](#4-buying-with-a-prescription)
7. [Delivery by a rider](#5-delivery-by-a-rider)
8. [Donating medicines to an NGO](#6-donating-medicines-to-an-ngo)
9. [Disposing of expired medicines](#7-disposing-of-expired-medicines)
10. [Pharmacy KYC](#8-pharmacy-kyc)
11. [Blood donation](#9-blood-donation)
12. [Rewards](#10-rewards)
13. [Time travel](#11-time-travel)
14. [Demo script](#demo-script)
15. [Developer workflow](#developer-workflow)
16. [Troubleshooting](#troubleshooting)

---

## Who can do what

| Role | Demo login | Can do |
|---|---|---|
| **Customer** | Asha Shetty, Ravi Kumar | Browse, buy, upload prescriptions, cancel orders, reveal scratch cards (domain also supports donate, dispose and blood booking) |
| **Chemist** | Ganesh Prabhu (Sri Ganesh Medicals) | Ingest stock, Eco-Sale, donate and dispose batches, review prescriptions, pack orders, run the QA desk |
| **Rider** | Kiran Poojary | Go online, accept and complete deliveries and pickups |
| **Admin** | PharmaFlow Admin | Approve or reject pharmacies, verify the ledger (the domain also lets admins confirm blood donations; screen to come) |

The reducer enforces these roles. For example, only a chemist of the same store can pack that store's orders.

## Flow status at a glance

| Flow | Rules and events | Screens |
|---|---|---|
| Add inventory (scan, type or choose medicine) | ✅ | ✅ |
| Eco-Sale | ✅ | ✅ |
| OTC order | ✅ | ✅ |
| Prescription order and OCR | ✅ | ✅ |
| Rider delivery with OTP | ✅ | ✅ |
| Rider navigation map, ETA and Call | ✅ | ✅ dark street map, offline route diagram |
| Chemist donates or disposes a batch | ✅ | ✅ |
| Customer donates or disposes | ✅ | ⏳ Civic Hub screens still to build |
| Backhaul pickup suggestion | ✅ | ✅ appears when a customer-scheduled pickup is nearby, so it needs the Civic Hub screens to be seen |
| Pharmacy KYC | ✅ | ✅ |
| Blood booking and confirmation | ✅ | ⏳ customer booking screen; admin confirmation screen |
| Scratch cards | ✅ | ✅ Reveal button; ⏳ canvas scratch and confetti |
| Certificates | ✅ records and codes | ⏳ PDF with QR |

---

## 1. Stock arrives: add inventory

**Actor:** Chemist. **Screen:** Chemist → *Add inventory* (also reachable from the **Add inventory** buttons in the shop header and above the expiry ledger). Choose a tab: **Scan barcode**, **Type barcode** or **Choose medicine**.

```mermaid
flowchart LR
    A["Scan with camera,<br/>pick a preset<br/>or type the barcode"] --> B["parseScan"]
    M["Choose medicine<br/>(no barcode)"] --> E
    B -->|"GS1 code"| C["GTIN + batch + expiry"]
    B -->|"plain EAN-13"| D["GTIN only"]
    B -->|"unreadable"| X["Error toast"]
    C --> E["Confirm form"]
    D --> E
    E -->|"chemist checks or types batch, expiry, qty"| F["STOCK_INGESTED"]
    F --> G{"Reducer rules"}
    G -->|"store KYC approved, not Schedule X,<br/>not expired, qty > 0"| H["Batch appears in the expiry ledger"]
    G -->|"any rule fails"| X
```

Notes:

- GS1 codes carry the product code (GTIN), batch (AI 10) and expiry (AI 17, `YYMMDD`; day `00` means end of month). A plain retail barcode carries only the GTIN, so the chemist types the batch and expiry.
- A GTIN that is not in the catalog is rejected with its number shown.
- **No barcode at all?** Use the **Choose medicine** tab: pick the medicine from the catalog, then type the batch number and expiry printed on the strip.
- **If the camera cannot read the strip, or there is no camera, type it.** Put the digits under the barcode into **Can't scan? Type the barcode** and press **Look up**. Spaces and hyphens are ignored, and a wrong digit count gets a clear message. A GS1 string such as `(01)08901234500011(17)270600(10)DL27A01` also works and fills batch and expiry. The camera dialog offers "Type the barcode instead" when it fails and after a few seconds without a read.
- Stock cannot be added by a store that is still `PENDING_KYC`.

## 2. Eco-Sale: rescuing near-expiry stock

**Actor:** Chemist, then customers.

```mermaid
stateDiagram-v2
    [*] --> SAFE: "> 180 days left"
    SAFE --> LOCKOUT: "time passes: 30–180 days"
    LOCKOUT --> CRITICAL: "1–29 days"
    CRITICAL --> EXPIRED: "0 days"
    LOCKOUT --> EcoSale: "Put on Eco-Sale"
    SAFE --> EcoSale: "Put on Eco-Sale"
    LOCKOUT --> Donated: "Donate to NGO"
    EXPIRED --> Incinerated: "Yellow-Bag pickup"
    EcoSale --> Sold: "customer buys"
```

| Rule | Value |
|---|---|
| Discount | 40% to 60%. The button suggests 60% under 45 days left, 50% under 90 days, otherwise 40% |
| Eligibility | `days_left ≥ course_days + 15`, so the patient can finish the course before expiry |
| Never | Expired stock, Schedule X |
| Prescription | **Not bypassed.** An Eco-Sale Augmentin still needs a prescription |
| Over time | If time travel makes the course no longer fit, the deal disappears and cannot be bought |

Customers see: *Expires in 38 days • fits a 5-day course • 50% OFF*.

## 3. Buying: forward order (OTC)

```mermaid
sequenceDiagram
    participant U as Customer
    participant A as PharmaFlow
    participant C as Chemist
    participant R as Rider
    U->>A: Add to cart, Place order
    A->>A: Quote: pick batches (first expiry first), price at MRP or Eco-Sale
    A-->>U: Order placed + 4-digit delivery OTP
    C->>A: Pack & summon rider
    R->>A: Accept, Arrived, Collected
    R->>A: Confirm handover with the customer's OTP
    A-->>U: Delivered + scratch card
```

```mermaid
stateDiagram-v2
    [*] --> PLACED
    PLACED --> PACKED: no Rx needed
    PLACED --> RX_APPROVED: pharmacist approves Rx
    RX_APPROVED --> PACKED
    PACKED --> OUT_FOR_DELIVERY: rider collected
    OUT_FOR_DELIVERY --> DELIVERED: correct OTP
    PLACED --> CANCELLED
    RX_APPROVED --> CANCELLED
```

- Stock is **reserved** when the order is placed and put back if the order is cancelled.
- Cancelling also refunds any MedWallet credit used.
- Payment is on delivery. MedWallet credit is applied at checkout.

## 4. Buying with a prescription

Schedule H and H1 drugs need a prescription. Schedule X / NDPS drugs are blocked completely.

```mermaid
sequenceDiagram
    participant U as Customer
    participant O as OCR (Tesseract)
    participant A as PharmaFlow rules
    participant C as Chemist
    U->>A: Cart has a Schedule H drug
    A-->>U: Checkout needs a prescription
    U->>U: Upload photo
    U->>O: Read with OCR (optional, internet needed once)
    O-->>U: Suggested doctor, reg. no., date, patient, quantities
    U->>U: Check and correct the fields
    U->>A: Place order with prescription
    A->>A: Auto-checks: fields present, drug listed, date valid, quantity covered, antibiotic Rx unused
    A->>C: Order lands in the packing desk with the Rx details
    alt Chemist approves
        C->>A: Approve Rx
        A->>A: Order becomes RX_APPROVED; H1 lines go to the H1 register when packed
        C->>A: Pack & summon rider
    else Chemist rejects
        C->>A: Reject with a reason
        A-->>U: Order stays open; upload a new prescription
        U->>A: Send new prescription
    end
```

Rules the reducer enforces:

1. Required on the prescription: doctor name, **registration number**, date, patient name, the drug.
2. Validity: **30 days for antibiotics, 180 days for other drugs**. Validity is checked again at approval, so time travel matters.
3. An **antibiotic prescription is single-use**. A non-antibiotic one can cover more orders.
4. Quantity ordered cannot exceed the quantity prescribed.
5. A prescription cannot be dated in the future.
6. **OCR only suggests.** The pharmacist approves or rejects, and the order cannot reach `PACKED` without approval.
7. Eco-Sale does not skip any of this.
8. Every approval and rejection is recorded in the audit ledger.

## 5. Delivery by a rider

**Actor:** Rider. **Screen:** Rider (dark mode).

```mermaid
flowchart LR
    A["Go online"] --> B["Mission radar<br/>🔵 delivery · 🟢 NGO pickup · 🟠 Yellow-Bag"]
    B --> C["Accept"]
    C --> D["Arrived"]
    D --> E["Collected"]
    E --> F{"Mission type"}
    F -->|"delivery"| G["Enter customer OTP,<br/>Confirm handover"]
    F -->|"donation"| H["Wait for chemist QA,<br/>then hand over to NGO"]
    F -->|"disposal"| I["Hand to CBWTF"]
```

- **Navigation:** as soon as a rider has a mission, a dark street map shows every stop in order (store or pickup point, then the customer, QA store, NGO or CBWTF plant) as numbered pins, with the rider as a pulsing yellow dot. Below it: the next stop, distance, ETA (at about 25 km/h), a **Call** button (a made-up demo number) and an **Open in Maps** link. After a backhaul pickup is added the route simply grows. The dot glides toward the next stop while the rider is travelling and waits when the rider has arrived.
- **Offline:** if the device loses internet, or street tiles keep failing, the map switches to a plain route diagram with the same stops and ETA, and returns when the connection is back.
- A rider must be **online** to accept. A rider cannot go offline with an active mission.
- Only the assigned rider can progress a mission.
- A wrong OTP is rejected and the order stays out for delivery.
- **Pay (demo values):** ₹40 per delivery; ₹30 per pickup plus a ₹10 green incentive.
- **Backhaul:** while delivering, the rider is shown any unassigned pickup within about 600 m of the customer, so a return is collected on the same trip.

## 6. Donating medicines to an NGO

```mermaid
stateDiagram-v2
    [*] --> SCHEDULED
    SCHEDULED --> COLLECTED: rider arrived and collected
    COLLECTED --> QA_VERIFIED: chemist QA passes
    COLLECTED --> QA_REJECTED: chemist QA fails
    QA_VERIFIED --> DELIVERED_TO_NGO: rider hands over
    QA_REJECTED --> INCINERATED: sent to bio-disposal
    DELIVERED_TO_NGO --> [*]
    INCINERATED --> [*]
```

**Eligibility** (checked when scheduling, and again at the QA desk):

- Sealed and unopened, and not an opened liquid.
- **More than 30 days** of shelf life left. Time passes while a pickup is in transit, so the QA desk checks again.
- Not cold-chain (for example insulin) and not Schedule X.
- **Prescription-only drugs go only to NGOs with a registered doctor or pharmacist.** Seva NGO Clinic qualifies; Karunya Old-Age Home does not.

**Who starts it:**

- A **chemist** donates a whole batch (the *Donate* button). The chemist's own store runs QA.
- A **customer** donates leftover strips (domain ready; Civic Hub screen to come). A chosen chemist runs QA.

**Outcomes:**

| Result | What happens |
|---|---|
| QA verified, delivered | Batch closed. If a customer donated: +200 karma, a scratch card and an NGO Donor certificate. Rider earns pickup pay |
| QA rejected | Goes to incineration. **No** donor reward. Rider earns pickup pay |

## 7. Disposing of expired medicines

Expired medicines have exactly one legal route: **Yellow Bag → CBWTF incineration**.

```mermaid
flowchart LR
    A["Expired stock or household strips"] --> B["Yellow-Bag pickup scheduled"]
    B --> C["Rider collects sealed bag"]
    C --> D["CBWTF incineration"]
    D --> E["Batch closed; customer gets +150 karma and a Green Citizen certificate"]
```

- Only **expired** items can be scheduled; anything still in date is pointed to donation instead.
- Schedule X items are blocked on the platform.
- A chemist's expired batch shows a red *Dispose* button.

## 8. Pharmacy KYC

```mermaid
stateDiagram-v2
    [*] --> PENDING_KYC: store registers
    PENDING_KYC --> APPROVED: admin approves
    PENDING_KYC --> REJECTED: admin rejects
```

- New stores **must** start as `PENDING_KYC`.
- A pending or rejected store cannot list stock, sell, or receive pickups. Customers only see approved stores.
- Only an admin can decide, and each store is reviewed once.
- The admin sees the drug licence (for example `KA-MNG-2026-9102`) and GSTIN.

## 9. Blood donation

```mermaid
sequenceDiagram
    participant U as Customer
    participant A as PharmaFlow
    participant Ad as Admin
    U->>A: Book an appointment (today or later)
    Ad->>A: Confirm the donation happened
    A-->>U: +500 karma, Blood Donor certificate, badge
```

India's policy is voluntary, unpaid blood donation, so the reward has **no money value**: no cashback, no scratch card, no wallet credit.

## 10. Rewards

| Action | Reward |
|---|---|
| Delivered order | Scratch card |
| Donation to an NGO (customer) | +200 karma, scratch card, NGO Donor certificate |
| Safe disposal (customer) | +150 karma, Green Citizen certificate |
| Blood donation | +500 karma, Blood Donor certificate, badge |

Scratch cards give either karma or **MedWallet** credit. The reward is fixed by the card id, so replaying the log always gives the same result. MedWallet is closed-loop store credit: it can be spent at checkout and can never be cashed out.

## 11. Time travel

The presenter bar moves the simulated date **forward only**: drag the slider or use +1 week, +1 month or +5 months.

What changes as the date moves:

- Batches move between SAFE, LOCKOUT, CRITICAL and EXPIRED.
- Eco-Sale deals vanish once the course no longer fits.
- Prescriptions and donation shelf life are re-checked when approved or verified.
- Seed stock expires quickly. After +5 months most of the starting inventory is expired, which is useful for showing disposal.

**Reset demo** clears everything in every open tab and returns the date to 8 Nov 2026.

---

## Demo script

About 8 to 10 minutes. Everything happens live across tabs with no refresh.

### Before you start (2 minutes, with wifi on)

| Check | How |
|---|---|
| App is running | Type `pharmaflow` in any terminal. It starts the app and opens `http://localhost:5173/presenter` (or double-click `Start PharmaFlow.cmd`) |
| **Use `localhost`** | The camera is blocked on plain-HTTP LAN addresses |
| Warm up OCR **once** | In a Customer tab, add Augmentin to the cart, upload any photo and press **Read with OCR**. This downloads about 10 MB and caches it |
| Rider map | Needs internet for street tiles. If wifi drops it falls back to a route diagram, so the demo keeps going |
| Camera permission | Press **Scan with camera** once and click Allow |
| QR codes ready | Open `http://localhost:5173/demo-barcodes` on a phone (or print it) |
| Clean slate | Press **Reset demo** in the presenter bar |
| Layout | Use the **All 4** view, or four browser windows side by side |

Log in with the 1-tap buttons: Asha (Customer), Ganesh (Chemist), Kiran (Rider), Admin.

### The walkthrough

| # | Where | Do | Say / expected result |
|---|---|---|---|
| 1 | Chemist | **Scan with camera** and show the **Dolo 650** QR code → **Add to stock**. (No camera or it will not read? Type `8901234500011` into **Can't scan?**, then type the batch and expiry.) Scan the **Augmentin 625 Duo** QR the same way | "GS1 parsing filled batch and expiry." Dolo appears as **Safe**. Scanning Augmentin now matters: the starting Augmentin batch expires during the +5 month jump, so step 4 needs this fresh one |
| 2 | Presenter bar | Drag the slider about **+5 months** (or press **+5 months**) | Dolo moves to **Lockout** (amber) |
| 3 | Chemist | **Eco-Sale** on the Dolo batch you just scanned (batch `DL27A01`) | Customer → *Deals* shows it instantly: "Expires in N days • fits a 5-day course • 50% OFF" |
| 4 | Customer | Add Eco-Sale Dolo (Deals) and **Augmentin** (Shop) → open **Cart** | Checkout shows **Prescription required** |
| 5 | Customer | Upload the prescription photo → **Read with OCR** → check fields → **Place order** | OCR fills doctor, reg. no., date, patient. "OCR only suggests; the pharmacist decides." Try placing it empty first to show the block |
| 6 | Chemist | Order packing desk → **Approve Rx** → **Pack & summon rider** | Order moves to *Packed* |
| 7 | Rider | **Offline → Online** → **Accept mission** (the map appears: point out the route, ETA and Call button) → **Arrived** → **Collected** → type the OTP shown in the customer's Orders tab → **Confirm handover** | ₹40 earnings, 1 trip |
| 8 | Customer | **Orders** tab → **Reveal** the scratch card | Karma or MedWallet credit appears |
| 9 | Chemist | **Donate** on a batch with a safe expiry → Rider accepts, arrives, collects → Chemist **QA verified** → Rider **Hand over to NGO** | The *Returned-medicine QA desk* shows the pickup; this covers the reverse flow end to end |
| 10 | Admin | Check the KPIs → **Verify ledger integrity** | "✅ Chain intact: N events verified" |

> The customer-side donate screen, the canvas scratch card and the PDF certificate are still being built, so step 9 uses the chemist's donation. See [Flow status at a glance](#flow-status-at-a-glance).

### Good questions to expect

| Question | Answer |
|---|---|
| "Is the prescription really checked?" | Yes, by rules in the reducer: fields, drug listed, date, validity window, quantity and single-use for antibiotics. The pharmacist still approves. OCR never approves |
| "Can someone edit history?" | Every event is chained with SHA-256. The Admin verify button recomputes the chain and flags the first changed event |
| "What happens to expired stock?" | Only the Yellow-Bag → CBWTF route is allowed |
| "Does it work offline?" | Everything except first-time OCR and the web font |
| "Where is the data?" | In the browser (IndexedDB). `npm run db:sample` shows the same data as SQL tables |

---

## Developer workflow

```powershell
cd "C:\Users\cheth\OneDrive\Desktop\ALLMY_imp(s)\Pharma-flow"
pharmaflow test      # 166 tests, about one second
npm run typecheck    # strict TypeScript
npm run build        # typecheck + production build
npm run db:sample    # rebuild the sample database
```

**Adding a business rule**

1. Write a pure function in `src/domain/rules/` that takes `today` and returns a `Check`.
2. Add tests in `tests/` for the boundaries.
3. Call it from the matching handler in `src/domain/handlers/`.
4. Show the error in the UI through `report(result)`; do not duplicate the rule in a component.

**Adding an action**

1. Add the event to `src/domain/events.ts`.
2. Write its handler, validating with rules and role guards.
3. Add a `case` in `src/domain/reducer.ts`.
4. Add a reducer test, then wire a button that calls `dispatch`.

**Commits:** small and focused, one logical change each, using a prefix such as `feat(domain):`, `fix:`, `test:`, `docs:`, `chore:`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Scan with camera` says permission blocked | Click the camera icon in the address bar and allow it, then reopen the scanner |
| Camera says it needs a secure page | Open the app at `http://localhost:5173`, not a LAN IP |
| No camera, or it will not read the strip | Use **Can't scan? Type the barcode** (digits under the barcode), or the **preset** picker |
| OCR says it is not available | The first run needs internet for about 10 MB. Reconnect and try again, or type the details |
| Tabs do not sync | Both must be the same origin and browser profile (for example both `localhost:5173`, not one `127.0.0.1`) |
| Everything looks stuck or odd | Press **Reset demo** in the presenter bar |
| PowerShell blocks `run.ps1` | Use `pharmaflow` (it bypasses the policy for its own script), or run `powershell -ExecutionPolicy Bypass -File .\run.ps1` |
| `pharmaflow` is not recognised | Open a **new** terminal window after installing, or run `scripts\install-command.ps1` again |
| Rider map shows a diagram instead of streets | The device is offline or the OpenStreetMap tiles are blocked. Reconnect and it returns by itself |
| No barcode on the strip | Use the **Choose medicine** tab in Add inventory |
| The app does not start | Open `data\dev-server.log` in the project folder to see why |
| `npm install` is slow in OneDrive | Pause OneDrive sync while installing, or run `npm install` once and leave it |
| Port 5173 already in use | Run `pharmaflow stop` if it is PharmaFlow. If another program owns the port, close that program first |
