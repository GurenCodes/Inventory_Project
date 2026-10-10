const jwt = require('jsonwebtoken');
const { app } = require('../server');
const supertest = require('supertest');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

async function test() {
  console.log('Testing JWT expiration behavior...\n');
  
  // Find an admin user
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) {
    console.log('No admin user found');
    return;
  }
  
  // Test 1: Valid token should work
  console.log('Test 1: Valid token (8h expiry)');
  const validToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '8h' });
  const res1 = await supertest(app).get('/products').set('Authorization', `Bearer ${validToken}`);
  console.log('  Valid token (8h): Status', res1.status, '-', res1.status === 200 ? 'PASS' : 'FAIL');
  
  // Test 2: Expired token should be rejected
  console.log('\nTest 2: Expired token');
  const expiredToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '-1h' });
  const res2 = await supertest(app).get('/products').set('Authorization', `Bearer ${expiredToken}`);
  console.log('  Expired token (-1h): Status', res2.status, '-', res2.status === 401 ? 'PASS' : 'FAIL');
  console.log('  Error message:', res2.body?.error);
  
  // Test 3: Malformed token should be rejected
  console.log('\nTest 3: Malformed token');
  const res3 = await supertest(app).get('/products').set('Authorization', 'Bearer invalid.token.here');
  console.log('  Malformed token: Status', res3.status, '-', res3.status === 401 ? 'PASS' : 'FAIL');
  
  // Test 4: Token with invalid signature
  console.log('\nTest 4: Invalid signature');
  const wrongSecret = 'wrong-secret';
  const wrongToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, wrongSecret, { expiresIn: '8h' });
  const res4 = await supertest(app).get('/products').set('Authorization', `Bearer ${wrongToken}`);
  console.log('  Wrong secret: Status', res4.status, '-', res4.status === 401 ? 'PASS' : 'FAIL');
  
  // Test 5: Missing token
  console.log('\nTest 5: Missing token');
  const res5 = await supertest(app).get('/products');
  console.log('  No token: Status', res5.status, '-', res5.status === 401 ? 'PASS' : 'FAIL');
  
  // Test 6: Missing Bearer prefix
  console.log('\nTest 6: Missing Bearer prefix');
  const res6 = await supertest(app).get('/products').set('Authorization', validToken);
  console.log('  No Bearer prefix: Status', res6.status, '-', res6.status === 401 ? 'PASS' : 'FAIL');
  
  // Test 7: Role-based authorization
  console.log('\nTest 7: Role-based authorization');
  const managerUser = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
  if (managerUser) {
    const managerToken = jwt.sign({ userId: managerUser.id, role: 'MANAGER' }, JWT_SECRET, { expiresIn: '8h' });
    const res7 = await supertest(app).post('/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Test Product', unitPrice: 500, crateSize: 12, reorderLevel: 10 });
    console.log('  MANAGER trying ADMIN route: Status', res7.status, '-', res7.status === 403 ? 'PASS' : 'FAIL');
  }
  
  await prisma.$disconnect();
  console.log('\n✅ All JWT security tests completed!');
}

test().catch(console.error);