// repositories/stockRepository.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class StockRepository {
  async create(data) {
    // data = { productId, quantityCrates, quantityBottles, reorderLevel }
    return prisma.stock.create({ data });
  }

  async findById(id) {
    return prisma.stock.findUnique({
      where: { id },
    });
  }

  // Stock has one row per product, so this is the common lookup
  async findByProductId(productId) {
    return prisma.stock.findUnique({
      where: { productId },
    });
  }

  async findAll() {
    return prisma.stock.findMany();
  }

  async update(id, data) {
    return prisma.stock.update({
      where: { id },
      data,
    });
  }

  // Increase bottle count (e.g. after a batch order arrives)
  async incrementBottles(productId, amount) {
    return prisma.stock.update({
      where: { productId },
      data: { quantityBottles: { increment: amount } },
    });
  }

  // Decrease bottle count (e.g. after a sale)
  async decrementBottles(productId, amount) {
    return prisma.stock.update({
      where: { productId },
      data: { quantityBottles: { decrement: amount } },
    });
  }

  // Find products at or below their reorder level.
  // Prisma can't compare two columns of the same row directly in `where`,
  // so we fetch all stock rows and filter in JavaScript instead.
  async findLowStock() {
    const allStock = await prisma.stock.findMany({
      include: { product: true },
    });
    return allStock.filter((s) => s.quantityBottles <= s.reorderLevel);
  }

  async delete(id) {
    return prisma.stock.delete({
      where: { id },
    });
  }
}

module.exports = new StockRepository();