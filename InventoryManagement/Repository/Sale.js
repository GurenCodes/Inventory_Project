// repositories/saleRepository.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

  // Sale plus its line items and each item's product
  async findByIdWithItems(id) {
    return prisma.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
      },
    });
  }

  async findAll(status) {
    return prisma.sale.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  // All sales made by a specific user
  async findBySoldById(soldById) {
    return prisma.sale.findMany({
      where: { soldById },
    });
  }

  // Sales within a date range (for reporting)
  async findByDateRange(startDate, endDate) {
    return prisma.sale.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
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