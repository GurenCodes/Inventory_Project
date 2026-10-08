// repositories/productRepository.js
// Uses shared PrismaClient (K8 fix)

const prisma = require('../../lib/prisma');

class ProductRepository {
  async create(data) {
    // data = { name, category, unitPrice, crateSize }
    return prisma.product.create({ data });
  }

  async findById(id) {
    return prisma.product.findUnique({
      where: { id },
    });
  }

  async findAll(category, onlyActive = false) {
    const where = {};
    if (category) where.category = category;
    if (onlyActive) where.isActive = true;
    return prisma.product.findMany({ where });
  }

  async update(id, data) {
    return prisma.product.update({
      where: { id },
      data,
    });
  }

  async delete(id) {
    return prisma.product.delete({
      where: { id },
    });
  }

  // Product plus its current stock level
  async findByIdWithStock(id) {
    return prisma.product.findUnique({
      where: { id },
      include: { stock: true },
    });
  }

  // Product plus its batch order history and sale history
  async findByIdWithHistory(id) {
    return prisma.product.findUnique({
      where: { id },
      include: { batchOrders: true, saleItems: true },
    });
  }
}

module.exports = new ProductRepository();