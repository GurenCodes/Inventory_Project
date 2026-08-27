const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create one user (staff member)
  const user = await prisma.user.create({
    data: {
      fullName: 'Glenn Admin',
      email: 'glenn@floramagg.com',
      passwordHash: 'temporary123',
      role: 'ADMIN',
    },
  });

  // Create one product
  const product = await prisma.product.create({
    data: {
      name: 'Export 650ml',
      category: 'Beer',
      unitPrice: 800.0,
      crateSize: 12,
    },
  });

  // Create its stock record
  await prisma.stock.create({
    data: {
      productId: product.id,
      quantityBottles: 24,
      quantityCrates: 2,
      reorderLevel: 24,
    },
  });

  console.log('Done! Created:', { user, product });
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());