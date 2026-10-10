// tests/Stage9Security.test.js
// Stage 9 security-control verification with REAL assertions.
// 2026-10 revision: every section performs its own assertion; no section
// claims "verified in service tests" anymore. A failed assertion or an
// uncaught exception produces a non-zero exit code (run-all.js also scans
// output for ❌, but independent execution must fail loudly too).
//
// Note on the shared-Prisma check: it is a STATIC source scan and is
// labeled as such. Runtime coverage of the same property lives in the
// Regression suite (section 3).

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const fs = require('fs');
const path = require('path');
const supertest = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const { app } = require('../server');
const prisma = require('../lib/prisma');
const stockService = require('../InventoryManagement/Services/StockService');

const JWT_SECRET = process.env.JWT_SECRET;
const PREFIX = `SEC9_${Date.now()}_`;

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
  console.log('=== STAGE 9 SECURITY CONTROL VERIFICATION ===\n');

  // Created entities for cleanup in `finally`.
  const productIds = [];
  const saleIds = [];
  let tempUserId = null;

  try {
    // ============================================================
    console.log('1. HELMET SECURITY HEADERS');
    const res1 = await supertest(app).get('/health');
    assert(res1.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff');
    assert(res1.headers['x-frame-options'] === 'DENY', 'X-Frame-Options: DENY');
    assert(!!res1.headers['content-security-policy'], 'Content-Security-Policy present');
    assert(res1.headers['referrer-policy'] === 'no-referrer', 'Referrer-Policy: no-referrer');
    assert(!!res1.headers['strict-transport-security'], 'Strict-Transport-Security present');
    assert(res1.headers['cross-origin-opener-policy'] === 'same-origin', 'Cross-Origin-Opener-Policy: same-origin');
    assert(res1.headers['cross-origin-resource-policy'] === 'same-origin', 'Cross-Origin-Resource-Policy: same-origin');
    assert(res1.headers['x-powered-by'] === undefined, 'X-Powered-By hidden');

    // ============================================================
    console.log('\n2. CORS - ALLOWED ORIGIN (with credentials)');
    const cors1 = await supertest(app).get('/health').set('Origin', 'http://localhost:5173');
    assert(cors1.status === 200, `allowed origin -> 200 (got ${cors1.status})`);
    assert(cors1.headers['access-control-allow-origin'] === 'http://localhost:5173', `ACAO echoes origin (got ${cors1.headers['access-control-allow-origin']})`);
    assert(cors1.headers['access-control-allow-credentials'] === 'true', 'Access-Control-Allow-Credentials: true');

    // ============================================================
    console.log('\n3. CORS - DISALLOWED ORIGIN');
    const cors2 = await supertest(app).get('/health').set('Origin', 'http://evil.com');
    assert(cors2.status === 403, `disallowed origin -> 403 (got ${cors2.status})`);
    assert(!cors2.headers['access-control-allow-origin'], 'no ACAO header on rejection');

    // ============================================================
    console.log('\n4. CORS - NO ORIGIN (curl-style client)');
    const cors3 = await supertest(app).get('/health');
    assert(cors3.status === 200, `no origin -> 200 (got ${cors3.status})`);
    assert(cors3.headers['access-control-allow-origin'] === '*', `no-origin clients get ACAO * (got ${cors3.headers['access-control-allow-origin']})`);

    // ============================================================
    console.log('\n5. CORS - PREFLIGHT REQUEST');
    const cors4 = await supertest(app).options('/products')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Content-Type,Authorization');
    assert(cors4.status === 204, `preflight -> 204 (got ${cors4.status})`);
    assert((cors4.headers['access-control-allow-methods'] || '').includes('GET'), 'Allow-Methods includes GET');
    assert((cors4.headers['access-control-allow-headers'] || '').toLowerCase().includes('authorization'), 'Allow-Headers includes Authorization');
    assert(!!cors4.headers['access-control-max-age'], 'Max-Age present');
    assert(cors4.headers['access-control-allow-credentials'] === 'true', 'preflight grants credentials');

    // Preflight from a DISALLOWED origin must be rejected too.
    const cors5 = await supertest(app).options('/products')
      .set('Origin', 'http://evil.com')
      .set('Access-Control-Request-Method', 'GET');
    assert(cors5.status === 403, `disallowed preflight -> 403 (got ${cors5.status})`);

    // ============================================================
    console.log('\n6. K1 - SERVER-SIDE PRICING (client cannot override price)');
    const hash = await bcrypt.hash(`${PREFIX}pass123`, 4);
    const tempUser = await prisma.user.create({
      data: { fullName: `${PREFIX}SecUser`, email: `${PREFIX.toLowerCase()}sec@test.local`, passwordHash: hash, role: 'MANAGER' },
    });
    tempUserId = tempUser.id;
    const token = jwt.sign({ userId: tempUser.id, role: 'MANAGER' }, JWT_SECRET, { expiresIn: '5m' });
    const auth = { Authorization: `Bearer ${token}` };
    const adminToken = jwt.sign({ userId: tempUser.id, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '5m' });
    const adminAuth = { Authorization: `Bearer ${adminToken}` };

    const p1 = await prisma.product.create({
      data: { name: `${PREFIX}Pricing`, unitPrice: 500, crateSize: 12 },
    });
    productIds.push(p1.id);
    await prisma.stock.create({ data: { productId: p1.id, quantityBottles: 30, quantityCrates: 2, reorderLevel: 0 } });
    const spoofRes = await supertest(app).post('/sales').set(auth).send({
      soldById: tempUser.id,
      items: [{ productId: p1.id, quantityBottles: 2, unitPrice: 1, lineTotal: 2 }],
    });
    assert(spoofRes.status === 201, `sale with spoofed unitPrice accepted -> 201 (got ${spoofRes.status})`);
    const spoofItem = spoofRes.body && spoofRes.body.items && spoofRes.body.items.find((i) => i.productId === p1.id);
    assert(!!spoofItem && Number(spoofItem.unitPrice) === 500, `server ignored client unitPrice=1, used 500 (got ${spoofItem && spoofItem.unitPrice})`);
    assert(!!spoofItem && Number(spoofItem.lineTotal) === 1000, `lineTotal = 2 * 500 = 1000 (got ${spoofItem && spoofItem.lineTotal})`);
    if (spoofRes.body && spoofRes.body.id) saleIds.push(spoofRes.body.id);

    // ============================================================
    console.log('\n7. K2 - ATOMIC STOCK DECREMENT (no overselling under concurrency)');
    const p2 = await prisma.product.create({
      data: { name: `${PREFIX}Oversell`, unitPrice: 500, crateSize: 12 },
    });
    productIds.push(p2.id);
    await prisma.stock.create({ data: { productId: p2.id, quantityBottles: 10, quantityCrates: 0, reorderLevel: 0 } });
    const saleBody = (qty) => ({ soldById: tempUser.id, items: [{ productId: p2.id, quantityBottles: qty }] });
    const [s1, s2] = await Promise.all([
      supertest(app).post('/sales').set(auth).send(saleBody(7)),
      supertest(app).post('/sales').set(auth).send(saleBody(7)),
    ]);
    const statuses = [s1.status, s2.status].sort();
    assert(statuses[0] === 201 && statuses[1] === 400, `exactly one of two concurrent sales of 7 on 10 bottles succeeds (got ${statuses.join(',')})`);
    const stock2 = await prisma.stock.findUnique({ where: { productId: p2.id } });
    assert(stock2.quantityBottles === 3, `final stock = 3, never negative (got ${stock2.quantityBottles})`);
    for (const r of [s1, s2]) if (r.status === 201 && r.body && r.body.id) saleIds.push(r.body.id);

    // ============================================================
    console.log('\n8. K3 - SALE CANCELLATION RESTOCKS');
    const beforeCancel = await prisma.stock.findUnique({ where: { productId: p1.id } });
    const cancelTarget = await prisma.sale.findFirst({
      where: { id: { in: saleIds }, status: 'completed' },
      include: { items: true },
    });
    assert(!!cancelTarget, 'a completed sale exists to cancel');
    if (cancelTarget) {
      const qtySold = cancelTarget.items.reduce((s, i) => s + i.quantityBottles, 0);
      const cancelRes = await supertest(app).post(`/sales/${cancelTarget.id}/cancel`).set(adminAuth);
      assert(cancelRes.status === 200, `cancel -> 200 (got ${cancelRes.status})`);
      assert(cancelRes.body && cancelRes.body.status === 'cancelled', `status becomes cancelled (got ${cancelRes.body && cancelRes.body.status})`);
      const afterCancel = await prisma.stock.findUnique({ where: { productId: p1.id } });
      assert(afterCancel.quantityBottles === beforeCancel.quantityBottles + qtySold, `stock restocked by ${qtySold} bottles (before=${beforeCancel.quantityBottles}, after=${afterCancel.quantityBottles})`);
      // Cancelling an already-cancelled sale must be rejected.
      const again = await supertest(app).post(`/sales/${cancelTarget.id}/cancel`).set(adminAuth);
      assert(again.status === 400, `second cancel rejected -> 400 (got ${again.status})`);
    }

    // ============================================================
    console.log('\n9. K7 - CRATE/BOTTLE CONSISTENCY after sale and cancel');
    const stock1 = await prisma.stock.findUnique({ where: { productId: p1.id } });
    assert(stock1.quantityCrates === Math.floor(stock1.quantityBottles / 12), `p1 invariant holds (bottles=${stock1.quantityBottles}, crates=${stock1.quantityCrates})`);
    const stock2c = await prisma.stock.findUnique({ where: { productId: p2.id } });
    assert(stock2c.quantityCrates === Math.floor(stock2c.quantityBottles / 12), `p2 invariant holds (bottles=${stock2c.quantityBottles}, crates=${stock2c.quantityCrates})`);

    // ============================================================
    console.log('\n10. K8 - SINGLE SHARED PRISMACLIENT (static source scan)');
    // Static check: EVERY repository and service file is scanned. Any file
    // that instantiates its own PrismaClient fails. Any file that USES a
    // prisma client (references `prisma.` / `$transaction`) must import it
    // from lib/prisma — files that never touch Prisma (pure service layers
    // that go through repositories) need no import. This is a source scan,
    // not a runtime proof.
    const dirs = [
      path.join(__dirname, '..', 'InventoryManagement', 'Repository'),
      path.join(__dirname, '..', 'UserManagement', 'Repository'),
      path.join(__dirname, '..', 'InventoryManagement', 'Services'),
      path.join(__dirname, '..', 'UserManagement', 'Services'),
    ];
    const scanned = [];
    const usesPrismaWithoutImport = [];
    const ownClient = [];
    for (const dir of dirs) {
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
        const full = path.join(dir, f);
        const src = fs.readFileSync(full, 'utf8');
        const rel = path.relative(path.join(__dirname, '..'), full);
        scanned.push(rel);
        if (src.includes('new PrismaClient')) {
          ownClient.push(rel);
        }
        const importsShared = src.includes("require('../../lib/prisma')") || src.includes('require("../lib/prisma")') || src.includes("require('./lib/prisma')");
        const usesClient = /\bprisma\.(stock|sale|saleItem|product|user|dailyReport|itemBatchOrder|\$transaction|\$queryRaw|\$executeRaw)\b/.test(src);
        if (usesClient && !importsShared) {
          usesPrismaWithoutImport.push(rel);
        }
      }
    }
    assert(scanned.length >= 10, `scanned every repo+service file (found ${scanned.length})`);
    assert(ownClient.length === 0, `no file instantiates its own PrismaClient (offenders: ${ownClient.join(',') || 'none'})`);
    assert(usesPrismaWithoutImport.length === 0, `every file using the prisma client imports it from lib/prisma (offenders: ${usesPrismaWithoutImport.join(',') || 'none'})`);

    // ============================================================
    console.log('\n11. SENSITIVE DATA NOT EXPOSED (temp user, real login)');
    const login = await supertest(app).post('/auth/login')
      .send({ email: tempUser.email, password: `${PREFIX}pass123` });
    assert(login.status === 200, `temp-user login -> 200 (got ${login.status})`);
    assert(!!login.body && !!login.body.token, 'login response includes token');
    assert(!!login.body && !!login.body.user && login.body.user.id === tempUser.id, 'login response includes user id');
    const bodyStr = JSON.stringify(login.body || {});
    assert(!bodyStr.includes('passwordHash'), 'login response has no passwordHash field');
    assert(!bodyStr.includes(hash), 'login response does not leak the bcrypt hash');
    // /auth/me must not expose the hash either.
    const me = await supertest(app).get('/auth/me').set(auth);
    assert(me.status === 200 && !JSON.stringify(me.body || {}).includes('passwordHash'), '/auth/me has no passwordHash');

    // ============================================================
    console.log('\n12. AUTH - UNAUTHORIZED AND INVALID CREDENTIALS');
    const noAuth = await supertest(app).get('/products');
    assert(noAuth.status === 401, `no credentials -> 401 (got ${noAuth.status})`);
    const badAuth = await supertest(app).get('/products').set('Authorization', 'Bearer not-a-real-token');
    assert(badAuth.status === 401, `invalid token -> 401 (got ${badAuth.status})`);

    // ============================================================
    // RATE LIMITING GOES LAST: it exhausts this process's per-IP login
    // budget (max 5 failed attempts / 15 min, successful logins skipped),
    // so no further login attempts are made after this section.
    console.log('\n13. RATE LIMITING - FAILED LOGIN ATTEMPTS');
    // First failed attempt: counted, returns 401 with rate-limit headers.
    const login1 = await supertest(app).post('/auth/login')
      .send({ email: `${PREFIX}nouser@test.local`, password: 'wrong' });
    assert(login1.status === 401, `1st failed login -> 401 (got ${login1.status})`);
    assert(!!login1.headers['ratelimit-limit'] || !!login1.headers['ratelimit'], `rate-limit headers present (limit=${login1.headers['ratelimit-limit'] || 'draft7-combined'})`);
    // Exhaust the budget with failed attempts (skipSuccessfulRequests means
    // only failures count; all of these use a nonexistent user).
    let saw429 = null;
    let attempts = 1;
    for (let i = 2; i <= 8 && !saw429; i++) {
      attempts++;
      const r = await supertest(app).post('/auth/login')
        .send({ email: `${PREFIX}nouser${i}@test.local`, password: 'wrong' });
      if (r.status === 429) saw429 = r;
      else assert(r.status === 401, `attempt ${i} -> 401 before limit (got ${r.status})`);
    }
    assert(!!saw429, `429 returned after the limit (triggered on attempt ${attempts})`);
    if (saw429) {
      assert(/Too many login attempts/.test(JSON.stringify(saw429.body)), '429 body contains rate-limit message');
    }

    console.log('\n=== STAGE 9 SECURITY VERIFICATION COMPLETE ===');
  } finally {
    // Reliable cleanup of everything this suite created.
    if (saleIds.length) {
      await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } }).catch(() => {});
      await prisma.sale.deleteMany({ where: { id: { in: saleIds } } }).catch(() => {});
    }
    // Any other sales that reference our temp products (defensive).
    const straySales = await prisma.sale.findMany({
      where: { items: { some: { productId: { in: productIds } } } },
      select: { id: true },
    }).catch(() => []);
    for (const s of straySales) {
      await prisma.saleItem.deleteMany({ where: { saleId: s.id } }).catch(() => {});
      await prisma.sale.delete({ where: { id: s.id } }).catch(() => {});
    }
    if (productIds.length) {
      await prisma.saleItem.deleteMany({ where: { productId: { in: productIds } } }).catch(() => {});
      await prisma.stock.deleteMany({ where: { productId: { in: productIds } } }).catch(() => {});
      await prisma.product.deleteMany({ where: { id: { in: productIds } } }).catch(() => {});
    }
    if (tempUserId) {
      await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }

  console.log(`\nPassed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('Stage9Security suite crashed:', e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
