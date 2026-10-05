const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authService = require('../UserManagement/Services/AuthService');
const userService = require('../UserManagement/Services/UserService');

const TEST_PREFIX = 'TEST_';

async function cleanup() {
  const testUsers = await prisma.user.findMany({
    where: { email: { startsWith: TEST_PREFIX.toLowerCase() } },
    select: { id: true },
  });
  for (const u of testUsers) {
    await prisma.user.delete({ where: { id: u.id } });
  }
}

async function runTests() {
  console.log('\n========== AuthService + UserService Tests (bcrypt) ==========\n');
  
  // Clean up before running
  await cleanup();
  
  const results = {};

  // ========== UserService.createUser ==========
  console.log('--- UserService.createUser() ---');
  results.createUser = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: false,
    dbState: false,
    transactionIntegrity: 'N/A',
  };

  // Valid input - note: email gets lowercased
  const testEmail = `${TEST_PREFIX.toLowerCase()}test@floramagg.com`;
  try {
    const res = await userService.createUser({
      fullName: `${TEST_PREFIX}Test User`,
      email: `${TEST_PREFIX}test@floramagg.com`, // Will be lowercased
      password: 'securepassword123',
      role: 'MANAGER',
    });
    if (res && res.id && res.email === testEmail && !('passwordHash' in res)) {
      results.createUser.validInput = true;
      console.log('✅ Valid input: PASS - User created, passwordHash not returned');
    } else {
      console.log('❌ Valid input: FAIL - Response:', res);
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Missing required fields
  const requiredFields = ['fullName', 'email', 'password'];
  for (const field of requiredFields) {
    try {
      const data = { fullName: `${TEST_PREFIX}Test`, email: `${TEST_PREFIX.toLowerCase()}test2@floramagg.com`, password: 'securepassword123', role: 'MANAGER' };
      delete data[field];
      await userService.createUser(data);
      results.createUser.missingFields.push({ field, passed: false });
      console.log(`❌ Missing ${field}: FAIL - Should have thrown`);
    } catch (e) {
      results.createUser.missingFields.push({ field, passed: true });
      console.log(`✅ Missing ${field}: PASS - Threw "${e.message}"`);
    }
  }

  // Invalid values
  const invalidTests = [
    { name: 'emptyFullName', data: { fullName: '', email: `${TEST_PREFIX.toLowerCase()}empty@floramagg.com`, password: 'pass' } },
    { name: 'emptyEmail', data: { fullName: 'Test', email: '', password: 'pass' } },
    { name: 'emptyPassword', data: { fullName: 'Test', email: `${TEST_PREFIX.toLowerCase()}empty@floramagg.com`, password: '' } },
    { name: 'duplicateEmail', data: { fullName: 'Test', email: `${TEST_PREFIX}test@floramagg.com`, password: 'pass' } },
  ];
  for (const test of invalidTests) {
    try {
      await userService.createUser(test.data);
      results.createUser.invalidValues.push({ test: test.name, passed: false });
      console.log(`❌ Invalid ${test.name}: FAIL - Should have thrown`);
    } catch (e) {
      results.createUser.invalidValues.push({ test: test.name, passed: true });
      console.log(`✅ Invalid ${test.name}: PASS - Threw "${e.message}"`);
    }
  }

  // Business rule: password is hashed, not stored in plain text
  try {
    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    if (dbUser && dbUser.passwordHash && dbUser.passwordHash !== 'securepassword123' && dbUser.passwordHash.startsWith('$2b$')) {
      results.createUser.businessRules = true;
      console.log('✅ Business rule (password hashed): PASS - Stored as bcrypt hash');
    } else {
      console.log('❌ Business rule: FAIL - Password not hashed properly');
    }
  } catch (e) {
    console.log('❌ Business rule: FAIL -', e.message);
  }

  // Database state
  try {
    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    if (dbUser && dbUser.fullName === `${TEST_PREFIX}Test User` && dbUser.email === testEmail) {
      results.createUser.dbState = true;
      console.log('✅ Database state: PASS - User persisted correctly');
    } else {
      console.log('❌ Database state: FAIL');
    }
  } catch (e) {
    console.log('❌ Database state: FAIL -', e.message);
  }

  results.createUser.transactionIntegrity = 'N/A';
  console.log('➖ Transaction integrity: N/A');

  // ========== AuthService.login ==========
  console.log('\n--- AuthService.login() ---');
  results.login = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: false,
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  // Valid input - correct password
  try {
    const res = await authService.login(testEmail, 'securepassword123');
    if (res && res.id && res.email === testEmail && !('passwordHash' in res)) {
      results.login.validInput = true;
      console.log('✅ Valid input (correct password): PASS - Login successful');
    } else {
      console.log('❌ Valid input: FAIL');
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Missing required fields
  const loginRequiredFields = ['email', 'password'];
  for (const field of loginRequiredFields) {
    try {
      const args = field === 'email' ? [undefined, 'securepassword123'] : [testEmail, undefined];
      await authService.login(args[0], args[1]);
      results.login.missingFields.push({ field, passed: false });
      console.log(`❌ Missing ${field}: FAIL - Should have thrown`);
    } catch (e) {
      results.login.missingFields.push({ field, passed: true });
      console.log(`✅ Missing ${field}: PASS - Threw "${e.message}"`);
    }
  }

  // Invalid values
  const loginInvalidTests = [
    { name: 'wrongPassword', email: testEmail, password: 'wrongpassword' },
    { name: 'nonExistentEmail', email: 'nonexistent@floramagg.com', password: 'securepassword123' },
    { name: 'emptyPassword', email: testEmail, password: '' },
    { name: 'emptyEmail', email: '', password: 'securepassword123' },
  ];
  for (const test of loginInvalidTests) {
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
    const res = await authService.login(testEmail, 'securepassword123');
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

  // ========== UserService.verifyPassword ==========
  console.log('\n--- UserService.verifyPassword() ---');
  results.verifyPassword = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: 'N/A',
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  try {
    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    const valid = await userService.verifyPassword('securepassword123', dbUser.passwordHash);
    const invalid = await userService.verifyPassword('wrongpassword', dbUser.passwordHash);
    if (valid === true && invalid === false) {
      results.verifyPassword.validInput = true;
      console.log('✅ Valid input: PASS - Correct password returns true, wrong returns false');
    } else {
      console.log('❌ Valid input: FAIL - valid:', valid, 'invalid:', invalid);
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // ========== UserService.hashPassword ==========
  console.log('\n--- UserService.hashPassword() ---');
  results.hashPassword = {
    validInput: false,
    missingFields: [],
    invalidValues: [],
    businessRules: false,
    dbState: 'N/A',
    transactionIntegrity: 'N/A',
  };

  try {
    const hash = await userService.hashPassword('testpassword123');
    if (hash && hash.startsWith('$2b$')) {
      results.hashPassword.validInput = true;
      console.log('✅ Valid input: PASS - Returns bcrypt hash');
    } else {
      console.log('❌ Valid input: FAIL');
    }
  } catch (e) {
    console.log('❌ Valid input: FAIL -', e.message);
  }

  // Business rule: same password produces different hashes (salt)
  try {
    const hash1 = await userService.hashPassword('samepassword');
    const hash2 = await userService.hashPassword('samepassword');
    if (hash1 !== hash2) {
      results.hashPassword.businessRules = true;
      console.log('✅ Business rule (unique salts): PASS - Different hashes for same password');
    } else {
      console.log('❌ Business rule: FAIL - Hashes are identical (no salt?)');
    }
  } catch (e) {
    console.log('❌ Business rule: FAIL -', e.message);
  }

  // ========== UserService.getUserById / getUserByEmail / listUsers ==========
  console.log('\n--- UserService lookup methods (no passwordHash) ---');
  results.lookups = {
    validInput: false,
    businessRules: false,
    dbState: 'N/A',
  };

  try {
    // Use first seeded user (ID 25)
    const byId = await userService.getUserById(25);
    const byEmail = await userService.getUserByEmail('staff1@floramagg.com');
    const list = await userService.listUsers();
    
    const allSafe = (byId && !('passwordHash' in byId)) && (byEmail && !('passwordHash' in byEmail)) && list.every(u => !('passwordHash' in u));
    if (allSafe) {
      results.lookups.validInput = true;
      results.lookups.businessRules = true;
      console.log('✅ Lookups: PASS - No passwordHash returned in any lookup method');
    } else {
      console.log('❌ Lookups: FAIL - passwordHash leaked');
    }
  } catch (e) {
    console.log('❌ Lookups: FAIL -', e.message);
  }

  // ========== Seeded users can still login ==========
  console.log('\n--- Seeded users login (bcrypt) ---');
  results.seededLogin = {
    validInput: false,
  };

  try {
    const res = await authService.login('staff1@floramagg.com', 'password_1');
    if (res && res.id && res.email === 'staff1@floramagg.com') {
      results.seededLogin.validInput = true;
      console.log('✅ Seeded user login: PASS - Original seeded users work with bcrypt');
    } else {
      console.log('❌ Seeded user login: FAIL');
    }
  } catch (e) {
    console.log('❌ Seeded user login: FAIL -', e.message);
  }

  // Cleanup
  await cleanup();

  // Summary
  console.log('\n========== Auth + User Service Summary ==========');
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