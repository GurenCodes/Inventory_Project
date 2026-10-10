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
