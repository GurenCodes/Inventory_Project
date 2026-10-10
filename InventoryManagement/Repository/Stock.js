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

  // K7 fix: Increment bottles and recalculate crates based on crateSize.
  // Uses an atomic increment for bottles; crates are recalculated from the
  // resulting bottle count so they never drift.
  async incrementBottlesAndCrates(productId, bottleDelta, crateSize, tx) {
    const client = this._getClient(tx);

    if (!crateSize || crateSize <= 0) {
      // No crateSize defined, just update bottles
      return client.stock.update({
        where: { productId },
        data: { quantityBottles: { increment: bottleDelta } },
      });
    }

    // Atomic increment of bottles first
    const updated = await client.stock.update({
      where: { productId },
      data: { quantityBottles: { increment: bottleDelta } },
    });

    // Recalculate crates from the new bottle total (K7), guarded on the
    // exact bottle count we computed from so concurrent updates cannot
    // leave stale crates.
    const newCrates = Math.floor(updated.quantityBottles / crateSize);
    if (newCrates === updated.quantityCrates) {
      return updated;
    }
    await client.stock.updateMany({
      where: { productId, quantityBottles: updated.quantityBottles },
      data: { quantityCrates: newCrates },
    });
    return client.stock.findUnique({ where: { productId } });
  }

  // Decrease bottle count AND update crates accordingly (K7 fix)
  async decrementBottlesAndCrates(productId, bottleDelta, crateSize, tx) {
    // bottleDelta is positive amount to decrement
    return this.incrementBottlesAndCrates(productId, -bottleDelta, crateSize, tx);
  }

  // K2 + K7 fix: Atomic conditional decrement with crate sync.
  // Only decrements if sufficient stock exists (checked inside the UPDATE
  // itself, so concurrent sales can never oversell).
  // Returns count of updated rows (0 = insufficient stock).
  // Crates are recalculated from the new bottle total (K7).
  async conditionalDecrementWithCrates(productId, bottleDelta, crateSize, tx) {
    const client = this._getClient(tx);

    const result = await client.stock.updateMany({
      where: {
        productId,
        quantityBottles: { gte: bottleDelta },
      },
      data: { quantityBottles: { decrement: bottleDelta } },
    });

    if (result.count === 0) {
      return 0; // Insufficient stock (or missing row)
    }

    // Sync crates with the new bottle count (K7). Only needed when the
    // product tracks crate size. The where-clause guards on the exact bottle
    // count we computed from, so a concurrent update cannot leave stale crates.
    if (crateSize && crateSize > 0) {
      const stock = await client.stock.findUnique({ where: { productId } });
      if (stock) {
        const newCrates = Math.floor(stock.quantityBottles / crateSize);
        if (newCrates !== stock.quantityCrates) {
          await client.stock.updateMany({
            where: { productId, quantityBottles: stock.quantityBottles },
            data: { quantityCrates: newCrates },
          });
        }
      }
    }

    return result.count;
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
