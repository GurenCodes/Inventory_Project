const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authService = require('../UserManagement/Services/AuthService');
const userRepository = require('../UserManagement/Repository/UserRepository');

const TEST_PREFIX = 'TEST_';

async function cleanup() {
  const testUsers = await prisma.user.findMany({
    where: { email: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });
  for (const u of testUsers) {
    await prisma.user.delete({ where: { id: u.id } });
  }
}

async function runTests() {
  console.log('\n========== AuthService Tests ==========\n');
  const results = {};

  // ========== login ==========
  console.log('--- login() ---');
  results.login = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: false,
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  let testUser;
  try {
    testUser = await userRepository.create({
      fullName: `${TEST_PREFIX}Test User`,
      email: `${TEST_PREFIX}test@floramagg.com`,
      passwordHash: 'testpassword123', // Plain text per current implementation
      role: 'MANAGER',
    });
  } catch (e) {
    console.log('Setup failed:', e.message);
  }

  // Valid input
  try {
    const res = await authService.login(testUser.email, 'testpassword123');
    if (res && res.id === testUser.id && res.email === testUser.email && !res.passwordHash) {
      results.login.validInput = true;
      console.log('✅ Valid input: PASS - Login successful, passwordHash stripped');
    } else {
      console.log('❌ Valid input: FAIL - Response:', res);
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Missing required fields
  const requiredFields = ['email', 'password'];
  for (const field of requiredFields) {
    try {
      const args = field === 'email' ? [undefined, 'testpassword123'] : [testUser.email, undefined];
      await authService.login(args[0], args[1]);
      results.login.missingFields.push({ field, passed: false });
      console.log(`❌ Missing ${field}: FAIL - Should have thrown`);
    } catch (e) {
      results.login.missingFields.push({ field, passed: true });
      console.log(`✅ Missing ${field}: PASS - Threw "${e.message}"`);
    }
  }

  // Invalid values
  const invalidTests = [
    { name: 'wrongPassword', email: testUser.email, password: 'wrongpassword' },
    { name: 'nonExistentEmail', email: 'nonexistent@floramagg.com', password: 'testpassword123' },
    { name: 'emptyPassword', email: testUser.email, password: '' },
    { name: 'emptyEmail', email: '', password: 'testpassword123' },
  ];
  for (const test of invalidTests) {
    try {
      await authService.login(test.email, test.password);
      results.login.invalidValues.push({ test: test.name, passed: false });
      console.log(`❌ Invalid ${test.name}: FAIL - Should have thrown`);
    } catch (e) {
      results.login.invalidValues.push({ test: test.name, passed: true });
      console.log(`✅ Invalid ${test.name}: PASS - Threw "${e.message}"`);
    }
  }

  // Business rule: passwordHash is never returned
  try {
    const res = await authService.login(testUser.email, 'testpassword123');
    if (res && !('passwordHash' in res)) {
      results.login.businessRules = true;
      console.log('✅ Business rule (no passwordHash): PASS - passwordHash not in response');
    } else {
      results.login.businessRules = false;
      console.log('❌ Business rule: FAIL - passwordHash present');
    }
  } catch (e) {
    console.log('❌ Business rule: FAIL -', e.message);
  }

  results.login.transactionIntegrity = 'N/A';
  console.log('➖ Transaction integrity: N/A');

  // ========== isAdmin ==========
  console.log('\n--- isAdmin() ---');
  results.isAdmin = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: 'N/A',
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  try {
    const adminUser = { ...testUser, role: 'ADMIN' };
    const managerUser = { ...testUser, role: 'MANAGER' };
    const resAdmin = authService.isAdmin(adminUser);
    const resManager = authService.isAdmin(managerUser);
    if (resAdmin === true && resManager === false) {
      results.isAdmin.validInput = true;
      console.log('✅ Valid input: PASS - Returns true for ADMIN, false for MANAGER');
    } else {
      console.log('❌ Valid input: FAIL - Admin:', resAdmin, 'Manager:', resManager);
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  try {
    const res = authService.isAdmin(null);
    if (res === false) {
      results.isAdmin.invalidValues.push({ test: 'nullUser', passed: true });
      console.log('✅ Null user: PASS - Returns false');
    } else {
      results.isAdmin.invalidValues.push({ test: 'nullUser', passed: false });
      console.log('❌ Null user: FAIL');
    }
  } catch (e) {
    results.isAdmin.invalidValues.push({ test: 'nullUser', passed: true });
    console.log(`✅ Null user: PASS - Threw`);
  }

  try {
    const res = authService.isAdmin({ role: 'UNKNOWN' });
    if (res === false) {
      results.isAdmin.invalidValues.push({ test: 'unknownRole', passed: true });
      console.log('✅ Unknown role: PASS - Returns false');
    } else {
      results.isAdmin.invalidValues.push({ test: 'unknownRole', passed: false });
      console.log('❌ Unknown role: FAIL');
    }
  } catch (e) {
    results.isAdmin.invalidValues.push({ test: 'unknownRole', passed: true });
    console.log(`✅ Unknown role: PASS - Threw`);
  }

  // ========== isManager ==========
  console.log('\n--- isManager() ---');
  results.isManager = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: 'N/A',
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  try {
    const adminUser = { ...testUser, role: 'ADMIN' };
    const managerUser = { ...testUser, role: 'MANAGER' };
    const resAdmin = authService.isManager(adminUser);
    const resManager = authService.isManager(managerUser);
    if (resAdmin === false && resManager === true) {
      results.isManager.validInput = true;
      console.log('✅ Valid input: PASS - Returns true for MANAGER, false for ADMIN');
    } else {
      console.log('❌ Valid input: FAIL - Admin:', resAdmin, 'Manager:', resManager);
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  try {
    const res = authService.isManager(null);
    if (res === false) {
      results.isManager.invalidValues.push({ test: 'nullUser', passed: true });
      console.log('✅ Null user: PASS - Returns false');
    } else {
      results.isManager.invalidValues.push({ test: 'nullUser', passed: false });
      console.log('❌ Null user: FAIL');
    }
  } catch (e) {
    results.isManager.invalidValues.push({ test: 'nullUser', passed: true });
    console.log(`✅ Null user: PASS - Threw`);
  }

  // Cleanup
  await cleanup();

  // Summary
  console.log('\n========== AuthService Summary ==========');
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