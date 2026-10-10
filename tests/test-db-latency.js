const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const start = Date.now();
  try {
    const users = await prisma.user.findMany({ take: 1 });
    console.log('Query took:', Date.now() - start, 'ms');
    console.log('Users found:', users.length);
  } catch (e) {
    console.error('Error:', e.message);
  }
  await prisma.$disconnect();
}

test();