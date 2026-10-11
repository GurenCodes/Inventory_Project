// tests/Regression.test.js
// Targeted regression tests for bugs found and fixed during the Stage A
// audit. Exits non-zero on any failure (unlike the older console suites).
//
// Covered:
//  1. PUT /products/:id with reorderLevel no longer 500s; reorderLevel is
//     applied to the Stock row and product fields to the Product row.
//  2. POST /stock/receive recalculates quantityCrates from total bottles
//     (no drift when existing stock holds partial crates).
//  3. K8: SaleService and SaleItem repository use the shared PrismaClient.
//  4. GET /auth/me restores the session from Bearer token or cookie; 401
//     without a token.
//  5. GET /sales includes soldBy.fullName and items (dashboard contract).
//  6. POST /users rejects invalid roles with 400 (not 500).
//  7. Production login sets SameSite=None; Secure cookie (cross-origin).

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const supertest = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const { app } = require('../server');
const prisma = require('../lib/prisma');
const stockService = require('../InventoryManagement/Services/StockService');
const saleService = require('../InventoryManagement/Services/SaleService');

const JWT_SECRET = process.env.JWT_SECRET;
const PREFIX = 'REGTEST_';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`);
  }
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No ADMIN user found in database');
  const token = jwt.sign({ userId: admin.id, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '5m' });
  const auth = { Authorization: `Bearer ${token}` };

  // ============================================================
  console.log('\n--- 1. PUT /products/:id with reorderLevel (was 500) ---');
  const p1 = await prisma.product.create({
    data: { name: `${PREFIX}Product`, unitPrice: 500, crateSize: 12 },
  });
  await prisma.stock.create({
    data: { productId: p1.id, quantityBottles: 0, quantityCrates: 0, reorderLevel: 10 },
  });
  try {
    const res = await supertest(app)
      .put(`/products/${p1.id}`)
      .set(auth)
      .send({ name: `${PREFIX}ProductUpdated`, unitPrice: 750, crateSize: 12, reorderLevel: 42 });
    assert(res.status === 200, `status 200 (got ${res.status})`);
    const dbProduct = await prisma.product.findUnique({ where: { id: p1.id } });
    const dbStock = await prisma.stock.findUnique({ where: { productId: p1.id } });
    assert(dbProduct.name === `${PREFIX}ProductUpdated`, 'product name updated');
    assert(Number(dbProduct.unitPrice) === 750, 'unit price updated');
    assert(dbStock.reorderLevel === 42, `reorderLevel applied to stock (got ${dbStock.reorderLevel})`);
    assert(res.body.stock && res.body.stock.reorderLevel === 42, 'response contains stock with new reorderLevel');
  } catch (e) {
    assert(false, `PUT /products/:id threw: ${e.message}`);
  }

  // ============================================================
  console.log('\n--- 2. POST /stock/receive crate recalculation (was drifting) ---');
  const p2 = await prisma.product.create({
    data: { name: `${PREFIX}Crates`, unitPrice: 500, crateSize: 12 },
  });
  await prisma.stock.create({
    data: { productId: p2.id, quantityBottles: 11, quantityCrates: 0, reorderLevel: 5 },
  });
  try {
    const res = await supertest(app)
      .post('/stock/receive')
      .set(auth)
      .send({ productId: p2.id, crateCount: 1, bottleCount: 2, costPerUnit: 100 });
    assert(res.status === 201, `status 201 (got ${res.status})`);
    const stock = await prisma.stock.findUnique({ where: { productId: p2.id } });
    assert(stock.quantityBottles === 25, `bottles = 25 (got ${stock.quantityBottles})`);
    assert(stock.quantityCrates === 2, `crates = floor(25/12) = 2 (got ${stock.quantityCrates})`);
    // cleanup created batch order
    await prisma.itemBatchOrder.delete({ where: { id: res.body.batchOrder.id } });
  } catch (e) {
    assert(false, `POST /stock/receive threw: ${e.message}`);
  }

  // ============================================================
  console.log('\n--- 3. K8: single shared PrismaClient ---');
  const saleServiceSrc = fs.readFileSync(
    path.join(__dirname, '..', 'InventoryManagement', 'Services', 'SaleService.js'), 'utf8'
  );
  const saleItemSrc = fs.readFileSync(
    path.join(__dirname, '..', 'InventoryManagement', 'Repository', 'SaleItem.js'), 'utf8'
  );
  assert(!saleServiceSrc.includes('new PrismaClient'), 'SaleService.js uses shared client');
  assert(saleServiceSrc.includes("require('../../lib/prisma')"), 'SaleService.js imports lib/prisma');
  assert(!saleItemSrc.includes('new PrismaClient'), 'SaleItem.js uses shared client');
  assert(saleItemSrc.includes("require('../../lib/prisma')"), 'SaleItem.js imports lib/prisma');
  const repoDir = path.join(__dirname, '..', 'InventoryManagement', 'Repository');
  const userRepo = fs.readFileSync(path.join(__dirname, '..', 'UserManagement', 'Repository', 'UserRepository.js'), 'utf8');
  const allRepoFiles = fs.readdirSync(repoDir).filter((f) => f.endsWith('.js'));
  const offenders = allRepoFiles.filter((f) =>
    fs.readFileSync(path.join(repoDir, f), 'utf8').includes('new PrismaClient')
  );
  assert(offenders.length === 0, `no repository creates its own PrismaClient (offenders: ${offenders.join(',') || 'none'})`);
  assert(!userRepo.includes('new PrismaClient'), 'UserRepository.js uses shared client');

  // ============================================================
  console.log('\n--- 4. GET /auth/me ---');
  try {
    const noAuth = await supertest(app).get('/auth/me');
    assert(noAuth.status === 401, `without token -> 401 (got ${noAuth.status})`);

    const badAuth = await supertest(app).get('/auth/me').set('Authorization', 'Bearer not-a-token');
    assert(badAuth.status === 401, `with invalid token -> 401 (got ${badAuth.status})`);

    const me = await supertest(app).get('/auth/me').set(auth);
    assert(me.status === 200, `with Bearer token -> 200 (got ${me.status})`);
    assert(me.body && me.body.id === admin.id, 'returns authenticated user id');
    assert(!me.body.passwordHash, 'does not expose passwordHash');

    // Cookie-based auth: reuse the issued token as the HttpOnly cookie
    const meCookie = await supertest(app)
      .get('/auth/me')
      .set('Cookie', [`token=${token}`]);
    assert(meCookie.status === 200, `with auth cookie -> 200 (got ${meCookie.status})`);
  } catch (e) {
    assert(false, `/auth/me threw: ${e.message}`);
  }

  // ============================================================
  console.log('\n--- 5. GET /sales includes soldBy + items (dashboard contract) ---');
  let createdSaleId = null;
  try {
    const p3 = await prisma.product.create({
      data: { name: `${PREFIX}SaleProd`, unitPrice: 300, crateSize: 12 },
    });
    await prisma.stock.create({
      data: { productId: p3.id, quantityBottles: 50, quantityCrates: 4, reorderLevel: 5 },
    });
    const sale = await saleService.completeSale({
      soldById: admin.id,
      items: [{ productId: p3.id, quantityBottles: 2 }],
    });
    createdSaleId = sale.id;

    const res = await supertest(app).get('/sales?status=completed').set(auth);
    assert(res.status === 200, `status 200 (got ${res.status})`);
    const found = Array.isArray(res.body) && res.body.find((s) => s.id === createdSaleId);
    assert(!!found, 'created sale appears in list');
    assert(found && found.soldBy && typeof found.soldBy.fullName === 'string', 'sale includes soldBy.fullName');
    assert(found && Array.isArray(found.items) && found.items.length >= 1, 'sale includes items array');

    // cleanup: delete sale + items, restore stock
    await prisma.saleItem.deleteMany({ where: { saleId: createdSaleId } });
    await prisma.sale.delete({ where: { id: createdSaleId } });
    await prisma.stock.update({
      where: { productId: p3.id },
      data: { quantityBottles: 50, quantityCrates: 4 },
    });
    await prisma.stock.delete({ where: { productId: p3.id } });
    await prisma.product.delete({ where: { id: p3.id } });
  } catch (e) {
    assert(false, `GET /sales contract threw: ${e.message}`);
    if (createdSaleId) {
      await prisma.saleItem.deleteMany({ where: { saleId: createdSaleId } }).catch(() => {});
      await prisma.sale.delete({ where: { id: createdSaleId } }).catch(() => {});
    }
  }

  // ============================================================
  console.log('\n--- 6. POST /users rejects invalid role with 400 ---');
  try {
    const res = await supertest(app)
      .post('/users')
      .set(auth)
      .send({ fullName: 'Role Test', email: `${PREFIX.toLowerCase()}role@test.com`, password: 'secret123', role: 'CASHIER' });
    assert(res.status === 400, `invalid role -> 400 (got ${res.status})`);
    // cleanup in case it was (wrongly) created
    await prisma.user.deleteMany({ where: { email: `${PREFIX.toLowerCase()}role@test.com` } });
  } catch (e) {
    assert(false, `POST /users role validation threw: ${e.message}`);
  }

  // ============================================================
  console.log('\n--- 7. Production cookie attributes (SameSite=None; Secure) ---');
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    // Seed a known user we can log in as. Use admin's real password? We don't
    // have it, so create a temp user with a known password.
    const bcrypt = require('bcrypt');
    const tempEmail = `${PREFIX.toLowerCase()}cookie@regression.test`;
    const hash = await bcrypt.hash('cookiepass123', 4);
    const tempUser = await prisma.user.create({
      data: { fullName: 'Cookie Test', email: tempEmail, passwordHash: hash, role: 'MANAGER' },
    });
    const loginRes = await supertest(app)
      .post('/auth/login')
      .send({ email: tempEmail, password: 'cookiepass123' });
    assert(loginRes.status === 200, `production login -> 200 (got ${loginRes.status})`);
    const setCookie = (loginRes.headers['set-cookie'] || []).join('; ');
    assert(/SameSite=None/i.test(setCookie), `cookie has SameSite=None (${setCookie})`);
    assert(/Secure/i.test(setCookie), `cookie has Secure flag (${setCookie})`);
    assert(/HttpOnly/i.test(setCookie), 'cookie has HttpOnly flag');
    await prisma.user.delete({ where: { id: tempUser.id } });
  } catch (e) {
    assert(false, `production cookie test threw: ${e.message}`);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }

  // ============================================================
  console.log('\n--- 8. Auth hardening: dev cookie, logout clearing, expired token ---');
  try {
    // Dev-mode login sets SameSite=Strict (production is SameSite=None; Secure —
    // covered in section 7). Use a temp user, never a seeded account.
    const bcrypt2 = require('bcrypt');
    const authEmail = `${PREFIX.toLowerCase()}auth@regression.test`;
    const authHash = await bcrypt2.hash('authpass123', 4);
    const authUser = await prisma.user.create({
      data: { fullName: 'Auth Hardening', email: authEmail, passwordHash: authHash, role: 'MANAGER' },
    });

    const loginRes = await supertest(app).post('/auth/login').send({ email: authEmail, password: 'authpass123' });
    assert(loginRes.status === 200, `dev login -> 200 (got ${loginRes.status})`);
    const devCookie = (loginRes.headers['set-cookie'] || []).join('; ');
    assert(/HttpOnly/i.test(devCookie), 'dev cookie is HttpOnly');
    assert(/SameSite=Strict/i.test(devCookie), `dev cookie SameSite=Strict (got ${devCookie})`);
    const issuedToken = loginRes.body && loginRes.body.token;
    assert(typeof issuedToken === 'string', 'login body includes token (retained bearer-fallback contract)');

    // Cookie auth works end-to-end via /auth/me (Supertest level).
    const meCookie = await supertest(app).get('/auth/me').set('Cookie', [`token=${issuedToken}`]);
    assert(meCookie.status === 200 && meCookie.body.id === authUser.id, 'cookie restores session via /auth/me');

    // Logout clears the cookie with matching attributes.
    const logoutRes = await supertest(app).post('/auth/logout');
    assert(logoutRes.status === 200, `logout -> 200 (got ${logoutRes.status})`);
    const cleared = (logoutRes.headers['set-cookie'] || []).join('; ');
    assert(/token=;/i.test(cleared) || /token=;|token=($|;|,)/i.test(cleared) || /Expires=Thu, 01 Jan 1970/i.test(cleared) || /Max-Age=0/i.test(cleared),
      `logout Set-Cookie clears token (got ${cleared})`);
    assert(/HttpOnly/i.test(cleared) && /Path=\//i.test(cleared), 'clearing cookie matches HttpOnly + Path=/');

    // Expired credentials: a JWT signed with the right secret but already
    // expired must be rejected with 401 (not 500, not 200).
    const jwt2 = require('jsonwebtoken');
    const expired = jwt2.sign({ userId: authUser.id, role: 'MANAGER' }, JWT_SECRET, { expiresIn: -10 });
    const expiredRes = await supertest(app).get('/auth/me').set('Authorization', `Bearer ${expired}`);
    assert(expiredRes.status === 401, `expired token -> 401 (got ${expiredRes.status})`);

    // Role-based authorization remains intact (MANAGER cannot create users).
    const mgrToken = jwt2.sign({ userId: authUser.id, role: 'MANAGER' }, JWT_SECRET, { expiresIn: '5m' });
    const forbidden = await supertest(app)
      .post('/users')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ fullName: 'Nope', email: `${PREFIX.toLowerCase()}forbidden@regression.test`, password: 'secret123', role: 'MANAGER' });
    assert(forbidden.status === 403, `MANAGER create-user -> 403 (got ${forbidden.status})`);

    await prisma.user.delete({ where: { id: authUser.id } });
  } catch (e) {
    assert(false, `auth hardening section threw: ${e.message}`);
  }

  // ============================================================
  console.log('\n--- 9. Frontend auth persistence (static source check) ---');
  try {
    // Static check (not a browser test): the auth store must never write
    // tokens to localStorage, and must not persist an auth flag that could
    // outlive the HttpOnly cookie.
    const authStoreSrc = fs.readFileSync(
      path.join(__dirname, '..', 'frontend', 'src', 'store', 'authStore.ts'), 'utf8'
    );
    assert(!/localStorage\.(getItem|setItem|removeItem)/.test(authStoreSrc), 'authStore.ts never calls localStorage methods');
    assert(!/partialize[\s\S]*?token:/.test(authStoreSrc), 'partialize does not persist a token');
    assert(!/partialize[\s\S]*?isAuthenticated:/.test(authStoreSrc), 'partialize does not persist isAuthenticated');
    const apiSrc = fs.readFileSync(
      path.join(__dirname, '..', 'frontend', 'src', 'services', 'api.ts'), 'utf8'
    );
    assert(apiSrc.includes('withCredentials: true'), 'axios client sends credentials');
    assert(apiSrc.includes('clearSession'), '401 responses reset the local session');
  } catch (e) {
    assert(false, `frontend persistence check threw: ${e.message}`);
  }

  // ============================================================
  console.log('\n--- 10. K12: crateSize validation via the HTTP API ---');
  // The service already validated crateSize, but until K12 no test exercised
  // POST/PUT /products with invalid crate sizes, so a regression there would
  // have been invisible. Invalid input must 400 and must not persist.
  const k12Cleanup = [];
  try {
    const invalidBodies = [
      { label: 'zero', crateSize: 0 },
      { label: 'negative', crateSize: -5 },
      { label: 'fractional', crateSize: 12.5 },
      { label: 'sub-one fractional (truncates to 0 in INT column)', crateSize: 0.9 },
      { label: 'numeric string', crateSize: '12' },
      { label: 'empty string', crateSize: '' },
      { label: 'boolean true', crateSize: true },
      { label: 'object', crateSize: { n: 12 } },
      { label: 'INT4 overflow', crateSize: 3000000000 },
    ];
    for (const { label, crateSize } of invalidBodies) {
      const name = `${PREFIX}K12_${label.replace(/\W+/g, '_')}`;
      const res = await supertest(app)
        .post('/products')
        .set(auth)
        .send({ name, unitPrice: 500, crateSize });
      assert(res.status === 400, `POST /products crateSize ${label} -> 400 (got ${res.status})`);
      const inDb = await prisma.product.findFirst({ where: { name } });
      assert(!inDb, `POST /products crateSize ${label} persisted nothing`);
    }

    // Accepted: positive integer via POST (route returns { product, stock })
    const okName = `${PREFIX}K12_Valid12`;
    const okRes = await supertest(app).post('/products').set(auth).send({ name: okName, unitPrice: 500, crateSize: 12 });
    assert(okRes.status === 201 && okRes.body.product && okRes.body.product.crateSize === 12,
      `POST crateSize=12 -> 201 with 12 (got ${okRes.status}, ${okRes.body.product && okRes.body.product.crateSize})`);
    if (okRes.body.product && okRes.body.product.id) k12Cleanup.push(okRes.body.product.id);

    // Accepted: bottles-only via explicit null and via omission
    const nullName = `${PREFIX}K12_NullCrate`;
    const nullRes = await supertest(app).post('/products').set(auth).send({ name: nullName, unitPrice: 500, crateSize: null });
    assert(nullRes.status === 201 && nullRes.body.product && nullRes.body.product.crateSize === null,
      `POST crateSize=null -> 201 with null (got ${nullRes.status}, ${nullRes.body.product && nullRes.body.product.crateSize})`);
    if (nullRes.body.product && nullRes.body.product.id) k12Cleanup.push(nullRes.body.product.id);

    const omitName = `${PREFIX}K12_OmitCrate`;
    const omitRes = await supertest(app).post('/products').set(auth).send({ name: omitName, unitPrice: 500 });
    assert(omitRes.status === 201 && omitRes.body.product && omitRes.body.product.crateSize === null,
      `POST crateSize omitted -> 201 with null (got ${omitRes.status}, ${omitRes.body.product && omitRes.body.product.crateSize})`);
    if (omitRes.body.product && omitRes.body.product.id) k12Cleanup.push(omitRes.body.product.id);

    // Receiving stock for a bottles-only product stays supported and never
    // recomputes crates from a missing crate size.
    const bottlesOnlyId = nullRes.body.product.id;
    const recv = await supertest(app)
      .post('/stock/receive')
      .set(auth)
      .send({ productId: bottlesOnlyId, bottleCount: 10, crateCount: 0, costPerUnit: 300 });
    assert(recv.status === 201, `receive on bottles-only product -> 201 (got ${recv.status})`);
    const bsStock = await prisma.stock.findUnique({ where: { productId: bottlesOnlyId } });
    assert(bsStock && bsStock.quantityBottles === 10 && bsStock.quantityCrates === 0,
      `bottles-only receive -> bottles 10, crates 0 (got ${bsStock && bsStock.quantityBottles}/${bsStock && bsStock.quantityCrates})`);

    // Receiving stock for a crate-enabled product preserves the invariant.
    const crateProductId = okRes.body.product.id;
    const recv2 = await supertest(app)
      .post('/stock/receive')
      .set(auth)
      .send({ productId: crateProductId, crateCount: 2, bottleCount: 1, costPerUnit: 300 });
    assert(recv2.status === 201, `receive on crate product -> 201 (got ${recv2.status})`);
    const csStock = await prisma.stock.findUnique({ where: { productId: crateProductId } });
    assert(csStock.quantityBottles === 25 && csStock.quantityCrates === 2,
      `crate receive 2*12+1 -> bottles 25, crates floor(25/12)=2 (got ${csStock.quantityBottles}/${csStock.quantityCrates})`);

    // PUT rejects the same invalid shapes and leaves the stored value intact.
    for (const bad of [0, -1, 7.5, '12']) {
      const putRes = await supertest(app)
        .put(`/products/${crateProductId}`)
        .set(auth)
        .send({ crateSize: bad });
      assert(putRes.status === 400, `PUT crateSize=${JSON.stringify(bad)} -> 400 (got ${putRes.status})`);
    }
    const unchanged = await prisma.product.findUnique({ where: { id: crateProductId } });
    assert(unchanged.crateSize === 12, `rejected PUT left crateSize=12 (got ${unchanged.crateSize})`);

    // PUT accepts a valid change and an explicit clear (null).
    const putOk = await supertest(app).put(`/products/${crateProductId}`).set(auth).send({ crateSize: 24 });
    assert(putOk.status === 200 && putOk.body.crateSize === 24, `PUT crateSize=24 -> 200 (got ${putOk.status}, ${putOk.body.crateSize})`);
    const putClear = await supertest(app).put(`/products/${crateProductId}`).set(auth).send({ crateSize: null });
    const cleared = await prisma.product.findUnique({ where: { id: crateProductId } });
    assert(putClear.status === 200 && cleared.crateSize === null, `PUT crateSize=null clears to NULL (got ${putClear.status}, ${cleared.crateSize})`);
  } catch (e) {
    assert(false, `K12 API section threw: ${e.message}`);
  } finally {
    for (const id of k12Cleanup) {
      await prisma.saleItem.deleteMany({ where: { productId: id } }).catch(() => {});
      await prisma.itemBatchOrder.deleteMany({ where: { productId: id } }).catch(() => {});
      await prisma.stock.deleteMany({ where: { productId: id } }).catch(() => {});
      await prisma.product.deleteMany({ where: { id } }).catch(() => {});
    }
  }

  // ============================================================
  console.log('\n--- 11. CORS: origin parsing + real middleware (lib/cors.js) ---');
  // The middleware was extracted from server.js so the exact production
  // code path can be exercised with explicit allowlists (the server module
  // itself computes its list once at load time).
  try {
    const express = require('express');
    const {
      parseAllowedOrigins,
      createCorsMiddleware,
      DEFAULT_LOCALHOST_ORIGINS,
    } = require('../lib/cors');

    // Parser
    assert(
      JSON.stringify(parseAllowedOrigins(undefined)) === JSON.stringify(DEFAULT_LOCALHOST_ORIGINS),
      'parse(undefined) -> localhost defaults'
    );
    assert(
      JSON.stringify(parseAllowedOrigins('')) === JSON.stringify(DEFAULT_LOCALHOST_ORIGINS),
      'parse("") -> localhost defaults (unset-equivalent)'
    );
    assert(
      JSON.stringify(parseAllowedOrigins(' https://a.example , https://b.example/ ,, ')) ===
        JSON.stringify(['https://a.example', 'https://b.example']),
      'parse trims whitespace, strips trailing slashes, drops empties'
    );
    assert(parseAllowedOrigins('   ').length === DEFAULT_LOCALHOST_ORIGINS.length,
      'whitespace-only value treated as unset (localhost defaults, documented)');

    // Real middleware with an explicit production-style allowlist
    const corsApp = express();
    const prodOrigins = parseAllowedOrigins('https://shop.vercel.app,https://admin.shop.example');
    corsApp.use(createCorsMiddleware(prodOrigins));
    corsApp.get('/health', (req, res) => res.json({ ok: true }));

    const allowed = await supertest(corsApp)
      .get('/health')
      .set('Origin', 'https://shop.vercel.app');
    assert(allowed.status === 200, `configured origin accepted (got ${allowed.status})`);
    assert(allowed.headers['access-control-allow-origin'] === 'https://shop.vercel.app',
      `allow-origin echoes configured origin (got ${allowed.headers['access-control-allow-origin']})`);
    assert(allowed.headers['access-control-allow-credentials'] === 'true',
      'credentialed CORS enabled for the configured origin');

    const second = await supertest(corsApp)
      .get('/health')
      .set('Origin', 'https://admin.shop.example');
    assert(second.status === 200, 'second configured origin accepted');

    const denied = await supertest(corsApp)
      .get('/health')
      .set('Origin', 'https://evil.example');
    assert(denied.status === 403, `unapproved origin -> 403 (got ${denied.status})`);

    const preflight = await supertest(corsApp)
      .options('/health')
      .set('Origin', 'https://shop.vercel.app')
      .set('Access-Control-Request-Method', 'GET');
    assert(preflight.status === 204, `preflight from allowed origin -> 204 (got ${preflight.status})`);

    const deniedPreflight = await supertest(corsApp)
      .options('/health')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'GET');
    assert(deniedPreflight.status === 403, `preflight from denied origin -> 403 (got ${deniedPreflight.status})`);

    const noOrigin = await supertest(corsApp).get('/health');
    assert(noOrigin.status === 200, `no Origin header (curl/server-to-server) still allowed (got ${noOrigin.status})`);

    // Fail-closed: a value that parses to an empty list rejects everything
    // cross-origin instead of falling back to a permissive default.
    const closedApp = express();
    closedApp.use(createCorsMiddleware(parseAllowedOrigins(' , ')));
    closedApp.get('/health', (req, res) => res.json({ ok: true }));
    // NOTE: " , " trims to empty string -> documented as unset -> defaults.
    // A truly empty parsed list is only produced by handing [] directly,
    // which is what a future stricter env parser might do.
    const emptyListApp = express();
    emptyListApp.use(createCorsMiddleware([]));
    emptyListApp.get('/health', (req, res) => res.json({ ok: true }));
    const emptyDenied = await supertest(emptyListApp)
      .get('/health')
      .set('Origin', 'https://shop.vercel.app');
    assert(emptyDenied.status === 403, `empty allowlist rejects cross-origin (fail-closed) (got ${emptyDenied.status})`);
  } catch (e) {
    assert(false, `CORS section threw: ${e.message}`);
  }

  // ============================================================
  console.log('\n========== Regression Summary ==========');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
  process.exit(0);
}

main().catch(async (e) => {
  console.error('Regression suite crashed:', e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
