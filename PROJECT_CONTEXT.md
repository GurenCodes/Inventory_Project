# Floramagg Drinks Shop — Project Context & Handover

Single source of truth for developers and AI assistants (opencode / Nemotron). Replaces the earlier PROJECT_CONTEXT.md.
Last updated: 2026-10-11 (corrective audit: cancelSale double-cancel race fixed, lint warnings eliminated, timezone date validation/range verified). State: Stage 12 COMPLETE + all corrective fixes shipped; `npm test` **all 11 suites** green (recorded run 2026-10-11: StockConcurrency 59/59, Stage9Security 52/52, ReportTimezone 38/38, Regression 44/44); frontend lint **0 errors, 0 warnings** and build green (recorded run 2026-10-11, Node 24 / Windows). Next: Stage 13 (Vercel deploy — see §17 and the §2 outstanding-work checklist). **Git (verified snapshot 2026-10-11 at push of prior session): `main` == `origin/main` == `010ac28`; the 2026-10-11 audit commits are committed locally and awaiting owner-confirmed push. Working tree status changes whenever this document is edited — always re-verify with `git status`; this file does not track it live.** See section 2 for the authoritative current state and section 12 for open issues (K5, K11, K12, K15, K16, K18).
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
| 2026-10-10 corrective session: stock atomicity, security tests, auth hardening, Douala timezone | **VERIFIED — COMPLETE** (commit `5a894bf`; all 11 suites green; pushed 2026-10-10 with owner confirmation) |
| 2026-10-11 corrective audit: cancelSale race, lint cleanup, timezone validation/range verification | **VERIFIED — COMPLETE** (backend: all 11 suites green incl. StockConcurrency 59/59; frontend: 0 lint warnings, build green; commits awaiting owner-confirmed push) |

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
| Repo / branch | `https://github.com/GurenCodes/Inventory_Project.git`, branch `main`; **verified snapshot 2026-10-11: `main` == `origin/main` == `010ac28`** (all 2026-10-10 work through `010ac28` pushed with owner confirmation; 2026-10-11 audit commits local-only pending confirmation); never assume a clean tree — verify with `git status` |

### Evidence classification (what is actually proven)

| Claim | Evidence level |
|---|---|
| `npm test` → all **11** suites passed | **Recorded execution result** (2026-10-11, after the cancelSale race fix: StockConcurrency 59/59, Stage9Security 52/52, ReportTimezone 38/38, Regression 44/44) |
| Stock crate/bottle invariant under concurrency; concurrent double-cancel restores stock exactly once | **Recorded execution result** (StockConcurrency suite against the live DB: concurrent increments/decrements/deliveries/cancels; single-statement atomic SQL + conditional sale-status transition) |
| Daily reports use the Africa/Douala business calendar; invalid calendar dates rejected; list range inclusive | **Recorded execution result** (ReportTimezone suite: boundary sales at 22:30Z / 22:59:59.999Z / 23:00:00Z; impossible dates 2026-02-30/13-01/00-10 rejected; inclusive start/mid/end list test) |
| Stage 9 security controls (headers, CORS, rate limit, K1/K2/K3/K7, no hash exposure) | **Recorded execution result** (Stage9Security suite: real assertions, non-zero exit on failure) |
| Frontend `npm run build` (`tsc -b && vite build`) green | **Recorded execution result** (2026-10-11; pre-existing 611 kB chunk-size advisory remains = K16) |
| Frontend lint (`oxlint`) exits 0 with **zero warnings** | **Recorded execution result** (2026-10-11: 0 errors, 0 warnings — all three prior `react(incompatible-library)` / `react(only-export-components)` warnings resolved) |
| Cookie-only auth viable cross-origin in a real browser | **Unverified** — bearer fallback deliberately retained (see §2/Task C note); needs deployed Vercel→Render setup |
| Render backend deployed, `/health` 200, migrations applied | **Verified at Stage 11** (historical; live state not re-verified 2026-10-10) |
| Cookie attributes in production (`SameSite=None; Secure`) | **Verified in code** (`server.js`) + **Regression test asserts the Set-Cookie header**; not verified in a real cross-origin browser session |
| Frontend works end-to-end in a browser | **Unverified** — no E2E/browser testing performed |
| Vercel deployment / production CORS wiring | **Not done** (Stage 13) |

### Audit of 2026-10-10 (what was actually wrong and what was fixed)

This audit verified claims in this document against the real code and tests. Findings and fixes (commits `ec3bb1a`, `da2ab4e`, `af985a5`, docs `0a894f7`):

- **PUT /products/:id with `reorderLevel` returned 500** (PrismaClientValidationError — the route passed `reorderLevel` to `updateProduct`, which rejects unknown fields). Fixed: the route applies reorder level via `stockService.adjustReorderLevel` and returns the product with its stock.
- **Crate drift in `receiveBatchOrder`** (11 bottles + 1 crate + 2 bottles left `quantityCrates` at 1 instead of 2). Fixed: crates recalculated from total bottles inside the interactive `$transaction`, with an optimistic `updateMany` guard on `quantityBottles` so concurrent deliveries cannot silently overwrite each other.
- **Frontend build was broken** (unclosed JSX in `Login.tsx`) and the working-tree had never compiled. Fixed; `npm run build` in `frontend/` now passes (`tsc -b && vite build`).
- **Placeholder pages replaced**: Stock, StockReceive, Sales, SaleDetail, SaleNew, Reports, Users were "Coming Soon" divs; all are now fully implemented against the real API (plus the 8 hooks in `frontend/src/hooks/` — `useAuth`, `useDashboard`, `usePermissions`, `useProducts`, `useReports`, `useSales`, `useStock`, `useUsers` — and `lib/format.ts`).
- **Session restore now real**: `initializeAuth` calls `GET /auth/me` instead of assuming a hardcoded token is a valid session; the login token is kept per-tab (sessionStorage) only as an Authorization-header fallback for blocked third-party cookies; never localStorage.
- **Login route moved outside the authenticated layout**; broken `/dashboard` nav link fixed to `/`; demo credentials shown only in dev builds; last-character password-peek removed.
- **`GET /reports` range query now includes `generatedBy`** for display.
- **New `npm test`** (HISTORICAL — describes the runner at the 2026-10-10 morning audit, not the current baseline): `tests/run-all.js` spawns all 9 suites and fails on any `❌` or non-zero exit — needed because several older suites print ✅/❌ but historically exited 0 regardless, and `Stage9Security.test.js` still contained hardcoded PASS lines at that time. The current runner/suite state is §9.
- Full verification (HISTORICAL — 2026-10-10 morning audit): `npm test` → all 9 suites passed (including Regression 29/29); frontend production build green.
- **2026-10-10 consistency audit (docs-only):** corrected cookie `SameSite` descriptions (production is `None`, not `Strict`), standardized the frontend env var to `VITE_API_BASE_URL` (code-established), documented that `axios` is used by the frontend but not declared in `frontend/package.json` (K17), labeled historical stage snapshots, and collapsed verbatim-duplicate sections §16–19.
- **2026-10-10 dependency-fix follow-up (K17 resolved)** (HISTORICAL — lint/suite figures are from that session; current figures are in §2/§9): `axios` `^1.20.0` added to `frontend/package.json` dependencies and `frontend/package-lock.json`; `autoprefixer` `^10.6.1` added to frontend devDependencies (a clean-room `npm ci` + `npm run build` in an isolated directory previously failed on BOTH missing packages — axios resolved via root `node_modules`, autoprefixer via the root copy). The no-consumer copies of `axios` and `autoprefixer` were removed from the root `package.json`/lockfile (root still lists some unused frontend-ish dev deps: `postcss`, `tailwindcss`, `vite`, `typescript`, React types/plugins — harmless residue, optional cleanup later). A clean-room isolated `npm ci` + `npm run build` then passed (176 modules, dist emitted). Lint (`oxlint`) then exited 0 with 3 advisory warnings (eliminated 2026-10-11 — see below). `opencode_log.txt` (a terminal-escape junk file committed in the recovery snapshot `d877344`) is now gitignored and untracked going forward.

Known still-open items are tracked in section 12 (K5, K11, K12, K15, K16, K18; K10 resolved 2026-10-10, K17 resolved 2026-10-10) and summarized in the §2 outstanding-work checklist.
- **2026-10-10 second consistency audit (docs-only, this commit):** verified the document against the repo after the push; corrected the stale "ahead-by-7 / NOT pushed" Git claims (all eight commits are on `origin/main`, HEAD `cefc4ef`), fixed the broken Stage 9/Stage 10 roadmap numbering, removed duplicate route rows in §16.2, added the authoritative outstanding-work checklist in §2 (superseding §18/§18b), and aligned the header, §17, §19 and FINAL VERDICT with the post-push state. No code changes.

Git (2026-10-11, start of the corrective-audit session): branch `main`; **verified snapshot: HEAD == origin/main == `010ac28`** ("docs: record verified push of corrective-session commits"), working tree clean, 0 ahead / 0 behind. The 2026-10-10 work through `010ac28` is fully pushed and verified. This session's commits are local-only until owner-confirmed push (§10/§11). Treat any "clean tree" claim in this file as historical unless re-verified with `git status`.

- **2026-10-11 corrective audit (commits pending push):** evidence-based audit of the checkout. (1) **`cancelSale` double-cancel race fixed** (`SaleService.js`): the completed→cancelled transition is now a conditional `updateMany({ where: { id, status: 'completed' } })` executed FIRST inside the transaction, locking the sale row before any restock; a concurrent second cancel blocks on the row lock, matches 0 rows, throws, and rolls back — stock can never be restored twice (new StockConcurrency sections 13–14: concurrent double-cancel restores exactly once; concurrent cancel + new sale preserves the invariant). (2) **Frontend lint: 0 errors, 0 warnings** — `ProductForm.tsx` and `StockReceive.tsx` now use `useWatch` instead of the unstable `watch()` function (React Compiler `incompatible-library` warnings resolved), and the `App` component was extracted from `main.tsx` to `frontend/src/App.tsx` (Fast Refresh `only-export-components` warning resolved; provider ordering unchanged). Create/edit/authorization behavior preserved. (3) **Business-timezone hardening**: `todayBusinessDate()` (backend) and `businessToday()` (frontend) now build `YYYY-MM-DD` explicitly from `Intl.formatToParts` with zero-padding instead of relying on the `en-CA` locale's default string shape; `businessDayBounds()` strict validation was VERIFIED already correct (impossible dates 2026-02-30 / 2026-13-01 / 2026-00-10 / 2026-00-00 / empty / whitespace all rejected — new ReportTimezone section 8), the inclusive calendar-date range semantics of `GET /reports` were confirmed and pinned by test (section 10), and ISO timestamp inputs remain accepted per the documented contract. (4) **Verified-not-defective**: all production stock mutation paths (`incrementBottlesAndCrates`, `conditionalDecrementWithCrates`, `receiveBatchOrder`, product-creation stock row, `adjustReorderLevel`) already use atomic single-statement SQL or scoped updates; `run-all.js` failure propagation (spawn/timeout/exit/markers) verified from code; Stage9Security assertions and cleanup verified real. StockConcurrency grew 41→59 assertions; ReportTimezone 18→38. Full verification: `npm test` → all 11 suites passed; frontend lint 0/0; build green.

- **2026-10-10 corrective session (commit `5a894bf`):** four targeted fixes, each with new focused tests — (1) **stock concurrency**: `incrementBottlesAndCrates`, `conditionalDecrementWithCrates` and `receiveBatchOrder` now update bottles AND crates in ONE parameterized SQL statement (`UPDATE "Stock" … FLOOR((…)::numeric / crateSize)`), eliminating the guard window where a successful return could carry a stale crate count; no retries needed (single-statement atomicity); new `StockConcurrency` suite 41/41. (2) **security-test integrity**: `Stage9Security.test.js` rewritten — all "PASS (verified in service tests)" placeholders replaced with real in-suite assertions (K1 price spoofing, K2 concurrent oversell, K3 cancel-restock, K7 invariant), shared-Prisma check now scans every repo+service file, temp-user login (no seeded credentials), proper exit codes; `run-all.js` treats the old placeholder string as a failure marker and flags spawn/timeout failures. (3) **auth hardening**: bearer fallback **deliberately retained** (frontend not deployed; third-party-cookie viability unverifiable from the repo — owner decision listed in the checklist); `authStore` no longer persists `isAuthenticated` (only `user` display cache); axios 401 responses now `clearSession()`; Regression sections 8–9 cover dev-cookie attrs, logout clearing, expired-token 401, role intactness, and static no-persistence checks. (4) **business timezone**: new `lib/businessTime.js` (Intl-only, no new dependency) implements the `Africa/Douala` calendar — daily report generation and queries use the half-open Douala-day interval, future-date validation uses the business calendar, `reportDate` storage stays at UTC midnight of the calendar date (unique constraint + existing rows preserved); frontend `businessToday()`/`businessDaysAgo()` replace UTC-based date defaults and `formatReportDate` no longer shifts days for non-UTC browsers; new `ReportTimezone` suite 18/18. Full verification: `npm test` → all 11 suites passed; frontend lint 0 errors; build green.

### Outstanding work (authoritative checklist — 2026-10-11, after corrective audit)

> This is the single authoritative list of what remains. Older checklists (§14 historical, §18, §18b, §16.5/16.8, FINAL VERDICT) are superseded by this list; §12 tracks the same items with evidence and suggested fixes. Items completed by earlier sessions (stock atomicity, security-test integrity, auth store hardening, Douala business timezone / old K10, the 2026-10-11 cancelSale race fix and lint cleanup) are removed.

**Git:**
- [ ] Push the 2026-10-11 corrective-audit commits (implementation + docs) to `origin/main` after owner confirmation (§10/§11). Prior work through `010ac28` is already pushed and verified.

**Deployment (Stage 13, §17):**
- [ ] Import the repo in Vercel (Framework: Vite, Root Directory: `frontend`, Build Command: `npm run build`, Output: `dist`).
- [ ] Set `VITE_API_BASE_URL=https://inventory-project-6szy.onrender.com` in Vercel (not `VITE_API_URL`).
- [ ] Update Render `ALLOWED_ORIGINS` to the exact Vercel domain(s).
- [ ] Browser-verify cross-origin login, cookie persistence, logout (never verified in a real browser; only code + server-side tests exist).
- [ ] Confirm `NODE_ENV=production` on Render (K18) and re-run the production-cookie check.
- [ ] **Owner decision:** after deployment, confirm whether third-party cookies work for Vercel→Render; if yes, remove the sessionStorage bearer fallback and stop returning the token in the login body (cookie-only auth); if no, keep the fallback and accept the documented XSS trade-off (§2/Task C note).

**Data / infra risks:**
- [ ] K5 (HIGH): separate dev/test database; make `seed.js` refuse to run without `--force`.
- [ ] Pre-go-live: remove/replace seeded logins (`staff1`…`staff10`); strong `JWT_SECRET`; separate prod DB; backups understood.

**Optional hardening / polish (not blocking deploy):**
- [ ] K11: JWT revocation/refresh consideration (low priority; logout cookie-clearing exists; fallback token trade-off documented).
- [ ] K12: require positive integer or null for `crateSize` at creation (current behavior: crate sync skipped when invalid — preserved and tested incl. negative/NaN).
- [ ] K15/K14: migrate legacy service suites to Jest/supertest; Stage9Security, StockConcurrency, ReportTimezone and Regression now assert for real.
- [ ] K16: route-level `React.lazy` code splitting (~612 kB single chunk).
- [ ] UI polish: ErrorBoundary, dark mode, E2E/browser tests (§16.7 Phase 9 partial).
- [ ] Root `package.json` residual cleanup: unused frontend-ish dependencies/devDependencies and the unused `cors` package (§3).

## 3. Stack and environment

- Node.js v24.19.0 (CommonJS), Express 5.2.x, Prisma **6.19.x**, PostgreSQL on Aiven (shared with a collaborator), jsonwebtoken 9, bcrypt 6, dotenv.
- **Stage 9 dependencies**: `helmet` (security headers), `express-rate-limit` (rate limiting). The `cors` npm package is listed in `package.json` but **not imported anywhere** — CORS is a manual middleware in `server.js` (see §7d).
- Frontend dependencies live in `frontend/package.json` (React 19, Vite 8, Tailwind 4, React Router 7, TanStack Query, Zustand, react-hook-form, zod, axios, autoprefixer). The root `package.json` still lists unused frontend-ish **dependencies** (`@tanstack/react-query`, `@tanstack/react-query-devtools`, `react-hot-toast`, `react-router-dom`) and **devDependencies** (`postcss`, `tailwindcss`, `vite`, `typescript` ^7.0.2, `@types/react-dom`, `@vitejs/plugin-react`, `@types/node`, `zustand`) as harmless residue, plus the unused `cors` package (CORS is manual middleware, §7d); the formerly-masking `axios` and `autoprefixer` root copies were removed on 2026-10-10 (K17). Optional cleanup — see the §2 outstanding-work checklist.
- Tools: VS Code, pgAdmin4, opencode 1.18.x using NVIDIA Nemotron 3 Ultra 550B. OS: Windows (PowerShell / cmd).
- `.env` (never commit): `DATABASE_URL` (Aiven string, `sslmode=require`), `JWT_SECRET`, optional `PORT` (default 3000). The Aiven database is named `defaultdb`. The server also reads `NODE_ENV` (production cookie behavior) and `ALLOWED_ORIGINS` (CORS).
- Commands: `npm start` | `npm test` (runs `tests/run-all.js`, all 11 suites) | `npx prisma generate` (after any schema change) | `npx prisma migrate dev --name <name>` (dev) | `npx prisma migrate deploy` (hosted) | `node seed.js` (**DESTRUCTIVE**) | `node tests/<Name>.test.js`. The `tests/` folder also holds two standalone utility scripts **not** part of `npm test`: `test-db-latency.js` and `test-jwt-expiration.js`. Frontend: `npm run dev|build|lint|preview` inside `frontend/`.
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
| ReportService | generateDailyReport, getReportByDate, listReports | Sums **completed** sales only for the **Africa/Douala business day** (half-open UTC interval, 2026-10 fix — K10). One report per calendar date (`reportDate` at UTC midnight). Today (business calendar) is allowed, future dates rejected. `listReports` range is **inclusive** of both end dates (UI "From"/"To" calendar dates). |
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

### 16.1 Recommended Frontend Stack (PLAN — actual stack: §2 / the §16 header note above)

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

> **Actual shipped structure (2026-10-10)** — differs from the plan above: `frontend/src/services/api.ts` (single axios module, not `src/api/`), `src/store/authStore.ts` (no `uiStore`), 8 hooks in `src/hooks/` (`useAuth`, `useDashboard`, `usePermissions`, `useProducts`, `useReports`, `useSales`, `useStock`, `useUsers`; no `useDebounce`), `src/lib/format.ts` (no `src/utils/`), `src/components/{ui,layout,auth}/`, 12 pages in `src/pages/` (no `StockDetail`/`SaleForm`/`ReportDetail`/`UserDetail`; `Login.tsx` once), no `tailwind.config.ts` (Tailwind v4), no `vercel.json` yet (Stage 13).

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
| **0. Setup** | Initialize Vite+React+TS+Tailwind, configure ESLint/Prettier **(shipped instead: oxlint only, no Prettier)**, install deps | Working dev environment | ✅ Done |
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
| JWT expiration: keep 8h or reduce to 1-2h? | Keep 8h for now; revisit with refresh tokens in a later hardening pass (not part of Stage 13) | ☐ Confirm |
| Cookie migration: simultaneous Bearer + cookie, or hard cut? | Simultaneous support (backend reads both), frontend prefers cookie | ☐ Confirm |
| Refresh token? | Defer to a later hardening pass (add refresh endpoint + silent refresh; Stage 13 is Vercel deployment only, §17) | ☐ Defer |
| Real-time updates (stock/sales)? | Defer: polling (30s) or SSE; WebSocket overkill for now | ☐ Defer |
| Offline support? | Not needed (internal app, stable connectivity) | ✅ Confirmed |
| Barcode scanning (camera)? | Defer to a later pass (native capability) | ☐ Defer |

---

## 17. Stage 13 — Frontend Deployment (Vercel)

> **Status: NOT STARTED.** The frontend is implemented in `frontend/` (same monorepo, not a separate repo).

| Step | Action |
|------|--------|
| 1 | ~~Push this repo (`main`) to GitHub~~ **DONE 2026-10-10** (all 2026-10-10 work pushed with owner confirmation; verified snapshot 2026-10-11: `main` == `origin/main` == `010ac28`, §2) |
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

> **Superseded (2026-10-10 second audit):** the authoritative outstanding-work checklist now lives in **§2**. This section is kept as supporting detail; where they differ, §12 and §2 win.

- [ ] Remove or change all seeded logins and passwords; create real Admin accounts.
- [ ] Strong `JWT_SECRET`; set all env vars on the host (never commit `.env`).
- [ ] **Resolve K5.** (K1–K4, K6–K8 resolved in Stages 6–9; K13 resolved in the 2026-10 audit; K5 remains OPEN)
- [ ] CORS limited to the frontend's origin; `helmet`; login rate limiting.
- [ ] Build step runs `npx prisma generate`; schema applied with `npx prisma migrate deploy`.
- [ ] Separate dev and production databases; Aiven backups understood.
- [ ] ~~Decide timezone handling (K10) before the first real daily close-out.~~ **RESOLVED 2026-10-10** (Africa/Douala business calendar — §12 K10).
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
| Git | Clean, pushed to `origin/main` **at that time; the 2026-10 audit commits were pushed later on 2026-10-10 — `main` is now in sync (§2)** |

**Final Verdict:** **STAGE 11 VERIFIED — COMPLETE** → Ready for Stage 12.

---

## 18b. Next Steps (HISTORICAL — superseded by the §2 outstanding-work checklist)

> Items 1–3 completed 2026-10-10; items 4–5 live on in the §2 checklist. Kept for the session narrative.

1. ~~Implement cookie-based auth~~ **DONE** (backend §16.4 + frontend `authStore`/`api.ts`; prod cookies `SameSite=None; Secure`)
2. ~~Initialize frontend repo~~ **DONE** (Vite + React 19 + TypeScript + Tailwind v4 in `frontend/`)
3. ~~Implement Auth + Layout + Dashboard + all feature pages~~ **DONE** (all 12 pages implemented; `npm run build` green)
4. **Deploy to Vercel (Stage 13)** → set `VITE_API_BASE_URL` → update backend `ALLOWED_ORIGINS` → verify CORS + cookies cross-origin
5. Optional hardening: K5 (separate test DB), ~~K10 (business timezone)~~ **K10 resolved 2026-10-10**, K15 (Jest/supertest migration), K16 (code splitting), residual root `package.json` cleanup (unused frontend-ish dev deps, unused `cors` package)

---

## FINAL VERDICT

**STAGE 12 COMPLETE — backend + frontend verified (2026-10-10; re-verified 2026-10-11).**

`npm test` → all **11** suites passed after the 2026-10-11 corrective audit (StockConcurrency 59/59, Stage9Security 52/52, ReportTimezone 38/38, Regression 44/44 — recorded 2026-10-11). Frontend lint **0 errors, 0 warnings**; `npm run build` green (pre-existing ~612 kB chunk advisory = K16).

**CORRECTIVE AUDIT (2026-10-11, commits pending push): COMPLETE** — (A) `cancelSale` double-cancel race closed: conditional completed→cancelled transition first inside the transaction locks the sale row before restock, so concurrent cancels can never double-restock (StockConcurrency sections 13–14); (B) frontend lint at **0 errors / 0 warnings**: `useWatch` replaces unstable `watch()` in ProductForm/StockReceive, `App` extracted to `frontend/src/App.tsx` for Fast Refresh (create/edit/authorization behavior preserved, build green); (C) timezone hardening: `YYYY-MM-DD` built explicitly from `Intl.formatToParts` (backend + frontend), strict invalid-calendar-date rejection and inclusive report-list range verified by new tests (ReportTimezone 18→38 assertions); (D) verified-not-defective: all production stock mutation paths already atomic; runner failure propagation and security-suite integrity confirmed from code.

**PROJECT_CONTEXT.md consistency audit (2026-10-10): COMPLETE** — false/stale claims corrected, duplicate sections collapsed; new risks K17 (axios undeclared in `frontend/package.json`) and K18 (NODE_ENV production dependency) documented in §12.

**K17 RESOLVED (2026-10-10 follow-up):** axios + autoprefixer now declared in `frontend/package.json` with updated `frontend/package-lock.json`; masking root copies removed; isolated clean-room `npm ci` + build verified; oxlint clean after fixing conditional hooks in `ProductForm.tsx`; backend suite re-verified that day (historical figure: all 9 suites green — now 11).

**Git status (verified snapshot 2026-10-11):** the 2026-10-10 corrective-session commit `5a894bf`, its docs commits `43870cf`/`010ac28`, and all earlier work **were pushed to `origin/main` on 2026-10-10 with the owner's explicit confirmation and verified** (`main` == `origin/main` == `010ac28` at the start of the 2026-10-11 audit). The 2026-10-11 corrective-audit commits are **committed locally and awaiting owner-confirmed push** (§10/§11).

**Second consistency audit (2026-10-10, docs-only):** stale Git claims, roadmap numbering, duplicate §16.2 rows, and checklist fragmentation corrected; authoritative outstanding-work checklist added in §2.

**Remaining work:** everything outstanding is listed in the **§2 outstanding-work checklist** — the 2026-10-11 audit commits awaiting owner-confirmed push, Stage 13 (Vercel deployment — CORS/`ALLOWED_ORIGINS` + browser verification still pending), the cookie-only-vs-fallback owner decision, and the open known issues in section 12 (K5, K11, K12, K15, K16, K18).

### Database/date conventions (HISTORICAL — describes the pre-timezone-fix rules; superseded for reporting by K10 / `lib/businessTime.js`)

> **HISTORICAL — the bullets below describe date handling BEFORE the 2026-10-10 Douala business-calendar fix. They are kept for the storage-level facts (reportDate at UTC midnight, Decimal serialization) but the "UTC day" business rule is NO LONGER TRUE: reporting now uses the Africa/Douala business day (§2, §12 K10, `lib/businessTime.js`).**

- (HISTORICAL business rule) All dates were treated as UTC. `reportDate` is stored at `00:00:00.000Z` (STILL TRUE — storage convention unchanged); the sales window used to be that UTC day; "Today" used to mean the server's UTC date. Future dates are rejected; today is accepted. **Current behavior: the sales window and "today" use the Africa/Douala business calendar.**
- Never use local-time methods (`setHours`, `setDate`) on dates. Use `setUTCHours`, `setUTCDate`, or ISO strings. (STILL TRUE)
- Existing reports were originally stored at local midnight (23:00Z) and were shifted +1h to UTC midnight on 2026-10-06. `seed.js` now uses UTC. (STILL TRUE — historical note)
- (HISTORICAL) The shop is in WAT (UTC+1): sales between 00:00 and 00:59 local time used to count toward the previous UTC day, and closing out the new local day during that hour used to be rejected. **Fixed 2026-10-10 (K10): that hour now correctly counts toward the new business day.**
- Prisma `Decimal` values serialize to JSON as **strings**. The frontend must parse them (`lib/format.ts` handles this via `Number()`). (STILL TRUE)

## 9. Testing

- **`npm test`** now runs everything: `tests/run-all.js` spawns each suite as a child process, watches for `❌` / `Total: N passed, M failed` / the removed-placeholder string `PASS (verified in service tests)` / `Traceback|UnhandledPromiseRejection` patterns, treats spawn failures and timeouts (`result.status === null`) as failures, and prints a final `RESULT:` line. It exits non-zero if any suite fails. This behavior was verified from code on 2026-10-11 (and demonstrated earlier: an intermediate Stage9Security run exited 1 on a failed assertion).
- Individual suites (exact filenames in `tests/`): `node tests/<Name>.test.js` (`AuthService.bcrypt`, `ProductService`, `StockService`, `SaleService`, `ReportService`, `ReportTimezone`, `Authorization`, `Stage8Api`, `Stage9Security`, `StockConcurrency`, `Regression`; `run-all.js` spawns all **eleven** — count verified against the runner on 2026-10-11). Two standalone utility scripts exist alongside them but are **not** part of `npm test`: `test-db-latency.js`, `test-jwt-expiration.js`.
- **Trust ranking (updated 2026-10-11):** `Regression.test.js` (44 assertions, real HTTP + DB checks, exits non-zero on failure), `StockConcurrency.test.js` (59 assertions, real concurrent DB operations incl. double-cancel and cancel+sale interleavings, exits non-zero), `ReportTimezone.test.js` (38 assertions, deterministic boundary timestamps + strict invalid-date and inclusive-range tests, exits non-zero) and `Stage9Security.test.js` (52 real assertions, exits non-zero on failure) are trustworthy. `Authorization.test.js` and `Stage8Api.test.js` do real requests. Several older service suites (`ProductService`, `StockService`, etc.) print ✅/❌ but historically exited 0 regardless of failures — read their output, don't trust the exit code (HISTORICAL note: this weakness was still present as of 2026-10-11 and is the remaining K15 item; the runner's output-scan compensates).
- **K15 status (2026-10-11):** the misleading Stage9Security placeholders and the first-match-only shared-Prisma check are fixed (2026-10-10); the legacy service suites still have weak exit codes (runner output-scan compensates) — migration to Jest/supertest remains open.
- Output format per function: valid input, missing fields, invalid values, business rules, DB state verified by direct query, transaction integrity. Each marked PASS / FAIL / N/A.
- Conventions: `TEST_` prefix for test data; clean up in `try/finally`; each test uses its own non-colliding date (report tests use 2026-07-0x); assert the **specific** expected error message. A test that only checks "something threw" once passed because of a unique-constraint error, which is a false pass.
- Tests run against the live shared Aiven database (see K5).
- Last known (2026-10-11): `npm test` → **all 11 suites passed** after the corrective audit (StockConcurrency 59/59, Stage9Security 52/52, ReportTimezone 38/38, Regression 44/44). Service suites use short passwords (`pass`, `newpass`) deliberately — password min-length enforcement in the UI is 8 chars, but the backend accepts any non-empty password, so these still pass.
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
- Stray folders `.claude/`, `.agents/`, `.windsurf/`, `agent/` (duplicate copies of the skills directories, also present in git history), and `generated/` are harmless leftovers; the duplicate `.gitignore` lines were removed on 2026-10-10.

## 12. Known issues and risks

| ID | Priority | Issue | Suggested fix |
|---|---|---|---|
| K1 | HIGH | ~~`completeSale` trusts the client-supplied `unitPrice`, so a user can sell at any price.~~ **RESOLVED in Stage 9** | ~~Read price from `Product.unitPrice` server-side; allow overrides for Admins only.~~ |
| K2 | HIGH | ~~Stock check happens outside the transaction, so two simultaneous sales can oversell and push stock negative.~~ **RESOLVED in Stage 9; re-verified under real concurrency 2026-10-10** | ~~Atomic conditional decrement inside the transaction (`updateMany where quantityBottles >= qty`, verify count).~~ Now a single parameterized `UPDATE … WHERE quantityBottles >= delta` that also recomputes crates (StockConcurrency suite proves no oversell). |
| K3 | HIGH | ~~`cancelSale` has unclear semantics: it works on completed sales without restocking, and can cancel an already-cancelled sale. `pending` is never created by the API.~~ **RESOLVED in Stage 9; concurrent double-cancel race closed 2026-10-11** | ~~Decide policy: cancel = restock, allowed only from `completed`, Admin-only.~~ The completed→cancelled transition is now a conditional `updateMany` executed first inside the transaction (row lock before restock), so two concurrent cancels can never both restock — proven by StockConcurrency section 13 (exactly one succeeds; stock restored exactly once) and section 14 (concurrent cancel + new sale). |
| K4 | HIGH | ~~No role enforcement: any logged-in user can do anything.~~ **RESOLVED in Stage 7** | ~~`requireRole` middleware on all protected routes; 56 authorization tests.~~ |
| K5 | HIGH | Dev, tests and `seed.js` all hit the shared production-style Aiven DB; `seed.js` wipes every table. | Create a separate dev/test database; make seed refuse to run without a `--force` flag. |
| K6 | MED | ~~Error mapping uses `err.message.includes(...)`; invalid/expired JWT returns 403 (should be 401); no central error middleware.~~ **RESOLVED in Stage 6** | ~~Stage 6: custom error classes + one error handler.~~ |
| K7 | MED | ~~`quantityCrates` only increases (on delivery); sales never decrement it, so it drifts from bottles.~~ **RESOLVED in Stage 9; atomicity gap closed 2026-10-10** | ~~Derive crates from bottles ÷ crateSize, or maintain both consistently. Decide.~~ Crates are now derived inside the SAME SQL statement that moves bottles (`FLOOR((bottles±delta)::numeric / crateSize)`), so no concurrent interleaving can leave a stale crate count; verified by the StockConcurrency suite. |
| K8 | MED | ~~Every file creates its own `new PrismaClient()` (about 12 connection pools); risks hitting the free-tier connection limit.~~ **RESOLVED in Stage 9** | ~~One shared `lib/prisma.js` instance.~~ |
| K9 | MED | ~~No user-management routes; users only via seed/scripts.~~ **RESOLVED in Stage 8** | ~~Admin-only create user / change password / list users.~~ |
| K10 | ~~MED~~ **RESOLVED (2026-10-10)** | ~~Shop day (UTC+1) vs UTC day offset of one hour.~~ | Fixed: `lib/businessTime.js` implements the `Africa/Douala` (UTC+1, IANA zone) business calendar — report generation/queries use the half-open Douala-day interval, future-date validation uses the business calendar, storage stays at UTC midnight of the calendar date. Frontend defaults/validation use `businessToday()`. Verified by the ReportTimezone suite (boundary sales at 22:30Z / 22:59:59.999Z / 23:00:00Z). |
| K11 | LOW | JWT role stays stale up to 8h after a role change; **logout exists** (`POST /auth/logout` clears the cookie) but the JWT itself is not server-side revocable (blacklist/`jti`), and there is no refresh flow. The frontend **retains a sessionStorage bearer fallback** (deliberate, 2026-10-10: cookie-only auth is not yet proven viable for Vercel→Render cross-origin; see §2 outstanding-work owner decision). Auth store no longer persists `isAuthenticated`; axios 401s reset the local session. | Short expiry + refresh, or re-check role from DB on sensitive routes; optional token blacklist. Decide the cookie-only vs fallback question after Stage 13 deployment. |
| K12 | LOW | `crateSize` of 0 is allowed, so crate conversion silently yields 0 bottles. Invalid sizes (0, negative, null, NaN) are consistently handled at mutation time as bottles-only (crates untouched; never divides by a non-positive size — verified by StockConcurrency section 11, 2026-10-11). | Require positive integer or null at product creation (validation-level fix; open). |
| K13 | LOW | ~~`receiveBatchOrder` and `generateDailyReport` don't verify the user exists, so a raw foreign-key error can surface.~~ **RESOLVED** | ~~Both services now check `userRepository.findById` and throw a clear NotFoundError.~~ |
| K14 | LOW | ~~No `npm test`, no runner.~~ **PARTIALLY RESOLVED (2026-10)** | `npm test` runs `tests/run-all.js` (**11** suites as of 2026-10-10, fails on any failure / spawn / timeout / failure-marker). Not Jest/supertest yet; older suites still have weak exit codes — see section 9. |
| K15 | MED | Test harnesses can false-pass: several suites print ✅/❌ but exit 0 regardless. **Partially improved 2026-10-10:** Stage9Security placeholders removed (real assertions + non-zero exit); `run-all.js` now fails suites that print the old placeholder string or that hit spawn/timeout errors. | Migrate the remaining legacy service suites to Jest/supertest with real assertions and exit codes; until then rely on `Regression`/`StockConcurrency`/`ReportTimezone`/`Stage9Security` + read suite output. |
| K16 | LOW | Frontend production build is a single ~612 kB chunk (no code splitting). | Route-level `React.lazy` + dynamic import; optional. |
| K17 | ~~HIGH~~ **RESOLVED (2026-10-10)** | ~~`axios` is imported by `frontend/src/services/api.ts` but is **not** declared in `frontend/package.json`; it resolves only from the root `node_modules` in this monorepo. A Vercel (or any frontend-only) install/build will fail. Root `package.json` also lists frontend-ish deps the backend does not need, and the `cors` npm package is installed but never imported (CORS is manual middleware).~~ **Fixed:** `axios` `^1.20.0` + `autoprefixer` `^10.6.1` declared in `frontend/package.json`/lockfile (autoprefixer was a second, clean-room-discovered instance of the same bug); masking root copies of both removed. Isolated clean-room `npm ci` + `npm run build` verified passing. | Residual (optional): prune remaining unused frontend-ish root dev deps and the unused `cors` package. |
| K18 | MED | Cookie auth production behavior depends on `NODE_ENV=production` being set on the host (drives `secure` + `sameSite: 'none'` + CORS credentials). This has not been verified against the live Render service config. | Confirm `NODE_ENV=production` in Render; re-run the production-cookie check (Regression suite already covers it in production mode). |

## 13. Roadmap

> Test totals below (196 / 244 / 260) are **historical per-stage snapshots**; the current test baseline is §9 (**11 suites** via `npm test`; Regression 44/44, StockConcurrency 59/59, ReportTimezone 38/38, Stage9Security 52/52 — recorded 2026-10-11).

1. **Stage 6 — error handling:** ~~custom error classes (Validation 400, NotFound 404, Conflict 400), one central error middleware, 401 for bad/expired tokens, 404 for unknown routes, remove string matching.~~ **COMPLETED**
2. **Stage 7 — roles:** `requireRole` middleware. **VERIFIED AFTER REMEDIATION.** 14 protected routes enforced: Admin-only (POST /products, POST /products/:id/discontinue, POST /products/:id/reactivate, POST /sales/:id/cancel); Admin+Manager (GET /products, GET /stock/low, POST /stock/receive, POST /sales, GET /sales, GET /sales/:id, POST /reports/daily, GET /reports/:date, GET /reports). 56 authorization tests, 196 total tests pass.
3. **Stage 8 — missing routes and user management:** **VERIFIED — COMPLETE.** 8 new routes added (2 product, 2 stock, 4 user management). All 22 protected routes enforced. 48 Stage 8 API tests, 244 total tests pass. K9 resolved.
4. **Stage 9 — hardening:** **VERIFIED — COMPLETE.** K1 (server-side pricing), K2 (atomic stock decrement), K3 (cancellation restocks), K7 (crate/bottle consistency), K8 (shared PrismaClient), plus `helmet`, a CORS allowlist middleware, login rate limiting, body size limit, request validation. 15 security controls verified. 260 total tests pass. K1/K2/K3/K7/K8 resolved.
5. **Stage 10 — deployment preparation:** **VERIFIED — COMPLETE.** Build/start commands verified, health check confirmed, environment variables documented, Render configuration documented, 260 total tests pass. All K1–K8 resolved **except K5 (separate test database), which remains OPEN**.
6. **Stage 11 — production deployment & verification:** **VERIFIED — COMPLETE.** Production database migrations applied via Render Shell, Render Web Service Live, health check verified, 260 total tests pass, all security controls active.
7. **Stage 12 — frontend development:** **COMPLETE (2026-10-10).** All planned pages implemented (Dashboard, Products, ProductDetail, ProductForm, Stock, StockReceive, Sales, SaleDetail, SaleNew, Reports, Users, Login) with react-query hooks, role-aware routing, and a green production build (`npm run build` in `frontend/`). Backend contract fixes from the audit (reorderLevel 500, crate drift, `/auth/me`, sales include, prod cookie SameSite) shipped in `ec3bb1a`. See section 2 audit summary.
8. **Stage 13 — frontend deployment:** Vercel deployment, CI/CD pipeline. **Not started** — the app is deploy-ready pending CORS/`VITE_API_BASE_URL` wiring per section 16.5; the full remaining-work list is the §2 outstanding-work checklist.

Ideas for later: weekly/monthly report views, profit margin from `costPerUnit`, expiry alerts via `findExpiringBefore`, low-stock notifications (email/WhatsApp), CSV/PDF report export, audit log, price history, barcode scanning, OpenAPI docs.

## 16. Stage 12 — Frontend Development Plan (HISTORICAL VERBATIM DUPLICATE)

> **Duplicate of §16 (first occurrence, above).** Retained verbatim; the audit fixed its content in both copies so there are no contradictions, but only the **first** §16 is canonical.

> **Status (2026-10-10): IMPLEMENTED (frontend not deployed).** This section is the original plan, kept for reference; where the plan and the shipped code differ, the notes below and `frontend/` are authoritative.
> **Shipped stack (verified from `frontend/package.json`):** React 19 (not 18), React Router v7 (not v6), Tailwind v4 via `@tailwindcss/postcss` (not v3 / no `tailwind.config.ts`), TypeScript ~6.0, TanStack Query 5 + Zustand 5, react-hook-form 7 + zod 3, axios. **Not used** (plan only): Headless UI, date-fns/Day.js (native `Date` + `Intl` in `lib/format.ts`), Recharts, Lucide (custom `components/ui/Icons.tsx`).
> **API origin env var:** `VITE_API_BASE_URL` (dev fallback `http://localhost:3000`, prod fallback the Render URL). The name `VITE_API_URL` used in older draft instructions is wrong — the code reads `VITE_API_BASE_URL` only.
> **Auth:** HttpOnly cookie primary + per-tab sessionStorage token fallback (never localStorage).
> **Route deviations from the planned table below:** shipped routes are `/login`, `/` (Dashboard), `/products`, `/products/new`, `/products/:id`, `/products/:id/edit`, `/stock`, `/stock/receive`, `/stock/receive/:productId`, `/sales`, `/sales/new`, `/sales/:id`, `/reports`, `/users`. There is no separate `/stock/:productId`, `/stock/:productId/reorder-level`, `/reports/:date`, `/users/:id`, or `/users/:id/password` page — reorder level, report generation, user creation and password reset are dialogs/forms inside the Stock, Reports and Users pages. Planned extra filters (pagination, sales date/user filters) are not implemented.
> **Packaging note (RESOLVED 2026-10-10):** `axios` is now declared in `frontend/package.json` (K17); a clean-room `npm ci` + `npm run build` inside an isolated `frontend/` copy passes. Older checkouts before this fix resolved axios only via the root `node_modules`.

### 16.1 Recommended Frontend Stack (PLAN — actual stack: §2 / the §16 header note above)

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

> **Actual shipped structure (2026-10-10)** — differs from the plan above: `frontend/src/services/api.ts` (single axios module, not `src/api/`), `src/store/authStore.ts` (no `uiStore`), 8 hooks in `src/hooks/` (`useAuth`, `useDashboard`, `usePermissions`, `useProducts`, `useReports`, `useSales`, `useStock`, `useUsers`; no `useDebounce`), `src/lib/format.ts` (no `src/utils/`), `src/components/{ui,layout,auth}/`, 12 pages in `src/pages/` (no `StockDetail`/`SaleForm`/`ReportDetail`/`UserDetail`; `Login.tsx` once), no `tailwind.config.ts` (Tailwind v4), no `vercel.json` yet (Stage 13).

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
| **0. Setup** | Initialize Vite+React+TS+Tailwind, configure ESLint/Prettier **(shipped instead: oxlint only, no Prettier)**, install deps | Working dev environment | ✅ Done |
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
| JWT expiration: keep 8h or reduce to 1-2h? | Keep 8h for now; revisit with refresh tokens in a later hardening pass (not part of Stage 13) | ☐ Confirm |
| Cookie migration: simultaneous Bearer + cookie, or hard cut? | Simultaneous support (backend reads both), frontend prefers cookie | ☐ Confirm |
| Refresh token? | Defer to a later hardening pass (add refresh endpoint + silent refresh; Stage 13 is Vercel deployment only, §17) | ☐ Defer |
| Real-time updates (stock/sales)? | Defer: polling (30s) or SSE; WebSocket overkill for now | ☐ Defer |
| Offline support? | Not needed (internal app, stable connectivity) | ✅ Confirmed |
| Barcode scanning (camera)? | Defer to a later pass (native capability) | ☐ Defer |

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
- [ ] ~~Decide timezone handling (K10) before the first real daily close-out.~~ **RESOLVED 2026-10-10** (§12 K10).

## 15. Intended screens (for the frontend) (HISTORICAL PLAN — implemented in §16 / `frontend/`)

> Historical Stage 12 planning list; the shipped 12-page app is documented in §16 and §2.

1. Login. 2. Catalog/dashboard: products with current stock and low-stock warnings. 3. Register product (Admin). 4. Log a delivery (product, crates, bottles, cost, expiry). 5. Checkout: pick products and quantities in bottles, clear error if stock is insufficient, nothing partially saved. 6. Sales history, filterable by status. 7. Daily close-out button. 8. Reports view over a date range (weekly/monthly built from daily rows).