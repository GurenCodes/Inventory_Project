// repositories/saleRepository.js
// Uses shared PrismaClient (K8 fix)

const prisma = require('../../lib/prisma');

class SaleRepository {
  async create(data) {
    // data = { soldById, totalAmount, status }
    return prisma.sale.create({ data });
  }

  async findById(id) {
    return prisma.sale.findUnique({
      where: { id },
    });
  }

  // Sale plus its line items, each item's product, and the seller
  async findByIdWithItems(id) {
    return prisma.sale.findUnique({
      where: { id },
      include: {
        soldBy: { select: { id: true, fullName: true } },
        items: { include: { product: true } },
      },
    });
  }

  async findAll(status) {
    return prisma.sale.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        soldBy: { select: { id: true, fullName: true } },
        items: { select: { id: true, productId: true, quantityBottles: true, unitPrice: true, lineTotal: true } },
      },
    });
  }

  // All sales made by a specific user
  async findBySoldById(soldById) {
    return prisma.sale.findMany({
      where: { soldById },
    });
  }

  // Sales within a half-open business-day interval (for reporting):
  // startInclusive <= createdAt < endExclusive.
  async findByDateRange(startInclusive, endExclusive) {
    return prisma.sale.findMany({
      where: {
        createdAt: { gte: startInclusive, lt: endExclusive },
      },
    });
  }

  async updateStatus(id, status) {
    return prisma.sale.update({
      where: { id },
      data: { status },
    });
  }

  async update(id, data) {
    return prisma.sale.update({
      where: { id },
      data,
    });
  }

  async delete(id) {
    return prisma.sale.delete({
      where: { id },
    });
  }
}

module.exports = new SaleRepository();