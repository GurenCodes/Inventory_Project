const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const reportService = require('../InventoryManagement/Services/ReportService');
const productRepository = require('../InventoryManagement/Repository/Product');
const stockRepository = require('../InventoryManagement/Repository/Stock');

const TEST_PREFIX = 'TEST_';

async function cleanup() {
  const testReports = await prisma.dailyReport.findMany({
    where: { generatedBy: { email: { startsWith: TEST_PREFIX } } },
    select: { id: true },
  });
  for (const r of testReports) {
    await prisma.dailyReport.delete({ where: { id: r.id } });
  }
  const testSales = await prisma.sale.findMany({
    where: { soldBy: { email: { startsWith: TEST_PREFIX } } },
    select: { id: true },
  });
  for (const s of testSales) {
    await prisma.saleItem.deleteMany({ where: { saleId: s.id } });
    await prisma.sale.delete({ where: { id: s.id } });
  }
  const testProducts = await prisma.product.findMany({
    where: { name: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });
  for (const p of testProducts) {
    await prisma.stock.deleteMany({ where: { productId: p.id } });
    await prisma.saleItem.deleteMany({ where: { productId: p.id } });
    await prisma.itemBatchOrder.deleteMany({ where: { productId: p.id } });
    await prisma.product.delete({ where: { id: p.id } });
  }
  const testUsers = await prisma.user.findMany({
    where: { email: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });
  for (const u of testUsers) {
    await prisma.user.delete({ where: { id: u.id } });
  }
}

async function createTestUser() {
  const bcrypt = require('bcrypt');
  const passwordHash = await bcrypt.hash('testpass', 10);
  return prisma.user.create({
    data: {
      fullName: `${TEST_PREFIX}User${Date.now()}`,
      email: `${TEST_PREFIX}user${Date.now()}@floramagg.com`,
      passwordHash,
      role: 'MANAGER',
    },
  });
}

async function createTestProduct(overrides = {}) {
  const product = await productRepository.create({
    name: `${TEST_PREFIX}ReportProduct${Date.now()}`,
    category: 'Beer',
    unitPrice: 500,
    crateSize: 12,
    ...overrides,
  });
  await stockRepository.create({
    productId: product.id,
    quantityBottles: 100,
    quantityCrates: 5,
    reorderLevel: 10,
  });
  return product;
}

async function runTests() {
  console.log('\n========== ReportService Tests ==========\n');
  const results = {};

  let testProduct, testUser;
  try {
    testProduct = await createTestProduct();
    testUser = await createTestUser();
  } catch (e) {
    console.log('Setup failed:', e.message);
    await cleanup();
    await prisma.$disconnect();
    return;
  }

  // ========== generateDailyReport ==========
  console.log('--- generateDailyReport() ---');
  results.generateDailyReport = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: false,
    dbState: false,
    transactionIntegrity: 'N/A',
  };

  // Use a fixed past date that doesn't exist in DB
  const testDate = new Date('2026-07-01T00:00:00.000Z');

  // Valid input - use testDate (clean up any existing report and sales first)
  await prisma.dailyReport.deleteMany({ where: { reportDate: testDate } });
  await prisma.saleItem.deleteMany({ where: { sale: { createdAt: { gte: testDate, lt: new Date(testDate.getTime() + 86400000) } } } });
  await prisma.sale.deleteMany({ where: { createdAt: { gte: testDate, lt: new Date(testDate.getTime() + 86400000) } } });

  // Create test sales for testDate
  try {
    await prisma.sale.create({
      data: {
        soldById: testUser.id,
        totalAmount: 5000,
        status: 'completed',
        createdAt: testDate,
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
    const pendingSale = await prisma.sale.create({
      data: { soldById: testUser.id, totalAmount: 1000, status: 'pending', createdAt: testDate },
    });
    await prisma.saleItem.create({
      data: { saleId: pendingSale.id, productId: testProduct.id, quantityBottles: 2, unitPrice: 500, lineTotal: 1000 },
    });
    const cancelledSale = await prisma.sale.create({
      data: { soldById: testUser.id, totalAmount: 500, status: 'cancelled', createdAt: testDate },
    });
    await prisma.saleItem.create({
      data: { saleId: cancelledSale.id, productId: testProduct.id, quantityBottles: 1, unitPrice: 500, lineTotal: 500 },
    });
  } catch (e) {
    console.log('Setup sales failed:', e.message);
  }

  try {
    const res = await reportService.generateDailyReport({
      date: testDate,
      generatedById: testUser.id,
    });
    if (res && res.id && Number(res.totalSalesAmount) === 5000) {
      results.generateDailyReport.validInput = true;
      console.log('✅ Valid input: PASS - Report generated with correct total');
    } else {
      console.log('❌ Valid input: FAIL - Report:', res);
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Missing required fields
  const requiredFields = ['date', 'generatedById'];
  for (const field of requiredFields) {
    try {
      const data = { date: testDate, generatedById: testUser.id };
      delete data[field];
      await reportService.generateDailyReport(data);
      results.generateDailyReport.missingFields.push({ field, passed: false });
      console.log(`❌ Missing ${field}: FAIL - Should have thrown`);
    } catch (e) {
      results.generateDailyReport.missingFields.push({ field, passed: true });
      console.log(`✅ Missing ${field}: PASS - Threw "${e.message}"`);
    }
  }

  // Invalid values - each test uses its own unique date to avoid unique constraint collisions
  const invalidTests = [
    { 
      name: 'nonExistentUser', 
      data: { date: new Date('2026-07-02T00:00:00.000Z'), generatedById: 999999 },
      expectedError: 'Foreign key constraint' // Prisma foreign key error
    },
    { 
      name: 'futureDate', 
      data: { date: new Date('2099-01-01T00:00:00.000Z'), generatedById: testUser.id },
      expectedError: 'future date'
    },
    { 
      name: 'invalidDate', 
      data: { date: 'not-a-date', generatedById: testUser.id },
      expectedError: 'Invalid date'
    },
  ];
  for (const test of invalidTests) {
    try {
      await reportService.generateDailyReport(test.data);
      results.generateDailyReport.invalidValues.push({ test: test.name, passed: false });
      console.log(`❌ Invalid ${test.name}: FAIL - Should have thrown`);
    } catch (e) {
      const errorMsg = e.message || String(e);
      if (errorMsg.includes(test.expectedError) || errorMsg.toLowerCase().includes(test.expectedError.toLowerCase())) {
        results.generateDailyReport.invalidValues.push({ test: test.name, passed: true });
        console.log(`✅ Invalid ${test.name}: PASS - Threw expected error: "${errorMsg}"`);
      } else {
        results.generateDailyReport.invalidValues.push({ test: test.name, passed: false });
        console.log(`❌ Invalid ${test.name}: FAIL - Wrong error. Expected "${test.expectedError}", got "${errorMsg}"`);
      }
    }
  }

  // REGRESSION TEST: Problem 1 - today is NOT rejected as future date
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  await prisma.dailyReport.deleteMany({ where: { reportDate: today } });
  console.log('\n--- REGRESSION: Problem 1 (today accepted) ---');
  try {
    const res = await reportService.generateDailyReport({
      date: today,
      generatedById: testUser.id,
    });
    if (res && res.id) {
      console.log('✅ Problem 1 fix: PASS - Today is accepted (not rejected as future)');
      await prisma.dailyReport.delete({ where: { id: res.id } });
    } else {
      console.log('❌ Problem 1 fix: FAIL -', res);
    }
  } catch (e) {
    if (e.message.includes('future date')) {
      console.log('❌ Problem 1 fix: FAIL - Today rejected as future:', e.message);
    } else if (e.message.includes('already exists') || e.message.includes('Unique')) {
      console.log('✅ Problem 1 fix: PASS - Today accepted (duplicate check passed)');
    } else {
      console.log('❌ Problem 1 fix: FAIL -', e.message);
    }
  }

  // Business rule: only sums completed sales, not pending or cancelled
  // Use a unique date
  const yesterday = new Date('2026-07-03T00:00:00.000Z');
  await prisma.dailyReport.deleteMany({ where: { reportDate: yesterday } });
  await prisma.saleItem.deleteMany({ where: { sale: { createdAt: { gte: yesterday, lt: new Date(yesterday.getTime() + 86400000) } } } });
  await prisma.sale.deleteMany({ where: { createdAt: { gte: yesterday, lt: new Date(yesterday.getTime() + 86400000) } } });

  const testProductYesterday = await createTestProduct();
  let yesterdaySalesCreated = false;
  try {
    await prisma.sale.create({
      data: {
        soldById: testUser.id,
        totalAmount: 5000,
        status: 'completed',
        createdAt: yesterday,
        items: { create: { productId: testProductYesterday.id, quantityBottles: 10, unitPrice: 500, lineTotal: 5000 } }
      }
    });
    await prisma.sale.create({
      data: {
        soldById: testUser.id,
        totalAmount: 1000,
        status: 'pending',
        createdAt: yesterday,
        items: { create: { productId: testProductYesterday.id, quantityBottles: 2, unitPrice: 500, lineTotal: 1000 } }
      }
    });
    await prisma.sale.create({
      data: {
        soldById: testUser.id,
        totalAmount: 500,
        status: 'cancelled',
        createdAt: yesterday,
        items: { create: { productId: testProductYesterday.id, quantityBottles: 1, unitPrice: 500, lineTotal: 500 } }
      }
    });
    yesterdaySalesCreated = true;

    const res = await reportService.generateDailyReport({
      date: yesterday,
      generatedById: testUser.id,
    });
    if (Number(res.totalSalesAmount) === 5000) {
      results.generateDailyReport.businessRules = true;
      console.log('✅ Business rule (only completed): PASS - Total is 5000 (only completed)');
    } else {
      console.log('❌ Business rule: FAIL - Total is', res.totalSalesAmount, 'expected 5000');
    }
  } catch (e) {
    console.log('❌ Business rule: FAIL -', e.message);
  } finally {
    if (yesterdaySalesCreated) {
      await prisma.dailyReport.deleteMany({ where: { reportDate: yesterday } });
      await prisma.saleItem.deleteMany({ where: { sale: { createdAt: { gte: yesterday, lt: new Date(yesterday.getTime() + 86400000) } } } });
      await prisma.sale.deleteMany({ where: { createdAt: { gte: yesterday, lt: new Date(yesterday.getTime() + 86400000) } } });
    }
  }

  // REGRESSION TEST: Problem 2 - "completed only" verified by direct DB query
  console.log('\n--- REGRESSION: Problem 2 (completed only, DB verified) ---');
  const testDate2 = new Date('2026-07-04T00:00:00.000Z');
  await prisma.dailyReport.deleteMany({ where: { reportDate: testDate2 } });
  await prisma.saleItem.deleteMany({ where: { sale: { createdAt: { gte: testDate2, lt: new Date(testDate2.getTime() + 86400000) } } } });
  await prisma.sale.deleteMany({ where: { createdAt: { gte: testDate2, lt: new Date(testDate2.getTime() + 86400000) } } });

  const testProduct2 = await createTestProduct();
  let testDate2SalesCreated = false;
  try {
    await prisma.sale.create({
      data: {
        soldById: testUser.id,
        totalAmount: 500,
        status: 'completed',
        createdAt: testDate2,
        items: { create: { productId: testProduct2.id, quantityBottles: 5, unitPrice: 100, lineTotal: 500 } }
      }
    });
    await prisma.sale.create({
      data: {
        soldById: testUser.id,
        totalAmount: 2000,
        status: 'pending',
        createdAt: testDate2,
        items: { create: { productId: testProduct2.id, quantityBottles: 20, unitPrice: 100, lineTotal: 2000 } }
      }
    });
    await prisma.sale.create({
      data: {
        soldById: testUser.id,
        totalAmount: 1000,
        status: 'cancelled',
        createdAt: testDate2,
        items: { create: { productId: testProduct2.id, quantityBottles: 10, unitPrice: 100, lineTotal: 1000 } }
      }
    });
    testDate2SalesCreated = true;

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: testDate2, lt: new Date(testDate2.getTime() + 86400000) } },
      include: { items: true }
    });
    const completedSales = sales.filter(s => s.status === 'completed');
    const totalCompleted = completedSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);

    if (totalCompleted === 500) {
      console.log('✅ Problem 2 fix (DB verified): PASS - Only completed sales summed (500), not pending/cancelled');
    } else {
      console.log('❌ Problem 2 fix: FAIL - DB sum is', totalCompleted, 'expected 500');
    }

    await prisma.dailyReport.deleteMany({ where: { reportDate: testDate2 } });
    const res2 = await reportService.generateDailyReport({ date: testDate2, generatedById: testUser.id });
    if (Number(res2.totalSalesAmount) === 500) {
      console.log('✅ Problem 2 fix (API verified): PASS - Report totalSalesAmount = 500 (completed only)');
    } else {
      console.log('❌ Problem 2 fix: FAIL - Report total =', res2.totalSalesAmount);
    }
  } catch (e) {
    console.log('❌ Problem 2 fix: FAIL -', e.message);
  } finally {
    if (testDate2SalesCreated) {
      await prisma.dailyReport.deleteMany({ where: { reportDate: testDate2 } });
      await prisma.saleItem.deleteMany({ where: { sale: { createdAt: { gte: testDate2, lt: new Date(testDate2.getTime() + 86400000) } } } });
      await prisma.sale.deleteMany({ where: { createdAt: { gte: testDate2, lt: new Date(testDate2.getTime() + 86400000) } } });
    }
  }

  // Business rule: unique reportDate - duplicate should fail
  try {
    await reportService.generateDailyReport({
      date: testDate,
      generatedById: testUser.id,
    });
    console.log('❌ Business rule (unique date): FAIL - Should have thrown on duplicate');
  } catch (e) {
    if (e.message.includes('Unique') || e.message.includes('unique') || e.message.includes('already')) {
      console.log('✅ Business rule (unique date): PASS - Throws on duplicate date');
    } else {
      console.log('❌ Business rule: FAIL - Wrong error:', e.message);
    }
  }

  // Database state after call
  const dayBeforeYesterday = new Date('2026-07-05T00:00:00.000Z');
  await prisma.dailyReport.deleteMany({ where: { reportDate: dayBeforeYesterday } });
  try {
    const res = await reportService.generateDailyReport({
      date: dayBeforeYesterday,
      generatedById: testUser.id,
    });
    const dbReport = await prisma.dailyReport.findUnique({ where: { id: res.id } });
    if (dbReport && dbReport.reportDate.getTime() === dayBeforeYesterday.getTime() && 
        dbReport.generatedById === testUser.id && Number(dbReport.totalSalesAmount) === 0) {
      results.generateDailyReport.dbState = true;
      console.log('✅ Database state: PASS - Report persisted correctly');
    } else {
      console.log('❌ Database state: FAIL - Report:', dbReport);
    }
  } catch (e) {
    console.log('❌ Database state: FAIL -', e.message);
  }

  results.generateDailyReport.transactionIntegrity = 'N/A';
  console.log('➖ Transaction integrity: N/A - No multi-table transaction');

  // ========== getReportByDate ==========
  console.log('\n--- getReportByDate() ---');
  results.getReportByDate = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: 'N/A',
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  const pastDate = new Date();
  pastDate.setUTCHours(0, 0, 0, 0);
  pastDate.setUTCDate(pastDate.getUTCDate() - 5);
  await prisma.dailyReport.deleteMany({ where: { reportDate: pastDate } });
  try {
    await reportService.generateDailyReport({ date: pastDate, generatedById: testUser.id });
    const res = await reportService.getReportByDate(pastDate);
    if (res && res.reportDate.getTime() === pastDate.getTime()) {
      results.getReportByDate.validInput = true;
      console.log('✅ Valid input: PASS - Returns report for date');
    } else {
      console.log('❌ Valid input: FAIL');
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  } finally {
    await prisma.dailyReport.deleteMany({ where: { reportDate: pastDate } });
  }

  // Non-existent date should return null
  const pastDateNoReport = new Date();
  pastDateNoReport.setUTCHours(0, 0, 0, 0);
  pastDateNoReport.setUTCDate(pastDateNoReport.getUTCDate() - 100);
  await prisma.dailyReport.deleteMany({ where: { reportDate: pastDateNoReport } });
  try {
    const res = await reportService.getReportByDate(pastDateNoReport);
    if (res === null) {
      results.getReportByDate.invalidValues.push({ test: 'nonExistentDate', passed: true });
      console.log('✅ Non-existent date: PASS - Returns null');
    } else {
      results.getReportByDate.invalidValues.push({ test: 'nonExistentDate', passed: false });
      console.log('❌ Non-existent date: FAIL - Should return null');
    }
  } catch (e) {
    results.getReportByDate.invalidValues.push({ test: 'nonExistentDate', passed: false });
    console.log(`❌ Non-existent date: FAIL - Threw "${e.message}" instead of returning null`);
  }

  // ========== listReports ==========
  console.log('\n--- listReports() ---');
  results.listReports = {
    validInput: false,
    missingFields: 'N/A',
    invalidValues: [],
    businessRules: 'N/A',
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  try {
    const res = await reportService.listReports();
    if (Array.isArray(res)) {
      results.listReports.validInput = true;
      console.log('✅ Valid input: PASS - Returns array');
    } else {
      console.log('❌ Valid input: FAIL');
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  try {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 10);
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const res = await reportService.listReports(start, end);
    if (Array.isArray(res)) {
      results.listReports.invalidValues.push({ test: 'dateRangeFilter', passed: true });
      console.log('✅ Date range filter: PASS - Returns filtered array');
    } else {
      results.listReports.invalidValues.push({ test: 'dateRangeFilter', passed: false });
      console.log('❌ Date range filter: FAIL');
    }
  } catch (e) {
    results.listReports.invalidValues.push({ test: 'dateRangeFilter', passed: false });
    console.log('❌ Date range filter: FAIL -', e.message);
  }

  // Cleanup
  await cleanup();

  // Verify no leftover test data
  console.log('\n--- Leftover Test Data Check ---');
  const leftoverReports = await prisma.dailyReport.count({ where: { generatedBy: { email: { startsWith: TEST_PREFIX } } } });
  const leftoverSales = await prisma.sale.count({ where: { soldBy: { email: { startsWith: TEST_PREFIX } } } });
  const leftoverSaleItems = await prisma.saleItem.count({ where: { sale: { soldBy: { email: { startsWith: TEST_PREFIX } } } } });
  const leftoverProducts = await prisma.product.count({ where: { name: { startsWith: TEST_PREFIX } } });
  console.log(`Leftover DailyReports: ${leftoverReports}`);
  console.log(`Leftover Sales: ${leftoverSales}`);
  console.log(`Leftover SaleItems: ${leftoverSaleItems}`);
  console.log(`Leftover Products: ${leftoverProducts}`);

  // Summary
  console.log('\n========== ReportService Summary ==========');
  for (const [fn, checks] of Object.entries(results)) {
    console.log(`\n${fn}:`);
    for (const [check, val] of Object.entries(checks)) {
      if (val === 'N/A') {
        console.log(`  ${check}: ➖ N/A`);
      } else if (Array.isArray(val)) {
        const allPass = val.every(v => v.passed === true);
        console.log(`  ${check}: ${allPass ? '✅ PASS' : '❌ FAIL'}`);
        val.forEach(v => console.log(`    - ${v.field || v.test}: ${v.passed ? '✅' : '❌'}`));
      } else if (val === true) {
        console.log(`  ${check}: ✅ PASS`);
      } else if (val === false) {
        console.log(`  ${check}: ❌ FAIL`);
      }
    }
  }

  await prisma.$disconnect();
  return results;
}

runTests().catch(async (e) => {
  console.error('Test runner crashed:', e);
  await cleanup();
  await prisma.$disconnect();
});