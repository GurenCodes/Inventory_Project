# Floramagg Drinks Shop — Project Context & Handover

Single source of truth for developers and AI assistants (opencode / Nemotron). Replaces the earlier PROJECT_CONTEXT.md.
Last updated: 2026-10-07. State: after local commit `bfa125d` (not yet pushed).
Read sections 1–4 first, section 11 before touching git or the server, and section 12 before adding features.
Update sections 2, 12 and 13 at the end of every work session.

---

## 1. Purpose

Floramagg Business Ventures is a natural fruit juice producer and distributor in Yaoundé, Cameroon, selling mostly to local bars and restaurants. This project replaces paper-based stock and sales tracking.

- **What it is:** an internal web app for Floramagg staff (not a customer storefront), accessed online through a browser. Currently backend only.
- **Goals:** know current stock in crates and loose bottles; record a sale and update stock automatically; log supplier deliveries and increase stock automatically; see daily/weekly/monthly revenue without manual maths; restrict sensitive actions to Admins.
- **Design principle:** small business, favor the simpler option. Deliberately omitted: Purchase Order entity (each delivery is logged individually as ItemBatchOrder), Cashier role (only ADMIN and MANAGER exist).
- **Offline decision:** an offline-first phone app was considered and rejected. This is an online web app. Revisit only if the shop's internet proves unreliable.

## 2. Status

| Area | State |
|---|---|
| Schema, migrations, Aiven database | Done |
| Repositories (7 entities) | Done |
| Services (Product, Stock, Sale, Report, Auth, User) | Done, validated, tested |
| Password security | bcrypt (salt rounds 10), done |
| API stages 1–5 (health, login + JWT, products/stock, sales, reports) | Done, tested |
| Stage 6: error handling pass | **Done** |
| Stage 7: role-based restrictions | **Next** |
| Missing routes, hardening, deployment, frontend | Not started |

Git: `f77b278` committed locally, one commit ahead of origin/main, not pushed. Untracked `opencode_log.txt` is ignorable.

## 3. Stack and environment

- Node.js v24.19.0 (CommonJS), Express 5.2.x, Prisma **6.19.x**, PostgreSQL on Aiven (shared with a collaborator), jsonwebtoken 9, bcrypt 6, dotenv.
- Tools: VS Code, pgAdmin4, opencode 1.18.x using NVIDIA Nemotron 3 Ultra 550B. OS: Windows (PowerShell / cmd).
- `.env` (never commit): `DATABASE_URL` (Aiven string, `sslmode=require`), `JWT_SECRET`, optional `PORT` (default 3000). The Aiven database is named `defaultdb`.
- Commands: `npm start` | `npx prisma generate` (after any schema change) | `npx prisma migrate dev --name <name>` (dev) | `npx prisma migrate deploy` (hosted) | `node seed.js` (**DESTRUCTIVE**) | `node tests/<Name>.test.js`.
- Express 5 note: rejected promises in async route handlers are forwarded to error middleware automatically.

## 4. Architecture and conventions

Flow: HTTP route (`server.js`) → Service → Repository → Prisma → PostgreSQL.

```
Drinks-shop/
├── server.js                     all routes + JWT middleware (split into files later)
├── seed.js                       DESTRUCTIVE: wipes all tables, then seeds 10 rows each
├── InventoryManagement/
│   ├── Repository/   Product.js Stock.js ItemBatchOrder.js Sale.js SaleItem.js Report.js
│   └── Services/     ProductService.js StockService.js SaleService.js ReportService.js
├── UserManagement/
│   ├── Repository/   UserRepository.js
│   └── Services/     AuthService.js UserService.js
├── prisma/           schema.prisma, migrations/
├── tests/            *.test.js (run manually with node)
└── PROJECT_CONTEXT.md, .env, package.json
```

The folder is `Services` (plural). Rules:

- A repository touches **one table only** and exports an instance (`module.exports = new XRepository()`). Multi-table logic lives in a Service.
- Services validate **before any DB call** and throw structured errors (`ValidationError`, `NotFoundError`, `ConflictError`).
- Not-found: lookups (`getSale`, `getReportByDate`, `getStockForProduct`) return `null`; mutations on a missing record throw `NotFoundError`.
- Routes only translate HTTP ⇄ Service. No business logic in routes.
- Identity fields (`receivedById`, `soldById`, `generatedById`) always come from the token (`req.user.userId`), never the request body.
- Every route requires login except `GET /health` and `POST /auth/login`.
- Centralized error middleware in `server.js` handles all error responses.
- Authentication failures (missing/invalid/expired JWT) return `401` via `UnauthorizedError`.
- Unknown routes return `404` via `NotFoundError`.
- New files go in the matching domain folder. Don't create flat top-level folders.

## 5. Data model (7 tables) and why

| Entity | Fields | Why it is shaped this way |
|---|---|---|
| **Product** | name, category?, unitPrice, crateSize?, isActive (default true) | Catalog data that rarely changes. crateSize converts crates to bottles. Products are never deleted, only discontinued (`isActive=false`), to preserve history. |
| **Stock** | productId (unique), quantityBottles, quantityCrates, reorderLevel | Live state, one row per product, kept separate from Product because it changes on every sale and delivery. It is the **authoritative** inventory number, not derived from history. |
| **User** | fullName, email (unique), passwordHash, role (default MANAGER) | Staff accounts. Role is `ADMIN` or `MANAGER` only. |
| **ItemBatchOrder** | productId, receivedById, crateCount, bottleCount, costPerUnit, expiryDate?, receivedAt | History of deliveries (cost over time, expiry, who received). Not auto-decremented by sales. |
| **Sale** | soldById, totalAmount, createdAt, status (pending / completed / cancelled) | One checkout. The API creates sales directly as `completed`. |
| **SaleItem** | saleId, productId, quantityBottles, unitPrice, lineTotal | One line per product. Quantity is **always in bottles**. unitPrice is a snapshot so old sales stay accurate if prices change. |
| **DailyReport** | reportDate (unique), generatedById, totalSalesAmount | One row per day, total only. Item and order counts are derived from Sale/SaleItem on demand. Weekly/monthly views are date-range queries, not separate entities. |

Relations: Product 1–1 Stock, 1–many ItemBatchOrder, 1–many SaleItem. User 1–many ItemBatchOrder, Sale, DailyReport. Sale 1–many SaleItem.

## 6. Business logic (Services)

| Service | Functions | Notes |
|---|---|---|
| ProductService | registerProduct, updateProduct, getProductWithStock, listProducts(category) (all), listActiveProducts(category), discontinueProduct, restoreProduct | registerProduct creates the Product **and** its Stock row (0 bottles/crates). No hard delete. |
| StockService | receiveBatchOrder, getStockForProduct, listLowStock, adjustReorderLevel | receiveBatchOrder logs the batch and increases Stock in one `$transaction`, converting crates via crateSize. Low stock = `quantityBottles <= reorderLevel` (filtered in JS; Prisma can't compare two columns). |
| SaleService | completeSale, getSale, listSales(status), cancelSale | completeSale: validate every item → check stock for every item → one `$transaction` creating Sale + SaleItems and decrementing Stock. All-or-nothing. Total is computed server-side. |
| ReportService | generateDailyReport, getReportByDate, listReports | Sums **completed** sales only for the UTC day. One report per date. Today is allowed, future dates rejected. |
| AuthService | login, isAdmin, isManager | bcrypt compare, strips passwordHash. `requireAdmin()` does **not** exist yet (earlier docs wrongly listed it). |
| UserService | hashPassword, createUser, updatePassword, verifyPassword, getUserById, getUserByEmail, listUsers | Emails lowercased, hashes stripped from returns. No routes yet. |

## 7. API (server.js)

Auth: `POST /auth/login` {email, password} → `{token, user{id, fullName, email, role}}`. JWT payload `{userId, role}`, expires in 8h. Send `Authorization: Bearer <token>`. Middleware `authenticateToken` sets `req.user`.

| Method + path | Service call | Success |
|---|---|---|
| GET /health | — | 200 |
| GET /products?category=&includeInactive=true | listActiveProducts / listProducts | 200 |
| POST /products | registerProduct | 201 |
| POST /products/:id/discontinue | discontinueProduct | 200 |
| POST /products/:id/reactivate | restoreProduct | 200 |
| GET /stock/low | listLowStock | 200 |
| POST /stock/receive | receiveBatchOrder | 201 |
| POST /sales | completeSale | 201 |
| GET /sales?status= | listSales | 200 |
| GET /sales/:id | getSale | 200 / 404 |
| POST /sales/:id/cancel | cancelSale | 200 / 404 |
| POST /reports/daily {date} | generateDailyReport | 201 |
| GET /reports/:date | getReportByDate | 200 / 404 |
| GET /reports?start=&end= | listReports | 200 |

Status codes: 400 validation/duplicate report/conflict, 401 missing/invalid/expired authentication, 403 authenticated but forbidden (Stage 7), 404 not found, 500 unexpected (logged, generic message to client).

**Routes that do not exist yet:** update product, get one product with stock, get stock for a product, adjust reorder level, user management. `GET /products` does not include stock, but the catalog screen needs product + stock together.

## 8. Dates and timezones

- All dates are UTC. `reportDate` is stored at `00:00:00.000Z`; the sales window is that UTC day. "Today" = the server's UTC date. Future dates are rejected; today is accepted.
- Never use local-time methods (`setHours`, `setDate`) on dates. Use `setUTCHours`, `setUTCDate`, or ISO strings.
- Existing reports were originally stored at local midnight (23:00Z) and were shifted +1h to UTC midnight on 2026-10-06. `seed.js` now uses UTC.
- The shop is in WAT (UTC+1): sales between 00:00 and 00:59 local time count toward the previous UTC day, and closing out the new local day during that hour is rejected. Accepted for now (see K10).
- Prisma `Decimal` values serialize to JSON as **strings**. The frontend must parse them.

## 9. Testing

- Files in `tests/` (Product, Stock, Sale, Report, Auth/bcrypt). Run each with `node tests/<Name>.test.js`. No `npm test` script and no test runner yet.
- Output format per function: valid input, missing fields, invalid values, business rules, DB state verified by direct query, transaction integrity. Each marked PASS / FAIL / N/A.
- Conventions: `TEST_` prefix for test data; clean up in `try/finally`; each test uses its own non-colliding date (report tests use 2026-07-0x); assert the **specific** expected error message. A test that only checks "something threw" once passed because of a unique-constraint error, which is a false pass.
- Tests run against the live shared Aiven database (see K5).
- Last known: ReportService suite 17/17 pass, 0 leftover rows. StockService all pass. AuthService/UserService all pass. ProductService all pass (fixed zeroCrateSize validation per K12, fixed Decimal comparisons). SaleService passes when database is reachable (intermittent Aiven connectivity affects test runs; not a code issue).
- Seed logins (DEV ONLY, remove before go-live): `staff1`…`staff10@floramagg.com`, password `password_N`. Odd N = MANAGER, even N = ADMIN. IDs change on every reseed.

## 10. Working with the AI assistant (opencode)

Preferences of the project owner: plain-language explanation before code, step-by-step guidance, explain the purpose of each action, minimal surgical code changes.

- **Server:** the owner runs `npm start` in their own terminal and keeps it open. The assistant must **never** start, stop, restart or background the server (opencode's shell tool kills commands after 120 s). After code changes, the assistant asks for a restart. Use short per-request timeouts and split tests into several small commands.
- **Stale server on port 3000:** `Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`. A quick check that new routes are loaded: an unknown protected route returns 401 on new code, 404 on old code.
- **Git:** never push without the owner's explicit confirmation. Show `git status` and the proposed commit message first. Never commit logs, `.env`, or temp scripts. The assistant ignored this rule three times, so enforcement is in the opencode config: `"permission": {"bash": {"*": "allow", "git push": "ask", "git push *": "ask"}}`. Verify a permission prompt appears on `git push --dry-run origin main`.
- **Database safety:** no deletes/updates on the shared DB without showing the exact change first. Never run `seed.js` casually.
- **Checklist:** start each task with a 4–6 item one-line checklist and tick items as they finish.
- **opencode config:** `C:\Users\flore\.config\opencode\opencode.jsonc` holds the NVIDIA API key in plain text (provider `nvidia-custom`, key under `options.apiKey`; `auth.json` did not work). It lives outside the repo. Never copy it into the project.
- **opencode error** "Database is not empty and has no session table": close all processes, delete `%USERPROFILE%\.local\share\opencode`, relaunch.
- **PowerShell** "running scripts is disabled": use cmd, or `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`.

## 11. Setup lessons (avoid re-learning)

- Prisma 7 moved the DB URL out of `schema.prisma`; Prisma 5.22 breaks on Node 24. Use **Prisma 6**. Don't upgrade without being asked.
- Generator must be `provider = "prisma-client-js"`. The newer `prisma-client` emits TypeScript into `/generated` and breaks `require('@prisma/client')`.
- `prisma.config.ts` is a Prisma 7 leftover; it still works because it loads dotenv.
- Aiven service once showed "Rebuilding" and was unreachable ("failed to resolve host"). Check the service status first when connections fail.
- Stray folders `.claude/`, `.windsurf/`, `generated/` and duplicate `.gitignore` lines are harmless leftovers.

## 12. Known issues and risks

| ID | Priority | Issue | Suggested fix |
|---|---|---|---|
| K1 | HIGH | `completeSale` trusts the client-supplied `unitPrice`, so a user can sell at any price. | Read price from `Product.unitPrice` server-side; allow overrides for Admins only. |
| K2 | HIGH | Stock check happens outside the transaction, so two simultaneous sales can oversell and push stock negative. | Atomic conditional decrement inside the transaction (`updateMany where quantityBottles >= qty`, verify count). |
| K3 | HIGH | `cancelSale` has unclear semantics: it works on completed sales without restocking, and can cancel an already-cancelled sale. `pending` is never created by the API. | Decide policy: cancel = restock, allowed only from `completed`, Admin-only. |
| K4 | HIGH | No role enforcement: any logged-in user can do anything. | Stage 7. |
| K5 | HIGH | Dev, tests and `seed.js` all hit the shared production-style Aiven DB; `seed.js` wipes every table. | Create a separate dev/test database; make seed refuse to run without a `--force` flag. |
| K6 | MED | ~~Error mapping uses `err.message.includes(...)`; invalid/expired JWT returns 403 (should be 401); no central error middleware.~~ **RESOLVED in Stage 6** | ~~Stage 6: custom error classes + one error handler.~~ |
| K7 | MED | `quantityCrates` only increases (on delivery); sales never decrement it, so it drifts from bottles. | Derive crates from bottles ÷ crateSize, or maintain both consistently. Decide. |
| K8 | MED | Every file creates its own `new PrismaClient()` (about 12 connection pools); risks hitting the free-tier connection limit. | One shared `lib/prisma.js` instance. |
| K9 | MED | No user-management routes; users only via seed/scripts. | Admin-only create user / change password / list users. |
| K10 | MED | Shop day (UTC+1) vs UTC day offset of one hour. | A `BUSINESS_TZ` offset constant for day boundaries, or `@db.Date` for reportDate. |
| K11 | LOW | JWT role stays stale up to 8h after a role change; no logout or refresh. | Short expiry + refresh, or re-check role from DB on sensitive routes. |
| K12 | LOW | `crateSize` of 0 is allowed, so crate conversion silently yields 0 bottles. | Require positive integer or null. |
| K13 | LOW | `receiveBatchOrder` and `generateDailyReport` don't verify the user exists, so a raw foreign-key error can surface. | Check the user or map Prisma P2003 to a clear error. |
| K14 | LOW | No `npm test`, no runner. | Add Jest + supertest (`server.js` already exports `app`). |

## 13. Roadmap

1. **Stage 6 — error handling:** ~~custom error classes (Validation 400, NotFound 404, Conflict 400), one central error middleware, 401 for bad/expired tokens, 404 for unknown routes, remove string matching.~~ **COMPLETED**
2. **Stage 7 — roles:** `requireRole` middleware. Proposed matrix (confirm with Floramagg): Admin only = register/update/discontinue/reactivate product, adjust reorder level, cancel sale, user management. Admin + Manager = view everything, receive stock, complete sale, generate daily report.
3. **Stage 8 — missing routes and user management** (K9, section 7 gaps).
4. **Stage 9 — hardening:** K1, K2, K3, K7, K8, plus `helmet`, `cors`, login rate limiting, body size limit, request validation.
5. **Stage 10 — deployment:** API on Render (free tier sleeps after about 15 minutes idle, so the first request is slow), frontend on Vercel, Aiven for the DB.
6. **Frontend** (section 15).

Ideas for later: weekly/monthly report views, profit margin from `costPerUnit`, expiry alerts via `findExpiringBefore`, low-stock notifications (email/WhatsApp), CSV/PDF report export, audit log, price history, barcode scanning, OpenAPI docs.

## 14. Pre-deployment checklist

- [ ] Remove or change all seeded logins and passwords; create real Admin accounts.
- [ ] Strong `JWT_SECRET`; set all env vars on the host (never commit `.env`).
- [ ] Resolve K1–K5.
- [ ] CORS limited to the frontend's origin; `helmet`; login rate limiting.
- [ ] Build step runs `npx prisma generate`; schema applied with `npx prisma migrate deploy`.
- [ ] Separate dev and production databases; Aiven backups understood.
- [ ] Decide timezone handling (K10) before the first real daily close-out.

## 15. Intended screens (for the frontend)

1. Login. 2. Catalog/dashboard: products with current stock and low-stock warnings. 3. Register product (Admin). 4. Log a delivery (product, crates, bottles, cost, expiry). 5. Checkout: pick products and quantities in bottles, clear error if stock is insufficient, nothing partially saved. 6. Sales history, filterable by status. 7. Daily close-out button. 8. Reports view over a date range (weekly/monthly built from daily rows).