// repositories/stockRepository.js
// Uses shared PrismaClient (K8 fix)

const prisma = require('../../lib/prisma');

class StockRepository {
  // Use provided client or default to shared prisma
  _getClient(tx) {
    return tx || prisma;
  }

  async create(data, tx) {
    // data = { productId, quantityCrates, quantityBottles, reorderLevel }
    const client = this._getClient(tx);
    return client.stock.create({ data });
  }

  async findById(id, tx) {
    const client = this._getClient(tx);
    return client.stock.findUnique({
      where: { id },
    });
  }

  // Stock has one row per product, so this is the common lookup
  async findByProductId(productId, tx) {
    const client = this._getClient(tx);
    return client.stock.findUnique({
      where: { productId },
    });
  }

  async findAll(tx) {
    const client = this._getClient(tx);
    return client.stock.findMany();
  }

  async update(id, data, tx) {
    const client = this._getClient(tx);
    return client.stock.update({
      where: { id },
      data,
    });
  }

  // Update stock by productId (since Stock has a unique productId)
  async updateByProductId(productId, data, tx) {
    const client = this._getClient(tx);
    return client.stock.update({
      where: { productId },
      data,
    });
  }

  // K7 fix: Increment bottles and recalculate crates based on crateSize
  async incrementBottlesAndCrates(productId, bottleDelta, crateSize, tx) {
    const client = this._getClient(tx);

    if (!crateSize || crateSize <= 0) {
      // No crateSize defined, just update bottles
      return client.stock.update({
        where: { productId },
        data: { quantityBottles: { increment: bottleDelta } },
      });
    }

    // Read current stock, compute new values, update both
    const stock = await client.stock.findUnique({ where: { productId } });
    if (!stock) return null;

    const newBottles = stock.quantityBottles + bottleDelta;
    const newCrates = Math.floor(newBottles / crateSize);

    return client.stock.update({
      where: { productId },
      data: {
        quantityBottles: newBottles,
        quantityCrates: newCrates,
      },
    });
  }

  // Decrease bottle count AND update crates accordingly (K7 fix)
  async decrementBottlesAndCrates(productId, bottleDelta, crateSize, tx) {
    // bottleDelta is positive amount to decrement
    return this.incrementBottlesAndCrates(productId, -bottleDelta, crateSize, tx);
  }

  // K2 + K7 fix: Atomic conditional decrement with crate sync
  // Only decrements if sufficient stock exists
  // Returns count of updated rows (0 = insufficient stock)
  // Also updates crates based on new bottle count
  async conditionalDecrementWithCrates(productId, bottleDelta, crateSize, tx) {
    const client = this._getClient(tx);

    if (!crateSize || crateSize <= 0) {
      // No crateSize, just do conditional decrement
      const result = await client.stock.updateMany({
        where: {
          productId,
          quantityBottles: { gte: bottleDelta },
        },
        data: { quantityBottles: { decrement: bottleDelta } },
      });
      return result.count;
    }

    // For crate sync, we need to read current stock, check if sufficient,
    // then compute new values and update both
    const stock = await client.stock.findUnique({ where: { productId } });
    if (!stock) return 0;

    if (stock.quantityBottles < bottleDelta) {
      return 0; // Insufficient stock
    }

    const newBottles = stock.quantityBottles - bottleDelta;
    const newCrates = Math.floor(newBottles / crateSize);

    const result = await client.stock.updateMany({
      where: {
        productId,
        quantityBottles: { gte: bottleDelta },
      },
      data: {
        quantityBottles: { decrement: bottleDelta },
        quantityCrates: newCrates,
      },
    });

    // If updateMany didn't work (race condition), try update with exact match
    if (result.count === 0) {
      // Double-check with exact match
      const checkStock = await client.stock.findUnique({ where: { productId } });
      if (checkStock && checkStock.quantityBottles >= bottleDelta) {
        const newBottles2 = checkStock.quantityBottles - bottleDelta;
        const newCrates2 = Math.floor(newBottles2 / crateSize);
        const result2 = await client.stock.update({
          where: { productId },
          data: {
            quantityBottles: newBottles2,
            quantityCrates: newCrates2,
          },
        });
        return result2 ? 1 : 0;
      }
      return 0;
    }

    return result.count;
  }

  // K7 fix: Increment bottles and recalculate crates based on crateSize
  async incrementBottlesAndCrates(productId, bottleDelta, crateSize, tx) {
    const client = this._getClient(tx);

    if (!crateSize || crateSize <= 0) {
      // No crateSize defined, just update bottles
      return client.stock.update({
        where: { productId },
        data: { quantityBottles: { increment: bottleDelta } },
      });
    }

    // Read current stock, compute new values, update both
    const stock = await client.stock.findUnique({ where: { productId } });
    if (!stock) return null;

    const newBottles = stock.quantityBottles + bottleDelta;
    const newCrates = Math.floor(newBottles / crateSize);

    return client.stock.update({
      where: { productId },
      data: {
        quantityBottles: newBottles,
        quantityCrates: newCrates,
      },
    });
  }

  // Decrease bottle count AND update crates accordingly (K7 fix)
  async decrementBottlesAndCrates(productId, bottleDelta, crateSize, tx) {
    // bottleDelta is positive amount to decrement
    return this.incrementBottlesAndCrates(productId, -bottleDelta, crateSize, tx);
  }

  // Find products at or below their reorder level.
  // Prisma can't compare two columns of the same row directly in `where`,
  // so we fetch all stock rows and filter in JavaScript instead.
  async findLowStock(tx) {
    const client = this._getClient(tx);
    const allStock = await client.stock.findMany({
      include: { product: true },
    });
    return allStock.filter((s) => s.quantityBottles <= s.reorderLevel);
  }

  async delete(id, tx) {
    const client = this._getClient(tx);
    return client.stock.delete({
      where: { id },
    });
  }
}

module.exports = new StockRepository();