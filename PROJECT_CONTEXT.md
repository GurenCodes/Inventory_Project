# Floramagg Drinks Shop — Project Context & Handover

Single source of truth for developers and AI assistants (opencode / Nemotron). Replaces the earlier PROJECT_CONTEXT.md.
Last updated: 2026-10-10 (consistency audit + dependency-fix follow-up session). State: Stage 12 COMPLETE — backend audit fixes + full frontend shipped; `npm test` all 9 suites green (recorded run 2026-10-10); frontend `npm run build` green (recorded run 2026-10-10). Next: Stage 13 (Vercel deploy) + push local commits. **Git: `main` ahead of `origin/main` by 6 commits as of this follow-up session (NOT pushed). Working tree: uncommitted edits to this document pending commit (do not assume clean — always run `git status`).** See section 2 for the authoritative current state and section 12 for open issues (K5, K10–K12, K15, K16, K18).
Read sections 1–4 first, section 11 before touching git or the server, and section 12 before adding features.
Update sections 2, 12 and 13 at the end of every work session.

---

## 1. Purpose

Floramagg Business Ventures is a natural fruit juice producer and distributor in Yaoundé, Cameroon, selling mostly to local bars and restaurants. This project replaces paper-based stock and sales tracking.

- **What it is:** an internal web app for Floramagg staff (not a customer storefront), accessed online through a browser. Backend API (Render) is deployed; the React frontend (`frontend/`) is implemented but **not yet deployed** (Stage 13 pending).
- **Goals:** know current stock in crates and loose bottles; record a sale and update stock automatically; log supplier deliveries and increase stock automatically; see daily/weekly/monthly revenue without manual maths; restrict sensitive actions to Admins.
- **Design principle:** small business, favor the simpler option. Deliberately omitted: Purchase Order entity (each delivery is logged individually as ItemBatchOrder), Cashier role (only ADMIN and MANAGER exist).
- **Offline decision:** an offline-first phone app was considered and rejected. This is an online web app. Revisit only if the shop's internet proves unreliable.

## 2. Current Project State (authoritative)

> This section is the single source of truth for "where things stand now". Older stage reports (§7b–7g, §16–19) are **historical snapshots**; where they conflict with this section or with current code, this section and the code win.

| Area | State |
|---|---|
| Schema, migrations (2), Aiven database | Done |
| Repositories (7 entities) | Done |
| Services (Product, Stock, Sale, Report, Auth, User) | Done, validated, tested |
| Password security | bcrypt (salt rounds 10), done |
| API stages 1–5 (health, login + JWT, products/stock, sales, reports) | Done, tested |
| Stage 6: error handling pass | **Done** |
| Stage 7: role-based restrictions | **VERIFIED AFTER REMEDIATION** |
| Stage 8: missing routes & user management | **VERIFIED — COMPLETE** |
| Stage 9: security hardening | **VERIFIED — COMPLETE** (one decision since superseded: CORS credentials, see §7d) |
| Stage 10: deployment preparation | **VERIFIED — COMPLETE** |
| Stage 11: production deployment (Render backend) | **VERIFIED — COMPLETE** (as of Stage 11; live-service state not re-checked since) |
| Stage 12: frontend development | **COMPLETE — build green, all 12 pages implemented** (frontend not deployed) |
| Stage 13: frontend deployment (Vercel) | **NOT STARTED** |
| 2026-10 audit: backend fixes + frontend completion | **VERIFIED — COMPLETE** |

### Verified stack (from package.json files, 2026-10-10)

| Layer | Actual verified state |
|---|---|
| Backend runtime | Node.js v24.19.0, CommonJS |
| Backend framework | Express **5.2.1** |
| ORM | Prisma **6.19.x** (`@prisma/client`, `prisma`) |
| Database | PostgreSQL on Aiven (`defaultdb`), `sslmode=require` |
| Auth | JWT (HS256, 8h) + HttpOnly cookie `token` (primary) + Bearer header fallback |
| Frontend | React **19.2**, TypeScript ~6.0, Vite **8.3**, Tailwind CSS **4.3**, React Router **7.18**, TanStack Query 5, Zustand 5, react-hook-form 7, zod 3, axios `^1.20.0` (declared in `frontend/package.json` since 2026-10-10, K17 resolved) |
| Frontend location | `frontend/` (own `package.json` + lockfile; **not** an npm workspace of the root) |
| Repo / branch | `https://github.com/GurenCodes/Inventory_Project.git`, branch `main`; **6 commits ahead of `origin/main`, not pushed** (5 audit commits + the K17 dependency-fix commit); working tree had uncommitted edits to this document at last check (never assume clean — verify with `git status`) |

### Evidence classification (what is actually proven)

| Claim | Evidence level |
|---|---|
| `npm test` → all 9 suites passed | **Recorded execution result** (2026-10-10; see §9 for suite trust ranking) |
| Frontend `npm run build` (`tsc -b && vite build`) green | **Recorded execution result** (2026-10-10) |
| Render backend deployed, `/health` 200, migrations applied | **Verified at Stage 11** (historical; live state not re-verified 2026-10-10) |
| Cookie attributes in production (`SameSite=None; Secure`) | **Verified in code** (`server.js`) + **Regression test asserts the Set-Cookie header**; not verified in a real cross-origin browser session |
| Frontend works end-to-end in a browser | **Unverified** — no E2E/browser testing performed |
| Vercel deployment / production CORS wiring | **Not done** (Stage 13) |

### Audit of 2026-10-10 (what was actually wrong and what was fixed)

This audit verified claims in this document against the real code and tests. Findings and fixes (commits `ec3bb1a`, `da2ab4e`, `af985a5`, docs `0a894f7`):

- **PUT /products/:id with `reorderLevel` returned 500** (PrismaClientValidationError — the route passed `reorderLevel` to `updateProduct`, which rejects unknown fields). Fixed: the route applies reorder level via `stockService.adjustReorderLevel` and returns the product with its stock.
- **Crate drift in `receiveBatchOrder`** (11 bottles + 1 crate + 2 bottles left `quantityCrates` at 1 instead of 2). Fixed: crates recalculated from total bottles inside the interactive `$transaction`, with an optimistic `updateMany` guard on `quantityBottles` so concurrent deliveries cannot silently overwrite each other.
- **Frontend build was broken** (unclosed JSX in `Login.tsx`) and the working-tree had never compiled. Fixed; `npm run build` in `frontend/` now passes (`tsc -b && vite build`).
- **Placeholder pages replaced**: Stock, StockReceive, Sales, SaleDetail, SaleNew, Reports, Users were "Coming Soon" divs; all are now fully implemented against the real API (plus `useStock`/`useSales`/`useReports`/`useUsers` hooks and `lib/format.ts`).
- **Session restore now real**: `initializeAuth` calls `GET /auth/me` instead of assuming a hardcoded token is a valid session; the login token is kept per-tab (sessionStorage) only as an Authorization-header fallback for blocked third-party cookies; never localStorage.
- **Login route moved outside the authenticated layout**; broken `/dashboard` nav link fixed to `/`; demo credentials shown only in dev builds; last-character password-peek removed.
- **`GET /reports` range query now includes `generatedBy`** for display.
- **New `npm test`**: `tests/run-all.js` spawns all 9 suites and fails on any `❌` or non-zero exit — needed because several older suites print ✅/❌ but historically exited 0 regardless, and `Stage9Security.test.js` still contains hardcoded PASS lines. Treat pre-existing suite output with skepticism; the Regression suite (29 assertions, real HTTP + DB checks, non-zero exit on failure) is the trustworthy one.
- Full verification (recorded 2026-10-10): `npm test` → **all 9 suites passed** (including Regression 29/29); frontend production build green.
- **2026-10-10 consistency audit (docs-only):** corrected cookie `SameSite` descriptions (production is `None`, not `Strict`), standardized the frontend env var to `VITE_API_BASE_URL` (code-established), documented that `axios` is used by the frontend but not declared in `frontend/package.json` (K17), labeled historical stage snapshots, and collapsed verbatim-duplicate sections §16–19.
- **2026-10-10 dependency-fix follow-up (K17 resolved):** `axios` `^1.20.0` added to `frontend/package.json` dependencies and `frontend/package-lock.json`; `autoprefixer` `^10.6.1` added to frontend devDependencies (a clean-room `npm ci` + `npm run build` in an isolated directory previously failed on BOTH missing packages — axios resolved via root `node_modules`, autoprefixer via the root copy). The no-consumer copies of `axios` and `autoprefixer` were removed from the root `package.json`/lockfile (root still lists some unused frontend-ish dev deps: `postcss`, `tailwindcss`, `vite`, `typescript`, React types/plugins — harmless residue, optional cleanup later). A clean-room isolated `npm ci` + `npm run build` now **passes** (176 modules, dist emitted). Lint (`oxlint`) also run: 5 `rules-of-hooks` errors in `ProductForm.tsx` (hooks called after an early `if (!isAdmin) return`) **fixed** by moving the guard below the hooks; lint now exits 0 (3 advisory warnings remain). Backend suite re-verified after the dependency changes: `npm test` → all 9 suites passed (Regression 29/29). `opencode_log.txt` (a terminal-escape junk file committed in the recovery snapshot `d877344`) is now gitignored and untracked going forward.

Known still-open items are tracked in section 12 (K5, K10–K12, K15, K16, K18; **K17 resolved 2026-10-10**).

Git (2026-10-10): branch `main`; **ahead of `origin/main` by 6 commits (the five from the audit — `d877344`, `ec3bb1a`, `da2ab4e`, `af985a5`, `0a894f7` — plus the K17 dependency-fix/docs commit) — push requires owner confirmation per §10**; the tree was clean at commit `0a894f7`, but this document's subsequent audit edits were left as uncommitted working-tree changes — treat "clean" claims in this file as historical unless re-verified.

## 3. Stack and environment

- Node.js v24.19.0 (CommonJS), Express 5.2.x, Prisma **6.19.x**, PostgreSQL on Aiven (shared with a collaborator), jsonwebtoken 9, bcrypt 6, dotenv.
- **Stage 9 dependencies**: `helmet` (security headers), `express-rate-limit` (rate limiting). The `cors` npm package is listed in `package.json` but **not imported anywhere** — CORS is a manual middleware in `server.js` (see §7d).
- Frontend dependencies live in `frontend/package.json` (React 19, Vite 8, Tailwind 4, React Router 7, TanStack Query, Zustand, react-hook-form, zod, axios, autoprefixer). The root `package.json` still lists some unused frontend-ish dev deps (`postcss`, `tailwindcss`, `vite`, `typescript`, React types/plugins) as harmless residue; the formerly-masking `axios` and `autoprefixer` root copies were removed on 2026-10-10 (K17).
- Tools: VS Code, pgAdmin4, opencode 1.18.x using NVIDIA Nemotron 3 Ultra 550B. OS: Windows (PowerShell / cmd).
- `.env` (never commit): `DATABASE_URL` (Aiven string, `sslmode=require`), `JWT_SECRET`, optional `PORT` (default 3000). The Aiven database is named `defaultdb`. The server also reads `NODE_ENV` (production cookie behavior) and `ALLOWED_ORIGINS` (CORS).
- Commands: `npm start` | `npm test` (runs `tests/run-all.js`, all 9 suites) | `npx prisma generate` (after any schema change) | `npx prisma migrate dev --name <name>` (dev) | `npx prisma migrate deploy` (hosted) | `node seed.js` (**DESTRUCTIVE**) | `node tests/<Name>.test.js`. Frontend: `npm run dev|build|preview` inside `frontend/`.
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
├── prisma/           schema.prisma, migrations/ (2 migrations)
├── tests/            *.test.js + run-all.js (npm test)
├── frontend/         React 19 + Vite 8 SPA (own package.json; src/pages, src/hooks, src/services, src/store, src/components)
└── PROJECT_CONTEXT.md, .env, package.json
```

The folder is `Services` (plural). Rules:

- A repository touches **one table only** and exports an instance (`module.exports = new XRepository()`). Multi-table logic lives in a Service.
- Services validate **before any DB call** and throw structured errors (`ValidationError`, `NotFoundError`, `ConflictError`).
- Not-found: lookups (`getSale`, `getReportByDate`, `getStockForProduct`) return `null`; mutations on a missing record throw `NotFoundError`.
- Routes only translate HTTP ⇄ Service. No business logic in routes.
- Identity fields (`receivedById`, `soldById`, `generatedById`) always come from the token (`req.user.userId`), never the request body.
- Every route requires login except `GET /health`, `POST /auth/login`, and `POST /auth/logout` (logout only clears the cookie and does not require a valid session). `GET /auth/me` requires login.
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
| UserService | hashPassword, createUser, updatePassword, verifyPassword, getUserById, getUserByEmail, listUsers | Emails lowercased, hashes stripped from returns. Exposed via ADMIN-only routes (Stage 8): `POST /users`, `GET /users`, `GET /users/:id`, `PUT /users/:id/password`. |

## 7. API (server.js)

Auth: `POST /auth/login` {email, password} → `{token, user{id, fullName, email, role}}` **and** sets HttpOnly cookie `token` (see §16.4 for attributes). JWT payload `{userId, role}`, expires in 8h. `authenticateToken` accepts the **cookie first, then** `Authorization: Bearer <token>`, and sets `req.user`. `GET /auth/me` returns the current user; `POST /auth/logout` clears the cookie (unauthenticated).

| Method + path | Service call | Success |
|---|---|---|
| GET /health | — | 200 |
| GET /products?category=&includeInactive=true | listActiveProducts / listProducts | 200 |
| POST /products | registerProduct | 201 |
| PUT /products/:id | updateProduct (+ stockService.adjustReorderLevel if `reorderLevel` sent) | 200 |
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
| Can unauthenticated users access protected routes? | **NO** — all 14 protected routes return 401 |
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

> **Historical snapshot (Stage 9, early October 2026).** One decision below has since been **superseded**: CORS `credentials` was `false` at Stage 9, but was changed to `true` when cookie-based auth was added (commit `fb67873`, Stage 12.2). Current CORS code: §16.5 / `server.js`.

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
| CORS | Configurable allowed origins; preflight support; credentials=false **(at Stage 9; superseded — credentials=true since cookie auth)** | Origin/preflight tests |
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
2. **CORS** — Manual middleware (not `cors` package) for full control; configurable `ALLOWED_ORIGINS` env var; preflight support; credentials were `false` at Stage 9 (**superseded**: `Access-Control-Allow-Credentials: true` since cookie auth, `fb67873`)
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

## 7e. Stage 10 — Deployment Preparation (VERIFIED — COMPLETE)

### Purpose

Stage 10 completes the deployment preparation by verifying all production requirements are met and documenting the exact Render deployment configuration. No deployment is performed in this stage; only verification and documentation.

### Deployment Readiness Verification

| Criterion | Status | Notes |
|---|---|---|
| All tests pass | ✅ | 260/260 tests pass (56 Authorization + 48 Stage 8 API + 15 Stage 9 Security + 141 Service tests) |
| Security controls verified | ✅ | 15/15 Stage 9 security controls pass |
| No hard-coded localhost/ports | ✅ | Server uses `process.env.PORT \|\| 3000`; no hard-coded URLs |
| No secrets in repository | ✅ | `.env` in `.gitignore`; no secrets in code |
| Health check endpoint | ✅ | `GET /health` returns `{"status":"ok"}` 200 OK |
| Prisma migrations ready | ✅ | 2 migrations ready (`init`, `add_product_is_active`) |
| Build/start commands verified | ✅ | `npm ci && npx prisma generate` / `node server.js` |
| No database schema changes needed | ✅ | All Stage 9 changes are application-level |

### Render Deployment Configuration (Verified)

| Setting | Value |
|---|---|
| Service Type | Web Service |
| Repository | `GurenCodes/Inventory_Project` (main branch) |
| Root Directory | Repository root (`.`) |
| Runtime | Node.js 24.19.0 (matches local) |
| Build Command | `npm ci && npx prisma generate` |
| Start Command | `node server.js` |
| Health Check Path | `/health` |
| Health Check Interval | 30s (default) |

### Required Environment Variables (Manual Entry in Render Dashboard)

| Variable | Required | Source | Notes |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | Manual | Aiven PostgreSQL URL with `sslmode=require` |
| `JWT_SECRET` | **Yes** | Manual | Generate strong random string (≥32 chars) |
| `ALLOWED_ORIGINS` | **Yes** | Manual | Comma-separated frontend origins (e.g., `https://app.floramagg.com,https://admin.floramagg.com`) |
| `PORT` | No | Auto | Render sets automatically; fallback 3000 in code |

**Note:** `PORT` must NOT be set manually; Render provides it. `DATABASE_URL` and `JWT_SECRET` must use production values, not local `.env` values.

### Database / Prisma Strategy

- **External database:** Aiven PostgreSQL (already provisioned)
- **Migrations:** Run `npx prisma migrate deploy` via Render Shell after first deploy
- **Client generation:** `npx prisma generate` runs during build
- **No schema changes** required for Stage 10

### Files Associated With Stage 10

| File | Purpose |
|---|---|
| `PROJECT_CONTEXT.md` | Updated with Stage 10 deployment configuration |
| `server.js` | Already contains all production-ready configuration |
| `lib/prisma.js` | Shared PrismaClient (K8 fix) |
| `package.json` | Dependencies for production (helmet, express-rate-limit, cors) |

### Stage 10 Verification Results

| Check | Result |
|---|---|
| All 260 tests pass | ✅ 260/260 pass |
| Security controls verified | ✅ 15/15 Stage 9 controls pass |
| No hard-coded localhost/ports | ✅ Verified |
| No secrets in repository | ✅ Verified |
| No seed.js execution | ✅ Not executed |
| No destructive DB commands | ✅ Verified |
| `.env` not committed | ✅ In `.gitignore` |
| `opencode_log.txt` ignored | ✅ In `.gitignore` |

### Render Deployment Status

**NOT DEPLOYED YET.** Stage 10 completes the preparation; actual Render Web Service creation and deployment is the next phase (Stage 11+).

---

## 7f. Stage 11 — Production Deployment & Verification (VERIFIED — COMPLETE)

### Purpose

Stage 11 completes the production deployment by applying Prisma migrations to the production Aiven PostgreSQL database via Render Shell, then verifying the live production deployment end-to-end.

### Production Deployment Verification

| Criterion | Status | Notes |
|---|---|---|
| Production database migrations applied | ✅ | `npx prisma migrate deploy` via Render Shell — 2/2 migrations applied |
| Production database schema up to date | ✅ | `npx prisma migrate status` → "Database schema is up to date!" |
| Render service Live | ✅ | Service status: **Live** at https://inventory-project-6szy.onrender.com |
| Health check endpoint | ✅ | `GET /health` → `{"status":"ok"}` HTTP 200 |
| Database connectivity | ✅ | All 260/260 tests pass; Prisma connects to Aiven PostgreSQL |
| Prisma migrations applied | ✅ | `npx prisma migrate deploy` via Render Shell — 2/2 migrations applied |
| Prisma migrations status | ✅ | `npx prisma migrate status` → "Database schema is up to date!" |
| Render service status | ✅ | Service status: **Live** |
| Health check endpoint | ✅ | `GET /health` → `{"status":"ok"}` HTTP 200 |
| All tests pass | ✅ | 260/260 tests pass (56 Authorization + 48 Stage 8 API + 15 Stage 9 Security + 141 Service tests) |
| Security controls verified | ✅ | 15/15 Stage 9 security controls pass |
| No hard-coded localhost/ports | ✅ | Verified |
| No secrets in repository | ✅ | Verified |
| No seed.js execution | ✅ | Not executed |
| No destructive DB commands | ✅ | Verified |

### Migration Execution Details

| Step | Command | Result |
|---|---|---|
| 1. Open Render Shell | `npx prisma migrate status` | "Database schema is up to date!" |
| 2. Apply migrations | `npx prisma migrate deploy` | 2/2 migrations applied successfully |
| 3. Verify status | `npx prisma migrate status` | "Database schema is up to date!" |

**Migrations applied:**
1. `20260820092734_init` — Initial schema (Product, Stock, User, ItemBatchOrder, Sale, SaleItem, DailyReport)
2. `20261005230502_add_product_is_active` — Added `isActive` to Product, changed User role default from CASHIER to MANAGER

### Production Verification Results

| Verification | Result |
|---|---|
| Render service Live | ✅ Service status: **Live** |
| `/health` endpoint | ✅ Returns `{"status":"ok"}` HTTP 200 |
| Database connectivity | ✅ All 260/260 tests pass |
| Prisma migrations applied | ✅ 2/2 migrations applied |
| Prisma schema up to date | ✅ Verified |
| Authentication functional | ✅ Login/logout works, JWT valid |
| Authorization enforced | ✅ 401/403 responses correct |
| Security controls active | ✅ Helmet, CORS, Rate Limit, Body Limit all active |
| No unexpected errors in Render logs | ✅ Clean |
| No production data modified | ✅ Tests use isolated data |

### Files Associated With Stage 11

| File | Purpose |
|---|---|
| `PROJECT_CONTEXT.md` | Updated with Stage 11 production deployment verification |
| `server.js` | Production-ready configuration (already deployed) |
| `lib/prisma.js` | Shared PrismaClient (K8 fix) |
| `package.json` | Production dependencies (helmet, express-rate-limit, cors) |

### Stage 11 Verification Results

| Check | Result |
|---|---|
| All 260 tests pass | ✅ 260/260 pass |
| Production DB migrations applied | ✅ 2/2 migrations |
| Production DB schema up to date | ✅ Verified |
| Render service Live | ✅ Verified |
| /health endpoint | ✅ Returns 200 OK |
| Security controls active | ✅ 15/15 Stage 9 controls pass |
| No hard-coded localhost/ports | ✅ Verified |
| No secrets in repository | ✅ Verified |
| No seed.js execution | ✅ Not executed |
| No destructive DB commands | ✅ Verified |
| `.env` not committed | ✅ In `.gitignore` |
| `opencode_log.txt` ignored | ✅ In `.gitignore` |

### Render Deployment Status

**DEPLOYED & VERIFIED.** Stage 11 completes the production deployment and verification. The Render Web Service is Live, database migrations are applied, all tests pass, and security controls are active.

---

## 7g. Stage 11 Follow-up — Flaky Test Resolution & JWT Security Audit (VERIFIED — COMPLETE)

> **Historical snapshot (Stage 11 follow-up, commit `3d93a22`, early October 2026).** Some statements below (JWT verify style, token transport, Git status) describe the state **before** Stage 12 and the 2026-10 audit; corrections are noted inline.

### Purpose

Stage 11 follow-up addresses the flaky authorization test identified in the initial Stage 11 verification and completes the JWT security audit as required by the Stage 11 post-deployment follow-up task.

### Flaky Authorization Test Investigation

**Root Cause:** The "MANAGER → create sale" authorization test intermittently failed with Prisma error `P2028` (transaction timeout). The default Prisma transaction timeout is 5 seconds, but network latency to the Aiven PostgreSQL database (~3-4 seconds per query) caused transactions with multiple queries to exceed the 5-second default timeout.

**Evidence:**
- Simple query latency: ~3-4 seconds to Aiven PostgreSQL
- `completeSale` transaction involves multiple queries (sale creation, sale items creation, stock updates)
- Default Prisma transaction timeout: 5 seconds
- Observed timeout: 5-6 seconds during peak latency

**Fix Applied:** Increased Prisma transaction timeout from default 5s to 60s in `InventoryManagement/Services/SaleService.js`:
```javascript
// completeSale transaction
const result = await prisma.$transaction(
  async (tx) => { ... },
  { timeout: 60000 }  // 60 seconds
);

// cancelSale transaction  
await prisma.$transaction(
  async (tx) => { ... },
  { timeout: 60000 }
);
```

**Verification:** All 260 tests now pass consistently (260/260). The flaky test ("MANAGER → create sale") now passes consistently.

**Root Cause Classification:** Network latency / environment issue, NOT an application code defect. The fix is a configuration adjustment to accommodate the production network environment.

### JWT Security Audit Findings

**Current JWT Implementation (server.js):**
- Token creation: `jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '8h' })`
- Token verification: ~~`jwt.verify(token, JWT_SECRET, callback)`~~ **Superseded (2026-10 audit, `ec3bb1a`)** — now synchronous `req.user = jwt.verify(token, JWT_SECRET)` inside try/catch, errors forwarded via `next(new UnauthorizedError(...))`
- Claims: `{ userId, role }` (no `iat`, `exp` explicitly set but added by library)
- Algorithm: HS256 (default)
- Secret: `JWT_SECRET` from environment (never logged/exposed)

**Security Properties Verified:**
| Property | Status |
|----------|--------|
| Expiration claim (`exp`) | ✅ Present (8h default) |
| Issued at (`iat`) | ✅ Present (auto-generated) |
| Signature verification | ✅ Enforced via `jwt.verify()` |
| Expired token rejection | ✅ Returns 401 "Invalid or expired token" |
| Malformed token rejection | ✅ Returns 401 |
| Invalid signature rejection | ✅ Returns 401 |
| Missing token handling | ✅ Returns 401 |
| Missing Bearer prefix | ✅ Returns 401 |
| Role-based authorization | ✅ 403 for insufficient roles |
| Password hash exposure | ✅ Never in responses |

**JWT Expiration Decision:** 
- Current: 8 hours (`expiresIn: '8h'`)
- Assessment: Acceptable for internal business application with trusted users
- Recommendation: Consider reducing to 1-2 hours for production; no refresh token infrastructure needed at this stage
- Decision: **Keep 8h for now**; revisit when frontend implements refresh token flow (Stage 12)

**Token Transport & Storage (HISTORICAL — pre-Stage-12; superseded):**
- Transport: `Authorization: Bearer <token>` header
- ~~No tokens in URL, query params, or cookies~~ **Superseded:** HttpOnly cookie `token` is now the primary transport (Stage 12.2, `fb67873`)
- No `localStorage`/`sessionStorage` usage in backend
- ~~No frontend code exists yet (Stage 12)~~ **Superseded:** frontend implemented 2026-10-10 (`frontend/`)
- Recommendation for Stage 12: HttpOnly + Secure + SameSite=Strict cookies — **implemented with a deviation:** production uses `SameSite=None; Secure` (required for Vercel↔Render cross-origin); dev uses `SameSite=Strict` (see §16.4)

**Secrets Management:**
- `JWT_SECRET` only in `.env` (gitignored)
- Never logged, never in responses
- `passwordHash` stripped from all user responses

### Security Verification Summary (Post-Fix)

| Control | Status |
|---------|--------|
| Helmet headers | ✅ 7/7 headers present |
| CORS (allowed origin) | ✅ 200 + correct headers |
| CORS (disallowed origin) | ✅ 403, no CORS headers |
| CORS (no origin) | ✅ Returns `*` |
| CORS preflight | ✅ 204 with correct headers |
| Rate limiting (normal) | ✅ 401 + rate headers |
| Rate limiting (exceed) | ✅ 429 on 6th attempt |
| Body size limit (normal) | ✅ 200 |
| Body size limit (oversized) | ✅ 413 |
| K1 server-side pricing | ✅ Verified |
| K2 atomic stock | ✅ Verified |
| K3 cancellation restock | ✅ Verified |
| K7 crate/bottle sync | ✅ Verified |
| K8 shared PrismaClient | ✅ Verified |
| Sensitive data protection | ✅ No passwordHash in responses |
| JWT expiration handling | ✅ Expired = 401 |
| JWT malformed rejection | ✅ 401 |
| JWT invalid signature | ✅ 401 |
| JWT missing token | ✅ 401 |
| JWT missing Bearer | ✅ 401 |
| Role-based auth | ✅ 403 for insufficient roles |
| All 260 tests pass | ✅ 260/260 |

### Test Execution Summary

| Test Suite | Result |
|------------|--------|
| Authorization (Stage 7) | ✅ 56/56 PASS |
| Stage 8 API | 48/48 PASS |
| Stage 9 Security | 15/15 PASS |
| SaleService | 32/32 PASS |
| StockService | 28/28 PASS |
| ProductService | 36/36 PASS |
| ReportService | 21/21 PASS |
| AuthService | 23/23 PASS |
| **TOTAL** | **260/260 PASS** |

### Files Modified

| File | Change |
|-------|--------|
| `InventoryManagement/Services/SaleService.js` | Increased Prisma transaction timeout to 60s for both `completeSale` and `cancelSale` |
| `PROJECT_CONTEXT.md` | Updated with Stage 11 follow-up findings |

### Git Status (HISTORICAL — as of Stage 11 follow-up, commit `3d93a22`; current state is in section 2)

```
3d93a22 (HEAD -> main, origin/main) docs: finalize stage 11 production deployment verification
8ac84fe docs: finalize stage 10 deployment handoff
5690d9d stage9: implement security hardening (K1-K8 fixes + Helmet + CORS + rate limiting + body limit)
aada18b stage8: implement missing routes and user management
```

### Git Status (HISTORICAL — as of Stage 11 follow-up; current state is in section 2)

```
On branch main
Your branch is up to date with 'origin/main'.
Working tree clean (except opencode_log.txt ignored)
```

### Render Deployment Status

**DEPLOYED & VERIFIED.** Stage 11 completes the production deployment and verification. The Render Web Service is Live, database migrations are applied, all tests pass, and security controls are active.

---

## 16. Stage 12 — Frontend Development Plan

> **Status (2026-10-10): IMPLEMENTED (frontend not deployed).** This section is the original plan, kept for reference; where the plan and the shipped code differ, the notes below and `frontend/` are authoritative.
> **Shipped stack (verified from `frontend/package.json`):** React 19 (not 18), React Router v7 (not v6), Tailwind v4 via `@tailwindcss/postcss` (not v3 / no `tailwind.config.ts`), TypeScript ~6.0, TanStack Query 5 + Zustand 5, react-hook-form 7 + zod 3, axios. **Not used** (plan only): Headless UI, date-fns/Day.js (native `Date` + `Intl` in `lib/format.ts`), Recharts, Lucide (custom `components/ui/Icons.tsx`).
> **API origin env var:** `VITE_API_BASE_URL` (dev fallback `http://localhost:3000`, prod fallback the Render URL). The name `VITE_API_URL` used in older draft instructions is wrong — the code reads `VITE_API_BASE_URL` only.
> **Auth:** HttpOnly cookie primary + per-tab sessionStorage token fallback (never localStorage).
> **Route deviations from the planned table below:** shipped routes are `/login`, `/` (Dashboard), `/products`, `/products/new`, `/products/:id`, `/products/:id/edit`, `/stock`, `/stock/receive`, `/stock/receive/:productId`, `/sales`, `/sales/new`, `/sales/:id`, `/reports`, `/users`. There is no separate `/stock/:productId`, `/stock/:productId/reorder-level`, `/reports/:date`, `/users/:id`, or `/users/:id/password` page — reorder level, report generation, user creation and password reset are dialogs/forms inside the Stock, Reports and Users pages. Planned extra filters (pagination, sales date/user filters) are not implemented.
> **Packaging note (RESOLVED 2026-10-10):** `axios` is now declared in `frontend/package.json` (K17); a clean-room `npm ci` + `npm run build` inside an isolated `frontend/` copy passes. Older checkouts before this fix resolved axios only via the root `node_modules`.

### 16.1 Recommended Frontend Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Framework** | React 18 + TypeScript | Mature ecosystem, strong TypeScript support, excellent Vercel integration |
| **Build Tool** | Vite | Fast HMR, optimized production builds, first-class TypeScript support |
| **Routing** | React Router v6 | Declarative, nested routes, lazy loading support |
| **State Management** | TanStack Query (React Query) + Zustand | Server state caching/synchronization + lightweight client state |
| **UI Components** | Headless UI + Tailwind CSS | Accessible, unstyled components + utility-first styling, small bundle |
| **Forms** | React Hook Form + Zod | Performant, type-safe validation with schema sharing |
| **HTTP Client** | Axios (or Ky) | Interceptors for auth, retry logic, base URL config |
| **Date/Time** | date-fns (or Day.js) | Lightweight, tree-shakeable, UTC-safe |
| **Charts** | Recharts | Composable, SVG-based, responsive |
| **Icons** | Lucide React | Consistent, tree-shakeable, lightweight |

**Hosting:** Vercel (native Vite/React support, preview deployments, edge functions if needed)

**Why not alternatives:**
- Next.js: Overkill for a pure SPA backend-driven app; adds SSR complexity not needed
- Redux/Zustand only: TanStack Query handles server state far better
- Material UI / Chakra: Heavier; Tailwind + Headless UI gives more control with less weight

### 16.2 Planned Pages & Routes (MVP → Full)

| Route | Purpose | Auth | Role Access | API Endpoints |
|-------|---------|------|-------------|---------------|
| `/login` | Login form, JWT storage | Public | — | `POST /auth/login` |
| `/` (Dashboard) | Overview: low-stock alerts, today's sales, quick actions | Private | ADMIN, MANAGER | `GET /products?includeInactive=false`, `GET /stock/low`, `GET /sales?status=completed` |
| `/products` | Product catalog with search, filter, pagination | Private | ADMIN, MANAGER | `GET /products` |
| `/products/new` | Create product (Admin only) | Private | ADMIN | `POST /products` |
| `/products/:id` | Product detail + stock + actions | Private | ADMIN, MANAGER | `GET /products/:id` |
| `/products/:id/edit` | Edit product (Admin only) | Private | ADMIN | `PUT /products/:id` |
| `/products/:id` | Product detail + stock + actions | Private | ADMIN, MANAGER | `GET /products/:id` |
| `/products/:id/edit` | Edit product (Admin only) | Private | ADMIN | `PUT /products/:id` |
| `/stock` | Stock overview with search, low-stock filter | Private | ADMIN, MANAGER | `GET /products?includeInactive=true`, `GET /stock/:productId` |
| `/stock/:productId` | Stock detail + receive stock | Private | ADMIN, MANAGER | `GET /stock/:productId`, `POST /stock/receive` |
| `/stock/:productId/reorder-level` | Adjust reorder level (Admin) | Private | ADMIN | `PUT /stock/:productId/reorder-level` |
| `/sales` | Sales history with filters (date, status, user) | Private | ADMIN, MANAGER | `GET /sales` |
| `/sales/new` | Create sale (checkout) | Private | ADMIN, MANAGER | `POST /sales` |
| `/sales/:id` | Sale detail + items + cancel action | Private | ADMIN, MANAGER | `GET /sales/:id`, `POST /sales/:id/cancel` |
| `/reports` | Daily/weekly/monthly reports with date picker | Private | ADMIN, MANAGER | `GET /reports`, `GET /reports/daily`, `POST /reports/daily` |
| `/reports/:date` | Single day report detail | Private | ADMIN, MANAGER | `GET /reports/:date` |
| `/users` | User management (Admin only) | Private | ADMIN | `GET /users`, `POST /users` |
| `/users/:id` | User detail (Admin) | Private | ADMIN | `GET /users/:id` |
| `/users/:id/password` | Password reset (Admin) | Private | ADMIN | `PUT /users/:id/password` |
| `/login` | Login page | Public | — | `POST /auth/login` |

**Navigation:**
- Persistent sidebar (collapsible on mobile)
- Top bar: user avatar/name, role badge, logout
- Role-aware: Admin-only links hidden from Manager

### 16.3 API Integration Layer

**File Structure (proposed):**
```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts          # Axios instance with interceptors
│   │   ├── endpoints.ts       # Endpoint constants + types
│   │   ├── auth.ts            # Login, token refresh, logout
│   │   ├── products.ts        # Product API
│   │   ├── stock.ts           # Stock API
│   │   ├── sales.ts           # Sales API
│   │   ├── reports.ts         # Reports API
│   │   └── users.ts           # Users API (admin)
│   ├── components/
│   │   ├── ui/                # Reusable UI primitives (Button, Input, Table, Modal, etc.)
│   │   ├── layout/            # Sidebar, Header, Layout wrapper
│   │   └── forms/             # Reusable form components
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Products.tsx
│   │   ├── ProductDetail.tsx
│   │   ├── ProductForm.tsx
│   │   ├── Stock.tsx
│   │   ├── StockDetail.tsx
│   ├── Sales.tsx
│   ├── SaleDetail.tsx
│   ├── SaleForm.tsx
│   ├── Reports.tsx
│   ├── ReportDetail.tsx
│   ├── Users.tsx
│   ├── UserDetail.tsx
│   └── Login.tsx
│   ├── hooks/
│   │   ├── useAuth.ts         # Auth state, login, logout, token refresh
│   │   ├── usePermissions.ts  # Role-based UI helpers
│   │   └── useDebounce.ts
│   ├── store/
│   │   ├── authStore.ts       # Zustand: user, token, login/logout
│   │   └── uiStore.ts         # Sidebar, modals, toasts
│   ├── types/
│   │   └── api.ts             # Shared TypeScript types from API
│   ├── utils/
│   │   ├── date.ts            # UTC-safe formatting
│   │   ├── currency.ts        # XAF formatting
│   │   └── validation.ts      # Shared Zod schemas
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── vercel.json
```

### 16.4 Authentication & Token Storage Strategy (VERIFIED — IMPLEMENTED)

**Current Backend (Verified — Cookie-Based Auth Implemented):**
- `POST /auth/login` → returns `{ token, user { id, fullName, email, role } }` **AND** sets HttpOnly cookie
- JWT payload: `{ userId, role }`, expires in **8 hours** (`expiresIn: '8h'`)
- Cookie: `token` with `httpOnly: true`, `secure: true` (production), `sameSite: 'none'` in production / `'strict'` in development (`isProduction ? 'none' : 'strict'`), `maxAge: 8h`, `path: '/'` (verified in `server.js`; Regression test asserts `SameSite=None; Secure; HttpOnly` on a production-mode login)
- `jwt.verify()` validates signature + expiration → 401 on expiry/malformed/invalid
- `POST /auth/logout` clears the cookie
- No refresh token endpoint exists

**Security Assessment (VERIFIED):**
| Aspect | Current | Risk |
|--------|---------|------|
| JWT in `localStorage` | ❌ **REMOVED** | — |
| JWT in `sessionStorage` | ✅ Used as fallback only | Low |
| HttpOnly cookie (`Secure` + `SameSite=None` in production; `SameSite=Strict` in dev) | ✅ **IMPLEMENTED** | **Low** (see CSRF row) |
| `Access-Control-Allow-Credentials` | ✅ **ENABLED** | **Low** |
| CSRF Protection | ⚠️ **Partial** — production `SameSite=None` means cross-site cookie sends are possible in principle; actual protection = HttpOnly (token unreadable by JS) + CORS origin allowlist (403 for unknown origins) + JSON `Content-Type` (preflighted). **Not verified in a real browser cross-site test.** | **Medium (unverified)** |

**Implemented Backend Changes:**

1. **Cookie-based auth endpoint** (alongside existing Bearer token):
```javascript
// server.js - actual /auth/login cookie code
const isProduction = process.env.NODE_ENV === 'production';
res.cookie('token', token, {
  httpOnly: true,
  secure: isProduction,   // HTTPS only in production
  sameSite: isProduction ? 'none' : 'strict', // None required for Vercel<->Render cross-origin
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
  path: '/'
});
```

2. **Updated `authenticateToken` middleware** to read from cookie first:
```javascript
// actual middleware: Bearer prefix checked explicitly
const cookieToken = req.cookies?.token;
const authHeader = req.headers['authorization'];
const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

const token = cookieToken || headerToken;
```

3. **Logout endpoint** (clears cookie):
```javascript
app.post('/auth/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
    path: '/'
  });
  res.json({ ok: true });
});
```

4. **CORS credentials** enabled in middleware:
```javascript
if (isAllowed) {
  res.header('Access-Control-Allow-Credentials', 'true');
  // ...
}
```

5. **Frontend login** → `credentials: 'include'` on all requests.

**Frontend Token Handling (Verified):**
- JWT stored in **HttpOnly cookie** (primary) + `sessionStorage` fallback for tab restore
- **Never** use `localStorage`
- Auto-refresh not needed with 8h expiry; redirect to `/login` on 401

**Migration Path:** Cookie support deployed alongside Bearer tokens; frontend prefers cookies, falls back to `sessionStorage` + `Authorization` header.

### 16.5 Vercel Deployment & CORS Configuration

**Current Backend CORS (server.js):**
```javascript
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
```

**Required Changes for Production:**
1. **Set `ALLOWED_ORIGINS` in Render dashboard:** ☐ Pending —
   ```
   ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app
   ```
   (Replace with the actual Vercel deployment URL(s); must match the browser Origin header exactly.)

2. **Enable credentials in CORS (server.js):** ✅ Already done —
   the middleware already sends `Access-Control-Allow-Credentials: true` for allowed origins (since `fb67873`).

3. **Frontend `vercel.json` (PROPOSED template — no `vercel.json` exists in the repo yet):**
   ```json
   {
     "framework": "vite",
     "buildCommand": "npm run build",
     "devCommand": "npm run dev",
     "installCommand": "npm ci",
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "X-Content-Type-Options", "value": "nosniff" },
           { "key": "X-Frame-Options", "value": "DENY" },
           { "key": "Referrer-Policy", "value": "no-referrer" }
         ]
       }
     ]
   }
   ```

4. **Vercel Project Settings:**
   - Framework Preset: Vite
   - Root Directory: `frontend` (frontend lives in `frontend/` in this monorepo)
   - Build Command: `npm run build`
   - Output Directory: `dist` (relative to root directory)
   - Environment Variables: `VITE_API_BASE_URL=https://inventory-project-6szy.onrender.com`
   - **Prerequisite (DONE 2026-10-10):** `axios` is declared in `frontend/package.json` and locked in `frontend/package-lock.json`; isolated clean-install build verified (K17 resolved)

### 16.6 Required Backend Changes (Pre-Frontend) — COMPLETED

| Change | File | Priority | Status |
|--------|------|----------|--------|
| Add cookie support to `/auth/login` | `server.js` | **Required** | ✅ Done |
| Add `/auth/logout` endpoint | `server.js` | **Required** | ✅ Done |
| Update `authenticateToken` to read cookie | `server.js` | **Required** | ✅ Done |
| Add `Access-Control-Allow-Credentials` to CORS | `server.js` | **Required** | ✅ Done |
| Add `/auth/logout` route | `server.js` | **Required** | ✅ Done |
| Increase Prisma transaction timeout | `SaleService.js` | ✅ Done | ✅ Done |
| Update `ALLOWED_ORIGINS` for production | Render Dashboard | **Required** | ☐ Pending (production only) |

### 16.7 Stage 12 Implementation Sequence

| Phase | Tasks | Deliverable | Status |
|-------|-------|-------------|--------|
| **0. Setup** | Initialize Vite+React+TS+Tailwind, configure ESLint/Prettier, install deps | Working dev environment | ✅ Done |
| **1. Auth Foundation** | Implement `useAuth`, `login`, `logout`, cookie + fallback storage, route guards | Working login/logout, protected routes | ✅ Done |
| **2. Layout & Navigation** | Sidebar, header, role-aware navigation, responsive layout | App shell with role-aware nav | ✅ Done |
| **3. Dashboard** | Low-stock alerts, today's sales, quick actions | Functional dashboard | ✅ Done |
| **4. Products CRUD** | List, create (Admin), detail, edit (Admin) | Full product management | ✅ Done |
| **5. Stock Management** | Stock list, detail, receive stock, reorder level (Admin) | Stock management complete | ✅ Done 2026-10-10 (no separate detail page; reorder level is a dialog on `/stock`) |
| **6. Sales** | Sale list, create (checkout), detail, cancel (Admin) | Full sales workflow | ✅ Done 2026-10-10 |
| **7. Reports** | Daily/weekly/monthly views, date picker, generate report | Reporting complete | ✅ Done 2026-10-10 (daily generate + range table + CSV export; no weekly/monthly rollups, no `/reports/:date` page) |
| **8. User Management (Admin)** | List, create, view, password reset | Admin panel complete | ✅ Done 2026-10-10 (create + reset password via dialogs; no `/users/:id` page) |
| **9. Polish & Hardening** | Error boundaries, loading states, empty states, a11y, dark mode | Production-ready UI | ◐ Partial — loading/empty states and basic aria done; **no error boundaries, no dark mode, no E2E/browser tests** |
| **10. Vercel Deploy** | Connect repo, configure env vars, CORS, custom domain | Live on Vercel | ☐ Pending (Stage 13; packaging prerequisites resolved 2026-10-10) |

**Estimated Effort:** ~10-14 days for MVP (Phases 0-6), +3-5 days for polish/deploy.

### 16.8 Open Questions / Decisions Needed

| Question | Recommendation | Decision Required |
|----------|----------------|-------------------|
| JWT expiration: keep 8h or reduce to 1-2h? | Keep 8h for now; revisit with refresh tokens in Stage 13 | ☐ Confirm |
| Cookie migration: simultaneous Bearer + cookie, or hard cut? | Simultaneous support (backend reads both), frontend prefers cookie | ☐ Confirm |
| Refresh token? | Defer to Stage 13 (add refresh endpoint + silent refresh) | ☐ Defer |
| Real-time updates (stock/sales)? | Defer: polling (30s) or SSE; WebSocket overkill for now | ☐ Defer |
| Offline support? | Not needed (internal app, stable connectivity) | ✅ Confirmed |
| Barcode scanning (camera)? | Defer to Stage 13+ (native capability) | ☐ Defer |

---

## 17. Stage 13 — Frontend Deployment (Vercel)

> **Status: NOT STARTED.** The frontend is implemented in `frontend/` (same monorepo, not a separate repo).

| Step | Action |
|------|--------|
| 1 | Push this repo (`main`) to GitHub — **5 local commits currently unpushed** (§2) |
| 2 | Import in Vercel → Framework: Vite, Root Directory: `frontend` |
| 3 | Set Build Command: `npm run build`, Output: `dist` |
| 4 | Add Environment Variable: `VITE_API_BASE_URL=https://inventory-project-6szy.onrender.com` (**not** `VITE_API_URL`) |
| 5 | Configure Custom Domain (optional) |
| 6 | Update Render `ALLOWED_ORIGINS` with the exact Vercel domain(s) |
| 7 | ~~Prerequisite: add `axios` to `frontend/package.json`~~ **DONE 2026-10-10** (also `autoprefixer`; clean-room build verified, K17 resolved) |
| 8 | Browser-verify cross-origin login, cookie persistence, logout (currently unverified) |
| 9 | Enable Vercel Analytics/Speed Insights (optional) |

---

## 18. Pre-deployment Checklist (Updated)

- [ ] Remove or change all seeded logins and passwords; create real Admin accounts.
- [ ] Strong `JWT_SECRET`; set all env vars on the host (never commit `.env`).
- [ ] **Resolve K5.** (K1–K4, K6–K8 resolved in Stages 6–9; K13 resolved in the 2026-10 audit; K5 remains OPEN)
- [ ] CORS limited to the frontend's origin; `helmet`; login rate limiting.
- [ ] Build step runs `npx prisma generate`; schema applied with `npx prisma migrate deploy`.
- [ ] Separate dev and production databases; Aiven backups understood.
- [ ] Decide timezone handling (K10) before the first real daily close-out.
- [ ] **Frontend: Cookie auth implemented and tested.** ◐ Implemented + covered by Regression tests (server-side); **cross-origin browser flow unverified**
- [ ] **Frontend: CORS configured for production origins.**
- [ ] **Frontend: Deployed to Vercel and verified.**

---

## 19. Stage 11 Follow-up Summary (Completed — HISTORICAL SNAPSHOT, as of Stage 11)

> Historical record of Stage 11; the 260/260 figure predates the 2026-10 audit suites. Current test baseline: §9.

| Item | Status |
|------|--------|
| Flaky test root cause | Prisma transaction timeout (5s) < Aiven latency (3-4s/query) |
| Fix applied | Transaction timeout increased to 60s in `SaleService.js` |
| Test result | 260/260 tests pass consistently |
| JWT audit | Complete — 8h expiry, HS256, secure transport; HttpOnly cookie migration planned (since implemented, §16.4) |
| Security controls | 15/15 verified |
| Total tests | 260/260 passing |
| Render service | Live at https://inventory-project-6szy.onrender.com |
| Git | Clean, pushed to `origin/main` **at that time; the 2026-10 audit commits are still unpushed (§2)** |

**Final Verdict:** **STAGE 11 VERIFIED — COMPLETE** → Ready for Stage 12.

---

## 18b. Next Steps

1. ~~Implement cookie-based auth~~ **DONE** (backend §16.4 + frontend `authStore`/`api.ts`; prod cookies `SameSite=None; Secure`)
2. ~~Initialize frontend repo~~ **DONE** (Vite + React 19 + TypeScript + Tailwind v4 in `frontend/`)
3. ~~Implement Auth + Layout + Dashboard + all feature pages~~ **DONE** (all 12 pages implemented; `npm run build` green)
4. **Deploy to Vercel (Stage 13)** → set `VITE_API_BASE_URL` → update backend `ALLOWED_ORIGINS` → verify CORS + cookies cross-origin
5. Optional hardening: K5 (separate test DB), K10 (business timezone), K15 (Jest/supertest migration), K16 (code splitting), residual root `package.json` cleanup (unused frontend-ish dev deps, unused `cors` package)

---

## FINAL VERDICT

**STAGE 12 COMPLETE — backend + frontend verified (2026-10-10).**

`npm test` → all 9 suites passed (Regression 29/29). Frontend `npm run build` green.

**PROJECT_CONTEXT.md consistency audit (2026-10-10): COMPLETE** — false/stale claims corrected, duplicate sections collapsed; new risks K17 (axios undeclared in `frontend/package.json`) and K18 (NODE_ENV production dependency) documented in §12.

**K17 RESOLVED (2026-10-10 follow-up):** axios + autoprefixer now declared in `frontend/package.json` with updated `frontend/package-lock.json`; masking root copies removed; isolated clean-room `npm ci` + build verified; oxlint clean (0 errors) after fixing conditional hooks in `ProductForm.tsx`; backend suite re-verified (all 9 green).

**Remaining work:** Stage 13 (Vercel deployment — packaging blockers cleared; CORS/`ALLOWED_ORIGINS` + browser verification still pending) and the open known issues in section 12 (K5, K10, K11, K12, K15, K16, K18).

- All dates are UTC. `reportDate` is stored at `00:00:00.000Z`; the sales window is that UTC day. "Today" = the server's UTC date. Future dates are rejected; today is accepted.
- Never use local-time methods (`setHours`, `setDate`) on dates. Use `setUTCHours`, `setUTCDate`, or ISO strings.
- Existing reports were originally stored at local midnight (23:00Z) and were shifted +1h to UTC midnight on 2026-10-06. `seed.js` now uses UTC.
- The shop is in WAT (UTC+1): sales between 00:00 and 00:59 local time count toward the previous UTC day, and closing out the new local day during that hour is rejected. Accepted for now (see K10).
- Prisma `Decimal` values serialize to JSON as **strings**. The frontend must parse them (`lib/format.ts` handles this via `Number()`).

## 9. Testing

- **`npm test`** now runs everything: `tests/run-all.js` spawns each suite as a child process, watches for `❌` / `Total: N passed, M failed` patterns and non-zero exits, and prints a final `RESULT:` line. It fails (non-zero) if any suite fails.
- Individual suites (exact filenames in `tests/`): `node tests/<Name>.test.js` (`AuthService.bcrypt`, `ProductService`, `StockService`, `SaleService`, `ReportService`, `Authorization`, `Stage8Api`, `Stage9Security`, `Regression`; `run-all.js` spawns all nine).
- **Trust ranking (from the 2026-10 audit):** `Regression.test.js` (29 assertions, real HTTP + DB checks, exits non-zero on failure) is the most trustworthy. `Stage7Authorization` and `Stage8Api` do real requests. Several older suites (`ProductService`, `StockService`, etc.) print ✅/❌ but historically exited 0 regardless of failures — read their output, don't trust the exit code. `Stage9Security.test.js` contains hardcoded PASS lines (its K8 check was broken; a static-file check was added in Regression instead).
- Output format per function: valid input, missing fields, invalid values, business rules, DB state verified by direct query, transaction integrity. Each marked PASS / FAIL / N/A.
- Conventions: `TEST_` prefix for test data; clean up in `try/finally`; each test uses its own non-colliding date (report tests use 2026-07-0x); assert the **specific** expected error message. A test that only checks "something threw" once passed because of a unique-constraint error, which is a false pass.
- Tests run against the live shared Aiven database (see K5).
- Last known (2026-10-10): `npm test` → all 9 suites passed, Regression 29/29. Re-verified later the same day after the K17 dependency fix and `ProductForm.tsx` hooks fix: all 9 suites passed again, Regression 29/29. Service suites use short passwords (`pass`, `newpass`) deliberately — password min-length enforcement in the UI is 8 chars, but the backend accepts any non-empty password, so these still pass.
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
| K4 | HIGH | ~~No role enforcement: any logged-in user can do anything.~~ **RESOLVED in Stage 7** | ~~`requireRole` middleware on all protected routes; 56 authorization tests.~~ |
| K5 | HIGH | Dev, tests and `seed.js` all hit the shared production-style Aiven DB; `seed.js` wipes every table. | Create a separate dev/test database; make seed refuse to run without a `--force` flag. |
| K6 | MED | ~~Error mapping uses `err.message.includes(...)`; invalid/expired JWT returns 403 (should be 401); no central error middleware.~~ **RESOLVED in Stage 6** | ~~Stage 6: custom error classes + one error handler.~~ |
| K7 | MED | ~~`quantityCrates` only increases (on delivery); sales never decrement it, so it drifts from bottles.~~ **RESOLVED in Stage 9** | ~~Derive crates from bottles ÷ crateSize, or maintain both consistently. Decide.~~ |
| K8 | MED | ~~Every file creates its own `new PrismaClient()` (about 12 connection pools); risks hitting the free-tier connection limit.~~ **RESOLVED in Stage 9** | ~~One shared `lib/prisma.js` instance.~~ |
| K9 | MED | ~~No user-management routes; users only via seed/scripts.~~ **RESOLVED in Stage 8** | ~~Admin-only create user / change password / list users.~~ |
| K10 | MED | Shop day (UTC+1) vs UTC day offset of one hour. | A `BUSINESS_TZ` offset constant for day boundaries, or `@db.Date` for reportDate. |
| K11 | LOW | JWT role stays stale up to 8h after a role change; **logout exists** (`POST /auth/logout` clears the cookie) but the JWT itself is not server-side revocable (blacklist/`jti`), and there is no refresh flow. | Short expiry + refresh, or re-check role from DB on sensitive routes; optional token blacklist. |
| K12 | LOW | `crateSize` of 0 is allowed, so crate conversion silently yields 0 bottles. | Require positive integer or null. |
| K13 | LOW | ~~`receiveBatchOrder` and `generateDailyReport` don't verify the user exists, so a raw foreign-key error can surface.~~ **RESOLVED** | ~~Both services now check `userRepository.findById` and throw a clear NotFoundError.~~ |
| K14 | LOW | ~~No `npm test`, no runner.~~ **PARTIALLY RESOLVED (2026-10)** | `npm test` runs `tests/run-all.js` (9 suites, fails on any failure). Not Jest/supertest yet; older suites still have weak exit codes — see section 9. |
| K15 | MED | Test harnesses can false-pass: several suites print ✅/❌ but exit 0 regardless; `Stage9Security.test.js` has hardcoded PASS lines. | Migrate suites to Jest/supertest with real assertions and exit codes; until then rely on `Regression.test.js` + read suite output. |
| K16 | LOW | Frontend production build is a single ~610 kB chunk (no code splitting). | Route-level `React.lazy` + dynamic import; optional. |
| K17 | ~~HIGH~~ **RESOLVED (2026-10-10)** | ~~`axios` is imported by `frontend/src/services/api.ts` but is **not** declared in `frontend/package.json`; it resolves only from the root `node_modules` in this monorepo. A Vercel (or any frontend-only) install/build will fail. Root `package.json` also lists frontend-ish deps the backend does not need, and the `cors` npm package is installed but never imported (CORS is manual middleware).~~ **Fixed:** `axios` `^1.20.0` + `autoprefixer` `^10.6.1` declared in `frontend/package.json`/lockfile (autoprefixer was a second, clean-room-discovered instance of the same bug); masking root copies of both removed. Isolated clean-room `npm ci` + `npm run build` verified passing. | Residual (optional): prune remaining unused frontend-ish root dev deps and the unused `cors` package. |
| K18 | MED | Cookie auth production behavior depends on `NODE_ENV=production` being set on the host (drives `secure` + `sameSite: 'none'` + CORS credentials). This has not been verified against the live Render service config. | Confirm `NODE_ENV=production` in Render; re-run the production-cookie check (Regression suite already covers it in production mode). |

## 13. Roadmap

1. **Stage 6 — error handling:** ~~custom error classes (Validation 400, NotFound 404, Conflict 400), one central error middleware, 401 for bad/expired tokens, 404 for unknown routes, remove string matching.~~ **COMPLETED**
2. **Stage 7 — roles:** `requireRole` middleware. **VERIFIED AFTER REMEDIATION.** 14 protected routes enforced: Admin-only (POST /products, POST /products/:id/discontinue, POST /products/:id/reactivate, POST /sales/:id/cancel); Admin+Manager (GET /products, GET /stock/low, POST /stock/receive, POST /sales, GET /sales, GET /sales/:id, POST /reports/daily, GET /reports/:date, GET /reports). 56 authorization tests, 196 total tests pass.
3. **Stage 8 — missing routes and user management:** **VERIFIED — COMPLETE.** 8 new routes added (2 product, 2 stock, 4 user management). All 22 protected routes enforced. 48 Stage 8 API tests, 244 total tests pass. K9 resolved.
4. **Stage 9 — hardening:** **VERIFIED — COMPLETE.** K1 (server-side pricing), K2 (atomic stock decrement), K3 (cancellation restocks), K7 (crate/bottle consistency), K8 (shared PrismaClient), plus `helmet`, a CORS allowlist middleware, login rate limiting, body size limit, request validation. 15 security controls verified. 260 total tests pass. K1/K2/K3/K7/K8 resolved.
4. **Stage 10 — deployment preparation:** **VERIFIED — COMPLETE.** Build/start commands verified, health check confirmed, environment variables documented, Render configuration documented, 260 total tests pass. All K1–K8 resolved **except K5 (separate test database), which remains OPEN**.
5. **Stage 11 — production deployment & verification:** **VERIFIED — COMPLETE.** Production database migrations applied via Render Shell, Render Web Service Live, health check verified, 260 total tests pass, all security controls active.
6. **Stage 12 — frontend development:** **COMPLETE (2026-10-10).** All planned pages implemented (Dashboard, Products, ProductDetail, ProductForm, Stock, StockReceive, Sales, SaleDetail, SaleNew, Reports, Users, Login) with react-query hooks, role-aware routing, and a green production build (`npm run build` in `frontend/`). Backend contract fixes from the audit (reorderLevel 500, crate drift, `/auth/me`, sales include, prod cookie SameSite) shipped in `ec3bb1a`. See section 2 audit summary.
7. **Stage 13 — frontend deployment:** Vercel deployment, CI/CD pipeline. **Not started** — the app is deploy-ready pending CORS/`VITE_API_BASE_URL` wiring per section 16.5.

Ideas for later: weekly/monthly report views, profit margin from `costPerUnit`, expiry alerts via `findExpiringBefore`, low-stock notifications (email/WhatsApp), CSV/PDF report export, audit log, price history, barcode scanning, OpenAPI docs.

## 16. Stage 12 — Frontend Development Plan (HISTORICAL VERBATIM DUPLICATE)

> **Duplicate of §16 (first occurrence, above).** Retained verbatim; the audit fixed its content in both copies so there are no contradictions, but only the **first** §16 is canonical.

> **Status (2026-10-10): IMPLEMENTED (frontend not deployed).** This section is the original plan, kept for reference; where the plan and the shipped code differ, the notes below and `frontend/` are authoritative.
> **Shipped stack (verified from `frontend/package.json`):** React 19 (not 18), React Router v7 (not v6), Tailwind v4 via `@tailwindcss/postcss` (not v3 / no `tailwind.config.ts`), TypeScript ~6.0, TanStack Query 5 + Zustand 5, react-hook-form 7 + zod 3, axios. **Not used** (plan only): Headless UI, date-fns/Day.js (native `Date` + `Intl` in `lib/format.ts`), Recharts, Lucide (custom `components/ui/Icons.tsx`).
> **API origin env var:** `VITE_API_BASE_URL` (dev fallback `http://localhost:3000`, prod fallback the Render URL). The name `VITE_API_URL` used in older draft instructions is wrong — the code reads `VITE_API_BASE_URL` only.
> **Auth:** HttpOnly cookie primary + per-tab sessionStorage token fallback (never localStorage).
> **Route deviations from the planned table below:** shipped routes are `/login`, `/` (Dashboard), `/products`, `/products/new`, `/products/:id`, `/products/:id/edit`, `/stock`, `/stock/receive`, `/stock/receive/:productId`, `/sales`, `/sales/new`, `/sales/:id`, `/reports`, `/users`. There is no separate `/stock/:productId`, `/stock/:productId/reorder-level`, `/reports/:date`, `/users/:id`, or `/users/:id/password` page — reorder level, report generation, user creation and password reset are dialogs/forms inside the Stock, Reports and Users pages. Planned extra filters (pagination, sales date/user filters) are not implemented.
> **Packaging note (RESOLVED 2026-10-10):** `axios` is now declared in `frontend/package.json` (K17); a clean-room `npm ci` + `npm run build` inside an isolated `frontend/` copy passes. Older checkouts before this fix resolved axios only via the root `node_modules`.

### 16.1 Recommended Frontend Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Framework** | React 18 + TypeScript | Mature ecosystem, strong TypeScript support, excellent Vercel integration |
| **Build Tool** | Vite | Fast HMR, optimized production builds, first-class TypeScript support |
| **Routing** | React Router v6 | Declarative, nested routes, lazy loading support |
| **State Management** | TanStack Query (React Query) + Zustand | Server state caching/synchronization + lightweight client state |
| **UI Components** | Headless UI + Tailwind CSS | Accessible, unstyled components + utility-first styling, small bundle |
| **Forms** | React Hook Form + Zod | Performant, type-safe validation with schema sharing |
| **HTTP Client** | Axios (or Ky) | Interceptors for auth, retry logic, base URL config |
| **Date/Time** | date-fns (or Day.js) | Lightweight, tree-shakeable, UTC-safe |
| **Charts** | Recharts | Composable, SVG-based, responsive |
| **Icons** | Lucide React | Consistent, tree-shakeable, lightweight |

**Hosting:** Vercel (native Vite/React support, preview deployments, edge functions if needed)

**Why not alternatives:**
- Next.js: Overkill for a pure SPA backend-driven app; adds SSR complexity not needed
- Redux/Zustand only: TanStack Query handles server state far better
- Material UI / Chakra: Heavier; Tailwind + Headless UI gives more control with less weight

### 16.2 Planned Pages & Routes (MVP → Full)

| Route | Purpose | Auth | Role Access | API Endpoints |
|-------|---------|------|-------------|---------------|
| `/login` | Login form, JWT storage | Public | — | `POST /auth/login` |
| `/` (Dashboard) | Overview: low-stock alerts, today's sales, quick actions | Private | ADMIN, MANAGER | `GET /products?includeInactive=false`, `GET /stock/low`, `GET /sales?status=completed` |
| `/products` | Product catalog with search, filter, pagination | Private | ADMIN, MANAGER | `GET /products` |
| `/products/new` | Create product (Admin only) | Private | ADMIN | `POST /products` |
| `/products/:id` | Product detail + stock + actions | Private | ADMIN, MANAGER | `GET /products/:id` |
| `/products/:id/edit` | Edit product (Admin only) | Private | ADMIN | `PUT /products/:id` |
| `/products/:id` | Product detail + stock + actions | Private | ADMIN, MANAGER | `GET /products/:id` |
| `/products/:id/edit` | Edit product (Admin only) | Private | ADMIN | `PUT /products/:id` |
| `/stock` | Stock overview with search, low-stock filter | Private | ADMIN, MANAGER | `GET /products?includeInactive=true`, `GET /stock/:productId` |
| `/stock/:productId` | Stock detail + receive stock | Private | ADMIN, MANAGER | `GET /stock/:productId`, `POST /stock/receive` |
| `/stock/:productId/reorder-level` | Adjust reorder level (Admin) | Private | ADMIN | `PUT /stock/:productId/reorder-level` |
| `/sales` | Sales history with filters (date, status, user) | Private | ADMIN, MANAGER | `GET /sales` |
| `/sales/new` | Create sale (checkout) | Private | ADMIN, MANAGER | `POST /sales` |
| `/sales/:id` | Sale detail + items + cancel action | Private | ADMIN, MANAGER | `GET /sales/:id`, `POST /sales/:id/cancel` |
| `/reports` | Daily/weekly/monthly reports with date picker | Private | ADMIN, MANAGER | `GET /reports`, `GET /reports/daily`, `POST /reports/daily` |
| `/reports/:date` | Single day report detail | Private | ADMIN, MANAGER | `GET /reports/:date` |
| `/users` | User management (Admin only) | Private | ADMIN | `GET /users`, `POST /users` |
| `/users/:id` | User detail (Admin) | Private | ADMIN | `GET /users/:id` |
| `/users/:id/password` | Password reset (Admin) | Private | ADMIN | `PUT /users/:id/password` |
| `/login` | Login page | Public | — | `POST /auth/login` |

**Navigation:**
- Persistent sidebar (collapsible on mobile)
- Top bar: user avatar/name, role badge, logout
- Role-aware: Admin-only links hidden from Manager

### 16.3 API Integration Layer

**File Structure (proposed):**
```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts          # Axios instance with interceptors
│   │   ├── endpoints.ts       # Endpoint constants + types
│   │   ├── auth.ts            # Login, token refresh, logout
│   │   ├── products.ts        # Product API
│   │   ├── stock.ts           # Stock API
│   │   ├── sales.ts           # Sales API
│   │   ├── reports.ts         # Reports API
│   │   └── users.ts           # Users API (admin)
│   ├── components/
│   │   ├── ui/                # Reusable UI primitives (Button, Input, Table, Modal, etc.)
│   │   ├── layout/            # Sidebar, Header, Layout wrapper
│   │   └── forms/             # Reusable form components
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Products.tsx
│   │   ├── ProductDetail.tsx
│   │   ├── ProductForm.tsx
│   │   ├── Stock.tsx
│   │   ├── StockDetail.tsx
│   │   ├── Sales.tsx
│   │   ├── SaleDetail.tsx
│   │   ├── SaleForm.tsx
│   │   ├── Reports.tsx
│   │   ├── ReportDetail.tsx
│   │   ├── Users.tsx
│   │   ├── UserDetail.tsx
│   │   └── Login.tsx
│   ├── hooks/
│   │   ├── useAuth.ts         # Auth state, login, logout, token refresh
│   │   ├── usePermissions.ts  # Role-based UI helpers
│   │   └── useDebounce.ts
│   ├── store/
│   │   ├── authStore.ts       # Zustand: user, token, login/logout
│   │   └── uiStore.ts         # Sidebar, modals, toasts
│   ├── types/
│   │   └── api.ts             # Shared TypeScript types from API
│   ├── utils/
│   │   ├── date.ts            # UTC-safe formatting
│   │   ├── currency.ts        # XAF formatting
│   │   └── validation.ts      # Shared Zod schemas
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── vercel.json
```

### 16.4 Authentication & Token Storage Strategy (VERIFIED — IMPLEMENTED)

**Current Backend (Verified — Cookie-Based Auth Implemented):**
- `POST /auth/login` → returns `{ token, user { id, fullName, email, role } }` **AND** sets HttpOnly cookie
- JWT payload: `{ userId, role }`, expires in **8 hours** (`expiresIn: '8h'`)
- Cookie: `token` with `httpOnly: true`, `secure: true` (production), `sameSite: 'none'` in production / `'strict'` in development (`isProduction ? 'none' : 'strict'`), `maxAge: 8h`, `path: '/'` (verified in `server.js`; Regression test asserts `SameSite=None; Secure; HttpOnly` on a production-mode login)
- `jwt.verify()` validates signature + expiration → 401 on expiry/malformed/invalid
- `POST /auth/logout` clears the cookie
- No refresh token endpoint exists

**Security Assessment (VERIFIED):**
| Aspect | Current | Risk |
|--------|---------|------|
| JWT in `localStorage` | ❌ **REMOVED** | — |
| JWT in `sessionStorage` | ✅ Used as fallback only | Low |
| HttpOnly cookie (`Secure` + `SameSite=None` in production; `SameSite=Strict` in dev) | ✅ **IMPLEMENTED** | **Low** (see CSRF row) |
| `Access-Control-Allow-Credentials` | ✅ **ENABLED** | **Low** |
| CSRF Protection | ⚠️ **Partial** — production `SameSite=None` means cross-site cookie sends are possible in principle; actual protection = HttpOnly (token unreadable by JS) + CORS origin allowlist (403 for unknown origins) + JSON `Content-Type` (preflighted). **Not verified in a real browser cross-site test.** | **Medium (unverified)** |

**Implemented Backend Changes:**

1. **Cookie-based auth endpoint** (alongside existing Bearer token):
```javascript
// server.js - actual /auth/login cookie code
const isProduction = process.env.NODE_ENV === 'production';
res.cookie('token', token, {
  httpOnly: true,
  secure: isProduction,   // HTTPS only in production
  sameSite: isProduction ? 'none' : 'strict', // None required for Vercel<->Render cross-origin
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
  path: '/'
});
```

2. **Updated `authenticateToken` middleware** to read from cookie first:
```javascript
// actual middleware: Bearer prefix checked explicitly
const cookieToken = req.cookies?.token;
const authHeader = req.headers['authorization'];
const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

const token = cookieToken || headerToken;
```

3. **Logout endpoint** (clears cookie):
```javascript
app.post('/auth/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
    path: '/'
  });
  res.json({ ok: true });
});
```

4. **CORS credentials** enabled in middleware:
```javascript
if (isAllowed) {
  res.header('Access-Control-Allow-Credentials', 'true');
  // ...
}
```

5. **Frontend login** → `credentials: 'include'` on all requests.

**Frontend Token Handling (Verified):**
- JWT stored in **HttpOnly cookie** (primary) + `sessionStorage` fallback for tab restore
- **Never** use `localStorage`
- Auto-refresh not needed with 8h expiry; redirect to `/login` on 401

**Migration Path:** Cookie support deployed alongside Bearer tokens; frontend prefers cookies, falls back to `sessionStorage` + `Authorization` header.

### 16.5 Vercel Deployment & CORS Configuration

**Current Backend CORS (server.js):**
```javascript
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
```

**Required Changes for Production:**
1. **Set `ALLOWED_ORIGINS` in Render dashboard:** ☐ Pending —
   ```
   ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app
   ```
   (Replace with the actual Vercel deployment URL(s); must match the browser Origin header exactly.)

2. **Enable credentials in CORS (server.js):** ✅ Already done —
   the middleware already sends `Access-Control-Allow-Credentials: true` for allowed origins (since `fb67873`).

3. **Frontend `vercel.json` (PROPOSED template — no `vercel.json` exists in the repo yet):**
   ```json
   {
     "framework": "vite",
     "buildCommand": "npm run build",
     "devCommand": "npm run dev",
     "installCommand": "npm ci",
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "X-Content-Type-Options", "value": "nosniff" },
           { "key": "X-Frame-Options", "value": "DENY" },
           { "key": "Referrer-Policy", "value": "no-referrer" }
         ]
       }
     ]
   }
   ```

4. **Vercel Project Settings:**
   - Framework Preset: Vite
   - Root Directory: `frontend` (frontend lives in `frontend/` in this monorepo)
   - Build Command: `npm run build`
   - Output Directory: `dist` (relative to root directory)
   - Environment Variables: `VITE_API_BASE_URL=https://inventory-project-6szy.onrender.com`
   - **Prerequisite (DONE 2026-10-10):** `axios` is declared in `frontend/package.json` and locked in `frontend/package-lock.json`; isolated clean-install build verified (K17 resolved)

### 16.6 Required Backend Changes (Pre-Frontend) — COMPLETED

| Change | File | Priority | Status |
|--------|------|----------|--------|
| Add cookie support to `/auth/login` | `server.js` | **Required** | ✅ Done |
| Add `/auth/logout` endpoint | `server.js` | **Required** | ✅ Done |
| Update `authenticateToken` to read cookie | `server.js` | **Required** | ✅ Done |
| Add `Access-Control-Allow-Credentials` to CORS | `server.js` | **Required** | ✅ Done |
| Add `/auth/logout` route | `server.js` | **Required** | ✅ Done |
| Increase Prisma transaction timeout | `SaleService.js` | ✅ Done | ✅ Done |
| Update `ALLOWED_ORIGINS` for production | Render Dashboard | **Required** | ☐ Pending (production only) |

### 16.7 Stage 12 Implementation Sequence

| Phase | Tasks | Deliverable | Status |
|-------|-------|-------------|--------|
| **0. Setup** | Initialize Vite+React+TS+Tailwind, configure ESLint/Prettier, install deps | Working dev environment | ✅ Done |
| **1. Auth Foundation** | Implement `useAuth`, `login`, `logout`, cookie + fallback storage, route guards | Working login/logout, protected routes | ✅ Done |
| **2. Layout & Navigation** | Sidebar, header, role-aware navigation, responsive layout | App shell with role-aware nav | ✅ Done |
| **3. Dashboard** | Low-stock alerts, today's sales, quick actions | Functional dashboard | ✅ Done |
| **4. Products CRUD** | List, create (Admin), detail, edit (Admin) | Full product management | ✅ Done |
| **5. Stock Management** | Stock list, detail, receive stock, reorder level (Admin) | Stock management complete | ✅ Done 2026-10-10 (no separate detail page; reorder level is a dialog on `/stock`) |
| **6. Sales** | Sale list, create (checkout), detail, cancel (Admin) | Full sales workflow | ✅ Done 2026-10-10 |
| **7. Reports** | Daily/weekly/monthly views, date picker, generate report | Reporting complete | ✅ Done 2026-10-10 (daily generate + range table + CSV export; no weekly/monthly rollups, no `/reports/:date` page) |
| **8. User Management (Admin)** | List, create, view, password reset | Admin panel complete | ✅ Done 2026-10-10 (create + reset password via dialogs; no `/users/:id` page) |
| **9. Polish & Hardening** | Error boundaries, loading states, empty states, a11y, dark mode | Production-ready UI | ◐ Partial — loading/empty states and basic aria done; **no error boundaries, no dark mode, no E2E/browser tests** |
| **10. Vercel Deploy** | Connect repo, configure env vars, CORS, custom domain | Live on Vercel | ☐ Pending (Stage 13; packaging prerequisites resolved 2026-10-10) |

**Estimated Effort:** ~10-14 days for MVP (Phases 0-6), +3-5 days for polish/deploy.

### 16.8 Open Questions / Decisions Needed

| Question | Recommendation | Decision Required |
|----------|----------------|-------------------|
| JWT expiration: keep 8h or reduce to 1-2h? | Keep 8h for now; revisit with refresh tokens in Stage 13 | ☐ Confirm |
| Cookie migration: simultaneous Bearer + cookie, or hard cut? | Simultaneous support (backend reads both), frontend prefers cookie | ☐ Confirm |
| Refresh token? | Defer to Stage 13 (add refresh endpoint + silent refresh) | ☐ Defer |
| Real-time updates (stock/sales)? | Defer: polling (30s) or SSE; WebSocket overkill for now | ☐ Defer |
| Offline support? | Not needed (internal app, stable connectivity) | ✅ Confirmed |
| Barcode scanning (camera)? | Defer to Stage 13+ (native capability) | ☐ Defer |

---

## 17–19. Duplicates removed

> The duplicate copies of §17 (Stage 13 plan), §18 (pre-deployment checklist) and §19 (Stage 11 follow-up) that appeared in this part of the document were removed in the 2026-10-10 consistency audit. See the canonical §17, §18 and §19 above (§19 is a historical snapshot).

---

## 17–FINAL VERDICT. Duplicates removed

> The duplicate copies of "Next Steps" and "FINAL VERDICT" that appeared here were removed in the 2026-10-10 consistency audit. See the canonical **§18b Next Steps** and **FINAL VERDICT** above (after canonical §19).

---

## 14. Pre-deployment checklist (HISTORICAL — superseded by §18)

> **Superseded (2026-10-10 audit):** this older checklist duplicates §18 and still says "Resolve K1–K5"; only K5 is open (§12/§18). Do not use this list; use §18 above.

- [ ] Remove or change all seeded logins and passwords; create real Admin accounts.
- [ ] Strong `JWT_SECRET`; set all env vars on the host (never commit `.env`).
- [ ] ~~Resolve K1–K5.~~ **Stale — only K5 remains (§12).**
- [ ] CORS limited to the frontend's origin; `helmet`; login rate limiting.
- [ ] Build step runs `npx prisma generate`; schema applied with `npx prisma migrate deploy`.
- [ ] Separate dev and production databases; Aiven backups understood.
- [ ] Decide timezone handling (K10) before the first real daily close-out.

## 15. Intended screens (for the frontend) (HISTORICAL PLAN — implemented in §16 / `frontend/`)

> Historical Stage 12 planning list; the shipped 12-page app is documented in §16 and §2.

1. Login. 2. Catalog/dashboard: products with current stock and low-stock warnings. 3. Register product (Admin). 4. Log a delivery (product, crates, bottles, cost, expiry). 5. Checkout: pick products and quantities in bottles, clear error if stock is insufficient, nothing partially saved. 6. Sales history, filterable by status. 7. Daily close-out button. 8. Reports view over a date range (weekly/monthly built from daily rows).