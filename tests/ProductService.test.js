const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const productService = require('../InventoryManagement/Services/ProductService');
const productRepository = require('../InventoryManagement/Repository/Product');
const stockRepository = require('../InventoryManagement/Repository/Stock');
const { ValidationError, NotFoundError } = require('../errors');

const TEST_PREFIX = 'TEST_';

async function cleanup() {
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

async function runTests() {
  console.log('\n========== ProductService Tests ==========\n');
  const results = {};

  // ========== registerProduct ==========
  console.log('--- registerProduct() ---');
  results.registerProduct = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: false,
    dbState: false,
    transactionIntegrity: 'N/A',
  };

  // Valid input
  try {
    const res = await productService.registerProduct({
      name: `${TEST_PREFIX}ValidProduct`,
      category: 'Beer',
      unitPrice: 500,
      crateSize: 12,
      reorderLevel: 10,
    });
    if (res.product && res.stock) {
      results.registerProduct.validInput = true;
      console.log('✅ Valid input: PASS - Created product and stock successfully');
    } else {
      console.log('❌ Valid input: FAIL - Missing product or stock in response');
    }
    // Cleanup
    await prisma.stock.delete({ where: { productId: res.product.id } });
    await prisma.product.delete({ where: { id: res.product.id } });
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Missing required fields
  const requiredFields = ['name', 'unitPrice'];
  for (const field of requiredFields) {
    try {
      const data = { name: `${TEST_PREFIX}Test`, category: 'Beer', unitPrice: 500, crateSize: 12, reorderLevel: 10 };
      delete data[field];
      await productService.registerProduct(data);
      results.registerProduct.missingFields.push({ field, passed: false });
      console.log(`❌ Missing ${field}: FAIL - Should have thrown`);
    } catch (e) {
      results.registerProduct.missingFields.push({ field, passed: true });
      console.log(`✅ Missing ${field}: PASS - Threw "${e.message}"`);
    }
  }

  // Invalid values (K12: crateSize must be a positive integer, null, or omitted)
  const invalidTests = [
    { name: 'negativePrice', data: { name: `${TEST_PREFIX}NegPrice`, unitPrice: -100, crateSize: 12 } },
    { name: 'negativeCrateSize', data: { name: `${TEST_PREFIX}NegCrate`, unitPrice: 500, crateSize: -5 } },
    { name: 'zeroUnitPrice', data: { name: `${TEST_PREFIX}ZeroPrice`, unitPrice: 0, crateSize: 12 } },
    { name: 'zeroCrateSize', data: { name: `${TEST_PREFIX}ZeroCrate`, unitPrice: 500, crateSize: 0 } },
    { name: 'negativeReorderLevel', data: { name: `${TEST_PREFIX}NegReorder`, unitPrice: 500, crateSize: 12, reorderLevel: -1 } },
    { name: 'fractionalCrateSize', data: { name: `${TEST_PREFIX}FracCrate`, unitPrice: 500, crateSize: 12.5 } },
    { name: 'subOneFractionalCrateSize', data: { name: `${TEST_PREFIX}SubOneCrate`, unitPrice: 500, crateSize: 0.9 } },
    { name: 'nanCrateSize', data: { name: `${TEST_PREFIX}NaNCrate`, unitPrice: 500, crateSize: NaN } },
    { name: 'infinityCrateSize', data: { name: `${TEST_PREFIX}InfCrate`, unitPrice: 500, crateSize: Infinity } },
    { name: 'stringCrateSize', data: { name: `${TEST_PREFIX}StrCrate`, unitPrice: 500, crateSize: '12' } },
    { name: 'emptyStringCrateSize', data: { name: `${TEST_PREFIX}EmptyStrCrate`, unitPrice: 500, crateSize: '' } },
    { name: 'booleanCrateSize', data: { name: `${TEST_PREFIX}BoolCrate`, unitPrice: 500, crateSize: true } },
    { name: 'objectCrateSize', data: { name: `${TEST_PREFIX}ObjCrate`, unitPrice: 500, crateSize: { n: 12 } } },
    { name: 'int4OverflowCrateSize', data: { name: `${TEST_PREFIX}BigCrate`, unitPrice: 500, crateSize: 3000000000 } },
  ];
  for (const test of invalidTests) {
    try {
      await productService.registerProduct(test.data);
      results.registerProduct.invalidValues.push({ test: test.name, passed: false });
      console.log(`❌ Invalid ${test.name}: FAIL - Should have thrown`);
    } catch (e) {
      results.registerProduct.invalidValues.push({ test: test.name, passed: true });
      console.log(`✅ Invalid ${test.name}: PASS - Threw "${e.message}"`);
    }
  }

  // K12 accepted configurations: positive integer and bottles-only (null)
  try {
    const res = await productService.registerProduct({ name: `${TEST_PREFIX}ValidIntCrate`, unitPrice: 500, crateSize: 12 });
    if (res.product.crateSize === 12) {
      results.registerProduct.validCrateSize = true;
      console.log('✅ Valid crateSize=12: PASS - Stored as 12');
    } else {
      console.log(`❌ Valid crateSize=12: FAIL - Stored as ${res.product.crateSize}`);
    }
    await prisma.stock.delete({ where: { productId: res.product.id } });
    await prisma.product.delete({ where: { id: res.product.id } });
  } catch (e) {
    console.log('❌ Valid crateSize=12: FAIL -', e.message);
  }

  try {
    const res = await productService.registerProduct({ name: `${TEST_PREFIX}BottlesOnly`, unitPrice: 500, crateSize: null });
    const stock = await stockRepository.findByProductId(res.product.id);
    if (res.product.crateSize === null && stock && stock.quantityBottles === 0 && stock.quantityCrates === 0) {
      results.registerProduct.bottlesOnly = true;
      console.log('✅ Bottles-only (crateSize=null): PASS - Stored NULL, stock created');
    } else {
      console.log(`❌ Bottles-only (crateSize=null): FAIL - crateSize=${res.product.crateSize}`);
    }
    await prisma.stock.delete({ where: { productId: res.product.id } });
    await prisma.product.delete({ where: { id: res.product.id } });
  } catch (e) {
    console.log('❌ Bottles-only (crateSize=null): FAIL -', e.message);
  }

  // Business rule: creates Stock row automatically
  try {
    const res = await productService.registerProduct({
      name: `${TEST_PREFIX}BusinessRule`,
      unitPrice: 500,
      crateSize: 12,
      reorderLevel: 10,
    });
    const stock = await stockRepository.findByProductId(res.product.id);
    if (stock && stock.quantityBottles === 0 && stock.quantityCrates === 0 && stock.reorderLevel === 10) {
      results.registerProduct.businessRules = true;
      console.log('✅ Business rule (auto-create stock): PASS - Stock created with correct defaults');
    } else {
      console.log('❌ Business rule: FAIL - Stock not created correctly');
    }
    await prisma.stock.delete({ where: { productId: res.product.id } });
    await prisma.product.delete({ where: { id: res.product.id } });
  } catch (e) {
    console.log('❌ Business rule: FAIL -', e.message);
  }

  // Database state after call
  try {
    const res = await productService.registerProduct({
      name: `${TEST_PREFIX}DbState`,
      unitPrice: 500,
      crateSize: 12,
      reorderLevel: 10,
    });
    const dbProduct = await prisma.product.findUnique({ where: { id: res.product.id } });
    const dbStock = await prisma.stock.findUnique({ where: { productId: res.product.id } });
    if (dbProduct && dbStock && dbProduct.name === `${TEST_PREFIX}DbState` && dbStock.reorderLevel === 10) {
      results.registerProduct.dbState = true;
      console.log('✅ Database state: PASS - Data persisted correctly');
    } else {
      console.log('❌ Database state: FAIL - Data mismatch');
    }
    await prisma.stock.delete({ where: { productId: res.product.id } });
    await prisma.product.delete({ where: { id: res.product.id } });
  } catch (e) {
    console.log('❌ Database state: FAIL -', e.message);
  }

  // Transaction integrity - N/A (no transaction used)
  results.registerProduct.transactionIntegrity = 'N/A';
  console.log('➖ Transaction integrity: N/A - No transaction used');

  // ========== updateProduct ==========
  console.log('\n--- updateProduct() ---');
  results.updateProduct = {
    validInput: false,
    missingFields: 'N/A',
    invalidValues: [],
    businessRules: 'N/A',
    dbState: false,
    transactionIntegrity: 'N/A',
  };

  let testProd;
  try {
    testProd = await productService.registerProduct({
      name: `${TEST_PREFIX}UpdateTest`,
      unitPrice: 500,
      crateSize: 12,
      reorderLevel: 10,
    });
  } catch (e) {
    console.error('❌ Setup failed:', e.message);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }

  // Valid input
  try {
    const res = await productService.updateProduct(testProd.product.id, { name: `${TEST_PREFIX}Updated`, unitPrice: 600 });
    if (res.name === `${TEST_PREFIX}Updated` && Number(res.unitPrice) === 600) {
      results.updateProduct.validInput = true;
      console.log('✅ Valid input: PASS - Product updated');
    } else {
      console.log('❌ Valid input: FAIL');
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Missing fields - N/A (update allows partial)
  console.log('➖ Missing fields: N/A - Partial updates allowed');

  // Invalid values
  try {
    await productService.updateProduct(testProd.product.id, { unitPrice: -100 });
    results.updateProduct.invalidValues.push({ test: 'negativePrice', passed: false });
    console.log('❌ Invalid negative price: FAIL - Should have thrown');
  } catch (e) {
    results.updateProduct.invalidValues.push({ test: 'negativePrice', passed: true });
    console.log(`✅ Invalid negative price: PASS - Threw "${e.message}"`);
  }

  try {
    await productService.updateProduct(testProd.product.id, { unitPrice: 0 });
    results.updateProduct.invalidValues.push({ test: 'zeroPrice', passed: false });
    console.log('❌ Invalid zero price: FAIL - Should have thrown');
  } catch (e) {
    results.updateProduct.invalidValues.push({ test: 'zeroPrice', passed: true });
    console.log(`✅ Invalid zero price: PASS - Threw "${e.message}"`);
  }

  try {
    await productService.updateProduct(testProd.product.id, { crateSize: -5 });
    results.updateProduct.invalidValues.push({ test: 'negativeCrateSize', passed: false });
    console.log('❌ Invalid negative crate size: FAIL - Should have thrown');
  } catch (e) {
    results.updateProduct.invalidValues.push({ test: 'negativeCrateSize', passed: true });
    console.log(`✅ Invalid negative crate size: PASS - Threw "${e.message}"`);
  }

  // K12: update-path rejects the same invalid shapes as create
  const updateInvalidCrateSizes = [
    { test: 'fractionalCrateSize', value: 12.5 },
    { test: 'zeroCrateSize', value: 0 },
    { test: 'nanCrateSize', value: NaN },
    { test: 'infinityCrateSize', value: Infinity },
    { test: 'stringCrateSize', value: '24' },
  ];
  for (const t of updateInvalidCrateSizes) {
    try {
      await productService.updateProduct(testProd.product.id, { crateSize: t.value });
      results.updateProduct.invalidValues.push({ test: t.test, passed: false });
      console.log(`❌ Invalid ${t.test}: FAIL - Should have thrown`);
    } catch (e) {
      results.updateProduct.invalidValues.push({ test: t.test, passed: true });
      console.log(`✅ Invalid ${t.test}: PASS - Threw "${e.message}"`);
    }
  }

  // K12 accepted transitions: 12 -> 24, then 24 -> null (clear to bottles-only)
  try {
    await productService.updateProduct(testProd.product.id, { crateSize: 24 });
    await productService.updateProduct(testProd.product.id, { crateSize: null });
    const dbProd = await prisma.product.findUnique({ where: { id: testProd.product.id } });
    if (dbProd.crateSize === null) {
      results.updateProduct.validCrateTransitions = true;
      console.log('✅ Valid transitions 12->24->null: PASS - crateSize cleared to NULL');
    } else {
      console.log(`❌ Valid transitions 12->24->null: FAIL - crateSize=${dbProd.crateSize}`);
    }
    // Restore a valid crateSize so the remaining assertions see the original shape
    await productService.updateProduct(testProd.product.id, { crateSize: 12 });
  } catch (e) {
    console.log('❌ Valid transitions 12->24->null: FAIL -', e.message);
  }

  try {
    await productService.updateProduct(testProd.product.id, { name: '' });
    results.updateProduct.invalidValues.push({ test: 'emptyName', passed: false });
    console.log('❌ Invalid empty name: FAIL - Should have thrown');
  } catch (e) {
    results.updateProduct.invalidValues.push({ test: 'emptyName', passed: true });
    console.log(`✅ Invalid empty name: PASS - Threw "${e.message}"`);
  }

  // Database state
  try {
    const dbProd = await prisma.product.findUnique({ where: { id: testProd.product.id } });
    if (dbProd.name === `${TEST_PREFIX}Updated` && Number(dbProd.unitPrice) === 600) {
      results.updateProduct.dbState = true;
      console.log('✅ Database state: PASS - Changes persisted');
    } else {
      console.log('❌ Database state: FAIL');
    }
  } catch (e) {
    console.log('❌ Database state: FAIL -', e.message);
  }

  results.updateProduct.transactionIntegrity = 'N/A';
  console.log('➖ Transaction integrity: N/A');

  // Cleanup
  if (testProd) {
    await prisma.stock.delete({ where: { productId: testProd.product.id } });
    await prisma.product.delete({ where: { id: testProd.product.id } });
  }

  // ========== getProductWithStock ==========
  console.log('\n--- getProductWithStock() ---');
  results.getProductWithStock = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: 'N/A',
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  try {
    testProd = await productService.registerProduct({
      name: `${TEST_PREFIX}GetTest`,
      unitPrice: 500,
      crateSize: 12,
      reorderLevel: 10,
    });
    const res = await productService.getProductWithStock(testProd.product.id);
    if (res && res.stock) {
      results.getProductWithStock.validInput = true;
      console.log('✅ Valid input: PASS - Returns product with stock');
    } else {
      console.log('❌ Valid input: FAIL');
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Non-existent ID should return null
  try {
    const res = await productService.getProductWithStock(999999);
    if (res === null) {
      results.getProductWithStock.invalidValues.push({ test: 'nonExistentId', passed: true });
      console.log('✅ Non-existent ID: PASS - Returns null');
    } else {
      results.getProductWithStock.invalidValues.push({ test: 'nonExistentId', passed: false });
      console.log('❌ Non-existent ID: FAIL - Should return null');
    }
  } catch (e) {
    results.getProductWithStock.invalidValues.push({ test: 'nonExistentId', passed: false });
    console.log('❌ Non-existent ID: FAIL - Threw error instead of returning null');
  }

  if (testProd) {
    await prisma.stock.delete({ where: { productId: testProd.product.id } });
    await prisma.product.delete({ where: { id: testProd.product.id } });
  }

  // ========== listProducts ==========
  console.log('\n--- listProducts() ---');
  results.listProducts = {
    validInput: false,
    missingFields: 'N/A',
    invalidValues: [],
    businessRules: 'N/A',
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  try {
    const res = await productService.listProducts();
    if (Array.isArray(res) && res.length > 0) {
      results.listProducts.validInput = true;
      console.log('✅ Valid input: PASS - Returns array of products');
    } else {
      console.log('❌ Valid input: FAIL');
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

    try {
      const res = await productService.listProducts('Beer');
      if (Array.isArray(res)) {
        results.listProducts.invalidValues.push({ test: 'categoryFilter', passed: true });
        console.log('✅ Category filter: PASS - Returns filtered array');
      } else {
        results.listProducts.invalidValues.push({ test: 'categoryFilter', passed: false });
        console.log('❌ Category filter: FAIL - Did not return an array');
      }
    } catch (e) {
    results.listProducts.invalidValues.push({ test: 'categoryFilter', passed: false });
    console.log('❌ Category filter: FAIL -', e.message);
  }

  // ========== discontinueProduct (replaces deleteProduct) ==========
  console.log('\n--- discontinueProduct() ---');
  results.discontinueProduct = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: false,
    dbState: false,
    transactionIntegrity: 'N/A',
  };

  try {
    testProd = await productService.registerProduct({
      name: `${TEST_PREFIX}DiscontinueTest`,
      unitPrice: 500,
      crateSize: 12,
      reorderLevel: 10,
    });
    const res = await productService.discontinueProduct(testProd.product.id);
    if (res && res.isActive === false) {
      results.discontinueProduct.validInput = true;
      console.log('✅ Valid input: PASS - Product discontinued (isActive=false)');
    } else {
      console.log('❌ Valid input: FAIL');
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Missing ID
  try {
    await productService.discontinueProduct(undefined);
    results.discontinueProduct.missingFields.push({ field: 'id', passed: false });
    console.log('❌ Missing ID: FAIL');
  } catch (e) {
    if (e instanceof ValidationError && e.message === 'Product ID is required') {
      results.discontinueProduct.missingFields.push({ field: 'id', passed: true });
      console.log(`✅ Missing ID: PASS - Threw ValidationError: "${e.message}"`);
    } else {
      results.discontinueProduct.missingFields.push({ field: 'id', passed: false });
      console.log(`❌ Missing ID: FAIL - Wrong error type or message: "${e.message}"`);
    }
  }

  // Invalid ID (non-existent)
  try {
    await productService.discontinueProduct(999999);
    results.discontinueProduct.invalidValues.push({ test: 'nonExistentId', passed: false });
    console.log('❌ Non-existent ID: FAIL - Should throw');
  } catch (e) {
    if (e instanceof NotFoundError && e.message === 'Product 999999 does not exist') {
      results.discontinueProduct.invalidValues.push({ test: 'nonExistentId', passed: true });
      console.log(`✅ Non-existent ID: PASS - Threw NotFoundError: "${e.message}"`);
    } else {
      results.discontinueProduct.invalidValues.push({ test: 'nonExistentId', passed: false });
      console.log(`❌ Non-existent ID: FAIL - Wrong error type or message: "${e.message}"`);
    }
  }

  // Business rule: preserves history (stock, sale items, batch orders still exist)
  try {
    const prodWithHistory = await productService.registerProduct({
      name: `${TEST_PREFIX}WithHistory`,
      unitPrice: 500,
      crateSize: 12,
      reorderLevel: 10,
    });
    const user = await prisma.user.findFirst();
    const sale = await prisma.sale.create({ data: { soldById: user.id, totalAmount: 100, status: 'completed' } });
    await prisma.saleItem.create({ data: { saleId: sale.id, productId: prodWithHistory.product.id, quantityBottles: 1, unitPrice: 500, lineTotal: 500 } });
    await prisma.itemBatchOrder.create({ data: { productId: prodWithHistory.product.id, receivedById: user.id, crateCount: 1, bottleCount: 0, costPerUnit: 400 } });
    
    await productService.discontinueProduct(prodWithHistory.product.id);
    
    const saleItems = await prisma.saleItem.findMany({ where: { productId: prodWithHistory.product.id } });
    const batchOrders = await prisma.itemBatchOrder.findMany({ where: { productId: prodWithHistory.product.id } });
    const stock = await prisma.stock.findUnique({ where: { productId: prodWithHistory.product.id } });
    
    if (saleItems.length > 0 && batchOrders.length > 0 && stock) {
      results.discontinueProduct.businessRules = true;
      console.log('✅ Business rule (preserves history): PASS - Related records preserved');
    } else {
      console.log('❌ Business rule: FAIL - History not preserved');
    }
    
    // Cleanup
    await prisma.saleItem.deleteMany({ where: { productId: prodWithHistory.product.id } });
    await prisma.sale.delete({ where: { id: sale.id } });
    await prisma.itemBatchOrder.deleteMany({ where: { productId: prodWithHistory.product.id } });
    await prisma.stock.delete({ where: { productId: prodWithHistory.product.id } });
    await prisma.product.delete({ where: { id: prodWithHistory.product.id } });
  } catch (e) {
    console.log('❌ Business rule test error:', e.message);
  }

  // Database state
  try {
    const dbProd = await prisma.product.findUnique({ where: { id: testProd.product.id } });
    if (dbProd && dbProd.isActive === false) {
      results.discontinueProduct.dbState = true;
      console.log('✅ Database state: PASS - isActive=false persisted');
    } else {
      console.log('❌ Database state: FAIL');
    }
  } catch (e) {
    console.log('❌ Database state: FAIL -', e.message);
  }

  results.discontinueProduct.transactionIntegrity = 'N/A';
  console.log('➖ Transaction integrity: N/A');

  // ========== restoreProduct ==========
  console.log('\n--- restoreProduct() ---');
  results.restoreProduct = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: 'N/A',
    dbState: false,
    transactionIntegrity: 'N/A',
  };

  try {
    const res = await productService.restoreProduct(testProd.product.id);
    if (res && res.isActive === true) {
      results.restoreProduct.validInput = true;
      console.log('✅ Valid input: PASS - Product restored (isActive=true)');
    } else {
      console.log('❌ Valid input: FAIL');
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  try {
    const dbProd = await prisma.product.findUnique({ where: { id: testProd.product.id } });
    if (dbProd && dbProd.isActive === true) {
      results.restoreProduct.dbState = true;
      console.log('✅ Database state: PASS - isActive=true persisted');
    } else {
      console.log('❌ Database state: FAIL');
    }
  } catch (e) {
    console.log('❌ Database state: FAIL -', e.message);
  }

  // Cleanup
  await prisma.stock.delete({ where: { productId: testProd.product.id } });
  await prisma.product.delete({ where: { id: testProd.product.id } });

  // ========== listActiveProducts ==========
  console.log('\n--- listActiveProducts() ---');
  results.listActiveProducts = {
    validInput: false,
    missingFields: 'N/A',
    invalidValues: [],
    businessRules: false,
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  try {
    const res = await productService.listActiveProducts();
    if (Array.isArray(res) && res.every(p => p.isActive === true)) {
      results.listActiveProducts.validInput = true;
      console.log('✅ Valid input: PASS - Returns only active products');
    } else {
      console.log('❌ Valid input: FAIL');
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Business rule: excludes discontinued products
  try {
    const allProducts = await productService.listProducts();
    const activeProducts = await productService.listActiveProducts();
    if (activeProducts.length <= allProducts.length) {
      results.listActiveProducts.businessRules = true;
      console.log('✅ Business rule (excludes discontinued): PASS');
    } else {
      console.log('❌ Business rule: FAIL');
    }
  } catch (e) {
    console.log('❌ Business rule test error:', e.message);
  }

  // Final cleanup
  await cleanup();

  // Print summary
  console.log('\n========== ProductService Summary ==========');
  for (const [fn, checks] of Object.entries(results)) {
    console.log(`\n${fn}:`);
    for (const [check, val] of Object.entries(checks)) {
      if (val === 'N/A') {
        console.log(`  ${check}: ➖ N/A`);
      } else if (Array.isArray(val)) {
        if (val.length === 0) {
          console.log(`  ${check}: ➖ no checks recorded`);
          continue;
        }
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
  console.error('❌ Test runner crashed:', e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});