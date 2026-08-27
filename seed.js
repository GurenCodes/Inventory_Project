const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Clear existing data first (children before parents, to respect relations)
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.itemBatchOrder.deleteMany();
  await prisma.dailyReport.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // 1. Users (10)
  const roles = ['ADMIN', 'MANAGER'];
  const users = [];
  for (let i = 1; i <= 10; i++) {
    const user = await prisma.user.create({
      data: {
        fullName: `Staff Member ${i}`,
        email: `staff${i}@floramagg.com`,
        passwordHash: `hashed_password_${i}`,
        role: roles[i % roles.length],
      },
    });
    users.push(user);
  }

  // 2. Products (10)
  const productNames = [
    'Export 650ml', 'Tusker Lager 500ml', 'Guinness 500ml', 'Coca-Cola 500ml',
    'Fanta Orange 500ml', 'Sprite 500ml', 'Heineken 330ml', 'Malta Guinness 330ml',
    'Bottled Water 1.5L', 'Orange Juice 1L',
  ];
  const products = [];
  for (let i = 0; i < 10; i++) {
    const product = await prisma.product.create({
      data: {
        name: productNames[i],
        category: i < 7 ? 'Beer' : 'Soft Drink',
        unitPrice: 500 + i * 50,
        crateSize: 12,
      },
    });
    products.push(product);
  }

  // 3. Stock (10, one per product)
  for (let i = 0; i < 10; i++) {
    await prisma.stock.create({
      data: {
        productId: products[i].id,
        quantityCrates: 5 + i,
        quantityBottles: 10 + i * 2,
        reorderLevel: 24,
      },
    });
  }

  // 4. ItemBatchOrder (10)
  for (let i = 0; i < 10; i++) {
    await prisma.itemBatchOrder.create({
      data: {
        productId: products[i].id,
        receivedById: users[i].id,
        crateCount: 2 + i,
        bottleCount: i,
        costPerUnit: 400 + i * 20,
        expiryDate: new Date('2027-01-01'),
      },
    });
  }

  // 5. Sale (10)
  const sales = [];
  for (let i = 0; i < 10; i++) {
    const sale = await prisma.sale.create({
      data: {
        soldById: users[i].id,
        totalAmount: 0, // placeholder, updated after we add SaleItem
        status: i % 2 === 0 ? 'completed' : 'pending',
      },
    });
    sales.push(sale);
  }

  // 6. SaleItem (10, one per sale) + update each Sale's totalAmount
  for (let i = 0; i < 10; i++) {
    const product = products[i];
    const quantity = 2 + i;
    const unitPrice = product.unitPrice;
    const lineTotal = quantity * unitPrice;

    await prisma.saleItem.create({
      data: {
        saleId: sales[i].id,
        productId: product.id,
        quantityBottles: quantity,
        unitPrice: unitPrice,
        lineTotal: lineTotal,
      },
    });

    await prisma.sale.update({
      where: { id: sales[i].id },
      data: { totalAmount: lineTotal },
    });
  }

  // 7. DailyReport (10, one per day going backward)
  for (let i = 0; i < 10; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    await prisma.dailyReport.create({
      data: {
        reportDate: date,
        generatedById: users[i].id,
        totalSalesAmount: 1000 + i * 150,
      },
    });
  }

  console.log('Seed complete: 10 rows created in each of the 7 tables.');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());