const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const prisma = new PrismaClient();
const supertest = require('supertest');

const TEST_PREFIX = 'AUTH_TEST_';

function getJwtSecret() {
  return process.env.JWT_SECRET;
}

async function cleanup() {
  const testUsers = await prisma.user.findMany({
    where: { email: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });
  for (const u of testUsers) {
    // Delete related records first due to foreign key constraints
    await prisma.dailyReport.deleteMany({ where: { generatedById: u.id } });
    await prisma.saleItem.deleteMany({ where: { sale: { soldById: u.id } } });
    await prisma.sale.deleteMany({ where: { soldById: u.id } });
    await prisma.itemBatchOrder.deleteMany({ where: { receivedById: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
}

function generateToken(userId, role) {
  return jwt.sign({ userId, role }, getJwtSecret(), { expiresIn: '8h' });
}

async function createTestUser(role = 'MANAGER') {
  const bcrypt = require('bcrypt');
  const passwordHash = await bcrypt.hash('testpass', 10);
  return prisma.user.create({
    data: {
      fullName: `${TEST_PREFIX}User${Date.now()}`,
      email: `${TEST_PREFIX}user${Date.now()}@floramagg.com`,
      passwordHash,
      role,
    },
  });
}

async function runTests() {
  console.log('\n========== Authorization Tests ==========\n');
  const results = {};

  let adminUser, managerUser, adminToken, managerToken;
  let testProduct, testProductDiscontinued, testSale;
  let validProduct, discontinuedProduct, validProductForStock;

  // Setup: Create test users
  try {
    adminUser = await createTestUser('ADMIN');
    managerUser = await createTestUser('MANAGER');
    adminToken = generateToken(adminUser.id, 'ADMIN');
    managerToken = generateToken(managerUser.id, 'MANAGER');
  } catch (e) {
    console.log('Setup failed:', e.message);
    await cleanup();
    await prisma.$disconnect();
    return;
  }

  // Create test resources
  try {
    // Create active product with stock
    testProduct = await prisma.product.create({
      data: {
        name: `${TEST_PREFIX}Product${Date.now()}`,
        category: 'Beer',
        unitPrice: 500,
        crateSize: 12,
        isActive: true,
      },
    });
    await prisma.stock.create({
      data: {
        productId: testProduct.id,
        quantityBottles: 100,
        quantityCrates: 10,
        reorderLevel: 10,
      },
    });

    // Create discontinued product with stock
    testProductDiscontinued = await prisma.product.create({
      data: {
        name: `${TEST_PREFIX}Discontinued${Date.now()}`,
        category: 'Beer',
        unitPrice: 500,
        crateSize: 12,
        isActive: false,
      },
    });
    await prisma.stock.create({
      data: {
        productId: testProductDiscontinued.id,
        quantityBottles: 50,
        quantityCrates: 5,
        reorderLevel: 10,
      },
    });

    // Create a completed sale
    testSale = await prisma.sale.create({
      data: {
        soldById: adminUser.id,
        totalAmount: 5000,
        status: 'completed',
        items: {
          create: {
            productId: testProduct.id,
            quantityBottles: 10,
            unitPrice: 500,
            lineTotal: 5000,
          },
        },
      },
    });
    // Update stock for the sale
    await prisma.stock.update({
      where: { productId: testProduct.id },
      data: { quantityBottles: { decrement: 10 } },
    });
  } catch (e) {
    console.log('Setup failed:', e.message);
    await cleanup();
    await prisma.$disconnect();
    return;
  }

  // ========== Test: Unauthenticated requests ==========
  console.log('\n--- Unauthenticated requests ---');
  results.unauthenticated = { passed: 0, failed: 0 };

  const protectedRoutes = [
    { method: 'get', path: '/products' },
    { method: 'post', path: '/products' },
    { method: 'post', path: '/products/1/discontinue' },
    { method: 'post', path: '/products/1/reactivate' },
    { method: 'get', path: '/stock/low' },
    { method: 'post', path: '/stock/receive' },
    { method: 'post', path: '/sales' },
    { method: 'get', path: '/sales' },
    { method: 'get', path: '/sales/1' },
    { method: 'post', path: '/sales/1/cancel' },
    { method: 'post', path: '/reports/daily' },
    { method: 'get', path: '/reports/2026-01-01' },
    { method: 'get', path: '/reports?start=2026-01-01&end=2026-01-31' },
  ];

  for (const route of protectedRoutes) {
    try {
      const res = await supertest(app)[route.method](route.path);
      if (res.status === 401) {
        results.unauthenticated.passed++;
        console.log(`✅ ${route.method.toUpperCase()} ${route.path} - 401 Unauthorized`);
      } else {
        results.unauthenticated.failed++;
        console.log(`❌ ${route.method.toUpperCase()} ${route.path} - Expected 401, got ${res.status}`);
      }
    } catch (e) {
      results.unauthenticated.failed++;
      console.log(`❌ ${route.method.toUpperCase()} ${route.path} - Error: ${e.message}`);
    }
  }

  // ========== Create valid resources for positive tests ==========
  try {
    validProduct = await prisma.product.create({
      data: { name: 'Test Product Valid', category: 'Beer', unitPrice: 500, crateSize: 12, isActive: true },
    });
    await prisma.stock.create({
      data: { productId: validProduct.id, quantityBottles: 100, quantityCrates: 10, reorderLevel: 10 },
    });

    discontinuedProduct = await prisma.product.create({
      data: { name: 'Discontinued Product', category: 'Beer', unitPrice: 500, crateSize: 12, isActive: false },
    });
    await prisma.stock.create({
      data: { productId: discontinuedProduct.id, quantityBottles: 50, quantityCrates: 5, reorderLevel: 10 },
    });

    // Create a valid sale with a real product
    testSale = await prisma.sale.create({
      data: {
        soldById: adminUser.id,
        totalAmount: 5000,
        status: 'completed',
        items: {
          create: { productId: validProduct.id, quantityBottles: 10, unitPrice: 500, lineTotal: 5000 }
        }
      }
    });
  } catch (e) {
    console.log('Resource setup failed:', e.message);
  }

  // Create valid product for stock/sales tests
  try {
    validProductForStock = await prisma.product.create({
      data: { name: 'Stock Test Product', category: 'Beer', unitPrice: 500, crateSize: 12, isActive: true },
    });
    await prisma.stock.create({
      data: { productId: validProductForStock.id, quantityBottles: 100, quantityCrates: 10, reorderLevel: 10 },
    });
  } catch (e) {
    console.log('Stock product setup failed:', e.message);
  }

  // ========== Test: Admin access to admin-only routes with VALID data ==========
  console.log('\n--- Admin access to admin-only routes (valid data) ---');
  results.adminAccess = { passed: 0, failed: 0 };

  const adminOnlyRoutesValid = [
    { method: 'post', path: '/products', body: { name: 'Test Product', unitPrice: 500, crateSize: 12, reorderLevel: 10 }, expectedStatus: 201, desc: 'Create valid product' },
    { method: 'post', path: `/products/${discontinuedProduct?.id || 999999}/discontinue`, body: {}, expectedStatus: 200, desc: 'Discontinue existing product' },
    { method: 'post', path: `/products/${discontinuedProduct?.id || 999999}/reactivate`, body: {}, expectedStatus: 200, desc: 'Reactivate existing product' },
    { method: 'post', path: `/sales/${testSale?.id || 999999}/cancel`, body: {}, expectedStatus: 200, desc: 'Cancel existing sale' },
  ];

  for (const route of adminOnlyRoutesValid) {
    try {
      let res;
      if (route.method === 'post') {
        res = await supertest(app).post(route.path)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(route.body || {});
      }
      if (res.status === route.expectedStatus) {
        results.adminAccess.passed++;
        console.log(`✅ POST ${route.path} (${route.desc}) - Admin access allowed (status: ${res.status})`);
      } else if (res.status === 403) {
        results.adminAccess.failed++;
        console.log(`❌ POST ${route.path} - Admin denied (403 Forbidden)`);
      } else {
        results.adminAccess.failed++;
        console.log(`❌ POST ${route.path} - Expected ${route.expectedStatus}, got ${res.status}`);
      }
    } catch (e) {
      results.adminAccess.failed++;
      console.log(`❌ POST ${route.path} - Error: ${e.message}`);
    }
  }

  // ========== Test: Manager denied access to admin-only routes with VALID data ==========
  console.log('\n--- Manager denied access to admin-only routes (with valid data) ---');
  results.managerDenied = { passed: 0, failed: 0 };

  const adminOnlyRoutesManager = [
    { method: 'post', path: '/products', body: { name: 'Test Product', unitPrice: 500, crateSize: 12, reorderLevel: 10 }, desc: 'Create product' },
    { method: 'post', path: `/products/${discontinuedProduct?.id || 999999}/discontinue`, body: {}, desc: 'Discontinue product' },
    { method: 'post', path: `/products/${discontinuedProduct?.id || 999999}/reactivate`, body: {}, desc: 'Reactivate product' },
    { method: 'post', path: `/sales/${testSale?.id || 999999}/cancel`, body: {}, desc: 'Cancel sale' },
  ];

  for (const route of adminOnlyRoutesManager) {
    try {
      let res;
      if (route.method === 'post') {
        res = await supertest(app).post(route.path)
          .set('Authorization', `Bearer ${managerToken}`)
          .send(route.body || {});
      }
      if (res.status === 403) {
        results.managerDenied.passed++;
        console.log(`✅ POST ${route.path} (${route.desc}) - Manager correctly denied (403 Forbidden)`);
      } else {
        results.managerDenied.failed++;
        console.log(`❌ POST ${route.path} (${route.desc}) - Expected 403, got ${res.status}`);
      }
    } catch (e) {
      results.managerDenied.failed++;
      console.log(`❌ POST ${route.path} - Error: ${e.message}`);
    }
  }

  // ========== Test: Admin access to shared routes with VALID data ==========
  console.log('\n--- Admin access to shared routes (valid data) ---');
  results.adminShared = { passed: 0, failed: 0 };

  const sharedRoutesAdmin = [
    { method: 'get', path: '/products', expectedStatus: 200, desc: 'List products' },
    { method: 'get', path: '/stock/low', expectedStatus: 200, desc: 'List low stock' },
    { method: 'post', path: '/stock/receive', body: { productId: validProductForStock?.id, crateCount: 1, bottleCount: 0, costPerUnit: 400 }, expectedStatus: 201, desc: 'Receive stock for valid product' },
    { method: 'post', path: '/sales', body: { items: [{ productId: validProductForStock?.id, quantityBottles: 1, unitPrice: 500 }] }, expectedStatus: 201, desc: 'Create sale with valid product' },
    { method: 'get', path: '/sales', expectedStatus: 200, desc: 'List sales' },
    { method: 'get', path: `/sales/${testSale?.id || 999999}`, expectedStatus: 200, desc: 'Get existing sale' },
    { method: 'post', path: '/reports/daily', body: { date: '2026-01-03' }, expectedStatus: 201, desc: 'Generate daily report' },
    { method: 'get', path: '/reports/2026-01-03', expectedStatus: 200, desc: 'Get report by date' },
    { method: 'get', path: '/reports?start=2026-01-03&end=2026-01-31', expectedStatus: 200, desc: 'List reports' },
  ];

  for (const route of sharedRoutesAdmin) {
    try {
      let res;
      if (route.method === 'get') {
        res = await supertest(app).get(route.path)
          .set('Authorization', `Bearer ${adminToken}`);
      } else if (route.method === 'post') {
        res = await supertest(app).post(route.path)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(route.body || {});
      }
      if (res.status === route.expectedStatus) {
        results.adminShared.passed++;
        console.log(`✅ ${route.method.toUpperCase()} ${route.path} (${route.desc}) - Admin access allowed (status: ${res.status})`);
      } else if (res.status === 403) {
        results.adminShared.failed++;
        console.log(`❌ ${route.method.toUpperCase()} ${route.path} (${route.desc}) - Admin denied (403 Forbidden)`);
      } else {
        results.adminShared.failed++;
        console.log(`❌ ${route.method.toUpperCase()} ${route.path} (${route.desc}) - Expected ${route.expectedStatus}, got ${res.status}`);
      }
    } catch (e) {
      results.adminShared.failed++;
      console.log(`❌ ${route.method.toUpperCase()} ${route.path} (${route.desc}) - Error: ${e.message}`);
    }
  }

  // ========== Test: Manager access to shared routes with VALID data ==========
  console.log('\n--- Manager access to shared routes (valid data) ---');
  results.managerShared = { passed: 0, failed: 0 };

  const sharedRoutesManager = [
    { method: 'get', path: '/products', expectedStatus: 200, desc: 'List products' },
    { method: 'get', path: '/stock/low', expectedStatus: 200, desc: 'List low stock' },
    { method: 'post', path: '/stock/receive', body: { productId: validProductForStock?.id, crateCount: 1, bottleCount: 0, costPerUnit: 400 }, expectedStatus: 201, desc: 'Receive stock for valid product' },
    { method: 'post', path: '/sales', body: { items: [{ productId: validProductForStock?.id, quantityBottles: 1, unitPrice: 500 }] }, expectedStatus: 201, desc: 'Create sale with valid product' },
    { method: 'get', path: '/sales', expectedStatus: 200, desc: 'List sales' },
    { method: 'get', path: `/sales/${testSale?.id || 999999}`, expectedStatus: 200, desc: 'Get existing sale' },
    { method: 'post', path: '/reports/daily', body: { date: '2026-01-02' }, expectedStatus: 201, desc: 'Generate daily report' },
    { method: 'get', path: '/reports/2026-01-02', expectedStatus: 200, desc: 'Get report by date' },
    { method: 'get', path: '/reports?start=2026-01-02&end=2026-01-31', expectedStatus: 200, desc: 'List reports' },
  ];

  for (const route of sharedRoutesManager) {
    try {
      let res;
      if (route.method === 'get') {
        res = await supertest(app).get(route.path)
          .set('Authorization', `Bearer ${managerToken}`);
      } else if (route.method === 'post') {
        res = await supertest(app).post(route.path)
          .set('Authorization', `Bearer ${managerToken}`)
          .send(route.body || {});
      }
      if (res.status === route.expectedStatus) {
        results.managerShared.passed++;
        console.log(`✅ ${route.method.toUpperCase()} ${route.path} (${route.desc}) - Manager access allowed (status: ${res.status})`);
      } else if (res.status === 403) {
        results.managerShared.failed++;
        console.log(`❌ ${route.method.toUpperCase()} ${route.path} (${route.desc}) - Manager denied (403 Forbidden)`);
      } else {
        results.managerShared.failed++;
        console.log(`❌ ${route.method.toUpperCase()} ${route.path} (${route.desc}) - Expected ${route.expectedStatus}, got ${res.status}`);
      }
    } catch (e) {
      results.managerShared.failed++;
      console.log(`❌ ${route.method.toUpperCase()} ${route.path} (${route.desc}) - Error: ${e.message}`);
    }
  }

  // ========== Test: MANAGER tries ADMIN-only routes with VALID data ==========
  console.log('\n--- MANAGER trying ADMIN-only routes with VALID data ---');
  results.managerForbidden = { passed: 0, failed: 0 };

  const adminOnlyRoutesForManager = [
    { method: 'post', path: '/products', body: { name: 'Test Product', unitPrice: 500, crateSize: 12, reorderLevel: 10 }, desc: 'Create product' },
    { method: 'post', path: `/products/${discontinuedProduct?.id || 999999}/discontinue`, body: {}, desc: 'Discontinue product' },
    { method: 'post', path: `/products/${discontinuedProduct?.id || 999999}/reactivate`, body: {}, desc: 'Reactivate product' },
    { method: 'post', path: `/sales/${testSale?.id || 999999}/cancel`, body: {}, desc: 'Cancel sale' },
  ];

  for (const route of adminOnlyRoutesForManager) {
    try {
      let res;
      if (route.method === 'post') {
        res = await supertest(app).post(route.path)
          .set('Authorization', `Bearer ${managerToken}`)
          .send(route.body || {});
      }
      if (res.status === 403) {
        results.managerForbidden.passed++;
        console.log(`✅ ${route.method.toUpperCase()} ${route.path} (${route.desc}) - Manager correctly denied (403 Forbidden)`);
      } else {
        results.managerForbidden.failed++;
        console.log(`❌ ${route.method.toUpperCase()} ${route.path} (${route.desc}) - Expected 403, got ${res.status}`);
      }
    } catch (e) {
      results.managerForbidden.failed++;
      console.log(`❌ ${route.method.toUpperCase()} ${route.path} (${route.desc}) - Error: ${e.message}`);
    }
  }

  // ========== Test: Database immutability for unauthorized requests ==========
  console.log('\n--- Database immutability for unauthorized requests ---');
  results.dbImmutability = { passed: 0, failed: 0 };

  // Test 1: Manager tries to create product - verify no product created
  console.log('\n--- Test: Manager cannot create product ---');
  try {
    const countBefore = await prisma.product.count({ where: { name: { startsWith: 'TEST_' } } });
    const res = await supertest(app).post('/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'TEST_UnauthorizedProduct', unitPrice: 500, crateSize: 12, reorderLevel: 10 });
    const countAfter = await prisma.product.count({ where: { name: { startsWith: 'TEST_' } } });
    
    if (res.status === 403 && countAfter === countBefore) {
      results.dbImmutability.passed++;
      console.log('✅ Manager create product - 403 and no product created');
    } else {
      results.dbImmutability.failed++;
      console.log(`❌ Manager create product - Status: ${res.status}, Count before: ${countBefore}, after: ${countAfter}`);
    }
  } catch (e) {
    results.dbImmutability.failed++;
    console.log(`❌ Manager create product - Error: ${e.message}`);
  }

  // Test 2: Manager tries to discontinue product - verify no change
  console.log('\n--- Test: Manager cannot discontinue product ---');
  try {
    const productToDiscontinue = await prisma.product.create({
      data: { name: 'TEST_Discontinue', category: 'Beer', unitPrice: 500, crateSize: 12, isActive: true },
    });
    const isActiveBefore = (await prisma.product.findUnique({ where: { id: productToDiscontinue.id } })).isActive;
    
    const res = await supertest(app).post(`/products/${productToDiscontinue.id}/discontinue`)
      .set('Authorization', `Bearer ${managerToken}`);
    
    const isActiveAfter = (await prisma.product.findUnique({ where: { id: productToDiscontinue.id } })).isActive;
    
    if (res.status === 403 && isActiveAfter === isActiveBefore) {
      results.dbImmutability.passed++;
      console.log('✅ Manager discontinue product - 403 and no change');
    } else {
      results.dbImmutability.failed++;
      console.log(`❌ Manager discontinue - Status: ${res.status}, Active before: ${isActiveBefore}, after: ${isActiveAfter}`);
    }
    await prisma.product.delete({ where: { id: productToDiscontinue.id } });
  } catch (e) {
    results.dbImmutability.failed++;
    console.log(`❌ Manager discontinue - Error: ${e.message}`);
  }

  // Test 3: Manager tries to cancel sale
  console.log('\n--- Test: Manager cannot cancel sale ---');
  try {
    const saleToCancel = await prisma.sale.create({
      data: {
        soldById: adminUser.id,
        totalAmount: 5000,
        status: 'completed',
        items: { create: { productId: testProduct.id, quantityBottles: 10, unitPrice: 500, lineTotal: 5000 } },
      },
    });
    
    const statusBefore = (await prisma.sale.findUnique({ where: { id: saleToCancel.id } })).status;
    
    const res = await supertest(app).post(`/sales/${saleToCancel.id}/cancel`)
      .set('Authorization', `Bearer ${managerToken}`);
    
    const statusAfter = (await prisma.sale.findUnique({ where: { id: saleToCancel.id } })).status;
    
    if (res.status === 403 && statusAfter === statusBefore) {
      results.dbImmutability.passed++;
      console.log('✅ Manager cancel sale - 403 and no change');
    } else {
      results.dbImmutability.failed++;
      console.log(`❌ Manager cancel sale - Status: ${res.status}, Status before: ${statusBefore}, after: ${statusAfter}`);
    }
    
    await prisma.saleItem.deleteMany({ where: { saleId: saleToCancel.id } });
    await prisma.sale.delete({ where: { id: saleToCancel.id } });
  } catch (e) {
    results.dbImmutability.failed++;
    console.log(`❌ Manager cancel sale - Error: ${e.message}`);
  }

  // ========== Test: Authentication failures ==========
  console.log('\n--- Authentication failure tests ---');
  results.authFailures = { passed: 0, failed: 0 };

  const authFailureTests = [
    { name: 'Missing token', test: async () => {
      const res = await supertest(app).get('/products');
      return res.status === 401 && res.body.error.includes('Authentication token required');
    }},
    { name: 'Invalid token', test: async () => {
      const res = await supertest(app).get('/products').set('Authorization', 'Bearer invalid.token.here');
      return res.status === 401 && res.body.error.includes('Invalid or expired token');
    }},
    { name: 'Expired token', test: async () => {
      const expiredToken = jwt.sign({ userId: 999999, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '-1h' });
      const res = await supertest(app).get('/products').set('Authorization', `Bearer ${expiredToken}`);
      return res.status === 401 && res.body.error.includes('Invalid or expired token');
    }},
    { name: 'Malformed token', test: async () => {
      const res = await supertest(app).get('/products').set('Authorization', 'Bearer not.a.valid.token');
      return res.status === 401 && res.body.error.includes('Invalid or expired token');
    }},
    { name: 'Missing Authorization header', test: async () => {
      const res = await supertest(app).get('/products');
      return res.status === 401 && res.body.error.includes('Authentication token required');
    }},
    { name: 'Missing Bearer prefix', test: async () => {
      const res = await supertest(app).get('/products').set('Authorization', 'invalidtoken');
      return res.status === 401 && res.body.error.includes('Authentication token required');
    }},
  ];

  for (const test of authFailureTests) {
    try {
      const passed = await test.test();
      if (passed) {
        results.authFailures.passed++;
        console.log(`✅ ${test.name} - 401 Unauthorized`);
      } else {
        results.authFailures.failed++;
        console.log(`❌ ${test.name} - Failed`);
      }
    } catch (e) {
      results.authFailures.failed++;
      console.log(`❌ ${test.name} - Error: ${e.message}`);
    }
  }

  // ========== Test: Authorization error responses ==========
  console.log('\n--- Authorization error responses ---');
  results.authzErrors = { passed: 0, failed: 0 };

  const authzErrorTests = [
    { name: 'Manager tries ADMIN-only route', test: async () => {
      const res = await supertest(app).post('/products')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Test Product', unitPrice: 500, crateSize: 12, reorderLevel: 10 });
      return res.status === 403 && res.body.error === 'Insufficient permissions';
    }},
    { name: 'Missing role in token', test: async () => {
      const token = jwt.sign({ userId: 999999 }, getJwtSecret(), { expiresIn: '8h' });
      const res = await supertest(app).get('/products').set('Authorization', `Bearer ${token}`);
      return res.status === 403 && res.body.error === 'Role information missing';
    }},
  ];

  for (const test of authzErrorTests) {
    try {
      const passed = await test.test();
      if (passed) {
        results.authzErrors.passed++;
        console.log(`✅ ${test.name} - 403 Forbidden with correct error`);
      } else {
        results.authzErrors.failed++;
        console.log(`❌ ${test.name} - Failed`);
      }
    } catch (e) {
      results.authzErrors.failed++;
      console.log(`❌ ${test.name} - Error: ${e.message}`);
    }
  }

  // ========== Test: Authorization happens before business logic ==========
  console.log('\n--- Authorization before business logic verification ---');
  results.authzBeforeLogic = { passed: 0, failed: 0 };

  // Test: MANAGER tries to create product - verify service not called
  console.log('\n--- Test: Authorization before service call ---');
  try {
    const countBefore = await prisma.product.count({ where: { name: { startsWith: 'TEST_Unauthorized' } } });
    
    const res = await supertest(app).post('/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'TEST_UnauthorizedProduct', unitPrice: 500, crateSize: 12, reorderLevel: 10 });
    
    const countAfter = await prisma.product.count({ where: { name: { startsWith: 'TEST_Unauthorized' } } });
    
    if (res.status === 403 && countAfter === countBefore) {
      results.authzBeforeLogic.passed++;
      console.log('✅ Authorization before logic - 403 and no product created');
    } else {
      results.authzBeforeLogic.failed++;
      console.log(`❌ Authorization before logic - Status: ${res.status}, Count before: ${countBefore}, after: ${countAfter}`);
    }
  } catch (e) {
    results.authzBeforeLogic.failed++;
    console.log(`❌ Authorization before logic - Error: ${e.message}`);
  }

  // Test: MANAGER tries to cancel sale - verify sale not cancelled
  console.log('\n--- Test: Manager cannot cancel sale (database immutable) ---');
  try {
    const saleToCancel = await prisma.sale.create({
      data: {
        soldById: adminUser.id,
        totalAmount: 5000,
        status: 'completed',
        items: { create: { productId: testProduct.id, quantityBottles: 10, unitPrice: 500, lineTotal: 5000 } },
      },
    });
    
    const statusBefore = (await prisma.sale.findUnique({ where: { id: saleToCancel.id } })).status;
    
    const res = await supertest(app).post(`/sales/${saleToCancel.id}/cancel`)
      .set('Authorization', `Bearer ${managerToken}`);
    
    const statusAfter = (await prisma.sale.findUnique({ where: { id: saleToCancel.id } })).status;
    
    if (res.status === 403 && statusAfter === statusBefore) {
      results.authzBeforeLogic.passed++;
      console.log('✅ Authorization before logic - 403 and no sale cancelled');
    } else {
      results.authzBeforeLogic.failed++;
      console.log(`❌ Authorization before logic - Status: ${res.status}, Status before: ${statusBefore}, after: ${statusAfter}`);
    }
    
    await prisma.saleItem.deleteMany({ where: { saleId: saleToCancel.id } });
    await prisma.sale.delete({ where: { id: saleToCancel.id } });
  } catch (e) {
    results.authzBeforeLogic.failed++;
    console.log(`❌ Authorization before logic - Error: ${e.message}`);
  }

  // Cleanup
  await cleanup();
  await prisma.$disconnect();

  // Summary
  console.log('\n========== Authorization Test Summary ==========');
  for (const [category, result] of Object.entries(results)) {
    const total = result.passed + result.failed;
    const status = result.failed === 0 ? '✅ PASS' : '❌ FAIL';
    console.log(`${category}: ${result.passed}/${total} ${status}`);
  }

  const totalPassed = Object.values(results).reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0);
  console.log(`\nTotal: ${totalPassed} passed, ${totalFailed} failed`);
  console.log(totalFailed === 0 ? '\n✅ ALL AUTHORIZATION TESTS PASSED' : '\n❌ SOME AUTHORIZATION TESTS FAILED');

  await prisma.$disconnect();
  return results;
}

runTests().catch(async (e) => {
  console.error('Test runner crashed:', e);
  await cleanup();
  await prisma.$disconnect();
});