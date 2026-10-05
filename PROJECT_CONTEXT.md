# Floramagg Drinks Shop — Inventory & Sales Management System

This file exists to give an AI coding assistant (opencode / Nemotron) full context on
this project before helping with any task. Read this before making changes —
it explains not just *what* exists, but *why* it was built this way, so suggestions
stay consistent with the existing design rather than reinventing decisions that were
already made deliberately.

---

## 1. Project Goal

Floramagg Business Ventures is a real natural fruit juice production and distribution
business that sells mostly to local bars and restaurants. This project replaces their
manual/paper-based stock and sales tracking with a proper software system.

**What this is:** a backend system — database schema, data-access layer, and business
logic — for managing drinks inventory, sales, and daily reporting.

**What this is NOT (yet):** a finished app with screens. There is no frontend built
yet. The current phase is entirely backend (API layer and UI come later, see Section 8).

**End goal:** a small, practical internal tool for Floramagg's own staff (not a
customer-facing storefront) to:
- Know exactly how much stock of each drink they have, in both crates and loose bottles
- Record a sale quickly and have stock update automatically and correctly
- Log deliveries from suppliers and have stock increase automatically
- See daily/weekly/monthly revenue without manual calculation
- Control who can do what, based on whether they're an Admin or a Manager

This is intentionally built for a **small business**, not enterprise scale. Decisions
favor simplicity over completeness — e.g., we deliberately did NOT build a separate
"Purchase Order" entity, because for this business's size, logging each delivery
individually (ItemBatchOrder) is enough; a formal PO workflow would be unnecessary
complexity for how Floramagg actually operates.

---

## 2. Tech Stack

- **Runtime:** Node.js (v24.19.0)
- **ORM:** Prisma 6 (NOT Prisma 7 — see Section 7, Conventions, for why)
- **Database:** PostgreSQL, hosted on Aiven (cloud), shared between two collaborators
- **DB GUI:** pgAdmin4
- **Architecture pattern:** layered — Repository → Service → (API layer, not yet built)

---

## 3. Entities — What They Are and Why

Each entity below maps to one Prisma model and one PostgreSQL table. The reasoning
for each is included because several of these shapes were deliberately chosen over
alternatives — don't "fix" them without understanding why they're built this way.

### Product
Represents one drink the business sells (e.g. "Tusker Lager 500ml").

| Field | Type | Why |
|---|---|---|
| name | String (required) | Core identity of the product |
| category | String (optional) | e.g. "Beer", "Soft Drink" — optional since not every product needs grouping |
| unitPrice | Decimal (required) | Price per single bottle |
| crateSize | Int (optional) | How many bottles make up one crate for this product — used to convert crate counts to bottle counts. Optional because some products might not be sold by the crate at all |

**User-facing expectation:** this is the product catalog — what a staff member sees
when choosing what to sell or restock. Each product shown should display its current
stock alongside it (joined from the Stock table).

### Stock
The **single source of truth** for how much of a product currently exists. One Stock
row per Product (enforced via `@unique` on productId).

| Field | Type | Why |
|---|---|---|
| quantityBottles | Int | Loose bottle count |
| quantityCrates | Int | Full crate count, tracked **separately** from bottles — a deliberate decision, not just bottles-only, because staff think and count in both crates and loose bottles in real life |
| reorderLevel | Int | Threshold below which a product should be flagged as "low stock" |

**Why Stock is separate from Product, not just columns on Product:** Stock represents
mutable, frequently-changing state (changes on every sale and every delivery), while
Product represents mostly-static catalog information (name, price). Separating them
keeps the "things that change often" isolated from "things that rarely change."

**Important design decision:** Stock is **not automatically derived** from
ItemBatchOrder and SaleItem history — it is the authoritative, directly-updated
number. ItemBatchOrder and SaleItem are historical records; Stock is live state.
This was chosen for simplicity and speed (no need to sum all historical rows to know
current stock) — but it means Stock updates must happen correctly and atomically
whenever a sale or delivery occurs (see StockService/SaleService in Section 6).

**User-facing expectation:** this is what powers a "how much do we have" view, and a
low-stock warning/alert list (products at or below reorderLevel).

### User
A staff account.

| Field | Type | Why |
|---|---|---|
| fullName | String (required) | Display name |
| email | String (required, unique) | Login identifier |
| passwordHash | String (required) | Stores bcrypt hash of the user's password (salt rounds = 10). Never plain text. |
| role | String, default "MANAGER" | Only two values are used in practice: `ADMIN` and `MANAGER` |

**Why only two roles, no "Cashier":** this was a deliberate scope decision — the
business doesn't need a third tier of restricted-access staff; Admin and Manager
cover the actual distinction needed (who can do sensitive actions like registering
products vs. who does day-to-day operations).

**User-facing expectation:** a login screen, and role should gate which buttons/pages
a user can see/use (e.g. only Admin can register a new product — this restriction is
designed but not yet fully wired into every service function, see Section 8).

### ItemBatchOrder
A record of one delivery/restock event from a supplier.

| Field | Type | Why |
|---|---|---|
| productId | Int (required) | Which product arrived |
| receivedById | Int (required) | Which staff member logged it |
| crateCount | Int, default 0 | Crates received in this delivery |
| bottleCount | Int, default 0 | Loose bottles received in this delivery |
| costPerUnit | Decimal (required) | What was paid per bottle — needed for margin/cost tracking later |
| expiryDate | DateTime (optional) | Not every product needs expiry tracking, so optional |
| receivedAt | DateTime, auto-set | When logged, not manually entered |

**Why this exists separately from Stock, rather than Stock just being edited
directly:** this preserves a *history* of deliveries — supplier cost over time, expiry
tracking, who received what and when. Stock only tells you the current total; this
tells you how it got there.

**User-facing expectation:** a "log a delivery" form (product, crates, bottles, cost,
expiry, who received it) — submitting it should both create this record AND increase
Stock in the same action (already implemented as `StockService.receiveBatchOrder()`).

### Sale
One transaction/checkout event.

| Field | Type | Why |
|---|---|---|
| soldById | Int (required) | Which staff member made the sale |
| totalAmount | Decimal (required) | Sum of all its SaleItems' line totals |
| status | String, default "pending" | "pending" → "completed" → or "cancelled" |
| createdAt | DateTime, auto-set | Timestamp |

**User-facing expectation:** this is the receipt/checkout record. A "status" exists
because a sale might be started (pending) before being finalized (completed) — e.g. a
cart being built up before checkout is confirmed.

### SaleItem
One line within a Sale — one product and quantity sold in that transaction. A Sale
can have many SaleItems (e.g. a customer buys 3 different drinks in one transaction).

| Field | Type | Why |
|---|---|---|
| saleId | Int (required) | Which sale this belongs to |
| productId | Int (required) | Which product was sold |
| quantityBottles | Int (required) | **Always expressed in bottles**, even if sold by the crate — this was a deliberate normalization decision so reporting/stock math never has to handle mixed units at the line-item level |
| unitPrice | Decimal (required) | Price at time of sale — stored as a snapshot, not looked up live from Product, so historical sales remain accurate even if Product price changes later |
| lineTotal | Decimal (required) | quantityBottles × unitPrice |

**User-facing expectation:** this is what a receipt's line items look like — "6x
Tusker Lager @ 150 = 900."

### DailyReport
One row per calendar day, summarizing that day's sales.

| Field | Type | Why |
|---|---|---|
| reportDate | DateTime (required, unique) | One report per date — generating twice for the same date should fail/be blocked |
| generatedById | Int (required) | Who ran the report |
| totalSalesAmount | Decimal (required) | Sum of all completed Sales for that date |

**Deliberately minimal:** this table does NOT store item counts, order counts, or any
other breakdown — those are considered "derivable" data, calculated on-demand from
Sale/SaleItem via a date-filtered query, rather than duplicated/stored here. This
keeps DailyReport simple and avoids the two data sources (Sale table vs DailyReport
table) ever disagreeing with each other.

**User-facing expectation:** an end-of-day "close out" action an Admin/Manager runs
once, producing a permanent daily total. A weekly/monthly view would query a *range*
of DailyReports, not require a separate WeeklyReport/MonthlyReport entity.

---

## 4. Entity Relationships (plain summary)

- One **Product** has one **Stock** record, many **ItemBatchOrders** (delivery
  history), and many **SaleItems** (sales history)
- One **User** can create many **ItemBatchOrders**, many **Sales**, and many
  **DailyReports**
- One **Sale** has many **SaleItems**
- **Stock** is the only "live" number; everything else is either catalog data
  (Product) or historical record-keeping (ItemBatchOrder, Sale, SaleItem,
  DailyReport)

---

## 5. Folder Structure & Conventions

```
Drinks-shop/
├── InventoryManagement/
│   ├── Repository/        (Product.js, Stock.js, ItemBatchOrder.js, Sale.js, SaleItem.js, Report.js)
│   └── Service/           (ProductService.js, StockService.js, SaleService.js, ReportService.js)
├── UserManagement/
│   ├── Repository/        (UserRepository.js)
│   └── Service/           (AuthService.js, UserService.js)
├── prisma/
│   └── schema.prisma
├── .env                   (DATABASE_URL — Aiven connection string)
└── seed.js
```

**Convention rules to follow:**
- The project is split into two **domains**: `InventoryManagement` and
  `UserManagement`. New files belong in whichever domain they logically fit — don't
  create a flat top-level folder for new code.
- Repositories are named after the entity (e.g. `Product.js`, not
  `productRepository.js`) and live in a domain's `Repository/` folder.
- Services are named `<Entity>Service.js` and live in a domain's `Service/` folder.
- Services `require()` their repositories using relative paths like
  `require('../Repository/Product')`.
- Every repository exports a single instance:
  `module.exports = new ProductRepository();` — not the class itself.
- **A repository only ever touches ONE table.** If an action needs to coordinate
  multiple tables (e.g. "receiving a delivery" touches both ItemBatchOrder and
  Stock), that coordination logic belongs in a **Service**, not a repository.

**Prisma version note:** Prisma 7 changed how `DATABASE_URL` is configured (moved
out of `schema.prisma` into a separate config file) and had compatibility issues with
Node v24. This project deliberately uses **Prisma 6**, which keeps the simpler
`url = env("DATABASE_URL")` line directly inside `datasource db` in `schema.prisma`.
Do not suggest upgrading to Prisma 7 without being asked.

---

## 6. Business Logic Already Implemented (Service Layer)

Each service wraps one or more repositories and contains validation + coordination
logic. All public-facing functions throw a plain `Error` with a clear message (e.g.
"Unit price is required") for missing/invalid required fields, BEFORE any database
call is attempted — this is the established pattern for all future service functions
too.

- **ProductService.registerProduct()** — creates a Product AND its matching Stock
  row (starting at 0) together, since the schema assumes every Product has exactly
  one Stock row.
- **StockService.receiveBatchOrder()** — logs an ItemBatchOrder AND increases Stock
  in one Prisma `$transaction` (all-or-nothing — if either write fails, both roll
  back). Converts crates to bottles using the product's own `crateSize` before
  adding to Stock.
- **StockService.listLowStock()** — returns products where `quantityBottles <=
  reorderLevel` (calculated in JS, not SQL, since Prisma can't compare two columns
  of the same row directly in a `where` clause).
- **SaleService.completeSale()** — the core checkout flow: validates every line item
  first, checks there's enough stock for EVERY item before writing anything, then
  creates the Sale + all SaleItems + decrements Stock for each, all inside one
  `$transaction`. This ordering (validate everything → check everything → write
  everything) is intentional, to avoid partial sales where some items get sold and
  others fail.
- **ReportService.generateDailyReport()** — pulls all Sales for a given date with
  `status: 'completed'`, sums `totalAmount`, saves as one DailyReport row.
- **AuthService.login()** — checks email/password using `bcrypt.compare()` against the stored hash, returns the user object with `passwordHash` stripped out.
- **AuthService.requireAdmin() / isAdmin() / isManager()** — role-check helpers, designed to be called at the start of any service function that should be restricted — not yet applied to every function that should use them (see Section 8).
- **UserService.createUser()** — creates a new user with password securely hashed via bcrypt (salt rounds = 10). Handles email normalization (lowercase), validation, and duplicate detection.
- **UserService.verifyPassword()** — low-level helper to verify a plain-text password against a stored bcrypt hash.
- **UserService hashPassword() / updatePassword() / getUserById() / getUserByEmail() / listUsers()** — user management utilities; all lookup methods strip `passwordHash` from returned objects.

---

## 7. How This Should Eventually Be Used (User-Facing Expectations)

No frontend exists yet, but the services were designed with these real screens/flows
in mind — when building an API layer or UI, these are the intended user journeys:

1. **Login screen** — email + password → `AuthService.login()`.
2. **Product catalog / dashboard** — list of products with current stock
   (`ProductService.getProductWithStock()` / `listProducts()`), showing a visual
   warning for anything in `StockService.listLowStock()`.
3. **Register product (Admin only)** — simple form → `ProductService.registerProduct()`.
4. **Log a delivery** — form with product, crates, bottles, cost, expiry →
   `StockService.receiveBatchOrder()`.
5. **Checkout / make a sale** — pick products + quantities (in bottles) →
   `SaleService.completeSale()` — should show a clear error if stock is insufficient
   for any item, without partially completing the sale.
6. **Sales history** — `SaleService.listSales()` / `getSale()`, filterable by status.
7. **Daily close-out (Admin/Manager)** — a button run once at end of day →
   `ReportService.generateDailyReport()`.
8. **Reports view** — date range → `ReportService.listReports()`, used to build
   weekly/monthly views without needing separate report entities.

---

## 8. What's NOT Built Yet (Do Not Assume These Exist)

- **API layer** (e.g. Express routes/controllers) — services exist but nothing
  currently exposes them over HTTP.
- **Frontend** — no UI of any kind yet.
- **Role-based restrictions are not yet enforced inside most service functions.**
  `AuthService` has the tools (`requireAdmin()`, etc.) but individual service
  functions (like `registerProduct`) don't yet call them — this needs to be added
  deliberately per-function, matched to which actions should actually be
  Admin-only vs. open to any logged-in staff.
- **No tests** have been written yet.

---

## 9. General Guidance for the AI Assistant

- Follow the existing folder/naming conventions (Section 5) for any new file.
- Keep repositories single-table; put any multi-table coordination or business rule
  in the matching Service file.
- Match the existing validation style (explicit checks with clear `Error` messages,
  before any database call) when adding new service functions.
- Don't introduce new entities or restructure existing ones without first
  explaining the tradeoff — several shapes here (e.g. Stock separate from Product,
  SaleItem always in bottles, DailyReport storing only a total) were deliberate
  simplifications for a small business, not oversights.
- When in doubt about scope, favor the simpler option — this project is intentionally
  built for a small juice/drinks distribution business, not designed for
  enterprise scale.
