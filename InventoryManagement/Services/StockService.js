// InventoryManagement/Service/StockService.js
// Uses shared PrismaClient (K8 fix)

const prisma = require('../../lib/prisma');

const stockRepository = require('../Repository/Stock');
const itemBatchOrderRepository = require('../Repository/ItemBatchOrder');
const productRepository = require('../Repository/Product');
const userRepository = require('../../UserManagement/Repository/UserRepository');
const { ValidationError, NotFoundError } = require('../../errors');

class StockService {
  // A delivery arrives from a supplier: log the batch order AND
  // increase Stock by the correct amount, in one atomic operation.
  // If either step fails, both are rolled back (no half-updated stock).
  async receiveBatchOrder({ productId, receivedById, crateCount, bottleCount, costPerUnit, expiryDate }) {
    if (productId === undefined || productId === null) {
      throw new ValidationError('Product ID is required');
    }
    if (receivedById === undefined || receivedById === null) {
      throw new ValidationError('Received by user ID is required');
    }

    // Validate that the user exists
    const user = await userRepository.findById(receivedById);
    if (!user) {
      throw new NotFoundError(`User ${receivedById} does not exist`);
    }

    if (costPerUnit === undefined || costPerUnit === null) {
      throw new ValidationError('Cost per unit is required');
    }
    if (typeof costPerUnit !== 'number' || costPerUnit <= 0) {
      throw new ValidationError('Cost per unit must be a positive number');
    }
    if (crateCount !== undefined && crateCount !== null) {
      if (typeof crateCount !== 'number' || crateCount < 0) {
        throw new ValidationError('Crate count must be a non-negative number');
      }
    }
    if (bottleCount !== undefined && bottleCount !== null) {
      if (typeof bottleCount !== 'number' || bottleCount < 0) {
        throw new ValidationError('Bottle count must be a non-negative number');
      }
    }
    if (crateCount === 0 && bottleCount === 0) {
      throw new ValidationError('At least one of crateCount or bottleCount must be greater than zero');
    }

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError(`Product ${productId} does not exist`);
    }

    // Convert crates into bottles using the product's own crate size
    const crateSize = product.crateSize ?? 0;
    const bottlesFromCrates = (crateCount ?? 0) * crateSize;
    const totalBottlesAdded = bottlesFromCrates + (bottleCount ?? 0);

    // $transaction ensures both writes succeed together or not at all.
    // K7 (2026-10 revision): bottles AND crates are updated in ONE atomic
    // parameterized SQL statement — crates are recomputed from the row's own
    // post-update bottle total when the product has a valid crateSize
    // (crates += delivered crates otherwise, preserving K12 behavior).
    // This removes the former read-then-guard window: concurrent deliveries
    // can no longer fail spuriously or leave a stale crate count, and a
    // missing stock row is the only failure mode of the stock update.
    const result = await prisma.$transaction(
      async (tx) => {
        const batchOrder = await tx.itemBatchOrder.create({
          data: { productId, receivedById, crateCount: crateCount ?? 0, bottleCount: bottleCount ?? 0, costPerUnit, expiryDate },
        });

        const affected = crateSize > 0
          ? await tx.$executeRaw`
              UPDATE "Stock"
              SET "quantityBottles" = "quantityBottles" + ${totalBottlesAdded},
                  "quantityCrates" = FLOOR(("quantityBottles" + ${totalBottlesAdded})::numeric / ${crateSize})
              WHERE "productId" = ${productId}`
          : await tx.$executeRaw`
              UPDATE "Stock"
              SET "quantityBottles" = "quantityBottles" + ${totalBottlesAdded},
                  "quantityCrates" = "quantityCrates" + ${crateCount ?? 0}
              WHERE "productId" = ${productId}`;

        if (affected === 0) {
          throw new NotFoundError(`No stock record for product ${productId}`);
        }

        const updatedStock = await tx.stock.findUnique({ where: { productId } });

        return { batchOrder, updatedStock };
      },
      { timeout: 60000 }
    );

    return result;
  }

  // K7 fix: Increment stock by bottles and update crates accordingly
  // Uses product's crateSize to keep crates in sync with bottles
  async incrementStock(productId, bottleDelta, crateSize) {
    return stockRepository.incrementBottlesAndCrates(productId, bottleDelta, crateSize);
  }

  // K7 fix: Decrement stock by bottles and update crates accordingly
  async decrementStock(productId, bottleDelta, crateSize) {
    return stockRepository.decrementBottlesAndCrates(productId, bottleDelta, crateSize);
  }

  async getStockForProduct(productId) {
    return stockRepository.findByProductId(productId);
  }

  // Returns null if no stock record exists for the product
  async getStockForProductSafe(productId) {
    return stockRepository.findByProductId(productId);
  }

  async listLowStock() {
    return stockRepository.findLowStock();
  }

  async adjustReorderLevel(productId, newLevel) {
    if (productId === undefined || productId === null) {
      throw new ValidationError('Product ID is required');
    }
    if (newLevel === undefined || newLevel === null) {
      throw new ValidationError('Reorder level is required');
    }
    if (typeof newLevel !== 'number' || newLevel < 0) {
      throw new ValidationError('Reorder level must be a non-negative number');
    }

    const stock = await stockRepository.findByProductId(productId);
    if (!stock) throw new NotFoundError(`No stock record for product ${productId}`);
    return stockRepository.update(stock.id, { reorderLevel: newLevel });
  }
}

module.exports = new StockService();