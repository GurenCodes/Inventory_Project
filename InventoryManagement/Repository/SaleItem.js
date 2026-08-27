// repositories/saleItemRepository.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class SaleItemRepository {
  async create(data) {
    // data = { saleId, productId, quantityBottles, unitPrice, lineTotal }
    return prisma.saleItem.create({ data });
  }

  async findById(id) {
    return prisma.saleItem.findUnique({
      where: { id },
    });
  }

  // All line items belonging to one sale
  async findBySaleId(saleId) {
    return prisma.saleItem.findMany({
      where: { saleId },
      include: { product: true },
    });
  }

  // All sale items for a given product (useful for "how much of X has sold")
  async findByProductId(productId) {
    return prisma.saleItem.findMany({
      where: { productId },
    });
  }

  async update(id, data) {
    return prisma.saleItem.update({
      where: { id },
      data,
    });
  }

  async delete(id) {
    return prisma.saleItem.delete({
      where: { id },
    });
  }
}

module.exports = new SaleItemRepository();