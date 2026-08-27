// repositories/itemBatchOrderRepository.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ItemBatchOrderRepository {
  async create(data) {
    // data = { productId, receivedById, crateCount, bottleCount, costPerUnit, expiryDate }
    return prisma.itemBatchOrder.create({ data });
  }

  async findById(id) {
    return prisma.itemBatchOrder.findUnique({
      where: { id },
    });
  }

  async findAll() {
    return prisma.itemBatchOrder.findMany();
  }

  // All batch orders for one product (restock history)
  async findByProductId(productId) {
    return prisma.itemBatchOrder.findMany({
      where: { productId },
      orderBy: { receivedAt: 'desc' },
    });
  }

  // All batch orders received by a specific user
  async findByReceivedById(receivedById) {
    return prisma.itemBatchOrder.findMany({
      where: { receivedById },
    });
  }

  // Batches expiring before a given date (useful for expiry alerts)
  async findExpiringBefore(date) {
    return prisma.itemBatchOrder.findMany({
      where: { expiryDate: { lte: date } },
      include: { product: true },
    });
  }

  async update(id, data) {
    return prisma.itemBatchOrder.update({
      where: { id },
      data,
    });
  }

  async delete(id) {
    return prisma.itemBatchOrder.delete({
      where: { id },
    });
  }
}

module.exports = new ItemBatchOrderRepository();