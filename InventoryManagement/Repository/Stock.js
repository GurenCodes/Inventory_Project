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

  // K7 fix (2026-10 revision): bottles AND crates are updated in ONE
  // parameterized SQL statement, so PostgreSQL's row-level lock makes the
  // pair atomic under concurrency — no guard window in which a successful
  // return could carry a stale crate count. Crates are computed as
  // FLOOR(bottles / crateSize) from the row's own post-update value.
  // crateSize missing/<= 0 (K12): bottles update only, crates untouched
  // (preserves pre-existing behavior; never divides by zero).
  // Returns the updated stock row; throws a P2025-coded error when the
  // stock row does not exist (matches the previous Prisma `update` behavior).
  async incrementBottlesAndCrates(productId, bottleDelta, crateSize, tx) {
    const client = this._getClient(tx);

    let affected;
    if (!crateSize || crateSize <= 0) {
      affected = await client.$executeRaw`
        UPDATE "Stock"
        SET "quantityBottles" = "quantityBottles" + ${bottleDelta}
        WHERE "productId" = ${productId}`;
    } else {
      affected = await client.$executeRaw`
        UPDATE "Stock"
        SET "quantityBottles" = "quantityBottles" + ${bottleDelta},
            "quantityCrates" = FLOOR(("quantityBottles" + ${bottleDelta})::numeric / ${crateSize})
        WHERE "productId" = ${productId}`;
    }

    if (affected === 0) {
      const err = new Error(
        'An operation failed because it depends on one or more records that were required but not found.'
      );
      err.code = 'P2025';
      throw err;
    }
    return client.stock.findUnique({ where: { productId } });
  }

  // Decrease bottle count AND update crates accordingly (K7 fix)
  async decrementBottlesAndCrates(productId, bottleDelta, crateSize, tx) {
    // bottleDelta is positive amount to decrement
    return this.incrementBottlesAndCrates(productId, -bottleDelta, crateSize, tx);
  }

  // K2 + K7 fix (2026-10 revision): atomic conditional decrement with crate
  // sync in ONE parameterized SQL statement. The WHERE clause enforces
  // sufficient stock inside the UPDATE itself (no overselling), and the
  // SET clause recomputes crates from the same row value the decrement
  // applies to, so a successful return can never carry a stale crate count.
  // Returns count of updated rows (0 = insufficient stock or missing row).
  async conditionalDecrementWithCrates(productId, bottleDelta, crateSize, tx) {
    const client = this._getClient(tx);

    if (!crateSize || crateSize <= 0) {
      return client.$executeRaw`
        UPDATE "Stock"
        SET "quantityBottles" = "quantityBottles" - ${bottleDelta}
        WHERE "productId" = ${productId}
          AND "quantityBottles" >= ${bottleDelta}`;
    }
    return client.$executeRaw`
      UPDATE "Stock"
      SET "quantityBottles" = "quantityBottles" - ${bottleDelta},
          "quantityCrates" = FLOOR(("quantityBottles" - ${bottleDelta})::numeric / ${crateSize})
      WHERE "productId" = ${productId}
        AND "quantityBottles" >= ${bottleDelta}`;
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
