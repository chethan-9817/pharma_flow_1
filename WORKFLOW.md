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
12. [Rewards and certificates](#10-rewards-and-certificates)
13. [Time travel](#11-time-travel)
14. [Sponsoring a batch for an NGO, and the NGO fund](#12-sponsoring-a-batch-for-an-ngo-and-the-ngo-fund)
15. [Pooled bulk orders and dealer negotiation](#13-pooled-bulk-orders-and-dealer-negotiation)
16. [Demo script](#demo-script)
17. [Developer workflow](#developer-workflow)
18. [Troubleshooting](#troubleshooting)

---

## Who can do what

| Role | Demo login | Can do |
|---|---|---|
| **Customer** | Asha Shetty, Ravi Kumar, Meera D'Souza, Imran Khan, Lakshmi Bhat, Joseph Pinto | Browse, buy, upload prescriptions, cancel orders, reveal scratch cards, donate, dispose, book blood, sponsor an Eco-Sale batch for an NGO |
| **Chemist** | One per store: Ganesh Prabhu (Sri Ganesh Medicals), Suresh Kamath (Surathkal), Fathima Banu (Ullal), Prakash Rai (Kulshekar), Deepa Nayak (Kavoor), Vinod Shenoy (Jeppu), Anand Pai (Carstreet, pending KYC) | Ingest stock, Eco-Sale, donate and dispose batches, review prescriptions, pack orders, run the QA desk (including sponsored packs), request pooled bulk stock |
| **Rider** | Kiran Poojary, Sandeep Gowda, Naveen Kotian | Go online, accept and complete deliveries and pickups |
| **Admin** | PharmaFlow Admin | Approve or reject pharmacies, confirm blood donations, see every store and order, run bulk orders, verify the ledger |
| **Dealer** | Ramesh Hegde (Coastal Pharma), Shwetha Rao (Malnad Surgicals), Harish Acharya (Udupi MedSupply) | Quote on pooled bulk orders, see the negotiation for their own quote, deliver orders they win |

The reducer enforces these roles. For example, only a chemist of the same store can pack that store's orders.

## Flow status at a glance

| Flow | Rules and events | Screens |
|---|---|---|
| Add inventory (scan, type or choose medicine) | ✅ | ✅ |
| Eco-Sale | ✅ | ✅ |
| OTC order | ✅ | ✅ |
| Prescription order and OCR | ✅ | ✅ |
| Rider delivery with OTP | ✅ | ✅ |
| Rider navigation map, ETA and Call | ✅ | ✅ street map, offline route diagram |
| Chemist donates or disposes a batch | ✅ | ✅ |
| Customer donates or disposes (Civic hub) | ✅ | ✅ |
| Backhaul pickup suggestion | ✅ | ✅ appears when a customer-scheduled pickup is within about 600 m of a delivery |
| Pharmacy KYC | ✅ | ✅ |
| Blood booking and confirmation | ✅ | ✅ customer booking in the Civic hub; admin confirmation |
| Scratch cards | ✅ | ✅ canvas scratch with confetti, and a Reveal button |
| Certificates | ✅ | ✅ PDF with a QR code, plus a verify page |
| Write-off receipts for chemists | ✅ | ✅ PDF with the GST ITC reversal |
| Live order tracker for customers | ✅ | ✅ stepper, map, moving rider and ETA |
| Admin charts | ✅ | ✅ stock health, money recovered, platform activity |
| "Sponsor batch for NGO (₹99)" | ✅ | ✅ Deals card, Civic hub tracking, chemist QA badge and payout list |
| NGO fund | ✅ | ✅ Admin card and chart line; customers see their order's share. Spending it is not built yet |
| Server mode (real logins, shared data) | ✅ | ✅ `pharmaflow server`: password sign-in, data on the server, live sync |
| Languages (English, Kannada, Hindi) | ✅ | ✅ picker in the top bar; Add inventory, the Rx form and the rider map are still English |
| Installable app with an offline shell | ✅ | ✅ production build only |

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
    LOCKOUT --> EcoSale: "6-month alert → Put on Eco-Sale"
    LOCKOUT --> Donated: "Donate to NGO"
    EXPIRED --> Incinerated: "Yellow-Bag pickup"
    EcoSale --> Sold: "customer buys"
```

**The 6-month alert.** As soon as a batch has 6 months (180 days) or less left, it appears in the chemist's **Expiry alerts** panel with the offer that would clear it. Example for a ₹200 strip:

| | Amount |
|---|---|
| MRP | ₹200 |
| Eco-Sale price (15% off) | **₹170** paid by the customer |
| PharmaFlow fee (10% of the MRP) | ₹20 |
| The store receives | **₹150** a pack |

One click on **Put on Eco-Sale** lists it. Batches too close to expiry to sell (the course would not fit) are flagged instead, with a pointer to Donate or Dispose.

| Rule | Value |
|---|---|
| When | Only within **6 months of expiry**. Fresh stock always sells at full price |
| Discount | 15% to 60%. The suggestion is **15%** when the alert goes out, 50% under 90 days left, 60% under 45 days |
| Fee | PharmaFlow takes 10% of the **MRP**, also on Eco-Sale items, so the store gets the Eco-Sale price minus that fee |
| Eligibility | `days_left ≥ course_days + 15`, so the patient can finish the course before expiry |
| Never | Expired stock, Schedule X |
| Prescription | **Not bypassed.** An Eco-Sale Augmentin still needs a prescription |
| Over time | If time travel makes the course no longer fit, the deal disappears and cannot be bought |

Customers see: *Expires in 38 days • fits a 5-day course • 50% OFF*. Every medicine also has a fresh batch, so the shop keeps selling it at full price; when the Eco-Sale batch is the only stock left, the shop card offers it at the Eco-Sale price instead of saying out of stock.

## 3. Buying: forward order (OTC)

**The shop.** The demo store sells 46 items in six aisles, each with a drawn picture: **Medicines** (29), **Skin care** (sunscreens, face serums, face washes), **Women's hygiene** (sanitary pads), **Oral care** (toothbrushes, toothpaste), **Baby care** (diaper pants) and **First aid & devices** (syringes, bandages, antiseptic, a thermometer, glucose strips). The aisle chips above the list filter it and show how many items each aisle has; search works across all of them. Products outside Medicines are over the counter and carry their aisle as a badge. They have batches and expiry dates too, so they get the same 6-month alert and Eco-Sale.

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
- **Live tracking:** under *Orders*, an open order shows a 4-step progress bar (Placed, Packed, On the way, Delivered). Once a rider accepts it, a map shows the pharmacy, your home and the rider, with an ETA. The rider's movement is a simulation, not GPS.

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

**Actor:** Rider. **Screen:** Rider.

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

- **Navigation:** as soon as a rider has a mission, a street map shows every stop in order (store or pickup point, then the customer, QA store, NGO or CBWTF plant) as numbered pins, with the rider as a pulsing yellow dot. Below it: the next stop, distance, ETA (at about 25 km/h), a **Call** button (a made-up demo number) and an **Open in Maps** link. After a backhaul pickup is added the route simply grows. The dot glides toward the next stop while the rider is travelling and waits when the rider has arrived.
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
- A **customer** donates leftover strips from **Civic hub → Donate unused medicines**: choose the medicine, type the batch and expiry, tick sealed, pick the NGO and the pharmacy that checks the strips. The form warns live ("no registered doctor or pharmacist", "needs more than 30 days") and only enables the button when the rules pass. A **course-completion reminder** ("Finished your 5-day course of Dolo 650? Donate the unopened tablets left…") appears on the Civic hub once the course length has passed on the simulated clock, with a button that pre-fills the form.

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
    U->>A: Civic hub: choose blood bank, group and date (today or later)
    Ad->>A: Blood donation bookings: Confirm donation
    A-->>U: +500 karma, Blood Donor certificate, badge
```

India's policy is voluntary, unpaid blood donation, so the reward has **no money value**: no cashback, no scratch card, no wallet credit. The blood bank cards show each bank's **urgent blood groups**.

## 10. Rewards and certificates

| Action | Reward |
|---|---|
| Delivered order | Scratch card |
| Donation to an NGO (customer) | +200 karma, scratch card, NGO Donor certificate |
| Sponsoring a batch for an NGO | The same: +200 karma, scratch card, NGO Donor certificate (worded as sponsoring), earned when the NGO has the packs. A failed pharmacist check gives the ₹99 back as MedWallet credit instead |
| Safe disposal (customer) | +150 karma, Green Citizen certificate |
| Blood donation | +500 karma, Blood Donor certificate, badge |

**Scratch cards** are real: drag a mouse or finger across the silver coating. Once more than 40% is clear, the reward is revealed and confetti plays. A *Can't scratch? Reveal* button covers keyboard users. Cards give either karma or **MedWallet** credit, and the reward is fixed by the card id, so replaying the log always gives the same result. MedWallet is closed-loop store credit: it can be spent at checkout and can never be cashed out.

**Certificates** are listed under *Civic hub → My certificates* with a **PDF** button. Each PDF has the holder's name, the date, a verification code and a **QR code** that opens `/verify?code=…`. That page shows whether the code is valid and who it was awarded to. In demo mode it checks the data stored in the same browser.

**Chemist write-off receipts.** When a donation reaches an NGO, or expired stock is incinerated, the chemist's dashboard lists an *Inventory Write-Off & NGO Donation Receipt* with a **PDF** button. It shows each batch, its estimated cost value and the **GST ITC reversal** (CGST Sec 17(5)(h), 12% by default). It is never called an 80G receipt.

## 11. Time travel

The presenter bar moves the simulated date **forward only**: drag the slider or use +1 week, +1 month or +5 months.

What changes as the date moves:

- Batches move between SAFE, LOCKOUT, CRITICAL and EXPIRED.
- Eco-Sale deals vanish once the course no longer fits.
- Prescriptions and donation shelf life are re-checked when approved or verified.
- Seed stock expires quickly. After +5 months most of the starting inventory is expired, which is useful for showing disposal.

**Reset demo** clears everything in every open tab and returns the date to 8 Nov 2026.

## 12. Sponsoring a batch for an NGO, and the NGO fund

**Actors:** Customer (sponsors), the store's chemist, a rider, the NGO. **Screen:** Customer → *Deals* → **Sponsor batch for NGO (₹99)** on any card.

```mermaid
stateDiagram-v2
    [*] --> PLACED: customer sponsors (₹99 paid, packs set aside)
    PLACED --> DELIVERED: rider hands the packs to the NGO
    PLACED --> REFUNDED: chemist QA rejects the packs
    DELIVERED --> [*]: store paid, fund topped up, sponsor rewarded
    REFUNDED --> [*]: ₹99 back as MedWallet credit
```

1. The customer picks the NGO. The panel shows exactly what happens, for example: *"₹99 sponsors 10 packs for Seva NGO Clinic. ₹92 pays Sri Ganesh Medicals at the Eco-Sale price. ₹7 tops up the NGO fund."* The numbers come from the same rule the reducer re-checks.
2. The packs are set aside from the store's batch at once, and a rider mission appears **at the store** (not at the customer's home).
3. The rider accepts, arrives and collects. The chemist's **QA desk** then shows the packs with a *Sponsored* badge and the payout they will earn.
4. **QA verified** → the rider hands them to the NGO. **QA rejected** → the packs go to bio-disposal and the sponsor is refunded.

**What changes when the NGO has the packs**

| Who | What |
|---|---|
| Store | Paid the Eco-Sale price of the packs. Shown under *Sponsored for NGOs* on the chemist dashboard (packs delivered, paid, still on the way) |
| NGO fund | The change (for example ₹7) is added |
| Sponsor | +200 karma, a scratch card, and an **NGO Donor certificate** that says *Sponsored 10 packs of Okacet for Seva NGO Clinic* |
| Rider | Pickup pay, like any pickup |
| Admin | *Medicines to NGOs* counts the packs at MRP; the NGO fund card and chart line step up |

**Rules that can stop it**

- Only an **Eco-Sale** batch, only **OTC** medicines (a prescription-only deal shows *"needs a prescription, so only over-the-counter medicines can be sponsored"*), not cold-chain, and **more than 30 days** of shelf life left because the packs go on to an NGO.
- A pack that costs more than ₹99, or an empty batch, cannot be sponsored.
- If the batch has fewer packs left than ₹99 would buy, the sponsor gets those packs and the change in the fund is larger.
- It is a **sale** to the sponsor, so the store gets no donation write-off receipt or GST ITC reversal for these packs. (Rejected packs are written off as bio-disposal, as usual.)

**The NGO fund** is closed-loop money for medicines for NGOs, never cash. Two things feed it: sponsor change, and **2% of the platform's 10% fee on every delivered order** (demo values in `src/domain/rules/fund.ts`; the chemist's payout is never reduced). The Admin dashboard shows its balance, where it came from and recent entries. After a delivery the customer's order card says how much went in.

**Not built yet (designed):** an NGO login with a *needs list*, a chemist **NGO price** opt-in, and bulk buying from distributors at a cheaper rate, all paid from this fund. See [TODO.md](TODO.md).

---

## 13. Pooled bulk orders and dealer negotiation

Several stores often need the same item in bulk (for example 100 to 200 packs of syringes each). Alone, each store pays its distributor's usual trade price. Pooled, dealers compete for one large order.

```mermaid
sequenceDiagram
    participant C as Chemists (2+ stores)
    participant A as Admin
    participant D as Dealers
    participant B as Buyer's agent
    C->>A: Request bulk stock (joins one pool per item)
    A->>D: Ask for quotes, with a target and a ceiling price
    D->>A: Quote: asking price, lowest price, delivery days
    A->>B: Run the negotiation
    B-->>D: Up to 3 rounds with each dealer's agent
    A->>D: Award the best offer
    D->>C: Deliver: each store gets its share as a fresh batch
    A->>D: PharmaFlow pays the dealer for the whole order
    C->>A: Each store pays PharmaFlow its own share
```

| Step | Who | Rule |
|---|---|---|
| Request | Chemist of an approved store | 10 to 5,000 packs. One open pool per item; asking again replaces your quantity |
| Ask for quotes | Admin | At least 2 stores. Target > 0, ceiling between target and MRP. Defaults: target 65% of MRP, ceiling = usual trade price (80% of MRP) |
| Quote | Dealer | Asking price ≤ MRP, lowest price ≤ asking price, delivery 1 to 30 days. One quote per dealer, which it can update while the order is open |
| Negotiate | Admin starts it; agents run it | Round by round, the buyer's agent moves from the target to the ceiling (0%, 50%, 100% of the gap) and each dealer's agent moves from its asking price to its lowest price (40%, 75%, 100%). A deal closes as soon as the dealer's offer is no higher than the buyer's |
| Award | Admin | Only an agreed offer can win. The recommended one has the lowest **effective price**: agreed price + 0.5% per delivery day + 2% per rating star below five. The admin may choose another agreed offer |
| Deliver | The winning dealer | Batch number and at least 180 days of shelf life. Each store's share lands in its expiry ledger |
| Pay the dealer | Admin | After delivery, once: the whole order at the agreed price (for example 300 packs × ₹42.72 = ₹12,816) |
| Pay PharmaFlow | Chemist of each store in the pool | After delivery, once: only its own share (150 packs × ₹42.72 = ₹6,408) |
| Cancel | Admin | Any time before an award |

**Why the agents are rule-based, not an AI model:** the result has to be the same on every replay of the event log, it must be explainable to a chemist ("round 2: we offered ₹43.50, they offered ₹42.72"), and the app has no cloud services or API keys. The round-by-round table is shown to the admin and to each dealer for its own quote.

**Money flow:** PharmaFlow sits in the middle, so the dealer gets one payment for the whole order and does not chase several stores. The admin's Bulk orders tab shows what was paid to dealers, what came in from stores and what the stores still owe; each delivered order shows who has paid. No platform fee is added to the stores' shares (a demo choice; real money movement would need a payment gateway).

Screens: chemist dashboard → *Bulk orders with other stores*; the new **Dealer** role (`/dealer`); admin → **Bulk orders** tab. The admin's **Stores and orders** tab lists every store with its chemist, stock and orders, and every recent order with its rider.

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

### Laptop view or All 4

- **One role on its own** (the role tabs in the top bar) gives the roomy **laptop layout**: the customer has a sidebar and a multi-column shop and cart, the rider has the missions on the left and a large map on the right.
- **All 4** shows the compact **phone-style panes** side by side, so the whole loop is visible at once. Use it for step-by-step storytelling; switch to a single role to show one screen at full size.

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
| 8 | Customer | **Orders** tab → scratch the card with the mouse until about half is clear | Confetti, and karma or MedWallet credit appears |
| 9 | Customer | **Civic hub** → fill **Donate unused medicines** (for example Dolo 650, a batch number, an expiry more than 30 days away) → **Schedule free pickup**. Then Rider accepts, arrives, collects → Chemist **QA verified** → Rider **Hand over to NGO** | The pickup tracker follows each step. The customer gets +200 karma and an NGO Donor certificate: press **PDF** and show the QR code |
| 9b | Customer, Chemist, Rider | *Optional.* In **Deals** on the Eco-Sale card tap **Sponsor batch for NGO (₹99)** → **Sponsor now**. Rider accepts and collects **at the store** → Chemist **QA verified** → Rider **Hand over** | The store is paid, the **NGO fund** grows on the Admin page, and the customer gets +200 karma and a certificate that says *Sponsored N packs of …* |
| 10 | Browser | Scan the certificate's QR code, or open `/verify?code=…` | "Certificate is valid", with the holder's name |
| 11 | Customer, Admin | **Civic hub** → **Book appointment** for blood; then Admin → **Confirm donation** | +500 karma, a Blood Donor certificate and a badge, and no wallet credit |
| 12 | Admin | Show the **charts** and KPIs, then **Verify ledger integrity** | The money line has stepped up; "✅ Chain intact: N events verified" |

> Optional: after delivering an order, press **+1 week** in the top bar. The customer's Civic hub shows the course-completion reminder.

### Good questions to expect

| Question | Answer |
|---|---|
| "Is the prescription really checked?" | Yes, by rules in the reducer: fields, drug listed, date, validity window, quantity and single-use for antibiotics. The pharmacist still approves. OCR never approves |
| "Can someone edit history?" | Every event is chained with SHA-256. The Admin verify button recomputes the chain and flags the first changed event |
| "What happens to expired stock?" | Only the Yellow-Bag → CBWTF route is allowed |
| "Does it work offline?" | Everything except first-time OCR and the web font |
| "Where is the data?" | In the browser (IndexedDB). `npm run db:sample` shows the same data as SQL tables |
| "How do NGOs benefit?" | Three ways today: donated strips after a pharmacist's check, **sponsored packs** straight from a store's Eco-Sale batch, and an **NGO fund** (sponsor change plus a small share of the platform's fee). The fund can only buy medicines for NGOs |
| "Is the platform fee real?" | No, it is a demo number: 10% of the MRP of what is sold (₹20 on a ₹200 strip, even at the ₹170 Eco-Sale price), and 2% of that to the fund. It is one constant in `rules/fund.ts` |

---

## Developer workflow

```powershell
cd "C:\Users\cheth\OneDrive\Desktop\ALLMY_imp(s)\Pharma-flow"
pharmaflow test      # 284 tests, about three seconds
npm run test:e2e     # Playwright: four browser tabs and languages, uses your installed Chrome (starts its own dev server on :5199)
npm run test:e2e:pwa # builds the app and checks installability and offline use
npm run test:e2e:server  # builds the server version, starts the real server, checks logins and live sync
npm run typecheck    # strict TypeScript
pharmaflow server    # server mode: real logins, data in data\pharmaflow.db, on http://localhost:8787
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

**Adding text to a screen:** add the key to `src/i18n/en.json`, `kn.json` and `hi.json` (the test fails if the three differ), and use `t('section.key')` from `useTranslation()`. Do not put text in `src/domain`.

**Server mode while developing:** run `npm run server` (API on :8787) in one window and `npm run dev:server` (Vite on :5173, which proxies `/api` and `/ws`) in another. The server checks every event with the same reducer, so a rule change needs no server-side change.

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
| Server mode: "Wrong user or password" | Demo users share the password `pharmaflow` unless `PHARMAFLOW_DEMO_PASSWORD` was set when `data\pharmaflow.db` was first made. Delete the file to start over |
| Server mode: "Too many wrong passwords" | Wait a minute. Five wrong passwords lock that user for 60 seconds |
| Server mode: "Sign in as the admin first" | The presenter bar's time travel and Reset demo act as the admin. Sign in on the Admin tab of the same browser, then try again |
| Server mode: "The stored event log no longer replays" | A rule changed since the data was saved. Move `data\pharmaflow.db` aside and restart |
| Port 8787 already in use | Another copy of server mode is running, or set `PORT` to something else |
| Installing as an app is not offered | Use `npm run build` then `npm run preview` (the service worker is not built in `npm run dev`), open it on `localhost`, and look for Install in the address bar |
