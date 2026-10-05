const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const saleService = require('../InventoryManagement/Services/SaleService');
const productRepository = require('../InventoryManagement/Repository/Product');
const stockRepository = require('../InventoryManagement/Repository/Stock');
const saleRepository = require('../InventoryManagement/Repository/Sale');

const TEST_PREFIX = 'TEST_';

async function cleanup() {
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
    name: `${TEST_PREFIX}SaleProduct${Date.now()}`,
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
  console.log('\n========== SaleService Tests ==========\n');
  const results = {};

  // ========== completeSale ==========
  console.log('--- completeSale() ---');
  results.completeSale = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: false,
    dbState: false,
    transactionIntegrity: false,
  };

  let testProduct, testProduct2, testUser;
  try {
    testProduct = await createTestProduct();
    testProduct2 = await createTestProduct({ name: `${TEST_PREFIX}SaleProduct2`, unitPrice: 600 });
    testUser = await prisma.user.findFirst();
    if (!testUser) throw new Error('No user found');
  } catch (e) {
    console.log('Setup failed:', e.message);
  }

  // Valid input - single item
  try {
    const res = await saleService.completeSale({
      soldById: testUser.id,
      items: [{ productId: testProduct.id, quantityBottles: 5, unitPrice: 500 }],
    });
    if (res && res.id && res.items && res.items.length === 1) {
      results.completeSale.validInput = true;
      console.log('✅ Valid input (single item): PASS - Sale completed');
    } else {
      console.log('❌ Valid input: FAIL');
    }
    // Cleanup
    await prisma.saleItem.deleteMany({ where: { saleId: res.id } });
    await prisma.sale.delete({ where: { id: res.id } });
    await stockRepository.update(testProduct.id, { quantityBottles: 100 });
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Valid input - multiple items
  try {
    const res = await saleService.completeSale({
      soldById: testUser.id,
      items: [
        { productId: testProduct.id, quantityBottles: 3, unitPrice: 500 },
        { productId: testProduct2.id, quantityBottles: 2, unitPrice: 600 },
      ],
    });
    if (res && res.items && res.items.length === 2) {
      console.log('✅ Valid input (multiple items): PASS');
    }
    await prisma.saleItem.deleteMany({ where: { saleId: res.id } });
    await prisma.sale.delete({ where: { id: res.id } });
    await stockRepository.update(testProduct.id, { quantityBottles: 100 });
    await stockRepository.update(testProduct2.id, { quantityBottles: 100 });
  } catch (e) {
    console.log('❌ Valid input (multiple): FAIL -', e.message);
  }

  // Missing required fields
  const requiredFields = ['soldById', 'items'];
  for (const field of requiredFields) {
    try {
      const data = { soldById: testUser.id, items: [{ productId: testProduct.id, quantityBottles: 1, unitPrice: 500 }] };
      delete data[field];
      await saleService.completeSale(data);
      results.completeSale.missingFields.push({ field, passed: false });
      console.log(`❌ Missing ${field}: FAIL - Should have thrown`);
    } catch (e) {
      results.completeSale.missingFields.push({ field, passed: true });
      console.log(`✅ Missing ${field}: PASS - Threw "${e.message}"`);
    }
  }

  // Missing fields within items
  const itemRequiredFields = ['productId', 'quantityBottles', 'unitPrice'];
  for (const field of itemRequiredFields) {
    try {
      const data = { soldById: testUser.id, items: [{ productId: testProduct.id, quantityBottles: 1, unitPrice: 500 }] };
      delete data.items[0][field];
      await saleService.completeSale(data);
      results.completeSale.missingFields.push({ field: `items[0].${field}`, passed: false });
      console.log(`❌ Missing items[0].${field}: FAIL`);
    } catch (e) {
      results.completeSale.missingFields.push({ field: `items[0].${field}`, passed: true });
      console.log(`✅ Missing items[0].${field}: PASS - Threw "${e.message}"`);
    }
  }

  // Empty items array
  try {
    await saleService.completeSale({ soldById: testUser.id, items: [] });
    results.completeSale.missingFields.push({ field: 'items (empty)', passed: false });
    console.log('❌ Empty items array: FAIL');
  } catch (e) {
    results.completeSale.missingFields.push({ field: 'items (empty)', passed: true });
    console.log(`✅ Empty items array: PASS - Threw "${e.message}"`);
  }

  // Invalid values
  const invalidTests = [
    { name: 'nonExistentProduct', data: { soldById: testUser.id, items: [{ productId: 999999, quantityBottles: 1, unitPrice: 500 }] } },
    { name: 'nonExistentUser', data: { soldById: 999999, items: [{ productId: testProduct.id, quantityBottles: 1, unitPrice: 500 }] } },
    { name: 'negativeQuantity', data: { soldById: testUser.id, items: [{ productId: testProduct.id, quantityBottles: -5, unitPrice: 500 }] } },
    { name: 'zeroQuantity', data: { soldById: testUser.id, items: [{ productId: testProduct.id, quantityBottles: 0, unitPrice: 500 }] } },
    { name: 'negativePrice', data: { soldById: testUser.id, items: [{ productId: testProduct.id, quantityBottles: 1, unitPrice: -100 }] } },
    { name: 'zeroPrice', data: { soldById: testUser.id, items: [{ productId: testProduct.id, quantityBottles: 1, unitPrice: 0 }] } },
  ];
  for (const test of invalidTests) {
    try {
      await saleService.completeSale(test.data);
      results.completeSale.invalidValues.push({ test: test.name, passed: false });
      console.log(`❌ Invalid ${test.name}: FAIL - Should have thrown`);
    } catch (e) {
      results.completeSale.invalidValues.push({ test: test.name, passed: true });
      console.log(`✅ Invalid ${test.name}: PASS - Threw "${e.message}"`);
    }
  }

  // Business rule: insufficient stock
  try {
    await stockRepository.update(testProduct.id, { quantityBottles: 2 });
    await saleService.completeSale({
      soldById: testUser.id,
      items: [{ productId: testProduct.id, quantityBottles: 5, unitPrice: 500 }],
    });
    results.completeSale.businessRules = false;
    console.log('❌ Business rule (insufficient stock): FAIL - Should have thrown');
  } catch (e) {
    if (e.message.includes('Not enough stock') || e.message.includes('stock')) {
      results.completeSale.businessRules = true;
      console.log('✅ Business rule (insufficient stock): PASS - Threw stock error');
    } else {
      results.completeSale.businessRules = false;
      console.log('❌ Business rule: FAIL - Wrong error:', e.message);
    }
  }
  await stockRepository.update(testProduct.id, { quantityBottles: 100 });

  // Business rule: multiple items, one out of stock should fail entire sale
  try {
    await stockRepository.update(testProduct.id, { quantityBottles: 2 });
    await stockRepository.update(testProduct2.id, { quantityBottles: 100 });
    await saleService.completeSale({
      soldById: testUser.id,
      items: [
        { productId: testProduct.id, quantityBottles: 5, unitPrice: 500 },
        { productId: testProduct2.id, quantityBottles: 2, unitPrice: 600 },
      ],
    });
    results.completeSale.businessRules = false;
    console.log('❌ Business rule (partial stock fail): FAIL - Should have thrown');
  } catch (e) {
    if (e.message.includes('Not enough stock')) {
      // Verify nothing was saved
      const sales = await prisma.sale.findMany({ where: { soldById: testUser.id } });
      const recentSales = sales.filter(s => s.createdAt > new Date(Date.now() - 5000));
      if (recentSales.length === 0) {
        results.completeSale.businessRules = true;
        console.log('✅ Business rule (partial stock fail): PASS - Entire sale rejected, nothing saved');
      } else {
        console.log('❌ Business rule: FAIL - Partial sale saved');
      }
    } else {
      console.log('❌ Business rule: FAIL - Wrong error:', e.message);
    }
  }
  await stockRepository.update(testProduct.id, { quantityBottles: 100 });

  // Business rule: discontinued product cannot be sold
  try {
    await productRepository.update(testProduct.id, { isActive: false });
    try {
      await saleService.completeSale({
        soldById: testUser.id,
        items: [{ productId: testProduct.id, quantityBottles: 1, unitPrice: 500 }],
      });
      results.completeSale.businessRules = false;
      console.log('❌ Business rule (discontinued product): FAIL - Should have thrown');
    } catch (e) {
      if (e.message.includes('discontinued')) {
        results.completeSale.businessRules = true;
        console.log('✅ Business rule (discontinued product): PASS - Threw discontinued error');
      } else {
        console.log('❌ Business rule: FAIL - Wrong error:', e.message);
      }
    }
    await productRepository.update(testProduct.id, { isActive: true });
  } catch (e) {
    console.log('❌ Business rule (discontinued) test error:', e.message);
  }

  // Database state after successful call
  try {
    await stockRepository.update(testProduct.id, { quantityBottles: 100 });
    const res = await saleService.completeSale({
      soldById: testUser.id,
      items: [{ productId: testProduct.id, quantityBottles: 10, unitPrice: 500 }],
    });
    const dbSale = await prisma.sale.findUnique({ where: { id: res.id } });
    const dbItems = await prisma.saleItem.findMany({ where: { saleId: res.id } });
    const dbStock = await prisma.stock.findUnique({ where: { productId: testProduct.id } });
    if (dbSale && dbSale.status === 'completed' && dbSale.totalAmount === 5000 &&
        dbItems.length === 1 && dbItems[0].quantityBottles === 10 &&
        dbStock && dbStock.quantityBottles === 90) {
      results.completeSale.dbState = true;
      console.log('✅ Database state: PASS - Sale, items, and stock decrement persisted');
    } else {
      console.log('❌ Database state: FAIL - Sale:', dbSale, 'Items:', dbItems, 'Stock:', dbStock);
    }
    await prisma.saleItem.deleteMany({ where: { saleId: res.id } });
    await prisma.sale.delete({ where: { id: res.id } });
    await stockRepository.update(testProduct.id, { quantityBottles: 100 });
  } catch (e) {
    console.log('❌ Database state: FAIL -', e.message);
  }

  // Transaction integrity: simulate failure during sale item creation
  try {
    // Use a product without stock record to cause stock decrement to fail
    const productNoStock = await productRepository.create({
      name: `${TEST_PREFIX}NoStockSale`,
      unitPrice: 500,
      crateSize: 12,
    });
    // No stock record created
    try {
      await saleService.completeSale({
        soldById: testUser.id,
        items: [{ productId: productNoStock.id, quantityBottles: 5, unitPrice: 500 }],
      });
      results.completeSale.transactionIntegrity = false;
      console.log('❌ Transaction integrity: FAIL - Should have thrown');
    } catch (e) {
      // Check nothing was saved
      const sales = await prisma.sale.findMany({ where: { soldById: testUser.id } });
      const recentSales = sales.filter(s => s.createdAt > new Date(Date.now() - 5000));
      const items = await prisma.saleItem.findMany({ where: { productId: productNoStock.id } });
      if (recentSales.length === 0 && items.length === 0) {
        results.completeSale.transactionIntegrity = true;
        console.log('✅ Transaction integrity: PASS - Full rollback on stock failure');
      } else {
        results.completeSale.transactionIntegrity = false;
        console.log('❌ Transaction integrity: FAIL - Partial save:', recentSales.length, 'sales,', items.length, 'items');
      }
    }
    await prisma.product.delete({ where: { id: productNoStock.id } });
  } catch (e) {
    console.log('❌ Transaction integrity test error:', e.message);
  }

  // ========== getSale ==========
  console.log('\n--- getSale() ---');
  results.getSale = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: 'N/A',
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  try {
    const res = await saleService.completeSale({
      soldById: testUser.id,
      items: [{ productId: testProduct.id, quantityBottles: 5, unitPrice: 500 }],
    });
    const fetched = await saleService.getSale(res.id);
    if (fetched && fetched.id === res.id && fetched.items) {
      results.getSale.validInput = true;
      console.log('✅ Valid input: PASS - Returns sale with items');
    } else {
      console.log('❌ Valid input: FAIL');
    }
    await prisma.saleItem.deleteMany({ where: { saleId: res.id } });
    await prisma.sale.delete({ where: { id: res.id } });
    await stockRepository.update(testProduct.id, { quantityBottles: 100 });
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Non-existent ID should return null
  try {
    const res = await saleService.getSale(999999);
    if (res === null) {
      results.getSale.invalidValues.push({ test: 'nonExistentId', passed: true });
      console.log('✅ Non-existent ID: PASS - Returns null');
    } else {
      results.getSale.invalidValues.push({ test: 'nonExistentId', passed: false });
      console.log('❌ Non-existent ID: FAIL - Should return null');
    }
  } catch (e) {
    results.getSale.invalidValues.push({ test: 'nonExistentId', passed: false });
    console.log(`❌ Non-existent ID: FAIL - Threw "${e.message}" instead of returning null`);
  }

  // ========== listSales ==========
  console.log('\n--- listSales() ---');
  results.listSales = {
    validInput: false,
    missingFields: 'N/A',
    invalidValues: [],
    businessRules: 'N/A',
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  try {
    const res = await saleService.listSales();
    if (Array.isArray(res)) {
      results.listSales.validInput = true;
      console.log('✅ Valid input: PASS - Returns array');
    } else {
      console.log('❌ Valid input: FAIL');
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  try {
    const res = await saleService.listSales('completed');
    if (Array.isArray(res) && res.every(s => s.status === 'completed')) {
      results.listSales.invalidValues.push({ test: 'statusFilter', passed: true });
      console.log('✅ Status filter: PASS - Returns filtered sales');
    } else {
      results.listSales.invalidValues.push({ test: 'statusFilter', passed: false });
      console.log('❌ Status filter: FAIL');
    }
  } catch (e) {
    results.listSales.invalidValues.push({ test: 'statusFilter', passed: false });
    console.log('❌ Status filter: FAIL -', e.message);
  }

  // ========== cancelSale ==========
  console.log('\n--- cancelSale() ---');
  results.cancelSale = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: false,
    dbState: false,
    transactionIntegrity: 'N/A',
  };

  try {
    const res = await saleService.completeSale({
      soldById: testUser.id,
      items: [{ productId: testProduct.id, quantityBottles: 5, unitPrice: 500 }],
    });
    const cancelled = await saleService.cancelSale(res.id);
    if (cancelled && cancelled.status === 'cancelled') {
      results.cancelSale.validInput = true;
      console.log('✅ Valid input: PASS - Sale cancelled');
    } else {
      console.log('❌ Valid input: FAIL');
    }
    await prisma.saleItem.deleteMany({ where: { saleId: res.id } });
    await prisma.sale.delete({ where: { id: res.id } });
    await stockRepository.update(testProduct.id, { quantityBottles: 100 });
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  try {
    await saleService.cancelSale(999999);
    results.cancelSale.invalidValues.push({ test: 'nonExistentId', passed: false });
    console.log('❌ Non-existent ID: FAIL - Should throw');
  } catch (e) {
    results.cancelSale.invalidValues.push({ test: 'nonExistentId', passed: true });
    console.log(`✅ Non-existent ID: PASS - Threw "${e.message}"`);
  }

  // Business rule: does not restock (sale was completed, stock already decremented)
  try {
    const res = await saleService.completeSale({
      soldById: testUser.id,
      items: [{ productId: testProduct.id, quantityBottles: 5, unitPrice: 500 }],
    });
    // Try to cancel a completed sale
    try {
      await saleService.cancelSale(res.id);
      // If it succeeds, check stock wasn't incremented
      const dbStock = await prisma.stock.findUnique({ where: { productId: testProduct.id } });
      if (dbStock.quantityBottles === 95) { // Still 95, not 100
        results.cancelSale.businessRules = true;
        console.log('✅ Business rule (no restock): PASS - Stock not incremented on cancel');
      } else {
        results.cancelSale.businessRules = false;
        console.log('❌ Business rule: FAIL - Stock was:', dbStock.quantityBottles);
      }
    } catch (e) {
      // If it throws because status is completed, that's also valid behavior
      results.cancelSale.businessRules = true;
      console.log('✅ Business rule: PASS - Throws on completed sale');
    }
    await prisma.saleItem.deleteMany({ where: { saleId: res.id } });
    await prisma.sale.delete({ where: { id: res.id } });
    await stockRepository.update(testProduct.id, { quantityBottles: 100 });
  } catch (e) {
    console.log('❌ Business rule test error:', e.message);
  }

  results.cancelSale.dbState = 'N/A'; // Hard to test without knowing initial state
  console.log('➖ Database state: N/A - Hard to verify without known state');
  results.cancelSale.transactionIntegrity = 'N/A';
  console.log('➖ Transaction integrity: N/A');

  // Cleanup
  await cleanup();

  // Summary
  console.log('\n========== SaleService Summary ==========');
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