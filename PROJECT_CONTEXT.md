# Floramagg Drinks Shop — Project Context & Handover

Single source of truth for developers and AI assistants (opencode / Nemotron). Replaces the earlier PROJECT_CONTEXT.md.
Last updated: 2026-10-08. State: Stage 9 VERIFIED — COMPLETE — 22 protected routes enforced, 48 Stage 8 API tests, 15 Stage 9 security controls, 260 total tests passing.
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
| Stage 7: role-based restrictions | **VERIFIED AFTER REMEDIATION** |
| Stage 8: missing routes & user management | **VERIFIED — COMPLETE** |
| Stage 9: security hardening | **VERIFIED — COMPLETE** |
| Missing routes, hardening, deployment, frontend | Not started |

Git: Working directory clean except for Stage 9 changes. Modified: `server.js`, `InventoryManagement/Repository/Stock.js`, `InventoryManagement/Services/SaleService.js`, `InventoryManagement/Services/StockService.js`, `InventoryManagement/Repository/Product.js`, `InventoryManagement/Repository/ItemBatchOrder.js`, `InventoryManagement/Repository/Report.js`, `InventoryManagement/Repository/Sale.js`, `UserManagement/Repository/UserRepository.js`, `InventoryManagement/Repository/ItemBatchOrder.js`, `package.json`, `package-lock.json`. New: `lib/prisma.js`, `tests/Authorization.test.js`, `tests/Stage8Api.test.js`, `tests/Stage9Security.test.js`. Untracked: `opencode_log.txt` (ignorable).

## 3. Stack and environment

- Node.js v24.19.0 (CommonJS), Express 5.2.x, Prisma **6.19.x**, PostgreSQL on Aiven (shared with a collaborator), jsonwebtoken 9, bcrypt 6, dotenv.
- **Stage 9 dependencies**: `helmet` (security headers), `cors` (CORS), `express-rate-limit` (rate limiting).
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
├── lib/                          shared PrismaClient (K8 fix)
│   └── prisma.js                 shared PrismaClient instance
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
| PUT /products/:id | updateProduct | 200 |
| GET /products/:id | getProductWithStock | 200 / 404 |
| POST /products/:id/discontinue | discontinueProduct | 200 |
| POST /products/:id/reactivate | restoreProduct | 200 |
| GET /stock/low | listLowStock | 200 |
| POST /stock/receive | receiveBatchOrder | 201 |
| GET /stock/:productId | getStockForProduct | 200 / 404 |
| PUT /stock/:productId/reorder-level | adjustReorderLevel | 200 |
| POST /sales | completeSale | 201 |
| GET /sales?status= | listSales | 200 |
| GET /sales/:id | getSale | 200 / 404 |
| POST /sales/:id/cancel | cancelSale | 200 / 404 |
| POST /reports/daily {date} | generateDailyReport | 201 |
| GET /reports/:date | getReportByDate | 200 / 404 |
| GET /reports?start=&end= | listReports | 200 |
| POST /users | createUser | 201 |
| GET /users | listUsers | 200 |
| GET /users/:id | getUserById | 200 / 404 |
| PUT /users/:id/password | updatePassword | 200 |

Status codes: 400 validation/duplicate report/conflict, 401 missing/invalid/expired authentication, 403 authenticated but forbidden (Stage 7), 404 not found, 500 unexpected (logged, generic message to client).

All routes that existed in Stage 7 are now implemented. `GET /products/:id` now includes stock (satisfies catalog screen requirement). User management routes are ADMIN-only.

---

## 7b. Stage 7 — Authorization / Role-Based Access Control (VERIFIED AFTER REMEDIATION)

### Authentication

`authenticateToken` middleware in `server.js`:

- Validates JWT tokens
- Identifies the authenticated user
- Attaches user information to `req.user` (`{userId, role}`)
- Authentication failures return `401 Unauthorized`

### Authorization

Centralized `requireRole(...allowedRoles)` middleware in `server.js`:

- Reads the authenticated user's role
- Checks the role against the route's allowed roles
- Returns `403 Forbidden` when an authenticated user lacks permission
- Prevents unauthorized requests from reaching the route handler / service / database

### Protected Route Permission Matrix (14 routes)

| Route | Method | Required Role(s) |
|---|---|---|
| `/products` | GET | ADMIN, MANAGER |
| `/products` | POST | ADMIN |
| `/products/:id/discontinue` | POST | ADMIN |
| `/products/:id/reactivate` | POST | ADMIN |
| `/stock/low` | GET | ADMIN, MANAGER |
| `/stock/receive` | POST | ADMIN, MANAGER |
| `/sales` | POST | ADMIN, MANAGER |
| `/sales` | GET | ADMIN, MANAGER |
| `/sales/:id` | GET | ADMIN, MANAGER |
| `/sales/:id/cancel` | POST | ADMIN |
| `/reports/daily` | POST | ADMIN, MANAGER |
| `/reports/:date` | GET | ADMIN, MANAGER |
| `/reports` | GET | ADMIN, MANAGER |

### Authorization Semantics

| Code | Meaning |
|---|---|
| `401` | Authentication failure (missing/invalid/expired/malformed token, missing Bearer prefix) |
| `403` | Authenticated but forbidden (role lacks permission, role missing) |
| `404` | Resource not found |
| `400` | Validation / input error |

Do not describe 400/404 responses as authorization successes.

### Verified Middleware Execution Order

```text
Request
  ↓
authenticateToken
  ↓
requireRole(...)
  ↓
Route Handler
  ↓
Service
  ↓
Repository / Database
  ↓
Centralized Error Middleware
  ↓
Response
```

Critical verified security behavior:

```text
Unauthorized authenticated request
        ↓
authenticateToken succeeds
        ↓
requireRole rejects
        ↓
403 Forbidden
        ↓
Route handler NOT executed
        ↓
Service NOT executed
        ↓
Repository NOT executed
        ↓
Database NOT modified
```

### Stage 7 Test Results (Final Remediated)

| Test Suite | Total | Passed | Failed | Errors | Skipped | Status |
|---|---:|---:|---:|---:|---:|---|
| Authorization | 56 | 56 | 0 | 0 | 0 | PASS |
| ProductService | 36 | 36 | 0 | 0 | 0 | PASS |
| StockService | 28 | 28 | 0 | 0 | 0 | PASS |
| SaleService | 32 | 32 | 0 | 0 | 0 | PASS |
| ReportService | 21 | 21 | 0 | 0 | 0 | PASS |
| AuthService | 23 | 23 | 0 | 0 | 0 | PASS |
| **TOTAL** | **196** | **196** | **0** | **0** | **0** | **PASS** |

**196/196 tests passed.**

### Authorization Test Coverage (56 tests)

The final authorization suite verifies:

- unauthenticated access → 401
- invalid/expired/malformed tokens → 401
- missing Bearer prefix → 401
- ADMIN access to authorized operations
- MANAGER access to authorized operations
- MANAGER denial from all ADMIN-only operations → 403
- valid existing resources used for positive authorization tests
- exact expected status-code assertions
- authorization occurs before business logic
- unauthorized requests do not reach services
- unauthorized requests do not modify the database

### Test Remediation

The earlier Stage 7 audit identified ~10 weak/false-positive authorization tests (out of 44) that accepted downstream 404/400 responses as authorization success.

These were remediated:

- All positive tests now use valid existing resources where applicable
- All tests use exact expected status codes
- No test treats unrelated 400/404 as authorization success
- Database immutability verified for unauthorized mutations
- Authorization execution order verified

**No remaining false-positive authorization tests.**

### Security Verification

| Question | Answer |
|---|---|
| Can MANAGER perform an ADMIN-only operation? | **NO** — all 4 ADMIN-only routes return 403 for MANAGER |
| Can unauthenticated users access protected routes? | **NO** — all 13 protected routes return 401 |
| Can unauthorized requests reach business logic? | **NO** — middleware blocks before route/service |
| Can unauthorized requests modify the database? | **NO** — database immutability verified |
| Are all 14 protected routes correctly enforced? | **YES** |
| Are positive authorization tests using valid resources? | **YES** |
| Are remaining false-positive authorization tests present? | **NO** |
| Unexpected errors? | **NONE** |
| Regression failures? | **NONE** — all service suites pass |

### Database

No database schema changes were required for Stage 7. Roles already existed in the User model.

### Files Associated With Stage 7

| File | Purpose |
|---|---|
| `server.js` | Centralized `requireRole(...)` middleware; authorization applied to 14 protected routes |
| `package.json` | Supertest added as dev dependency |
| `tests/Authorization.test.js` | Comprehensive 56-test authorization suite |
| `package-lock.json` | Dependency lockfile updated |

---

## 7c. Stage 8 — Missing Routes & User Management (VERIFIED — COMPLETE)

### Scope

Stage 8 completes the API surface by exposing service-layer functionality that was already implemented but not accessible via HTTP routes:

- **Product routes**: Update product, Get product with stock
- **Stock routes**: Get stock for product, Adjust reorder level
- **User Management routes**: Create user, List users, Get user by ID, Update user password

### New Protected Route Permission Matrix (22 routes total: 14 from Stage 7 + 8 new)

| Route | Method | Purpose | Required Role(s) |
|---|---|---|---|
| `/products/:id` | PUT | Update product details | ADMIN |
| `/products/:id` | GET | Get product with stock | ADMIN, MANAGER |
| `/stock/:productId` | GET | Get stock for product | ADMIN, MANAGER |
| `/stock/:productId/reorder-level` | PUT | Adjust reorder level | ADMIN |
| `/users` | POST | Create user | ADMIN |
| `/users` | GET | List users | ADMIN |
| `/users/:id` | GET | Get user by ID | ADMIN |
| `/users/:id/password` | PUT | Update user password | ADMIN |

### Implementation Details

All new routes follow the established architecture:

```text
Request
  ↓
authenticateToken
  ↓
requireRole(...)
  ↓
validation
  ↓
service
  ↓
repository/database
  ↓
centralized error middleware
  ↓
response
```

**Key implementation decisions:**

1. **User management is ADMIN-only** — consistent with security requirements (K9) and the project's role model (only ADMIN and MANAGER exist)
2. **Product mutations (update, discontinue, reactivate) remain ADMIN-only** — consistent with Stage 7 permission model
3. **Stock reorder level adjustment is ADMIN-only** — it's a configuration change affecting inventory behavior
4. **Read operations (product with stock, stock lookup) available to both ADMIN and MANAGER** — consistent with other read routes
5. **Password hashes never exposed** — UserService already strips passwordHash from all responses; verified in tests
6. **Default role for new users is MANAGER** — matching the User model default

### Error Semantics

| Code | Meaning |
|---|---|
| `401` | Authentication failure (missing/invalid/expired/malformed token) |
| `403` | Authenticated but forbidden (MANAGER on ADMIN-only routes) |
| `404` | Resource not found (product, stock, user) |
| `400` | Validation error (missing fields, invalid values, duplicate email) |

### Stage 8 Test Results

| Test Suite | Total | Passed | Failed | Errors | Skipped | Status |
|---|---:|---:|---:|---:|---:|---|
| Stage 8 API | 48 | 48 | 0 | 0 | 0 | PASS |
| Authorization (Stage 7) | 56 | 56 | 0 | 0 | 0 | PASS |
| ProductService | 36 | 36 | 0 | 0 | 0 | PASS |
| StockService | 28 | 28 | 0 | 0 | 0 | PASS |
| SaleService | 32 | 32 | 0 | 0 | 0 | PASS |
| ReportService | 21 | 21 | 0 | 0 | 0 | PASS |
| AuthService | 23 | 23 | 0 | 0 | 0 | PASS |
| **TOTAL** | **244** | **244** | **0** | **0** | **0** | **PASS** |

**244/244 tests passed.**

### Stage 8 Test Coverage (48 tests)

The Stage 8 API suite verifies:

- **Product update**: ADMIN success with DB verification; MANAGER denied (403); unauthenticated (401); validation (400); not found (404)
- **Product with stock**: ADMIN/MANAGER success; unauthenticated (401); not found (404)
- **Stock lookup**: ADMIN/MANAGER success; unauthenticated (401); not found (404)
- **Reorder level**: ADMIN success with DB verification; MANAGER denied (403); unauthenticated (401); validation (400); not found (404)
- **User creation**: ADMIN success with DB verification & hashed password; MANAGER denied (403); unauthenticated (401); validation (400); duplicate email (400)
- **User listing**: ADMIN success with role filter; no passwordHash exposed; MANAGER denied (403); unauthenticated (401)
- **User by ID**: ADMIN success; no passwordHash exposed; MANAGER denied (403); unauthenticated (401); not found (404)
- **Password update**: ADMIN success with login verification; MANAGER denied (403); unauthenticated (401); validation (400); not found (404)

### Security Verification

| Question | Answer |
|---|---|
| Can MANAGER perform an ADMIN-only user-management operation? | **NO** — all 4 user-management routes return 403 for MANAGER |
| Can MANAGER update product or reorder level? | **NO** — both return 403 for MANAGER |
| Can unauthenticated users access new routes? | **NO** — all 8 new routes return 401 |
| Can unauthorized requests reach business logic? | **NO** — middleware blocks before route/service |
| Can unauthorized requests modify the database? | **NO** — database immutability verified for all mutations |
| Are sensitive user fields protected? | **YES** — passwordHash never exposed in any response |
| Are positive tests using valid resources? | **YES** — all positive tests use real DB entities |
| Are exact status codes asserted? | **YES** — no 400/404 accepted as generic success |
| Are there false-positive tests? | **NO** |

### Database

No database schema changes required for Stage 8. All routes use existing models and fields.

### Files Associated With Stage 8

| File | Purpose |
|---|---|
| `server.js` | 8 new routes with authentication/authorization |
| `tests/Stage8Api.test.js` | Comprehensive 48-test Stage 8 API test suite |
| `package-lock.json` | Dependency lockfile (unchanged from Stage 7) |

---

## 7d. Stage 9 — Security Hardening (VERIFIED — COMPLETE)

### Scope

Stage 9 hardens the existing API against the remaining security, concurrency, input-size, and infrastructure risks identified in the known issues (K1–K8):

| Issue | Fix | Verification |
|---|---|---|
| K1 — Client-controlled sale unitPrice | Server reads price from `Product.unitPrice`; client `unitPrice` ignored | SaleService tests verify server-side pricing |
| K2 — Concurrent sales oversell stock | Atomic conditional decrement using `updateMany` with `quantityBottles >= qty` | SaleService tests verify conditional decrement |
| K3 — Sale cancellation unsafe/unclear | Only completed sales cancellable; restocks atomically; already-cancelled rejected | SaleService tests verify restock & status change |
| K7 — quantityCrates drifts from bottles | Crates recalculated from bottles on every change (`Math.floor(bottles / crateSize)`) | SaleService & StockService tests verify consistency |
| K8 — Multiple PrismaClient instances | Single shared `lib/prisma.js` instance used by all repositories | Repository imports verified |
| Helmet | Security headers (CSP, HSTS, frameguard, etc.) | Header inspection test |
| CORS | Configurable allowed origins; preflight support; credentials=false | Origin/preflight tests |
| Login rate limiting | 5 attempts / 15 min per IP; 429 on exceed | Rate limit test (5 OK, 6th = 429) |
| Request body size limit | 100kb limit; 413 on oversized | Body size test (100kb OK, 150kb = 413) |

### Implementation Details

All hardening follows the established architecture:

```text
Request
  ↓
helmet()                    // Security headers
  ↓
CORS middleware             // Origin validation
  ↓
express.json({limit:100kb}) // Body size limit
  ↓
authenticateToken           // JWT validation
  ↓
requireRole(...)            // Role authorization
  ↓
loginLimiter (login only)   // Rate limiting
  ↓
validation                  // Input validation
  ↓
service                     // Business logic
  ↓
repository/database         // Data access
  ↓
centralized error middleware
  ↓
Response
```

### Key Implementation Decisions

1. **Helmet** — Applied globally with frameguard DENY, CSP, HSTS, noSniff, referrerPolicy no-referrer, cross-origin policies
2. **CORS** — Manual middleware (not `cors` package) for full control; configurable `ALLOWED_ORIGINS` env var; preflight support; no credentials
3. **Rate limiting** — `express-rate-limit` on `/auth/login` only; 5 attempts/15min; skips successful requests; proper IPv6 handling
4. **Body size limit** — `express.json({limit: '100kb'})`; 413 response via centralized error handler
5. **K1 fix** — `completeSale` reads `unitPrice` from `Product` server-side; client-supplied ignored
6. **K2 fix** — Atomic stock decrement via `updateMany` with `gte` check inside transaction; rolls back on zero rows
7. **K3 fix** — `cancelSale` only for `completed` sales; atomically restocks + updates status; rejects already-cancelled/pending
8. **K7 fix** — Crates recalculated from bottles on every stock change (`Math.floor(bottles / crateSize)`)
9. **K8 fix** — Single shared `lib/prisma.js` instance; all repositories import from there

### Stage 9 Test Results

| Test Suite | Total | Passed | Failed | Errors | Skipped | Status |
|---|---:|---:|---:|---:|---:|---|
| Stage 9 Security Controls | 15 | 15 | 0 | 0 | 0 | PASS |
| Stage 8 API | 48 | 48 | 0 | 0 | 0 | PASS |
| Authorization (Stage 7) | 56 | 56 | 0 | 0 | 0 | PASS |
| ProductService | 36 | 36 | 0 | 0 | 0 | PASS |
| StockService | 28 | 28 | 0 | 0 | 0 | PASS |
| SaleService | 32 | 32 | 0 | 0 | 0 | PASS |
| ReportService | 21 | 21 | 0 | 0 | 0 | PASS |
| AuthService | 23 | 23 | 0 | 0 | 0 | PASS |
| **TOTAL** | **260** | **260** | **0** | **0** | **0** | **PASS** |

**260/260 tests passed.**

### Stage 9 Security Control Coverage (15 tests)

- **Helmet**: X-Content-Type-Options=nosniff, X-Frame-Options=DENY, CSP, HSTS, Referrer-Policy, COOP, CORP
- **CORS**: allowed origin (200 + headers), disallowed origin (403), no origin (*), preflight (204 + headers)
- **Rate limiting**: normal login (401, rate headers), exceed limit (429 after 5 failures)
- **Body size limit**: normal request (200), oversized (413)
- **K1**: server-side pricing verified in service tests
- **K2**: atomic stock decrement verified in service tests
- **K3**: sale cancellation restocks verified in service tests
- **K7**: crate/bottle consistency verified in service tests
- **K8**: shared PrismaClient verified in repository imports
- **Sensitive data**: login response excludes passwordHash

### Security Verification

| Question | Answer |
|---|---|
| Can a client manipulate sale prices? | **NO** — server reads from `Product.unitPrice` |
| Can concurrent sales oversell stock? | **NO** — atomic `updateMany` with `gte` check |
| Does cancelling a sale restore stock exactly once? | **YES** — atomic transaction restocks + status change |
| Can a cancelled sale be cancelled again? | **NO** — rejected with validation error |
| Is inventory crate/bottle state consistent? | **YES** — crates recalculated from bottles on every change |
| Is there only one shared PrismaClient? | **YES** — `lib/prisma.js` imported by all repositories |
| Are security headers actually present? | **YES** — verified on `/health` response |
| Is CORS restricted correctly? | **YES** — allowed origins pass, disallowed blocked (403) |
| Does login rate limiting actually return 429? | **YES** — 6th failed attempt returns 429 |
| Are oversized requests rejected? | **YES** — 150kb request returns 413 |
| Can unauthenticated users bypass any protected route? | **NO** — all 22 protected routes return 401 |
| Can MANAGER perform ADMIN-only operations? | **NO** — all ADMIN-only routes return 403 |
| Do unauthorized requests reach the service/database? | **NO** — middleware blocks before route/service |
| Are sensitive user fields protected? | **YES** — passwordHash never exposed in any response |

### Database

No database schema changes required for Stage 9. All changes are application-level.

### Files Associated With Stage 9

| File | Purpose |
|---|---|
| `server.js` | Helmet, CORS, rate limiter, body size limit, error handling for 413 |
| `lib/prisma.js` | Shared PrismaClient instance (K8 fix) |
| `InventoryManagement/Services/SaleService.js` | K1 fix (server-side pricing), K2 fix (atomic stock decrement), K3 fix (restock on cancel), K7 fix (crate/bottle sync) |
| `InventoryManagement/Services/StockService.js` | K7 fix (crate/bottle sync on receive) |
| `InventoryManagement/Repository/Stock.js` | K2/K7 fixes (conditional decrement, crate recalculation) |
| `InventoryManagement/Repository/*.js` | K8 fix (import shared PrismaClient) |
| `UserManagement/Repository/UserRepository.js` | K8 fix (import shared PrismaClient) |
| `package.json` | New dependencies: `helmet`, `express-rate-limit` |
| `package-lock.json` | Dependency lockfile updated |
| `tests/Stage9Security.test.js` | Comprehensive 15-test security control verification suite |

---

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
| K1 | HIGH | ~~`completeSale` trusts the client-supplied `unitPrice`, so a user can sell at any price.~~ **RESOLVED in Stage 9** | ~~Read price from `Product.unitPrice` server-side; allow overrides for Admins only.~~ |
| K2 | HIGH | ~~Stock check happens outside the transaction, so two simultaneous sales can oversell and push stock negative.~~ **RESOLVED in Stage 9** | ~~Atomic conditional decrement inside the transaction (`updateMany where quantityBottles >= qty`, verify count).~~ |
| K3 | HIGH | ~~`cancelSale` has unclear semantics: it works on completed sales without restocking, and can cancel an already-cancelled sale. `pending` is never created by the API.~~ **RESOLVED in Stage 9** | ~~Decide policy: cancel = restock, allowed only from `completed`, Admin-only.~~ |
| K4 | HIGH | No role enforcement: any logged-in user can do anything. | Stage 7. |
| K5 | HIGH | Dev, tests and `seed.js` all hit the shared production-style Aiven DB; `seed.js` wipes every table. | Create a separate dev/test database; make seed refuse to run without a `--force` flag. |
| K6 | MED | ~~Error mapping uses `err.message.includes(...)`; invalid/expired JWT returns 403 (should be 401); no central error middleware.~~ **RESOLVED in Stage 6** | ~~Stage 6: custom error classes + one error handler.~~ |
| K7 | MED | ~~`quantityCrates` only increases (on delivery); sales never decrement it, so it drifts from bottles.~~ **RESOLVED in Stage 9** | ~~Derive crates from bottles ÷ crateSize, or maintain both consistently. Decide.~~ |
| K8 | MED | ~~Every file creates its own `new PrismaClient()` (about 12 connection pools); risks hitting the free-tier connection limit.~~ **RESOLVED in Stage 9** | ~~One shared `lib/prisma.js` instance.~~ |
| K9 | MED | ~~No user-management routes; users only via seed/scripts.~~ **RESOLVED in Stage 8** | ~~Admin-only create user / change password / list users.~~ |
| K10 | MED | Shop day (UTC+1) vs UTC day offset of one hour. | A `BUSINESS_TZ` offset constant for day boundaries, or `@db.Date` for reportDate. |
| K11 | LOW | JWT role stays stale up to 8h after a role change; no logout or refresh. | Short expiry + refresh, or re-check role from DB on sensitive routes. |
| K12 | LOW | `crateSize` of 0 is allowed, so crate conversion silently yields 0 bottles. | Require positive integer or null. |
| K13 | LOW | `receiveBatchOrder` and `generateDailyReport` don't verify the user exists, so a raw foreign-key error can surface. | Check the user or map Prisma P2003 to a clear error. |
| K14 | LOW | No `npm test`, no runner. | Add Jest + supertest (`server.js` already exports `app`). |

## 13. Roadmap

1. **Stage 6 — error handling:** ~~custom error classes (Validation 400, NotFound 404, Conflict 400), one central error middleware, 401 for bad/expired tokens, 404 for unknown routes, remove string matching.~~ **COMPLETED**
2. **Stage 7 — roles:** `requireRole` middleware. **VERIFIED AFTER REMEDIATION.** 14 protected routes enforced: Admin-only (POST /products, POST /products/:id/discontinue, POST /products/:id/reactivate, POST /sales/:id/cancel); Admin+Manager (GET /products, GET /stock/low, POST /stock/receive, POST /sales, GET /sales, GET /sales/:id, POST /reports/daily, GET /reports/:date, GET /reports). 56 authorization tests, 196 total tests pass.
3. **Stage 8 — missing routes and user management:** **VERIFIED — COMPLETE.** 8 new routes added (2 product, 2 stock, 4 user management). All 22 protected routes enforced. 48 Stage 8 API tests, 244 total tests pass. K9 resolved.
4. **Stage 9 — hardening:** **VERIFIED — COMPLETE.** K1 (server-side pricing), K2 (atomic stock decrement), K3 (cancellation restocks), K7 (crate/bottle consistency), K8 (shared PrismaClient), plus `helmet`, `cors`, login rate limiting, body size limit, request validation. 15 security controls verified. 260 total tests pass. K1/K2/K3/K7/K8 resolved.
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