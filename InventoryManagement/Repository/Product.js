// repositories/productRepository.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

  async findAll(category) {
    return prisma.product.findMany({
      where: category ? { category } : undefined,
    });
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