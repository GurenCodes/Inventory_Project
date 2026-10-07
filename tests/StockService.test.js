const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const stockService = require('../InventoryManagement/Services/StockService');
const productRepository = require('../InventoryManagement/Repository/Product');
const stockRepository = require('../InventoryManagement/Repository/Stock');
const itemBatchOrderRepository = require('../InventoryManagement/Repository/ItemBatchOrder');
const { ValidationError, NotFoundError } = require('../errors');

const TEST_PREFIX = 'TEST_';

async function cleanup() {
  const testBatchOrders = await prisma.itemBatchOrder.findMany({
    where: { product: { name: { startsWith: TEST_PREFIX } } },
    select: { id: true, productId: true },
  });
  for (const b of testBatchOrders) {
    await prisma.itemBatchOrder.delete({ where: { id: b.id } });
  }
  const testProducts = await prisma.product.findMany({
    where: { name: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });
  for (const p of testProducts) {
    await prisma.stock.deleteMany({ where: { productId: p.id } });
    await prisma.saleItem.deleteMany({ where: { productId: p.id } });
    await prisma.product.delete({ where: { id: p.id } });
  }
}

async function createTestProduct() {
  return productRepository.create({
    name: `${TEST_PREFIX}StockProduct${Date.now()}`,
    category: 'Beer',
    unitPrice: 500,
    crateSize: 12,
  });
}

async function runTests() {
  console.log('\n========== StockService Tests ==========\n');
  const results = {};

  // ========== receiveBatchOrder ==========
  console.log('--- receiveBatchOrder() ---');
  results.receiveBatchOrder = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: false,
    dbState: false,
    transactionIntegrity: false,
  };

  let testProduct, testUser;
  try {
    testProduct = await createTestProduct();
    await stockRepository.create({ productId: testProduct.id, quantityBottles: 0, quantityCrates: 0, reorderLevel: 10 });
    testUser = await prisma.user.findFirst();
    if (!testUser) throw new Error('No user found');
  } catch (e) {
    console.log('Setup failed:', e.message);
  }

  // Valid input
  try {
    const res = await stockService.receiveBatchOrder({
      productId: testProduct.id,
      receivedById: testUser.id,
      crateCount: 2,
      bottleCount: 6,
      costPerUnit: 400,
      expiryDate: new Date('2027-12-31'),
    });
    if (res.batchOrder && res.updatedStock) {
      results.receiveBatchOrder.validInput = true;
      console.log('✅ Valid input: PASS - Batch order created, stock updated');
    } else {
      console.log('❌ Valid input: FAIL');
    }
    // Cleanup
    await prisma.itemBatchOrder.delete({ where: { id: res.batchOrder.id } });
    await stockRepository.update(res.updatedStock.id, { quantityBottles: 0, quantityCrates: 0 });
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Missing required fields
  const requiredFields = ['productId', 'receivedById', 'costPerUnit'];
  for (const field of requiredFields) {
    try {
      const data = {
        productId: testProduct.id,
        receivedById: testUser.id,
        crateCount: 1,
        bottleCount: 0,
        costPerUnit: 400,
      };
      delete data[field];
      await stockService.receiveBatchOrder(data);
      results.receiveBatchOrder.missingFields.push({ field, passed: false });
      console.log(`❌ Missing ${field}: FAIL - Should have thrown`);
    } catch (e) {
      results.receiveBatchOrder.missingFields.push({ field, passed: true });
      console.log(`✅ Missing ${field}: PASS - Threw "${e.message}"`);
    }
  }

  // Invalid values
  const invalidTests = [
    { name: 'nonExistentProduct', data: { productId: 999999, receivedById: testUser.id, crateCount: 1, bottleCount: 0, costPerUnit: 400 }, expectedError: 'Product 999999 does not exist' },
    { name: 'nonExistentUser', data: { productId: testProduct.id, receivedById: 999999, crateCount: 1, bottleCount: 0, costPerUnit: 400 }, expectedError: 'User 999999 does not exist' },
    { name: 'negativeCrateCount', data: { productId: testProduct.id, receivedById: testUser.id, crateCount: -1, bottleCount: 0, costPerUnit: 400 }, expectedError: 'Crate count must be a non-negative number' },
    { name: 'negativeBottleCount', data: { productId: testProduct.id, receivedById: testUser.id, crateCount: 0, bottleCount: -5, costPerUnit: 400 }, expectedError: 'Bottle count must be a non-negative number' },
    { name: 'negativeCost', data: { productId: testProduct.id, receivedById: testUser.id, crateCount: 1, bottleCount: 0, costPerUnit: -100 }, expectedError: 'Cost per unit must be a positive number' },
    { name: 'zeroCost', data: { productId: testProduct.id, receivedById: testUser.id, crateCount: 1, bottleCount: 0, costPerUnit: 0 }, expectedError: 'Cost per unit must be a positive number' },
  ];
  for (const test of invalidTests) {
    try {
      await stockService.receiveBatchOrder(test.data);
      results.receiveBatchOrder.invalidValues.push({ test: test.name, passed: false });
      console.log(`❌ Invalid ${test.name}: FAIL - Should have thrown`);
    } catch (e) {
      const errorMsg = e.message || String(e);
      if (errorMsg.includes(test.expectedError)) {
        results.receiveBatchOrder.invalidValues.push({ test: test.name, passed: true });
        console.log(`✅ Invalid ${test.name}: PASS - Threw expected error: "${errorMsg}"`);
      } else {
        results.receiveBatchOrder.invalidValues.push({ test: test.name, passed: false });
        console.log(`❌ Invalid ${test.name}: FAIL - Wrong error. Expected "${test.expectedError}", got "${errorMsg}"`);
      }
    }
  }

  // Business rule: crate to bottle conversion using product's crateSize
  try {
    const productWithCrate24 = await productRepository.create({
      name: `${TEST_PREFIX}Crate24`,
      unitPrice: 500,
      crateSize: 24,
    });
    await stockRepository.create({ productId: productWithCrate24.id, quantityBottles: 0, quantityCrates: 0, reorderLevel: 10 });
    const res = await stockService.receiveBatchOrder({
      productId: productWithCrate24.id,
      receivedById: testUser.id,
      crateCount: 2,
      bottleCount: 0,
      costPerUnit: 400,
    });
    const stock = await stockRepository.findByProductId(productWithCrate24.id);
    if (stock && stock.quantityBottles === 48 && stock.quantityCrates === 2) {
      results.receiveBatchOrder.businessRules = true;
      console.log('✅ Business rule (crate conversion): PASS - 2 crates × 24 = 48 bottles');
    } else {
      console.log('❌ Business rule: FAIL - Expected 48 bottles, got', stock?.quantityBottles);
    }
    await prisma.itemBatchOrder.delete({ where: { id: res.batchOrder.id } });
    await prisma.stock.delete({ where: { productId: productWithCrate24.id } });
    await prisma.product.delete({ where: { id: productWithCrate24.id } });
  } catch (e) {
    console.log('❌ Business rule: FAIL -', e.message);
  }

  // Database state after call
  try {
    // Recreate test product with stock
    testProduct = await createTestProduct();
    await stockRepository.create({ productId: testProduct.id, quantityBottles: 0, quantityCrates: 0, reorderLevel: 10 });
    
    const res = await stockService.receiveBatchOrder({
      productId: testProduct.id,
      receivedById: testUser.id,
      crateCount: 3,
      bottleCount: 5,
      costPerUnit: 400,
    });
    const dbStock = await prisma.stock.findUnique({ where: { productId: testProduct.id } });
    const dbBatch = await prisma.itemBatchOrder.findUnique({ where: { id: res.batchOrder.id } });
    const expectedBottles = 3 * 12 + 5; // 3 crates * 12 + 5 bottles = 41
    if (dbStock && dbStock.quantityBottles === expectedBottles && dbStock.quantityCrates === 3 && dbBatch) {
      results.receiveBatchOrder.dbState = true;
      console.log('✅ Database state: PASS - Stock and batch order persisted correctly');
    } else {
      console.log('❌ Database state: FAIL - Stock:', dbStock, 'Batch:', dbBatch);
    }
    await prisma.itemBatchOrder.delete({ where: { id: res.batchOrder.id } });
    await stockRepository.update(res.updatedStock.id, { quantityBottles: 0, quantityCrates: 0 });
  } catch (e) {
    console.log('❌ Database state: FAIL -', e.message);
  }

  // Transaction integrity: simulate failure in one part
  try {
    // Use a product without stock to cause stock update to fail
    const productNoStock = await productRepository.create({
      name: `${TEST_PREFIX}NoStock`,
      unitPrice: 500,
      crateSize: 12,
    });
    // Don't create stock record
    try {
      await stockService.receiveBatchOrder({
        productId: productNoStock.id,
        receivedById: testUser.id,
        crateCount: 1,
        bottleCount: 0,
        costPerUnit: 400,
      });
      results.receiveBatchOrder.transactionIntegrity = false;
      console.log('❌ Transaction integrity: FAIL - Should have rolled back');
    } catch (e) {
      // Check that neither batch order nor stock was created
      const batchOrders = await prisma.itemBatchOrder.findMany({ where: { productId: productNoStock.id } });
      const stock = await prisma.stock.findUnique({ where: { productId: productNoStock.id } });
      if (batchOrders.length === 0 && !stock) {
        results.receiveBatchOrder.transactionIntegrity = true;
        console.log('✅ Transaction integrity: PASS - Both rolled back on stock update failure');
      } else {
        results.receiveBatchOrder.transactionIntegrity = false;
        console.log('❌ Transaction integrity: FAIL - Partial save detected');
      }
    }
    await prisma.product.delete({ where: { id: productNoStock.id } });
  } catch (e) {
    console.log('❌ Transaction integrity test error:', e.message);
  }

  // ========== getStockForProduct ==========
  console.log('\n--- getStockForProduct() ---');
  results.getStockForProduct = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: 'N/A',
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  try {
    testProduct = await createTestProduct();
    await stockRepository.create({ productId: testProduct.id, quantityBottles: 50, quantityCrates: 2, reorderLevel: 10 });
    const res = await stockService.getStockForProduct(testProduct.id);
    if (res && res.productId === testProduct.id) {
      results.getStockForProduct.validInput = true;
      console.log('✅ Valid input: PASS - Returns stock');
    } else {
      console.log('❌ Valid input: FAIL');
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Non-existent product should return null
  try {
    const res = await stockService.getStockForProduct(999999);
    if (res === null) {
      results.getStockForProduct.invalidValues.push({ test: 'nonExistentProduct', passed: true });
      console.log('✅ Non-existent product: PASS - Returns null');
    } else {
      results.getStockForProduct.invalidValues.push({ test: 'nonExistentProduct', passed: false });
      console.log('❌ Non-existent product: FAIL - Should return null');
    }
  } catch (e) {
    results.getStockForProduct.invalidValues.push({ test: 'nonExistentProduct', passed: false });
    console.log(`❌ Non-existent product: FAIL - Threw "${e.message}" instead of returning null`);
  }

  // ========== listLowStock ==========
  console.log('\n--- listLowStock() ---');
  results.listLowStock = {
    validInput: false,
    missingFields: 'N/A',
    invalidValues: 'N/A',
    businessRules: false,
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  try {
    const res = await stockService.listLowStock();
    if (Array.isArray(res)) {
      results.listLowStock.validInput = true;
      console.log('✅ Valid input: PASS - Returns array');
    } else {
      console.log('❌ Valid input: FAIL');
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Business rule: only returns products where quantityBottles <= reorderLevel
  try {
    const lowStockProd = await productRepository.create({ name: `${TEST_PREFIX}LowStock`, unitPrice: 500, crateSize: 12 });
    await stockRepository.create({ productId: lowStockProd.id, quantityBottles: 5, quantityCrates: 0, reorderLevel: 10 });
    const highStockProd = await productRepository.create({ name: `${TEST_PREFIX}HighStock`, unitPrice: 500, crateSize: 12 });
    await stockRepository.create({ productId: highStockProd.id, quantityBottles: 100, quantityCrates: 0, reorderLevel: 10 });
    const res = await stockService.listLowStock();
    const hasLow = res.some(s => s.productId === lowStockProd.id);
    const hasHigh = res.some(s => s.productId === highStockProd.id);
    if (hasLow && !hasHigh) {
      results.listLowStock.businessRules = true;
      console.log('✅ Business rule: PASS - Only low stock products returned');
    } else {
      console.log('❌ Business rule: FAIL - Low:', hasLow, 'High:', hasHigh);
    }
    await prisma.stock.delete({ where: { productId: lowStockProd.id } });
    await prisma.product.delete({ where: { id: lowStockProd.id } });
    await prisma.stock.delete({ where: { productId: highStockProd.id } });
    await prisma.product.delete({ where: { id: highStockProd.id } });
  } catch (e) {
    console.log('❌ Business rule test error:', e.message);
  }

  // ========== adjustReorderLevel ==========
  console.log('\n--- adjustReorderLevel() ---');
  results.adjustReorderLevel = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: 'N/A',
    dbState: false,
    transactionIntegrity: 'N/A',
  };

  try {
    testProduct = await createTestProduct();
    await stockRepository.create({ productId: testProduct.id, quantityBottles: 50, quantityCrates: 2, reorderLevel: 10 });
    const res = await stockService.adjustReorderLevel(testProduct.id, 25);
    if (res && res.reorderLevel === 25) {
      results.adjustReorderLevel.validInput = true;
      console.log('✅ Valid input: PASS - Reorder level updated');
    } else {
      console.log('❌ Valid input: FAIL');
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  try {
    await stockService.adjustReorderLevel(999999, 10);
    results.adjustReorderLevel.invalidValues.push({ test: 'nonExistentProduct', passed: false });
    console.log('❌ Non-existent product: FAIL - Should throw');
  } catch (e) {
    results.adjustReorderLevel.invalidValues.push({ test: 'nonExistentProduct', passed: true });
    console.log(`✅ Non-existent product: PASS - Threw "${e.message}"`);
  }

  try {
    await stockService.adjustReorderLevel(testProduct.id, -5);
    results.adjustReorderLevel.invalidValues.push({ test: 'negativeLevel', passed: false });
    console.log('❌ Negative reorder level: FAIL - Should throw or reject');
  } catch (e) {
    results.adjustReorderLevel.invalidValues.push({ test: 'negativeLevel', passed: true });
    console.log(`✅ Negative reorder level: PASS - Threw "${e.message}"`);
  }

  try {
    const dbStock = await prisma.stock.findUnique({ where: { productId: testProduct.id } });
    if (dbStock && dbStock.reorderLevel === 25) {
      results.adjustReorderLevel.dbState = true;
      console.log('✅ Database state: PASS - Reorder level persisted');
    } else {
      console.log('❌ Database state: FAIL');
    }
  } catch (e) {
    console.log('❌ Database state: FAIL -', e.message);
  }

  results.adjustReorderLevel.transactionIntegrity = 'N/A';
  console.log('➖ Transaction integrity: N/A');

  // Cleanup
  await cleanup();

  // Summary
  console.log('\n========== StockService Summary ==========');
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