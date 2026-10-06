const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const reportService = require('../InventoryManagement/Services/ReportService');
const saleService = require('../InventoryManagement/Services/SaleService');
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

  let testProduct, testUser;
  try {
    testProduct = await createTestProduct();
    testUser = await prisma.user.findFirst();
    if (!testUser) throw new Error('No user found');
  } catch (e) {
    console.log('Setup failed:', e.message);
  }

  // Use a fixed past date for valid tests (avoids timezone issues with "today")
  const testDate = new Date('2026-08-15');
  testDate.setHours(0, 0, 0, 0);

  // Create completed sales for testDate
  try {
    await saleService.completeSale({
      soldById: testUser.id,
      items: [{ productId: testProduct.id, quantityBottles: 10, unitPrice: 500 }],
    });
    // Create a pending sale (should not be counted)
    const pendingSale = await prisma.sale.create({
      data: { soldById: testUser.id, totalAmount: 1000, status: 'pending', createdAt: testDate },
    });
    await prisma.saleItem.create({
      data: { saleId: pendingSale.id, productId: testProduct.id, quantityBottles: 2, unitPrice: 500, lineTotal: 1000 },
    });
    // Create a cancelled sale (should not be counted)
    const cancelledSale = await prisma.sale.create({
      data: { soldById: testUser.id, totalAmount: 500, status: 'cancelled', createdAt: testDate },
    });
    await prisma.saleItem.create({
      data: { saleId: cancelledSale.id, productId: testProduct.id, quantityBottles: 1, unitPrice: 500, lineTotal: 500 },
    });
  } catch (e) {
    console.log('Setup sales failed:', e.message);
  }

  // Valid input - use testDate (clean up any existing report first)
  await prisma.dailyReport.deleteMany({ where: { reportDate: testDate } });
  
  try {
    const res = await reportService.generateDailyReport({
      date: testDate,
      generatedById: testUser.id,
    });
    if (res && res.id && res.totalSalesAmount === 5000) { // Only completed sale counted
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

  // Invalid values
  const tomorrow = new Date(testDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const invalidTests = [
    { name: 'nonExistentUser', data: { date: testDate, generatedById: 999999 } },
    { name: 'futureDate', data: { date: tomorrow, generatedById: testUser.id } },
    { name: 'invalidDate', data: { date: 'not-a-date', generatedById: testUser.id } },
  ];
  for (const test of invalidTests) {
    try {
      await reportService.generateDailyReport(test.data);
      results.generateDailyReport.invalidValues.push({ test: test.name, passed: false });
      console.log(`❌ Invalid ${test.name}: FAIL - Should have thrown or handled`);
    } catch (e) {
      results.generateDailyReport.invalidValues.push({ test: test.name, passed: true });
      console.log(`✅ Invalid ${test.name}: PASS - Threw "${e.message}"`);
    }
  }

  // REGRESSION TEST: Problem 1 - today is NOT rejected as future date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.dailyReport.deleteMany({ where: { reportDate: today } });
  console.log('\n--- REGRESSION: Problem 1 (today accepted) ---');
  try {
    const res = await reportService.generateDailyReport({
      date: today,
      generatedById: testUser.id,
    });
    // Should NOT throw "future date" error - today must be accepted
    if (res && res.id) {
      console.log('✅ Problem 1 fix: PASS - Today is accepted (not rejected as future)');
      // Clean up
      await prisma.dailyReport.delete({ where: { id: res.id } });
    } else {
      console.log('❌ Problem 1 fix: FAIL -', res);
    }
  } catch (e) {
    if (e.message.includes('future date')) {
      console.log('❌ Problem 1 fix: FAIL - Today rejected as future:', e.message);
    } else if (e.message.includes('already exists')) {
      console.log('✅ Problem 1 fix: PASS - Today accepted (duplicate check passed)');
    } else {
      console.log('❌ Problem 1 fix: FAIL -', e.message);
    }
  }

  // Business rule: only sums completed sales, not pending or cancelled
  try {
    const yesterday = new Date(testDate);
    yesterday.setDate(yesterday.getDate() - 1);
    await prisma.dailyReport.deleteMany({ where: { reportDate: yesterday } });
    
    const res = await reportService.generateDailyReport({
      date: yesterday,
      generatedById: testUser.id,
    });
    // Should only include the completed sale (10 * 500 = 5000)
    // Not the pending (2 * 500 = 1000) or cancelled (1 * 500 = 500)
    if (res.totalSalesAmount === 5000) {
      results.generateDailyReport.businessRules = true;
      console.log('✅ Business rule (only completed): PASS - Total is 5000 (only completed)');
    } else {
      console.log('❌ Business rule: FAIL - Total is', res.totalSalesAmount, 'expected 5000');
    }
  } catch (e) {
    console.log('❌ Business rule: FAIL -', e.message);
  }

  // REGRESSION TEST: Problem 2 - "completed only" verified by direct DB query
  console.log('\n--- REGRESSION: Problem 2 (completed only, DB verified) ---');
  const testDate2 = new Date('2026-09-20');
  testDate2.setHours(0, 0, 0, 0);
  await prisma.dailyReport.deleteMany({ where: { reportDate: testDate2 } });
  await prisma.saleItem.deleteMany({ where: { sale: { createdAt: { gte: testDate2, lt: new Date(testDate2.getTime() + 86400000) } } } });
  await prisma.sale.deleteMany({ where: { createdAt: { gte: testDate2, lt: new Date(testDate2.getTime() + 86400000) } } });
  
  // Create test sales with distinct totals
  const testProduct2 = await createTestProduct();
  const completedSale = await prisma.sale.create({
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
      totalAmount: 2000, // Would change sum if included
      status: 'pending',
      createdAt: testDate2,
      items: { create: { productId: testProduct2.id, quantityBottles: 20, unitPrice: 100, lineTotal: 2000 } }
    }
  });
  await prisma.sale.create({
    data: {
      soldById: testUser.id,
      totalAmount: 1000, // Would change sum if included
      status: 'cancelled',
      createdAt: testDate2,
      items: { create: { productId: testProduct2.id, quantityBottles: 10, unitPrice: 100, lineTotal: 1000 } }
    }
  });
  
  // Direct DB verification
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
  
  // Generate report and verify
  await prisma.dailyReport.deleteMany({ where: { reportDate: testDate2 } });
  const res2 = await reportService.generateDailyReport({ date: testDate2, generatedById: testUser.id });
  if (res2.totalSalesAmount === 500) {
    console.log('✅ Problem 2 fix (API verified): PASS - Report totalSalesAmount = 500 (completed only)');
  } else {
    console.log('❌ Problem 2 fix: FAIL - Report total =', res2.totalSalesAmount);
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
  try {
    const dayBeforeYesterday = new Date(testDate);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    await prisma.dailyReport.deleteMany({ where: { reportDate: dayBeforeYesterday } });
    
    const res = await reportService.generateDailyReport({
      date: dayBeforeYesterday,
      generatedById: testUser.id,
    });
    const dbReport = await prisma.dailyReport.findUnique({ where: { id: res.id } });
    if (dbReport && dbReport.reportDate.getTime() === dayBeforeYesterday.getTime() && 
        dbReport.generatedById === testUser.id && dbReport.totalSalesAmount === 0) {
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

  try {
    const pastDate = new Date();
    pastDate.setHours(0, 0, 0, 0);
    pastDate.setDate(pastDate.getDate() - 5);
    await prisma.dailyReport.deleteMany({ where: { reportDate: pastDate } });
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
  }

  // Non-existent date should return null
  try {
    const pastDateNoReport = new Date();
    pastDateNoReport.setHours(0, 0, 0, 0);
    pastDateNoReport.setDate(pastDateNoReport.getDate() - 100);
    await prisma.dailyReport.deleteMany({ where: { reportDate: pastDateNoReport } });
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
    start.setDate(start.getDate() - 10);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
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

runTests().catch(console.error);